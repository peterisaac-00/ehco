import { beforeEach, describe, expect, it, vi } from "vitest";

const llm = vi.hoisted(() => ({ invokeLLM: vi.fn() }));

vi.mock("../server/_core/llm", () => ({
  invokeLLM: llm.invokeLLM,
}));

import { generateCurriculumBlueprint, generatePlanOutline, generatePlanSegment } from "../server/learning-ai";

function validOutline() {
  return {
    title: "Starter plan",
    summary: "A concise plan",
    totalDurationDays: 1,
    dailyMinutes: 30,
    days: [{ dayNumber: 1, title: "First step", focus: "A focused outcome" }],
  };
}

function validBlueprint() {
  return {
    domain: "English communication",
    learnerStartingPoint: "A beginner needs foundations for everyday communication.",
    targetCapabilities: ["Understand common phrases", "Handle everyday exchanges", "Write short useful messages"],
    progressionPrinciples: ["Build foundations before complexity", "Use communication in context", "Increase independence gradually"],
    practiceApproach: ["Active recall", "Guided production", "Contextual application"],
    reviewStrategy: "Revisit high-value material after delays and in new contexts.",
    assessmentApproach: "Assess practical use of the day’s learning objective.",
    pacingGuidance: "Use one focused, achievable outcome within the daily time budget.",
    avoid: ["Generic task lists", "Unrealistic fluency promises"],
  };
}

function validSegment() {
  return {
    startDay: 1,
    endDay: 1,
    days: [{
      dayNumber: 1,
      title: "First step",
      tasks: [{
        orderIndex: 1,
        title: "Practice",
        description: "Complete a short, focused practice activity.",
        estimatedMinutes: 30,
        quizQuestions: [1, 2, 3].map((number) => ({
          id: `q${number}`,
          prompt: `Question ${number}`,
          options: [{ id: "a", text: "Correct" }, { id: "b", text: "Incorrect" }],
          answerId: "a",
          explanation: "This checks the target skill.",
        })),
      }],
    }],
  };
}

function mockResponse(content: unknown) {
  llm.invokeLLM.mockResolvedValue({
    choices: [{ message: { content: JSON.stringify(content) }, finish_reason: "stop" }],
  });
}

describe("learning AI blueprint routing", () => {
  beforeEach(() => {
    llm.invokeLLM.mockReset();
  });

  it("creates a validated curriculum blueprint from a learner profile", async () => {
    mockResponse(validBlueprint());

    const blueprint = await generateCurriculumBlueprint({
      title: "أريد تعلم الإنجليزية للمحادثة",
      currentLevel: "beginner",
      dailyMinutes: 30,
      targetDurationDays: 1,
      language: "ar",
    });

    const request = llm.invokeLLM.mock.calls[0]?.[0];
    expect(request.outputSchema.name).toBe("ehco_curriculum_blueprint");
    expect(request.messages[0].content).toContain("curriculum architect");
    expect(blueprint).toEqual(validBlueprint());
  });

  it("passes the saved blueprint as untrusted reference data to the outline request", async () => {
    mockResponse(validOutline());
    const blueprint = validBlueprint();

    await generatePlanOutline({
      title: "تعلم أساسيات JavaScript لتحليل البيانات",
      currentLevel: "beginner",
      dailyMinutes: 30,
      targetDurationDays: 1,
      language: "ar",
    }, blueprint);

    const request = llm.invokeLLM.mock.calls[0]?.[0];
    expect(request.messages[0].content).toContain("untrusted reference data");
    expect(request.messages[0].content).toContain("Write every learner-visible field strictly in Arabic");
    expect(JSON.parse(request.messages[1].content).curriculumBlueprint).toEqual(blueprint);
  });

  it("reuses the same blueprint when producing detailed tasks and quizzes", async () => {
    mockResponse(validSegment());
    const blueprint = validBlueprint();
    const goal = {
      title: "تعلم أساسيات JavaScript لتحليل البيانات",
      currentLevel: "beginner" as const,
      dailyMinutes: 30,
      targetDurationDays: 1,
      language: "ar" as const,
    };

    await generatePlanSegment({ goal, outline: validOutline(), curriculumBlueprint: blueprint, startDay: 1, endDay: 1 });

    const request = llm.invokeLLM.mock.calls[0]?.[0];
    expect(request.messages[0].content).toContain("untrusted reference data");
    expect(JSON.parse(request.messages[1].content).curriculumBlueprint).toEqual(blueprint);
  });
});
