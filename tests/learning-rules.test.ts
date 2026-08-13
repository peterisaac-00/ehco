import { describe, expect, it } from "vitest";
import {
  calculateQuizScore,
  createPlanSegments,
  planOutlineSchema,
  planSegmentSchema,
} from "../shared/learning";

describe("learning plan rules", () => {
  it("splits a 90-day path into bounded 30-day segments", () => {
    expect(createPlanSegments(90)).toEqual([
      { startDay: 1, endDay: 30 },
      { startDay: 31, endDay: 60 },
      { startDay: 61, endDay: 90 },
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
});
