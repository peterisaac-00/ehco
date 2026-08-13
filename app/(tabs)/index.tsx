import { router } from "expo-router";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";

import { PrimaryButton } from "@/components/primary-button";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/hooks/use-auth";
import { startOAuthLogin } from "@/constants/oauth";
import { trpc } from "@/lib/trpc";

/**
 * Home Screen - NativeWind Example
 *
 * This template uses NativeWind (Tailwind CSS for React Native).
 * You can use familiar Tailwind classes directly in className props.
 *
 * Key patterns:
 * - Use `className` instead of `style` for most styling
 * - Theme colors: use tokens directly (bg-background, text-foreground, bg-primary, etc.); no dark: prefix needed
 * - Responsive: standard Tailwind breakpoints work on web
 * - Custom colors defined in tailwind.config.js
 */
export default function HomeScreen() {
  const { user, isAuthenticated, loading } = useAuth();
  const currentTask = trpc.tasks.current.useQuery(undefined, { enabled: isAuthenticated });

  if (loading) return <ScreenContainer className="items-center justify-center"><ActivityIndicator color="#4F46E5" size="large" /></ScreenContainer>;

  if (!isAuthenticated) {
    return (
      <ScreenContainer className="p-5">
        <View style={styles.guest}>
          <Text style={styles.eyebrow}>EHCO</Text>
          <Text style={styles.heading}>مسار تعلمك، خطوة واضحة كل يوم</Text>
          <Text style={styles.copy}>سجّل دخولك لتبني خطة مخصصة وتحافظ على تقدمك بين أجهزتك.</Text>
          <PrimaryButton label="تسجيل الدخول والبدء" onPress={() => void startOAuthLogin()} />
        </View>
      </ScreenContainer>
    );
  }

  const task = currentTask.data?.task;
  return (
    <ScreenContainer className="px-5">
      <ScrollView contentContainerStyle={styles.content}>
        <View className="gap-1">
          <Text className="text-sm font-semibold text-primary">مرحبًا {user?.name ?? "بك"}</Text>
          <Text className="text-3xl font-bold text-foreground">مهمتك التالية</Text>
        </View>

        {currentTask.isLoading ? <ActivityIndicator color="#4F46E5" size="large" /> : task ? (
          <View style={styles.taskCard}>
            <View style={styles.status}><Text style={styles.statusText}>متاحة الآن</Text></View>
            <Text style={styles.taskTitle}>{task.title}</Text>
            <Text style={styles.copy}>{task.description}</Text>
            <Text style={styles.duration}>{task.estimatedMinutes} دقيقة تقريبًا</Text>
            <PrimaryButton label="ابدأ المهمة والاختبار" onPress={() => router.push({ pathname: "/quiz/[taskId]", params: { taskId: String(task.id) } })} />
          </View>
        ) : (
          <View style={styles.taskCard}>
            <Text style={styles.taskTitle}>لا توجد مهمة مفتوحة الآن</Text>
            <Text style={styles.copy}>أنشئ خطتك، أو اعتمد المسودة بعد مراجعتها لفتح أول مهمة.</Text>
            <PrimaryButton label="الذهاب إلى الخطة" onPress={() => router.push("/(tabs)/plan")} />
          </View>
        )}
        <View style={styles.tip}><Text style={styles.tipTitle}>كيف يعمل التقدم؟</Text><Text style={styles.tipText}>بعد إنهاء المهمة، يراجع الاختبار إجاباتك على الخادم. النجاح يفتح الخطوة التالية.</Text></View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingVertical: 12, paddingBottom: 28, gap: 22 },
  guest: { flex: 1, justifyContent: "center", gap: 16 },
  eyebrow: { color: "#4F46E5", fontSize: 13, fontWeight: "800", letterSpacing: 2, textAlign: "right" },
  heading: { color: "#0F172A", fontSize: 31, fontWeight: "800", lineHeight: 40, textAlign: "right" },
  copy: { color: "#64748B", fontSize: 16, lineHeight: 24, textAlign: "right" },
  taskCard: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0", padding: 20, borderRadius: 22, gap: 14 },
  status: { alignSelf: "flex-end", backgroundColor: "#DCFCE7", borderRadius: 99, paddingVertical: 5, paddingHorizontal: 10 },
  statusText: { color: "#047857", fontSize: 12, fontWeight: "700" },
  taskTitle: { color: "#0F172A", fontSize: 22, fontWeight: "800", textAlign: "right" },
  duration: { color: "#4338CA", fontSize: 14, fontWeight: "700", textAlign: "right" },
  tip: { backgroundColor: "#EEF2FF", padding: 17, borderRadius: 18, gap: 6 },
  tipTitle: { color: "#3730A3", fontSize: 15, fontWeight: "800", textAlign: "right" },
  tipText: { color: "#4F46E5", fontSize: 14, lineHeight: 21, textAlign: "right" },
});
