import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

const IDENTITY = { subject: "clerk_1", email: "test@ucsc.edu", name: "Test Student" };

async function seedUser(t: ReturnType<typeof convexTest>) {
  await t.withIdentity(IDENTITY).mutation(api.users.ensureUser, {});
}

describe("courses", () => {
  describe("getCourses", () => {
    it("returns empty array when unauthenticated", async () => {
      const t = convexTest(schema);
      const courses = await t.query(api.courses.getCourses, {});
      expect(courses).toEqual([]);
    });

    it("returns empty array when user has no courses", async () => {
      const t = convexTest(schema);
      await seedUser(t);
      const courses = await t.withIdentity(IDENTITY).query(api.courses.getCourses, {});
      expect(courses).toEqual([]);
    });

    it("returns only the authenticated user's courses", async () => {
      const t = convexTest(schema);
      await seedUser(t);

      await t.withIdentity(IDENTITY).mutation(api.courses.upsertCourse, {
        canvasId: "canvas_101",
        name: "Intro to CS",
        courseCode: "CSE 101",
        term: "Spring 2026",
      });

      const courses = await t.withIdentity(IDENTITY).query(api.courses.getCourses, {});
      expect(courses).toHaveLength(1);
      expect(courses[0].canvasId).toBe("canvas_101");
    });
  });

  describe("upsertCourse", () => {
    it("throws when unauthenticated", async () => {
      const t = convexTest(schema);
      await expect(
        t.mutation(api.courses.upsertCourse, {
          canvasId: "c1",
          name: "Course",
          courseCode: "CSE 1",
          term: "Spring 2026",
        })
      ).rejects.toThrow("Not authenticated");
    });

    it("inserts a new course", async () => {
      const t = convexTest(schema);
      await seedUser(t);

      const id = await t.withIdentity(IDENTITY).mutation(api.courses.upsertCourse, {
        canvasId: "canvas_202",
        name: "Data Structures",
        courseCode: "CSE 101",
        term: "Spring 2026",
        instructorName: "Prof. Smith",
      });

      expect(id).toBeTruthy();
      const courses = await t.withIdentity(IDENTITY).query(api.courses.getCourses, {});
      expect(courses).toHaveLength(1);
    });

    it("updates an existing course instead of inserting a duplicate", async () => {
      const t = convexTest(schema);
      await seedUser(t);

      await t.withIdentity(IDENTITY).mutation(api.courses.upsertCourse, {
        canvasId: "canvas_303",
        name: "Old Name",
        courseCode: "CSE 200",
        term: "Spring 2026",
      });

      await t.withIdentity(IDENTITY).mutation(api.courses.upsertCourse, {
        canvasId: "canvas_303",
        name: "Updated Name",
        courseCode: "CSE 200",
        term: "Spring 2026",
      });

      const courses = await t.withIdentity(IDENTITY).query(api.courses.getCourses, {});
      expect(courses).toHaveLength(1);
      expect(courses[0].name).toBe("Updated Name");
    });
  });
});
