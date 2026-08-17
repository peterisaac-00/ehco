import { and, asc, eq, gt, inArray, isNull, lt, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { calculateQuizScore, createPlanSegments, LEARNING_LIMITS, validateStudyBounds, varyQuizQuestions, type ContentLanguage, type CreateGoalInput, type CurriculumBlueprint, type LearningPlanOutline, type LearningPlanSegment } from "../shared/learning";
import {
  goals,
  localCredentials,
  planEditRequests,
  planSegments,
  plans,
  quizAttempts,
  quizzes,
  tasks,
  type InsertUser,
  type User,
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

export class LocalAuthConflictError extends Error {
  constructor() {
    super("اسم المستخدم مستخدم بالفعل.");
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

export async function createLocalUser(input: { username: string; passwordHash: string }): Promise<User> {
  const db = await requireDb();
  try {
    return await db.transaction(async (tx) => {
      const inserted = await tx.insert(users).values({
        openId: `local:${input.username}`,
        name: input.username,
        loginMethod: "local",
        lastSignedIn: new Date(),
      }).$returningId();
      const userId = inserted[0]?.id;
      if (!userId) throw new Error("تعذر إنشاء الحساب.");
      await tx.insert(localCredentials).values({ userId, username: input.username, passwordHash: input.passwordHash });
      const created = await tx.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!created[0]) throw new Error("تعذر قراءة الحساب المنشأ.");
      return created[0];
    });
  } catch (error) {
    if (isDuplicateKey(error)) throw new LocalAuthConflictError();
    throw error;
  }
}

export async function getLocalUserByUsername(username: string) {
  const db = await requireDb();
  const rows = await db.select({ user: users, passwordHash: localCredentials.passwordHash })
    .from(localCredentials)
    .innerJoin(users, eq(localCredentials.userId, users.id))
    .where(eq(localCredentials.username, username))
    .limit(1);
  return rows[0] ?? null;
}

export async function markLocalUserSignedIn(userId: number) {
  const db = await requireDb();
  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, userId));
}

/** Returns the account's output language, safely defaulting existing accounts to Arabic. */
export async function getUserLanguage(userId: number): Promise<ContentLanguage> {
  const db = await requireDb();
  const result = await db.select({ preferredLanguage: users.preferredLanguage })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return result[0]?.preferredLanguage ?? "ar";
}

/** Persists a user's language so app UI and future AI content remain consistent across devices. */
export async function setUserLanguage(userId: number, language: ContentLanguage): Promise<ContentLanguage> {
  const db = await requireDb();
  await db.update(users).set({ preferredLanguage: language }).where(eq(users.id, userId));
  return language;
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
  curriculumBlueprint?: CurriculumBlueprint | null;
  contentLanguage?: ContentLanguage;
  aiModel: string;
  promptVersion: string;
}) {
  const db = await requireDb();
  const contentLanguage = input.contentLanguage ?? "ar";
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
        totalEstimatedMinutes: input.draft.totalDurationDays * input.draft.dailyMinutes,
        draftJson: input.draft,
        curriculumJson: input.curriculumBlueprint ?? existing.plan.curriculumJson,
        contentLanguage,
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
      totalEstimatedMinutes: input.draft.totalDurationDays * input.draft.dailyMinutes,
      draftJson: input.draft,
      curriculumJson: input.curriculumBlueprint ?? null,
      contentLanguage,
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
    } else {
      await tx.update(plans).set({ editCount: record.plan.editCount + 1 })
        .where(and(eq(plans.id, input.planId), eq(plans.status, "draft")));
    }
  });
}

export async function updateDraftPlanBounds(input: {
  userId: number;
  planId: number;
  dailyMinutes: number;
  durationDays: number;
  draft: LearningPlanOutline;
}) {
  const db = await requireDb();
  const record = await getPlanById(input.userId, input.planId);
  if (!record || record.plan.status !== "draft") throw new LearningStateError("يمكن تعديل المدة والوقت في المسودة فقط.");
  const workload = record.plan.totalEstimatedMinutes || record.plan.totalDurationDays * record.plan.dailyMinutes;
  const validation = validateStudyBounds({ dailyMinutes: input.dailyMinutes, durationDays: input.durationDays }, workload);
  if (!validation.valid) throw new LearningStateError(validation.reason);
  if (input.draft.dailyMinutes !== input.dailyMinutes || input.draft.totalDurationDays !== input.durationDays) {
    throw new LearningStateError("تفاصيل المسودة لا تطابق المدة أو الوقت المحدد.");
  }

  await db.transaction(async (tx) => {
    await tx.update(plans).set({
      dailyMinutes: input.dailyMinutes,
      totalDurationDays: input.durationDays,
      draftJson: input.draft,
      editCount: record.plan.editCount + 1,
    }).where(and(eq(plans.id, input.planId), eq(plans.status, "draft")));
    await tx.update(goals).set({ dailyMinutes: input.dailyMinutes, targetDurationDays: input.durationDays })
      .where(and(eq(goals.id, record.goal.id), eq(goals.userId, input.userId), eq(goals.status, "active")));
    await tx.delete(planSegments).where(eq(planSegments.planId, input.planId));
    await tx.insert(planSegments).values(buildPendingSegments(input.planId, input.durationDays));
  });
  return { workload, bounds: validation.bounds };
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
      generationFailedAt: null,
      generationFailureReason: null,
    }).where(and(eq(planSegments.id, record.segment.id), eq(planSegments.status, "pending")));

    if (record.plan.status === "approved") {
      await materializeSegment(tx, record.plan.id, input.segment, false);
    }
    return record.segment.id;
  });
}

