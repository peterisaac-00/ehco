import { describe, expect, it } from "vitest";

import { buildJourneyStages } from "../lib/plan-journey";

describe("plan journey diagram", () => {
  const longPlan = Array.from({ length: 150 }, (_, index) => ({
    dayNumber: index + 1,
    title: `Day ${index + 1}`,
    focus: `Focus ${index + 1}`,
  }));

  it("keeps a 150-day plan to five diagram stages while covering the whole plan", () => {
    const stages = buildJourneyStages(longPlan, [{ dayNumber: 1, status: "unlocked" }], false);

    expect(stages).toHaveLength(5);
    expect(stages[0]).toMatchObject({ startDay: 1, endDay: 30, state: "current" });
    expect(stages[4]).toMatchObject({ startDay: 121, endDay: 150, state: "locked" });
  });

  it("marks only the first stage as the plan start while the plan is still a draft", () => {
    const stages = buildJourneyStages(longPlan, [], true);

    expect(stages[0].state).toBe("planned");
    expect(stages.slice(1).every((stage) => stage.state === "locked")).toBe(true);
  });
});
