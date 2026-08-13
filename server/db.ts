import { and, asc, eq, gt, inArray, isNull, lt, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { calculateQuizScore, createPlanSegments, LEARNING_LIMITS, type CreateGoalInput, type LearningPlanOutline, type LearningPlanSegment } from "../shared/learning";
import {
  goals,
  planEditRequests,
  planSegments,
  plans,
  quizAttempts,
  quizzes,
  tasks,
  type InsertUser,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export class ActiveGoalConflictError extends Error {
  constructor() {
    super("يوجد هدف نشط بالفعل. أكمل الهدف الحالي أو ألغِه قبل بدء هدف جديد.");
  }
}

export class LearningStateError extends Error {
  constructor(message: string) {
    super(message);
  }
}

/** Lazily create the database client so static tooling still works without a local database. */
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    _db = drizzle(process.env.DATABASE_URL);
  }
  return _db;
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  return db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");

  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId, lastSignedIn: user.lastSignedIn ?? new Date() };
  const updateSet: Record<string, unknown> = { lastSignedIn: values.lastSignedIn };

  for (const field of ["name", "email", "loginMethod"] as const) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  values.role = user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user");
  updateSet.role = values.role;

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function createGoal(userId: number, input: CreateGoalInput) {
  const db = await requireDb();
  try {
    const result = await db.insert(goals).values({
      userId,
      title: input.title,
      currentLevel: input.currentLevel,
      dailyMinutes: input.dailyMinutes,
      targetDurationDays: input.targetDurationDays,
      activeSlot: userId,
    });
    return Number(result[0].insertId);
  } catch (error) {
    if (isDuplicateKey(error)) throw new ActiveGoalConflictError();
    throw error;
  }
}

export async function getActiveGoal(userId: number) {
  const db = await requireDb();
  const result = await db.select().from(goals)
    .where(and(eq(goals.userId, userId), eq(goals.status, "active")))
    .orderBy(asc(goals.createdAt))
    .limit(1);
  return result[0] ?? null;
}

export async function getGoalById(userId: number, goalId: number) {
  const db = await requireDb();
  const result = await db.select().from(goals)
    .where(and(eq(goals.id, goalId), eq(goals.userId, userId)))
    .limit(1);
  return result[0] ?? null;
}

export async function getPlanForGoal(userId: number, goalId: number) {
  const db = await requireDb();
  const result = await db.select({ plan: plans, goal: goals })
    .from(plans)
    .innerJoin(goals, eq(plans.goalId, goals.id))
    .where(and(eq(plans.goalId, goalId), eq(goals.userId, userId)))
    .limit(1);
  return result[0] ?? null;
}

export async function getPlanById(userId: number, planId: number) {
  const db = await requireDb();
  const result = await db.select({ plan: plans, goal: goals }).from(plans)
    .innerJoin(goals, eq(plans.goalId, goals.id))
    .where(and(eq(plans.id, planId), eq(goals.userId, userId)))
    .limit(1);
  return result[0] ?? null;
}

export async function saveDraftPlan(input: {
  userId: number;
  goalId: number;
  draft: LearningPlanOutline;
  aiModel: string;
  promptVersion: string;
}) {
  const db = await requireDb();
  const goal = await getGoalById(input.userId, input.goalId);
  if (!goal || goal.status !== "active") throw new LearningStateError("الهدف المطلوب غير متاح.");

  const existing = await getPlanForGoal(input.userId, input.goalId);
  if (existing?.plan.status === "approved") {
    throw new LearningStateError("لا يمكن تعديل خطة تم اعتمادها.");
  }

  if (existing) {
    await db.transaction(async (tx) => {
      await tx.update(plans).set({
        totalDurationDays: input.draft.totalDurationDays,
        dailyMinutes: input.draft.dailyMinutes,
        draftJson: input.draft,
        aiModel: input.aiModel,
        promptVersion: input.promptVersion,
        generationCount: existing.plan.generationCount + 1,
      }).where(eq(plans.id, existing.plan.id));
      await tx.delete(planSegments).where(eq(planSegments.planId, existing.plan.id));
      await tx.insert(planSegments).values(buildPendingSegments(existing.plan.id, input.draft.totalDurationDays));
    });
    return existing.plan.id;
  }

  const planId = await db.transaction(async (tx) => {
    const result = await tx.insert(plans).values({
      goalId: input.goalId,
      totalDurationDays: input.draft.totalDurationDays,
      dailyMinutes: input.draft.dailyMinutes,
      draftJson: input.draft,
      aiModel: input.aiModel,
      promptVersion: input.promptVersion,
    });
    const id = Number(result[0].insertId);
    await tx.insert(planSegments).values(buildPendingSegments(id, input.draft.totalDurationDays));
    return id;
  });
  return planId;
}