/** Persists a recoverable failure after a reserved Gemini generation attempt. */
export async function markSegmentGenerationFailed(userId: number, planId: number, startDay: number, error: unknown) {
  const db = await requireDb();
  const owned = await getPlanById(userId, planId);
  if (!owned) throw new LearningStateError("الخطة المطلوبة غير موجودة.");
  const message = error instanceof Error ? error.message : "تعذر تجهيز الدفعة التالية.";
  await db.update(planSegments).set({
    generationStartedAt: null,
    generationFailedAt: new Date(),
    generationFailureReason: message.slice(0, 500),
  }).where(and(
    eq(planSegments.planId, planId),
    eq(planSegments.startDay, startDay),
    eq(planSegments.status, "pending"),
  ));
}

export async function getFailedPlanSegments(userId: number, planId: number) {
  const db = await requireDb();
  const rows = await db.select({
    startDay: planSegments.startDay,
    endDay: planSegments.endDay,
    generationAttempts: planSegments.generationAttempts,
    failureReason: planSegments.generationFailureReason,
    failedAt: planSegments.generationFailedAt,
  }).from(planSegments)
    .innerJoin(plans, eq(planSegments.planId, plans.id))
    .innerJoin(goals, eq(plans.goalId, goals.id))
    .where(and(eq(planSegments.planId, planId), eq(goals.userId, userId), eq(planSegments.status, "pending")));
  return rows.filter((segment) => Boolean(segment.failedAt));
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

export async function approvePlan(userId: number, goalId: number) {
  const db = await requireDb();

  return db.transaction(async (tx) => {
    const rows = await tx.select({ plan: plans, goal: goals }).from(plans)
      .innerJoin(goals, eq(plans.goalId, goals.id))
      .where(and(eq(plans.goalId, goalId), eq(goals.userId, userId)))
      .limit(1);
    const record = rows[0];
    if (!record) throw new LearningStateError("الخطة المطلوبة غير موجودة.");
    const generatedSegments = await tx.select().from(planSegments).where(and(
      eq(planSegments.planId, record.plan.id),
      eq(planSegments.status, "generated"),
    )).orderBy(asc(planSegments.startDay));
    const firstSegment = generatedSegments.find((segment) => segment.startDay === 1);
    if (!firstSegment?.detailJson) {
      throw new LearningStateError("تُجهَّز الدفعة الأولى من الخطة الآن. حاول اعتماد الخطة بعد اكتمالها.");
    }

    let taskCount = 0;
    for (const segment of generatedSegments) {
      if (!segment.detailJson) continue;
      taskCount += await materializeSegment(tx, record.plan.id, segment.detailJson, segment.startDay === 1);
    }

    if (record.plan.status === "draft") {
      await tx.update(plans).set({ status: "approved" })
        .where(and(eq(plans.id, record.plan.id), eq(plans.status, "draft")));
    }

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

/**
 * Returns the active plan together with generated segment ranges so all stored
 * learner-visible content can be rebuilt in the account's selected language.
 */
export async function getActivePlanLanguageSnapshot(userId: number) {
  const db = await requireDb();
  const activeGoal = await getActiveGoal(userId);
  if (!activeGoal) return null;
  const record = await getPlanForGoal(userId, activeGoal.id);
  if (!record) return null;
  const segments = await db.select().from(planSegments)
    .where(and(eq(planSegments.planId, record.plan.id), eq(planSegments.status, "generated")))
    .orderBy(asc(planSegments.startDay));
  const hasActiveQuiz = (await db.select({ id: tasks.id }).from(tasks).where(and(
    eq(tasks.planId, record.plan.id),
    eq(tasks.status, "in_quiz"),
  )).limit(1)).length > 0;
  return { ...record, generatedSegments: segments, hasActiveQuiz };
}

/**
 * Atomically replaces generated learner-visible content in a new language while
 * preserving task progress, attempt history, and the plan's segment structure.
 */
export async function replacePlanLocalizedContent(input: {
  userId: number;
  planId: number;
  language: ContentLanguage;
  outline: LearningPlanOutline;
  curriculumBlueprint: CurriculumBlueprint;
  generatedSegments: LearningPlanSegment[];
  aiModel: string;
  promptVersion: string;
}) {
  const db = await requireDb();
  return db.transaction(async (tx) => {
    const owner = await tx.select({ plan: plans, goal: goals }).from(plans)
      .innerJoin(goals, eq(plans.goalId, goals.id))
      .where(and(eq(plans.id, input.planId), eq(goals.userId, input.userId), eq(goals.status, "active")))
      .limit(1);
    const record = owner[0];
    if (!record) throw new LearningStateError("الخطة المطلوبة غير متاحة.");

    const activeQuiz = await tx.select({ id: tasks.id }).from(tasks).where(and(
      eq(tasks.planId, input.planId),
      eq(tasks.status, "in_quiz"),
    )).limit(1);
    if (activeQuiz.length > 0) {
      throw new LearningStateError("أكمل الاختبار المفتوح أو أعده قبل تغيير لغة المحتوى.");
    }

    const storedSegments = await tx.select().from(planSegments).where(and(
      eq(planSegments.planId, input.planId),
      eq(planSegments.status, "generated"),
    ));
    const expectedRanges = new Set(storedSegments.map((segment) => `${segment.startDay}:${segment.endDay}`));
    const replacementRanges = new Set(input.generatedSegments.map((segment) => `${segment.startDay}:${segment.endDay}`));
    if (expectedRanges.size !== replacementRanges.size || [...expectedRanges].some((range) => !replacementRanges.has(range))) {
      throw new LearningStateError("تفاصيل اللغة الجديدة لا تطابق الدفعات المحفوظة للخطة.");
    }

    await tx.update(plans).set({
      draftJson: input.outline,
      curriculumJson: input.curriculumBlueprint,
      contentLanguage: input.language,
      aiModel: input.aiModel,
      promptVersion: input.promptVersion,
    }).where(eq(plans.id, input.planId));

    const storedTasks = await tx.select().from(tasks).where(eq(tasks.planId, input.planId));
    const tasksBySequence = new Map(storedTasks.map((task) => [`${task.dayNumber}:${task.orderIndex}`, task]));
    for (const segment of input.generatedSegments) {
      await tx.update(planSegments).set({ detailJson: segment, generatedAt: new Date() })
        .where(and(eq(planSegments.planId, input.planId), eq(planSegments.startDay, segment.startDay), eq(planSegments.endDay, segment.endDay)));
      for (const day of segment.days) {
        for (const generatedTask of day.tasks) {
          const storedTask = tasksBySequence.get(`${day.dayNumber}:${generatedTask.orderIndex}`);
          if (!storedTask) continue;
          await tx.update(tasks).set({
            title: generatedTask.title,
            description: generatedTask.description,
            estimatedMinutes: generatedTask.estimatedMinutes,
          }).where(eq(tasks.id, storedTask.id));
          await tx.update(quizzes).set({ questions: generatedTask.quizQuestions })
            .where(eq(quizzes.taskId, storedTask.id));
        }
      }
    }
  });
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

  const attempts = await db.select({ id: quizAttempts.id }).from(quizAttempts)
    .where(and(eq(quizAttempts.quizId, record.quiz.id), eq(quizAttempts.userId, userId)));
  return {
    task: { id: record.task.id, title: record.task.title, description: record.task.description },
    questions: varyQuizQuestions(record.quiz.questions, attempts.length),
    attemptNumber: attempts.length + 1,
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

    const incompleteEarlierTask = await tx.select({ id: tasks.id }).from(tasks).where(and(
      eq(tasks.planId, planId),
      lt(tasks.dayNumber, startDay),
      or(eq(tasks.status, "locked"), eq(tasks.status, "unlocked"), eq(tasks.status, "in_quiz")),
    )).limit(1);
    if (incompleteEarlierTask[0]) return false;
    const pendingEarlierSegment = await tx.select({ id: planSegments.id }).from(planSegments).where(and(
      eq(planSegments.planId, planId),
      lt(planSegments.startDay, startDay),
      eq(planSegments.status, "pending"),
    )).limit(1);
    if (pendingEarlierSegment[0]) return false;

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
    quizQuestions: task.quizQuestions,
  })));
  if (segmentTasks.length === 0) return 0;

  const existing = await tx.select({ dayNumber: tasks.dayNumber, orderIndex: tasks.orderIndex }).from(tasks).where(and(
    eq(tasks.planId, planId),
    inArray(tasks.dayNumber, [...new Set(segment.days.map((day) => day.dayNumber))]),
  ));
  const existingSequences = new Set(existing.map((task) => `${task.dayNumber}:${task.orderIndex}`));
  const missingTasks = segmentTasks.filter((task) => !existingSequences.has(`${task.dayNumber}:${task.orderIndex}`));
  if (missingTasks.length === 0) return 0;

  const taskIds = await tx.insert(tasks).values(missingTasks.map(({ quizQuestions: _quizQuestions, ...task }) => task)).$returningId();
  await tx.insert(quizzes).values(taskIds.map((taskId, index) => ({
    taskId: taskId.id,
    questions: missingTasks[index].quizQuestions,
  })));
  return missingTasks.length;
}

function isDuplicateKey(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth += 1) {
    const candidate = current as { code?: string; errno?: number; message?: string; cause?: unknown };
    if (candidate.code === "ER_DUP_ENTRY" || candidate.errno === 1062 || /duplicate entry|er_dup_entry/i.test(candidate.message ?? "")) {
      return true;
    }
    current = candidate.cause;
  }
  return false;
}
