import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { PrimaryButton } from "@/components/primary-button";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";

type QuizOutcome = {
  score: number;
  passed: boolean;
  nextTaskUnlocked: boolean;
  isPlanComplete: boolean;
  nextSegmentPrepared?: boolean;
};

export default function QuizScreen() {
  const params = useLocalSearchParams<{ taskId: string }>();
  const taskId = Number(params.taskId);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [outcome, setOutcome] = useState<QuizOutcome | null>(null);
  const utils = trpc.useUtils();
  const beginQuiz = trpc.tasks.beginQuiz.useMutation({ onError: (error) => Alert.alert("تعذر فتح الاختبار", error.message) });
  const submitQuiz = trpc.tasks.submitQuiz.useMutation({
    onSuccess: async (result) => {
      await Promise.all([utils.tasks.current.invalidate(), utils.calendar.get.invalidate()]);
      setOutcome(result);
    },
    onError: (error) => Alert.alert("تعذر تصحيح الاختبار", error.message),
  });

  useEffect(() => {
    if (Number.isInteger(taskId) && taskId > 0 && !beginQuiz.isPending && !beginQuiz.data) beginQuiz.mutate({ taskId });
  }, [taskId, beginQuiz]);

  const questions = useMemo(() => beginQuiz.data?.questions ?? [], [beginQuiz.data]);
  const answeredCount = useMemo(() => questions.filter((question) => answers[question.id]).length, [answers, questions]);
  const completed = questions.length > 0 && answeredCount === questions.length;
  const remaining = questions.length - answeredCount;
  const submit = () => submitQuiz.mutate({ taskId, answers: questions.map((question) => ({ questionId: question.id, optionId: answers[question.id] })) });
  const retry = () => {
    setAnswers({});
    setOutcome(null);
    beginQuiz.mutate({ taskId });
  };

  if (beginQuiz.isPending || !beginQuiz.data) return <ScreenContainer className="items-center justify-center"><ActivityIndicator color="#4F46E5" size="large" /></ScreenContainer>;
  if (outcome) return <QuizResult outcome={outcome} onRetry={retry} />;

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <Text style={styles.eyebrow}>اختبار قصير</Text>
            <Text style={styles.title}>{beginQuiz.data.task.title}</Text>
            <Text style={styles.instruction}>اختر إجابة واحدة لكل سؤال، ثم اضغط «تحقق من الإجابات» في الأسفل.</Text>
          </View>
          {questions.map((question, index) => (
            <View key={question.id} style={styles.questionCard}>
              <View style={styles.questionHeading}><Text style={styles.questionBadge}>{index + 1}</Text><Text style={styles.prompt}>{question.prompt}</Text></View>
              <View style={styles.options}>
                {question.options.map((option) => {
                  const selected = answers[question.id] === option.id;
                  return <Pressable key={option.id} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => setAnswers((current) => ({ ...current, [question.id]: option.id }))} style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.optionPressed]}><Text style={[styles.optionText, selected && styles.optionTextSelected]}>{option.text}</Text></Pressable>;
                })}
              </View>
            </View>
          ))}
        </ScrollView>
        <View style={styles.footer}>
          <Text style={[styles.counter, completed && styles.counterComplete]}>{completed ? "اكتملت كل الإجابات — جاهز للتحقق" : `أجبت عن ${answeredCount} من ${questions.length} · متبقي ${remaining}`}</Text>
          <PrimaryButton label={completed ? "تحقق من الإجابات" : "أكمل الإجابات للتحقق"} onPress={submit} disabled={!completed} loading={submitQuiz.isPending} />
        </View>
      </View>
    </ScreenContainer>
  );
}

