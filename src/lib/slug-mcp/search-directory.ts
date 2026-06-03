import * as cheerio from "cheerio";

export interface SearchDirectoryArgs {
  query: string;
  type?: "people" | "departments";
}

const DIRECTORY_URL = "https://campusdirectory.ucsc.edu/cd_search";

export async function searchDirectory(args: SearchDirectoryArgs): Promise<string> {
  const type = args.type ?? "people";
  const url = `${DIRECTORY_URL}?type=${type}&q=${encodeURIComponent(args.query)}`;

  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; Nodegent/1.0)" },
  });
  if (!res.ok) throw new Error(`campusdirectory.ucsc.edu returned ${res.status}`);

  const html = await res.text();
  return parseResults(html, args.query);
}

function parseResults(html: string, query: string): string {
  const $ = cheerio.load(html);
  const lines: string[] = [];

  $("tr")
    .filter((_i, el) => $(el).find("a[href*='cd_detail']").length > 0)
    .each((_i, el) => {
      const name = $(el).find("a[href*='cd_detail']").first().text().trim();
      if (!name) return;
      lines.push(`**${name}**`);
      const cells = $(el).find("td");
      const dept = cells.eq(1).text().trim();
      const email = $(el).find("a[href^='mailto:']").text().trim();
      const phone = cells
        .filter((_j, td) => /\d{3}-\d{4}/.test($(td).text()))
        .first()
        .text()
        .trim();
      if (dept) lines.push(`- Department: ${dept}`);
      if (email) lines.push(`- Email: ${email}`);
      if (phone) lines.push(`- Phone: ${phone}`);
      lines.push("");
    });

  if (lines.length === 0) return `No directory results found for "${query}".`;
  return `## UCSC Directory: "${query}"\n\n${lines.join("\n")}`;
}
