// Constants shared between the Convex server function and the frontend
// editor. Lives in its own module so the frontend can import it without
// pulling `query`/`mutation` into the browser bundle (which trips
// Convex's `assertNotBrowser` guard).
export const MAX_NOTE_CONTENT_CHARS = 2_000;
