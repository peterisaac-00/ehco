import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router, useNavigation } from "expo-router";
import { type ComponentProps, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/hooks/use-auth";
import { isDailyReminderEnabled } from "@/lib/daily-reminder";
import { useDirectionalStyles } from "@/lib/directional-styles";
import { useLanguage } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";

const COLORS = {
  ivory: "#FDF9F4",
  cream: "#F7EDE0",
  forest: "#254631",
  forestMuted: "#46604D",
  sage: "#A8B39E",
  sageLight: "#E6E7D8",
  warmGray: "#8D8B7C",
  border: "#EDE4D8",
  card: "#FFFDF9",
  future: "#F3F1EA",
  error: "#A25E3E",
} as const;

const HERO_ILLUSTRATION = "/manus-storage/ehco-plan-mountain-path_65e37116.png";
const TASK_ILLUSTRATION = "/manus-storage/ehco-task-desk_19733f68.png";

type IconName = ComponentProps<typeof MaterialIcons>["name"];
type CalendarTask = {
  id: number;
  dayNumber: number;
  orderIndex: number;
  status: "locked" | "unlocked" | "in_quiz" | "completed";
  title: string | null;
  estimatedMinutes: number | null;
  completedAt: Date | null;
};
type CalendarDay = { dayNumber: number; tasks: CalendarTask[] };
type CalendarState = "locked" | "current" | "completed";

export default function CalendarScreen() {
  const { isAuthenticated } = useAuth();
  const { t } = useLanguage();
  const navigation = useNavigation();
  const calendar = trpc.calendar.get.useQuery(undefined, { enabled: isAuthenticated });
  const reminderEnabled = useReminderStatus(isAuthenticated);
  const days = useMemo<CalendarDay[]>(() => groupDays(calendar.data?.days ?? []), [calendar.data?.days]);

  useEffect(() => {
    navigation.setOptions({
      tabBarActiveTintColor: COLORS.forest,
      tabBarInactiveTintColor: "#8F9586",
      tabBarStyle: {
        backgroundColor: COLORS.ivory,
        borderTopColor: COLORS.border,
        borderTopWidth: 0.5,
      },
    });
  }, [navigation]);

  if (!isAuthenticated) {
    return <CalendarEntry title={t("calendar.loginTitle")} copy={t("calendar.loginCopy")} label={t("common.login")} icon="login" onPress={() => router.push("/login")} />;
  }
  if (calendar.isLoading) return <CalendarLoading />;
  if (calendar.isError) {
    return <CalendarEntry title={t("calendar.loadError")} copy={t("calendar.loadErrorCopy")} label={t("common.retry")} icon="refresh" onPress={() => void calendar.refetch()} error />;
  }
  if (!calendar.data) {
    return <CalendarEntry title={t("calendar.noGoal")} copy={t("calendar.noGoalCopy")} label={t("common.setupGoal")} icon="flag" onPress={() => router.push("/onboarding")} />;
  }
  if (!calendar.data.plan || calendar.data.plan.status !== "approved") {
    return <CalendarEntry title={t("calendar.awaitingApproval")} copy={t("calendar.awaitingApprovalCopy")} label={t("common.openPlan")} icon="map" onPress={() => router.push("/(tabs)/plan")} />;
  }
  if (days.length === 0) {
    return <CalendarEntry title={t("calendar.tasksPreparing")} copy={t("calendar.tasksPreparingCopy")} label={t("common.openPlan")} icon="map" onPress={() => router.push("/(tabs)/plan")} />;
  }

  const currentTask = findCurrentTask(days);
  const completedDays = days.filter((day) => getDayState(day) === "completed").length;
  return (
    <ScreenContainer containerClassName="bg-[#FDF9F4]">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <CalendarHero reminderEnabled={reminderEnabled} />
        <CalendarSurface days={days} completedDays={completedDays} />
        {currentTask && <CurrentTaskCard task={currentTask} completedDays={completedDays} totalDays={days.length} />}
      </ScrollView>
    </ScreenContainer>
  );
}

function useReminderStatus(isAuthenticated: boolean) {
  const [reminderEnabled, setReminderEnabled] = useState(false);
  useEffect(() => {
    if (!isAuthenticated) {
      setReminderEnabled(false);
      return;
    }
    void isDailyReminderEnabled().then(setReminderEnabled);
  }, [isAuthenticated]);
  return reminderEnabled;
}

function CalendarHero({ reminderEnabled }: { reminderEnabled: boolean }) {
  const { t } = useLanguage();
  const directional = useDirectionalStyles();
  const entrance = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(entrance, { toValue: 1, duration: 360, useNativeDriver: true }).start();
  }, [entrance]);
  return (
    <Animated.View style={[styles.hero, { opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}>
      <Image source={{ uri: HERO_ILLUSTRATION }} style={styles.heroIllustration} resizeMode="cover" />
      <View style={[styles.heroTopRow, directional.row]}>
        <View style={styles.heroBotanical}><MaterialIcons name="spa" size={23} color={COLORS.forest} /></View>
        <Pressable accessibilityRole="button" accessibilityLabel={t("calendar.reminderSettings")} onPress={() => router.push("/(tabs)/profile")} style={({ pressed }) => [styles.heroBell, pressed && styles.iconPressed]}>
          <MaterialIcons name="notifications-none" size={25} color={COLORS.forest} />
          {reminderEnabled && <View style={styles.notificationDot} />}
        </Pressable>
      </View>
      <View style={styles.heroCopy}>
        <Text style={styles.heroTitle}>{t("calendar.title")}</Text>
        <Text style={styles.heroSubtitle}>{t("calendar.subtitle")}</Text>
      </View>
    </Animated.View>
  );
}

function CalendarSurface({
  days,
  completedDays,
}: {
  days: CalendarDay[];
  completedDays: number;
}) {
  const { language, t } = useLanguage();
  const directional = useDirectionalStyles();
  const currentDay = days.find((day) => getDayState(day) === "current")?.dayNumber;
  const rows = chunk(days, 7);
  const weekdayNames = language === "ar" ? ["السبت", "الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"] : ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];

  return (
    <View style={styles.calendarSurface}>
      <View style={[styles.calendarHeading, directional.row]}>
        <View style={styles.calendarHeadingIcon}><MaterialIcons name="calendar-month" size={21} color={COLORS.forest} /></View>
        <Text style={styles.calendarHeadingText}>{t("calendar.learningPath")}</Text>
      </View>
      <View style={styles.calendarDivider} />
      <View style={[styles.weekdayRow, directional.row]}>{weekdayNames.map((name) => <Text key={name} style={styles.weekday}>{name}</Text>)}</View>
      <View style={styles.grid}>
        {rows.map((row, index) => (
          <View key={`week-${index}`} style={[styles.gridRow, directional.row]}>
            {row.map((day) => <CalendarDayCard key={day.dayNumber} day={day} />)}
            {Array.from({ length: Math.max(0, 7 - row.length) }, (_, placeholderIndex) => <View key={`empty-${placeholderIndex}`} style={styles.dayPlaceholder} />)}
          </View>
        ))}
      </View>
      <View style={[styles.legendRow, directional.row]}>
        <LegendItem icon="lock-outline" label={t("calendar.locked")} />
        <View style={styles.legendDivider} />
        <LegendItem icon="check-circle" label={t("calendar.completed")} color="#638161" />
        <View style={styles.legendDivider} />
        <LegendItem icon="circle" label={currentDay ? `${t("calendar.todayTask")} ${currentDay}` : t("calendar.todayTask")} color={COLORS.forest} />
      </View>
      <Text style={styles.journeyHint}>{t("calendar.completedDays", { count: completedDays })}</Text>
    </View>
  );
}

