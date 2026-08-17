import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../server/_core/context";

const db = vi.hoisted(() => ({
  getPlanById: vi.fn(),
  getPlanForGoal: vi.fn(),
  getGoalById: vi.fn(),
  saveDraftPlan: vi.fn(),
  reserveSegmentGeneration: vi.fn(),
  savePlanSegment: vi.fn(),
  markSegmentGenerationFailed: vi.fn(),
  unlockSegmentStart: vi.fn(),
  updateDraftPlanBounds: vi.fn(),
  gradeQuiz: vi.fn(),
  beginQuiz: vi.fn(),
  approvePlan: vi.fn(),
  getFailedPlanSegments: vi.fn(),
  getUserLanguage: vi.fn().mockResolvedValue("ar"),
  setUserLanguage: vi.fn().mockImplementation(async (_userId: number, language: "ar" | "en") => language),
}));

const ai = vi.hoisted(() => ({
  generateCurriculumBlueprint: vi.fn(),
  generatePlanSegment: vi.fn(),
  regeneratePlanOutlineForBounds: vi.fn(),
  generatePlanOutline: vi.fn(),
  revisePlanOutline: vi.fn(),
}));

vi.mock("../server/db", () => {
  class LearningStateError extends Error {}
  class ActiveGoalConflictError extends Error {}
  class LocalAuthConflictError extends Error {}
  return { ...db, LearningStateError, ActiveGoalConflictError, LocalAuthConflictError };
});

vi.mock("../server/learning-ai", () => ({
  ...ai,
  LEARNING_MODEL: "gemini-test",
  PROMPT_VERSION: "test",
}));

vi.mock("../server/observability", () => ({ logServerError: vi.fn() }));

import { appRouter } from "../server/routers";

const outline = {
  title: "English plan",
  summary: "A concise plan",
  totalDurationDays: 30,
  dailyMinutes: 60,
  days: Array.from({ length: 30 }, (_, index) => ({ dayNumber: index + 1, title: `Day ${index + 1}`, focus: "Practice" })),
};

const curriculumBlueprint = {
  domain: "English communication",
  learnerStartingPoint: "A beginner needs practical foundations.",
  targetCapabilities: ["Understand common phrases", "Communicate in everyday exchanges", "Write short messages"],
  progressionPrinciples: ["Build foundations first", "Practise in context", "Increase independence"],
  practiceApproach: ["Active recall", "Guided production", "Application"],
  reviewStrategy: "Revisit material after delays and in new contexts.",
  assessmentApproach: "Assess practical use of the target skill.",
  pacingGuidance: "Use one achievable objective within the daily budget.",
  avoid: ["Generic tasks", "Unrealistic promises"],
};

const ownedDraft = {
  plan: {
    id: 44,
    status: "draft",
    totalDurationDays: 30,
    dailyMinutes: 60,
    totalEstimatedMinutes: 1_800,
    draftJson: outline,
    curriculumJson: curriculumBlueprint,
    editCount: 0,
  },
  goal: {
    id: 9,
    title: "English",
    currentLevel: "beginner",
    dailyMinutes: 60,
    targetDurationDays: 30,
  },
};

const sampleAnswers = [{ questionId: "q1", optionId: "a" }];

