import * as cheerio from "cheerio";

const UA = "Mozilla/5.0 (compatible; Nodegent/1.0)";

// ─── Dining ────────────────────────────────────────────────────────────────

const HALLS = [
  { aliases: ["lewis", "college nine", "c9", "nine", "college9"], locationNum: "40", locationName: "John+R.+Lewis+%26+College+Nine+Dining+Hall", display: "John R. Lewis & College Nine" },
  { aliases: ["cowell", "stevenson"], locationNum: "05", locationName: "Cowell+%26+Stevenson+Dining+Hall", display: "Cowell & Stevenson" },
  { aliases: ["crown", "merrill"], locationNum: "20", locationName: "Crown+%26+Merrill+Dining+Hall", display: "Crown & Merrill" },
  { aliases: ["porter", "kresge"], locationNum: "25", locationName: "Porter+%26+Kresge+Dining+Hall", display: "Porter & Kresge" },
  { aliases: ["carson", "oakes", "rco"], locationNum: "30", locationName: "Rachel+Carson+%26+Oakes+Dining+Hall", display: "Rachel Carson & Oakes" },
];

function todayStr(): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${mm}/${dd}/${now.getFullYear()}`;
}

type CheerioRoot = ReturnType<typeof cheerio.load>;

function buildShortMenuResult(
  $: CheerioRoot,
  hall: (typeof HALLS)[0],
  mealFilter: string | undefined,
  sourceUrl: string,
  dateStr: string
): string {
  // Use the page's own "Menus for ..." header so the displayed date matches the data
  const pageDate =
    $(".shortmenutitle").first().text().trim().replace(/^Menus for\s*/i, "") ||
    dateStr;

  const lines: string[] = [`## ${hall.display} — ${pageDate}\n`];
  let curMeal = "";
  let curIncluded = false;

  $(".shortmenumeals, .shortmenucats, .shortmenurecipes").each((_i, el) => {
    if ($(el).hasClass("shortmenumeals")) {
      curMeal = $(el).text().trim();
      curIncluded = !mealFilter || curMeal.toLowerCase().includes(mealFilter);
      if (curIncluded) lines.push(`\n### ${curMeal}`);
    } else if ($(el).hasClass("shortmenucats") && curIncluded) {
      // Cats are wrapped like "-- Hot Cereals --"; the first one per meal duplicates the meal name.
      const cat = $(el).text().trim().replace(/^--\s*|\s*--$/g, "");
      if (cat && cat.toLowerCase() !== curMeal.toLowerCase()) {
        lines.push(`\n**${cat}**`);
      }
    } else if ($(el).hasClass("shortmenurecipes") && curIncluded) {
      const item = $(el).text().trim();
      if (item) lines.push(`- ${item}`);
    }
  });

  const footer = `\n\n*Source: [UCSC Dining — ${hall.display}](${sourceUrl})*`;
  if (lines.length <= 1)
    return `No menu data found for ${hall.display} on ${dateStr}${mealFilter ? ` (${mealFilter})` : ""}. The menu may not be posted yet.${footer}`;
  lines.push(footer);
  return lines.join("\n");
}

async function getDiningMenu(args: Record<string, unknown>): Promise<string> {
  const hallQuery = typeof args.hall === "string" ? args.hall.toLowerCase() : "";
  const mealFilter = typeof args.meal === "string" ? args.meal.toLowerCase() : undefined;
  const hall = HALLS.find((h) => h.aliases.some((a) => hallQuery.includes(a))) ?? HALLS[0];

  const today = todayStr();
  const dateStr =
    typeof args.date === "string" && args.date.trim() ? args.date.trim() : today;

  // The UCSC ASP.NET app returns HTTP 500 unless the request carries the full set of
  // WebInaCart cookies the root page would normally set. Since their values are always
  // empty, we can hardcode them and skip the extra root fetch entirely.
  const COOKIE =
    "WebInaCartLocation=; WebInaCartDates=; WebInaCartMeals=; WebInaCartRecipes=; WebInaCartQtys=";

  // shortmenu.aspx accepts a dtdate param for any future date.
  // sName MUST be "UC+Santa+Cruz+Dining" exactly — server 500s for any other value.
  const dateParam =
    dateStr === today ? "" : `&dtdate=${encodeURIComponent(dateStr)}`;
  const url =
    `https://nutrition.sa.ucsc.edu/shortmenu.aspx?sName=UC+Santa+Cruz+Dining` +
    `&locationNum=${hall.locationNum}&locationName=${hall.locationName}` +
    `&naFlag=1${dateParam}`;

  const res = await fetch(url, {
    headers: { "User-Agent": UA, Cookie: COOKIE },
  });
  if (!res.ok)
    throw new Error(`nutrition.sa.ucsc.edu returned ${res.status}`);
  const html = await res.text();
  return buildShortMenuResult(cheerio.load(html), hall, mealFilter, url, dateStr);
}