function CalendarDayCard({ day }: { day: CalendarDay }) {
  const { language, t } = useLanguage();
  const state = getDayState(day);
  const currentTask = day.tasks.find((task) => task.status === "unlocked" || task.status === "in_quiz");
  const card = (
    <View style={[styles.dayCard, state === "completed" && styles.dayCardCompleted, state === "current" && styles.dayCardCurrent]}>
      {state === "current" && <View style={styles.todayBadge}><Text style={styles.todayBadgeText}>{t("calendar.today")}</Text></View>}
      <Text style={[styles.gridDayNumber, state === "locked" && styles.gridDayMuted]}>{day.dayNumber}</Text>
      {state === "completed" ? (
        <><MaterialIcons name="check-circle" size={19} color="#638161" /><Text style={styles.dayStatusComplete}>{t("calendar.completed")}</Text></>
      ) : state === "current" ? (
        <><MaterialIcons name={currentTask?.status === "in_quiz" ? "fact-check" : "description"} size={20} color={COLORS.forest} /><Text style={styles.dayStatusCurrent}>{t("calendar.todayTask")}</Text><Text style={styles.dayDuration}>{formatDuration(currentTask?.estimatedMinutes ?? 0, language)}</Text></>
      ) : (
        <><MaterialIcons name="lock-outline" size={19} color="#888D80" /><Text style={styles.dayStatusLocked}>{t("calendar.locked")}</Text></>
      )}
    </View>
  );
  if (!currentTask) return card;
  return <Pressable accessibilityRole="button" accessibilityLabel={t("calendar.openTodayTask", { day: day.dayNumber })} onPress={() => router.push({ pathname: "/quiz/[taskId]", params: { taskId: String(currentTask.id) } })} style={({ pressed }) => [styles.dayPressable, pressed && styles.pressed]}>{card}</Pressable>;
}

