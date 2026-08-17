import { asc, eq } from "drizzle-orm";
import { tasks, users } from "../drizzle/schema";
import * as learningDb from "../server/db";
import type { LearningPlanOutline, LearningPlanSegment } from "../shared/learning";

const username = `segmentverify_${Date.now()}`;
const userInput = { username, passwordHash: "verification-only" };

function questions(day: number) {
  return [1, 2, 3].map((number) => ({ id: `d${day}q${number}`, prompt: `Question ${number}`, options: [{ id: "a", text: "Correct" }, { id: "b", text: "Wrong" }], answerId: "a", explanation: "Verified" }));
}

function segment(startDay: number, endDay: number): LearningPlanSegment {
  return {
    startDay,
    endDay,
    days: Array.from({ length: endDay - startDay + 1 }, (_, index) => {
      const dayNumber = startDay + index;
      return { dayNumber, title: `Day ${dayNumber}`, tasks: [{ orderIndex: 1, title: `Task ${dayNumber}`, description: "Verification task", estimatedMinutes: 30, quizQuestions: questions(dayNumber) }] };
    }),
  };
}

async function main() {
  const user = await learningDb.createLocalUser(userInput);
  const otherUser = await learningDb.createLocalUser({ username: `segmentother_${Date.now()}`, passwordHash: "verification-only" });
  try {
    const goalId = await learningDb.createGoal(user.id, { title: "Segment verification", currentLevel: "beginner", dailyMinutes: 30, targetDurationDays: 8 });
    const outline: LearningPlanOutline = { title: "Verification", summary: "Eight days", totalDurationDays: 8, dailyMinutes: 30, days: Array.from({ length: 8 }, (_, index) => ({ dayNumber: index + 1, title: `Day ${index + 1}`, focus: "Verification" })) };
    const planId = await learningDb.saveDraftPlan({ userId: user.id, goalId, draft: outline, contentLanguage: "en", aiModel: "test", promptVersion: "test" });
    await learningDb.savePlanSegment({ userId: user.id, planId, segment: segment(1, 7) });
    await learningDb.savePlanSegment({ userId: user.id, planId, segment: segment(8, 8) });

    const firstApproval = await learningDb.approvePlan(user.id, goalId);
    const secondApproval = await learningDb.approvePlan(user.id, goalId);
    const db = await learningDb.getDb();
    if (!db) throw new Error("Database unavailable");
    const materialized = await db.select().from(tasks).where(eq(tasks.planId, planId)).orderBy(asc(tasks.dayNumber), asc(tasks.orderIndex));
    if (firstApproval.taskCount !== 8 || secondApproval.taskCount !== 0 || materialized.length !== 8 || materialized[0]?.status !== "unlocked" || materialized.slice(1).some((task) => task.status !== "locked")) {
      throw new Error("Segment materialization was not complete, ordered, or idempotent.");
    }

    let lockedBlocked = false;
    try { await learningDb.beginQuiz(user.id, materialized[1].id); } catch { lockedBlocked = true; }
    let foreignTaskBlocked = false;
    try { await learningDb.beginQuiz(otherUser.id, materialized[0].id); } catch { foreignTaskBlocked = true; }
    const started = await learningDb.beginQuiz(user.id, materialized[0].id);
    const failed = await learningDb.gradeQuiz(user.id, materialized[0].id, started.questions.map((question) => ({ questionId: question.id, optionId: "b" })));
    if (failed.passed) throw new Error("Server accepted a fake quiz result.");
    let current = materialized[0];
    for (let day = 1; day <= 7; day += 1) {
      const quiz = await learningDb.beginQuiz(user.id, current.id);
      const result = await learningDb.gradeQuiz(user.id, current.id, quiz.questions.map((question) => ({ questionId: question.id, optionId: "a" })));
      if (!result.passed) throw new Error("Correct answers did not pass.");
      const refreshed = await db.select().from(tasks).where(eq(tasks.planId, planId)).orderBy(asc(tasks.dayNumber), asc(tasks.orderIndex));
      current = refreshed[day];
    }
    const afterBoundary = await db.select().from(tasks).where(eq(tasks.planId, planId)).orderBy(asc(tasks.dayNumber), asc(tasks.orderIndex));
    const calendar = await learningDb.getCalendar(user.id);
    const calendarStates = new Map(calendar?.days.map((task) => [task.dayNumber, task.status]));
    if (!lockedBlocked || !foreignTaskBlocked || afterBoundary[7]?.status !== "unlocked" || calendar?.days.length !== 8 || calendarStates.get(1) !== "completed" || calendarStates.get(7) !== "completed" || calendarStates.get(8) !== "unlocked") {
      throw new Error("Locked-task protection, cross-segment unlock, or calendar state failed.");
    }
    console.log(JSON.stringify({ allSegmentsMaterialized: true, idempotentApproval: true, lockedTaskBlocked: true, foreignTaskBlocked: true, crossSegmentUnlock: true, calendarReflectsServer: true }));
  } finally {
    const db = await learningDb.getDb();
    if (db) {
      await db.delete(users).where(eq(users.openId, `local:${username}`));
      await db.delete(users).where(eq(users.id, otherUser.id));
    }
  }
}

void main().then(() => process.exit(0), (error) => { console.error(error); process.exit(1); });
