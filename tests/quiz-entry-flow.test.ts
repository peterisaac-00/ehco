import { describe, expect, it } from "vitest";

import { getQuizEntryState } from "../lib/quiz-entry-flow";

describe("quiz entry flow", () => {
  it("keeps the learner on a loading state only while the lesson request is pending", () => {
    expect(getQuizEntryState({ isPending: true, isError: false, hasQuizData: false })).toBe("loading");
  });

  it("shows an actionable error rather than an endless loading state when opening fails", () => {
    expect(getQuizEntryState({ isPending: false, isError: true, hasQuizData: false })).toBe("error");
  });

  it("starts with the lesson reading state once task content and questions are ready", () => {
    expect(getQuizEntryState({ isPending: false, isError: false, hasQuizData: true })).toBe("lesson");
  });
});
