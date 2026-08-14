import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router, useNavigation } from "expo-router";
import { useEffect, useRef, useState } from "react";
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
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Rect, Stop } from "react-native-svg";

import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/hooks/use-auth";
import { isDailyReminderEnabled } from "@/lib/daily-reminder";
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
  alert: "#A25E3E",
} as const;

const TASK_DESK_ILLUSTRATION = "/manus-storage/ehco-task-desk_19733f68.png";
const PROGRESS_PATH_ILLUSTRATION = "/manus-storage/ehco-progress-path_094af40e.png";

type CurrentTask = {
  id: number;
  dayNumber: number;
  estimatedMinutes: number;
  title: string;
  status: string;
};

type CurrentGoal = {
  targetDurationDays: number;
};

export default function HomeScreen() {
  const { user, isAuthenticated, loading } = useAuth();
  const navigation = useNavigation();
  const currentTask = trpc.tasks.current.useQuery(undefined, { enabled: isAuthenticated });
  const [reminderEnabled, setReminderEnabled] = useState(false);

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

  useEffect(() => {
    if (!isAuthenticated) {
      setReminderEnabled(false);
      return;
    }
    void isDailyReminderEnabled().then(setReminderEnabled);
  }, [isAuthenticated]);

  if (loading) return <HomeLoading />;
  if (!isAuthenticated) return <GuestHome />;

  const task = currentTask.data?.task;
  const goal = currentTask.data?.goal;

  return (
    <ScreenContainer containerClassName="bg-[#FDF9F4]">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <HomeHeader name={user?.name ?? undefined} reminderEnabled={reminderEnabled} />

        {currentTask.isLoading ? (
          <TaskLoadingCard />
        ) : currentTask.isError ? (
          <HomeError onRetry={() => void currentTask.refetch()} />
        ) : task && goal ? (
          <CurrentTaskCard task={task} goal={goal} />
        ) : (
          <NoTaskCard />
        )}

        <ProgressGuide />
      </ScrollView>
    </ScreenContainer>
  );
}

function HomeLoading() {
  return (
    <ScreenContainer containerClassName="bg-[#FDF9F4]" className="items-center justify-center p-6">
      <View style={styles.loadingBloom}>
        <MaterialIcons name="spa" size={30} color={COLORS.forest} />
      </View>
      <ActivityIndicator color={COLORS.forest} size="small" />
      <Text style={styles.loadingCopy}>نجهّز مسارك بهدوء…</Text>
    </ScreenContainer>
  );
}

function GuestHome() {
  return (
    <ScreenContainer containerClassName="bg-[#FDF9F4]" edges={["top", "left", "right"]}>
      <View style={styles.guestRoot}>
        <GuestLandscapeScene />
        <View style={styles.guestBrand}>
          <Image source={require("../../assets/images/icon.png")} style={styles.guestLogo} />
          <Text style={styles.guestBrandName}>echo</Text>
        </View>
        <View style={styles.guestHero}>
          <Text style={styles.guestHeadline}>
            Your plan.{"\n"}Your progress.{"\n"}<Text style={styles.guestHeadlineAccent}>Your life.</Text>
          </Text>
          <Text style={styles.guestCopy}>Echo helps you build the skills you need, one step at a time.</Text>
        </View>
        <View style={styles.guestActionSheet}>
          <HomeAction
            label="تسجيل الدخول والبدء"
            icon="spa"
            onPress={() => router.push("/login")}
          />
          <Pressable onPress={() => router.push("/login")} style={({ pressed }) => [styles.guestSecondaryAction, pressed && styles.pressedText]}>
            <Text style={styles.guestSecondaryText}>أو إنشاء حساب جديد</Text>
          </Pressable>
        </View>
      </View>
    </ScreenContainer>
  );
}

