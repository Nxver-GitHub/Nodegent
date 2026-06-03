import * as cheerio from "cheerio";

export interface GetDiningMenuArgs {
  hall?: string;
  meal?: string;
}

const SHORTMENU_BASE = "https://nutrition.sa.ucsc.edu/shortmenu.aspx";
// Session-placeholder cookies required by nutrition.sa.ucsc.edu (no auth, just cart state)
const NUTRITION_COOKIES =
  "WebInaCartLocation=; WebInaCartDates=; WebInaCartMeals=; WebInaCartRecipes=; WebInaCartQtys=";
const UA = "Mozilla/5.0 (compatible; Nodegent/1.0)";

interface Hall {
  name: string;
  aliases: string[];
  locationNum: string;
  locationName: string;
}

const HALLS: Hall[] = [
  {
    name: "John R. Lewis & College Nine Dining Hall",
    aliases: ["lewis", "college nine", "c9", "nine", "college9"],
    locationNum: "40",
    locationName: "John+R.+Lewis+%26+College+Nine+Dining+Hall",
  },
  {
    name: "Cowell & Stevenson Dining Hall",
    aliases: ["cowell", "stevenson"],
    locationNum: "05",
    locationName: "Cowell+%26+Stevenson+Dining+Hall",
  },
  {
    name: "Crown & Merrill Dining Hall",
    aliases: ["crown", "merrill"],
    locationNum: "20",
    locationName: "Crown+%26+Merrill+Dining+Hall",
  },
  {
    name: "Porter & Kresge Dining Hall",
    aliases: ["porter", "kresge"],
    locationNum: "25",
    locationName: "Porter+%26+Kresge+Dining+Hall",
  },
  {
    name: "Rachel Carson & Oakes Dining Hall",
    aliases: ["carson", "oakes", "rco"],
    locationNum: "30",
    locationName: "Rachel+Carson+%26+Oakes+Dining+Hall",
  },
];

function resolveHall(query?: string): Hall {
  if (!query) return HALLS[0];
  const lower = query.toLowerCase();
  return HALLS.find((h) => h.aliases.some((a) => lower.includes(a))) ?? HALLS[0];
}

export async function getDiningMenu(args: GetDiningMenuArgs): Promise<string> {
  const hall = resolveHall(args.hall);
  const url =
    `${SHORTMENU_BASE}?sName=UC+Santa+Cruz+Dining` +
    `&locationNum=${hall.locationNum}` +
    `&locationName=${hall.locationName}` +
    `&naFlag=1&WeeksMenus=UCSC+-+This+Week%27s+Menus&myaction=read`;

  const res = await fetch(url, {
    headers: { Cookie: NUTRITION_COOKIES, "User-Agent": UA },
  });
  if (!res.ok) throw new Error(`nutrition.sa.ucsc.edu returned ${res.status}`);

  const html = await res.text();
  if (html.includes("Runtime Error") || html.includes("Server Error")) {
    throw new Error("Nutrition site returned an error page");
  }

  return parseMenu(html, hall.name, args.meal);
}

function parseMenu(html: string, hallName: string, mealFilter?: string): string {
  const $ = cheerio.load(html);
  const lines: string[] = [`## Today's Menu — ${hallName}\n`];
  let currentMeal = "";
  let included = false;

  $("div.shortmenumeals, div.shortmenucats, div.shortmenurecipes").each((_i, el) => {
    const cls = ($(el).attr("class") ?? "").toLowerCase();
    const text = $(el).text().trim();
    if (!text) return;

    if (cls.includes("shortmenumeals")) {
      currentMeal = text;
      included = !mealFilter || currentMeal.toLowerCase().includes(mealFilter.toLowerCase());
      if (included) lines.push(`\n### ${currentMeal}`);
    } else if (cls.includes("shortmenucats") && included) {
      lines.push(`\n**${text}**`);
    } else if (cls.includes("shortmenurecipes") && included) {
      lines.push(`- ${text}`);
    }
  });

  if (lines.length <= 1) {
    return `No menu data found for ${hallName}${mealFilter ? ` (${mealFilter})` : ""}.`;
  }
  return lines.join("\n");
}
