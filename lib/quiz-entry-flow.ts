export type QuizEntryState = "loading" | "error" | "lesson";

/** Determines the first visible state before a learner can answer quiz questions. */
export function getQuizEntryState({
  isPending,
  isError,
  hasQuizData,
}: {
  isPending: boolean;
  isError: boolean;
  hasQuizData: boolean;
}): QuizEntryState {
  if (isError) return "error";
  if (isPending || !hasQuizData) return "loading";
  return "lesson";
}