function CurrentTaskCard({
  task,
  completedDays,
  totalDays,
}: {
  task: CalendarTask;
  completedDays: number;
  totalDays: number;
}) {
  const { language, t } = useLanguage();
  const directional = useDirectionalStyles();
  const entrance = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(entrance, { toValue: 1, duration: 360, useNativeDriver: true }).start();
  }, [entrance, task.id]);
  const journeyPercent = totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0;

  return (
    <Animated.View style={[styles.taskCard, { opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }]}>
      <Image source={{ uri: TASK_ILLUSTRATION }} style={[styles.taskIllustration, directional.isRTL ? { left: 0, right: undefined } : { left: undefined, right: 0 }]} resizeMode="cover" />
      <View style={[styles.taskTop, directional.row]}>
        <View style={[styles.taskCopyBlock, directional.start, directional.isRTL ? { paddingLeft: 130, paddingRight: 0 } : { paddingLeft: 0, paddingRight: 130 }]}>
          <Text style={[styles.taskEyebrow, directional.text]}>{t("calendar.todayTask")} <Text style={styles.taskLeaf}>⌁</Text></Text>
          <Text numberOfLines={2} style={[styles.taskTitle, directional.text]}>{task.title}</Text>
          <View style={[styles.taskMeta, directional.row]}><View style={styles.categoryChip}><Text style={styles.categoryText}>{task.status === "in_quiz" ? t("home.quizActive") : t("calendar.concepts")}</Text></View><View style={[styles.metaInfo, directional.row]}><MaterialIcons name="schedule" size={20} color={COLORS.forestMuted} /><Text style={styles.metaText}>{formatDuration(task.estimatedMinutes ?? 0, language)}</Text></View></View>
        </View>
        <View style={styles.progressCircle}><Text style={styles.progressValue}>{journeyPercent}%</Text><Text style={styles.progressLabel}>{t("calendar.yourProgress")}</Text></View>
      </View>
      <CalendarAction label={task.status === "in_quiz" ? t("calendar.continueQuiz") : t("calendar.startTask")} icon="play-circle-filled" onPress={() => router.push({ pathname: "/quiz/[taskId]", params: { taskId: String(task.id) } })} />
    </Animated.View>
  );
}

function LegendItem({ icon, label, color = COLORS.warmGray }: { icon: IconName; label: string; color?: string }) {
  const directional = useDirectionalStyles();
  return <View style={[styles.legendItem, directional.row]}><MaterialIcons name={icon} size={18} color={color} /><Text style={[styles.legendText, { color }]}>{label}</Text></View>;
}

function CalendarEntry({ title, copy, label, icon, onPress, error = false }: { title: string; copy: string; label: string; icon: IconName; onPress: () => void; error?: boolean }) {
  return (
    <ScreenContainer containerClassName="bg-[#FDF9F4]" className="items-center justify-center p-6">
      <View style={[styles.entryIcon, error && styles.entryIconError]}><MaterialIcons name={error ? "cloud-off" : "spa"} size={34} color={error ? COLORS.error : COLORS.forest} /></View>
      <Text style={styles.entryTitle}>{title}</Text>
      <Text style={styles.entryCopy}>{copy}</Text>
      <CalendarAction label={label} icon={icon} onPress={onPress} variant={error ? "soft" : "primary"} style={styles.entryAction} />
    </ScreenContainer>
  );
}

function CalendarLoading() {
  const { t } = useLanguage();
  return (
    <ScreenContainer containerClassName="bg-[#FDF9F4]" className="items-center justify-center p-6">
      <View style={styles.entryIcon}><MaterialIcons name="calendar-month" size={34} color={COLORS.forest} /></View>
      <ActivityIndicator color={COLORS.forest} size="small" />
      <Text style={styles.loadingText}>{t("calendar.loading")}</Text>
    </ScreenContainer>
  );
}

