import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router, useNavigation } from "expo-router";
import { type ComponentProps, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/hooks/use-auth";
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
const STAGE_ASSETS = [
  "/manus-storage/ehco-plan-stage-foundations_ac46a2e8.png",
  "/manus-storage/ehco-plan-stage-laptop_a5e9b8a8.png",
  "/manus-storage/ehco-plan-stage-database_a0580e66.png",
] as const;
const EDIT_PLANT_ASSET = "/manus-storage/ehco-plan-edit-plant_1fdeb926.png";

type IconName = ComponentProps<typeof MaterialIcons>["name"];
type ViewMode = "overview" | "tasks";
type JourneyState = "completed" | "current" | "locked";

export default function PlanScreen() {
  const { isAuthenticated } = useAuth();
  const { t } = useLanguage();
  const navigation = useNavigation();
  const utils = trpc.useUtils();
  const activeGoal = trpc.goals.active.useQuery(undefined, { enabled: isAuthenticated });
  const plan = trpc.plans.getForGoal.useQuery(
    { goalId: activeGoal.data?.id ?? 0 },
    { enabled: Boolean(activeGoal.data?.id) },
  );
  const calendar = trpc.calendar.get.useQuery(undefined, { enabled: isAuthenticated });
  const failedSegments = trpc.plans.failedSegments.useQuery(
    { planId: plan.data?.id ?? 0 },
    { enabled: Boolean(plan.data?.id) },
  );
  const [viewMode, setViewMode] = useState<ViewMode>("overview");
  const [editExpanded, setEditExpanded] = useState(false);
  const [editRequest, setEditRequest] = useState("");
  const [dailyMinutes, setDailyMinutes] = useState("");
  const [durationDays, setDurationDays] = useState("");

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

  const generate = trpc.plans.generateInitial.useMutation({
    onSuccess: () => void plan.refetch(),
    onError: (error) => Alert.alert(t("plan.createError"), error.message),
  });
  const approve = trpc.plans.approve.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.tasks.current.invalidate(),
        utils.calendar.get.invalidate(),
        utils.plans.getForGoal.invalidate(),
      ]);
      router.replace("/");
    },
    onError: (error) => Alert.alert(t("plan.approveError"), error.message),
  });
  const editPlan = trpc.plans.edit.useMutation({
    onSuccess: (result) => {
      setEditRequest("");
      void plan.refetch();
      Alert.alert(result.decision === "accepted" ? t("plan.editAccepted") : t("plan.editRejected"), result.reason);
    },
    onError: (error) => Alert.alert(t("plan.editError"), error.message),
  });
  const updateBounds = trpc.plans.updateBounds.useMutation({
    onSuccess: async (result) => {
      await Promise.all([plan.refetch(), activeGoal.refetch()]);
      Alert.alert(
        result.firstSegmentReady ? t("plan.boundsUpdated") : t("plan.boundsDraftUpdated"),
        result.firstSegmentReady
          ? t("plan.boundsReady")
          : t("plan.boundsDeferred"),
      );
    },
    onError: (error) => Alert.alert(t("plan.boundsError"), error.message),
  });
  const retrySegment = trpc.plans.retrySegment.useMutation({
    onSuccess: async () => {
      await Promise.all([
        failedSegments.refetch(),
        plan.refetch(),
        utils.tasks.current.invalidate(),
        utils.calendar.get.invalidate(),
      ]);
      Alert.alert(t("plan.segmentReady"), t("plan.segmentReadyCopy"));
    },
    onError: (error) => Alert.alert(t("plan.segmentError"), error.message),
  });

  useEffect(() => {
    if (plan.data?.status === "draft") {
      setDailyMinutes(String(plan.data.dailyMinutes));
      setDurationDays(String(plan.data.totalDurationDays));
    }
  }, [plan.data?.dailyMinutes, plan.data?.status, plan.data?.totalDurationDays]);

  if (!isAuthenticated) {
    return <PlanEntryState label={t("plan.loginEntry")} icon="login" onPress={() => router.push("/login")} />;
  }
  if (activeGoal.isLoading) return <PlanLoading />;
  if (!activeGoal.data) {
    return <PlanEntryState label={t("plan.goalEntry")} icon="flag" onPress={() => router.push("/onboarding")} />;
  }
  if (plan.isLoading) return <PlanLoading />;
  if (plan.isError) return <PlanError onRetry={() => void plan.refetch()} />;

  const draft = plan.data?.draftJson;
  const isDraft = plan.data?.status === "draft";
  const calendarTasks = calendar.data?.days ?? [];
  const totalTasks = calendarTasks.length;
  const completedTasks = calendarTasks.filter((task) => task.status === "completed").length;
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const stages = buildJourneyStages(draft?.days ?? [], calendarTasks, isDraft);

  return (
    <ScreenContainer containerClassName="bg-[#FDF9F4]">
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"} contentContainerStyle={styles.content}>
        <PlanHero onOpenActions={() => setEditExpanded(true)} />

        {!draft ? (
          <CreatePlanCard
            onPress={() => generate.mutate({ goalId: activeGoal.data!.id })}
            loading={generate.isPending}
          />
        ) : (
          <>
            <PlanSummaryCard
              goalTitle={activeGoal.data.title}
              progress={progress}
              totalTasks={totalTasks}
              dailyMinutes={activeGoal.data.dailyMinutes}
              durationDays={plan.data?.totalDurationDays ?? activeGoal.data.targetDurationDays}
            />

            <ViewSwitcher viewMode={viewMode} onChange={setViewMode} />

            {viewMode === "overview" ? (
              <JourneyTimeline stages={stages} />
            ) : (
              <TasksOutline days={draft.days} stages={stages} />
            )}

            {isDraft ? (
              <EditPlanCard
                expanded={editExpanded}
                onOpen={() => setEditExpanded(true)}
                onDecline={() => setEditExpanded(false)}
                dailyMinutes={dailyMinutes}
                durationDays={durationDays}
                editRequest={editRequest}
                onDailyMinutesChange={setDailyMinutes}
                onDurationDaysChange={setDurationDays}
                onEditRequestChange={setEditRequest}
                onSaveBounds={() => updateBounds.mutate({
                  planId: plan.data!.id,
                  dailyMinutes: Number(dailyMinutes),
                  durationDays: Number(durationDays),
                })}
                onEdit={() => editPlan.mutate({ planId: plan.data!.id, request: editRequest.trim() })}
                onApprove={() => approve.mutate({ goalId: activeGoal.data!.id })}
                onRetrySegment={(startDay) => retrySegment.mutate({ planId: plan.data!.id, startDay })}
                failedSegments={failedSegments.data ?? []}
                boundsPending={updateBounds.isPending}
                editPending={editPlan.isPending}
                approvePending={approve.isPending}
                retryPending={retrySegment.isPending}
              />
            ) : (
              <ApprovedPlanCard onOpenTask={() => router.replace("/")} />
            )}
          </>
        )}
      </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

function PlanHero({ onOpenActions }: { onOpenActions: () => void }) {
  const { t } = useLanguage();
  const entrance = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(entrance, { toValue: 1, duration: 360, useNativeDriver: true }).start();
  }, [entrance]);

  return (
    <Animated.View
      style={[
        styles.hero,
        { opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] },
      ]}
    >
      <Image source={{ uri: HERO_ILLUSTRATION }} style={styles.heroIllustration} resizeMode="cover" />
      <View style={styles.heroTopRow}>
        <View style={styles.heroBotanical}><MaterialIcons name="spa" size={23} color={COLORS.forest} /></View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("plan.showActions")}
          onPress={onOpenActions}
          style={({ pressed }) => [styles.heroMenu, pressed && styles.iconPressed]}
        >
          <MaterialIcons name="more-horiz" size={25} color={COLORS.forest} />
        </Pressable>
      </View>
      <View style={styles.heroCopy}>
        <Text style={styles.heroTitle}>{t("plan.title")}</Text>
        <Text style={styles.heroSubtitle}>{t("plan.subtitle")}</Text>
      </View>
    </Animated.View>
  );
}

