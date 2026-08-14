import { router } from "expo-router";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";

import { GoalJourneyHeader, InlineError, JourneyPrimaryButton, JourneyTextField, LevelChoice, PresetChoice, ReviewCard, StepIllustration, StepMotion, StepTitle, ValueEditor } from "@/components/onboarding/goal-journey-ui";
import { ScreenContainer } from "@/components/screen-container";
import { buildGoalPayload, isDailyMinutesValid, isDurationDaysValid, isGoalTitleValid, isOnboardingStepValid } from "@/lib/onboarding-rules";
import { trpc } from "@/lib/trpc";

const LEVELS = [
  { key: "beginner", label: "مبتدئ", description: "أبدأ من الأساسيات", icon: "school" as const },
  { key: "intermediate", label: "متوسط", description: "لدي معرفة وأريد تطويرها", icon: "trending-up" as const },
  { key: "advanced", label: "متقدم", description: "أريد الوصول إلى مستوى احترافي", icon: "workspace-premium" as const },
] as const;

const TIME_PRESETS = [30, 60, 90, 120, 180];
const DURATION_PRESETS = [14, 30, 60, 90];

export default function OnboardingScreen() {
  const [currentStep, setCurrentStep] = useState(1);
  const [title, setTitle] = useState("");
  const [level, setLevel] = useState<(typeof LEVELS)[number]["key"]>("beginner");
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
        Alert.alert("لديك هدف قائم", "تم حفظ هدفك بالفعل. افتح الخطة الحالية لإنشاء مسار التعلم أو متابعته.", [
          { text: "فتح الخطة", onPress: () => router.replace("/(tabs)/plan") },
          { text: "حسنًا", style: "cancel" },
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

  return <ScreenContainer edges={["top", "bottom", "left", "right"]} containerClassName="bg-[#FDF9F4]"><KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}><ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}><GoalJourneyHeader step={currentStep} onBack={back} /><StepMotion step={currentStep}><StepIllustration step={currentStep} />{currentStep === 1 ? <GoalStep title={title} onChangeTitle={setTitle} showError={showValidation && !validTitle} /> : null}{currentStep === 2 ? <LevelStep level={level} onChangeLevel={setLevel} /> : null}{currentStep === 3 ? <TimeStep dailyMinutes={dailyMinutes} onChangeDailyMinutes={setDailyMinutes} showError={showValidation && !validMinutes} /> : null}{currentStep === 4 ? <DurationStep duration={duration} onChangeDuration={setDuration} showError={showValidation && !validDays} title={title.trim()} level={LEVELS.find((item) => item.key === level)?.label ?? ""} minutes={minutes} days={days} submissionError={submissionError} /> : null}</StepMotion><View style={styles.footer}><JourneyPrimaryButton label={currentStep === 4 ? "بناء خطتي" : "التالي"} onPress={currentStep === 4 ? submit : next} loading={currentStep === 4 && createGoal.isPending} disabled={currentStep === 4 ? !validTitle || !validMinutes || !validDays : !activeValid} /></View></ScrollView></KeyboardAvoidingView></ScreenContainer>;
}

function GoalStep({ title, onChangeTitle, showError }: { title: string; onChangeTitle: (value: string) => void; showError: boolean }) {
  return <View style={styles.step}><StepTitle title="ما الهدف الذي تريد تحقيقه؟" copy="ابدأ بالشيء الذي تريد الوصول إليه، وسنساعدك على تحويله إلى طريق واضح." /><View style={styles.interaction}><JourneyTextField label="هدفك" value={title} onChangeText={onChangeTitle} placeholder="مثال: تحسين الإنجليزية للمحادثة" maxLength={160} returnKeyType="next" error={showError ? "اكتب هدفًا من 3 أحرف على الأقل." : undefined} /></View></View>;
}

function LevelStep({ level, onChangeLevel }: { level: (typeof LEVELS)[number]["key"]; onChangeLevel: (value: (typeof LEVELS)[number]["key"]) => void }) {
  return <View style={styles.step}><StepTitle title="أين أنت الآن؟" copy="اختر المستوى الأقرب إلى خبرتك الحالية." /><View style={styles.interaction}>{LEVELS.map((item) => <LevelChoice key={item.key} title={item.label} description={item.description} icon={item.icon} selected={level === item.key} onPress={() => onChangeLevel(item.key)} />)}</View></View>;
}

function TimeStep({ dailyMinutes, onChangeDailyMinutes, showError }: { dailyMinutes: string; onChangeDailyMinutes: (value: string) => void; showError: boolean }) {
  const value = Number(dailyMinutes);
  return <View style={styles.step}><StepTitle title="كم من الوقت تستطيع أن تمنح نفسك يوميًا؟" copy="اختر وقتًا يمكنك الالتزام به بشكل واقعي." /><View style={styles.interaction}>{TIME_PRESETS.map((minutes) => <PresetChoice key={minutes} label={`${minutes} دقيقة`} icon="schedule" selected={value === minutes} onPress={() => onChangeDailyMinutes(String(minutes))} />)}<ValueEditor label="أو أدخل دقائق مخصصة" suffix="دقيقة" value={dailyMinutes} onChangeText={onChangeDailyMinutes} error={showError ? "اختر وقتًا صحيحًا بين 30 و480 دقيقة." : undefined} /></View></View>;
}

function DurationStep({ duration, onChangeDuration, showError, title, level, minutes, days, submissionError }: { duration: string; onChangeDuration: (value: string) => void; showError: boolean; title: string; level: string; minutes: number; days: number; submissionError: string | null }) {
  const value = Number(duration);
  return <View style={styles.step}><StepTitle title="متى تريد الوصول إلى هدفك؟" copy="اختر مدة طموحة، لكن يمكن الالتزام بها." /><View style={styles.interaction}>{DURATION_PRESETS.map((preset) => <PresetChoice key={preset} label={`${preset} يوم`} icon="calendar-month" selected={value === preset} onPress={() => onChangeDuration(String(preset))} />)}<ValueEditor label="أو أدخل عدد أيام مخصصًا" suffix="يوم" value={duration} onChangeText={onChangeDuration} error={showError ? "اختر مدة صحيحة بين يوم واحد و90 يومًا." : undefined} /><View style={styles.reviewTitleWrap}><StepTitle title="رحلتك تبدأ من هنا" copy="راجع اختياراتك قبل أن نبني مسارك." /></View><ReviewCard title={title} level={level} minutes={minutes} days={days} />{submissionError ? <InlineError message={submissionError} /> : null}</View></View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, paddingBottom: 24, gap: 18 },
  step: { gap: 20 },
  interaction: { marginHorizontal: 22, gap: 10 },
  footer: { paddingHorizontal: 22, paddingTop: 2 },
  reviewTitleWrap: { marginTop: 9 },
});
