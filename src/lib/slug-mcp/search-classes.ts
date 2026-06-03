import * as cheerio from "cheerio";

export interface SearchClassesArgs {
  term?: string;
  subject?: string;
  course_number?: string;
  instructor?: string;
  title?: string;
  open_only?: boolean;
}

const PISA_URL = "https://pisa.ucsc.edu/class_search/index.php";
const UA = "Mozilla/5.0 (compatible; Nodegent/1.0)";

function currentTermCode(): string {
  const now = new Date();
  const yy = String(now.getFullYear() % 100).padStart(2, "0");
  const m = now.getMonth() + 1;
  if (m <= 3) return `2${yy}0`;
  if (m <= 6) return `2${yy}2`;
  if (m <= 8) return `2${yy}4`;
  return `2${yy}8`;
}

function termName(code: string): string {
  const seasons: Record<string, string> = {
    "0": "Winter",
    "2": "Spring",
    "4": "Summer",
    "8": "Fall",
  };
  return `${seasons[code.slice(-1)] ?? "?"} 20${code.slice(1, 3)}`;
}

export async function searchClasses(args: SearchClassesArgs): Promise<string> {
  const term = args.term ?? currentTermCode();

  // GET the form page first to acquire any session cookies
  const formRes = await fetch(PISA_URL, { headers: { "User-Agent": UA } });
  const cookie = formRes.headers.get("set-cookie") ?? "";

  const body = new URLSearchParams({
    action: "results",
    "binds[:term]": term,
    "binds[:reg_status]": args.open_only ? "O" : "all",
    rec_start: "0",
    rec_dur: "25",
  });
  if (args.subject) body.set("binds[:subject]", args.subject.toUpperCase());
  if (args.course_number) {
    body.set("binds[:catalog_nbr]", args.course_number);
    body.set("binds[:catalog_nbr_op]", "=");
  }
  if (args.instructor) {
    body.set("binds[:instr_name]", args.instructor);
    body.set("binds[:instr_name_op]", "contains");
  }
  if (args.title) body.set("binds[:title]", args.title);

  const res = await fetch(PISA_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": UA,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body.toString(),
  });

  if (!res.ok) throw new Error(`pisa.ucsc.edu returned ${res.status}`);
  const html = await res.text();
  return parseResults(html, term);
}

function parseResults(html: string, term: string): string {
  const $ = cheerio.load(html);
  const panels = $("div.panel.panel-default.row[id^='rowpanel_']");
  if (panels.length === 0) return "No classes found matching your search criteria.";

  const lines: string[] = [`## Class Search Results (${termName(term)})\n`];

  panels.each((_i, el) => {
    const link = $(el).find("a[id^='class_id_']").first();
    if (!link.length) return;

    const classNum = (link.attr("id") ?? "").replace("class_id_", "");
    const status = $(el)
      .find("img")
      .filter((_j, img) => /Open|Closed|Wait/i.test($(img).attr("alt") ?? ""))
      .first()
      .attr("alt") ?? "";

    const bodyText = $(el).find("div.panel-body").text();

    lines.push(`### ${link.text().trim()}`);
    if (status) lines.push(`- **Status**: ${status}`);

    const instr = bodyText.match(/Instructor[:\s]+([^\n\t]+)/i)?.[1]?.trim();
    if (instr) lines.push(`- **Instructor**: ${instr}`);

    const sched = bodyText.match(/(?:Days|MWF|TuTh|Schedule)[:\s]+([^\n\t]+)/i)?.[1]?.trim();
    if (sched) lines.push(`- **Schedule**: ${sched}`);

    const loc = bodyText.match(/(?:Location|Room|Baskin|Kresge|Thimann)[:\s]+([^\n\t]+)/i)?.[1]?.trim();
    if (loc) lines.push(`- **Location**: ${loc}`);

    const enr = bodyText.match(/(\d+)\s*\/\s*(\d+)/)?.[0];
    if (enr) lines.push(`- **Enrollment**: ${enr}`);

    if (classNum) lines.push(`- **Class #**: ${classNum}`);
    lines.push("");
  });

  return lines.join("\n");
}
