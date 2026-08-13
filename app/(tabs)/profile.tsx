import { useEffect, useState } from "react";
import { Alert, Text, View, StyleSheet } from "react-native";
import { router } from "expo-router";

import { PrimaryButton } from "@/components/primary-button";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/hooks/use-auth";
import { disableDailyReminder, enableDailyReminder, isDailyReminderEnabled, syncDailyReminderTask } from "@/lib/daily-reminder";
import { trpc } from "@/lib/trpc";

export default function ProfileScreen() {
  const { user, isAuthenticated, logout } = useAuth();
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderLoading, setReminderLoading] = useState(false);
  const currentTask = trpc.tasks.current.useQuery(undefined, { enabled: isAuthenticated });
  useEffect(() => { void isDailyReminderEnabled().then(setReminderEnabled); }, []);
  useEffect(() => {
    if (reminderEnabled) void syncDailyReminderTask(currentTask.data?.task.title);
  }, [currentTask.data?.task.title, reminderEnabled]);

  const toggleReminder = async () => {
    setReminderLoading(true);
    try {
      if (reminderEnabled) {
        await disableDailyReminder();
        setReminderEnabled(false);
        return;
      }
      const result = await enableDailyReminder(currentTask.data?.task.title);
      if (result === "enabled") setReminderEnabled(true);
      else Alert.alert(result === "unsupported" ? "غير متاح على الويب" : "إذن الإشعارات مطلوب", "يمكنك تفعيل التذكير من تطبيق الهاتف بعد منح الإذن.");
    } finally {
      setReminderLoading(false);
    }
  };
  return (
    <ScreenContainer className="p-5">
      <View style={styles.content}>
        <Text className="text-3xl font-bold text-foreground">الحساب</Text>
        <View style={styles.card}>
          <Text style={styles.name}>{user?.name ?? "ضيف"}</Text>
          <Text style={styles.email}>{user?.email ?? "سجّل الدخول لحفظ تقدمك"}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>إعدادات التعلّم</Text>
          <Text style={styles.detail}>تنبيه يومي محلي عند الساعة 8:00 مساءً وفق توقيت جهازك.</Text>
        </View>
        <PrimaryButton label={reminderEnabled ? "إيقاف التنبيه اليومي" : "تفعيل التنبيه اليومي"} variant="secondary" onPress={() => void toggleReminder()} loading={reminderLoading} />
        {isAuthenticated ? <PrimaryButton label="تسجيل الخروج" variant="secondary" onPress={() => void logout()} /> : <PrimaryButton label="تسجيل الدخول" onPress={() => router.push("/login")} />}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, gap: 18, paddingTop: 12 },
  card: { backgroundColor: "#FFFFFF", padding: 18, borderRadius: 20, borderWidth: 1, borderColor: "#E2E8F0", gap: 6 },
  name: { color: "#0F172A", fontSize: 20, fontWeight: "800", textAlign: "right" },
  email: { color: "#64748B", fontSize: 14, textAlign: "right" },
  sectionTitle: { color: "#0F172A", fontSize: 16, fontWeight: "800", textAlign: "right" },
  detail: { color: "#64748B", fontSize: 14, lineHeight: 21, textAlign: "right" },
});
