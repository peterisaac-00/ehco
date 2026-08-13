import { router } from "expo-router";
import { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { PrimaryButton } from "@/components/primary-button";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";

const LEVELS = [
  { key: "beginner", label: "مبتدئ" },
  { key: "intermediate", label: "متوسط" },
  { key: "advanced", label: "متقدم" },
] as const;

export default function OnboardingScreen() {
  const [title, setTitle] = useState("");
  const [level, setLevel] = useState<(typeof LEVELS)[number]["key"]>("beginner");
  const [dailyMinutes, setDailyMinutes] = useState("60");
  const [duration, setDuration] = useState("30");
  const createGoal = trpc.goals.create.useMutation({
    onSuccess: () => router.replace("/(tabs)/plan"),
    onError: (error) => Alert.alert("تعذر إنشاء الهدف", error.message),
  });

  const submit = () => {
    const minutes = Number(dailyMinutes);
    const days = Number(duration);
    if (title.trim().length < 3 || !Number.isInteger(minutes) || !Number.isInteger(days)) {
      Alert.alert("راجع البيانات", "اكتب هدفًا واضحًا وحدد وقتًا ومدة صالحين.");
      return;
    }
    createGoal.mutate({ title: title.trim(), currentLevel: level, dailyMinutes: minutes, targetDurationDays: days });
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-5">
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View className="gap-2">
          <Text className="text-sm font-semibold text-primary">خطوتك الأولى</Text>
          <Text className="text-3xl font-bold text-foreground">لنصمّم مسارك</Text>
          <Text className="text-base leading-6 text-muted">سيحوّل Ehco هدفك إلى خريطة تعلم، ثم يجهّز المهام التفصيلية تدريجيًا.</Text>
        </View>

        <View style={styles.form}>
          <Label text="ما الهدف الذي تريد تحقيقه؟" />
          <TextInput value={title} onChangeText={setTitle} placeholder="مثال: تحسين الإنجليزية للمحادثة" placeholderTextColor="#94A3B8" style={styles.input} maxLength={160} returnKeyType="next" />

          <Label text="مستواك الحالي" />
          <View style={styles.levelRow}>
            {LEVELS.map((item) => (
              <PrimaryButton key={item.key} label={item.label} variant={level === item.key ? "primary" : "secondary"} onPress={() => setLevel(item.key)} style={styles.levelButton} />
            ))}
          </View>

          <Label text="دقائق متاحة يوميًا" />
          <TextInput value={dailyMinutes} onChangeText={setDailyMinutes} keyboardType="number-pad" style={styles.input} maxLength={3} />

          <Label text="مدة المسار بالأيام (حتى 90)" />
          <TextInput value={duration} onChangeText={setDuration} keyboardType="number-pad" style={styles.input} maxLength={2} />
        </View>

        <PrimaryButton label="إنشاء خريطة التعلم" onPress={submit} loading={createGoal.isPending} />
      </ScrollView>
    </ScreenContainer>
  );
}

function Label({ text }: { text: string }) {
  return <Text className="mt-2 text-sm font-semibold text-foreground">{text}</Text>;
}

const styles = StyleSheet.create({
  content: { gap: 28, paddingVertical: 12, paddingBottom: 28 },
  form: { gap: 10, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 20, padding: 18 },
  input: { minHeight: 52, borderWidth: 1, borderColor: "#CBD5E1", backgroundColor: "#F8FAFC", borderRadius: 12, color: "#0F172A", fontSize: 16, paddingHorizontal: 14, textAlign: "right" },
  levelRow: { flexDirection: "row", gap: 8 },
  levelButton: { flex: 1, minHeight: 44, paddingHorizontal: 8 },
});
