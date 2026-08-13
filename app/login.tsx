import { router } from "expo-router";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { PrimaryButton } from "@/components/primary-button";
import { ScreenContainer } from "@/components/screen-container";
import * as Auth from "@/lib/_core/auth";
import { trpc } from "@/lib/trpc";

export default function LoginScreen() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const utils = trpc.useUtils();

  const completeAuth = async (result: { sessionToken: string; user: { id: number; openId: string; name: string | null; email: string | null; loginMethod: string | null; lastSignedIn: Date } }) => {
    await Auth.setSessionToken(result.sessionToken);
    await Auth.setUserInfo(result.user);
    await utils.invalidate();
    router.replace("/");
  };
  const login = trpc.auth.login.useMutation({ onSuccess: completeAuth, onError: (error) => Alert.alert("تعذر تسجيل الدخول", error.message) });
  const register = trpc.auth.register.useMutation({ onSuccess: completeAuth, onError: (error) => Alert.alert("تعذر إنشاء الحساب", error.message) });
  const pending = login.isPending || register.isPending;
  const validUsername = /^[a-zA-Z0-9_]{3,32}$/.test(username.trim());
  const validPassword = password.length >= 8;
  const canSubmit = validUsername && validPassword && (mode === "login" || password === confirmPassword);

  const submit = () => {
    const input = { username: username.trim(), password };
    if (mode === "register") register.mutate(input);
    else login.mutate(input);
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-5">
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}><Text style={styles.eyebrow}>EHCO</Text><Text style={styles.title}>{mode === "login" ? "مرحبًا بعودتك" : "أنشئ حسابك"}</Text><Text style={styles.copy}>{mode === "login" ? "اكتب اسم المستخدم وكلمة المرور للمتابعة." : "لن تحتاج Google أو أي تسجيل خارجي."}</Text></View>
          <View style={styles.card}>
            <Text style={styles.label}>اسم المستخدم</Text>
            <TextInput autoCapitalize="none" autoCorrect={false} value={username} onChangeText={setUsername} placeholder="مثال: peter_01" placeholderTextColor="#94A3B8" style={styles.input} returnKeyType="next" maxLength={32} />
            <Text style={styles.help}>حروف إنجليزية أو أرقام أو _، من 3 إلى 32 حرفًا.</Text>
            <Text style={styles.label}>كلمة المرور</Text>
            <TextInput secureTextEntry value={password} onChangeText={setPassword} placeholder="ثمانية أحرف على الأقل" placeholderTextColor="#94A3B8" style={styles.input} returnKeyType={mode === "register" ? "next" : "done"} maxLength={128} onSubmitEditing={mode === "login" && canSubmit ? submit : undefined} />
            {mode === "register" && <><Text style={styles.label}>تأكيد كلمة المرور</Text><TextInput secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword} placeholder="أعد كتابة كلمة المرور" placeholderTextColor="#94A3B8" style={styles.input} returnKeyType="done" maxLength={128} onSubmitEditing={canSubmit ? submit : undefined} />{confirmPassword.length > 0 && password !== confirmPassword && <Text style={styles.error}>كلمتا المرور غير متطابقتين.</Text>}</>}
            <PrimaryButton label={mode === "login" ? "تسجيل الدخول" : "إنشاء الحساب والبدء"} onPress={submit} disabled={!canSubmit} loading={pending} />
          </View>
          <View style={styles.switchRow}><Text style={styles.switchCopy}>{mode === "login" ? "ليس لديك حساب؟" : "لديك حساب بالفعل؟"}</Text><Text onPress={() => { setMode(mode === "login" ? "register" : "login"); setConfirmPassword(""); }} style={styles.switchAction}>{mode === "login" ? "إنشاء حساب" : "تسجيل الدخول"}</Text></View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: "center", gap: 20, paddingVertical: 24 },
  brand: { gap: 7, alignItems: "flex-end" },
  eyebrow: { color: "#4F46E5", fontSize: 13, fontWeight: "900", letterSpacing: 2 },
  title: { color: "#0F172A", fontSize: 31, fontWeight: "800", textAlign: "right" },
  copy: { color: "#64748B", fontSize: 15, lineHeight: 23, textAlign: "right" },
  card: { gap: 10, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 22, padding: 18 },
  label: { color: "#0F172A", fontSize: 14, fontWeight: "800", textAlign: "right", marginTop: 2 },
  input: { minHeight: 50, borderColor: "#CBD5E1", borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, color: "#0F172A", fontSize: 16, textAlign: "left", backgroundColor: "#F8FAFC" },
  help: { color: "#64748B", fontSize: 12, textAlign: "right", marginBottom: 4 },
  error: { color: "#E11D48", fontSize: 12, textAlign: "right" },
  switchRow: { flexDirection: "row-reverse", justifyContent: "center", gap: 6 },
  switchCopy: { color: "#64748B", fontSize: 14 },
  switchAction: { color: "#4338CA", fontSize: 14, fontWeight: "800" },
});
