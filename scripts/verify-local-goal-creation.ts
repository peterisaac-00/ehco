import { eq } from "drizzle-orm";
import { users } from "../drizzle/schema";
import { getDb } from "../server/db";
import { appRouter } from "../server/routers";

const username = `goalverify_${Date.now()}`;
const password = "GoalCreation-2026";

async function main() {
  const publicCtx = { user: null, req: { headers: {}, protocol: "https" }, res: {} } as any;
  const publicCaller = appRouter.createCaller(publicCtx);
  let openId = "";
  try {
    const registered = await publicCaller.auth.register({ username, password });
    openId = registered.user.openId;
    const protectedCaller = appRouter.createCaller({ ...publicCtx, user: registered.user });
    const created = await protectedCaller.goals.create({ title: "Learn Python", currentLevel: "beginner", dailyMinutes: 30, targetDurationDays: 7 });
    const active = await protectedCaller.goals.active();
    let duplicateMessage = "";
    try {
      await protectedCaller.goals.create({ title: "Second goal", currentLevel: "beginner", dailyMinutes: 30, targetDurationDays: 7 });
    } catch (error) {
      duplicateMessage = error instanceof Error ? error.message : String(error);
    }
    if (!created.goalId || active?.id !== created.goalId || !duplicateMessage.includes("يوجد هدف نشط")) {
      throw new Error("Goal creation or active-goal conflict handling failed.");
    }
    console.log(JSON.stringify({ createdGoal: true, activeGoal: true, friendlyConflict: true }));
  } finally {
    const db = await getDb();
    if (db && openId) await db.delete(users).where(eq(users.openId, openId));
  }
}

void main().then(() => process.exit(0), (error) => { console.error(error); process.exit(1); });