function CalendarAction({
  label,
  icon,
  onPress,
  variant = "primary",
  style,
}: {
  label: string;
  icon: IconName;
  onPress: () => void;
  variant?: "primary" | "soft";
  style?: object;
}) {
  const directional = useDirectionalStyles();
  const soft = variant === "soft";
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.calendarAction, directional.row, soft ? styles.actionSoft : styles.actionPrimary, style, pressed && styles.pressed]}><MaterialIcons name={icon} size={20} color={soft ? COLORS.forest : COLORS.ivory} /><Text style={[styles.actionText, soft ? styles.actionTextSoft : styles.actionTextPrimary]}>{label}</Text></Pressable>;
}

function groupDays(tasks: CalendarTask[]) {
  const grouped = new Map<number, CalendarTask[]>();
  for (const task of tasks) grouped.set(task.dayNumber, [...(grouped.get(task.dayNumber) ?? []), task]);
  return [...grouped.entries()].map(([dayNumber, groupedTasks]) => ({ dayNumber, tasks: groupedTasks })).sort((a, b) => a.dayNumber - b.dayNumber);
}

function getDayState(day: CalendarDay): CalendarState {
  if (day.tasks.every((task) => task.status === "completed")) return "completed";
  if (day.tasks.some((task) => task.status === "unlocked" || task.status === "in_quiz")) return "current";
  return "locked";
}

function findCurrentTask(days: CalendarDay[]) {
  return days.flatMap((day) => day.tasks).find((task) => task.status === "unlocked" || task.status === "in_quiz") ?? null;
}

function chunk<T>(items: T[], size: number) {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += size) rows.push(items.slice(index, index + size));
  return rows;
}

function formatDuration(minutes: number, language: "ar" | "en") {
  if (minutes <= 0) return "—";
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return language === "ar" ? `${minutes} د` : `${minutes}m`;
  return remainder ? (language === "ar" ? `${hours} س ${remainder} د` : `${hours}h ${remainder}m`) : (language === "ar" ? `${hours} س` : `${hours}h`);
}

