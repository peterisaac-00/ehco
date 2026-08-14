import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { QuizLifestyleScene, QuizScoreRing } from "@/components/quiz/quiz-visuals";
import { trpc } from "@/lib/trpc";

type QuizOutcome = {
  score: number;
  passed: boolean;
  planId: number;
  nextTaskUnlocked: boolean;
  isPlanComplete: boolean;
  nextSegmentPrepared?: boolean;
  nextSegmentFailed?: boolean;
  nextSegmentStartDay?: number | null;
};

const COLORS = {
  ivory: "#FDF9F4",
  cream: "#F7EDE0",
  card: "#FFFDF9",
  forest: "#254631",
  forestMuted: "#506452",
  sage: "#8EA18A",
  border: "#E9DFD3",
  muted: "#8E9288",
  error: "#B74D43",
  success: "#2D5A3D",
  successBg: "#E8F0E6",
} as const;

export default function QuizScreen() {
  const params = useLocalSearchParams<{ taskId: string }>();
  const taskId = Number(params.taskId);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [outcome, setOutcome] = useState<QuizOutcome | null>(null);
  const entrance = useRef(new Animated.Value(0)).current;
  const progressAnimation = useRef(new Animated.Value(0)).current;
  const utils = trpc.useUtils();
  const beginQuiz = trpc.tasks.beginQuiz.useMutation({ onError: (error) => Alert.alert("تعذر فتح الاختبار", error.message) });
  const submitQuiz = trpc.tasks.submitQuiz.useMutation({
    onSuccess: async (result) => {
      await Promise.all([utils.tasks.current.invalidate(), utils.calendar.get.invalidate()]);
      setOutcome(result);
    },
    onError: (error) => Alert.alert("تعذر تصحيح الاختبار", error.message),
  });
  const retrySegment = trpc.plans.retrySegment.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.tasks.current.invalidate(), utils.calendar.get.invalidate()]);
      Alert.alert("تم تجهيز الدفعة التالية", "يمكنك الآن متابعة المهمة التالية.");
      router.replace("/");
    },
    onError: (error) => Alert.alert("تعذر تجهيز الدفعة التالية", error.message),
  });

  useEffect(() => {
    if (Number.isInteger(taskId) && taskId > 0 && !beginQuiz.isPending && !beginQuiz.data) beginQuiz.mutate({ taskId });
  }, [taskId, beginQuiz]);

  const questions = useMemo(() => beginQuiz.data?.questions ?? [], [beginQuiz.data]);
  const answeredCount = useMemo(() => questions.filter((question) => answers[question.id]).length, [answers, questions]);
  const completed = questions.length > 0 && answeredCount === questions.length;
  const progressRatio = questions.length > 0 ? answeredCount / questions.length : 0;

  useEffect(() => {
    entrance.setValue(0);
    Animated.timing(entrance, { toValue: 1, duration: 280, useNativeDriver: true }).start();
  }, [entrance]);

  useEffect(() => {
    Animated.timing(progressAnimation, { toValue: progressRatio, duration: 240, useNativeDriver: false }).start();
  }, [progressAnimation, progressRatio]);

  const submit = () => submitQuiz.mutate({ taskId, answers: questions.map((question) => ({ questionId: question.id, optionId: answers[question.id] })) });
  const retry = () => {
    setAnswers({});
    setOutcome(null);
    beginQuiz.mutate({ taskId });
  };

  if (beginQuiz.isPending || !beginQuiz.data) {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]} containerClassName="bg-[#FDF9F4]">
        <View style={styles.centerContainer}>
          <ActivityIndicator color={COLORS.forest} size="large" />
          <Text style={styles.loadingText}>جاري تحضير أسئلة الاختبار...</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (outcome) {
    return (
      <QuizResult
        outcome={outcome}
        onRetry={retry}
        onRetrySegment={() => {
          if (outcome.nextSegmentStartDay) retrySegment.mutate({ planId: outcome.planId, startDay: outcome.nextSegmentStartDay });
        }}
        retryingSegment={retrySegment.isPending}
      />
    );
  }

  const animatedProgressWidth = progressAnimation.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} containerClassName="bg-[#FDF9F4]">
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <Animated.View style={[styles.header, { opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}>
            <QuizLifestyleScene compact />
            <View style={styles.eyebrowRow}>
              <Text style={styles.eyebrow}>اختبار قصير</Text>
              <View style={styles.badgeWrap}><Text style={styles.badgeText}>{questions.length} أسئلة</Text></View>
            </View>
            <Text style={styles.title}>{beginQuiz.data.task.title}</Text>
            <Text style={styles.instruction}>أجب عن الأسئلة لتثبت فهمك وتفتح خطوتك التالية.</Text>
            
            {/* Progress indicator */}
            <View style={styles.progressWrap}>
              <View style={styles.progressMeta}>
                <Text style={styles.progressLabel}>التقدم</Text>
                <Text style={styles.progressCount}>{answeredCount} / {questions.length}</Text>
              </View>
              <View style={styles.progressBarTrack}>
                <Animated.View style={[styles.progressBarFill, { width: animatedProgressWidth }]} />
              </View>
            </View>
          </Animated.View>

          {/* Question cards */}
          {questions.map((question, index) => {
            const hasAnswered = Boolean(answers[question.id]);
            return (
              <Animated.View key={question.id} style={[styles.questionCard, hasAnswered && styles.questionCardAnswered, { opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [16 + index * 4, 0] }) }] }]}>
                <View style={styles.questionHeading}>
                  <View style={styles.questionBadge}><Text style={styles.questionBadgeText}>{String(index + 1).padStart(2, "0")}</Text></View>
                  <Text style={styles.prompt}>{question.prompt}</Text>
                </View>
                <View style={styles.options}>
                  {question.options.map((option) => {
                    const selected = answers[question.id] === option.id;
                    return (
                      <Pressable
                        key={option.id}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        accessibilityLabel={`السؤال ${index + 1}: ${option.text}`}
                        onPress={() => setAnswers((current) => ({ ...current, [question.id]: option.id }))}
                        style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.optionPressed]}
                      >
                        <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{option.text}</Text>
                        <View style={[styles.radioIndicator, selected && styles.radioIndicatorSelected]}>
                          {selected ? <MaterialIcons name="check" size={14} color={COLORS.ivory} /> : null}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </Animated.View>
            );
          })}
        </ScrollView>

        {/* Anchored submit footer */}
        <View style={styles.footer}>
          <View style={styles.counterRow}>
            <MaterialIcons name={completed ? "check-circle" : "radio-button-unchecked"} size={18} color={completed ? COLORS.success : COLORS.forestMuted} />
            <Text style={[styles.counter, completed && styles.counterComplete]}>
              {completed ? "اكتملت كل الإجابات — جاهز للتحقق" : `تمت الإجابة على ${answeredCount} من ${questions.length}`}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !completed, busy: submitQuiz.isPending }}
            disabled={!completed || submitQuiz.isPending}
            onPress={submit}
            style={({ pressed }) => [styles.submitButton, (!completed || submitQuiz.isPending) && styles.submitButtonDisabled, pressed && completed && styles.pressed]}
          >
            {submitQuiz.isPending ? (
              <View style={styles.submitRow}>
                <ActivityIndicator color={COLORS.ivory} size="small" />
                <Text style={styles.submitButtonText}>جاري التحقق...</Text>
              </View>
            ) : (
              <View style={styles.submitRow}>
                <MaterialIcons name="arrow-back" size={20} color={COLORS.ivory} />
                <Text style={styles.submitButtonText}>{completed ? "تحقق من الإجابات" : "أكمل الإجابات للتحقق"}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>
    </ScreenContainer>
  );
}

