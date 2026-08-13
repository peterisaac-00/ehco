import { eq } from "drizzle-orm";
import { planSegments, users } from "../drizzle/schema";
import * as learningDb from "../server/db";
import type { LearningPlanOutline, LearningPlanSegment } from "../shared/learning";

const suffix = Date.now();
const outline: LearningPlanOutline = { title: "Safe draft", summary: "Original summary", totalDurationDays: 1, dailyMinutes: 30, days: [{ dayNumber: 1, title: "Original day", focus: "Original focus" }] };
const segment: LearningPlanSegment = { startDay: 1, endDay: 1, days: [{ dayNumber: 1, title: "Original day", tasks: [{ orderIndex: 1, title: "Original task", description: "Original description", estimatedMinutes: 30, quizQuestions: [1, 2, 3].map((number) => ({ id: `q${number}`, prompt: `Question ${number}`, options: [{ id: "a", text: "Correct" }, { id: "b", text: "Wrong" }], answerId: "a", explanation: "Reason" })) }] }] };

async function main() {
  const owner = await learningDb.createLocalUser({ username: `editowner_${suffix}`, passwordHash: "verification" });
  const other = await learningDb.createLocalUser({ username: `editother_${suffix}`, passwordHash: "verification" });
  try {
    const goalId = await learningDb.createGoal(owner.id, { title: "Edit safety", currentLevel: "beginner", dailyMinutes: 30, targetDurationDays: 1 });
    const planId = await learningDb.saveDraftPlan({ userId: owner.id, goalId, draft: outline, aiModel: "test", promptVersion: "test" });
    await learningDb.savePlanEdit({ userId: owner.id, planId, userInput: "Invalid request", decision: "rejected", reason: "Rejected safely" });
    const afterRejection = await learningDb.getPlanById(owner.id, planId);
    const db = await learningDb.getDb();
    if (!afterRejection || afterRejection.plan.draftJson.summary !== "Original summary") throw new Error("Rejected edit changed the draft.");
    let unauthorizedBlocked = false;
    try { await learningDb.savePlanEdit({ userId: other.id, planId, userInput: "Steal plan", decision: "rejected", reason: "Test" }); } catch { unauthorizedBlocked = true; }
    await learningDb.savePlanSegment({ userId: owner.id, planId, segment });
    await learningDb.approvePlan(owner.id, goalId);
    let approvedBlocked = false;
    try { await learningDb.savePlanEdit({ userId: owner.id, planId, userInput: "Too late", decision: "rejected", reason: "Test" }); } catch { approvedBlocked = true; }
    const savedSegments = db ? await db.select().from(planSegments).where(eq(planSegments.planId, planId)) : [];
    if (!unauthorizedBlocked || !approvedBlocked || savedSegments.length !== 1) throw new Error("Edit ownership, approved-plan protection, or segment integrity failed.");
    console.log(JSON.stringify({ rejectedEditPreservedDraft: true, unauthorizedEditBlocked: true, approvedPlanEditBlocked: true }));
  } finally {
    const db = await learningDb.getDb();
    if (db) {
      await db.delete(users).where(eq(users.openId, owner.openId));
      await db.delete(users).where(eq(users.openId, other.openId));
    }
  }
}

void main().then(() => process.exit(0), (error) => { console.error(error); process.exit(1); });

