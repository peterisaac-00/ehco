import { generatePlanSegment } from "../server/learning-ai";
import type { ContentLanguage, CurriculumBlueprint, LearningPlanOutline } from "../shared/learning";

const outline: LearningPlanOutline = {
  title: "English speaking foundations",
  summary: "A one-day verification outline.",
  totalDurationDays: 1,
  dailyMinutes: 30,
  days: [{ dayNumber: 1, title: "Essential greetings", focus: "Practice common greetings and introductions." }],
};

const blueprint: CurriculumBlueprint = {
  domain: "English communication",
  learnerStartingPoint: "Beginner",
  targetCapabilities: ["Use common greetings"],
  progressionPrinciples: ["Move from recognition to guided production"],
  practiceApproach: ["Short active recall and spoken practice"],
  reviewStrategy: "Retrieve the key phrases after a short delay.",
  assessmentApproach: "Check practical use of the phrases.",
  pacingGuidance: "Keep one achievable objective within thirty minutes.",
  avoid: ["Mixed-language learner-facing content"],
};

function learnerText(segment: Awaited<ReturnType<typeof generatePlanSegment>>) {
  return segment.days.flatMap((day) => day.tasks.flatMap((task) => [
    task.title,
    task.description,
    ...task.quizQuestions.flatMap((question) => [question.prompt, question.explanation, ...question.options.map((option) => option.text)]),
  ])).join(" ");
}

async function verify(language: ContentLanguage) {
  const segment = await generatePlanSegment({
    goal: {
      title: "Learn practical English speaking from the beginning",
      currentLevel: "beginner",
      dailyMinutes: 30,
      targetDurationDays: 1,
      language,
    },
    outline,
    curriculumBlueprint: blueprint,
    startDay: 1,
    endDay: 1,
  });
  const text = learnerText(segment);
  const hasArabic = /[\u0600-\u06FF]/.test(text);
  const hasLatin = /[A-Za-z]/.test(text);
  if ((language === "ar" && !hasArabic) || (language === "en" && !hasLatin)) {
    throw new Error(`Gemini did not return expected ${language} learner-visible content.`);
  }
  return { language, questions: segment.days[0]?.tasks[0]?.quizQuestions.length ?? 0, hasArabic, hasLatin };
}

Promise.all([verify("ar"), verify("en")])
  .then((results) => console.log(JSON.stringify({ contentLanguageVerified: true, results })))
  .catch((error) => { console.error(error); process.exit(1); });