function PlanSummaryCard({
  goalTitle,
  progress,
  totalTasks,
  dailyMinutes,
  durationDays,
}: {
  goalTitle: string;
  progress: number;
  totalTasks: number;
  dailyMinutes: number;
  durationDays: number;
}) {
  const { language, t } = useLanguage();
  const fill = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fill, { toValue: progress, duration: 450, useNativeDriver: false }).start();
  }, [fill, progress]);
  const stats: { icon: IconName; label: string; value: string }[] = [
    { icon: "trending-up", label: t("plan.progress"), value: `${progress}%` },
    { icon: "format-list-bulleted", label: t("plan.totalTasks"), value: totalTasks > 0 ? String(totalTasks) : "—" },
    { icon: "schedule", label: t("profile.dailyTime"), value: formatStudyTime(dailyMinutes, language) },
    { icon: "event-note", label: t("plan.duration"), value: t("common.days", { count: durationDays }) },
  ];

  return (
    <View style={styles.summaryCard}>
      <View style={styles.goalRow}>
        <MaterialIcons name="chevron-left" size={27} color={COLORS.forest} />
        <View style={styles.goalCopy}>
          <Text style={styles.goalLabel}>{t("plan.goal")}</Text>
          <Text numberOfLines={2} style={styles.goalTitle}>{goalTitle}</Text>
        </View>
        <View style={styles.goalIcon}><MaterialIcons name="track-changes" size={30} color={COLORS.forest} /></View>
      </View>
      <View style={styles.summaryDivider} />
      <View style={styles.statsRow}>
        {stats.map((stat, index) => (
          <View key={stat.label} style={[styles.statItem, index !== stats.length - 1 && styles.statSeparator]}>
            <View style={styles.statLabelRow}><MaterialIcons name={stat.icon} size={17} color={COLORS.forestMuted} /><Text style={styles.statLabel}>{stat.label}</Text></View>
            <Text style={styles.statValue}>{stat.value}</Text>
          </View>
        ))}
      </View>
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, { width: fill.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] }) }]} />
      </View>
      <View style={styles.summaryLeaf}><MaterialIcons name="local-florist" size={32} color="#6F8B67" /></View>
    </View>
  );
}

