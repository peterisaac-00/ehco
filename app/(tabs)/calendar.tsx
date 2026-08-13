import { router } from "expo-router";
import { useMemo } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { PrimaryButton } from "@/components/primary-button";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";

type CalendarTask = { id: number; dayNumber: number; orderIndex: number; status: "locked" | "unlocked" | "in_quiz" | "completed"; title: string | null; estimatedMinutes: number | null; completedAt: Date | null };
type CalendarDay = { dayNumber: number; tasks: CalendarTask[] };

export default function CalendarScreen() {
  const { isAuthenticated } = useAuth();
  const calendar = trpc.calendar.get.useQuery(undefined, { enabled: isAuthenticated });
  const days = useMemo<CalendarDay[]>(() => {
    const grouped = new Map<number, CalendarTask[]>();
    for (const task of calendar.data?.days ?? []) {
      grouped.set(task.dayNumber, [...(grouped.get(task.dayNumber) ?? []), task]);
    }
    return [...grouped.entries()].map(([dayNumber, tasks]) => ({ dayNumber, tasks })).sort((a, b) => a.dayNumber - b.dayNumber);
  }, [calendar.data?.days]);

  if (!isAuthenticated) return <CalendarEmpty title="سجّل الدخول أولًا" copy="سجّل الدخول لتشاهد تقويم تقدمك وتتابع مهامك." action="تسجيل الدخول" onPress={() => router.push("/login")} />;
  if (calendar.isLoading) return <ScreenContainer className="items-center justify-center"><ActivityIndicator color="#4F46E5" size="large" /></ScreenContainer>;
  if (calendar.isError) return <CalendarEmpty title="تعذر تحميل التقويم" copy="تحقق من الاتصال ثم حاول مرة أخرى." action="إعادة المحاولة" onPress={() => void calendar.refetch()} />;
  if (!calendar.data) return <CalendarEmpty title="لا يوجد هدف نشط" copy="ابدأ بهدف واحد، وسيظهر تقدمك اليومي هنا." action="إعداد الهدف" onPress={() => router.push("/onboarding")} />;
  if (!calendar.data.plan || calendar.data.plan.status !== "approved") return <CalendarEmpty title="الخطة في انتظار الاعتماد" copy="أنشئ مسودة خطتك وراجعها، ثم اعتمدها لفتح تقويم المهام." action="فتح الخطة" onPress={() => router.push("/(tabs)/plan")} />;
  if (days.length === 0) return <CalendarEmpty title="تُجهَّز المهام" copy="لا توجد مهام جاهزة للعرض بعد. عد إلى الخطة للتحقق من الدفعة الأولى." action="فتح الخطة" onPress={() => router.push("/(tabs)/plan")} />;

  const completedDays = days.filter((day) => day.tasks.every((task) => task.status === "completed")).length;
  return (
    <ScreenContainer className="px-5">
      <FlatList
        data={days}
        keyExtractor={(day) => String(day.dayNumber)}
        contentContainerStyle={styles.content}
        ListHeaderComponent={<View style={styles.header}><Text style={styles.eyebrow}>تقويم التقدم</Text><Text style={styles.title}>{calendar.data.goal.title}</Text><Text style={styles.copy}>أنجزت {completedDays} من {days.length} يومًا جاهزًا. المهمة المتاحة هي خطوتك التالية.</Text></View>}
        renderItem={({ item }) => <DayCard day={item} />}
      />
    </ScreenContainer>
  );
}

function DayCard({ day }: { day: CalendarDay }) {
  const isCompleted = day.tasks.every((task) => task.status === "completed");
  const current = day.tasks.find((task) => task.status === "unlocked" || task.status === "in_quiz");
  const state = isCompleted ? "completed" : current ? "current" : "locked";
  const mainTask = current ?? day.tasks[0];
  const stateCopy = state === "completed" ? "مكتمل" : state === "current" ? "متاح الآن" : "مقفل";
  const icon = state === "completed" ? "✓" : state === "current" ? "▶" : "🔒";
  const content = <View style={styles.cardContent}><View style={[styles.dayBadge, state === "completed" && styles.dayBadgeCompleted, state === "current" && styles.dayBadgeCurrent]}><Text style={[styles.dayBadgeText, state !== "locked" && styles.dayBadgeTextActive]}>{day.dayNumber}</Text></View><View style={styles.copyWrap}><View style={styles.cardTopline}><Text style={[styles.state, state === "completed" && styles.completedText, state === "current" && styles.currentText]}>{icon} {stateCopy}</Text><Text style={styles.dayLabel}>اليوم {day.dayNumber}</Text></View><Text style={styles.taskTitle}>{mainTask.title ?? "مهمة اليوم محفوظة حتى تُفتح"}</Text>{state === "current" && <Text style={styles.taskMeta}>{mainTask.status === "in_quiz" ? "الاختبار جاهز للإكمال" : `${mainTask.estimatedMinutes ?? 0} دقيقة تقريبًا`}</Text>}</View></View>;
  if (!current) return <View style={[styles.card, state === "locked" && styles.lockedCard]}>{content}</View>;
  return <Pressable onPress={() => router.push({ pathname: "/quiz/[taskId]", params: { taskId: String(current.id) } })} style={({ pressed }) => [styles.card, styles.currentCard, pressed && styles.pressed]}>{content}</Pressable>;
}

function CalendarEmpty({ title, copy, action, onPress }: { title: string; copy: string; action: string; onPress: () => void }) {
  return <ScreenContainer className="p-5"><View style={styles.empty}><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.copy}>{copy}</Text><PrimaryButton label={action} onPress={onPress} /></View></ScreenContainer>;
}

const styles = StyleSheet.create({
  content: { paddingTop: 14, paddingBottom: 32, gap: 10 },
  header: { gap: 6, paddingBottom: 12 },
  eyebrow: { color: "#4F46E5", fontSize: 13, fontWeight: "800", textAlign: "right" },
  title: { color: "#0F172A", fontSize: 28, fontWeight: "800", textAlign: "right" },
  copy: { color: "#64748B", fontSize: 15, lineHeight: 23, textAlign: "right" },
  card: { borderRadius: 18, borderWidth: 1, borderColor: "#E2E8F0", backgroundColor: "#FFFFFF", padding: 15 },
  currentCard: { borderColor: "#818CF8", backgroundColor: "#F5F3FF" },
  lockedCard: { backgroundColor: "#F8FAFC", borderColor: "#E2E8F0" },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  cardContent: { flexDirection: "row-reverse", gap: 12, alignItems: "center" },
  copyWrap: { flex: 1, gap: 4 },
  cardTopline: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  dayLabel: { color: "#0F172A", fontSize: 15, fontWeight: "800", textAlign: "right" },
  state: { color: "#64748B", fontSize: 12, fontWeight: "700" },
  completedText: { color: "#047857" },
  currentText: { color: "#4338CA" },
  taskTitle: { color: "#334155", fontSize: 14, lineHeight: 21, textAlign: "right" },
  taskMeta: { color: "#4F46E5", fontSize: 12, fontWeight: "700", textAlign: "right" },
  dayBadge: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#E2E8F0", alignItems: "center", justifyContent: "center" },
  dayBadgeCurrent: { backgroundColor: "#4F46E5" },
  dayBadgeCompleted: { backgroundColor: "#059669" },
  dayBadgeText: { color: "#475569", fontSize: 15, fontWeight: "800" },
  dayBadgeTextActive: { color: "#FFFFFF" },
  empty: { flex: 1, justifyContent: "center", gap: 16 },
  emptyTitle: { color: "#0F172A", fontSize: 24, fontWeight: "800", textAlign: "right" },
});
