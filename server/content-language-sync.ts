import type { ContentLanguage, LearningPlanSegment } from "../shared/learning";
import { LEARNING_MODEL, PROMPT_VERSION, translatePlanOutline, translatePlanSegment } from "./learning-ai";
import * as learningDb from "./db";

/**
 * Switches the account language without regenerating a curriculum. The plan's
 * source content and learner progress remain canonical. A second-language view
 * is translated and cached once, then all subsequent switches are instant.
 */
export async function synchronizeActivePlanLanguage(userId: number, language: ContentLanguage) {
  const snapshot = await learningDb.getActivePlanLocalizationSnapshot(userId, language);
  if (!snapshot) {
    await learningDb.setUserLanguage(userId, language);
    return { language, localized: false };
  }

  const currentLanguage = await learningDb.getUserLanguage(userId);
  const sourceLanguage = snapshot.plan.contentLanguage ?? currentLanguage;
  if (sourceLanguage === language || snapshot.localization) {
    await learningDb.setUserLanguage(userId, language);
    return { language, localized: false };
  }

  const sourceSegments = snapshot.generatedSegments.map((segment) => segment.detailJson).filter((segment): segment is LearningPlanSegment => Boolean(segment));
  if (sourceSegments.length !== snapshot.generatedSegments.length) {
    throw new learningDb.LearningStateError("توجد دفعة من الخطة لم تكتمل بعد. أعد تجهيزها قبل تغيير لغة المحتوى.");
  }

  const [outline, segments] = await Promise.all([
    translatePlanOutline({ source: snapshot.plan.draftJson, targetLanguage: language }),
    translateSegmentsInSmallBatches(sourceSegments, language),
  ]);
  await learningDb.savePlanLocalization({
    userId,
    planId: snapshot.plan.id,
    language,
    outline,
    segments,
    aiModel: LEARNING_MODEL,
    promptVersion: PROMPT_VERSION,
  });
  await learningDb.setUserLanguage(userId, language);
  return { language, localized: true };
}

async function translateSegmentsInSmallBatches(sourceSegments: LearningPlanSegment[], targetLanguage: ContentLanguage) {
  const translated: LearningPlanSegment[] = [];
  const batchSize = 3;
  for (let start = 0; start < sourceSegments.length; start += batchSize) {
    const batch = await Promise.all(sourceSegments.slice(start, start + batchSize)
      .map((source) => translatePlanSegment({ source, targetLanguage })));
    translated.push(...batch);
  }
  return translated;
}
