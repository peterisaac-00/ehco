import { describe, expect, it } from "vitest";

import { getQuizEntryState } from "../lib/quiz-entry-flow";

describe("quiz entry flow", () => {
  it("keeps the learner on a loading state only while the lesson request is pending", () => {
    expect(getQuizEntryState({ isPending: true, isError: false, hasQuizData: false, hasAttempted: true, hasValidTaskId: true })).toBe("loading");
  });

  it("shows an actionable error rather than an endless loading state when opening fails", () => {
    expect(getQuizEntryState({ isPending: false, isError: true, hasQuizData: false, hasAttempted: true, hasValidTaskId: true })).toBe("error");
  });

  it("starts with the lesson reading state once task content and questions are ready", () => {
    expect(getQuizEntryState({ isPending: false, isError: false, hasQuizData: true, hasAttempted: true, hasValidTaskId: true })).toBe("lesson");
  });

  it("shows the recovery screen if opening completed without quiz data", () => {
    expect(getQuizEntryState({ isPending: false, isError: false, hasQuizData: false, hasAttempted: true, hasValidTaskId: true })).toBe("error");
  });

  it("shows the recovery screen for an invalid task route", () => {
    expect(getQuizEntryState({ isPending: false, isError: false, hasQuizData: false, hasAttempted: false, hasValidTaskId: false })).toBe("error");
  });
});
