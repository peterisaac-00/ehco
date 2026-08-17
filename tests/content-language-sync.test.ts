import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  getActivePlanLocalizationSnapshot: vi.fn(),
  getUserLanguage: vi.fn(),
  setUserLanguage: vi.fn(),
  savePlanLocalization: vi.fn(),
  translatePlanOutline: vi.fn(),
  translatePlanSegment: vi.fn(),
}));

vi.mock("../server/db", () => ({
  getActivePlanLocalizationSnapshot: mocks.getActivePlanLocalizationSnapshot,
  getUserLanguage: mocks.getUserLanguage,
  setUserLanguage: mocks.setUserLanguage,
  savePlanLocalization: mocks.savePlanLocalization,
}));

vi.mock("../server/learning-ai", () => ({
  LEARNING_MODEL: "gemini-test",
  PROMPT_VERSION: "localized-copy-test",
  translatePlanOutline: mocks.translatePlanOutline,
  translatePlanSegment: mocks.translatePlanSegment,
}));

import { synchronizeActivePlanLanguage } from "../server/content-language-sync";

const arabicOutline = {
  title: "خطة التحقق", summary: "ملخص", totalDurationDays: 1, dailyMinutes: 30,
  days: [{ dayNumber: 1, title: "اليوم الأول", focus: "تدريب" }],
};
const englishOutline = {
  title: "Verification plan", summary: "Summary", totalDurationDays: 1, dailyMinutes: 30,
  days: [{ dayNumber: 1, title: "Day one", focus: "Practice" }],
};
const arabicSegment = {
  startDay: 1, endDay: 1, days: [{ dayNumber: 1, title: "اليوم الأول", tasks: [{
    orderIndex: 1, title: "مهمة", description: "وصف", estimatedMinutes: 30,
    quizQuestions: ["q1", "q2", "q3"].map((id) => ({ id, prompt: "سؤال", options: [{ id: "a", text: "صحيح" }, { id: "b", text: "خطأ" }], answerId: "a", explanation: "شرح" })),
  }] }],
};
const englishSegment = {
  ...arabicSegment,
  days: [{ ...arabicSegment.days[0], title: "Day one", tasks: [{ ...arabicSegment.days[0].tasks[0], title: "Task", description: "Description", quizQuestions: arabicSegment.days[0].tasks[0].quizQuestions.map((question) => ({ ...question, prompt: "Question", options: [{ id: "a", text: "Correct" }, { id: "b", text: "Wrong" }], explanation: "Explanation" })) }] }],
};

describe("content language synchronization", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getActivePlanLocalizationSnapshot.mockResolvedValue({
      plan: { id: 44, contentLanguage: "ar", draftJson: arabicOutline },
      generatedSegments: [{ startDay: 1, endDay: 1, detailJson: arabicSegment }],
      localization: null,
    });
    mocks.getUserLanguage.mockResolvedValue("ar");
    mocks.translatePlanOutline.mockResolvedValue(englishOutline);
    mocks.translatePlanSegment.mockResolvedValue(englishSegment);
    mocks.savePlanLocalization.mockResolvedValue(undefined);
    mocks.setUserLanguage.mockResolvedValue("en");
  });

  it("creates one cached language view while preserving segment structure and answer ids", async () => {
    await expect(synchronizeActivePlanLanguage(7, "en")).resolves.toEqual({ language: "en", localized: true });
    expect(mocks.translatePlanOutline).toHaveBeenCalledWith({ source: arabicOutline, targetLanguage: "en" });
    expect(mocks.translatePlanSegment).toHaveBeenCalledWith({ source: arabicSegment, targetLanguage: "en" });
    expect(mocks.savePlanLocalization).toHaveBeenCalledWith(expect.objectContaining({
      userId: 7, planId: 44, language: "en", outline: englishOutline, segments: [englishSegment],
    }));
    expect(englishSegment.days[0].tasks[0].quizQuestions.map((question) => [question.id, question.answerId, question.options.map((option) => option.id)]))
      .toEqual(arabicSegment.days[0].tasks[0].quizQuestions.map((question) => [question.id, question.answerId, question.options.map((option) => option.id)]));
    expect(mocks.setUserLanguage).toHaveBeenCalledWith(7, "en");
  });

  it("switches instantly when the requested language was already cached", async () => {
    mocks.getActivePlanLocalizationSnapshot.mockResolvedValueOnce({
      plan: { id: 44, contentLanguage: "ar", draftJson: arabicOutline }, generatedSegments: [], localization: { id: 3 },
    });
    await expect(synchronizeActivePlanLanguage(7, "en")).resolves.toEqual({ language: "en", localized: false });
    expect(mocks.translatePlanOutline).not.toHaveBeenCalled();
    expect(mocks.setUserLanguage).toHaveBeenCalledWith(7, "en");
  });

  it("changes the interface language without translation when it already matches the source plan", async () => {
    await expect(synchronizeActivePlanLanguage(7, "ar")).resolves.toEqual({ language: "ar", localized: false });
    expect(mocks.translatePlanOutline).not.toHaveBeenCalled();
    expect(mocks.setUserLanguage).toHaveBeenCalledWith(7, "ar");
  });

  it("does not block an active quiz because grading uses immutable question and answer ids", async () => {
    mocks.getActivePlanLocalizationSnapshot.mockResolvedValueOnce({
      plan: { id: 44, contentLanguage: "ar", draftJson: arabicOutline },
      generatedSegments: [{ startDay: 1, endDay: 1, detailJson: arabicSegment }],
      localization: null,
      hasActiveQuiz: true,
    });
    await expect(synchronizeActivePlanLanguage(7, "en")).resolves.toEqual({ language: "en", localized: true });
    expect(mocks.setUserLanguage).toHaveBeenCalledWith(7, "en");
  });
});
