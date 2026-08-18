export type JourneyState = "completed" | "current" | "planned" | "locked";

export type PlanJourneyDay = { dayNumber: number; title: string; focus: string };
export type PlanJourneyTask = { dayNumber: number; status: string };

/** Groups arbitrary-length plans into at most five renderable journey stages. */
export function buildJourneyStages(days: PlanJourneyDay[], calendarTasks: PlanJourneyTask[], isDraft: boolean) {
  if (days.length === 0) return [];

  const stageCount = Math.min(5, days.length);
  const groupSize = Math.ceil(days.length / stageCount);
  const currentTaskDay = calendarTasks.find((task) => task.status === "unlocked" || task.status === "in_quiz")?.dayNumber;

  return Array.from({ length: stageCount }, (_, index) => {
    const group = days.slice(index * groupSize, (index + 1) * groupSize);
    const startDay = group[0].dayNumber;
    const endDay = group[group.length - 1].dayNumber;
    const stageTasks = calendarTasks.filter((task) => task.dayNumber >= startDay && task.dayNumber <= endDay);
    const groupedDays = new Set(stageTasks.map((task) => task.dayNumber));
    const fullyComplete = groupedDays.size === group.length && stageTasks.length > 0 && stageTasks.every((task) => task.status === "completed");
    const current = !isDraft && Boolean(currentTaskDay && currentTaskDay >= startDay && currentTaskDay <= endDay);
    const planned = isDraft && index === 0;
    const state: JourneyState = fullyComplete ? "completed" : current ? "current" : planned ? "planned" : "locked";

    return { id: `${startDay}-${endDay}`, startDay, endDay, title: group[0].title, description: group[0].focus, state };
  });
}
