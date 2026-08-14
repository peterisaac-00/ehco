import { router } from "expo-router";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";

import { GoalJourneyHeader, InlineError, JourneyPrimaryButton, JourneyTextField, LevelChoice, PresetChoice, ReviewCard, StepIllustration, StepMotion, StepTitle, ValueEditor } from "@/components/onboarding/goal-journey-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useLanguage } from "@/lib/i18n";
import { buildGoalPayload, isDailyMinutesValid, isDurationDaysValid, isGoalTitleValid, isOnboardingStepValid } from "@/lib/onboarding-rules";
import { trpc } from "@/lib/trpc";

type LearningLevel = "beginner" | "intermediate" | "advanced";

const TIME_PRESETS = [30, 60, 90, 120, 180];
const DURATION_PRESETS = [14, 30, 60, 90, 120, 150];

export default function OnboardingScreen() {
  const { t } = useLanguage();
  const [currentStep, setCurrentStep] = useState(1);
  const [title, setTitle] = useState("");
  const [level, setLevel] = useState<LearningLevel>("beginner");
  const [dailyMinutes, setDailyMinutes] = useState("60");
  const [duration, setDuration] = useState("30");
  const [showValidation, setShowValidation] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const minutes = Number(dailyMinutes);
  const days = Number(duration);
  const onboardingState = { title, currentLevel: level, dailyMinutes, targetDurationDays: duration };
  const validTitle = isGoalTitleValid(title);
  const validMinutes = isDailyMinutesValid(dailyMinutes);
  const validDays = isDurationDaysValid(duration);
  const activeValid = isOnboardingStepValid(currentStep, onboardingState);

  const createGoal = trpc.goals.create.useMutation({
    onSuccess: () => router.replace("/(tabs)/plan"),
    onError: (error) => {
      if (error.data?.code === "CONFLICT") {
        Alert.alert(t("onboarding.existingGoal"), t("onboarding.existingGoalCopy"), [
          { text: t("common.openPlan"), onPress: () => router.replace("/(tabs)/plan") },
          { text: t("onboarding.ok"), style: "cancel" },
        ]);
        return;
      }
      setSubmissionError(error.message);
    },
  });

  const next = () => {
    if (!activeValid) { setShowValidation(true); return; }
    setShowValidation(false);
    setCurrentStep((step) => Math.min(4, step + 1));
  };
  const back = () => { setShowValidation(false); setSubmissionError(null); setCurrentStep((step) => Math.max(1, step - 1)); };
  const submit = () => {
    const payload = buildGoalPayload(onboardingState);
    if (!payload) { setShowValidation(true); return; }
    setSubmissionError(null);
    createGoal.mutate(payload);
  };

  return <ScreenContainer edges={["top", "bottom", "left", "right"]} containerClassName="bg-[#FDF9F4]"><KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}><ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"} contentContainerStyle={styles.content}><GoalJourneyHeader step={currentStep} onBack={back} /><StepMotion step={currentStep}><StepIllustration step={currentStep} />{currentStep === 1 ? <GoalStep title={title} onChangeTitle={setTitle} showError={showValidation && !validTitle} /> : null}{currentStep === 2 ? <LevelStep level={level} onChangeLevel={setLevel} /> : null}{currentStep === 3 ? <TimeStep dailyMinutes={dailyMinutes} onChangeDailyMinutes={setDailyMinutes} showError={showValidation && !validMinutes} /> : null}{currentStep === 4 ? <DurationStep duration={duration} onChangeDuration={setDuration} showError={showValidation && !validDays} title={title.trim()} level={t(`common.level.${level}`)} minutes={minutes} days={days} submissionError={submissionError} /> : null}</StepMotion><View style={styles.footer}><JourneyPrimaryButton label={currentStep === 4 ? t("onboarding.buildPlan") : t("onboarding.next")} onPress={currentStep === 4 ? submit : next} loading={currentStep === 4 && createGoal.isPending} disabled={currentStep === 4 ? !validTitle || !validMinutes || !validDays : !activeValid} /></View></ScrollView></KeyboardAvoidingView></ScreenContainer>;
}

