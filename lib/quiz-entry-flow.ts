export type QuizEntryState = "loading" | "error" | "lesson";

/** Determines the first visible state before a learner can answer quiz questions. */
export function getQuizEntryState({
  isPending,
  isError,
  hasQuizData,
  hasAttempted,
  hasValidTaskId,
}: {
  isPending: boolean;
  isError: boolean;
  hasQuizData: boolean;
  hasAttempted: boolean;
  hasValidTaskId: boolean;
}): QuizEntryState {
  if (!hasValidTaskId || isError || (hasAttempted && !isPending && !hasQuizData)) return "error";
  if (!hasAttempted || isPending || !hasQuizData) return "loading";
  return "lesson";
}