function QuizResult({ outcome, onRetry }: { outcome: QuizOutcome; onRetry: () => void }) {
  const success = outcome.passed;
  const message = success
    ? outcome.isPlanComplete ? "أنهيت آخر مهمة في خطتك." : "تم تسجيل النتيجة وفتح خطوتك التالية."
    : "لم تصل إلى درجة النجاح بعد. راجع المهمة ثم أعد المحاولة.";
  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} className="p-5">
      <View style={styles.resultRoot}>
        <View style={[styles.resultIcon, success ? styles.successIcon : styles.retryIcon]}><Text style={styles.resultIconText}>{success ? "✓" : "↻"}</Text></View>
        <Text style={styles.resultEyebrow}>{success ? "نجحت في الاختبار" : "تحتاج محاولة أخرى"}</Text>
        <Text style={styles.score}>{outcome.score}%</Text>
        <Text style={styles.resultCopy}>{message}</Text>
        {success && outcome.nextSegmentPrepared && <Text style={styles.segmentNote}>تم تجهيز تفاصيل الدفعة التالية تلقائيًا.</Text>}
        <View style={styles.resultActions}>
          {success ? <PrimaryButton label={outcome.isPlanComplete ? "العودة إلى الخطة" : "فتح مهمة اليوم"} onPress={() => router.replace(outcome.isPlanComplete ? "/(tabs)/plan" : "/")} /> : <PrimaryButton label="إعادة الاختبار" onPress={onRetry} />}
          <PrimaryButton label="العودة إلى الرئيسية" variant="secondary" onPress={() => router.replace("/")} />
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { gap: 18, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20 },
  header: { gap: 5, paddingBottom: 2 },
  eyebrow: { color: "#4F46E5", fontSize: 13, fontWeight: "800", textAlign: "right" },
  title: { color: "#0F172A", fontSize: 25, fontWeight: "800", textAlign: "right" },
  instruction: { color: "#64748B", fontSize: 14, lineHeight: 21, textAlign: "right" },
  questionCard: { gap: 14, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0", padding: 18, borderRadius: 20 },
  questionHeading: { flexDirection: "row-reverse", alignItems: "flex-start", gap: 10 },
  questionBadge: { minWidth: 28, height: 28, borderRadius: 14, paddingTop: 4, backgroundColor: "#EEF2FF", color: "#4338CA", fontSize: 13, fontWeight: "800", textAlign: "center" },
  prompt: { flex: 1, color: "#0F172A", fontSize: 16, fontWeight: "700", lineHeight: 24, textAlign: "right" },
  options: { gap: 8 },
  option: { borderWidth: 1, borderColor: "#CBD5E1", padding: 14, borderRadius: 12, backgroundColor: "#F8FAFC" },
  optionSelected: { borderColor: "#4F46E5", borderWidth: 2, backgroundColor: "#EEF2FF" },
  optionPressed: { opacity: 0.8 },
  optionText: { color: "#334155", fontSize: 15, textAlign: "right" },
  optionTextSelected: { color: "#3730A3", fontWeight: "700" },
  footer: { gap: 10, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, backgroundColor: "#FFFFFF", borderTopWidth: 1, borderTopColor: "#E2E8F0" },
  counter: { color: "#64748B", fontSize: 13, fontWeight: "600", textAlign: "center" },
  counterComplete: { color: "#047857" },
  resultRoot: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14 },
  resultIcon: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center" },
  successIcon: { backgroundColor: "#D1FAE5" },
  retryIcon: { backgroundColor: "#FEF3C7" },
  resultIconText: { color: "#047857", fontSize: 42, fontWeight: "800" },
  resultEyebrow: { color: "#475569", fontSize: 16, fontWeight: "700" },
  score: { color: "#0F172A", fontSize: 52, fontWeight: "800" },
  resultCopy: { maxWidth: 310, color: "#64748B", fontSize: 16, lineHeight: 24, textAlign: "center" },
  segmentNote: { color: "#4338CA", fontSize: 13, fontWeight: "600", textAlign: "center" },
  resultActions: { alignSelf: "stretch", gap: 10, marginTop: 10 },
});
