"use node";
/**
 * Node-runtime bridge so chat (default runtime) can fetch dining menus — the
 * default runtime's fetch can't trust the extra intermediate nutrition.sa.ucsc.edu
 * needs. See nutritionHttps.helpers.ts.
 */

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { fetchNutritionPage, type NutritionPage } from "./nutritionHttps.helpers";

export const fetchPage = internalAction({
  args: { url: v.string(), headers: v.record(v.string(), v.string()) },
  handler: async (_ctx, args): Promise<NutritionPage> =>
    fetchNutritionPage(args.url, args.headers),
});