function ViewSwitcher({ viewMode, onChange }: { viewMode: ViewMode; onChange: (mode: ViewMode) => void }) {
  const { t } = useLanguage();
  return (
    <View style={styles.switcher}>
      <Pressable accessibilityRole="tab" accessibilityState={{ selected: viewMode === "tasks" }} onPress={() => onChange("tasks")} style={[styles.switchTab, viewMode === "tasks" && styles.switchTabActive]}>
        <Text style={[styles.switchText, viewMode === "tasks" && styles.switchTextActive]}>{t("plan.tasks")}</Text>
      </Pressable>
      <Pressable accessibilityRole="tab" accessibilityState={{ selected: viewMode === "overview" }} onPress={() => onChange("overview")} style={[styles.switchTab, viewMode === "overview" && styles.switchTabActive]}>
        <Text style={[styles.switchText, viewMode === "overview" && styles.switchTextActive]}>{t("plan.overview")}</Text>
      </Pressable>
    </View>
  );
}

function JourneyTimeline({ stages }: { stages: ReturnType<typeof buildJourneyStages> }) {
  return (
    <View style={styles.timeline}>
      {stages.map((stage, index) => (
        <JourneyStageCard key={stage.id} stage={stage} index={index} isLast={index === stages.length - 1} />
      ))}
    </View>
  );
}

function JourneyStageCard({
  stage,
  index,
  isLast,
}: {
  stage: ReturnType<typeof buildJourneyStages>[number];
  index: number;
  isLast: boolean;
}) {
  const { t } = useLanguage();
  const completed = stage.state === "completed";
  const current = stage.state === "current";
  const locked = stage.state === "locked";
  const stageImage = STAGE_ASSETS[index % STAGE_ASSETS.length];
  return (
    <View style={styles.timelineRow}>
      <View style={styles.timelineRail}>
        <View style={[styles.timelineMarker, completed && styles.markerCompleted, current && styles.markerCurrent, locked && styles.markerLocked]}>
          {completed ? <MaterialIcons name="check" size={18} color={COLORS.ivory} /> : current ? <View style={styles.currentCore} /> : <MaterialIcons name="lock-outline" size={15} color={COLORS.warmGray} />}
        </View>
        {!isLast && <View style={[styles.timelineLine, locked && styles.timelineLineDashed, completed && styles.timelineLineCompleted]} />}
      </View>
      <View style={styles.stageNumberBlock}>
        <Text style={[styles.stageNumber, locked && styles.stageMuted]}>0{index + 1}</Text>
        <Text style={[styles.stageRange, locked && styles.stageMuted]}>{t("plan.daysRange", { start: stage.startDay, end: stage.endDay })}</Text>
      </View>
      <View style={[styles.stageCard, current && styles.stageCardCurrent, locked && styles.stageCardLocked]}>
        <View style={styles.stageTopRow}>
          {current ? <View style={styles.currentBadge}><View style={styles.currentBadgeDot} /><Text style={styles.currentBadgeText}>{t("plan.current")}</Text></View> : completed ? <MaterialIcons name="check-circle" size={24} color="#5C7F5D" /> : <MaterialIcons name="lock-outline" size={22} color="#8C9082" />}
          {!locked && <Image source={{ uri: stageImage }} style={styles.stageIllustration} resizeMode="contain" />}
        </View>
        <Text numberOfLines={2} style={[styles.stageTitle, locked && styles.stageMuted]}>{stage.title}</Text>
        <Text numberOfLines={2} style={[styles.stageDescription, locked && styles.stageMuted]}>{stage.description}</Text>
      </View>
    </View>
  );
}

