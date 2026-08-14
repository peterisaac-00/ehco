import { COOKIE_NAME } from "../shared/const.js";
import { contentLanguageSchema, createGoalInputSchema, planBoundsInputSchema, planEditInputSchema, submitQuizInputSchema, validateStudyBounds } from "../shared/learning";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { generatePlanOutline, generatePlanSegment, LEARNING_MODEL, PROMPT_VERSION, regeneratePlanOutlineForBounds, revisePlanOutline } from "./learning-ai";
import { hashPassword, normalizeUsername, verifyPassword } from "./local-auth";
import { logServerError } from "./observability";
import { sdk } from "./_core/sdk";
import { consumeRateLimit } from "./rate-limit";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as learningDb from "./db";

const goalIdSchema = z.object({ goalId: z.number().int().positive() });
const taskIdSchema = z.object({ taskId: z.number().int().positive() });
const segmentInputSchema = z.object({ planId: z.number().int().positive(), startDay: z.number().int().positive() });
const planBoundsMutationSchema = planBoundsInputSchema.extend({ planId: z.number().int().positive() });
const localAuthInputSchema = z.object({
  username: z.string().trim().min(3, "اسم المستخدم يجب أن يحتوي ثلاثة أحرف على الأقل.").max(32).regex(/^[a-zA-Z0-9_]+$/, "استخدم حروفًا إنجليزية أو أرقامًا أو _ فقط."),
  password: z.string().min(8, "كلمة المرور يجب أن تحتوي ثمانية أحرف على الأقل.").max(128),
});

function enforceRateLimit(scope: string, key: string, limit: number, windowMs: number) {
  const result = consumeRateLimit({ scope, key, limit, windowMs });
  if (!result.allowed) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: `حاول مجددًا بعد ${result.retryAfterSeconds} ثانية.` });
}

function requestIdentity(req: { ip?: string; headers: Record<string, string | string[] | undefined> }) {
  const forwarded = req.headers["x-forwarded-for"];
  const firstForwarded = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0];
  return firstForwarded?.trim() || req.ip || "unknown";
}

async function preparePlanSegment(userId: number, planId: number, startDay: number) {
  const reservation = await learningDb.reserveSegmentGeneration(userId, planId, startDay);
  if (reservation.state === "generated") return { alreadyGenerated: true, startDay: reservation.segment.startDay };
  const language = await learningDb.getUserLanguage(userId);
  const segment = await generatePlanSegment({
    goal: { ...reservation.goal, language },
    outline: reservation.plan.draftJson,
    startDay: reservation.segment.startDay,
    endDay: reservation.segment.endDay,
  });
  await learningDb.savePlanSegment({ userId, planId, segment });
  return { alreadyGenerated: false, startDay: reservation.segment.startDay };
}

