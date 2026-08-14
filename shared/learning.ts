import { z } from "zod";

export const LEARNING_LIMITS = {
  minDailyMinutes: 30,
  maxDailyMinutes: 480,
  minDurationDays: 1,
  maxDurationDays: 150,
  planSegmentDays: 7,
  maxTasksPerDay: 8,
  maxPlanTasks: 500,
  passingScore: 70,
  maxPlanGenerations: 3,
  maxPlanEdits: 10,
  maxStudyWorkloadMinutes: 72_000,
} as const;

export const currentLevelSchema = z.enum(["beginner", "intermediate", "advanced"]);
export const contentLanguageSchema = z.enum(["ar", "en"]);
export type ContentLanguage = z.infer<typeof contentLanguageSchema>;

export const createGoalInputSchema = z.object({
  title: z.string().trim().min(3, "اكتب هدفًا من 3 أحرف على الأقل.").max(160),
  currentLevel: currentLevelSchema,
  dailyMinutes: z.number().int().min(LEARNING_LIMITS.minDailyMinutes).max(LEARNING_LIMITS.maxDailyMinutes),
  targetDurationDays: z.number().int().min(LEARNING_LIMITS.minDurationDays).max(LEARNING_LIMITS.maxDurationDays),
});

export const planBoundsInputSchema = z.object({
  dailyMinutes: z.number().int().min(LEARNING_LIMITS.minDailyMinutes).max(LEARNING_LIMITS.maxDailyMinutes),
  durationDays: z.number().int().min(LEARNING_LIMITS.minDurationDays).max(LEARNING_LIMITS.maxDurationDays),
});

export type StudyBounds = {
  minDurationDays: number;
  maxDurationDays: number;
  totalEstimatedMinutes: number;
};

export function calculateStudyBounds(totalEstimatedMinutes: number): StudyBounds {
  if (!Number.isInteger(totalEstimatedMinutes) || totalEstimatedMinutes < LEARNING_LIMITS.minDailyMinutes || totalEstimatedMinutes > LEARNING_LIMITS.maxStudyWorkloadMinutes) {
    throw new Error("حجم العمل التقديري للخطة غير صالح.");
  }
  return {
    totalEstimatedMinutes,
    minDurationDays: Math.max(LEARNING_LIMITS.minDurationDays, Math.ceil(totalEstimatedMinutes / LEARNING_LIMITS.maxDailyMinutes)),
    maxDurationDays: Math.min(LEARNING_LIMITS.maxDurationDays, Math.ceil(totalEstimatedMinutes / LEARNING_LIMITS.minDailyMinutes)),
  };
}

export function validateStudyBounds(input: z.infer<typeof planBoundsInputSchema>, totalEstimatedMinutes: number): { valid: true; bounds: StudyBounds } | { valid: false; reason: string; bounds: StudyBounds } {
  const parsed = planBoundsInputSchema.safeParse(input);
  const bounds = calculateStudyBounds(totalEstimatedMinutes);
  if (!parsed.success) return { valid: false, reason: "قيمة الوقت اليومي أو المدة خارج الحدود المسموحة.", bounds };
  if (input.durationDays < bounds.minDurationDays || input.durationDays > bounds.maxDurationDays) {
    return { valid: false, reason: `المدة المناسبة لهذا الحمل بين ${bounds.minDurationDays} و${bounds.maxDurationDays} يومًا.`, bounds };
  }
  const capacity = input.dailyMinutes * input.durationDays;
  if (capacity < totalEstimatedMinutes) {
    return { valid: false, reason: "الوقت اليومي والمدة لا يكفيان لإكمال حجم التعلم الحالي.", bounds };
  }
  if (capacity > Math.ceil(totalEstimatedMinutes * 1.25)) {
    return { valid: false, reason: "الوقت اليومي والمدة أكبر بكثير من حجم التعلم الحالي. قلّل أحدهما.", bounds };
  }
  return { valid: true, bounds };
}

export const quizOptionSchema = z.object({
  id: z.string().min(1).max(80),
  text: z.string().min(1).max(500),
});

export const quizQuestionSchema = z.object({
  id: z.string().min(1).max(80),
  prompt: z.string().min(1).max(1_000),
  options: z.array(quizOptionSchema).min(2).max(6),
  answerId: z.string().min(1).max(80),
  explanation: z.string().min(1).max(1_000),
});

export const taskDraftSchema = z.object({
  orderIndex: z.number().int().min(1).max(LEARNING_LIMITS.maxTasksPerDay),
  title: z.string().min(1).max(180),
  description: z.string().min(1).max(4_000),
  estimatedMinutes: z.number().int().min(5).max(480),
  quizQuestions: z.array(quizQuestionSchema).min(3).max(10),
});

export const planDayDraftSchema = z.object({
  dayNumber: z.number().int().min(1).max(LEARNING_LIMITS.maxDurationDays),
  title: z.string().min(1).max(180),
  tasks: z.array(taskDraftSchema).min(1).max(LEARNING_LIMITS.maxTasksPerDay),
});