function callerFor(userId = 1) {
  const ctx: TrpcContext = {
    user: {
      id: userId,
      openId: `user-${userId}`,
      email: null,
      name: `User ${userId}`,
      loginMethod: "local",
      role: "user",
      preferredLanguage: "ar",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { headers: {}, ip: "127.0.0.1" } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
  return appRouter.createCaller(ctx);
}

describe("MVP router business rules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.markSegmentGenerationFailed.mockResolvedValue(undefined);
  });

  it("1. rejects access to another user's task through the ownership-aware data operation", async () => {
    db.beginQuiz.mockRejectedValue(new (await import("../server/db")).LearningStateError("المهمة المطلوبة غير موجودة."));
    await expect(callerFor(1).tasks.beginQuiz({ taskId: 200 })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(db.beginQuiz).toHaveBeenCalledWith(1, 200);
  });

  it("2. rejects access to another user's plan through update bounds", async () => {
    db.getPlanById.mockResolvedValue(null);
    await expect(callerFor(1).plans.updateBounds({ planId: 200, dailyMinutes: 60, durationDays: 30 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(db.updateDraftPlanBounds).not.toHaveBeenCalled();
  });

  it("3–4. do not complete or submit a locked task", async () => {
    db.gradeQuiz.mockRejectedValue(new (await import("../server/db")).LearningStateError("الاختبار غير متاح لهذه المهمة."));
    await expect(callerFor().tasks.submitQuiz({ taskId: 55, answers: sampleAnswers })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(db.gradeQuiz).toHaveBeenCalledWith(1, 55, sampleAnswers);
  });

  it("5. keeps the next task locked after a score below 70 percent", async () => {
    db.gradeQuiz.mockResolvedValue({ score: 67, passed: false, nextTaskUnlocked: false, isPlanComplete: false, planId: 44, nextSegmentStartDay: null });
    await expect(callerFor().tasks.submitQuiz({ taskId: 55, answers: sampleAnswers })).resolves.toMatchObject({ passed: false, nextTaskUnlocked: false, nextSegmentPrepared: false });
    expect(db.reserveSegmentGeneration).not.toHaveBeenCalled();
  });

  it("6. preserves a normal next-task unlock after a passing score", async () => {
    db.gradeQuiz.mockResolvedValue({ score: 100, passed: true, nextTaskUnlocked: true, isPlanComplete: false, planId: 44, nextSegmentStartDay: null });
    await expect(callerFor().tasks.submitQuiz({ taskId: 55, answers: sampleAnswers })).resolves.toMatchObject({ passed: true, nextTaskUnlocked: true, nextSegmentPrepared: false });
  });

  it("7. prepares and unlocks the first task of segment two", async () => {
    db.getUserLanguage.mockResolvedValue("en");
    db.reserveSegmentGeneration.mockResolvedValue({ state: "reserved", plan: { draftJson: outline, curriculumJson: curriculumBlueprint }, goal: ownedDraft.goal, segment: { startDay: 8, endDay: 14 } });
    ai.generatePlanSegment.mockResolvedValue({ startDay: 8, endDay: 14, days: [] });
    db.savePlanSegment.mockResolvedValue(8);
    db.unlockSegmentStart.mockResolvedValue(true);
    await expect(callerFor().plans.retrySegment({ planId: 44, startDay: 8 })).resolves.toMatchObject({ alreadyGenerated: false, startDay: 8, nextTaskUnlocked: true });
    expect(db.savePlanSegment).toHaveBeenCalledTimes(1);
    expect(ai.generatePlanSegment).toHaveBeenCalledWith(expect.objectContaining({ goal: expect.objectContaining({ language: "en" }), curriculumBlueprint }));
  });

  it("stores and returns the account language preference", async () => {
    db.getUserLanguage.mockResolvedValue("ar");
    await expect(callerFor().preferences.language()).resolves.toBe("ar");
    await expect(callerFor().preferences.setLanguage("en")).resolves.toEqual({ language: "en" });
    expect(db.setUserLanguage).toHaveBeenCalledWith(1, "en");
  });

  it("8. records a recoverable segment-generation failure", async () => {
    const generationFailure = new Error("provider timeout");
    db.reserveSegmentGeneration.mockResolvedValue({ state: "reserved", plan: { draftJson: outline, curriculumJson: curriculumBlueprint }, goal: ownedDraft.goal, segment: { startDay: 8, endDay: 14 } });
    ai.generatePlanSegment.mockRejectedValue(generationFailure);
    await expect(callerFor().plans.retrySegment({ planId: 44, startDay: 8 })).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(db.markSegmentGenerationFailed).toHaveBeenCalledWith(1, 44, 8, generationFailure);
  });

  it("9. treats a retry after partial success as idempotent and does not save a duplicate segment", async () => {
    db.reserveSegmentGeneration.mockResolvedValue({ state: "generated", plan: { draftJson: outline, curriculumJson: curriculumBlueprint }, goal: ownedDraft.goal, segment: { startDay: 8, endDay: 14 } });
    db.unlockSegmentStart.mockResolvedValue(true);
    await expect(callerFor().plans.retrySegment({ planId: 44, startDay: 8 })).resolves.toMatchObject({ alreadyGenerated: true, nextTaskUnlocked: true });
    expect(ai.generatePlanSegment).not.toHaveBeenCalled();
    expect(db.savePlanSegment).not.toHaveBeenCalled();
  });

  it("10. applies a valid duration and daily-time edit to a draft only", async () => {
    db.getPlanById.mockResolvedValue(ownedDraft);
    ai.regeneratePlanOutlineForBounds.mockResolvedValue(outline);
    db.updateDraftPlanBounds.mockResolvedValue({ bounds: { minDurationDays: 4, maxDurationDays: 30, totalEstimatedMinutes: 1_800 } });
    db.reserveSegmentGeneration.mockResolvedValue({ state: "generated", plan: { draftJson: outline, curriculumJson: curriculumBlueprint }, goal: ownedDraft.goal, segment: { startDay: 1, endDay: 7 } });
    await expect(callerFor().plans.updateBounds({ planId: 44, dailyMinutes: 60, durationDays: 30 })).resolves.toMatchObject({ firstSegmentReady: true });
    expect(db.updateDraftPlanBounds).toHaveBeenCalledWith(expect.objectContaining({ userId: 1, planId: 44, dailyMinutes: 60, durationDays: 30 }));
  });

  it("11–12. reject invalid or approved-plan edits without mutating the plan", async () => {
    db.getPlanById.mockResolvedValue(ownedDraft);
    await expect(callerFor().plans.updateBounds({ planId: 44, dailyMinutes: 1, durationDays: 1 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.updateDraftPlanBounds).not.toHaveBeenCalled();
    db.getPlanById.mockResolvedValue({ ...ownedDraft, plan: { ...ownedDraft.plan, status: "approved" } });
    await expect(callerFor().plans.updateBounds({ planId: 44, dailyMinutes: 60, durationDays: 30 })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(db.updateDraftPlanBounds).not.toHaveBeenCalled();
  });

  it("16. delegates repeated approval to the idempotent approval transaction without creating a new plan", async () => {
    db.approvePlan.mockResolvedValue({ planId: 44, taskCount: 7 });
    await expect(callerFor().plans.approve({ goalId: 9 })).resolves.toEqual({ planId: 44, taskCount: 7 });
    await expect(callerFor().plans.approve({ goalId: 9 })).resolves.toEqual({ planId: 44, taskCount: 7 });
    expect(db.approvePlan).toHaveBeenNthCalledWith(1, 1, 9);
    expect(db.approvePlan).toHaveBeenNthCalledWith(2, 1, 9);
  });

  it("creates, persists, and reuses one curriculum blueprint when generating a new plan", async () => {
    db.getGoalById.mockResolvedValue(ownedDraft.goal);
    db.getPlanForGoal.mockResolvedValue(null);
    db.getUserLanguage.mockResolvedValue("ar");
    ai.generateCurriculumBlueprint.mockResolvedValue(curriculumBlueprint);
    ai.generatePlanOutline.mockResolvedValue(outline);
    db.saveDraftPlan.mockResolvedValue(44);
    db.reserveSegmentGeneration.mockResolvedValue({ state: "generated", plan: { draftJson: outline, curriculumJson: curriculumBlueprint }, goal: ownedDraft.goal, segment: { startDay: 1, endDay: 7 } });

    await expect(callerFor().plans.generateInitial({ goalId: 9 })).resolves.toMatchObject({ planId: 44, firstSegmentReady: true });
    expect(ai.generatePlanOutline).toHaveBeenCalledWith(expect.objectContaining({ language: "ar" }), curriculumBlueprint);
    expect(db.saveDraftPlan).toHaveBeenCalledWith(expect.objectContaining({ curriculumBlueprint, promptVersion: "test" }));
  });
});