function TasksOutline({
  days,
  stages,
}: {
  days: { dayNumber: number; title: string; focus: string }[];
  stages: ReturnType<typeof buildJourneyStages>;
}) {
  return (
    <View style={styles.tasksList}>
      {days.map((day) => {
        const state = stages.find((stage) => day.dayNumber >= stage.startDay && day.dayNumber <= stage.endDay)?.state ?? "locked";
        return (
          <View key={day.dayNumber} style={[styles.dayTaskCard, state === "current" && styles.dayTaskCurrent, state === "locked" && styles.dayTaskLocked]}>
            <View style={[styles.dayTaskNumber, state === "completed" && styles.dayTaskComplete]}><Text style={styles.dayTaskNumberText}>{day.dayNumber}</Text></View>
            <View style={styles.dayTaskCopy}><Text style={[styles.dayTaskTitle, state === "locked" && styles.stageMuted]}>{day.title}</Text><Text style={[styles.dayTaskFocus, state === "locked" && styles.stageMuted]}>{day.focus}</Text></View>
            <MaterialIcons name={state === "completed" ? "check-circle" : state === "current" ? "play-circle-outline" : "lock-outline"} size={22} color={state === "locked" ? "#929587" : COLORS.forest} />
          </View>
        );
      })}
    </View>
  );
}

function EditPlanCard({
  expanded,
  onOpen,
  onDecline,
  dailyMinutes,
  durationDays,
  editRequest,
  onDailyMinutesChange,
  onDurationDaysChange,
  onEditRequestChange,
  onSaveBounds,
  onEdit,
  onApprove,
  onRetrySegment,
  failedSegments,
  boundsPending,
  editPending,
  approvePending,
  retryPending,
}: {
  expanded: boolean;
  onOpen: () => void;
  onDecline: () => void;
  dailyMinutes: string;
  durationDays: string;
  editRequest: string;
  onDailyMinutesChange: (value: string) => void;
  onDurationDaysChange: (value: string) => void;
  onEditRequestChange: (value: string) => void;
  onSaveBounds: () => void;
  onEdit: () => void;
  onApprove: () => void;
  onRetrySegment: (startDay: number) => void;
  failedSegments: { startDay: number; endDay: number }[];
  boundsPending: boolean;
  editPending: boolean;
  approvePending: boolean;
  retryPending: boolean;
}) {
  const { t } = useLanguage();
  return (
    <View style={styles.editCard}>
      <Image source={{ uri: EDIT_PLANT_ASSET }} style={styles.editPlant} resizeMode="contain" />
      <View style={styles.editIntro}>
        <Text style={styles.editTitle}>{t("plan.editTitle")}</Text>
        <Text style={styles.editCopy}>{t("plan.editCopy")}</Text>
      </View>
      <View style={styles.editActions}>
        <PlanAction label={t("plan.edit")} icon="edit" onPress={onOpen} compact />
        <Pressable onPress={onDecline} style={({ pressed }) => [styles.declineButton, pressed && styles.pressed]}>
          <MaterialIcons name="check-circle" size={18} color={COLORS.forest} />
          <Text style={styles.declineText}>{t("plan.declineEdit")}</Text>
        </Pressable>
      </View>

      {expanded && (
        <View style={styles.editPanel}>
          {failedSegments.map((segment) => (
            <View key={segment.startDay} style={styles.failureRow}>
              <Text style={styles.failureText}>{t("plan.segmentFailed", { start: segment.startDay, end: segment.endDay })}</Text>
              <PlanAction label={t("plan.retryGeneration")} icon="refresh" variant="soft" loading={retryPending} onPress={() => onRetrySegment(segment.startDay)} compact />
            </View>
          ))}
          <Text style={styles.inputLabel}>{t("plan.adjustBounds")}</Text>
          <View style={styles.boundsRow}>
            <TextInput value={dailyMinutes} onChangeText={onDailyMinutesChange} placeholder={t("plan.dailyMinutesPlaceholder")} placeholderTextColor="#9A968A" style={styles.boundsInput} keyboardType="number-pad" maxLength={3} />
            <TextInput value={durationDays} onChangeText={onDurationDaysChange} placeholder={t("plan.durationPlaceholder")} placeholderTextColor="#9A968A" style={styles.boundsInput} keyboardType="number-pad" maxLength={3} />
          </View>
          <PlanAction label={t("plan.saveBounds")} icon="schedule" variant="soft" loading={boundsPending} disabled={!Number.isInteger(Number(dailyMinutes)) || !Number.isInteger(Number(durationDays))} onPress={onSaveBounds} />
          <Text style={styles.inputLabel}>{t("plan.editTasksLabel")}</Text>
          <TextInput value={editRequest} onChangeText={onEditRequestChange} placeholder={t("plan.editPlaceholder")} placeholderTextColor="#9A968A" style={styles.editInput} multiline maxLength={1500} />
          <PlanAction label={t("plan.updateDraft")} icon="auto-awesome" variant="soft" loading={editPending} disabled={editRequest.trim().length < 4} onPress={onEdit} />
          <PlanAction label={t("plan.approveStart")} icon="play-circle-filled" loading={approvePending} onPress={onApprove} />
        </View>
      )}
    </View>
  );
}

