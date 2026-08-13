import { desc, eq } from "drizzle-orm";
import { goals, planSegments, plans, tasks } from "../drizzle/schema";
import { getDb } from "../server/db";

async function main() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const goal = (await db.select().from(goals).orderBy(desc(goals.createdAt)).limit(1))[0];
  if (!goal) return console.log(JSON.stringify({ goal: null }));
  const plan = (await db.select().from(plans).where(eq(plans.goalId, goal.id)).limit(1))[0] ?? null;
  const segments = plan ? await db.select().from(planSegments).where(eq(planSegments.planId, plan.id)) : [];
  const createdTasks = plan ? await db.select().from(tasks).where(eq(tasks.planId, plan.id)) : [];
  console.log(JSON.stringify({
    goal: { id: goal.id, userId: goal.userId, status: goal.status, title: goal.title },
    plan: plan && { id: plan.id, status: plan.status, duration: plan.totalDurationDays },
    segments: segments.map((segment) => ({ start: segment.startDay, end: segment.endDay, status: segment.status, hasDetail: Boolean(segment.detailJson) })),
    tasks: createdTasks.map((task) => ({ id: task.id, day: task.dayNumber, order: task.orderIndex, status: task.status })),
  }));
}

void main();
