import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { PrimaryButton } from "@/components/primary-button";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";

export default function QuizScreen() {
  const params = useLocalSearchParams<{ taskId: string }>();
  const taskId = Number(params.taskId);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const beginQuiz = trpc.tasks.beginQuiz.useMutation({ onError: (error) => Alert.alert("تعذر فتح الاختبار", error.message) });
  const submitQuiz = trpc.tasks.submitQuiz.useMutation({
    onSuccess: (result) => {
      Alert.alert(result.passed ? "أحسنت" : "حاول مرة أخرى", result.passed ? `نتيجتك ${result.score}% وتم فتح الخطوة التالية.` : `نتيجتك ${result.score}%. راجع المهمة ثم أعد المحاولة.`, [{ text: "متابعة", onPress: () => router.replace("/(tabs)") }]);
    },
    onError: (error) => Alert.alert("تعذر تصحيح الاختبار", error.message),
  });

  useEffect(() => {
    if (Number.isInteger(taskId) && taskId > 0 && !beginQuiz.isPending && !beginQuiz.data) beginQuiz.mutate({ taskId });
  }, [taskId, beginQuiz]);

  const questions = useMemo(() => beginQuiz.data?.questions ?? [], [beginQuiz.data]);
  const completed = useMemo(() => questions.length > 0 && questions.every((question) => answers[question.id]), [answers, questions]);
  const submit = () => submitQuiz.mutate({ taskId, answers: questions.map((question) => ({ questionId: question.id, optionId: answers[question.id] })) });

  if (beginQuiz.isPending || !beginQuiz.data) return <ScreenContainer className="items-center justify-center"><ActivityIndicator color="#4F46E5" size="large" /></ScreenContainer>;

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-5">
      <ScrollView contentContainerStyle={styles.content}>
        <View><Text style={styles.eyebrow}>اختبار قصير</Text><Text style={styles.title}>{beginQuiz.data.task.title}</Text></View>
        {questions.map((question, index) => (
          <View key={question.id} style={styles.questionCard}>
            <Text style={styles.prompt}>{index + 1}. {question.prompt}</Text>
            <View style={styles.options}>
              {question.options.map((option) => {
                const selected = answers[question.id] === option.id;
                return <Pressable key={option.id} onPress={() => setAnswers((current) => ({ ...current, [question.id]: option.id }))} style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.optionPressed]}><Text style={[styles.optionText, selected && styles.optionTextSelected]}>{option.text}</Text></Pressable>;
              })}
            </View>
          </View>
        ))}
        <PrimaryButton label="إرسال الإجابات" onPress={submit} disabled={!completed} loading={submitQuiz.isPending} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { gap: 18, paddingVertical: 12, paddingBottom: 28 },
  eyebrow: { color: "#4F46E5", fontSize: 13, fontWeight: "800", textAlign: "right" },
  title: { color: "#0F172A", fontSize: 25, fontWeight: "800", marginTop: 4, textAlign: "right" },
  questionCard: { gap: 14, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0", padding: 18, borderRadius: 20 },
  prompt: { color: "#0F172A", fontSize: 16, fontWeight: "700", lineHeight: 24, textAlign: "right" },
  options: { gap: 8 },
  option: { borderWidth: 1, borderColor: "#CBD5E1", padding: 14, borderRadius: 12, backgroundColor: "#F8FAFC" },
  optionSelected: { borderColor: "#4F46E5", backgroundColor: "#EEF2FF" },
  optionPressed: { opacity: 0.8 },
  optionText: { color: "#334155", fontSize: 15, textAlign: "right" },
  optionTextSelected: { color: "#3730A3", fontWeight: "700" },
});