function GoalStep({ title, onChangeTitle, showError }: { title: string; onChangeTitle: (value: string) => void; showError: boolean }) {
  const { t } = useLanguage();
  return <View style={styles.step}><StepTitle title={t("onboarding.goalTitle")} copy={t("onboarding.goalCopy")} /><View style={styles.interaction}><JourneyTextField label={t("onboarding.goalLabel")} value={title} onChangeText={onChangeTitle} placeholder={t("onboarding.goalPlaceholder")} maxLength={160} returnKeyType="next" error={showError ? t("onboarding.goalValidation") : undefined} /></View></View>;
}

function LevelStep({ level, onChangeLevel }: { level: LearningLevel; onChangeLevel: (value: LearningLevel) => void }) {
  const { t } = useLanguage();
  const levels = [{ key: "beginner" as const, description: t("onboarding.beginnerCopy"), icon: "school" as const }, { key: "intermediate" as const, description: t("onboarding.intermediateCopy"), icon: "trending-up" as const }, { key: "advanced" as const, description: t("onboarding.advancedCopy"), icon: "workspace-premium" as const }];
  return <View style={styles.step}><StepTitle title={t("onboarding.levelTitle")} copy={t("onboarding.levelCopy")} /><View style={styles.interaction}>{levels.map((item) => <LevelChoice key={item.key} title={t(`common.level.${item.key}`)} description={item.description} icon={item.icon} selected={level === item.key} onPress={() => onChangeLevel(item.key)} />)}</View></View>;
}

function TimeStep({ dailyMinutes, onChangeDailyMinutes, showError }: { dailyMinutes: string; onChangeDailyMinutes: (value: string) => void; showError: boolean }) {
  const { t } = useLanguage();
  const value = Number(dailyMinutes);
  return <View style={styles.step}><StepTitle title={t("onboarding.timeTitle")} copy={t("onboarding.timeCopy")} /><View style={styles.interaction}>{TIME_PRESETS.map((minutes) => <PresetChoice key={minutes} label={t("common.minutes", { count: minutes })} icon="schedule" selected={value === minutes} onPress={() => onChangeDailyMinutes(String(minutes))} />)}<ValueEditor label={t("onboarding.customMinutes")} suffix={t("onboarding.minutesSuffix")} value={dailyMinutes} onChangeText={onChangeDailyMinutes} error={showError ? t("onboarding.minutesValidation") : undefined} /></View></View>;
}

function DurationStep({ duration, onChangeDuration, showError, title, level, minutes, days, submissionError }: { duration: string; onChangeDuration: (value: string) => void; showError: boolean; title: string; level: string; minutes: number; days: number; submissionError: string | null }) {
  const { t } = useLanguage();
  const value = Number(duration);
  return <View style={styles.step}><StepTitle title={t("onboarding.durationTitle")} copy={t("onboarding.durationCopy")} /><View style={styles.interaction}>{DURATION_PRESETS.map((preset) => <PresetChoice key={preset} label={t("common.days", { count: preset })} icon="calendar-month" selected={value === preset} onPress={() => onChangeDuration(String(preset))} />)}<ValueEditor label={t("onboarding.customDays")} suffix={t("onboarding.daySuffix")} value={duration} onChangeText={onChangeDuration} error={showError ? t("onboarding.daysValidation") : undefined} /><View style={styles.reviewTitleWrap}><StepTitle title={t("onboarding.reviewTitle")} copy={t("onboarding.reviewCopy")} /></View><ReviewCard title={title} level={level} minutes={minutes} days={days} />{submissionError ? <InlineError message={submissionError} /> : null}</View></View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, paddingBottom: 24, gap: 18 },
  step: { gap: 20 },
  interaction: { marginHorizontal: 22, gap: 10 },
  footer: { paddingHorizontal: 22, paddingTop: 2 },
  reviewTitleWrap: { marginTop: 9 },
});