const styles = StyleSheet.create({
  content: { paddingBottom: 42, gap: 22 },
  hero: { height: 272, overflow: "hidden", position: "relative", justifyContent: "space-between", paddingHorizontal: 22, paddingTop: 14, paddingBottom: 28 },
  heroIllustration: { ...StyleSheet.absoluteFillObject, opacity: 0.98 },
  heroTopRow: { flexDirection: "row", justifyContent: "space-between", zIndex: 2 },
  heroBotanical: { width: 50, height: 50, borderRadius: 25, backgroundColor: "rgba(255,253,249,0.9)", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#F0E9DF", shadowColor: "#6C604D", shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  heroBell: { width: 50, height: 50, borderRadius: 25, backgroundColor: "rgba(255,253,249,0.9)", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#F0E9DF", shadowColor: "#6C604D", shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  notificationDot: { position: "absolute", top: 9, right: 9, width: 8, height: 8, borderRadius: 4, backgroundColor: "#D88652", borderWidth: 1.5, borderColor: COLORS.ivory },
  iconPressed: { opacity: 0.72, transform: [{ scale: 0.96 }] },
  heroCopy: { zIndex: 2, alignItems: "center", gap: 3 },
  heroTitle: { color: COLORS.forest, fontSize: 48, fontWeight: "800", letterSpacing: -1.5, lineHeight: 59, textAlign: "center" },
  heroSubtitle: { color: COLORS.forestMuted, fontSize: 16, fontWeight: "500", textAlign: "center" },

  calendarSurface: { marginHorizontal: 14, marginTop: -13, padding: 18, borderRadius: 29, backgroundColor: COLORS.card, shadowColor: "#5E5748", shadowOpacity: 0.09, shadowRadius: 16, shadowOffset: { width: 0, height: 7 }, elevation: 3 },
  calendarHeading: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 36 },
  calendarHeadingIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#E8EBDD", alignItems: "center", justifyContent: "center" },
  calendarHeadingText: { color: COLORS.forest, fontSize: 17, fontWeight: "800", textAlign: "center" },
  calendarDivider: { height: 1, backgroundColor: COLORS.border, marginTop: 16, marginBottom: 13 },
  weekdayRow: { flexDirection: "row-reverse", justifyContent: "space-between", marginBottom: 8 },
  weekday: { flex: 1, color: COLORS.warmGray, fontSize: 9.5, fontWeight: "700", textAlign: "center" },
  grid: { gap: 8 },
  gridRow: { flexDirection: "row-reverse", gap: 5 },
  dayPressable: { flex: 1 },
  dayPlaceholder: { flex: 1 },
  dayCard: { flex: 1, minHeight: 78, borderRadius: 14, backgroundColor: "#FAF8F2", borderWidth: 1, borderColor: "#F0ECE5", alignItems: "center", justifyContent: "center", gap: 2, paddingVertical: 6 },
  dayCardCompleted: { backgroundColor: "#EEF3E9", borderColor: "#D9E4D2" },
  dayCardCurrent: { minHeight: 132, marginTop: -12, backgroundColor: "#FFFDF8", borderColor: "#6D8A65", borderWidth: 1.5, shadowColor: "#536B4F", shadowOpacity: 0.14, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  todayBadge: { position: "absolute", top: -13, minWidth: 46, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 10, backgroundColor: COLORS.forest },
  todayBadgeText: { color: COLORS.ivory, fontSize: 9.5, fontWeight: "800" },
  gridDayNumber: { color: COLORS.forest, fontSize: 18, fontWeight: "800" },
  gridDayMuted: { color: "#747A6F" },
  dayStatusLocked: { color: "#7F8278", fontSize: 9, fontWeight: "700" },
  dayStatusComplete: { color: "#557852", fontSize: 9, fontWeight: "800" },
  dayStatusCurrent: { color: COLORS.forest, fontSize: 10, fontWeight: "800" },
  dayDuration: { color: COLORS.forestMuted, fontSize: 9, fontWeight: "600" },
  legendRow: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-around", marginTop: 17, paddingTop: 13, borderTopWidth: 1, borderTopColor: COLORS.border },
  legendItem: { flexDirection: "row-reverse", alignItems: "center", gap: 5 },
  legendText: { fontSize: 11, fontWeight: "700" },
  legendDivider: { width: 1, height: 23, backgroundColor: COLORS.border },
  journeyHint: { color: COLORS.warmGray, fontSize: 11, lineHeight: 18, textAlign: "center", marginTop: 12 },

  taskCard: { marginHorizontal: 14, overflow: "hidden", borderRadius: 27, padding: 17, backgroundColor: COLORS.card, gap: 17, shadowColor: "#5E5748", shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  taskTop: { flexDirection: "row-reverse", minHeight: 148, gap: 14 },
  taskIllustration: { position: "absolute", left: 0, top: 0, width: 125, height: 143, borderRadius: 18, backgroundColor: COLORS.cream },
  taskCopyBlock: { flex: 1, alignItems: "flex-start", gap: 6, paddingLeft: 130 },
  taskEyebrow: { color: COLORS.forestMuted, fontSize: 12, fontWeight: "700", textAlign: "left" },
  taskLeaf: { color: "#7A9170", fontSize: 18 },
  taskTitle: { color: COLORS.forest, fontSize: 22, fontWeight: "800", lineHeight: 29, textAlign: "left" },
  taskMeta: { flexDirection: "row-reverse", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 1 },
  categoryChip: { borderRadius: 11, backgroundColor: "#EEF0E4", paddingHorizontal: 9, paddingVertical: 5 },
  categoryText: { color: COLORS.forestMuted, fontSize: 11, fontWeight: "700" },
  metaInfo: { flexDirection: "row-reverse", alignItems: "center", gap: 4 },
  metaText: { color: COLORS.forestMuted, fontSize: 13, fontWeight: "700" },
  progressCircle: { position: "absolute", right: 0, bottom: -2, width: 74, height: 74, borderRadius: 37, borderWidth: 5, borderColor: "#E6E5DD", alignItems: "center", justifyContent: "center" },
  progressValue: { color: COLORS.forest, fontSize: 19, fontWeight: "800" },
  progressLabel: { color: COLORS.warmGray, fontSize: 9.5, fontWeight: "700" },

  entryIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: "#E8EBDD", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  entryIconError: { backgroundColor: "#F8E9D8" },
  entryTitle: { color: COLORS.forest, fontSize: 23, fontWeight: "800", textAlign: "center" },
  entryCopy: { maxWidth: 285, color: COLORS.forestMuted, fontSize: 14, lineHeight: 22, textAlign: "center", marginTop: 8 },
  entryAction: { alignSelf: "stretch", marginTop: 22 },
  loadingText: { marginTop: 13, color: COLORS.forestMuted, fontSize: 14 },

  calendarAction: { minHeight: 54, borderRadius: 16, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 17 },
  actionPrimary: { backgroundColor: COLORS.forest },
  actionSoft: { backgroundColor: "#E4E6D8" },
  actionText: { fontSize: 15, fontWeight: "800" },
  actionTextPrimary: { color: COLORS.ivory },
  actionTextSoft: { color: COLORS.forest },
  pressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
});