function GuestLandscapeScene() {
  return (
    <View pointerEvents="none" style={styles.guestIllustration}>
      <Svg width="100%" height="100%" viewBox="0 0 375 780" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <LinearGradient id="sky" x1="0" x2="0" y1="0" y2="1">
            <Stop offset="0" stopColor="#FDF9F4" />
            <Stop offset="0.62" stopColor="#F7EDE0" />
            <Stop offset="1" stopColor="#E4E3D1" />
          </LinearGradient>
          <LinearGradient id="water" x1="0" x2="1" y1="0" y2="0">
            <Stop offset="0" stopColor="#DCE3D1" />
            <Stop offset="1" stopColor="#BFCDB7" />
          </LinearGradient>
        </Defs>
        <Rect width="375" height="780" fill="url(#sky)" />
        <Circle cx="275" cy="166" r="31" fill="#FFF8E6" opacity="0.8" />
        <Path d="M0 425 L0 340 L74 282 L143 347 L216 253 L310 349 L375 290 L375 425 Z" fill="#B9C5AD" opacity="0.52" />
        <Path d="M0 455 L0 365 L93 320 L163 383 L253 286 L328 374 L375 346 L375 455 Z" fill="#8FA284" opacity="0.54" />
        <Path d="M0 505 C67 461 116 454 186 475 C256 498 303 463 375 447 L375 588 L0 588 Z" fill="url(#water)" opacity="0.72" />
        <Path d="M0 535 C72 514 118 529 178 541 C261 558 310 518 375 512" stroke="#F7EDE0" strokeWidth="3" fill="none" opacity="0.75" />
        <Ellipse cx="97" cy="577" rx="119" ry="24" fill="#C7D1BF" opacity="0.72" />
        <Path d="M0 560 C48 533 107 547 159 579 C229 623 298 576 375 553 L375 780 L0 780 Z" fill="#8CA07F" opacity="0.55" />
        <Path d="M0 625 C58 591 123 619 170 666 C214 709 293 630 375 625 L375 780 L0 780 Z" fill="#6F896B" opacity="0.72" />
        <Rect x="0" y="704" width="375" height="76" fill="#CBB38E" opacity="0.82" />
        <Ellipse cx="62" cy="699" rx="49" ry="20" fill="#B78557" />
        <Path d="M13 700 C17 664 99 664 105 700" fill="none" stroke="#8C684B" strokeWidth="4" opacity="0.85" />
        <Rect x="228" y="653" width="55" height="58" rx="5" fill="#6E8466" transform="rotate(11 228 653)" />
        <Rect x="233" y="649" width="55" height="58" rx="5" fill="#E9DFCB" transform="rotate(11 233 649)" />
        <Ellipse cx="327" cy="653" rx="33" ry="14" fill="#AAB899" />
        <Path d="M327 649 C323 607 308 579 291 560 M327 649 C334 602 348 576 367 553 M327 649 C305 620 282 612 267 609" stroke="#426343" strokeWidth="3" fill="none" />
        <Ellipse cx="291" cy="560" rx="12" ry="7" fill="#779170" transform="rotate(38 291 560)" />
        <Ellipse cx="367" cy="553" rx="13" ry="7" fill="#779170" transform="rotate(-34 367 553)" />
        <Ellipse cx="267" cy="609" rx="12" ry="7" fill="#779170" transform="rotate(17 267 609)" />
      </Svg>
    </View>
  );
}

function HomeHeader({ name, reminderEnabled }: { name?: string; reminderEnabled: boolean }) {
  return (
    <Animated.View style={styles.header}>
      <View style={styles.headerTop}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="إعدادات التنبيه"
          onPress={() => router.push("/(tabs)/profile")}
          style={({ pressed }) => [styles.notificationButton, pressed && styles.notificationPressed]}
        >
          <MaterialIcons name="notifications-none" size={24} color={COLORS.forest} />
          {reminderEnabled && <View style={styles.notificationDot} />}
        </Pressable>
        <View style={styles.greetingBlock}>
          <Text style={styles.greeting}>مرحبًا، {name ?? "بك"} <Text style={styles.greetingLeaf}>⌁</Text></Text>
        </View>
      </View>
      <Text style={styles.screenTitle}>مهمتك التالية</Text>
      <Text style={styles.headerCopy}>استمر، كل خطوة تقرّبك من هدفك.</Text>
    </Animated.View>
  );
}

