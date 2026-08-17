import { translatePlanOutline, translatePlanSegment } from "../server/learning-ai";
import type { LearningPlanOutline, LearningPlanSegment } from "../shared/learning";

const sourceOutline: LearningPlanOutline = {
  title: "خطة أساسيات المحادثة", summary: "خطة تحقق قصيرة", totalDurationDays: 1, dailyMinutes: 30,
  days: [{ dayNumber: 1, title: "التحيات", focus: "تدرب على التحيات والتعريف بالنفس" }],
};
const sourceSegment: LearningPlanSegment = {
  startDay: 1, endDay: 1,
  days: [{ dayNumber: 1, title: "التحيات", tasks: [{
    orderIndex: 1, title: "تدريب التحيات", description: "اقرأ أمثلة التحية ثم كررها بصوت مرتفع.", estimatedMinutes: 30,
    quizQuestions: [1, 2, 3].map((number) => ({ id: `q${number}`, prompt: `سؤال التحقق ${number}`, options: [{ id: "a", text: "إجابة صحيحة" }, { id: "b", text: "إجابة خاطئة" }], answerId: "a", explanation: "تفسير قصير" })),
  }] }],
};

async function main() {
  const [outline, segment] = await Promise.all([
    translatePlanOutline({ source: sourceOutline, targetLanguage: "en" }),
    translatePlanSegment({ source: sourceSegment, targetLanguage: "en" }),
  ]);
  const sourceQuestion = sourceSegment.days[0]?.tasks[0]?.quizQuestions[0];
  const localizedQuestion = segment.days[0]?.tasks[0]?.quizQuestions[0];
  const text = [outline.title, outline.summary, segment.days[0]?.tasks[0]?.title, localizedQuestion?.prompt, ...(localizedQuestion?.options.map((option) => option.text) ?? [])].join(" ");
  if (!sourceQuestion || !localizedQuestion || localizedQuestion.id !== sourceQuestion.id || localizedQuestion.answerId !== sourceQuestion.answerId || localizedQuestion.options.map((option) => option.id).join() !== sourceQuestion.options.map((option) => option.id).join() || segment.days[0]?.tasks[0]?.estimatedMinutes !== sourceSegment.days[0]?.tasks[0]?.estimatedMinutes || !/[A-Za-z]/.test(text) || /[\u0600-\u06FF]/.test(text)) {
    throw new Error("Localized Gemini response changed protected structure or did not produce English text.");
  }
  console.log(JSON.stringify({ localizedViewVerified: true, questionId: localizedQuestion.id, answerId: localizedQuestion.answerId, title: outline.title }));
}

void main().catch((error) => { console.error(error); process.exit(1); });
