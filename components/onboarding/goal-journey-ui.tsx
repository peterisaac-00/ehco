import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { type ComponentProps, type ReactNode, useEffect, useRef } from "react";
import { ActivityIndicator, Animated, Image, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";
import { useDirectionalStyles } from "@/lib/directional-styles";
import { useLanguage } from "@/lib/i18n";

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
} as const;

type IconName = ComponentProps<typeof MaterialIcons>["name"];

const STEP_ART: Record<number, string> = {
  1: "/manus-storage/ehco-onboarding-goal_ef4d5bc8.png",
  2: "/manus-storage/ehco-onboarding-level_e34a0977.png",
  3: "/manus-storage/ehco-onboarding-time_2c63d7e3.png",
  4: "/manus-storage/ehco-onboarding-duration_267402ce.png",
};

export function GoalJourneyHeader({ step, onBack }: { step: number; onBack?: () => void }) {
  const { t } = useLanguage();
  const directional = useDirectionalStyles();
  return <View style={styles.header}><View style={[styles.headerRow, directional.row]}>{step > 1 ? <Pressable accessibilityRole="button" accessibilityLabel={t("onboarding.back")} onPress={onBack} hitSlop={12} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}><MaterialIcons name={directional.isRTL ? "arrow-forward" : "arrow-back"} size={22} color={COLORS.forest} /></Pressable> : <View style={styles.backSpacer} />}<View style={[styles.brand, directional.row]}><Image source={require("@/assets/images/icon.png")} style={styles.logoImage} /><Text style={styles.brandText}>Ehco</Text></View><View style={styles.backSpacer} /></View><ProgressDots currentStep={step} /></View>;
}

function ProgressDots({ currentStep }: { currentStep: number }) {
  const { t } = useLanguage();
  return <View style={styles.progress} accessibilityLabel={t("onboarding.stepProgress", { current: currentStep, total: 4 })} accessibilityRole="progressbar"><View style={styles.progressLine} />{[1, 2, 3, 4].map((number) => { const completed = number < currentStep; const active = number === currentStep; return <View key={number} style={[styles.progressDot, (completed || active) && styles.progressDotActive]}><Text style={[styles.progressText, (completed || active) && styles.progressTextActive]}>{completed ? "✓" : number}</Text></View>; })}</View>;
}

export function StepMotion({ step, children }: { step: number; children: ReactNode }) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => { progress.setValue(0); Animated.timing(progress, { toValue: 1, duration: 260, useNativeDriver: true }).start(); }, [progress, step]);
  return <Animated.View style={{ opacity: progress, transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }, { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.985, 1] }) }] }}>{children}</Animated.View>;
}

export function StepIllustration({ step }: { step: number }) {
  return <View style={styles.illustration}><Image source={{ uri: STEP_ART[step] }} style={styles.illustrationImage} resizeMode="cover" /><OnboardingFallback step={step} /><View style={styles.illustrationTint} /></View>;
}