export const appRouter = router({
  system: systemRouter,
  health: publicProcedure.query(() => ({ status: "ok" as const, service: "ehco-api" })),
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    register: publicProcedure.input(localAuthInputSchema).mutation(async ({ ctx, input }) => {
      try {
        enforceRateLimit("auth.register", requestIdentity(ctx.req), 5, 15 * 60 * 1000);
        const username = normalizeUsername(input.username);
        const user = await learningDb.createLocalUser({ username, passwordHash: await hashPassword(input.password) });
        const sessionToken = await sdk.createSessionToken(user.openId, { name: user.name ?? username });
        return { sessionToken, user };
      } catch (error) {
        throw toTrpcError(error);
      }
    }),
    login: publicProcedure.input(localAuthInputSchema).mutation(async ({ ctx, input }) => {
      try {
        enforceRateLimit("auth.login", `${requestIdentity(ctx.req)}:${normalizeUsername(input.username)}`, 10, 15 * 60 * 1000);
        const username = normalizeUsername(input.username);
        const account = await learningDb.getLocalUserByUsername(username);
        if (!account || !(await verifyPassword(input.password, account.passwordHash))) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "اسم المستخدم أو كلمة المرور غير صحيحان." });
        }
        await learningDb.markLocalUserSignedIn(account.user.id);
        const sessionToken = await sdk.createSessionToken(account.user.openId, { name: account.user.name ?? username });
        return { sessionToken, user: account.user };
      } catch (error) {
        throw toTrpcError(error);
      }
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  preferences: router({
    language: protectedProcedure.query(({ ctx }) => learningDb.getUserLanguage(ctx.user.id)),
    setLanguage: protectedProcedure.input(contentLanguageSchema).mutation(async ({ ctx, input }) => ({
      language: await learningDb.setUserLanguage(ctx.user.id, input),
    })),
  }),
  goals: router({
    active: protectedProcedure.query(({ ctx }) => learningDb.getActiveGoal(ctx.user.id)),
    create: protectedProcedure.input(createGoalInputSchema).mutation(async ({ ctx, input }) => {
      try {
        const goalId = await learningDb.createGoal(ctx.user.id, input);
        return { goalId };
      } catch (error) {
        throw toTrpcError(error);
      }
    }),
  }),
  plans: router({
    getForGoal: protectedProcedure.input(goalIdSchema).query(async ({ ctx, input }) => {
      const plan = await learningDb.getPlanForGoal(ctx.user.id, input.goalId);
      return plan?.plan ?? null;
    }),
    approve: protectedProcedure.input(goalIdSchema).mutation(async ({ ctx, input }) => {
      try {
        return await learningDb.approvePlan(ctx.user.id, input.goalId);
      } catch (error) {
        throw toTrpcError(error);
      }
    }),
    generateInitial: protectedProcedure.input(goalIdSchema).mutation(async ({ ctx, input }) => {
      try {
        enforceRateLimit("plans.generate", String(ctx.user.id), 4, 10 * 60 * 1000);
        const goal = await learningDb.getGoalById(ctx.user.id, input.goalId);
        if (!goal) throw new TRPCError({ code: "NOT_FOUND", message: "الهدف المطلوب غير موجود." });

        const existing = await learningDb.getPlanForGoal(ctx.user.id, input.goalId);
        if (existing && existing.plan.generationCount >= 3) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "تم بلوغ الحد الأقصى لإعادة إنشاء هذه الخطة." });
        }

        const language = await learningDb.getUserLanguage(ctx.user.id);
        const outline = await generatePlanOutline({ ...goal, language });
        const planId = await learningDb.saveDraftPlan({
          userId: ctx.user.id,
          goalId: input.goalId,
          draft: outline,
          aiModel: LEARNING_MODEL,
          promptVersion: PROMPT_VERSION,
        });
        try {
          await preparePlanSegment(ctx.user.id, planId, 1);
          return { planId, outline, firstSegmentReady: true, firstSegmentFailed: false };
        } catch (segmentError) {
          await learningDb.markSegmentGenerationFailed(ctx.user.id, planId, 1, segmentError);
          logServerError("learning.initial_segment_generation_failed", segmentError, { planId, userId: ctx.user.id });
          return { planId, outline, firstSegmentReady: false, firstSegmentFailed: true };
        }
      } catch (error) {
        throw toTrpcError(error);
      }
    }),
    generateSegment: protectedProcedure
      .input(segmentInputSchema)
      .mutation(async ({ ctx, input }) => {
        try {
          enforceRateLimit("plans.segment", String(ctx.user.id), 12, 10 * 60 * 1000);
          return await preparePlanSegment(ctx.user.id, input.planId, input.startDay);
        } catch (error) {
          await learningDb.markSegmentGenerationFailed(ctx.user.id, input.planId, input.startDay, error).catch(() => undefined);
          throw toTrpcError(error);
        }
      }),
    retrySegment: protectedProcedure.input(segmentInputSchema).mutation(async ({ ctx, input }) => {
      try {
        enforceRateLimit("plans.segment_retry", String(ctx.user.id), 4, 10 * 60 * 1000);
        const result = await preparePlanSegment(ctx.user.id, input.planId, input.startDay);
        const nextTaskUnlocked = await learningDb.unlockSegmentStart(ctx.user.id, input.planId, result.startDay);
        return { ...result, nextTaskUnlocked };
      } catch (error) {
        await learningDb.markSegmentGenerationFailed(ctx.user.id, input.planId, input.startDay, error).catch(() => undefined);
        throw toTrpcError(error);
      }
    }),
    failedSegments: protectedProcedure.input(z.object({ planId: z.number().int().positive() })).query(({ ctx, input }) =>
      learningDb.getFailedPlanSegments(ctx.user.id, input.planId),
    ),
    edit: protectedProcedure.input(planEditInputSchema).mutation(async ({ ctx, input }) => {
      try {
        enforceRateLimit("plans.edit", String(ctx.user.id), 10, 30 * 60 * 1000);
        const record = await learningDb.getPlanById(ctx.user.id, input.planId);
        if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "مسودة الخطة غير موجودة." });
        if (record.plan.status !== "draft") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "لا يمكن تعديل خطة تم اعتمادها." });
        const language = await learningDb.getUserLanguage(ctx.user.id);
        const revision = await revisePlanOutline({ goal: { ...record.goal, language }, currentOutline: record.plan.draftJson, request: input.request });
        await learningDb.savePlanEdit({
          userId: ctx.user.id,
          planId: input.planId,
          userInput: input.request,
          decision: revision.decision,
          reason: revision.reason,
          draft: revision.decision === "accepted" ? revision.outline : undefined,
        });
        if (revision.decision === "rejected") return { planId: input.planId, decision: revision.decision, reason: revision.reason, outline: record.plan.draftJson };
        const reservation = await learningDb.reserveSegmentGeneration(ctx.user.id, input.planId, 1);
        if (reservation.state === "reserved") {
          const segment = await generatePlanSegment({
            goal: { ...reservation.goal, language },
            outline: revision.outline,
            startDay: reservation.segment.startDay,
            endDay: reservation.segment.endDay,
          });
          await learningDb.savePlanSegment({ userId: ctx.user.id, planId: input.planId, segment });
        }
        return { planId: input.planId, decision: revision.decision, reason: revision.reason, outline: revision.outline };
      } catch (error) {
        throw toTrpcError(error);
      }
    }),
    updateBounds: protectedProcedure.input(planBoundsMutationSchema).mutation(async ({ ctx, input }) => {
      try {
        enforceRateLimit("plans.bounds", String(ctx.user.id), 10, 30 * 60 * 1000);
        const record = await learningDb.getPlanById(ctx.user.id, input.planId);
        if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "مسودة الخطة غير موجودة." });
        if (record.plan.status !== "draft") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "لا يمكن تعديل خطة تم اعتمادها." });
        const workload = record.plan.totalEstimatedMinutes || record.plan.totalDurationDays * record.plan.dailyMinutes;
        const validation = validateStudyBounds(input, workload);
        if (!validation.valid) throw new TRPCError({ code: "PRECONDITION_FAILED", message: validation.reason });
        const language = await learningDb.getUserLanguage(ctx.user.id);
        const outline = await regeneratePlanOutlineForBounds({
          goal: { ...record.goal, language },
          currentOutline: record.plan.draftJson,
          dailyMinutes: input.dailyMinutes,
          durationDays: input.durationDays,
        });
        const result = await learningDb.updateDraftPlanBounds({
          userId: ctx.user.id,
          planId: input.planId,
          dailyMinutes: input.dailyMinutes,
          durationDays: input.durationDays,
          draft: outline,
        });
        try {
          await preparePlanSegment(ctx.user.id, input.planId, 1);
          return { outline, bounds: result.bounds, firstSegmentReady: true, firstSegmentFailed: false };
        } catch (segmentError) {
          await learningDb.markSegmentGenerationFailed(ctx.user.id, input.planId, 1, segmentError);
          logServerError("learning.bounds_first_segment_generation_failed", segmentError, { planId: input.planId, userId: ctx.user.id });
          return { outline, bounds: result.bounds, firstSegmentReady: false, firstSegmentFailed: true };
        }
      } catch (error) {
        throw toTrpcError(error);
      }
    }),
  }),
  calendar: router({
    get: protectedProcedure.query(({ ctx }) => learningDb.getCalendar(ctx.user.id)),
  }),
  tasks: router({
    current: protectedProcedure.query(({ ctx }) => learningDb.getCurrentTask(ctx.user.id)),
    beginQuiz: protectedProcedure.input(taskIdSchema).mutation(async ({ ctx, input }) => {
      try {
        return await learningDb.beginQuiz(ctx.user.id, input.taskId);
      } catch (error) {
        throw toTrpcError(error);
      }
    }),
    submitQuiz: protectedProcedure.input(submitQuizInputSchema).mutation(async ({ ctx, input }) => {
      try {
        const result = await learningDb.gradeQuiz(ctx.user.id, input.taskId, input.answers);
        if (!result.passed || !result.nextSegmentStartDay) return { ...result, nextSegmentPrepared: false };
        try {
          await preparePlanSegment(ctx.user.id, result.planId, result.nextSegmentStartDay);
          const unlocked = await learningDb.unlockSegmentStart(ctx.user.id, result.planId, result.nextSegmentStartDay);
          return { ...result, nextTaskUnlocked: unlocked, nextSegmentPrepared: true, nextSegmentFailed: false };
        } catch (generationError) {
          await learningDb.markSegmentGenerationFailed(ctx.user.id, result.planId, result.nextSegmentStartDay, generationError);
          logServerError("learning.next_segment_generation_failed", generationError, { planId: result.planId, userId: ctx.user.id });
          return { ...result, nextSegmentPrepared: false, nextSegmentFailed: true };
        }
      } catch (error) {
        throw toTrpcError(error);
      }
    }),
  }),
});

export type AppRouter = typeof appRouter;

function toTrpcError(error: unknown): TRPCError {
  if (error instanceof TRPCError) return error;
  if (error instanceof learningDb.ActiveGoalConflictError) {
    return new TRPCError({ code: "CONFLICT", message: error.message });
  }
  if (error instanceof learningDb.LocalAuthConflictError) {
    return new TRPCError({ code: "CONFLICT", message: error.message });
  }
  if (error instanceof learningDb.LearningStateError) {
    return new TRPCError({ code: "PRECONDITION_FAILED", message: error.message });
  }
  logServerError("learning.operation_failed", error);
  return new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر إتمام العملية. حاول مرة أخرى." });
}