export const planOutlineDaySchema = z.object({
  dayNumber: z.number().int().min(1).max(LEARNING_LIMITS.maxDurationDays),
  title: z.string().min(1).max(180),
  focus: z.string().min(1).max(500),
});

export const planOutlineSchema = z.object({
  title: z.string().min(1).max(180),
  summary: z.string().min(1).max(2_000),
  totalDurationDays: z.number().int().min(LEARNING_LIMITS.minDurationDays).max(LEARNING_LIMITS.maxDurationDays),
  dailyMinutes: z.number().int().min(LEARNING_LIMITS.minDailyMinutes).max(LEARNING_LIMITS.maxDailyMinutes),
  days: z.array(planOutlineDaySchema).min(1).max(LEARNING_LIMITS.maxDurationDays),
}).superRefine((plan, context) => {
  if (plan.days.length !== plan.totalDurationDays) {
    context.addIssue({ code: "custom", message: "عدد الأيام لا يطابق مدة الخطة." });
  }
  for (const [index, day] of plan.days.entries()) {
    if (day.dayNumber !== index + 1) {
      context.addIssue({ code: "custom", message: "ترتيب أيام الخطة غير صالح.", path: ["days", index, "dayNumber"] });
    }
  }
});

export const planSegmentSchema = z.object({
  startDay: z.number().int().min(1).max(LEARNING_LIMITS.maxDurationDays),
  endDay: z.number().int().min(1).max(LEARNING_LIMITS.maxDurationDays),
  days: z.array(planDayDraftSchema).min(1).max(LEARNING_LIMITS.planSegmentDays),
}).superRefine((segment, context) => {
  if (segment.endDay < segment.startDay) {
    context.addIssue({ code: "custom", message: "نطاق دفعة الخطة غير صالح." });
  }
  if (segment.days.length !== segment.endDay - segment.startDay + 1) {
    context.addIssue({ code: "custom", message: "عدد أيام الدفعة لا يطابق نطاقها." });
  }
  const taskCount = segment.days.reduce((total, day) => total + day.tasks.length, 0);
  if (taskCount > LEARNING_LIMITS.maxPlanTasks) {
    context.addIssue({ code: "custom", message: "دفعة الخطة تحتوي مهام أكثر من الحد المسموح." });
  }
  for (const [index, day] of segment.days.entries()) {
    if (day.dayNumber !== segment.startDay + index) {
      context.addIssue({ code: "custom", message: "ترتيب أيام الدفعة غير صالح.", path: ["days", index, "dayNumber"] });
    }
    for (const task of day.tasks) {
      const taskPosition = day.tasks.indexOf(task) + 1;
      if (task.orderIndex !== taskPosition) {
        context.addIssue({ code: "custom", message: "ترتيب مهام اليوم غير صالح." });
      }
      if (task.quizQuestions.some((question) => !question.options.some((option) => option.id === question.answerId))) {
        context.addIssue({ code: "custom", message: "إجابة أحد أسئلة الاختبار لا تطابق أي خيار." });
      }
    }
  }
});

export const planEditInputSchema = z.object({
  planId: z.number().int().positive(),
  request: z.string().trim().min(4, "اشرح التعديل المطلوب بصورة أوضح.").max(1_500),
});

export const submitQuizInputSchema = z.object({
  taskId: z.number().int().positive(),
  answers: z.array(z.object({ questionId: z.string().min(1).max(80), optionId: z.string().min(1).max(80) })).min(1).max(10),
});

export function createPlanSegments(totalDurationDays: number) {
  const segments: Array<{ startDay: number; endDay: number }> = [];
  for (let startDay = 1; startDay <= totalDurationDays; startDay += LEARNING_LIMITS.planSegmentDays) {
    segments.push({
      startDay,
      endDay: Math.min(startDay + LEARNING_LIMITS.planSegmentDays - 1, totalDurationDays),
    });
  }
  return segments;
}

export function calculateQuizScore(
  questions: Array<Pick<QuizQuestion, "id" | "answerId">>,
  answers: Array<{ questionId: string; optionId: string }>,
) {
  const submitted = new Map(answers.map((answer) => [answer.questionId, answer.optionId]));
  const correct = questions.filter((question) => submitted.get(question.id) === question.answerId).length;
  return Math.round((correct / questions.length) * 100);
}

export function varyQuizQuestions(questions: QuizQuestion[], attemptNumber: number) {
  if (questions.length === 0) return [];
  const offset = attemptNumber % questions.length;
  return questions.map((_, index) => questions[(index + offset) % questions.length]).map((question, questionIndex) => {
    const optionOffset = (attemptNumber + questionIndex) % question.options.length;
    const options = question.options.map((_, index) => question.options[(index + optionOffset) % question.options.length]);
    const { answerId: _answerId, explanation: _explanation, ...safeQuestion } = question;
    return { ...safeQuestion, options };
  });
}

export type CurrentLevel = z.infer<typeof currentLevelSchema>;
export type CreateGoalInput = z.infer<typeof createGoalInputSchema>;
export type LearningPlanOutline = z.infer<typeof planOutlineSchema>;
export type LearningPlanSegment = z.infer<typeof planSegmentSchema>;
export type QuizQuestion = z.infer<typeof quizQuestionSchema>;
