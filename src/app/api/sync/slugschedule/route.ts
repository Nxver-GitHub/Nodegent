import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchQuery, fetchMutation } from "convex/nextjs";
import { api } from "@convex/_generated/api";
import * as cheerio from "cheerio";

export const maxDuration = 60;

function currentUcscTerm(): string {
  const now = new Date();
  const yy = String(now.getFullYear() % 100).padStart(2, "0");
  const m = now.getMonth() + 1;
  if (m >= 10) return `2${yy}8`; // Fall
  if (m >= 7) return `2${yy}4`;  // Summer
  if (m >= 4) return `2${yy}2`;  // Spring
  return `2${yy}0`;              // Winter
}

function parseCourseCode(raw: string): { subject: string; catalogNbr: string } | null {
  const m = raw.trim().match(/^([A-Z]+(?:\s+[A-Z]+)?)\s+(\w+)/i);
  if (!m) return null;
  return { subject: m[1].trim().toUpperCase(), catalogNbr: m[2].trim().toUpperCase() };
}

type Listing = {
  courseCode: string;
  sectionNumber: string;
  title: string;
  instructor?: string;
  enrolled?: number;
  capacity?: number;
  status?: string;
  meetingDays?: string;
  meetingTimes?: string;
  location?: string;
  instructionMode?: string;
  geRequirements?: string;
};

async function fetchPisaHtml(subject: string, catalogNbr: string, term: string): Promise<string> {
  const base = "https://pisa.ucsc.edu/class_search/index.php";
  const params = [
    ["action", "results"],
    ["binds[:term]", term],
    ["binds[:reg_status]", "all"],
    ["binds[:subject]", subject],
    ["binds[:catalog_nbr_op]", "="],
    ["binds[:catalog_nbr]", catalogNbr],
    ["binds[:title]", ""],
    ["binds[:instr_name_op]", "%"],
    ["binds[:instructor]", ""],
    ["binds[:ge]", ""],
    ["binds[:units]", ""],
    ["binds[:days]", ""],
    ["binds[:times]", ""],
    ["binds[:building]", ""],
    ["binds[:room]", ""],
  ];
  const qs = params.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
  const res = await fetch(`${base}?${qs}`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; Nodegent/1.0)",
      Accept: "text/html",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`pisa.ucsc.edu returned HTTP ${res.status}`);
  return res.text();
}

function parsePisaHtml(html: string, subject: string, catalogNbr: string): Listing[] {
  const $ = cheerio.load(html);
  const listings: Listing[] = [];

  // Collect course title from page headings (e.g. "CSE 115A Introduction to Software Engineering")
  let courseTitle = "";
  const titlePattern = new RegExp(`${subject}\\s+${catalogNbr}\\s+(.+)`, "i");
  $("h2, h3, h4, th[colspan], .panel-title, .class-title").each((_, el) => {
    const text = $(el).text().trim();
    const m = titlePattern.exec(text);
    if (m && !courseTitle) courseTitle = m[1].trim();
  });

  // Walk all table rows — skip header rows, extract section rows
  // pisa.ucsc.edu renders one row per section with cells:
  // Class#, Section, Type, Mode, Days, Times, Building, Instructor, Enrolled/Cap, Status
  $("table tr").each((_, row) => {
    const cells = $(row).find("td");
    if (cells.length < 5) return; // skip header rows and short rows

    const texts = cells.map((_, c) => $(c).text().replace(/\s+/g, " ").trim()).get();

    // Detect a section row: first cell is a 5-digit class number
    if (!/^\d{4,6}$/.test(texts[0])) return;

    // Try to detect column layout by looking at content patterns
    // Layout A (10 cols): classNbr, section, type, mode, days, times, building, instructor, enrolled, status
    // Layout B (9 cols):  classNbr, section, type, days, times, building, instructor, enrolled, status
    let section = "", mode = "", days = "", times = "", building = "", instructor = "", enrolledRaw = "", status = "";

    if (texts.length >= 10) {
      [, section, , mode, days, times, building, instructor, enrolledRaw, status] = texts;
    } else if (texts.length >= 9) {
      [, section, , days, times, building, instructor, enrolledRaw, status] = texts;
    } else if (texts.length >= 5) {
      section = texts[1] ?? "";
      days = texts[2] ?? "";
      times = texts[3] ?? "";
      enrolledRaw = texts[texts.length - 2] ?? "";
      status = texts[texts.length - 1] ?? "";
    }

    const code = `${subject} ${catalogNbr}`;

    // Parse enrollment: "35 / 50" or "35 of 50"
    let enrolled: number | undefined;
    let capacity: number | undefined;
    const enrM = enrolledRaw.match(/(\d+)\s*[/of]+\s*(\d+)/);
    if (enrM) {
      enrolled = parseInt(enrM[1], 10);
      capacity = parseInt(enrM[2], 10);
    }

    if (!section) return;
    listings.push({
      courseCode: code,
      sectionNumber: section,
      title: courseTitle || `${code}`,
      instructor: instructor || undefined,
      enrolled,
      capacity,
      status: status || undefined,
      meetingDays: days || undefined,
      meetingTimes: times || undefined,
      location: building || undefined,
      instructionMode: mode || undefined,
    });
  });

  return listings;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { userId, getToken } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = await getToken();
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const term = currentUcscTerm();

  let courses: { courseCode: string }[];
  try {
    courses = await fetchQuery(api.courses.getCourseSummaries, {}, { token });
  } catch {
    return NextResponse.json({ error: "Failed to load enrolled courses" }, { status: 500 });
  }

  if (courses.length === 0) {
    return NextResponse.json({ synced: 0, term, message: "No enrolled courses found" });
  }

  // Deduplicate by subject+catalogNbr to avoid redundant fetches
  const seen = new Set<string>();
  const toFetch: Array<{ subject: string; catalogNbr: string }> = [];
  for (const c of courses) {
    const parsed = parseCourseCode(c.courseCode);
    if (!parsed) continue;
    const key = `${parsed.subject}-${parsed.catalogNbr}`;
    if (!seen.has(key)) {
      seen.add(key);
      toFetch.push(parsed);
    }
  }

  const allListings: Listing[] = [];
  const errors: string[] = [];

  await Promise.allSettled(
    toFetch.map(async ({ subject, catalogNbr }) => {
      try {
        const html = await fetchPisaHtml(subject, catalogNbr, term);
        const parsed = parsePisaHtml(html, subject, catalogNbr);
        allListings.push(...parsed);
      } catch (err) {
        errors.push(`${subject} ${catalogNbr}: ${err instanceof Error ? err.message : "fetch failed"}`);
      }
    })
  );

  let synced = 0;
  if (allListings.length > 0) {
    try {
      const result = await fetchMutation(
        api.courseListings.upsertListings,
        { term, listings: allListings },
        { token }
      );
      synced = result.synced;
    } catch (err) {
      // Log detail server-side; return a generic message rather than leaking the
      // raw backend exception text to the client.
      console.error("[sync/slugschedule] upsertListings failed:", err);
      return NextResponse.json({ error: "Failed to save listings" }, { status: 500 });
    }
  }

  return NextResponse.json({ synced, term, errors: errors.length > 0 ? errors : undefined });
}
