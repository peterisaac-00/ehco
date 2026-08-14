import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { type ComponentProps, useEffect, useRef } from "react";
import { ActivityIndicator, Animated, Image, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";

const COLORS = {
  ivory: "#FDF9F4",
  cream: "#F7EDE0",
  card: "#FFFDF9",
  forest: "#254631",
  forestMuted: "#48614F",
  sage: "#A5B39C",
  border: "#E8DED0",
  placeholder: "#8E9288",
  error: "#B74D43",
  errorSurface: "#FCEBE5",
} as const;

const LANDSCAPE = "/manus-storage/ehco-auth-landscape_89073e08.png";
const DESK = "/manus-storage/ehco-auth-desk_d80d586e.png";

type IconName = ComponentProps<typeof MaterialIcons>["name"];

export function AuthHero({ mode }: { mode: "login" | "register" }) {
  const entrance = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(entrance, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [entrance]);
  const isLogin = mode === "login";
  return (
    <Animated.View style={[styles.hero, { opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]}>
      <Image source={{ uri: LANDSCAPE }} style={styles.landscape} resizeMode="cover" />
      <AuthLandscapeFallback />
      <View style={styles.brandMark}><View style={styles.brandIcon}><MaterialIcons name="spa" size={30} color={COLORS.forest} /></View><Text style={styles.brandText}>Echo</Text></View>
      <View style={styles.heroCopy}><Text style={styles.heroTitle}>{isLogin ? "مرحبًا بعودتك" : "أنشئ حسابًا جديدًا"}</Text><Text style={styles.heroSubtitle}>{isLogin ? "سجّل دخولك لمتابعة رحلتك" : "ابدأ رحلتك خطوة بخطوة نحو هدفك"}</Text></View>
    </Animated.View>
  );
}

function AuthLandscapeFallback() {
  return <Svg width="100%" height="158" viewBox="0 0 390 158" style={styles.landscapeFallback}><Circle cx="267" cy="35" r="23" fill="#F7C982" opacity="0.72" /><Path d="M0 128 L73 73 L132 119 L205 38 L271 112 L323 68 L390 120 V158 H0 Z" fill="#DBE2D4" opacity="0.85" /><Path d="M0 145 L91 92 L168 137 L246 77 L303 128 L361 83 L390 105 V158 H0 Z" fill="#B1C3AB" opacity="0.82" /><Path d="M0 153 C78 136 139 152 195 146 C260 138 314 128 390 138 V158 H0 Z" fill="#819C7D" opacity="0.62" /><Path d="M20 149 C104 133 142 153 238 145" fill="none" stroke="#F6E5C8" strokeWidth="4" strokeLinecap="round" opacity="0.92" /><Path d="M298 119 L310 82 L322 119 Z M323 119 L338 73 L353 119 Z M346 121 L357 91 L369 121 Z M367 123 L379 87 L390 123 Z" fill="#345E40" opacity="0.8" /></Svg>;
}

export function AuthCard({ children }: { children: React.ReactNode }) {
  const entrance = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(entrance, { toValue: 1, duration: 340, useNativeDriver: true }).start();
  }, [entrance]);
  return <Animated.View style={[styles.card, { opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }]}>{children}</Animated.View>;
}

export function AuthField({ icon, label, help, error, ...inputProps }: TextInputProps & { icon: IconName; label: string; help?: string; error?: string }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.inputShell, error && styles.inputError]}>
        <MaterialIcons name={icon} size={22} color={error ? COLORS.error : COLORS.forestMuted} />
        <TextInput
          {...inputProps}
          style={styles.input}
          placeholderTextColor={COLORS.placeholder}
          accessibilityLabel={label}
          textAlign="right"
        />
      </View>
      {error ? <View style={styles.errorNotice}><MaterialIcons name="error-outline" size={15} color={COLORS.error} /><Text style={styles.errorText}>{error}</Text></View> : help ? <Text style={styles.fieldHelp}>{help}</Text> : null}
    </View>
  );
}

