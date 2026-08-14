import { generatePlanOutline, generatePlanSegment } from "../server/learning-ai";

const goal = {
  title: "تحسين مهارة المحادثة باللغة الإنجليزية",
  currentLevel: "beginner" as const,
  dailyMinutes: 30,
  targetDurationDays: 7,
  language: "ar" as const,
};

async function main() {
  const outline = await generatePlanOutline(goal);
  const segment = await generatePlanSegment({ goal, outline, startDay: 1, endDay: 7 });
  console.log(JSON.stringify({
    outlineDays: outline.days.length,
    segmentDays: segment.days.length,
    tasks: segment.days.reduce((count, day) => count + day.tasks.length, 0),
    questions: segment.days.reduce((count, day) => count + day.tasks.reduce((taskCount, task) => taskCount + task.quizQuestions.length, 0), 0),
  }));
}

void main();
