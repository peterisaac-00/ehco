import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from "react-native";

import { AuthCard, AuthErrorMessage, AuthField, AuthHero, AuthSubmitButton, AuthSwitch, LifestyleDecoration, PasswordRule } from "@/components/auth/echo-auth-ui";
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
  const login = trpc.auth.login.useMutation({ onSuccess: completeAuth, onError: (error) => console.error("[Auth] login failed", error.message) });
  const register = trpc.auth.register.useMutation({ onSuccess: completeAuth, onError: (error) => console.error("[Auth] registration failed", error.message) });
  const pending = login.isPending || register.isPending;
  const validUsername = /^[a-zA-Z0-9_]{3,32}$/.test(username.trim());
  const validPassword = password.length >= 8;
  const passwordMatches = password === confirmPassword;
  const canSubmit = validUsername && validPassword && (mode === "login" || passwordMatches);
  const activeError = mode === "login" ? login.error?.message : register.error?.message;

  const submit = () => {
    const input = { username: username.trim(), password };
    if (mode === "register") register.mutate(input);
    else login.mutate(input);
  };

  const switchMode = () => {
    setMode((current) => (current === "login" ? "register" : "login"));
    setConfirmPassword("");
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} containerClassName="bg-[#FDF9F4]">
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}>
          <AuthHero mode={mode} />
          <AuthCard>
            <AuthField
              icon="person-outline"
              label="اسم المستخدم"
              value={username}
              onChangeText={setUsername}
              placeholder="مثال: peter_01"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              maxLength={32}
              help="حروف إنجليزية أو أرقام أو _، من 3 إلى 32 حرفًا."
              error={username.length > 0 && !validUsername ? "تحقق من صيغة اسم المستخدم." : undefined}
            />
            <AuthField
              icon="lock-outline"
              label="كلمة المرور"
              value={password}
              onChangeText={setPassword}
              placeholder="ثمانية أحرف على الأقل"
              secureTextEntry
              returnKeyType={mode === "register" ? "next" : "done"}
              maxLength={128}
              onSubmitEditing={mode === "login" && canSubmit ? submit : undefined}
            />
            {mode === "register" && <><PasswordRule /><AuthField icon="lock-outline" label="تأكيد كلمة المرور" value={confirmPassword} onChangeText={setConfirmPassword} placeholder="أعد كتابة كلمة المرور" secureTextEntry returnKeyType="done" maxLength={128} onSubmitEditing={canSubmit ? submit : undefined} error={confirmPassword.length > 0 && !passwordMatches ? "كلمتا المرور غير متطابقتين." : undefined} /></>}
            {activeError ? <AuthErrorMessage message={activeError} /> : null}
            <AuthSubmitButton label={mode === "login" ? "تسجيل الدخول" : "إنشاء الحساب والبدء"} onPress={submit} disabled={!canSubmit} loading={pending} />
            <AuthSwitch mode={mode} onPress={switchMode} />
          </AuthCard>
          <LifestyleDecoration />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, paddingBottom: 0, gap: 18 },
});
