import { describe, expect, it } from "vitest";

import { ONBOARDING_STEPS, buildGoalPayload, isDailyMinutesValid, isDurationDaysValid, isGoalTitleValid, isOnboardingStepValid } from "../lib/onboarding-rules";

describe("goal onboarding rules", () => {
  const completeState = { title: "تعلم أساسيات البرمجة", currentLevel: "beginner" as const, dailyMinutes: "60", targetDurationDays: "30" };

  it("uses exactly four local steps", () => {
    expect(ONBOARDING_STEPS).toBe(4);
  });

  it("uses the existing title, time, and duration bounds", () => {
    expect(isGoalTitleValid("ab")).toBe(false);
    expect(isGoalTitleValid("هدف صالح")).toBe(true);
    expect(isDailyMinutesValid("29")).toBe(false);
    expect(isDailyMinutesValid("30")).toBe(true);
    expect(isDailyMinutesValid("480")).toBe(true);
    expect(isDailyMinutesValid("481")).toBe(false);
    expect(isDurationDaysValid("0")).toBe(false);
    expect(isDurationDaysValid("90")).toBe(true);
    expect(isDurationDaysValid("91")).toBe(false);
  });

  it("validates only the active step without needing a backend request", () => {
    expect(isOnboardingStepValid(1, { ...completeState, title: "" })).toBe(false);
    expect(isOnboardingStepValid(2, completeState)).toBe(true);
    expect(isOnboardingStepValid(3, { ...completeState, dailyMinutes: "10" })).toBe(false);
    expect(isOnboardingStepValid(4, { ...completeState, targetDurationDays: "90" })).toBe(true);
  });

  it("builds the established create-goal payload only when every value is valid", () => {
    expect(buildGoalPayload({ ...completeState, title: "  هدف منسق  " })).toEqual({ title: "هدف منسق", currentLevel: "beginner", dailyMinutes: 60, targetDurationDays: 30 });
    expect(buildGoalPayload({ ...completeState, targetDurationDays: "0" })).toBeNull();
  });
});