function CurrentTaskCard({ task, goal }: { task: CurrentTask; goal: CurrentGoal }) {
  const entrance = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    entrance.setValue(0);
    Animated.timing(entrance, {
      toValue: 1,
      duration: 360,
      useNativeDriver: true,
    }).start();
  }, [entrance, task.id]);

  return (
    <Animated.View
      style={[
        styles.taskCard,
        {
          opacity: entrance,
          transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
        },
      ]}
    >
      <View style={styles.taskVisualHalo} />
      <Image source={{ uri: TASK_DESK_ILLUSTRATION }} style={styles.taskIllustration} resizeMode="cover" />
      <View style={styles.taskCopyBlock}>
        <View style={styles.dayBadge}>
          <Text style={styles.dayBadgeText}>اليوم {task.dayNumber} من {goal.targetDurationDays}</Text>
        </View>
        <Text numberOfLines={3} style={styles.taskTitle}>{task.title}</Text>
        <View style={styles.taskMeta}>
          <View style={styles.metaItem}>
            <MaterialIcons name="schedule" size={17} color={COLORS.forestMuted} />
            <Text style={styles.metaText}>{task.estimatedMinutes} دقيقة</Text>
          </View>
          <View style={styles.metaItem}>
            <MaterialIcons name={task.status === "in_quiz" ? "fact-check" : "bookmark-border"} size={17} color={COLORS.forestMuted} />
            <Text style={styles.metaText}>{task.status === "in_quiz" ? "اختبار مستمر" : "متاحة الآن"}</Text>
          </View>
        </View>
      </View>
      <HomeAction
        label="ابدأ المهمة والاختبار"
        icon="play-circle-filled"
        onPress={() => router.push({ pathname: "/quiz/[taskId]", params: { taskId: String(task.id) } })}
        style={styles.taskAction}
      />
    </Animated.View>
  );
}

function TaskLoadingCard() {
  return (
    <View style={[styles.taskCard, styles.taskLoadingCard]}>
      <View style={styles.loadingCardIcon}><ActivityIndicator color={COLORS.forest} size="small" /></View>
      <View style={styles.loadingLines}>
        <View style={[styles.loadingLine, styles.loadingLineWide]} />
        <View style={[styles.loadingLine, styles.loadingLineShort]} />
      </View>
      <Text style={styles.cardLoadingCopy}>نجهّز تفاصيل مهمتك التالية…</Text>
    </View>
  );
}

function NoTaskCard() {
  return (
    <View style={styles.emptyCard}>
      <View style={styles.emptyIcon}>
        <MaterialIcons name="lock-outline" size={35} color={COLORS.forest} />
      </View>
      <View style={styles.emptyCopyBlock}>
        <Text style={styles.emptyTitle}>لا توجد مهمة متاحة الآن</Text>
        <Text style={styles.emptyCopy}>جميع المهام مكتملة حاليًا. راجع خطتك لمعرفة خطوتك القادمة.</Text>
        <HomeAction label="الذهاب إلى الخطة" icon="map" variant="soft" onPress={() => router.push("/(tabs)/plan")} style={styles.emptyAction} />
      </View>
    </View>
  );
}

function HomeError({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.errorCard}>
      <View style={styles.errorIcon}><MaterialIcons name="cloud-off" size={30} color={COLORS.alert} /></View>
      <Text style={styles.errorTitle}>لم نتمكن من تحميل مهمتك الآن</Text>
      <Text style={styles.errorCopy}>تحقّق من اتصالك ثم حاول مرة أخرى بهدوء.</Text>
      <HomeAction label="إعادة المحاولة" icon="refresh" variant="soft" onPress={onRetry} style={styles.errorAction} />
    </View>
  );
}

function ProgressGuide() {
  const steps = [
    { icon: "task-alt" as const, title: "أكمل المهمة اليومية", copy: "اقرأ، تعلّم وطبّق بما يناسبك." },
    { icon: "quiz" as const, title: "اختبر فهمك", copy: "أجب عن الأسئلة لتحقق من فهمك." },
    { icon: "verified" as const, title: "حقّق نسبة 70% أو أكثر", copy: "لتُفتح المهمة التالية وتستمر في رحلتك." },
  ];

  return (
    <View style={styles.progressCard}>
      <Text style={styles.progressTitle}>كيف يعمل تقدّمك؟</Text>
      <View style={styles.progressInner}>
        <View style={styles.progressSteps}>
          {steps.map((step) => (
            <View style={styles.progressStep} key={step.title}>
              <View style={styles.stepIcon}><MaterialIcons name={step.icon} size={18} color={COLORS.forest} /></View>
              <View style={styles.stepCopy}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepText}>{step.copy}</Text>
              </View>
            </View>
          ))}
        </View>
        <Image source={{ uri: PROGRESS_PATH_ILLUSTRATION }} style={styles.progressIllustration} resizeMode="contain" />
      </View>
    </View>
  );
}

