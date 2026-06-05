import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { MAX_NOTE_CONTENT_CHARS } from "../courseNotes";
import type { Id } from "../_generated/dataModel";

const IDENTITY_A = { subject: "clerk_A", email: "a@ucsc.edu", name: "Student A" };
const IDENTITY_B = { subject: "clerk_B", email: "b@ucsc.edu", name: "Student B" };

async function seedUser(
  t: ReturnType<typeof convexTest>,
  identity: typeof IDENTITY_A
) {
  await t.withIdentity(identity).mutation(api.users.ensureUser, {});
}

async function seedCourse(
  t: ReturnType<typeof convexTest>,
  identity: typeof IDENTITY_A,
  canvasId = "canvas_1"
): Promise<Id<"courses">> {
  await t.withIdentity(identity).mutation(api.courses.upsertCourse, {
    canvasId,
    name: "Test Course",
    courseCode: "CSE 115",
    term: "Spring 2026",
  });
  const courses = await t
    .withIdentity(identity)
    .query(api.courses.getCourses, {});
  const match = courses.find((c) => c.canvasId === canvasId);
  if (!match) throw new Error(`seedCourse failed to find ${canvasId}`);
  return match._id;
}

describe("courseNotes", () => {
  describe("listCourseNotes", () => {
    it("returns [] when unauthenticated", async () => {
      const t = convexTest(schema);
      await seedUser(t, IDENTITY_A);
      const courseId = await seedCourse(t, IDENTITY_A);
      const notes = await t.query(api.courseNotes.listCourseNotes, { courseId });
      expect(notes).toEqual([]);
    });

    it("returns [] for another user's course", async () => {
      const t = convexTest(schema);
      await seedUser(t, IDENTITY_A);
      await seedUser(t, IDENTITY_B);
      const courseId = await seedCourse(t, IDENTITY_A);
      await t
        .withIdentity(IDENTITY_A)
        .mutation(api.courseNotes.addCourseNote, { courseId, content: "mine" });
      const notes = await t
        .withIdentity(IDENTITY_B)
        .query(api.courseNotes.listCourseNotes, { courseId });
      expect(notes).toEqual([]);
    });

    it("returns notes newest-first", async () => {
      const t = convexTest(schema);
      await seedUser(t, IDENTITY_A);
      const courseId = await seedCourse(t, IDENTITY_A);

      await t
        .withIdentity(IDENTITY_A)
        .mutation(api.courseNotes.addCourseNote, { courseId, content: "first" });
      await new Promise((r) => setTimeout(r, 2));
      await t
        .withIdentity(IDENTITY_A)
        .mutation(api.courseNotes.addCourseNote, { courseId, content: "second" });
      await new Promise((r) => setTimeout(r, 2));
      await t
        .withIdentity(IDENTITY_A)
        .mutation(api.courseNotes.addCourseNote, { courseId, content: "third" });

      const notes = await t
        .withIdentity(IDENTITY_A)
        .query(api.courseNotes.listCourseNotes, { courseId });
      expect(notes.map((n) => n.content)).toEqual(["third", "second", "first"]);
    });

    it("does not bleed notes across courses", async () => {
      const t = convexTest(schema);
      await seedUser(t, IDENTITY_A);
      const courseX = await seedCourse(t, IDENTITY_A, "canvas_X");
      const courseY = await seedCourse(t, IDENTITY_A, "canvas_Y");

      await t
        .withIdentity(IDENTITY_A)
        .mutation(api.courseNotes.addCourseNote, { courseId: courseX, content: "X1" });
      await t
        .withIdentity(IDENTITY_A)
        .mutation(api.courseNotes.addCourseNote, { courseId: courseX, content: "X2" });

      const xNotes = await t
        .withIdentity(IDENTITY_A)
        .query(api.courseNotes.listCourseNotes, { courseId: courseX });
      const yNotes = await t
        .withIdentity(IDENTITY_A)
        .query(api.courseNotes.listCourseNotes, { courseId: courseY });
      expect(xNotes).toHaveLength(2);
      expect(yNotes).toEqual([]);
    });
  });

  describe("addCourseNote", () => {
    it("throws when unauthenticated", async () => {
      const t = convexTest(schema);
      await seedUser(t, IDENTITY_A);
      const courseId = await seedCourse(t, IDENTITY_A);
      await expect(
        t.mutation(api.courseNotes.addCourseNote, { courseId, content: "x" })
      ).rejects.toThrow("Not authenticated");
    });

    it("throws Unauthorized when user does not own the course", async () => {
      const t = convexTest(schema);
      await seedUser(t, IDENTITY_A);
      await seedUser(t, IDENTITY_B);
      const courseId = await seedCourse(t, IDENTITY_A);
      await expect(
        t.withIdentity(IDENTITY_B).mutation(api.courseNotes.addCourseNote, {
          courseId,
          content: "hijack",
        })
      ).rejects.toThrow("Unauthorized");
    });

    it("rejects empty / whitespace-only content", async () => {
      const t = convexTest(schema);
      await seedUser(t, IDENTITY_A);
      const courseId = await seedCourse(t, IDENTITY_A);
      await expect(
        t.withIdentity(IDENTITY_A).mutation(api.courseNotes.addCourseNote, {
          courseId,
          content: "   \n  ",
        })
      ).rejects.toThrow("Note is empty");
    });

    it("rejects content above the size cap (post-trim)", async () => {
      const t = convexTest(schema);
      await seedUser(t, IDENTITY_A);
      const courseId = await seedCourse(t, IDENTITY_A);
      const tooBig = "a".repeat(MAX_NOTE_CONTENT_CHARS + 1);
      await expect(
        t.withIdentity(IDENTITY_A).mutation(api.courseNotes.addCourseNote, {
          courseId,
          content: tooBig,
        })
      ).rejects.toThrow("Note exceeds maximum length");
    });

    it("accepts content exactly at the size cap", async () => {
      const t = convexTest(schema);
      await seedUser(t, IDENTITY_A);
      const courseId = await seedCourse(t, IDENTITY_A);
      const atCap = "a".repeat(MAX_NOTE_CONTENT_CHARS);
      await t.withIdentity(IDENTITY_A).mutation(api.courseNotes.addCourseNote, {
        courseId,
        content: atCap,
      });
      const notes = await t
        .withIdentity(IDENTITY_A)
        .query(api.courseNotes.listCourseNotes, { courseId });
      expect(notes).toHaveLength(1);
      expect(notes[0].content.length).toBe(MAX_NOTE_CONTENT_CHARS);
    });

    it("trims surrounding whitespace before persisting", async () => {
      const t = convexTest(schema);
      await seedUser(t, IDENTITY_A);
      const courseId = await seedCourse(t, IDENTITY_A);
      await t.withIdentity(IDENTITY_A).mutation(api.courseNotes.addCourseNote, {
        courseId,
        content: "   hello   ",
      });
      const notes = await t
        .withIdentity(IDENTITY_A)
        .query(api.courseNotes.listCourseNotes, { courseId });
      expect(notes[0].content).toBe("hello");
    });
  });

  describe("updateCourseNote", () => {
    it("throws when unauthenticated", async () => {
      const t = convexTest(schema);
      await seedUser(t, IDENTITY_A);
      const courseId = await seedCourse(t, IDENTITY_A);
      const noteId = await t
        .withIdentity(IDENTITY_A)
        .mutation(api.courseNotes.addCourseNote, {
          courseId,
          content: "original",
        });
      await expect(
        t.mutation(api.courseNotes.updateCourseNote, {
          noteId,
          content: "edited",
        })
      ).rejects.toThrow("Not authenticated");
    });

    it("throws Unauthorized when user does not own the note", async () => {
      const t = convexTest(schema);
      await seedUser(t, IDENTITY_A);
      await seedUser(t, IDENTITY_B);
      const courseId = await seedCourse(t, IDENTITY_A);
      const noteId = await t
        .withIdentity(IDENTITY_A)
        .mutation(api.courseNotes.addCourseNote, {
          courseId,
          content: "mine",
        });
      await expect(
        t.withIdentity(IDENTITY_B).mutation(api.courseNotes.updateCourseNote, {
          noteId,
          content: "hijack",
        })
      ).rejects.toThrow("Unauthorized");
    });

    it("patches content and bumps updatedAt", async () => {
      const t = convexTest(schema);
      await seedUser(t, IDENTITY_A);
      const courseId = await seedCourse(t, IDENTITY_A);
      const noteId = await t
        .withIdentity(IDENTITY_A)
        .mutation(api.courseNotes.addCourseNote, { courseId, content: "v1" });
      const before = await t
        .withIdentity(IDENTITY_A)
        .query(api.courseNotes.listCourseNotes, { courseId });
      await new Promise((r) => setTimeout(r, 2));
      await t.withIdentity(IDENTITY_A).mutation(api.courseNotes.updateCourseNote, {
        noteId,
        content: "v2",
      });
      const after = await t
        .withIdentity(IDENTITY_A)
        .query(api.courseNotes.listCourseNotes, { courseId });
      expect(after[0].content).toBe("v2");
      expect(after[0].updatedAt).toBeGreaterThan(before[0].updatedAt);
    });

    it("rejects empty content (use deleteCourseNote instead)", async () => {
      const t = convexTest(schema);
      await seedUser(t, IDENTITY_A);
      const courseId = await seedCourse(t, IDENTITY_A);
      const noteId = await t
        .withIdentity(IDENTITY_A)
        .mutation(api.courseNotes.addCourseNote, { courseId, content: "x" });
      await expect(
        t.withIdentity(IDENTITY_A).mutation(api.courseNotes.updateCourseNote, {
          noteId,
          content: "   ",
        })
      ).rejects.toThrow("Note is empty");
    });

    it("rejects content above the size cap", async () => {
      const t = convexTest(schema);
      await seedUser(t, IDENTITY_A);
      const courseId = await seedCourse(t, IDENTITY_A);
      const noteId = await t
        .withIdentity(IDENTITY_A)
        .mutation(api.courseNotes.addCourseNote, { courseId, content: "x" });
      await expect(
        t.withIdentity(IDENTITY_A).mutation(api.courseNotes.updateCourseNote, {
          noteId,
          content: "a".repeat(MAX_NOTE_CONTENT_CHARS + 1),
        })
      ).rejects.toThrow("Note exceeds maximum length");
    });

    it("is a no-op when content is unchanged (updatedAt does not move)", async () => {
      const t = convexTest(schema);
      await seedUser(t, IDENTITY_A);
      const courseId = await seedCourse(t, IDENTITY_A);
      const noteId = await t
        .withIdentity(IDENTITY_A)
        .mutation(api.courseNotes.addCourseNote, {
          courseId,
          content: "stable",
        });
      const before = await t
        .withIdentity(IDENTITY_A)
        .query(api.courseNotes.listCourseNotes, { courseId });
      await new Promise((r) => setTimeout(r, 2));
      await t.withIdentity(IDENTITY_A).mutation(api.courseNotes.updateCourseNote, {
        noteId,
        content: "stable",
      });
      const after = await t
        .withIdentity(IDENTITY_A)
        .query(api.courseNotes.listCourseNotes, { courseId });
      expect(after[0].updatedAt).toBe(before[0].updatedAt);
    });
  });

  describe("deleteCourseNote", () => {
    it("throws when unauthenticated", async () => {
      const t = convexTest(schema);
      await seedUser(t, IDENTITY_A);
      const courseId = await seedCourse(t, IDENTITY_A);
      const noteId = await t
        .withIdentity(IDENTITY_A)
        .mutation(api.courseNotes.addCourseNote, { courseId, content: "x" });
      await expect(
        t.mutation(api.courseNotes.deleteCourseNote, { noteId })
      ).rejects.toThrow("Not authenticated");
    });

    it("throws Unauthorized when user does not own the note", async () => {
      const t = convexTest(schema);
      await seedUser(t, IDENTITY_A);
      await seedUser(t, IDENTITY_B);
      const courseId = await seedCourse(t, IDENTITY_A);
      const noteId = await t
        .withIdentity(IDENTITY_A)
        .mutation(api.courseNotes.addCourseNote, { courseId, content: "mine" });
      await expect(
        t.withIdentity(IDENTITY_B).mutation(api.courseNotes.deleteCourseNote, {
          noteId,
        })
      ).rejects.toThrow("Unauthorized");
    });

    it("removes the note from subsequent listCourseNotes results", async () => {
      const t = convexTest(schema);
      await seedUser(t, IDENTITY_A);
      const courseId = await seedCourse(t, IDENTITY_A);
      const n1 = await t
        .withIdentity(IDENTITY_A)
        .mutation(api.courseNotes.addCourseNote, { courseId, content: "keep" });
      const n2 = await t
        .withIdentity(IDENTITY_A)
        .mutation(api.courseNotes.addCourseNote, { courseId, content: "drop" });

      await t
        .withIdentity(IDENTITY_A)
        .mutation(api.courseNotes.deleteCourseNote, { noteId: n2 });

      const notes = await t
        .withIdentity(IDENTITY_A)
        .query(api.courseNotes.listCourseNotes, { courseId });
      expect(notes.map((n) => n._id)).toEqual([n1]);
    });
  });
});