function OnboardingFallback({ step }: { step: number }) {
  if (step === 1) return <Svg width="100%" height="176" viewBox="0 0 360 176" style={styles.illustrationFallback}><Circle cx="275" cy="42" r="22" fill="#F5C87E" opacity="0.7" /><Path d="M0 144 L64 94 L125 137 L190 70 L251 137 L305 86 L360 133 V176 H0 Z" fill="#D7E1D1" /><Circle cx="188" cy="103" r="37" fill="#E5D2AC" /><Circle cx="188" cy="103" r="26" fill="#FFF7E7" /><Circle cx="188" cy="103" r="15" fill="#B7C49E" /><Circle cx="188" cy="103" r="5" fill="#254631" /><Line x1="249" y1="51" x2="196" y2="98" stroke="#254631" strokeWidth="4" strokeLinecap="round" /><Path d="M51 151 C62 107 77 93 96 90 C91 122 78 145 62 155 Z" fill="#557857" /><Path d="M84 151 C92 119 108 106 126 108 C116 136 104 150 89 156 Z" fill="#7E9E77" /></Svg>;
  if (step === 2) return <Svg width="100%" height="176" viewBox="0 0 360 176" style={styles.illustrationFallback}><Circle cx="96" cy="42" r="21" fill="#F6CF89" opacity="0.74" /><Path d="M0 153 L79 98 L139 142 L221 47 L293 137 L335 96 L360 119 V176 H0 Z" fill="#B6C8B1" /><Path d="M153 176 C184 144 217 117 230 85 C239 111 231 142 200 176 Z" fill="#F7E7C8" /><Path d="M227 58 L241 68 L229 75 Z" fill="#254631" /><Path d="M303 145 L314 93 L325 145 Z M323 146 L336 81 L349 146 Z" fill="#345E40" /><Path d="M25 154 C34 128 43 115 58 112 C54 136 46 151 35 158 Z" fill="#6C8B67" /></Svg>;
  if (step === 3) return <Svg width="100%" height="176" viewBox="0 0 360 176" style={styles.illustrationFallback}><Circle cx="270" cy="43" r="21" fill="#F6CF89" opacity="0.72" /><Rect x="132" y="59" width="96" height="96" rx="48" fill="#E6D5B2" /><Circle cx="180" cy="107" r="39" fill="#FFF9EF" stroke="#799171" strokeWidth="3" /><Line x1="180" y1="107" x2="180" y2="82" stroke="#254631" strokeWidth="4" strokeLinecap="round" /><Line x1="180" y1="107" x2="202" y2="119" stroke="#254631" strokeWidth="4" strokeLinecap="round" /><Circle cx="180" cy="107" r="4" fill="#254631" /><Rect x="45" y="115" width="68" height="43" rx="6" fill="#B9C9AF" /><Path d="M57 124 H102 M57 134 H92 M57 144 H98" stroke="#FFF9EF" strokeWidth="3" strokeLinecap="round" /><Path d="M270 153 C278 119 292 104 308 102 C301 135 291 151 277 158 Z" fill="#6C8B67" /></Svg>;
  return <Svg width="100%" height="176" viewBox="0 0 360 176" style={styles.illustrationFallback}><Circle cx="84" cy="41" r="20" fill="#F6CF89" opacity="0.7" /><Path d="M0 148 L67 110 L124 148 L203 88 L281 147 L338 106 L360 125 V176 H0 Z" fill="#D5E0CF" /><Rect x="124" y="42" width="117" height="126" rx="10" fill="#D7BE91" /><Rect x="135" y="53" width="95" height="104" rx="4" fill="#FFF9EF" /><Path d="M153 84 L161 92 L177 74 M153 111 L161 119 L177 101 M153 138 L161 146 L177 128" fill="none" stroke="#527455" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /><Path d="M188 83 H213 M188 110 H217 M188 137 H209" stroke="#A5B39C" strokeWidth="4" strokeLinecap="round" /><Path d="M282 157 C292 117 309 99 330 98 C321 137 307 154 290 162 Z" fill="#6B8C68" /></Svg>;
}

export function StepTitle({ title, copy }: { title: string; copy: string }) {
  return <View style={styles.titleWrap}><Text style={styles.title}>{title}</Text><Text style={styles.copy}>{copy}</Text></View>;
}

export function JourneyTextField({ label, error, ...inputProps }: TextInputProps & { label: string; error?: string }) {
  const directional = useDirectionalStyles();
  return <View style={styles.textFieldWrap}><Text style={[styles.fieldLabel, directional.text]}>{label}</Text><TextInput {...inputProps} accessibilityLabel={label} style={[styles.textField, directional.text, error && styles.textFieldError]} textAlign={directional.isRTL ? "right" : "left"} placeholderTextColor={COLORS.muted} />{error ? <InlineError message={error} /> : null}</View>;
}

export function LevelChoice({ title, description, icon, selected, onPress }: { title: string; description: string; icon: IconName; selected: boolean; onPress: () => void }) {
  const directional = useDirectionalStyles();
  return <Pressable accessibilityRole="radio" accessibilityLabel={`${title}: ${description}`} accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => [styles.levelChoice, directional.row, selected && styles.levelChoiceSelected, pressed && styles.pressed]}><View style={[styles.levelIcon, selected && styles.levelIconSelected]}><MaterialIcons name={icon} size={24} color={selected ? COLORS.card : COLORS.forest} /></View><View style={styles.levelCopy}><Text style={[styles.levelTitle, directional.text, selected && styles.levelTitleSelected]}>{title}</Text><Text style={[styles.levelDescription, directional.text, selected && styles.levelDescriptionSelected]}>{description}</Text></View><View style={[styles.radio, selected && styles.radioSelected]}>{selected ? <MaterialIcons name="check" size={15} color={COLORS.forest} /> : null}</View></Pressable>;
}

export function PresetChoice({ label, icon, selected, onPress }: { label: string; icon: IconName; selected: boolean; onPress: () => void }) {
  const directional = useDirectionalStyles();
  return <Pressable accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => [styles.preset, directional.row, selected && styles.presetSelected, pressed && styles.pressed]}><MaterialIcons name={icon} size={21} color={selected ? COLORS.card : COLORS.forestMuted} /><Text style={[styles.presetText, directional.text, selected && styles.presetTextSelected]}>{label}</Text><View style={[styles.radio, selected && styles.radioSelected]}>{selected ? <MaterialIcons name="check" size={15} color={COLORS.forest} /> : null}</View></Pressable>;
}