export function PasswordRule() {
  return <View style={styles.passwordRule}><MaterialIcons name="check-circle" size={16} color="#5D835A" /><Text style={styles.passwordRuleText}>ثمانية أحرف على الأقل</Text></View>;
}

export function AuthErrorMessage({ message }: { message: string }) {
  return <View style={styles.authError}><MaterialIcons name="error-outline" size={19} color={COLORS.error} /><Text style={styles.authErrorText}>{message}</Text></View>;
}

export function AuthSubmitButton({ label, loading, disabled, onPress }: { label: string; loading: boolean; disabled: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled, busy: loading }} onPress={onPress} disabled={disabled || loading} style={({ pressed }) => [styles.primaryButton, (disabled || loading) && styles.primaryButtonDisabled, pressed && !disabled && !loading && styles.pressed]}>{loading ? <ActivityIndicator size="small" color={COLORS.ivory} /> : <><MaterialIcons name="login" size={22} color={COLORS.ivory} /><Text style={styles.primaryButtonText}>{label}</Text></>}</Pressable>;
}

export function AuthSwitch({ mode, onPress }: { mode: "login" | "register"; onPress: () => void }) {
  const isLogin = mode === "login";
  return <View style={styles.switchRow}><Text style={styles.switchCopy}>{isLogin ? "ليس لديك حساب؟" : "لديك حساب بالفعل؟"}</Text><Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => pressed && styles.linkPressed}><Text style={styles.switchAction}>{isLogin ? "إنشاء حساب جديد" : "تسجيل الدخول"}</Text></Pressable></View>;
}

export function LifestyleDecoration() {
  return <View style={styles.decoration}><Image source={{ uri: DESK }} style={styles.deskImage} resizeMode="cover" /><AuthDeskFallback /></View>;
}

function AuthDeskFallback() {
  return <Svg width="100%" height="126" viewBox="0 0 390 126" style={styles.deskFallback}><Rect x="0" y="92" width="390" height="34" fill="#E7D3B4" opacity="0.4" /><Path d="M54 88 C48 63 50 38 65 26 C80 40 80 65 67 89 Z" fill="#6D8E69" /><Path d="M78 89 C80 58 96 44 112 42 C112 67 99 85 82 92 Z" fill="#8CA181" /><Path d="M45 89 C32 70 23 56 15 56 C17 78 29 91 48 96 Z" fill="#8FA983" /><Path d="M58 90 L69 90 L72 119 L54 119 Z" fill="#C48F65" /><Rect x="143" y="86" width="115" height="24" rx="3" fill="#45684D" /><Rect x="150" y="81" width="115" height="24" rx="3" fill="#789072" /><Path d="M177 83 L190 108" stroke="#D5A77C" strokeWidth="3" strokeLinecap="round" /><Path d="M311 94 C311 83 318 76 330 76 C343 76 350 83 350 94 V107 H311 Z" fill="#EBDCC8" /><Path d="M350 91 C365 91 365 104 354 104" fill="none" stroke="#CCB498" strokeWidth="4" strokeLinecap="round" /></Svg>;
}

