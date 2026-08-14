import { describe, expect, it } from "vitest";
import {
  calculateStudyBounds,
  calculateQuizScore,
  createPlanSegments,
  planOutlineSchema,
  planSegmentSchema,
  validateStudyBounds,
  varyQuizQuestions,
} from "../shared/learning";

describe("learning plan rules", () => {
  it("splits a path into bounded seven-day segments", () => {
    expect(createPlanSegments(15)).toEqual([
      { startDay: 1, endDay: 7 },
      { startDay: 8, endDay: 14 },
      { startDay: 15, endDay: 15 },
    ]);
  });

  it("rejects an outline whose listed days do not match the stated duration", () => {
    const result = planOutlineSchema.safeParse({
      title: "English fluency",
      summary: "Daily study plan",
      totalDurationDays: 2,
      dailyMinutes: 60,
      days: [{ dayNumber: 1, title: "Start", focus: "Basic vocabulary" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a segment with an answer that is not one of its options", () => {
    const result = planSegmentSchema.safeParse({
      startDay: 1,
      endDay: 1,
      days: [{
        dayNumber: 1,
        title: "Vocabulary",
        tasks: [{
          orderIndex: 1,
          title: "Learn words",
          description: "Learn ten words",
          estimatedMinutes: 30,
          quizQuestions: [{
            id: "q1",
            prompt: "Choose the word",
            options: [{ id: "a", text: "A" }, { id: "b", text: "B" }],
            answerId: "missing",
            explanation: "Explanation",
          }, {
            id: "q2",
            prompt: "Choose again",
            options: [{ id: "a", text: "A" }, { id: "b", text: "B" }],
            answerId: "a",
            explanation: "Explanation",
          }, {
            id: "q3",
            prompt: "Third question",
            options: [{ id: "a", text: "A" }, { id: "b", text: "B" }],
            answerId: "b",
            explanation: "Explanation",
          }],
        }],
      }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects tasks that skip their display order", () => {
    const result = planSegmentSchema.safeParse({
      startDay: 1,
      endDay: 1,
      days: [{
        dayNumber: 1,
        title: "Listening",
        tasks: [{
          orderIndex: 2,
          title: "Listen",
          description: "Listen to a short clip",
          estimatedMinutes: 20,
          quizQuestions: ["q1", "q2", "q3"].map((id) => ({
            id,
            prompt: id,
            options: [{ id: "a", text: "A" }, { id: "b", text: "B" }],
            answerId: "a",
            explanation: "Explanation",
          })),
        }],
      }],
    });
    expect(result.success).toBe(false);
  });

  it("calculates quiz scores only from answers, never from a client supplied score", () => {
    const score = calculateQuizScore([
      { id: "q1", answerId: "a" },
      { id: "q2", answerId: "b" },
      { id: "q3", answerId: "c" },
    ], [
      { questionId: "q1", optionId: "a" },
      { questionId: "q2", optionId: "wrong" },
      { questionId: "q3", optionId: "c" },
    ]);
    expect(score).toBe(67);
  });

  it("13. accepts deterministic duration and daily-time bounds that fit the workload", () => {
    expect(validateStudyBounds({ dailyMinutes: 60, durationDays: 30 }, 1_800)).toMatchObject({ valid: true, bounds: { minDurationDays: 4, maxDurationDays: 60 } });
  });

  it("14. rejects duration and daily-time values that do not fit the workload", () => {
    expect(validateStudyBounds({ dailyMinutes: 60, durationDays: 10 }, 1_800)).toMatchObject({ valid: false });
    expect(validateStudyBounds({ dailyMinutes: 5, durationDays: 30 }, 1_800)).toMatchObject({ valid: false });
  });

  it("15. keeps 150-day study-workload limits deterministic for direct API validation", () => {
    expect(() => calculateStudyBounds(72_001)).toThrow("حجم العمل التقديري للخطة غير صالح.");
    expect(validateStudyBounds({ dailyMinutes: 480, durationDays: 150 }, 72_000)).toMatchObject({ valid: true });
  });

  it("varies retry question and option order without exposing answer metadata", () => {
    const questions = ["q1", "q2", "q3"].map((id) => ({
      id,
      prompt: id,
      options: [{ id: "a", text: "A" }, { id: "b", text: "B" }],
      answerId: "a",
      explanation: "Internal explanation",
    }));
    const firstAttempt = varyQuizQuestions(questions, 0);
    const retryAttempt = varyQuizQuestions(questions, 1);
    expect(retryAttempt.map((question) => question.id)).not.toEqual(firstAttempt.map((question) => question.id));
    expect(retryAttempt[0]?.options.map((option) => option.id)).toEqual(["b", "a"]);
    expect(retryAttempt[0]).not.toHaveProperty("answerId");
    expect(retryAttempt[0]).not.toHaveProperty("explanation");
  });
});