export function ValueEditor({ label, suffix, value, onChangeText, error }: { label: string; suffix: string; value: string; onChangeText: (value: string) => void; error?: string }) {
  const directional = useDirectionalStyles();
  return <View style={styles.valueEditorWrap}><Text style={[styles.valueEditorLabel, directional.text]}>{label}</Text><View style={[styles.valueEditor, directional.row, error && styles.textFieldError]}><Text style={styles.valueSuffix}>{suffix}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} keyboardType="number-pad" maxLength={3} style={styles.valueInput} textAlign="center" placeholderTextColor={COLORS.muted} /></View>{error ? <InlineError message={error} /> : null}</View>;
}

export function ReviewCard({ title, level, minutes, days }: { title: string; level: string; minutes: number; days: number }) {
  const { t } = useLanguage();
  const directional = useDirectionalStyles();
  const rows = [{ label: t("onboarding.reviewGoal"), value: title, icon: "track-changes" as IconName }, { label: t("onboarding.reviewLevel"), value: level, icon: "school" as IconName }, { label: t("onboarding.reviewDaily"), value: t("common.minutes", { count: minutes }), icon: "schedule" as IconName }, { label: t("onboarding.reviewDuration"), value: t("common.days", { count: days }), icon: "calendar-month" as IconName }];
  return <View style={styles.reviewCard}>{rows.map((row) => <View key={row.label} style={[styles.reviewRow, directional.row]}><View style={styles.reviewIcon}><MaterialIcons name={row.icon} size={19} color={COLORS.forest} /></View><View style={styles.reviewCopy}><Text style={[styles.reviewLabel, directional.text]}>{row.label}</Text><Text style={[styles.reviewValue, directional.text]} numberOfLines={2}>{row.value}</Text></View></View>)}</View>;
}

export function JourneyPrimaryButton({ label, loading, disabled, onPress }: { label: string; loading?: boolean; disabled?: boolean; onPress: () => void }) {
  const directional = useDirectionalStyles();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled, busy: loading }} disabled={disabled || loading} onPress={onPress} style={({ pressed }) => [styles.primary, directional.row, (disabled || loading) && styles.primaryDisabled, pressed && !disabled && !loading && styles.pressed]}>{loading ? <ActivityIndicator color={COLORS.ivory} /> : <><MaterialIcons name={directional.isRTL ? "arrow-back" : "arrow-forward"} size={22} color={COLORS.ivory} /><Text style={styles.primaryText}>{label}</Text></>}</Pressable>;
}

export function InlineError({ message }: { message: string }) { const directional = useDirectionalStyles(); return <View style={[styles.errorBox, directional.row]}><MaterialIcons name="error-outline" size={17} color={COLORS.error} /><Text style={[styles.errorText, directional.text]}>{message}</Text></View>; }

