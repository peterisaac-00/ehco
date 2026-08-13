import { and, eq } from "drizzle-orm";
import { goals, users } from "../drizzle/schema";
import { getDb } from "../server/db";

async function main() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const user = (await db.select().from(users).where(eq(users.openId, "local:peterisaac")).limit(1))[0];
  const userGoals = user ? await db.select().from(goals).where(eq(goals.userId, user.id)) : [];
  const activeSlotMatches = user ? await db.select().from(goals).where(and(eq(goals.activeSlot, user.id), eq(goals.status, "active"))) : [];
  console.log(JSON.stringify({ user, userGoals, activeSlotMatches }));
}

void main().then(() => process.exit(0), (error) => { console.error(error); process.exit(1); });