function ApprovedPlanCard({ onOpenTask }: { onOpenTask: () => void }) {
  const { t } = useLanguage();
  return (
    <View style={styles.approvedCard}>
      <View style={styles.approvedIcon}><MaterialIcons name="verified" size={28} color={COLORS.forest} /></View>
      <View style={styles.approvedCopyBlock}><Text style={styles.approvedTitle}>{t("plan.approved")}</Text><Text style={styles.approvedCopy}>{t("plan.approvedCopy")}</Text></View>
      <PlanAction label={t("plan.openTodayTask")} icon="play-circle-filled" onPress={onOpenTask} compact />
    </View>
  );
}

function CreatePlanCard({ onPress, loading }: { onPress: () => void; loading: boolean }) {
  const { t } = useLanguage();
  return (
    <View style={styles.createCard}>
      <View style={styles.createIcon}><MaterialIcons name="alt-route" size={34} color={COLORS.forest} /></View>
      <Text style={styles.createTitle}>{t("plan.readyMap")}</Text>
      <Text style={styles.createCopy}>{t("plan.readyMapCopy")}</Text>
      <PlanAction label={t("plan.create")} icon="auto-awesome" loading={loading} onPress={onPress} />
    </View>
  );
}

function PlanEntryState({ label, icon, onPress }: { label: string; icon: IconName; onPress: () => void }) {
  const { t } = useLanguage();
  return (
    <ScreenContainer containerClassName="bg-[#FDF9F4]" className="items-center justify-center p-6">
      <View style={styles.entryIcon}><MaterialIcons name="spa" size={34} color={COLORS.forest} /></View>
      <Text style={styles.entryTitle}>{t("plan.entryTitle")}</Text>
      <Text style={styles.entryCopy}>{t("plan.entryCopy")}</Text>
      <PlanAction label={label} icon={icon} onPress={onPress} style={styles.entryAction} />
    </ScreenContainer>
  );
}

function PlanError({ onRetry }: { onRetry: () => void }) {
  const { t } = useLanguage();
  return (
    <ScreenContainer containerClassName="bg-[#FDF9F4]" className="items-center justify-center p-6">
      <View style={styles.entryIcon}><MaterialIcons name="cloud-off" size={34} color={COLORS.error} /></View>
      <Text style={styles.entryTitle}>{t("plan.loadError")}</Text>
      <Text style={styles.entryCopy}>{t("plan.loadErrorCopy")}</Text>
      <PlanAction label={t("common.retry")} icon="refresh" variant="soft" onPress={onRetry} style={styles.entryAction} />
    </ScreenContainer>
  );
}

function PlanLoading() {
  const { t } = useLanguage();
  return (
    <ScreenContainer containerClassName="bg-[#FDF9F4]" className="items-center justify-center p-6">
      <View style={styles.entryIcon}><MaterialIcons name="alt-route" size={34} color={COLORS.forest} /></View>
      <ActivityIndicator color={COLORS.forest} size="small" />
      <Text style={styles.loadingText}>{t("common.loadingJourney")}</Text>
    </ScreenContainer>
  );
}

function PlanAction({
  label,
  icon,
  onPress,
  variant = "primary",
  compact = false,
  loading = false,
  disabled = false,
  style,
}: {
  label: string;
  icon: IconName;
  onPress: () => void;
  variant?: "primary" | "soft";
  compact?: boolean;
  loading?: boolean;
  disabled?: boolean;
  style?: object;
}) {
  const soft = variant === "soft";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [styles.planAction, compact && styles.planActionCompact, soft ? styles.planActionSoft : styles.planActionPrimary, style, (disabled || loading) && styles.actionDisabled, pressed && styles.pressed]}
    >
      {loading ? <ActivityIndicator size="small" color={soft ? COLORS.forest : COLORS.ivory} /> : <MaterialIcons name={icon} size={compact ? 18 : 20} color={soft ? COLORS.forest : COLORS.ivory} />}
      {!loading && <Text style={[styles.planActionText, compact && styles.planActionTextCompact, soft ? styles.planActionTextSoft : styles.planActionTextPrimary]}>{label}</Text>}
    </Pressable>
  );
}

