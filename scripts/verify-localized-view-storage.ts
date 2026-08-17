import { eq } from "drizzle-orm";
import { quizzes, tasks, users } from "../drizzle/schema";
import * as learningDb from "../server/db";
import type { CurriculumBlueprint, LearningPlanOutline, LearningPlanSegment } from "../shared/learning";

const blueprint: CurriculumBlueprint = { domain: "language", learnerStartingPoint: "beginner learner", targetCapabilities: ["communicate", "listen", "respond"], progressionPrinciples: ["sequence", "practice", "review"], practiceApproach: ["recall", "speaking", "feedback"], reviewStrategy: "retrieve learned phrases", assessmentApproach: "apply phrases", pacingGuidance: "one small goal", avoid: ["mixed text", "overload"] };
const arabicOutline: LearningPlanOutline = { title: "الخطة العربية", summary: "ملخص عربي", totalDurationDays: 1, dailyMinutes: 30, days: [{ dayNumber: 1, title: "اليوم الأول", focus: "تحية" }] };
const englishOutline: LearningPlanOutline = { title: "English plan", summary: "English summary", totalDurationDays: 1, dailyMinutes: 30, days: [{ dayNumber: 1, title: "Day one", focus: "Greeting" }] };
function segment(language: "ar" | "en"): LearningPlanSegment {
  const ar = language === "ar";
  return { startDay: 1, endDay: 1, days: [{ dayNumber: 1, title: ar ? "اليوم الأول" : "Day one", tasks: [{ orderIndex: 1, title: ar ? "مهمة عربية" : "English task", description: ar ? "وصف عربي" : "English description", estimatedMinutes: 30, quizQuestions: [1, 2, 3].map((number) => ({ id: `q${number}`, prompt: ar ? `سؤال عربي ${number}` : `English question ${number}`, options: [{ id: "a", text: ar ? "إجابة صحيحة" : "Correct answer" }, { id: "b", text: ar ? "إجابة خاطئة" : "Wrong answer" }], answerId: "a", explanation: ar ? "تفسير عربي" : "English explanation" })) }] }] };
}

async function main() {
  const user = await learningDb.createLocalUser({ username: `localized_storage_${Date.now()}`, passwordHash: "verification-only" });
  try {
    const goalId = await learningDb.createGoal(user.id, { title: "Language verification", currentLevel: "beginner", dailyMinutes: 30, targetDurationDays: 1 });
    const planId = await learningDb.saveDraftPlan({ userId: user.id, goalId, draft: arabicOutline, curriculumBlueprint: blueprint, contentLanguage: "ar", aiModel: "test", promptVersion: "test" });
    await learningDb.savePlanSegment({ userId: user.id, planId, segment: segment("ar") });
    await learningDb.approvePlan(user.id, goalId);
    await learningDb.savePlanLocalization({ userId: user.id, planId, language: "en", outline: englishOutline, segments: [segment("en")], aiModel: "test", promptVersion: "test" });
    await learningDb.setUserLanguage(user.id, "en");
    const current = await learningDb.getCurrentTask(user.id);
    if (!current || current.task.title !== "English task") throw new Error("Localized task was not returned.");
    const quiz = await learningDb.beginQuiz(user.id, current.task.id);
    const db = await learningDb.getDb();
    const canonical = db ? await db.select({ title: tasks.title, questions: quizzes.questions }).from(tasks).innerJoin(quizzes, eq(quizzes.taskId, tasks.id)).where(eq(tasks.id, current.task.id)).limit(1) : [];
    if (quiz.task.description !== "English description" || quiz.questions[0]?.prompt !== "English question 1" || canonical[0]?.title !== "مهمة عربية" || canonical[0]?.questions[0]?.prompt !== "سؤال عربي 1") throw new Error("Localized view replaced canonical learning content.");
    console.log(JSON.stringify({ storedLocalizationVerified: true, localizedTask: current.task.title, canonicalTask: canonical[0]?.title, questionId: quiz.questions[0]?.id }));
  } finally {
    const db = await learningDb.getDb();
    if (db) await db.delete(users).where(eq(users.id, user.id));
  }
}

void main().then(() => process.exit(0), (error) => { console.error(error); process.exit(1); });