export async function savePlanEdit(input: {
  userId: number;
  planId: number;
  userInput: string;
  decision: "accepted" | "rejected";
  reason: string;
  draft?: LearningPlanOutline;
}) {
  const db = await requireDb();
  const owner = await db.select({ plan: plans, goal: goals }).from(plans)
    .innerJoin(goals, eq(plans.goalId, goals.id))
    .where(and(eq(plans.id, input.planId), eq(goals.userId, input.userId)))
    .limit(1);
  const record = owner[0];
  if (!record || record.plan.status !== "draft") throw new LearningStateError("مسودة الخطة غير متاحة للتعديل.");
  if (record.plan.editCount >= LEARNING_LIMITS.maxPlanEdits) {
    throw new LearningStateError("تم بلوغ الحد الأقصى لتعديلات هذه الخطة.");
  }

  await db.transaction(async (tx) => {
    await tx.insert(planEditRequests).values({
      planId: input.planId,
      userInput: input.userInput,
      decision: input.decision,
      reason: input.reason,
    });

    if (input.decision === "accepted" && input.draft) {
      await tx.update(plans).set({
        draftJson: input.draft,
        totalDurationDays: input.draft.totalDurationDays,
        dailyMinutes: input.draft.dailyMinutes,
        editCount: record.plan.editCount + 1,
      }).where(and(eq(plans.id, input.planId), eq(plans.status, "draft")));
      await tx.delete(planSegments).where(eq(planSegments.planId, input.planId));
      await tx.insert(planSegments).values(buildPendingSegments(input.planId, input.draft.totalDurationDays));
    }
  });
}

export async function savePlanSegment(input: {
  userId: number;
  planId: number;
  segment: LearningPlanSegment;
}) {
  const db = await requireDb();
  return db.transaction(async (tx) => {
    const owner = await tx.select({ plan: plans, segment: planSegments }).from(plans)
      .innerJoin(goals, eq(plans.goalId, goals.id))
      .innerJoin(planSegments, eq(planSegments.planId, plans.id))
      .where(and(
        eq(plans.id, input.planId),
        eq(goals.userId, input.userId),
        eq(planSegments.startDay, input.segment.startDay),
        eq(planSegments.endDay, input.segment.endDay),
      )).limit(1);
    const record = owner[0];
    if (!record) throw new LearningStateError("دفعة الخطة المطلوبة غير موجودة.");
    if (record.segment.status === "generated") return record.segment.id;

    await tx.update(planSegments).set({
      status: "generated",
      detailJson: input.segment,
      generatedAt: new Date(),
      generationStartedAt: null,
    }).where(and(eq(planSegments.id, record.segment.id), eq(planSegments.status, "pending")));

    if (record.plan.status === "approved") {
      await materializeSegment(tx, record.plan.id, input.segment, false);
    }
    return record.segment.id;
  });
}

/** Acquires a short conditional lease before a costly Gemini call for a segment. */
export async function reserveSegmentGeneration(userId: number, planId: number, startDay: number) {
  const db = await requireDb();
  const leaseExpiredBefore = new Date(Date.now() - 2 * 60 * 1000);
  return db.transaction(async (tx) => {
    const rows = await tx.select({ plan: plans, goal: goals, segment: planSegments }).from(plans)
      .innerJoin(goals, eq(plans.goalId, goals.id))
      .innerJoin(planSegments, eq(planSegments.planId, plans.id))
      .where(and(eq(plans.id, planId), eq(goals.userId, userId), eq(planSegments.startDay, startDay)))
      .limit(1);
    const record = rows[0];
    if (!record) throw new LearningStateError("دفعة الخطة المطلوبة غير موجودة.");
    if (record.segment.status === "generated") {
      return { state: "generated" as const, plan: record.plan, goal: record.goal, segment: record.segment };
    }
    if (record.segment.generationAttempts >= LEARNING_LIMITS.maxPlanGenerations) {
      throw new LearningStateError("تم بلوغ الحد الأقصى لمحاولات تجهيز هذه الدفعة.");
    }

    const result = await tx.update(planSegments).set({
      generationAttempts: record.segment.generationAttempts + 1,
      generationStartedAt: new Date(),
    }).where(and(
      eq(planSegments.id, record.segment.id),
      eq(planSegments.status, "pending"),
      or(isNull(planSegments.generationStartedAt), lt(planSegments.generationStartedAt, leaseExpiredBefore)),
    ));
    if (Number(result[0].affectedRows) !== 1) {
      throw new LearningStateError("يجري تجهيز هذه الدفعة بالفعل. حاول بعد لحظات.");
    }
    return { state: "reserved" as const, plan: record.plan, goal: record.goal, segment: record.segment };
  });
}

