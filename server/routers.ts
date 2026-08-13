import { COOKIE_NAME } from "../shared/const.js";
import { createGoalInputSchema, planEditInputSchema, submitQuizInputSchema } from "../shared/learning";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { generatePlanOutline, generatePlanSegment, LEARNING_MODEL, PROMPT_VERSION, revisePlanOutline } from "./learning-ai";
import { logServerError } from "./observability";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as learningDb from "./db";

const goalIdSchema = z.object({ goalId: z.number().int().positive() });
const taskIdSchema = z.object({ taskId: z.number().int().positive() });

export const appRouter = router({
  system: systemRouter,
  health: publicProcedure.query(() => ({ status: "ok" as const, service: "ehco-api" })),
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
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
        const goal = await learningDb.getGoalById(ctx.user.id, input.goalId);
        if (!goal) throw new TRPCError({ code: "NOT_FOUND", message: "الهدف المطلوب غير موجود." });

        const existing = await learningDb.getPlanForGoal(ctx.user.id, input.goalId);
        if (existing && existing.plan.generationCount >= 3) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "تم بلوغ الحد الأقصى لإعادة إنشاء هذه الخطة." });
        }

        const outline = await generatePlanOutline(goal);
        const planId = await learningDb.saveDraftPlan({
          userId: ctx.user.id,
          goalId: input.goalId,
          draft: outline,
          aiModel: LEARNING_MODEL,
          promptVersion: PROMPT_VERSION,
        });
        const reservation = await learningDb.reserveSegmentGeneration(ctx.user.id, planId, 1);
        if (reservation.state === "reserved") {
          const segment = await generatePlanSegment({
            goal: reservation.goal,
            outline,
            startDay: reservation.segment.startDay,
            endDay: reservation.segment.endDay,
          });
          await learningDb.savePlanSegment({ userId: ctx.user.id, planId, segment });
        }
        return { planId, outline, firstSegmentReady: true };
      } catch (error) {
        throw toTrpcError(error);
      }
    }),
    generateSegment: protectedProcedure
      .input(z.object({ planId: z.number().int().positive(), startDay: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        try {
          const reservation = await learningDb.reserveSegmentGeneration(ctx.user.id, input.planId, input.startDay);
          if (reservation.state === "generated") return { alreadyGenerated: true };
          const segment = await generatePlanSegment({
            goal: reservation.goal,
            outline: reservation.plan.draftJson,
            startDay: reservation.segment.startDay,
            endDay: reservation.segment.endDay,
          });
          await learningDb.savePlanSegment({ userId: ctx.user.id, planId: input.planId, segment });
          return { alreadyGenerated: false };
        } catch (error) {
          throw toTrpcError(error);
        }
      }),
    edit: protectedProcedure.input(planEditInputSchema).mutation(async ({ ctx, input }) => {
      try {
        const record = await learningDb.getPlanById(ctx.user.id, input.planId);
        if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "مسودة الخطة غير موجودة." });
        const draft = await revisePlanOutline({ goal: record.goal, currentOutline: record.plan.draftJson, request: input.request });
        await learningDb.savePlanEdit({
          userId: ctx.user.id,
          planId: input.planId,
          userInput: input.request,
          decision: "accepted",
          reason: "تم تعديل بنية المسار دون تغيير الهدف أو حدوده.",
          draft,
        });
        const reservation = await learningDb.reserveSegmentGeneration(ctx.user.id, input.planId, 1);
        if (reservation.state === "reserved") {
          const segment = await generatePlanSegment({
            goal: reservation.goal,
            outline: draft,
            startDay: reservation.segment.startDay,
            endDay: reservation.segment.endDay,
          });
          await learningDb.savePlanSegment({ userId: ctx.user.id, planId: input.planId, segment });
        }
        return { planId: input.planId, outline: draft };
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
          const reservation = await learningDb.reserveSegmentGeneration(ctx.user.id, result.planId, result.nextSegmentStartDay);
          if (reservation.state === "reserved") {
            const segment = await generatePlanSegment({
              goal: reservation.goal,
              outline: reservation.plan.draftJson,
              startDay: reservation.segment.startDay,
              endDay: reservation.segment.endDay,
            });
            await learningDb.savePlanSegment({ userId: ctx.user.id, planId: result.planId, segment });
          }
          const unlocked = await learningDb.unlockSegmentStart(ctx.user.id, result.planId, result.nextSegmentStartDay);
          return { ...result, nextTaskUnlocked: unlocked, nextSegmentPrepared: true };
        } catch (generationError) {
          logServerError("learning.next_segment_generation_failed", generationError, { planId: result.planId, userId: ctx.user.id });
          return { ...result, nextSegmentPrepared: false };
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
  if (error instanceof learningDb.LearningStateError) {
    return new TRPCError({ code: "PRECONDITION_FAILED", message: error.message });
  }
  logServerError("learning.operation_failed", error);
  return new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر إتمام العملية. حاول مرة أخرى." });
}