const styles = StyleSheet.create({
  header: { gap: 19, paddingHorizontal: 22, paddingTop: 9 },
  headerRow: { minHeight: 44, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" },
  backButton: { width: 43, height: 43, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFDF9", borderWidth: 1, borderColor: "#ECE3D8", shadowColor: "#5B5448", shadowOpacity: 0.07, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  backSpacer: { width: 43, height: 43 },
  brand: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  logoImage: { width: 30, height: 30, borderRadius: 15 },
  brandText: { color: COLORS.forest, fontSize: 20, fontWeight: "800" },
  progress: { height: 31, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", position: "relative", paddingHorizontal: 2 },
  progressLine: { position: "absolute", height: 2, left: 20, right: 20, backgroundColor: "#E6E1D8", top: 15 },
  progressDot: { zIndex: 1, width: 30, height: 30, borderRadius: 15, backgroundColor: "#F0EEE8", borderWidth: 1, borderColor: "#E2DED4", alignItems: "center", justifyContent: "center" },
  progressDotActive: { backgroundColor: COLORS.forest, borderColor: COLORS.forest },
  progressText: { color: "#788074", fontSize: 12, fontWeight: "800" },
  progressTextActive: { color: COLORS.ivory },
  illustration: { height: 176, marginHorizontal: 22, overflow: "hidden", borderRadius: 26, backgroundColor: COLORS.cream, borderWidth: 1, borderColor: "#EFE6DA" },
  illustrationImage: { width: "100%", height: "100%", opacity: 0.22 },
  illustrationFallback: { position: "absolute", left: 0, right: 0, bottom: 0 },
  illustrationTint: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(253,249,244,0.05)" },
  titleWrap: { gap: 7, paddingHorizontal: 24, alignItems: "center" },
  title: { color: COLORS.forest, fontSize: 26, fontWeight: "800", lineHeight: 36, textAlign: "center" },
  copy: { color: COLORS.forestMuted, fontSize: 14.5, lineHeight: 23, textAlign: "center" },
  textFieldWrap: { gap: 8 },
  fieldLabel: { color: COLORS.forest, fontSize: 14, fontWeight: "800", textAlign: "right" },
  textField: { minHeight: 59, borderRadius: 17, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card, color: COLORS.forest, fontSize: 16, paddingHorizontal: 17 },
  textFieldError: { borderColor: "#E7BCB0", backgroundColor: "#FFF9F6" },
  levelChoice: { minHeight: 79, flexDirection: "row-reverse", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card },
  levelChoiceSelected: { backgroundColor: COLORS.forest, borderColor: COLORS.forest },
  levelIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#EAF0E5" },
  levelIconSelected: { backgroundColor: "rgba(255,255,255,0.16)" },
  levelCopy: { flex: 1, gap: 3 },
  levelTitle: { color: COLORS.forest, fontSize: 15, fontWeight: "800", textAlign: "right" },
  levelTitleSelected: { color: COLORS.card },
  levelDescription: { color: COLORS.forestMuted, fontSize: 12.5, textAlign: "right" },
  levelDescriptionSelected: { color: "#E0E9DC" },
  radio: { width: 23, height: 23, borderRadius: 12, borderWidth: 1.5, borderColor: "#CFD4C8", alignItems: "center", justifyContent: "center" },
  radioSelected: { borderColor: "#DDE8D8", backgroundColor: "#EEF4EA" },
  preset: { minHeight: 55, flexDirection: "row-reverse", alignItems: "center", gap: 11, borderRadius: 16, paddingHorizontal: 15, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card },
  presetSelected: { backgroundColor: COLORS.forest, borderColor: COLORS.forest },
  presetText: { flex: 1, color: COLORS.forest, fontSize: 15, fontWeight: "800", textAlign: "right" },
  presetTextSelected: { color: COLORS.card },
  valueEditorWrap: { gap: 8, paddingTop: 1 },
  valueEditorLabel: { color: COLORS.forestMuted, fontSize: 12.5, fontWeight: "700", textAlign: "right" },
  valueEditor: { minHeight: 50, alignItems: "center", justifyContent: "center", flexDirection: "row-reverse", gap: 8, borderRadius: 16, backgroundColor: "#F6F1E8", borderWidth: 1, borderColor: "#E9DFD3", paddingHorizontal: 13 },
  valueInput: { minWidth: 70, minHeight: 46, color: COLORS.forest, fontSize: 18, fontWeight: "800", paddingVertical: 0 },
  valueSuffix: { color: COLORS.forestMuted, fontSize: 14, fontWeight: "700" },
  reviewCard: { gap: 11, borderRadius: 21, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, padding: 16 },
  reviewRow: { minHeight: 47, flexDirection: "row-reverse", alignItems: "center", gap: 10, borderBottomWidth: 1, borderBottomColor: "#F0E9DF", paddingBottom: 9 },
  reviewIcon: { width: 35, height: 35, borderRadius: 12, backgroundColor: "#ECF1E7", justifyContent: "center", alignItems: "center" },
  reviewCopy: { flex: 1, gap: 2 },
  reviewLabel: { color: COLORS.forestMuted, fontSize: 11.5, fontWeight: "700", textAlign: "right" },
  reviewValue: { color: COLORS.forest, fontSize: 14, fontWeight: "800", textAlign: "right" },
  primary: { minHeight: 56, borderRadius: 18, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 9, backgroundColor: COLORS.forest, shadowColor: "#254631", shadowOpacity: 0.15, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  primaryDisabled: { opacity: 0.45 },
  primaryText: { color: COLORS.ivory, fontSize: 16, fontWeight: "800" },
  errorBox: { flexDirection: "row-reverse", gap: 7, alignItems: "center", borderRadius: 12, backgroundColor: "#FCEBE5", borderWidth: 1, borderColor: "#F1C9BC", paddingHorizontal: 11, paddingVertical: 9 },
  errorText: { flex: 1, color: COLORS.error, fontSize: 12.5, lineHeight: 18, fontWeight: "700", textAlign: "right" },
  pressed: { opacity: 0.86, transform: [{ scale: 0.987 }] },
});
