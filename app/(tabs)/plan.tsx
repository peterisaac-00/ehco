import { router } from "expo-router";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useState } from "react";

import { PrimaryButton } from "@/components/primary-button";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";

export default function PlanScreen() {
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const activeGoal = trpc.goals.active.useQuery(undefined, { enabled: isAuthenticated });
  const plan = trpc.plans.getForGoal.useQuery({ goalId: activeGoal.data?.id ?? 0 }, { enabled: Boolean(activeGoal.data?.id) });
  const generate = trpc.plans.generateInitial.useMutation({
    onSuccess: () => void plan.refetch(),
    onError: (error) => Alert.alert("تعذر إنشاء الخطة", error.message),
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
    onError: (error) => Alert.alert("تعذر اعتماد الخطة", error.message),
  });
  const [editRequest, setEditRequest] = useState("");
  const editPlan = trpc.plans.edit.useMutation({
    onSuccess: (result) => {
      setEditRequest("");
      void plan.refetch();
      Alert.alert(result.decision === "accepted" ? "تم تحديث المسودة" : "تعذر تطبيق التعديل", result.reason);
    },
    onError: (error) => Alert.alert("تعذر تعديل المسودة", error.message),
  });

  if (!isAuthenticated) return <GuestPlan label="تسجيل الدخول للبدء" onStart={() => router.push("/login")} />;
  if (activeGoal.isLoading) return <Loading />;
  if (!activeGoal.data) return <GuestPlan onStart={() => router.push("/onboarding")} />;

  const draft = plan.data?.draftJson;
  return (
    <ScreenContainer className="px-5">
      <ScrollView contentContainerStyle={styles.content}>
        <View className="gap-1">
          <Text className="text-sm font-semibold text-primary">خطة التعلم</Text>
          <Text className="text-3xl font-bold text-foreground">{activeGoal.data.title}</Text>
          <Text className="text-base text-muted">{activeGoal.data.dailyMinutes} دقيقة يوميًا · {activeGoal.data.targetDurationDays} يومًا</Text>
        </View>

        {!draft ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>جاهز لبناء الخريطة</Text>
            <Text style={styles.cardText}>سننشئ خريطة المدة كاملة، ثم نجهّز مهام أول 7 أيام مباشرة لضمان سرعة الاستجابة.</Text>
            <PrimaryButton label="إنشاء الخطة" onPress={() => generate.mutate({ goalId: activeGoal.data!.id })} loading={generate.isPending} />
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{draft.title}</Text>
              <Text style={styles.cardText}>{draft.summary}</Text>
            </View>
            <View style={styles.dayList}>
              {draft.days.map((day) => <View key={day.dayNumber} style={styles.dayRow}><Text style={styles.dayNumber}>{day.dayNumber}</Text><View style={styles.dayCopy}><Text style={styles.dayTitle}>{day.title}</Text><Text style={styles.dayFocus}>{day.focus}</Text></View></View>)}
            </View>
            {plan.data?.status === "draft" && <View style={styles.editCard}>
              <Text style={styles.editLabel}>عدّل تنويع المهام أو شدتها</Text>
              <TextInput value={editRequest} onChangeText={setEditRequest} placeholder="مثال: اجعل الأيام العملية أكثر تنوعًا" placeholderTextColor="#94A3B8" style={styles.editInput} multiline maxLength={1500} />
              <PrimaryButton label="تحديث المسودة" variant="secondary" disabled={editRequest.trim().length < 4} onPress={() => editPlan.mutate({ planId: plan.data!.id, request: editRequest.trim() })} loading={editPlan.isPending} />
              <PrimaryButton label="اعتماد الخطة وبدء اليوم الأول" onPress={() => approve.mutate({ goalId: activeGoal.data!.id })} loading={approve.isPending} />
            </View>}
            {plan.data?.status === "approved" && <View style={styles.approvedCard}>
              <Text style={styles.editLabel}>تم اعتماد الخطة وفتح أول مهمة.</Text>
              <PrimaryButton label="فتح مهمة اليوم" onPress={() => router.replace("/")} />
            </View>}
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

function GuestPlan({ onStart, label = "إعداد الهدف" }: { onStart: () => void; label?: string }) {
  return <ScreenContainer className="p-5"><View style={styles.empty}><Text style={styles.cardTitle}>ابدأ بهدف واحد واضح</Text><Text style={styles.cardText}>اختر ما تريد تعلمه وكم وقتًا تستطيع تخصيصه يوميًا.</Text><PrimaryButton label={label} onPress={onStart} /></View></ScreenContainer>;
}
function Loading() { return <ScreenContainer className="items-center justify-center"><ActivityIndicator color="#4F46E5" size="large" /></ScreenContainer>; }

const styles = StyleSheet.create({
  content: { paddingVertical: 12, paddingBottom: 36, gap: 20 },
  card: { gap: 10, padding: 18, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 20 },
  cardTitle: { color: "#0F172A", fontSize: 19, fontWeight: "700", textAlign: "right" },
  cardText: { color: "#64748B", fontSize: 15, lineHeight: 22, textAlign: "right" },
  empty: { flex: 1, justifyContent: "center", gap: 16 },
  dayList: { gap: 8 },
  dayRow: { flexDirection: "row-reverse", gap: 12, alignItems: "center", padding: 14, borderRadius: 16, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0" },
  dayNumber: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#EEF2FF", color: "#4338CA", fontWeight: "800", textAlign: "center", textAlignVertical: "center" },
  dayCopy: { flex: 1, gap: 2 },
  dayTitle: { color: "#0F172A", fontSize: 15, fontWeight: "700", textAlign: "right" },
  dayFocus: { color: "#64748B", fontSize: 13, textAlign: "right" },
  editCard: { gap: 10, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0", padding: 16, borderRadius: 18 },
  editLabel: { color: "#0F172A", fontSize: 15, fontWeight: "700", textAlign: "right" },
  editInput: { minHeight: 76, borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 12, padding: 12, color: "#0F172A", textAlign: "right", textAlignVertical: "top" },
  approvedCard: { gap: 10, backgroundColor: "#ECFDF5", borderWidth: 1, borderColor: "#A7F3D0", padding: 16, borderRadius: 18 },
});
