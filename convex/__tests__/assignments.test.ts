import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { Id } from "../_generated/dataModel";

const IDENTITY = { subject: "clerk_1", email: "test@ucsc.edu", name: "Test Student" };
const OTHER_IDENTITY = { subject: "clerk_2", email: "other@ucsc.edu", name: "Other Student" };

async function seedUserAndCourse(t: ReturnType<typeof convexTest>) {
  await t.withIdentity(IDENTITY).mutation(api.users.ensureUser, {});
  const courseId = await t.withIdentity(IDENTITY).mutation(api.courses.upsertCourse, {
    canvasId: "canvas_101",
    name: "Intro to CS",
    courseCode: "CSE 101",
    term: "Spring 2026",
  });
  return courseId;
}

describe("assignments", () => {
  describe("getUpcomingAssignments", () => {
    it("returns empty array when unauthenticated", async () => {
      const t = convexTest(schema);
      const result = await t.query(api.assignments.getUpcomingAssignments, {});
      expect(result).toEqual([]);
    });

    it("excludes completed assignments", async () => {
      const t = convexTest(schema);
      const courseId = await seedUserAndCourse(t);

      await t.withIdentity(IDENTITY).mutation(api.assignments.upsertAssignment, {
        courseId: courseId as Id<"courses">,
        canvasId: "a1",
        title: "Done HW",
        dueAt: Date.now() + 86400000,
      });

      const assignments = await t.withIdentity(IDENTITY).query(api.assignments.getUpcomingAssignments, {});
      const assignment = assignments.find((a) => a.canvasId === "a1")!;
      await t.withIdentity(IDENTITY).mutation(api.assignments.markComplete, {
        assignmentId: assignment._id,
        isCompleted: true,
      });

      const upcoming = await t.withIdentity(IDENTITY).query(api.assignments.getUpcomingAssignments, {});
      expect(upcoming.find((a) => a.canvasId === "a1")).toBeUndefined();
    });

    it("excludes past-due assignments", async () => {
      const t = convexTest(schema);
      const courseId = await seedUserAndCourse(t);

      await t.withIdentity(IDENTITY).mutation(api.assignments.upsertAssignment, {
        courseId: courseId as Id<"courses">,
        canvasId: "a_past",
        title: "Late HW",
        dueAt: Date.now() - 86400000,
      });

      const upcoming = await t.withIdentity(IDENTITY).query(api.assignments.getUpcomingAssignments, {});
      expect(upcoming.find((a) => a.canvasId === "a_past")).toBeUndefined();
    });

    it("includes assignments with no due date", async () => {
      const t = convexTest(schema);
      const courseId = await seedUserAndCourse(t);

      await t.withIdentity(IDENTITY).mutation(api.assignments.upsertAssignment, {
        courseId: courseId as Id<"courses">,
        canvasId: "a_noduedate",
        title: "Undated HW",
      });

      const upcoming = await t.withIdentity(IDENTITY).query(api.assignments.getUpcomingAssignments, {});
      expect(upcoming.find((a) => a.canvasId === "a_noduedate")).toBeDefined();
    });

    it("sorts by dueAt ascending with undated last", async () => {
      const t = convexTest(schema);
      const courseId = await seedUserAndCourse(t);
      const now = Date.now();

      await t.withIdentity(IDENTITY).mutation(api.assignments.upsertAssignment, {
        courseId: courseId as Id<"courses">,
        canvasId: "a_later",
        title: "Later HW",
        dueAt: now + 2 * 86400000,
      });
      await t.withIdentity(IDENTITY).mutation(api.assignments.upsertAssignment, {
        courseId: courseId as Id<"courses">,
        canvasId: "a_sooner",
        title: "Sooner HW",
        dueAt: now + 86400000,
      });
      await t.withIdentity(IDENTITY).mutation(api.assignments.upsertAssignment, {
        courseId: courseId as Id<"courses">,
        canvasId: "a_noduedate",
        title: "Undated HW",
      });

      const upcoming = await t.withIdentity(IDENTITY).query(api.assignments.getUpcomingAssignments, {});
      const canvasIds = upcoming.map((a) => a.canvasId);
      expect(canvasIds.indexOf("a_sooner")).toBeLessThan(canvasIds.indexOf("a_later"));
      expect(canvasIds.indexOf("a_noduedate")).toBe(canvasIds.length - 1);
    });
  });

  describe("upsertAssignment", () => {
    it("updates an existing assignment by canvasId instead of inserting a duplicate", async () => {
      const t = convexTest(schema);
      const courseId = await seedUserAndCourse(t);

      await t.withIdentity(IDENTITY).mutation(api.assignments.upsertAssignment, {
        courseId: courseId as Id<"courses">,
        canvasId: "a_dup",
        title: "Original Title",
      });

      await t.withIdentity(IDENTITY).mutation(api.assignments.upsertAssignment, {
        courseId: courseId as Id<"courses">,
        canvasId: "a_dup",
        title: "Updated Title",
      });

      const all = await t.withIdentity(IDENTITY).query(api.assignments.getAssignments, {});
      const matches = all.filter((a) => a.canvasId === "a_dup");
      expect(matches).toHaveLength(1);
      expect(matches[0].title).toBe("Updated Title");
    });
  });

  describe("getAssignments - user isolation", () => {
    it("does not leak another user's assignments when filtering by courseId", async () => {
      const t = convexTest(schema);

      // Seed user A with a course and assignment
      const courseId = await seedUserAndCourse(t);
      await t.withIdentity(IDENTITY).mutation(api.assignments.upsertAssignment, {
        courseId: courseId as Id<"courses">,
        canvasId: "a_user1",
        title: "User A HW",
      });

      // Seed user B and create an assignment on the SAME course
      await t.withIdentity(OTHER_IDENTITY).mutation(api.users.ensureUser, {});
      await t.run(async (ctx) => {
        const userB = await ctx.db
          .query("users")
          .withIndex("by_clerkId", (q) => q.eq("clerkId", OTHER_IDENTITY.subject))
          .unique();
        await ctx.db.insert("assignments", {
          userId: userB!._id,
          courseId: courseId as Id<"courses">,
          canvasId: "a_user2",
          title: "User B HW",
          isCompleted: false,
          lastSyncedAt: Date.now(),
        });
      });

      // User A queries by courseId — must NOT see User B's assignment
      const userAResults = await t.withIdentity(IDENTITY).query(api.assignments.getAssignments, {
        courseId: courseId as Id<"courses">,
      });
      expect(userAResults).toHaveLength(1);
      expect(userAResults[0].canvasId).toBe("a_user1");

      // User B queries by courseId — must NOT see User A's assignment
      const userBResults = await t.withIdentity(OTHER_IDENTITY).query(api.assignments.getAssignments, {
        courseId: courseId as Id<"courses">,
      });
      expect(userBResults).toHaveLength(1);
      expect(userBResults[0].canvasId).toBe("a_user2");
    });

    it("does not leak another user's assignments when no courseId filter", async () => {
      const t = convexTest(schema);

      // Seed user A
      const courseId = await seedUserAndCourse(t);
      await t.withIdentity(IDENTITY).mutation(api.assignments.upsertAssignment, {
        courseId: courseId as Id<"courses">,
        canvasId: "a_only_mine",
        title: "My HW",
      });

      // Seed user B with an assignment
      await t.withIdentity(OTHER_IDENTITY).mutation(api.users.ensureUser, {});
      await t.run(async (ctx) => {
        const userB = await ctx.db
          .query("users")
          .withIndex("by_clerkId", (q) => q.eq("clerkId", OTHER_IDENTITY.subject))
          .unique();
        await ctx.db.insert("assignments", {
          userId: userB!._id,
          courseId: courseId as Id<"courses">,
          canvasId: "a_theirs",
          title: "Their HW",
          isCompleted: false,
          lastSyncedAt: Date.now(),
        });
      });

      // User A with no courseId filter — must only see own assignments
      const results = await t.withIdentity(IDENTITY).query(api.assignments.getAssignments, {});
      expect(results.every((a) => a.canvasId !== "a_theirs")).toBe(true);
      expect(results.find((a) => a.canvasId === "a_only_mine")).toBeDefined();
    });
  });

  describe("markComplete", () => {
    it("throws when a different user tries to mark someone else's assignment", async () => {
      const t = convexTest(schema);
      const courseId = await seedUserAndCourse(t);

      await t.withIdentity(IDENTITY).mutation(api.assignments.upsertAssignment, {
        courseId: courseId as Id<"courses">,
        canvasId: "a_owned",
        title: "Owner's HW",
      });

      const assignments = await t.withIdentity(IDENTITY).query(api.assignments.getAssignments, {});
      const assignment = assignments[0];

      // Seed a second user
      await t.withIdentity(OTHER_IDENTITY).mutation(api.users.ensureUser, {});

      await expect(
        t.withIdentity(OTHER_IDENTITY).mutation(api.assignments.markComplete, {
          assignmentId: assignment._id,
          isCompleted: true,
        })
      ).rejects.toThrow("Unauthorized");
    });

    it("allows the owner to toggle completion", async () => {
      const t = convexTest(schema);
      const courseId = await seedUserAndCourse(t);

      await t.withIdentity(IDENTITY).mutation(api.assignments.upsertAssignment, {
        courseId: courseId as Id<"courses">,
        canvasId: "a_toggle",
        title: "Toggle HW",
      });

      const [assignment] = await t.withIdentity(IDENTITY).query(api.assignments.getAssignments, {});
      expect(assignment.isCompleted).toBe(false);

      await t.withIdentity(IDENTITY).mutation(api.assignments.markComplete, {
        assignmentId: assignment._id,
        isCompleted: true,
      });

      const [updated] = await t.withIdentity(IDENTITY).query(api.assignments.getAssignments, {});
      expect(updated.isCompleted).toBe(true);
    });
  });
});