const styles = StyleSheet.create({
  hero: { minHeight: 266, overflow: "hidden", borderBottomLeftRadius: 34, borderBottomRightRadius: 34, justifyContent: "space-between", paddingHorizontal: 24, paddingTop: 28, paddingBottom: 31 },
  landscape: { ...StyleSheet.absoluteFillObject, opacity: 0.22 },
  landscapeFallback: { position: "absolute", left: 0, right: 0, bottom: -4 },
  brandMark: { flexDirection: "row-reverse", justifyContent: "center", alignItems: "center", gap: 9, alignSelf: "center", backgroundColor: "rgba(255,253,249,0.87)", borderRadius: 20, paddingHorizontal: 15, paddingVertical: 8, borderWidth: 1, borderColor: "#F0E9DE", shadowColor: "#6A6252", shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  brandIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#EFF1E7", justifyContent: "center", alignItems: "center" },
  brandText: { color: COLORS.forest, fontSize: 27, fontWeight: "700", letterSpacing: -0.4 },
  heroCopy: { gap: 6, alignItems: "center" },
  heroTitle: { color: COLORS.forest, fontSize: 32, fontWeight: "800", lineHeight: 42, textAlign: "center" },
  heroSubtitle: { color: COLORS.forestMuted, fontSize: 15, lineHeight: 23, textAlign: "center" },
  card: { marginHorizontal: 18, marginTop: -21, padding: 21, borderRadius: 28, gap: 16, backgroundColor: COLORS.card, borderWidth: 1, borderColor: "#F0E7DC", shadowColor: "#665B4A", shadowOpacity: 0.1, shadowRadius: 17, shadowOffset: { width: 0, height: 8 }, elevation: 3 },
  fieldWrap: { gap: 7 },
  fieldLabel: { color: COLORS.forest, fontSize: 14, fontWeight: "800", textAlign: "right" },
  inputShell: { minHeight: 57, borderRadius: 17, paddingHorizontal: 16, flexDirection: "row-reverse", alignItems: "center", gap: 11, backgroundColor: "#FFFDF9", borderWidth: 1, borderColor: COLORS.border },
  inputError: { borderColor: "#E8BDB0", backgroundColor: "#FFF9F6" },
  input: { flex: 1, minHeight: 52, color: COLORS.forest, fontSize: 15, fontWeight: "500", paddingVertical: 0 },
  fieldHelp: { color: COLORS.forestMuted, fontSize: 11.5, lineHeight: 18, textAlign: "right" },
  errorNotice: { flexDirection: "row-reverse", alignItems: "center", alignSelf: "flex-start", gap: 5, backgroundColor: COLORS.errorSurface, borderRadius: 9, paddingHorizontal: 8, paddingVertical: 5 },
  errorText: { color: COLORS.error, fontSize: 11.5, fontWeight: "700" },
  passwordRule: { flexDirection: "row-reverse", alignItems: "center", alignSelf: "flex-start", gap: 6, borderRadius: 10, backgroundColor: "#ECF1E7", paddingHorizontal: 9, paddingVertical: 6, marginTop: -3 },
  passwordRuleText: { color: "#557553", fontSize: 11.5, fontWeight: "700" },
  authError: { flexDirection: "row-reverse", alignItems: "center", gap: 8, borderRadius: 13, borderWidth: 1, borderColor: "#F0C8BC", backgroundColor: COLORS.errorSurface, paddingHorizontal: 12, paddingVertical: 10 },
  authErrorText: { flex: 1, color: COLORS.error, fontSize: 12.5, lineHeight: 18, fontWeight: "700", textAlign: "right" },
  primaryButton: { minHeight: 56, borderRadius: 17, flexDirection: "row-reverse", gap: 9, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.forest, shadowColor: "#254631", shadowOpacity: 0.16, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  primaryButtonDisabled: { opacity: 0.42 },
  primaryButtonText: { color: COLORS.ivory, fontSize: 16, fontWeight: "800" },
  switchRow: { flexDirection: "row-reverse", justifyContent: "center", alignItems: "center", gap: 6, paddingTop: 1, paddingBottom: 4 },
  switchCopy: { color: COLORS.forestMuted, fontSize: 14 },
  switchAction: { color: COLORS.forest, fontSize: 14, fontWeight: "800" },
  decoration: { height: 126, marginHorizontal: 18, overflow: "hidden", borderTopLeftRadius: 23, borderTopRightRadius: 23, backgroundColor: COLORS.cream, marginTop: 4 },
  deskImage: { width: "100%", height: "100%", opacity: 0.24 },
  deskFallback: { position: "absolute", left: 0, right: 0, bottom: 0 },
  pressed: { opacity: 0.88, transform: [{ scale: 0.985 }] },
  linkPressed: { opacity: 0.65 },
});
