import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getActivePlanLanguageSnapshot: vi.fn(),
  setUserLanguage: vi.fn(),
  replacePlanLocalizedContent: vi.fn(),
  generateCurriculumBlueprint: vi.fn(),
  generatePlanOutline: vi.fn(),
  generatePlanSegment: vi.fn(),
  LearningStateError: class MockLearningStateError extends Error {},
}));

vi.mock("../server/db", () => ({
  getActivePlanLanguageSnapshot: mocks.getActivePlanLanguageSnapshot,
  setUserLanguage: mocks.setUserLanguage,
  replacePlanLocalizedContent: mocks.replacePlanLocalizedContent,
  LearningStateError: mocks.LearningStateError,
}));

vi.mock("../server/learning-ai", () => ({
  LEARNING_MODEL: "gemini-test",
  PROMPT_VERSION: "language-sync-test",
  generateCurriculumBlueprint: mocks.generateCurriculumBlueprint,
  generatePlanOutline: mocks.generatePlanOutline,
  generatePlanSegment: mocks.generatePlanSegment,
}));

import { synchronizeActivePlanLanguage } from "../server/content-language-sync";

const outline = { title: "English outline", summary: "summary", totalDurationDays: 2, dailyMinutes: 30, days: [{ dayNumber: 1, title: "Day 1", focus: "focus" }, { dayNumber: 2, title: "Day 2", focus: "focus" }] };
const segment = { startDay: 1, endDay: 2, days: [{ dayNumber: 1, title: "Day 1", tasks: [{ orderIndex: 1, title: "Task", description: "Description", estimatedMinutes: 30, quizQuestions: [{ id: "q1", prompt: "Question", options: [{ id: "a", text: "A" }, { id: "b", text: "B" }], answerId: "a", explanation: "Explanation" }, { id: "q2", prompt: "Question", options: [{ id: "a", text: "A" }, { id: "b", text: "B" }], answerId: "a", explanation: "Explanation" }, { id: "q3", prompt: "Question", options: [{ id: "a", text: "A" }, { id: "b", text: "B" }], answerId: "a", explanation: "Explanation" }] }] }, { dayNumber: 2, title: "Day 2", tasks: [{ orderIndex: 1, title: "Task", description: "Description", estimatedMinutes: 30, quizQuestions: [{ id: "q4", prompt: "Question", options: [{ id: "a", text: "A" }, { id: "b", text: "B" }], answerId: "a", explanation: "Explanation" }, { id: "q5", prompt: "Question", options: [{ id: "a", text: "A" }, { id: "b", text: "B" }], answerId: "a", explanation: "Explanation" }, { id: "q6", prompt: "Question", options: [{ id: "a", text: "A" }, { id: "b", text: "B" }], answerId: "a", explanation: "Explanation" }] }] }] };
const blueprint = { domain: "language", learnerStartingPoint: "beginner", targetCapabilities: ["communicate"], progressionPrinciples: ["sequence"], practiceApproach: ["practice"], reviewStrategy: "review", assessmentApproach: "assessment", pacingGuidance: "pace", avoid: ["overload"] };

describe("content language synchronization", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getActivePlanLanguageSnapshot.mockResolvedValue({
      plan: { id: 44, contentLanguage: "ar" },
      goal: { title: "تعلم الإنجليزية", currentLevel: "beginner", dailyMinutes: 30, targetDurationDays: 2 },
      generatedSegments: [{ startDay: 1, endDay: 2 }],
      hasActiveQuiz: false,
    });
    mocks.generateCurriculumBlueprint.mockResolvedValue(blueprint);
    mocks.generatePlanOutline.mockResolvedValue(outline);
    mocks.generatePlanSegment.mockResolvedValue(segment);
    mocks.replacePlanLocalizedContent.mockResolvedValue(undefined);
    mocks.setUserLanguage.mockResolvedValue("en");
  });

  it("rebuilds the outline, tasks, and quiz questions in the selected language before persisting it", async () => {
    await expect(synchronizeActivePlanLanguage(7, "en")).resolves.toEqual({ language: "en", synchronized: true });
    expect(mocks.generateCurriculumBlueprint).toHaveBeenCalledWith(expect.objectContaining({ language: "en" }));
    expect(mocks.generatePlanOutline).toHaveBeenCalledWith(expect.objectContaining({ language: "en" }), blueprint);
    expect(mocks.generatePlanSegment).toHaveBeenCalledWith(expect.objectContaining({ goal: expect.objectContaining({ language: "en" }) }));
    expect(mocks.replacePlanLocalizedContent).toHaveBeenCalledWith(expect.objectContaining({ language: "en", outline, generatedSegments: [segment] }));
    expect(mocks.setUserLanguage).toHaveBeenCalledWith(7, "en");
  });

  it("does not switch language while a quiz is in progress", async () => {
    mocks.getActivePlanLanguageSnapshot.mockResolvedValueOnce({ plan: { id: 44, contentLanguage: "ar" }, goal: {}, generatedSegments: [], hasActiveQuiz: true });
    await expect(synchronizeActivePlanLanguage(7, "en")).rejects.toBeInstanceOf(mocks.LearningStateError);
    expect(mocks.setUserLanguage).not.toHaveBeenCalled();
  });

  it("persists the preference without another generation when content already matches", async () => {
    mocks.getActivePlanLanguageSnapshot.mockResolvedValueOnce({ plan: { id: 44, contentLanguage: "en" }, goal: {}, generatedSegments: [], hasActiveQuiz: false });
    await expect(synchronizeActivePlanLanguage(7, "en")).resolves.toEqual({ language: "en", synchronized: false });
    expect(mocks.generatePlanOutline).not.toHaveBeenCalled();
    expect(mocks.setUserLanguage).toHaveBeenCalledWith(7, "en");
  });
});
