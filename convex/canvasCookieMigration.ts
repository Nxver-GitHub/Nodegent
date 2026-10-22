/**
 * One-shot migration: encrypt legacy plaintext canvasCookies at rest.
 *
 * Run once per deployment after CANVAS_COOKIE_KEY is set:
 *   npx convex run canvasCookieMigration:encryptLegacyCookies          (dev)
 *   npx convex run canvasCookieMigration:encryptLegacyCookies --prod   (prod)
 *
 * Idempotent — already-encrypted rows are skipped. Once a re-run on prod
 * reports `encrypted: 0`, the plaintext branch in decryptCookies can go.
 */

import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { encryptCookies, isEncryptedCookies } from "./cookieCrypto.helpers";

const BATCH = 100;

export const listCredentialsPage = internalQuery({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("canvasCredentials")
      .paginate({ cursor: args.cursor, numItems: BATCH });
    return {
      rows: page.page
        .filter((row) => row.canvasCookies && !isEncryptedCookies(row.canvasCookies))
        .map((row) => ({ id: row._id, userId: row.userId, canvasCookies: row.canvasCookies! })),
      continueCursor: page.continueCursor,
      isDone: page.isDone,
    };
  },
});

/** Writes the ciphertext only if the row still holds the plaintext we read. */
export const replaceIfUnchanged = internalMutation({
  args: { id: v.id("canvasCredentials"), expected: v.string(), encrypted: v.string() },
  handler: async (ctx, args): Promise<boolean> => {
    const row = await ctx.db.get(args.id);
    if (!row || row.canvasCookies !== args.expected) return false;
    await ctx.db.patch(args.id, { canvasCookies: args.encrypted });
    return true;
  },
});

export const encryptLegacyCookies = internalAction({
  args: {},
  handler: async (ctx): Promise<{ encrypted: number; skipped: number }> => {
    let cursor: string | null = null;
    let encrypted = 0;
    let skipped = 0;
    for (;;) {
      const page: {
        rows: { id: Id<"canvasCredentials">; userId: Id<"users">; canvasCookies: string }[];
        continueCursor: string;
        isDone: boolean;
      } = await ctx.runQuery(internal.canvasCookieMigration.listCredentialsPage, { cursor });
      for (const row of page.rows) {
        const ciphertext = await encryptCookies(row.canvasCookies, row.userId);
        const ok = await ctx.runMutation(internal.canvasCookieMigration.replaceIfUnchanged, {
          id: row.id,
          expected: row.canvasCookies,
          encrypted: ciphertext,
        });
        if (ok) encrypted++;
        else skipped++;
      }
      if (page.isDone) break;
      cursor = page.continueCursor;
    }
    return { encrypted, skipped };
  },
});
