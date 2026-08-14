export const ONBOARDING_STEPS = 4 as const;

export type GoalOnboardingState = {
  title: string;
  currentLevel: "beginner" | "intermediate" | "advanced";
  dailyMinutes: string;
  targetDurationDays: string;
};

export function isGoalTitleValid(title: string) {
  const trimmed = title.trim();
  return trimmed.length >= 3 && trimmed.length <= 160;
}

export function isDailyMinutesValid(value: string) {
  const minutes = Number(value);
  return Number.isInteger(minutes) && minutes >= 30 && minutes <= 480;
}

export function isDurationDaysValid(value: string) {
  const days = Number(value);
  return Number.isInteger(days) && days >= 1 && days <= 150;
}

export function isOnboardingStepValid(step: number, state: GoalOnboardingState) {
  if (step === 1) return isGoalTitleValid(state.title);
  if (step === 2) return Boolean(state.currentLevel);
  if (step === 3) return isDailyMinutesValid(state.dailyMinutes);
  if (step === 4) return isDurationDaysValid(state.targetDurationDays);
  return false;
}

export function buildGoalPayload(state: GoalOnboardingState) {
  if (!isGoalTitleValid(state.title) || !isDailyMinutesValid(state.dailyMinutes) || !isDurationDaysValid(state.targetDurationDays)) return null;
  return {
    title: state.title.trim(),
    currentLevel: state.currentLevel,
    dailyMinutes: Number(state.dailyMinutes),
    targetDurationDays: Number(state.targetDurationDays),
  };
}
