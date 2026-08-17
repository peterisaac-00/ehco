import { eq } from "drizzle-orm";
import { quizzes, tasks, users } from "../drizzle/schema";
import * as learningDb from "../server/db";
import { synchronizeActivePlanLanguage } from "../server/content-language-sync";
import type { CurriculumBlueprint, LearningPlanOutline, LearningPlanSegment } from "../shared/learning";

const blueprint: CurriculumBlueprint = { domain: "language", learnerStartingPoint: "a beginner learner", targetCapabilities: ["recognize greetings", "use greetings", "respond briefly"], progressionPrinciples: ["simple to applied", "active recall", "guided practice"], practiceApproach: ["read", "speak", "retrieve"], reviewStrategy: "review the greeting after a short delay", assessmentApproach: "choose the suitable greeting", pacingGuidance: "one small daily objective", avoid: ["mixed learner language", "unrelated content"] };
const arabicOutline: LearningPlanOutline = { title: "خطة التحيات", summary: "خطة عربية قصيرة", totalDurationDays: 1, dailyMinutes: 30, days: [{ dayNumber: 1, title: "التحيات", focus: "التدرب على التحية" }] };
const arabicSegment: LearningPlanSegment = { startDay: 1, endDay: 1, days: [{ dayNumber: 1, title: "التحيات", tasks: [{ orderIndex: 1, title: "تدريب التحيات", description: "اقرأ التحيات وتدرب على نطقها.", estimatedMinutes: 30, quizQuestions: [1, 2, 3].map((number) => ({ id: `q${number}`, prompt: `سؤال التحيات ${number}`, options: [{ id: "a", text: "إجابة صحيحة" }, { id: "b", text: "إجابة خاطئة" }], answerId: "a", explanation: "تفسير عربي" })) }] }] };

async function main() {
  const user = await learningDb.createLocalUser({ username: `localized_switch_${Date.now()}`, passwordHash: "verification-only" });
  try {
    const goalId = await learningDb.createGoal(user.id, { title: "Learn English greetings", currentLevel: "beginner", dailyMinutes: 30, targetDurationDays: 1 });
    const planId = await learningDb.saveDraftPlan({ userId: user.id, goalId, draft: arabicOutline, curriculumBlueprint: blueprint, contentLanguage: "ar", aiModel: "test", promptVersion: "test" });
    await learningDb.savePlanSegment({ userId: user.id, planId, segment: arabicSegment });
    await learningDb.approvePlan(user.id, goalId);
    const firstSwitch = await synchronizeActivePlanLanguage(user.id, "en");
    const englishCurrent = await learningDb.getCurrentTask(user.id);
    const db = await learningDb.getDb();
    const canonical = db && englishCurrent ? await db.select({ title: tasks.title, questions: quizzes.questions }).from(tasks).innerJoin(quizzes, eq(quizzes.taskId, tasks.id)).where(eq(tasks.id, englishCurrent.task.id)).limit(1) : [];
    const secondSwitch = await synchronizeActivePlanLanguage(user.id, "ar");
    const arabicCurrent = await learningDb.getCurrentTask(user.id);
    const englishText = englishCurrent ? `${englishCurrent.task.title} ${englishCurrent.task.description}` : "";
    if (!englishCurrent || firstSwitch.localized !== true || !/[A-Za-z]/.test(englishText) || /[\u0600-\u06FF]/.test(englishText) || canonical[0]?.title !== "تدريب التحيات" || canonical[0]?.questions[0]?.id !== "q1" || secondSwitch.localized !== false || arabicCurrent?.task.title !== "تدريب التحيات") {
      throw new Error("Language switch did not preserve a stable canonical plan and localized view.");
    }
    console.log(JSON.stringify({ liveSwitchVerified: true, firstSwitch, secondSwitch, canonicalTask: canonical[0]?.title, englishTask: englishCurrent.task.title }));
  } finally {
    const db = await learningDb.getDb();
    if (db) await db.delete(users).where(eq(users.id, user.id));
  }
}

void main().then(() => process.exit(0), (error) => { console.error(error); process.exit(1); });
