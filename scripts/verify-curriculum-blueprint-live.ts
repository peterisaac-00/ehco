import { eq } from "drizzle-orm";
import { users } from "../drizzle/schema";
import { curriculumBlueprintSchema, planOutlineSchema, planSegmentSchema } from "../shared/learning";
import * as learningDb from "../server/db";
import { generateCurriculumBlueprint, generatePlanOutline, generatePlanSegment } from "../server/learning-ai";

const goal = {
  title: "أريد تعلم الإنجليزية للمحادثات اليومية بثقة",
  currentLevel: "beginner" as const,
  dailyMinutes: 30,
  targetDurationDays: 1,
  language: "ar" as const,
};

async function main() {
  const blueprint = await generateCurriculumBlueprint(goal);
  const outline = await generatePlanOutline(goal, blueprint);
  const segment = await generatePlanSegment({ goal, outline, curriculumBlueprint: blueprint, startDay: 1, endDay: 1 });

  if (!curriculumBlueprintSchema.safeParse(blueprint).success) throw new Error("Blueprint schema validation failed.");
  if (!planOutlineSchema.safeParse(outline).success) throw new Error("Outline schema validation failed.");
  if (!planSegmentSchema.safeParse(segment).success) throw new Error("Segment schema validation failed.");
  if (segment.days.some((day) => day.tasks.reduce((sum, task) => sum + task.estimatedMinutes, 0) > goal.dailyMinutes)) {
    throw new Error("Generated segment exceeds the daily time budget.");
  }

  const suffix = Date.now();
  const owner = await learningDb.createLocalUser({ username: `blueprintverify_${suffix}`, passwordHash: "verification" });
  let blueprintPersisted = false;
  try {
    const goalId = await learningDb.createGoal(owner.id, { title: goal.title, currentLevel: goal.currentLevel, dailyMinutes: goal.dailyMinutes, targetDurationDays: goal.targetDurationDays });
    const planId = await learningDb.saveDraftPlan({ userId: owner.id, goalId, draft: outline, curriculumBlueprint: blueprint, aiModel: "verification", promptVersion: "verification" });
    const saved = await learningDb.getPlanById(owner.id, planId);
    const persisted = curriculumBlueprintSchema.safeParse(saved?.plan.curriculumJson);
    blueprintPersisted = persisted.success
      && persisted.data.domain === blueprint.domain
      && persisted.data.targetCapabilities.length === blueprint.targetCapabilities.length
      && persisted.data.progressionPrinciples.length === blueprint.progressionPrinciples.length;
    if (!blueprintPersisted) throw new Error("Blueprint persistence verification failed.");
  } finally {
    const db = await learningDb.getDb();
    if (db) await db.delete(users).where(eq(users.id, owner.id));
  }

  console.log(JSON.stringify({
    blueprintDomain: blueprint.domain,
    capabilityCount: blueprint.targetCapabilities.length,
    outlineDays: outline.days.length,
    firstDay: outline.days[0]?.title,
    firstTask: segment.days[0]?.tasks[0]?.title,
    quizCount: segment.days[0]?.tasks[0]?.quizQuestions.length,
    blueprintPersisted,
    validated: true,
  }));
}

void main().then(() => process.exit(0), (error) => {
  console.error(error);
  process.exit(1);
});
