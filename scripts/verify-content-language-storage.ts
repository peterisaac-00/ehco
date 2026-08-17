import { eq } from "drizzle-orm";
import { plans, users } from "../drizzle/schema";
import * as learningDb from "../server/db";
import type { CurriculumBlueprint, LearningPlanOutline, LearningPlanSegment } from "../shared/learning";

const blueprint: CurriculumBlueprint = {
  domain: "language learning", learnerStartingPoint: "beginner", targetCapabilities: ["communicate"], progressionPrinciples: ["sequence"], practiceApproach: ["active practice"], reviewStrategy: "review", assessmentApproach: "application", pacingGuidance: "pace", avoid: ["mixed learner language"],
};

function outline(language: "ar" | "en"): LearningPlanOutline {
  return language === "ar"
    ? { title: "خطة التحقق", summary: "مسودة عربية", totalDurationDays: 1, dailyMinutes: 30, days: [{ dayNumber: 1, title: "اليوم الأول", focus: "مراجعة عربية" }] }
    : { title: "Verification plan", summary: "English draft", totalDurationDays: 1, dailyMinutes: 30, days: [{ dayNumber: 1, title: "Day one", focus: "English review" }] };
}

function segment(language: "ar" | "en"): LearningPlanSegment {
  const ar = language === "ar";
  return {
    startDay: 1,
    endDay: 1,
    days: [{
      dayNumber: 1,
      title: ar ? "اليوم الأول" : "Day one",
      tasks: [{
        orderIndex: 1,
        title: ar ? "مهمة عربية" : "English task",
        description: ar ? "هذا وصف المهمة باللغة العربية." : "This is the task description in English.",
        estimatedMinutes: 30,
        quizQuestions: [1, 2, 3].map((number) => ({
          id: `q${number}`,
          prompt: ar ? `سؤال عربي رقم ${number}` : `English question ${number}`,
          options: [{ id: "a", text: ar ? "إجابة صحيحة" : "Correct answer" }, { id: "b", text: ar ? "إجابة خاطئة" : "Wrong answer" }],
          answerId: "a",
          explanation: ar ? "تفسير باللغة العربية" : "Explanation in English",
        })),
      }],
    }],
  };
}

async function main() {
  const username = `language_storage_${Date.now()}`;
  const user = await learningDb.createLocalUser({ username, passwordHash: "verification-only" });
  try {
    const goalId = await learningDb.createGoal(user.id, { title: "Language verification", currentLevel: "beginner", dailyMinutes: 30, targetDurationDays: 1 });
    const planId = await learningDb.saveDraftPlan({ userId: user.id, goalId, draft: outline("ar"), curriculumBlueprint: blueprint, contentLanguage: "ar", aiModel: "test", promptVersion: "test" });
    await learningDb.savePlanSegment({ userId: user.id, planId, segment: segment("ar") });
    await learningDb.approvePlan(user.id, goalId);
    await learningDb.replacePlanLocalizedContent({ userId: user.id, planId, language: "en", outline: outline("en"), curriculumBlueprint: blueprint, generatedSegments: [segment("en")], aiModel: "test", promptVersion: "test" });
    const current = await learningDb.getCurrentTask(user.id);
    if (!current) throw new Error("Expected an unlocked task after localization.");
    const quiz = await learningDb.beginQuiz(user.id, current.task.id);
    const db = await learningDb.getDb();
    const storedPlan = db ? (await db.select({ contentLanguage: plans.contentLanguage }).from(plans).where(eq(plans.id, planId)).limit(1))[0] : null;
    const learnerText = [quiz.task.title, quiz.task.description, ...quiz.questions.flatMap((question) => [question.prompt, ...question.options.map((option) => option.text)])].join(" ");
    if (storedPlan?.contentLanguage !== "en" || /[\u0600-\u06FF]/.test(learnerText)) {
      throw new Error("Stored task or quiz content did not synchronize to English.");
    }
    console.log(JSON.stringify({ storageLanguageVerified: true, contentLanguage: storedPlan.contentLanguage, questionCount: quiz.questions.length }));
  } finally {
    const db = await learningDb.getDb();
    if (db) await db.delete(users).where(eq(users.id, user.id));
  }
}

void main().then(() => process.exit(0), (error) => { console.error(error); process.exit(1); });