/** Materializes only the first complete segment atomically after the plan is approved. */
export async function approvePlan(userId: number, goalId: number) {
  const db = await requireDb();

  return db.transaction(async (tx) => {
    const rows = await tx.select({ plan: plans, goal: goals }).from(plans)
      .innerJoin(goals, eq(plans.goalId, goals.id))
      .where(and(eq(plans.goalId, goalId), eq(goals.userId, userId)))
      .limit(1);
    const record = rows[0];
    if (!record) throw new LearningStateError("الخطة المطلوبة غير موجودة.");
    if (record.plan.status !== "draft") throw new LearningStateError("تم اعتماد هذه الخطة مسبقًا.");

    const firstSegment = await tx.select().from(planSegments).where(and(
      eq(planSegments.planId, record.plan.id),
      eq(planSegments.startDay, 1),
      eq(planSegments.status, "generated"),
    )).limit(1);
    const segment = firstSegment[0];
    if (!segment?.detailJson) {
      throw new LearningStateError("تُجهَّز الدفعة الأولى من الخطة الآن. حاول اعتماد الخطة بعد اكتمالها.");
    }

    const taskCount = await materializeSegment(tx, record.plan.id, segment.detailJson, true);

    await tx.update(plans).set({ status: "approved" })
      .where(and(eq(plans.id, record.plan.id), eq(plans.status, "draft")));

    return { planId: record.plan.id, taskCount };
  });
}

export async function getCalendar(userId: number) {
  const db = await requireDb();
  const activeGoal = await getActiveGoal(userId);
  if (!activeGoal) return null;

  const plan = await getPlanForGoal(userId, activeGoal.id);
  if (!plan || plan.plan.status !== "approved") return { goal: activeGoal, plan: plan?.plan ?? null, days: [] };

  const rows = await db.select().from(tasks).where(eq(tasks.planId, plan.plan.id))
    .orderBy(asc(tasks.dayNumber), asc(tasks.orderIndex));
  return {
    goal: activeGoal,
    plan: plan.plan,
    days: rows.map((task) => ({
      id: task.id,
      dayNumber: task.dayNumber,
      orderIndex: task.orderIndex,
      status: task.status,
      title: task.status === "locked" ? null : task.title,
      estimatedMinutes: task.status === "locked" ? null : task.estimatedMinutes,
      completedAt: task.completedAt,
    })),
  };
}

export async function getCurrentTask(userId: number) {
  const db = await requireDb();
  const rows = await db.select({ task: tasks, goal: goals }).from(tasks)
    .innerJoin(plans, eq(tasks.planId, plans.id))
    .innerJoin(goals, eq(plans.goalId, goals.id))
    .where(and(eq(goals.userId, userId), eq(goals.status, "active"), inArray(tasks.status, ["unlocked", "in_quiz"])))
    .orderBy(asc(tasks.dayNumber), asc(tasks.orderIndex))
    .limit(1);
  return rows[0] ?? null;
}

export async function beginQuiz(userId: number, taskId: number) {
  const db = await requireDb();
  const rows = await db.select({ task: tasks, quiz: quizzes }).from(tasks)
    .innerJoin(plans, eq(tasks.planId, plans.id))
    .innerJoin(goals, eq(plans.goalId, goals.id))
    .innerJoin(quizzes, eq(quizzes.taskId, tasks.id))
    .where(and(eq(tasks.id, taskId), eq(goals.userId, userId), eq(goals.status, "active")))
    .limit(1);
  const record = rows[0];
  if (!record) throw new LearningStateError("المهمة المطلوبة غير موجودة.");
  if (record.task.status !== "unlocked" && record.task.status !== "in_quiz") {
    throw new LearningStateError("هذه المهمة غير متاحة للاختبار الآن.");
  }

  if (record.task.status === "unlocked") {
    await db.update(tasks).set({ status: "in_quiz" })
      .where(and(eq(tasks.id, taskId), eq(tasks.status, "unlocked")));
  }

  return {
    task: { id: record.task.id, title: record.task.title, description: record.task.description },
    questions: record.quiz.questions.map(({ answerId: _answerId, explanation: _explanation, ...question }) => question),
  };
}