// ─── Classes ───────────────────────────────────────────────────────────────

const PISA_URL = "https://pisa.ucsc.edu/class_search/index.php";

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
  const seasons: Record<string, string> = { "0": "Winter", "2": "Spring", "4": "Summer", "8": "Fall" };
  return `${seasons[code.slice(-1)] ?? "?"} 20${code.slice(1, 3)}`;
}

async function searchClasses(args: Record<string, unknown>): Promise<string> {
  const term = typeof args.term === "string" ? args.term : currentTermCode();
  const formRes = await fetch(PISA_URL, { headers: { "User-Agent": UA } });
  const cookie = formRes.headers.get("set-cookie") ?? "";

  const body = new URLSearchParams({
    action: "results",
    "binds[:term]": term,
    "binds[:reg_status]": args.open_only === true ? "O" : "all",
    rec_start: "0",
    rec_dur: "25",
  });
  if (typeof args.subject === "string") body.set("binds[:subject]", args.subject.toUpperCase());
  if (typeof args.course_number === "string") {
    body.set("binds[:catalog_nbr]", args.course_number);
    body.set("binds[:catalog_nbr_op]", "=");
  }
  if (typeof args.instructor === "string") {
    body.set("binds[:instr_name]", args.instructor);
    body.set("binds[:instr_name_op]", "contains");
  }
  if (typeof args.title === "string") body.set("binds[:title]", args.title);

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

  const $ = cheerio.load(html);
  const panels = $("div.panel.panel-default.row[id^='rowpanel_']");
  const classSearchUrl = `https://pisa.ucsc.edu/class_search/index.php`;
  if (panels.length === 0) return `No classes found matching your search criteria.\n\n*Source: [UCSC Schedule of Classes](${classSearchUrl})*`;

  const lines: string[] = [`## Class Search Results (${termName(term)})\n`];
  panels.each((_i, el) => {
    const link = $(el).find("a[id^='class_id_']").first();
    if (!link.length) return;
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
    const classNum = (link.attr("id") ?? "").replace("class_id_", "");
    if (classNum) lines.push(`- **Class #**: ${classNum}`);
    lines.push("");
  });
  lines.push(`\n*Source: [UCSC Schedule of Classes](https://pisa.ucsc.edu/class_search/index.php)*`);
  return lines.join("\n");
}

// ─── Directory ─────────────────────────────────────────────────────────────

const DIRECTORY_URL = "https://campusdirectory.ucsc.edu/cd_search";

async function searchDirectory(args: Record<string, unknown>): Promise<string> {
  const query = typeof args.query === "string" ? args.query : "";
  if (!query) return "Please provide a name or keyword to search the campus directory.";

  const url = `${DIRECTORY_URL}?type=people&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`campusdirectory.ucsc.edu returned ${res.status}`);
  const html = await res.text();

  const $ = cheerio.load(html);
  const rows: string[] = [];
  $("tr")
    .filter((_i, tr) => $(tr).find("a[href*='cd_detail']").length > 0)
    .each((_i, tr) => {
      const name = $(tr).find("a[href*='cd_detail']").first().text().trim();
      const cells = $(tr)
        .find("td")
        .map((_j, td) => $(td).text().trim())
        .get();
      const dept = cells[1] ?? "";
      const email = cells.find((c: string) => c.includes("@")) ?? "";
      const phone = cells.find((c: string) => /\d{3}[-.\s]\d{4}/.test(c)) ?? "";
      if (name) {
        rows.push(`### ${name}`);
        if (dept) rows.push(`- **Dept**: ${dept}`);
        if (email) rows.push(`- **Email**: ${email}`);
        if (phone) rows.push(`- **Phone**: ${phone}`);
        rows.push("");
      }
    });

  const dirSourceUrl = `https://campusdirectory.ucsc.edu/cd_search?type=people&q=${encodeURIComponent(query)}`;
  if (rows.length === 0) return `No directory results found for "${query}".\n\n*Source: [UCSC Campus Directory](${dirSourceUrl})*`;
  return `## Campus Directory — "${query}"\n\n${rows.join("\n")}\n*Source: [UCSC Campus Directory](${dirSourceUrl})*`;
}

// ─── Dispatcher ────────────────────────────────────────────────────────────

export async function dispatchMcpTool(
  tool: string,
  args: Record<string, unknown>
): Promise<string> {
  switch (tool) {
    case "get_dining_menu": return getDiningMenu(args);
    case "search_classes": return searchClasses(args);
    case "search_directory": return searchDirectory(args);
    default: return `Unknown MCP tool: ${tool}`;
  }
}
