import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { Id } from "../_generated/dataModel";

const IDENTITY = { subject: "clerk_notif_1", email: "notif@ucsc.edu", name: "Notif User" };
const OTHER_IDENTITY = { subject: "clerk_notif_2", email: "other@ucsc.edu", name: "Other User" };

async function seedUserAndCourse(t: ReturnType<typeof convexTest>) {
  await t.withIdentity(IDENTITY).mutation(api.users.ensureUser, {});
  return await t.withIdentity(IDENTITY).mutation(api.courses.upsertCourse, {
    canvasId: "canvas_notif_101",
    name: "Notifications Course",
    courseCode: "CSE 101",
    term: "Spring 2026",
  });
}

// ---------------------------------------------------------------------------
// isNew flag on insert vs update
// ---------------------------------------------------------------------------

describe("upsertAssignment isNew flag (US-3.3)", () => {
  it("sets isNew to true on first insert", async () => {
    const t = convexTest(schema);
    const courseId = await seedUserAndCourse(t);

    await t.withIdentity(IDENTITY).mutation(api.assignments.upsertAssignment, {
      courseId: courseId as Id<"courses">,
      canvasId: "a_new_1",
      title: "Brand New Assignment",
      dueAt: Date.now() + 86400000,
    });

    const all = await t.withIdentity(IDENTITY).query(api.assignments.getAssignments, {});
    const assignment = all.find((a) => a.canvasId === "a_new_1");
    expect(assignment?.isNew).toBe(true);
  });

  it("does NOT overwrite isNew on subsequent upsert of same canvasId", async () => {
    const t = convexTest(schema);
    const courseId = await seedUserAndCourse(t);

    await t.withIdentity(IDENTITY).mutation(api.assignments.upsertAssignment, {
      courseId: courseId as Id<"courses">,
      canvasId: "a_resync",
      title: "Original Title",
    });

    // Simulate user dismissing it
    const all = await t.withIdentity(IDENTITY).query(api.assignments.getAssignments, {});
    const assignment = all.find((a) => a.canvasId === "a_resync")!;
    await t.withIdentity(IDENTITY).mutation(api.assignments.dismissNewAssignment, {
      assignmentId: assignment._id,
    });

    // Re-sync the same assignment (title changed)
    await t.withIdentity(IDENTITY).mutation(api.assignments.upsertAssignment, {
      courseId: courseId as Id<"courses">,
      canvasId: "a_resync",
      title: "Updated Title",
    });

    const updated = await t.withIdentity(IDENTITY).query(api.assignments.getAssignments, {});
    const resyncedAssignment = updated.find((a) => a.canvasId === "a_resync");
    // isNew should still be false — not re-triggered by a re-sync
    expect(resyncedAssignment?.isNew).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getNewAssignments
// ---------------------------------------------------------------------------

describe("getNewAssignments (US-3.3)", () => {
  it("returns empty array when unauthenticated", async () => {
    const t = convexTest(schema);
    const result = await t.query(api.assignments.getNewAssignments, {});
    expect(result).toEqual([]);
  });

  it("returns new assignments for authenticated user", async () => {
    const t = convexTest(schema);
    const courseId = await seedUserAndCourse(t);

    await t.withIdentity(IDENTITY).mutation(api.assignments.upsertAssignment, {
      courseId: courseId as Id<"courses">,
      canvasId: "a_getNew_1",
      title: "New HW 1",
    });
    await t.withIdentity(IDENTITY).mutation(api.assignments.upsertAssignment, {
      courseId: courseId as Id<"courses">,
      canvasId: "a_getNew_2",
      title: "New HW 2",
    });

    const newAssignments = await t.withIdentity(IDENTITY).query(api.assignments.getNewAssignments, {});
    expect(newAssignments).toHaveLength(2);
  });

  it("returns empty array when canvasEnabled is false", async () => {
    const t = convexTest(schema);
    const courseId = await seedUserAndCourse(t);

    await t.withIdentity(IDENTITY).mutation(api.assignments.upsertAssignment, {
      courseId: courseId as Id<"courses">,
      canvasId: "a_toggled",
      title: "Hidden Assignment",
    });

    // Disable Canvas
    await t.withIdentity(IDENTITY).mutation(api.users.updateAccessToggles, {
      canvasEnabled: false,
    });

    const newAssignments = await t.withIdentity(IDENTITY).query(api.assignments.getNewAssignments, {});
    expect(newAssignments).toEqual([]);
  });

  it("does not return dismissed assignments", async () => {
    const t = convexTest(schema);
    const courseId = await seedUserAndCourse(t);

    await t.withIdentity(IDENTITY).mutation(api.assignments.upsertAssignment, {
      courseId: courseId as Id<"courses">,
      canvasId: "a_dismissed",
      title: "Dismissed HW",
    });

    const all = await t.withIdentity(IDENTITY).query(api.assignments.getAssignments, {});
    const assignment = all.find((a) => a.canvasId === "a_dismissed")!;

    await t.withIdentity(IDENTITY).mutation(api.assignments.dismissNewAssignment, {
      assignmentId: assignment._id,
    });

    const newAssignments = await t.withIdentity(IDENTITY).query(api.assignments.getNewAssignments, {});
    expect(newAssignments.find((a) => a.canvasId === "a_dismissed")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// dismissNewAssignment
// ---------------------------------------------------------------------------

describe("dismissNewAssignment (US-3.3)", () => {
  it("sets isNew to false for the owner", async () => {
    const t = convexTest(schema);
    const courseId = await seedUserAndCourse(t);

    await t.withIdentity(IDENTITY).mutation(api.assignments.upsertAssignment, {
      courseId: courseId as Id<"courses">,
      canvasId: "a_dismiss_1",
      title: "To Dismiss",
    });

    const all = await t.withIdentity(IDENTITY).query(api.assignments.getAssignments, {});
    const assignment = all.find((a) => a.canvasId === "a_dismiss_1")!;
    expect(assignment.isNew).toBe(true);

    await t.withIdentity(IDENTITY).mutation(api.assignments.dismissNewAssignment, {
      assignmentId: assignment._id,
    });

    const updated = await t.withIdentity(IDENTITY).query(api.assignments.getAssignments, {});
    expect(updated.find((a) => a.canvasId === "a_dismiss_1")?.isNew).toBe(false);
  });

  it("throws Unauthorized when another user tries to dismiss", async () => {
    const t = convexTest(schema);
    const courseId = await seedUserAndCourse(t);

    await t.withIdentity(IDENTITY).mutation(api.assignments.upsertAssignment, {
      courseId: courseId as Id<"courses">,
      canvasId: "a_own",
      title: "Owner HW",
    });

    const all = await t.withIdentity(IDENTITY).query(api.assignments.getAssignments, {});
    const assignment = all[0];

    await t.withIdentity(OTHER_IDENTITY).mutation(api.users.ensureUser, {});

    await expect(
      t.withIdentity(OTHER_IDENTITY).mutation(api.assignments.dismissNewAssignment, {
        assignmentId: assignment._id,
      })
    ).rejects.toThrow("Unauthorized");
  });

  it("throws when unauthenticated", async () => {
    const t = convexTest(schema);
    const courseId = await seedUserAndCourse(t);

    await t.withIdentity(IDENTITY).mutation(api.assignments.upsertAssignment, {
      courseId: courseId as Id<"courses">,
      canvasId: "a_unauth",
      title: "Unauth HW",
    });
    const all = await t.withIdentity(IDENTITY).query(api.assignments.getAssignments, {});
    const assignment = all[0];

    await expect(
      t.mutation(api.assignments.dismissNewAssignment, { assignmentId: assignment._id })
    ).rejects.toThrow("Not authenticated");
  });
});

// ---------------------------------------------------------------------------
// dismissAllNewAssignments
// ---------------------------------------------------------------------------

describe("dismissAllNewAssignments (US-3.3)", () => {
  it("clears all new assignments for the user", async () => {
    const t = convexTest(schema);
    const courseId = await seedUserAndCourse(t);

    for (const id of ["a_bulk_1", "a_bulk_2", "a_bulk_3"]) {
      await t.withIdentity(IDENTITY).mutation(api.assignments.upsertAssignment, {
        courseId: courseId as Id<"courses">,
        canvasId: id,
        title: `Bulk HW ${id}`,
      });
    }

    const before = await t.withIdentity(IDENTITY).query(api.assignments.getNewAssignments, {});
    expect(before).toHaveLength(3);

    await t.withIdentity(IDENTITY).mutation(api.assignments.dismissAllNewAssignments, {});

    const after = await t.withIdentity(IDENTITY).query(api.assignments.getNewAssignments, {});
    expect(after).toHaveLength(0);
  });

  it("throws when unauthenticated", async () => {
    const t = convexTest(schema);
    await expect(
      t.mutation(api.assignments.dismissAllNewAssignments, {})
    ).rejects.toThrow("Not authenticated");
  });

  it("does not affect another user's new assignments", async () => {
    const t = convexTest(schema);
    const courseId = await seedUserAndCourse(t);

    // User A gets a new assignment
    await t.withIdentity(IDENTITY).mutation(api.assignments.upsertAssignment, {
      courseId: courseId as Id<"courses">,
      canvasId: "a_isolation",
      title: "Isolated HW",
    });

    // User B dismisses all their (empty) new assignments
    await t.withIdentity(OTHER_IDENTITY).mutation(api.users.ensureUser, {});
    await t.withIdentity(OTHER_IDENTITY).mutation(api.assignments.dismissAllNewAssignments, {});

    // User A's new assignment should still be new
    const userANew = await t.withIdentity(IDENTITY).query(api.assignments.getNewAssignments, {});
    expect(userANew).toHaveLength(1);
  });
});
