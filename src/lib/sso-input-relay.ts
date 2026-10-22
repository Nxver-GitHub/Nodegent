/**
 * sso-input-relay.ts
 * ------------------
 * Delivers Canvas SSO viewer input (clicks, Duo passcodes, pause) to whichever
 * Vercel instance is running the user's headless browser.
 *
 * The stream route registers a per-stream sessionId (`beginSsoSession`); the
 * click/type/pause routes queue input in Convex (ssoRelay.queueInput), tagged
 * with the user's current session; the stream instance subscribes here over a
 * Convex WebSocket, claims its rows with ssoRelay.takeInputs (delete-on-read,
 * so each input is delivered once), and hands them to the local worker.
 */

import { ConvexClient } from "convex/browser";
import { fetchMutation } from "convex/nextjs";
import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import { getInternalSecret } from "@/lib/convex-internal";

export type SsoInput = Doc<"ssoInputs">;
export type SsoInputPayload =
  | { kind: "click"; x: number; y: number; viewportWidth: number; viewportHeight: number }
  | { kind: "type"; text: string }
  | { kind: "pause"; paused: boolean };
export type QueueResult = { ok: true } | { ok: false; reason: "no-session" | "busy" };

/** Queues input for the user's current SSO session, wherever it is running. */
export async function queueSsoInput(
  clerkId: string,
  input: SsoInputPayload
): Promise<QueueResult> {
  return fetchMutation(api.ssoRelay.queueInput, {
    secret: getInternalSecret(),
    clerkId,
    input,
  });
}

/** Makes `sessionId` the user's live session and drops input from older ones. */
export async function beginSsoSession(clerkId: string, sessionId: string): Promise<void> {
  await fetchMutation(api.ssoRelay.beginSession, {
    secret: getInternalSecret(),
    clerkId,
    sessionId,
  });
}

/** Best-effort cleanup when a stream ends; rows also expire on their own. */
export async function endSsoSession(clerkId: string, sessionId: string): Promise<void> {
  await fetchMutation(api.ssoRelay.endSession, {
    secret: getInternalSecret(),
    clerkId,
    sessionId,
  }).catch((err: unknown) => console.error("[sso-relay] end failed:", err));
}

/**
 * Subscribes to queued input for this session and calls `onInput` for each
 * row, in order. Never throws asynchronously. Returns a teardown function.
 */
export function subscribeSsoInputs(
  clerkId: string,
  sessionId: string,
  onInput: (input: SsoInput) => void
): () => void {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL is not configured");
  const secret = getInternalSecret();
  const client = new ConvexClient(url);
  let claiming = false;
  let pendingRecheck = false;
  let closed = false;

  const claimOnce = async (ids: Id<"ssoInputs">[]): Promise<void> => {
    const taken = await client.mutation(api.ssoRelay.takeInputs, {
      secret,
      clerkId,
      sessionId,
      ids,
    });
    if (!closed) taken.forEach(onInput);
  };

  // Serializes claims; rows that arrive mid-claim trigger one re-read so they
  // don't sit until expiry. All errors are caught — an unhandled rejection
  // here would take down the whole Fluid instance.
  const claim = async (ids: Id<"ssoInputs">[]): Promise<void> => {
    if (claiming) {
      pendingRecheck = true;
      return;
    }
    claiming = true;
    try {
      await claimOnce(ids);
      while (pendingRecheck && !closed) {
        pendingRecheck = false;
        const latest = await client.query(api.ssoRelay.pendingInputs, {
          secret,
          clerkId,
          sessionId,
        });
        if (closed || latest.length === 0) break;
        await claimOnce(latest);
      }
    } catch (err) {
      if (!closed) console.error("[sso-relay] claim failed:", err);
    } finally {
      claiming = false;
    }
  };

  const unsubscribe = client.onUpdate(
    api.ssoRelay.pendingInputs,
    { secret, clerkId, sessionId },
    (ids) => {
      if (ids.length > 0 && !closed) void claim(ids);
    },
    (err) => console.error("[sso-relay] subscription error:", err)
  );

  return () => {
    if (closed) return;
    closed = true;
    unsubscribe();
    void client.close().catch(() => undefined);
  };
}