export async function gradeQuiz(userId: number, taskId: number, answers: Array<{ questionId: string; optionId: string }>) {
  const db = await requireDb();
  return db.transaction(async (tx) => {
    const rows = await tx.select({ task: tasks, quiz: quizzes }).from(tasks)
      .innerJoin(plans, eq(tasks.planId, plans.id))
      .innerJoin(goals, eq(plans.goalId, goals.id))
      .innerJoin(quizzes, eq(quizzes.taskId, tasks.id))
      .where(and(eq(tasks.id, taskId), eq(goals.userId, userId), eq(goals.status, "active")))
      .limit(1);
    const record = rows[0];
    if (!record || record.task.status !== "in_quiz") throw new LearningStateError("الاختبار غير متاح لهذه المهمة.");

    const score = calculateQuizScore(record.quiz.questions, answers);
    const passed = score >= record.quiz.passingThreshold;

    await tx.insert(quizAttempts).values({
      quizId: record.quiz.id,
      userId,
      submittedAnswers: answers,
      score,
      passed,
    });

    if (!passed) {
      await tx.update(tasks).set({ status: "unlocked" })
        .where(and(eq(tasks.id, taskId), eq(tasks.status, "in_quiz")));
      return { score, passed, nextTaskUnlocked: false, isPlanComplete: false, planId: record.task.planId, nextSegmentStartDay: null };
    }

    await tx.update(tasks).set({ status: "completed", completedAt: new Date() })
      .where(and(eq(tasks.id, taskId), eq(tasks.status, "in_quiz")));

    const nextRows = await tx.select().from(tasks).where(and(
      eq(tasks.planId, record.task.planId),
      eq(tasks.status, "locked"),
      or(
        gt(tasks.dayNumber, record.task.dayNumber),
        and(eq(tasks.dayNumber, record.task.dayNumber), gt(tasks.orderIndex, record.task.orderIndex)),
      ),
    )).orderBy(asc(tasks.dayNumber), asc(tasks.orderIndex)).limit(1);
    const nextTask = nextRows[0];
    if (nextTask) {
      await tx.update(tasks).set({ status: "unlocked" })
        .where(and(eq(tasks.id, nextTask.id), eq(tasks.status, "locked")));
    }
    const pendingSegments = !nextTask ? await tx.select({ startDay: planSegments.startDay }).from(planSegments)
      .where(and(eq(planSegments.planId, record.task.planId), eq(planSegments.status, "pending")))
      .orderBy(asc(planSegments.startDay))
      .limit(1) : [];
    const nextSegmentStartDay = pendingSegments[0]?.startDay ?? null;
    return {
      score,
      passed,
      nextTaskUnlocked: Boolean(nextTask),
      isPlanComplete: !nextTask && !nextSegmentStartDay,
      planId: record.task.planId,
      nextSegmentStartDay,
    };
  });
}

/** Opens the first task of a newly generated segment only when its owner has no other open task. */
export async function unlockSegmentStart(userId: number, planId: number, startDay: number) {
  const db = await requireDb();
  return db.transaction(async (tx) => {
    const owned = await tx.select({ id: plans.id }).from(plans).innerJoin(goals, eq(plans.goalId, goals.id))
      .where(and(eq(plans.id, planId), eq(goals.userId, userId))).limit(1);
    if (!owned[0]) throw new LearningStateError("الخطة المطلوبة غير موجودة.");

    const existingOpen = await tx.select({ id: tasks.id }).from(tasks)
      .where(and(eq(tasks.planId, planId), inArray(tasks.status, ["unlocked", "in_quiz"]))).limit(1);
    if (existingOpen[0]) return false;

    const updated = await tx.update(tasks).set({ status: "unlocked" }).where(and(
      eq(tasks.planId, planId),
      eq(tasks.dayNumber, startDay),
      eq(tasks.orderIndex, 1),
      eq(tasks.status, "locked"),
    ));
    return Number(updated[0].affectedRows) === 1;
  });
}

function buildPendingSegments(planId: number, totalDurationDays: number) {
  return createPlanSegments(totalDurationDays).map((segment) => ({ planId, ...segment }));
}

type DatabaseTransaction = Parameters<Parameters<ReturnType<typeof drizzle>["transaction"]>[0]>[0];

async function materializeSegment(
  tx: DatabaseTransaction,
  planId: number,
  segment: LearningPlanSegment,
  unlockFirstTask: boolean,
) {
  const segmentTasks = segment.days.flatMap((day) => day.tasks.map((task) => ({
    planId,
    dayNumber: day.dayNumber,
    orderIndex: task.orderIndex,
    title: task.title,
    description: task.description,
    estimatedMinutes: task.estimatedMinutes,
    status: unlockFirstTask && day.dayNumber === 1 && task.orderIndex === 1
      ? "unlocked" as const
      : "locked" as const,
  })));
  if (segmentTasks.length === 0) return 0;

  const taskIds = await tx.insert(tasks).values(segmentTasks).$returningId();
  const questionsByTask = segment.days.flatMap((day) => day.tasks.map((task) => task.quizQuestions));
  await tx.insert(quizzes).values(taskIds.map((taskId, index) => ({
    taskId: taskId.id,
    questions: questionsByTask[index],
  })));
  return segmentTasks.length;
}

function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && (
    ("code" in error && (error as { code?: string }).code === "ER_DUP_ENTRY") ||
    ("errno" in error && (error as { errno?: number }).errno === 1062)
  );
}