function buildJourneyStages(
  days: { dayNumber: number; title: string; focus: string }[],
  calendarTasks: { dayNumber: number; status: string }[],
  isDraft: boolean,
) {
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
    const current = isDraft ? index === 0 : Boolean(currentTaskDay && currentTaskDay >= startDay && currentTaskDay <= endDay);
    const state: JourneyState = fullyComplete ? "completed" : current ? "current" : "locked";
    return { id: `${startDay}-${endDay}`, startDay, endDay, title: group[0].title, description: group[0].focus, state };
  });
}

function formatStudyTime(minutes: number, language: "ar" | "en") {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours === 0) return language === "ar" ? `${minutes} د` : `${minutes}m`;
  if (remainingMinutes === 0) return language === "ar" ? `${hours} س` : `${hours}h`;
  return language === "ar" ? `${hours} س ${remainingMinutes} د` : `${hours}h ${remainingMinutes}m`;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingBottom: 42, gap: 22 },
  hero: { height: 272, overflow: "hidden", position: "relative", justifyContent: "space-between", paddingHorizontal: 22, paddingTop: 14, paddingBottom: 29 },
  heroIllustration: { ...StyleSheet.absoluteFillObject, opacity: 0.98 },
  heroTopRow: { flexDirection: "row", justifyContent: "space-between", zIndex: 2 },
  heroBotanical: { width: 50, height: 50, borderRadius: 25, backgroundColor: "rgba(255,253,249,0.9)", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#F0E9DF", shadowColor: "#6C604D", shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  heroMenu: { width: 50, height: 50, borderRadius: 25, backgroundColor: "rgba(255,253,249,0.9)", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#F0E9DF", shadowColor: "#6C604D", shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  iconPressed: { opacity: 0.72, transform: [{ scale: 0.96 }] },
  heroCopy: { zIndex: 2, alignItems: "flex-start", gap: 2 },
  heroTitle: { color: COLORS.forest, fontSize: 49, fontWeight: "800", letterSpacing: -1.5, lineHeight: 60, textAlign: "left" },
  heroSubtitle: { color: COLORS.forestMuted, fontSize: 18, fontWeight: "500", textAlign: "left" },

  summaryCard: { marginHorizontal: 18, marginTop: -14, padding: 20, borderRadius: 28, backgroundColor: COLORS.card, gap: 16, shadowColor: "#5E5748", shadowOpacity: 0.09, shadowRadius: 16, shadowOffset: { width: 0, height: 7 }, elevation: 3 },
  goalRow: { flexDirection: "row", alignItems: "center", gap: 13 },
  goalIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#E9EADF", alignItems: "center", justifyContent: "center" },
  goalCopy: { flex: 1, gap: 3, alignItems: "flex-start" },
  goalLabel: { color: COLORS.forestMuted, fontSize: 13, fontWeight: "700", textAlign: "left" },
  goalTitle: { color: COLORS.forest, fontSize: 22, fontWeight: "800", lineHeight: 29, textAlign: "left" },
  summaryDivider: { height: 1, backgroundColor: COLORS.border },
  statsRow: { flexDirection: "row-reverse", justifyContent: "space-between" },
  statItem: { flex: 1, gap: 7, alignItems: "center", paddingHorizontal: 3 },
  statSeparator: { borderLeftWidth: 1, borderLeftColor: "#F0EAE0" },
  statLabelRow: { flexDirection: "row-reverse", alignItems: "center", gap: 4 },
  statLabel: { color: COLORS.forestMuted, fontSize: 10, fontWeight: "700", textAlign: "center" },
  statValue: { color: COLORS.forest, fontSize: 17, fontWeight: "800", textAlign: "center" },
  progressTrack: { height: 10, overflow: "hidden", borderRadius: 6, backgroundColor: "#E7E4DC", marginTop: 1 },
  progressFill: { height: "100%", backgroundColor: COLORS.forest, borderRadius: 6 },
  summaryLeaf: { position: "absolute", right: 11, bottom: -4, opacity: 0.86 },

  switcher: { flexDirection: "row-reverse", alignSelf: "center", borderRadius: 24, padding: 4, backgroundColor: "#F5F2EB", borderWidth: 1, borderColor: "#ECE7DE" },
  switchTab: { minWidth: 125, minHeight: 46, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  switchTabActive: { backgroundColor: COLORS.forest, shadowColor: "#42503E", shadowOpacity: 0.12, shadowRadius: 7, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  switchText: { color: COLORS.warmGray, fontSize: 15, fontWeight: "700" },
  switchTextActive: { color: COLORS.ivory },

  timeline: { marginHorizontal: 18, gap: 0 },
  timelineRow: { flexDirection: "row", minHeight: 151 },
  timelineRail: { width: 42, alignItems: "center" },
  timelineMarker: { width: 37, height: 37, borderRadius: 19, zIndex: 2, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.ivory, borderWidth: 2, borderColor: "#C1C7B7" },
  markerCompleted: { backgroundColor: "#638161", borderColor: "#638161" },
  markerCurrent: { width: 47, height: 47, borderRadius: 24, marginTop: -5, backgroundColor: "#E2E7D8", borderColor: "#D1DAC5", shadowColor: "#5B7054", shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  markerLocked: { borderStyle: "dashed", backgroundColor: "#FAF9F4" },
  currentCore: { width: 22, height: 22, borderRadius: 12, backgroundColor: COLORS.forest },
  timelineLine: { position: "absolute", top: 37, bottom: -3, width: 2, backgroundColor: "#BBC8B1" },
  timelineLineCompleted: { backgroundColor: "#638161" },
  timelineLineDashed: { backgroundColor: "transparent", borderLeftWidth: 2, borderStyle: "dashed", borderColor: "#A5AA9C" },
  stageNumberBlock: { width: 82, paddingTop: 3, paddingHorizontal: 6, gap: 2 },
  stageNumber: { color: COLORS.forest, fontSize: 22, fontWeight: "800", textAlign: "right" },
  stageRange: { color: COLORS.forestMuted, fontSize: 11, fontWeight: "600", textAlign: "right" },
  stageCard: { flex: 1, minHeight: 126, marginBottom: 18, overflow: "hidden", backgroundColor: COLORS.card, borderRadius: 22, paddingHorizontal: 17, paddingVertical: 15, gap: 4, shadowColor: "#5E5748", shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  stageCardCurrent: { backgroundColor: "#FFFDF9", borderWidth: 1.5, borderColor: "#90A582", shadowOpacity: 0.1, elevation: 3 },
  stageCardLocked: { backgroundColor: COLORS.future, opacity: 0.72 },
  stageTopRow: { height: 31, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  stageIllustration: { position: "absolute", right: -2, top: -6, width: 94, height: 72 },
  stageTitle: { color: COLORS.forest, fontSize: 18, fontWeight: "800", lineHeight: 25, textAlign: "right", paddingRight: 62 },
  stageDescription: { color: COLORS.forestMuted, fontSize: 12.5, lineHeight: 19, textAlign: "right", paddingRight: 4 },
  currentBadge: { flexDirection: "row-reverse", alignItems: "center", gap: 5, borderRadius: 12, backgroundColor: "#EEF0E4", paddingHorizontal: 8, paddingVertical: 5 },
  currentBadgeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.forest },
  currentBadgeText: { color: COLORS.forest, fontSize: 11, fontWeight: "800" },
  stageMuted: { color: "#85897E" },

  tasksList: { marginHorizontal: 18, gap: 10 },
  dayTaskCard: { flexDirection: "row-reverse", alignItems: "center", gap: 12, padding: 15, borderRadius: 19, backgroundColor: COLORS.card },
  dayTaskCurrent: { borderWidth: 1.5, borderColor: "#90A582" },
  dayTaskLocked: { backgroundColor: COLORS.future, opacity: 0.72 },
  dayTaskNumber: { width: 37, height: 37, borderRadius: 19, backgroundColor: "#EDF0E5", alignItems: "center", justifyContent: "center" },
  dayTaskComplete: { backgroundColor: "#638161" },
  dayTaskNumberText: { color: COLORS.forest, fontSize: 13, fontWeight: "800" },
  dayTaskCopy: { flex: 1, gap: 3 },
  dayTaskTitle: { color: COLORS.forest, fontSize: 16, fontWeight: "800", textAlign: "right" },
  dayTaskFocus: { color: COLORS.forestMuted, fontSize: 12, lineHeight: 18, textAlign: "right" },

  editCard: { position: "relative", overflow: "hidden", marginHorizontal: 18, borderRadius: 27, padding: 20, backgroundColor: COLORS.card, gap: 14, shadowColor: "#5E5748", shadowOpacity: 0.06, shadowRadius: 13, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  editPlant: { position: "absolute", left: -7, bottom: 1, width: 124, height: 124, opacity: 0.98 },
  editIntro: { alignItems: "flex-start", paddingLeft: 108, gap: 5 },
  editTitle: { color: COLORS.forest, fontSize: 22, fontWeight: "800", textAlign: "left" },
  editCopy: { color: COLORS.forestMuted, fontSize: 13, lineHeight: 20, textAlign: "left" },
  editActions: { flexDirection: "row-reverse", alignItems: "center", gap: 10, paddingLeft: 104 },
  declineButton: { minHeight: 45, flex: 1, borderRadius: 14, borderWidth: 1, borderColor: "#DAD8CC", backgroundColor: "#FFFEFB", flexDirection: "row-reverse", justifyContent: "center", alignItems: "center", gap: 6, paddingHorizontal: 8 },
  declineText: { color: COLORS.forest, fontSize: 12, fontWeight: "700" },
  editPanel: { gap: 11, marginTop: 4, paddingTop: 17, borderTopWidth: 1, borderTopColor: COLORS.border },
  failureRow: { gap: 8, backgroundColor: "#FBF0E5", borderRadius: 15, padding: 12 },
  failureText: { color: COLORS.error, fontSize: 13, fontWeight: "700", textAlign: "right" },
  inputLabel: { color: COLORS.forest, fontSize: 14, fontWeight: "800", textAlign: "right", marginTop: 2 },
  boundsRow: { flexDirection: "row-reverse", gap: 9 },
  boundsInput: { flex: 1, minHeight: 48, borderRadius: 13, borderWidth: 1, borderColor: "#DDD8CE", backgroundColor: "#FFFEFB", color: COLORS.forest, paddingHorizontal: 12, textAlign: "right" },
  editInput: { minHeight: 85, borderRadius: 13, borderWidth: 1, borderColor: "#DDD8CE", backgroundColor: "#FFFEFB", color: COLORS.forest, padding: 12, textAlign: "right", textAlignVertical: "top" },

  approvedCard: { flexDirection: "row-reverse", alignItems: "center", gap: 11, marginHorizontal: 18, borderRadius: 25, padding: 18, backgroundColor: "#EEF2E8" },
  approvedIcon: { width: 45, height: 45, borderRadius: 23, backgroundColor: "#DCE7D6", justifyContent: "center", alignItems: "center" },
  approvedCopyBlock: { flex: 1, gap: 3 },
  approvedTitle: { color: COLORS.forest, fontSize: 16, fontWeight: "800", textAlign: "right" },
  approvedCopy: { color: COLORS.forestMuted, fontSize: 12, textAlign: "right" },

  createCard: { marginHorizontal: 18, alignItems: "center", gap: 13, padding: 27, borderRadius: 28, backgroundColor: COLORS.card, shadowColor: "#5E5748", shadowOpacity: 0.06, shadowRadius: 13, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  createIcon: { width: 70, height: 70, borderRadius: 35, backgroundColor: "#E8EBDD", alignItems: "center", justifyContent: "center" },
  createTitle: { color: COLORS.forest, fontSize: 22, fontWeight: "800", textAlign: "center" },
  createCopy: { color: COLORS.forestMuted, fontSize: 14, lineHeight: 22, textAlign: "center" },

  entryIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: "#E8EBDD", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  entryTitle: { color: COLORS.forest, fontSize: 23, fontWeight: "800", textAlign: "center" },
  entryCopy: { maxWidth: 285, color: COLORS.forestMuted, fontSize: 14, lineHeight: 22, textAlign: "center", marginTop: 8 },
  entryAction: { alignSelf: "stretch", marginTop: 22 },
  loadingText: { marginTop: 13, color: COLORS.forestMuted, fontSize: 14 },

  planAction: { minHeight: 54, borderRadius: 16, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 17 },
  planActionCompact: { minHeight: 45, flex: 1, paddingHorizontal: 11, borderRadius: 14 },
  planActionPrimary: { backgroundColor: COLORS.forest },
  planActionSoft: { backgroundColor: "#E4E6D8" },
  planActionText: { fontSize: 15, fontWeight: "800" },
  planActionTextCompact: { fontSize: 12, fontWeight: "800" },
  planActionTextPrimary: { color: COLORS.ivory },
  planActionTextSoft: { color: COLORS.forest },
  actionDisabled: { opacity: 0.48 },
  pressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
});
