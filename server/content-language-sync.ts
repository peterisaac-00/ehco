import type { ContentLanguage } from "../shared/learning";
import * as learningDb from "./db";
import { generateCurriculumBlueprint, generatePlanOutline, generatePlanSegment, LEARNING_MODEL, PROMPT_VERSION } from "./learning-ai";

/**
 * Rebuilds all learner-visible content for the active plan in one selected
 * language. Completed progress is preserved; an active quiz must be resolved
 * first so answers are never graded against translated questions.
 */
export async function synchronizeActivePlanLanguage(userId: number, language: ContentLanguage) {
  const snapshot = await learningDb.getActivePlanLanguageSnapshot(userId);
  if (!snapshot || snapshot.plan.contentLanguage === language) {
    await learningDb.setUserLanguage(userId, language);
    return { language, synchronized: false };
  }
  if (snapshot.hasActiveQuiz) {
    throw new learningDb.LearningStateError("أكمل الاختبار المفتوح أو أعده قبل تغيير لغة المحتوى.");
  }

  const goal = { ...snapshot.goal, language };
  const curriculumBlueprint = await generateCurriculumBlueprint(goal);
  const outline = await generatePlanOutline(goal, curriculumBlueprint);
  const generatedSegments = await Promise.all(snapshot.generatedSegments.map((segment) =>
    generatePlanSegment({
      goal,
      outline,
      curriculumBlueprint,
      startDay: segment.startDay,
      endDay: segment.endDay,
    }),
  ));

  await learningDb.replacePlanLocalizedContent({
    userId,
    planId: snapshot.plan.id,
    language,
    outline,
    curriculumBlueprint,
    generatedSegments,
    aiModel: LEARNING_MODEL,
    promptVersion: PROMPT_VERSION,
  });
  await learningDb.setUserLanguage(userId, language);
  return { language, synchronized: true };
}