function HomeAction({
  label,
  icon,
  onPress,
  variant = "primary",
  style,
}: {
  label: string;
  icon: React.ComponentProps<typeof MaterialIcons>["name"];
  onPress: () => void;
  variant?: "primary" | "soft";
  style?: object;
}) {
  const soft = variant === "soft";
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.homeAction, soft ? styles.homeActionSoft : styles.homeActionPrimary, style, pressed && styles.homeActionPressed]}
    >
      <MaterialIcons name={icon} size={20} color={soft ? COLORS.forest : COLORS.ivory} />
      <Text style={[styles.homeActionText, soft ? styles.homeActionTextSoft : styles.homeActionTextPrimary]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 42, gap: 24 },
  loadingBloom: { width: 70, height: 70, borderRadius: 35, backgroundColor: COLORS.sageLight, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  loadingCopy: { marginTop: 12, color: COLORS.forestMuted, fontSize: 14, textAlign: "center" },

  guestRoot: { flex: 1, minHeight: "100%", backgroundColor: COLORS.ivory, overflow: "hidden" },
  guestIllustration: { ...StyleSheet.absoluteFillObject, opacity: 0.9 },
  guestBrand: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 27, paddingTop: 18 },
  guestLogo: { width: 45, height: 45, borderRadius: 22, backgroundColor: COLORS.ivory },
  guestBrandName: { color: COLORS.forest, fontSize: 29, fontWeight: "500", letterSpacing: -1.2 },
  guestHero: { flex: 1, justifyContent: "center", paddingHorizontal: 34, paddingBottom: 95 },
  guestHeadline: { color: COLORS.forest, fontSize: 38, fontWeight: "700", letterSpacing: -1.2, lineHeight: 46, textAlign: "left" },
  guestHeadlineAccent: { color: "#78906B" },
  guestCopy: { maxWidth: 270, color: COLORS.forestMuted, fontSize: 16, lineHeight: 25, marginTop: 22, textAlign: "left" },
  guestActionSheet: { backgroundColor: "rgba(255,253,249,0.96)", borderTopLeftRadius: 34, borderTopRightRadius: 34, paddingHorizontal: 26, paddingTop: 26, paddingBottom: 20, gap: 14 },
  guestSecondaryAction: { alignItems: "center", paddingVertical: 5 },
  guestSecondaryText: { color: COLORS.forestMuted, fontSize: 15, fontWeight: "600" },
  pressedText: { opacity: 0.7 },

  header: { gap: 7, marginTop: 2 },
  headerTop: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginBottom: 5 },
  greetingBlock: { flex: 1, alignItems: "flex-start", marginRight: 12 },
  greeting: { color: COLORS.forest, fontSize: 17, fontWeight: "600", textAlign: "right" },
  greetingLeaf: { color: "#7C9173", fontSize: 22, fontWeight: "400" },
  notificationButton: { width: 46, height: 46, borderRadius: 23, backgroundColor: "#FFFDF9", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#F1E9DE" },
  notificationPressed: { opacity: 0.72, transform: [{ scale: 0.96 }] },
  notificationDot: { position: "absolute", top: 10, right: 10, width: 7, height: 7, borderRadius: 4, backgroundColor: "#D88652", borderWidth: 1.5, borderColor: COLORS.ivory },
  screenTitle: { color: COLORS.forest, fontSize: 31, fontWeight: "800", lineHeight: 40, textAlign: "right" },
  headerCopy: { color: COLORS.forestMuted, fontSize: 15, lineHeight: 23, textAlign: "right" },

  taskCard: { position: "relative", overflow: "hidden", minHeight: 306, backgroundColor: COLORS.cream, borderRadius: 28, padding: 20, justifyContent: "space-between", shadowColor: "#6A5B45", shadowOpacity: 0.07, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  taskVisualHalo: { position: "absolute", width: 174, height: 174, borderRadius: 87, backgroundColor: "rgba(255,253,249,0.46)", right: -47, top: -42 },
  taskIllustration: { position: "absolute", right: -10, top: 8, width: 180, height: 132, opacity: 0.96 },
  taskCopyBlock: { width: "65%", minHeight: 188, justifyContent: "flex-start", gap: 14 },
  dayBadge: { alignSelf: "flex-start", backgroundColor: "rgba(255,253,249,0.8)", paddingHorizontal: 11, paddingVertical: 6, borderRadius: 13 },
  dayBadgeText: { color: COLORS.forest, fontSize: 12, fontWeight: "700" },
  taskTitle: { color: COLORS.forest, fontSize: 25, fontWeight: "800", lineHeight: 33, textAlign: "right" },
  taskMeta: { flexDirection: "row-reverse", flexWrap: "wrap", alignItems: "center", gap: 12 },
  metaItem: { flexDirection: "row-reverse", alignItems: "center", gap: 5 },
  metaText: { color: COLORS.forestMuted, fontSize: 13, fontWeight: "600" },
  taskAction: { marginTop: 4 },

  taskLoadingCard: { minHeight: 220, alignItems: "center", justifyContent: "center", gap: 14 },
  loadingCardIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,253,249,0.65)" },
  loadingLines: { alignItems: "center", gap: 8 },
  loadingLine: { height: 9, borderRadius: 5, backgroundColor: "rgba(37,70,49,0.13)" },
  loadingLineWide: { width: 152 },
  loadingLineShort: { width: 98 },
  cardLoadingCopy: { color: COLORS.forestMuted, fontSize: 14, textAlign: "center" },

  emptyCard: { flexDirection: "row-reverse", alignItems: "center", gap: 16, backgroundColor: "#F5F3E9", borderRadius: 26, padding: 20, minHeight: 184 },
  emptyIcon: { width: 78, height: 78, borderRadius: 39, alignItems: "center", justifyContent: "center", backgroundColor: "#E1E5D5" },
  emptyCopyBlock: { flex: 1, gap: 7 },
  emptyTitle: { color: COLORS.forest, fontSize: 18, fontWeight: "800", textAlign: "right" },
  emptyCopy: { color: COLORS.forestMuted, fontSize: 13, lineHeight: 20, textAlign: "right" },
  emptyAction: { marginTop: 4, minHeight: 42, paddingVertical: 8 },

  errorCard: { alignItems: "center", backgroundColor: "#FFF8F0", borderRadius: 26, padding: 24, gap: 9, borderWidth: 1, borderColor: "#F0DEC9" },
  errorIcon: { width: 58, height: 58, borderRadius: 29, backgroundColor: "#F8E9D8", alignItems: "center", justifyContent: "center" },
  errorTitle: { color: COLORS.forest, fontSize: 18, fontWeight: "800", textAlign: "center" },
  errorCopy: { color: COLORS.warmGray, fontSize: 14, lineHeight: 21, textAlign: "center" },
  errorAction: { marginTop: 8, alignSelf: "stretch" },

  progressCard: { backgroundColor: COLORS.card, borderRadius: 28, padding: 20, gap: 16, shadowColor: "#6A5B45", shadowOpacity: 0.04, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  progressTitle: { color: COLORS.forest, fontSize: 20, fontWeight: "800", textAlign: "right" },
  progressInner: { flexDirection: "row-reverse", alignItems: "flex-end", gap: 8 },
  progressSteps: { flex: 1, gap: 14 },
  progressStep: { flexDirection: "row-reverse", alignItems: "flex-start", gap: 10 },
  stepIcon: { width: 31, height: 31, borderRadius: 15.5, backgroundColor: "#EEF0E4", alignItems: "center", justifyContent: "center", marginTop: 1 },
  stepCopy: { flex: 1, gap: 2 },
  stepTitle: { color: COLORS.forest, fontSize: 14, fontWeight: "800", textAlign: "right" },
  stepText: { color: COLORS.warmGray, fontSize: 11.5, lineHeight: 17, textAlign: "right" },
  progressIllustration: { width: 108, height: 135, marginBottom: -7 },

  homeAction: { minHeight: 54, borderRadius: 16, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 18 },
  homeActionPrimary: { backgroundColor: COLORS.forest },
  homeActionSoft: { backgroundColor: "#E4E6D8" },
  homeActionPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  homeActionText: { fontSize: 16, fontWeight: "800" },
  homeActionTextPrimary: { color: COLORS.ivory },
  homeActionTextSoft: { color: COLORS.forest },
});