function QuizResult({ outcome, onRetry, onRetrySegment, retryingSegment }: { outcome: QuizOutcome; onRetry: () => void; onRetrySegment: () => void; retryingSegment: boolean }) {
  const success = outcome.passed;
  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} containerClassName="bg-[#FDF9F4]">
      <ScrollView contentContainerStyle={styles.resultContent} showsVerticalScrollIndicator={false}>
        <View style={styles.resultScene}><QuizLifestyleScene /></View>
        <View style={styles.resultCard}>
          <View style={[styles.resultIconWrap, success ? styles.successIconWrap : styles.failIconWrap]}>
            <MaterialIcons name={success ? "verified" : "replay"} size={42} color={success ? COLORS.success : "#B45309"} />
          </View>
          <Text style={styles.resultEyebrow}>{success ? "أحسنت!" : "تحتاج محاولة أخرى"}</Text>
          <QuizScoreRing score={outcome.score} />
          <Text style={styles.resultTitle}>{success ? "نجحت في الاختبار بنجاح" : "لم تصل إلى نسبة النجاح المطلوبة"}</Text>
          <Text style={styles.resultCopy}>
            {success
              ? outcome.isPlanComplete
                ? "أنهيت آخر مهمة في خطتك التعليمية. يمكنك مراجعة خطتك الكاملة الآن."
                : "تم تسجيل النتيجة بنجاح وفتح خطوتك التالية في الرحلة."
              : "راجع تفاصيل المهمة بعناية ثم أعد المحاولة لتجاوز اختبار الفهم."}
          </Text>

          {success && outcome.nextSegmentPrepared && (
            <View style={styles.noteBox}><MaterialIcons name="auto-awesome" size={16} color={COLORS.forest} /><Text style={styles.noteText}>تم تجهيز تفاصيل الدفعة التالية تلقائيًا.</Text></View>
          )}
          {success && outcome.nextSegmentFailed && (
            <View style={[styles.noteBox, styles.failNoteBox]}><MaterialIcons name="error-outline" size={16} color="#B45309" /><Text style={[styles.noteText, styles.failNoteText]}>تم تسجيل نجاحك، لكن تعذر تجهيز الدفعة التالية مؤقتًا.</Text></View>
          )}

          <View style={styles.resultActions}>
            {success && outcome.nextSegmentFailed && outcome.nextSegmentStartDay && (
              <Pressable accessibilityRole="button" onPress={onRetrySegment} disabled={retryingSegment} style={({ pressed }) => [styles.actionButton, styles.secondaryAction, pressed && styles.pressed]}>
                {retryingSegment ? <ActivityIndicator color={COLORS.forest} /> : <Text style={styles.secondaryActionText}>إعادة تجهيز الدفعة التالية</Text>}
              </Pressable>
            )}
            {success ? (
              <Pressable accessibilityRole="button" onPress={() => router.replace(outcome.isPlanComplete ? "/(tabs)/plan" : "/")} style={({ pressed }) => [styles.actionButton, styles.primaryAction, pressed && styles.pressed]}>
                <MaterialIcons name="arrow-back" size={18} color={COLORS.ivory} />
                <Text style={styles.primaryActionText}>{outcome.isPlanComplete ? "العودة إلى الخطة" : "فتح مهمة اليوم"}</Text>
              </Pressable>
            ) : (
              <Pressable accessibilityRole="button" onPress={onRetry} style={({ pressed }) => [styles.actionButton, styles.primaryAction, pressed && styles.pressed]}>
                <MaterialIcons name="replay" size={18} color={COLORS.ivory} />
                <Text style={styles.primaryActionText}>إعادة الاختبار</Text>
              </Pressable>
            )}
            <Pressable accessibilityRole="button" onPress={() => router.replace("/")} style={({ pressed }) => [styles.actionButton, styles.secondaryAction, pressed && styles.pressed]}>
              <Text style={styles.secondaryActionText}>العودة إلى الرئيسية</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  centerContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { color: COLORS.forestMuted, fontSize: 15, fontWeight: "600" },
  root: { flex: 1 },
  content: { gap: 20, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 28 },
  header: { gap: 8, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 24, padding: 20 },
  eyebrowRow: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" },
  eyebrow: { color: COLORS.forestMuted, fontSize: 13, fontWeight: "700" },
  badgeWrap: { backgroundColor: COLORS.cream, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  badgeText: { color: COLORS.forest, fontSize: 12, fontWeight: "800" },
  title: { color: COLORS.forest, fontSize: 24, fontWeight: "800", lineHeight: 32, textAlign: "right" },
  instruction: { color: COLORS.forestMuted, fontSize: 14, lineHeight: 21, textAlign: "right" },
  progressWrap: { gap: 6, marginTop: 4 },
  progressMeta: { flexDirection: "row-reverse", justifyContent: "space-between" },
  progressLabel: { color: COLORS.forestMuted, fontSize: 12, fontWeight: "700" },
  progressCount: { color: COLORS.forest, fontSize: 12, fontWeight: "800" },
  progressBarTrack: { height: 6, backgroundColor: COLORS.cream, borderRadius: 3, overflow: "hidden" },
  progressBarFill: { height: "100%", backgroundColor: COLORS.forest, borderRadius: 3 },
  questionCard: { gap: 14, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 22, padding: 18 },
  questionCardAnswered: { borderColor: "#D5E2CE" },
  questionHeading: { flexDirection: "row-reverse", alignItems: "flex-start", gap: 12 },
  questionBadge: { width: 32, height: 32, borderRadius: 12, backgroundColor: COLORS.cream, alignItems: "center", justifyContent: "center" },
  questionBadgeText: { color: COLORS.forest, fontSize: 13, fontWeight: "800" },
  prompt: { flex: 1, color: COLORS.forest, fontSize: 16, fontWeight: "700", lineHeight: 24, textAlign: "right" },
  options: { gap: 10 },
  option: { minHeight: 56, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, backgroundColor: "#FAF6F0" },
  optionSelected: { borderColor: COLORS.forest, backgroundColor: COLORS.successBg, borderWidth: 1.5 },
  optionPressed: { opacity: 0.85 },
  optionText: { flex: 1, color: COLORS.forest, fontSize: 15, fontWeight: "600", textAlign: "right", paddingLeft: 10 },
  optionTextSelected: { color: COLORS.forest, fontWeight: "800" },
  radioIndicator: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: COLORS.border, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.card },
  radioIndicatorSelected: { borderColor: COLORS.forest, backgroundColor: COLORS.forest },
  footer: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 16, backgroundColor: COLORS.card, borderTopWidth: 1, borderTopColor: COLORS.border, gap: 12 },
  counterRow: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8 },
  counter: { color: COLORS.forestMuted, fontSize: 13, fontWeight: "700" },
  counterComplete: { color: COLORS.success },
  submitButton: { minHeight: 56, borderRadius: 18, backgroundColor: COLORS.forest, alignItems: "center", justifyContent: "center", shadowColor: COLORS.forest, shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  submitButtonDisabled: { opacity: 0.45 },
  submitRow: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  submitButtonText: { color: COLORS.ivory, fontSize: 16, fontWeight: "800" },
  resultContent: { flexGrow: 1, justifyContent: "center", padding: 20 },
  resultCard: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 28, padding: 24, alignItems: "center", gap: 16 },
  resultIconWrap: { width: 84, height: 84, borderRadius: 42, alignItems: "center", justifyContent: "center" },
  successIconWrap: { backgroundColor: COLORS.successBg },
  failIconWrap: { backgroundColor: "#FEF3C7" },
  resultEyebrow: { color: COLORS.forestMuted, fontSize: 15, fontWeight: "700" },
  resultTitle: { color: COLORS.forest, fontSize: 20, fontWeight: "800", textAlign: "center" },
  resultCopy: { color: COLORS.forestMuted, fontSize: 15, lineHeight: 22, textAlign: "center", maxWidth: 290 },
  noteBox: { flexDirection: "row-reverse", alignItems: "center", gap: 8, backgroundColor: COLORS.successBg, borderWidth: 1, borderColor: "#D0E2C8", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14 },
  failNoteBox: { backgroundColor: "#FEF3C7", borderColor: "#FDE68A" },
  noteText: { color: COLORS.forest, fontSize: 13, fontWeight: "700", textAlign: "right" },
  failNoteText: { color: "#92400E" },
  resultActions: { alignSelf: "stretch", gap: 10, marginTop: 4 },
  resultScene: { width: "100%", paddingHorizontal: 4, paddingBottom: 4 },
  actionButton: { minHeight: 54, borderRadius: 16, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8 },
  primaryAction: { backgroundColor: COLORS.forest },
  primaryActionText: { color: COLORS.ivory, fontSize: 15, fontWeight: "800" },
  secondaryAction: { backgroundColor: COLORS.cream, borderWidth: 1, borderColor: COLORS.border },
  secondaryActionText: { color: COLORS.forest, fontSize: 15, fontWeight: "800" },
  pressed: { opacity: 0.85, transform: [{ scale: 0.985 }] },
});
