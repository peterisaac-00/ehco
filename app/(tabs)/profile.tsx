import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router, useNavigation } from "expo-router";
import { type ComponentProps, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/hooks/use-auth";
import {
  disableDailyReminder,
  enableDailyReminder,
  isDailyReminderEnabled,
  syncDailyReminderTask,
} from "@/lib/daily-reminder";
import { useDirectionalStyles } from "@/lib/directional-styles";
import { useLanguage } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import Svg, { Circle, Path } from "react-native-svg";

const COLORS = {
  ivory: "#FDF9F4",
  cream: "#F7EDE0",
  forest: "#254631",
  forestMuted: "#46604D",
  sage: "#A8B39E",
  sageLight: "#E6E7D8",
  warmGray: "#8D8B7C",
  border: "#EDE4D8",
  card: "#FFFDF9",
  danger: "#B74D43",
  dangerSurface: "#FCECE5",
} as const;

const HERO_ILLUSTRATION = "/manus-storage/ehco-plan-mountain-path_65e37116.png";
const AVATAR_ILLUSTRATION = "/manus-storage/ehco-profile-avatar_79371254.png";
const MOTIVATION_ILLUSTRATION = "/manus-storage/ehco-profile-motivation_09d63d51.png";

type IconName = ComponentProps<typeof MaterialIcons>["name"];

export default function ProfileScreen() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const navigation = useNavigation();
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderLoading, setReminderLoading] = useState(false);
  const [languageLoading, setLanguageLoading] = useState(false);
  const currentTask = trpc.tasks.current.useQuery(undefined, { enabled: isAuthenticated });
  const activeGoal = trpc.goals.active.useQuery(undefined, { enabled: isAuthenticated });
  const calendar = trpc.calendar.get.useQuery(undefined, { enabled: isAuthenticated });

  useEffect(() => {
    navigation.setOptions({
      tabBarActiveTintColor: COLORS.forest,
      tabBarInactiveTintColor: "#8F9586",
      tabBarStyle: { backgroundColor: COLORS.ivory, borderTopColor: COLORS.border, borderTopWidth: 0.5 },
    });
  }, [navigation]);

  useEffect(() => {
    void isDailyReminderEnabled().then(setReminderEnabled);
  }, []);
  useEffect(() => {
    if (reminderEnabled) void syncDailyReminderTask(currentTask.data?.task.title);
  }, [currentTask.data?.task.title, reminderEnabled]);

  const toggleReminder = async () => {
    if (reminderLoading) return;
    setReminderLoading(true);
    try {
      if (reminderEnabled) {
        await disableDailyReminder();
        setReminderEnabled(false);
        return;
      }
      const result = await enableDailyReminder(currentTask.data?.task.title);
      if (result === "enabled") setReminderEnabled(true);
      else Alert.alert(result === "unsupported" ? t("profile.webNotificationUnsupported") : t("profile.notificationPermission"), t("profile.notificationPermissionCopy"));
    } finally {
      setReminderLoading(false);
    }
  };

  const toggleLanguage = async () => {
    if (languageLoading) return;
    setLanguageLoading(true);
    try {
      await setLanguage(language === "ar" ? "en" : "ar");
    } catch (error) {
      Alert.alert(t("profile.language"), error instanceof Error ? error.message : t("common.retry"));
    } finally {
      setLanguageLoading(false);
    }
  };

  if (loading) return <ProfileLoading />;

  const completedDays = calendar.data?.days.filter((task) => task.status === "completed").length ?? 0;
  const totalDays = calendar.data?.days.length ?? 0;
  const progress = totalDays ? Math.round((completedDays / totalDays) * 100) : null;

  return (
    <ScreenContainer containerClassName="bg-[#FDF9F4]">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <ProfileHero reminderEnabled={reminderEnabled} />
        <ProfileIdentityCard
          name={user?.name ?? t("profile.guest")}
          email={user?.email ?? t("profile.guestEmail")}
          isAuthenticated={isAuthenticated}
          goalTitle={activeGoal.data?.title}
          progress={progress}
          dailyMinutes={activeGoal.data?.dailyMinutes}
        />
        <LearningSettingsCard
          dailyMinutes={activeGoal.data?.dailyMinutes}
          currentLevel={activeGoal.data?.currentLevel}
          reminderEnabled={reminderEnabled}
          reminderLoading={reminderLoading}
          onToggleReminder={() => void toggleReminder()}
          language={language}
          languageLoading={languageLoading}
          onToggleLanguage={() => void toggleLanguage()}
        />
        {isAuthenticated && <LogoutButton onPress={() => void logout()} />}
        {!isAuthenticated && <ProfileAction label={t("profile.login")} icon="login" onPress={() => router.push("/login")} />}
        <MotivationCard />
      </ScrollView>
    </ScreenContainer>
  );
}

function ProfileHero({ reminderEnabled }: { reminderEnabled: boolean }) {
  const { t } = useLanguage();
  const directional = useDirectionalStyles();
  const entrance = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(entrance, { toValue: 1, duration: 360, useNativeDriver: true }).start();
  }, [entrance]);
  return (
    <Animated.View style={[styles.hero, { opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}>
      <Image source={{ uri: HERO_ILLUSTRATION }} style={styles.heroIllustration} resizeMode="cover" />
      <ProfileLandscape />
      <View style={[styles.heroTopRow, directional.row]}>
        <View style={styles.heroBotanical}><MaterialIcons name="spa" size={23} color={COLORS.forest} /></View>
        <View style={styles.heroBell}><MaterialIcons name="notifications-none" size={25} color={COLORS.forest} />{reminderEnabled && <View style={styles.notificationDot} />}</View>
      </View>
      <View style={[styles.heroCopy, directional.start]}>
        <Text style={[styles.heroTitle, directional.text]}>{t("profile.title")}</Text>
        <Text style={[styles.heroSubtitle, directional.text]}>{t("profile.subtitle")}</Text>
      </View>
    </Animated.View>
  );
}

function ProfileLandscape() {
  return (
    <Svg width="100%" height="172" viewBox="0 0 390 172" style={styles.landscape}>
      <Circle cx="260" cy="42" r="23" fill="#F7C982" opacity="0.66" />
      <Path d="M0 129 L76 73 L130 122 L197 42 L263 113 L318 77 L390 132 V172 H0 Z" fill="#DCE3D4" opacity="0.78" />
      <Path d="M0 151 L108 89 L176 141 L250 83 L314 131 L365 91 L390 105 V172 H0 Z" fill="#B7C5B0" opacity="0.7" />
      <Path d="M0 159 C69 136 107 145 160 151 C220 158 296 126 390 143 V172 H0 Z" fill="#91A68C" opacity="0.45" />
      <Path d="M304 116 L318 85 L332 116 Z M329 120 L343 80 L357 120 Z M350 123 L361 93 L372 123 Z" fill="#385A41" opacity="0.72" />
      <Path d="M28 154 C105 140 169 159 246 153" fill="none" stroke="#F5E5C9" strokeWidth="4" strokeLinecap="round" opacity="0.78" />
    </Svg>
  );
}

function ProfileIdentityCard({
  name,
  email,
  isAuthenticated,
  goalTitle,
  progress,
  dailyMinutes,
}: {
  name: string;
  email: string;
  isAuthenticated: boolean;
  goalTitle?: string;
  progress: number | null;
  dailyMinutes?: number;
}) {
  const { language, t } = useLanguage();
  const directional = useDirectionalStyles();
  const entrance = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(entrance, { toValue: 1, duration: 340, useNativeDriver: true }).start();
  }, [entrance]);
  const stats = [
    ...(progress === null ? [] : [{ icon: "trending-up" as IconName, label: t("profile.overallProgress"), value: `${progress}%` }]),
    ...(goalTitle ? [{ icon: "track-changes" as IconName, label: t("profile.currentGoal"), value: goalTitle }] : []),
    ...(dailyMinutes ? [{ icon: "schedule" as IconName, label: t("profile.dailyTime"), value: formatStudyTime(dailyMinutes, language) }] : []),
  ].slice(0, 3);

  return (
    <Animated.View style={[styles.identityCard, { opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}>
      <View style={[styles.identityRow, directional.row]}>
        <Image source={{ uri: AVATAR_ILLUSTRATION }} style={styles.avatar} />
        <View style={[styles.identityCopy, directional.start]}><Text numberOfLines={1} style={[styles.userName, directional.text]}>{name} <Text style={styles.nameLeaf}>⌁</Text></Text><Text numberOfLines={1} style={[styles.userEmail, directional.text]}>{email}</Text><View style={[styles.statusPill, directional.row]}><MaterialIcons name="check-circle" size={15} color="#547853" /><Text style={styles.statusText}>{isAuthenticated ? t("profile.activeStatus") : t("profile.welcomeStatus")}</Text></View></View>
      </View>
      {stats.length > 0 && <><View style={styles.identityDivider} /><View style={[styles.profileStats, directional.row]}>{stats.map((stat, index) => <ProfileStat key={stat.label} {...stat} bordered={index !== stats.length - 1} />)}</View></>}
    </Animated.View>
  );
}

function ProfileStat({ icon, label, value, bordered }: { icon: IconName; label: string; value: string; bordered: boolean }) {
  return <View style={[styles.profileStat, bordered && styles.profileStatBorder]}><MaterialIcons name={icon} size={22} color={COLORS.forestMuted} /><Text style={styles.statLabel}>{label}</Text><Text numberOfLines={1} style={styles.statValue}>{value}</Text></View>;
}

function LearningSettingsCard({
  dailyMinutes,
  currentLevel,
  reminderEnabled,
  reminderLoading,
  onToggleReminder,
  language,
  languageLoading,
  onToggleLanguage,
}: {
  dailyMinutes?: number;
  currentLevel?: "beginner" | "intermediate" | "advanced";
  reminderEnabled: boolean;
  reminderLoading: boolean;
  onToggleReminder: () => void;
  language: "ar" | "en";
  languageLoading: boolean;
  onToggleLanguage: () => void;
}) {
  const { t } = useLanguage();
  const rows = [
    ...(dailyMinutes ? [{ icon: "schedule" as IconName, title: t("profile.availableTime"), value: formatStudyTime(dailyMinutes, language) }] : []),
    ...(currentLevel ? [{ icon: "speed" as IconName, title: t("profile.experienceLevel"), value: levelLabel(currentLevel, t) }] : []),
  ];
  return (
    <View style={styles.sectionWrap}>
      <SectionHeading label={t("profile.learningSettings")} icon="menu-book" />
      <View style={styles.settingsCard}>
        {rows.map((row, index) => <LearningSettingRow key={row.title} {...row} divided={index !== rows.length - 1 || true} />)}
        <LanguageRow language={language} loading={languageLoading} onPress={onToggleLanguage} />
        <ReminderRow enabled={reminderEnabled} loading={reminderLoading} onPress={onToggleReminder} />
      </View>
    </View>
  );
}

function LearningSettingRow({ icon, title, value, divided }: { icon: IconName; title: string; value: string; divided: boolean }) {
  const directional = useDirectionalStyles();
  return <View style={[styles.settingRow, directional.row, divided && styles.settingRowDivided]}><View style={styles.settingIcon}><MaterialIcons name={icon} size={22} color={COLORS.forestMuted} /></View><View style={[styles.settingCopy, directional.start]}><Text style={[styles.settingTitle, directional.text]}>{title}</Text><Text style={[styles.settingValue, directional.text]}>{value}</Text></View></View>;
}

function LanguageRow({ language, loading, onPress }: { language: "ar" | "en"; loading: boolean; onPress: () => void }) {
  const { t } = useLanguage();
  const directional = useDirectionalStyles();
  return <Pressable accessibilityRole="button" accessibilityState={{ busy: loading }} disabled={loading} onPress={onPress} style={({ pressed }) => [styles.settingRow, directional.row, styles.settingRowDivided, pressed && !loading && styles.pressed]}><View style={styles.settingIcon}><MaterialIcons name="translate" size={22} color={COLORS.forestMuted} /></View><View style={[styles.settingCopy, directional.start]}><Text style={[styles.settingTitle, directional.text]}>{t("profile.language")}</Text><Text style={[styles.settingValue, directional.text]}>{t("profile.languageDescription")}</Text></View>{loading ? <ActivityIndicator size="small" color={COLORS.forest} /> : <View style={[styles.languageValue, directional.row]}><Text style={styles.languageValueText}>{language === "ar" ? t("profile.languageArabic") : t("profile.languageEnglish")}</Text><MaterialIcons name="swap-horiz" size={18} color={COLORS.forest} /></View>}</Pressable>;
}

function ReminderRow({ enabled, loading, onPress }: { enabled: boolean; loading: boolean; onPress: () => void }) {
  const { t } = useLanguage();
  const directional = useDirectionalStyles();
  return (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: enabled, busy: loading }} disabled={loading} onPress={onPress} style={({ pressed }) => [styles.settingRow, directional.row, pressed && !loading && styles.pressed]}>
      <View style={styles.settingIcon}><MaterialIcons name="notifications" size={22} color={COLORS.forestMuted} /></View>
      <View style={[styles.settingCopy, directional.start]}><Text style={[styles.settingTitle, directional.text]}>{t("profile.reminder")}</Text><Text style={[styles.settingValue, directional.text]}>{enabled ? t("profile.reminderOn") : t("profile.reminderOff")}</Text></View>
      {loading ? <ActivityIndicator size="small" color={COLORS.forest} /> : <View style={[styles.toggle, enabled && styles.toggleEnabled]}><View style={[styles.toggleKnob, enabled && styles.toggleKnobEnabled]} /></View>}
    </Pressable>
  );
}

function SectionHeading({ label, icon }: { label: string; icon: IconName }) {
  const directional = useDirectionalStyles();
  return <View style={[styles.sectionHeading, directional.row]}><MaterialIcons name={icon} size={22} color={COLORS.forestMuted} /><Text style={[styles.sectionHeadingText, directional.text]}>{label}</Text></View>;
}

function LogoutButton({ onPress }: { onPress: () => void }) {
  const { t } = useLanguage();
  const directional = useDirectionalStyles();
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.logoutButton, directional.row, pressed && styles.pressed]}><MaterialIcons name="logout" size={21} color={COLORS.danger} /><Text style={styles.logoutText}>{t("profile.logout")}</Text></Pressable>;
}

function MotivationCard() {
  const { t } = useLanguage();
  const directional = useDirectionalStyles();
  return <View style={styles.motivationCard}><Image source={{ uri: MOTIVATION_ILLUSTRATION }} style={styles.motivationIllustration} resizeMode="cover" /><View style={[styles.motivationCopy, directional.start]}><Text style={[styles.motivationTitle, directional.text]}>{t("profile.motivationTitle")}</Text><Text style={[styles.motivationText, directional.text]}>{t("profile.motivationCopy")}</Text></View></View>;
}

function ProfileAction({ label, icon, onPress }: { label: string; icon: IconName; onPress: () => void }) {
  const directional = useDirectionalStyles();
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.primaryAction, directional.row, pressed && styles.pressed]}><MaterialIcons name={icon} size={20} color={COLORS.ivory} /><Text style={styles.primaryActionText}>{label}</Text></Pressable>;
}

function ProfileLoading() {
  const { t } = useLanguage();
  return <ScreenContainer containerClassName="bg-[#FDF9F4]" className="items-center justify-center p-6"><View style={styles.loadingIcon}><MaterialIcons name="spa" size={34} color={COLORS.forest} /></View><ActivityIndicator color={COLORS.forest} size="small" /><Text style={styles.loadingText}>{t("profile.loading")}</Text></ScreenContainer>;
}

function formatStudyTime(minutes: number, language: "ar" | "en") {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return language === "ar" ? `${minutes} د` : `${minutes}m`;
  return remainder ? (language === "ar" ? `${hours} س ${remainder} د` : `${hours}h ${remainder}m`) : (language === "ar" ? `${hours} س` : `${hours}h`);
}

function levelLabel(level: "beginner" | "intermediate" | "advanced", t: (key: string) => string) {
  return t(`common.level.${level}`);
}

const styles = StyleSheet.create({
  content: { paddingBottom: 42, gap: 21 },
  hero: { height: 272, overflow: "hidden", position: "relative", justifyContent: "space-between", paddingHorizontal: 22, paddingTop: 14, paddingBottom: 29 },
  heroIllustration: { ...StyleSheet.absoluteFillObject, opacity: 0.98 },
  landscape: { position: "absolute", left: 0, right: 0, bottom: -7, opacity: 0.88 },
  heroTopRow: { flexDirection: "row", justifyContent: "space-between", zIndex: 2 },
  heroBotanical: { width: 50, height: 50, borderRadius: 25, backgroundColor: "rgba(255,253,249,0.9)", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#F0E9DF", shadowColor: "#6C604D", shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  heroBell: { width: 50, height: 50, borderRadius: 25, backgroundColor: "rgba(255,253,249,0.9)", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#F0E9DF", shadowColor: "#6C604D", shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  notificationDot: { position: "absolute", top: 9, right: 9, width: 8, height: 8, borderRadius: 4, backgroundColor: "#D88652", borderWidth: 1.5, borderColor: COLORS.ivory },
  heroCopy: { zIndex: 2, alignItems: "flex-start", gap: 3 },
  heroTitle: { color: COLORS.forest, fontSize: 48, fontWeight: "800", letterSpacing: -1.5, lineHeight: 59, textAlign: "left" },
  heroSubtitle: { color: COLORS.forestMuted, fontSize: 16, fontWeight: "500", textAlign: "left" },

  identityCard: { marginHorizontal: 18, marginTop: -14, padding: 20, borderRadius: 28, backgroundColor: COLORS.card, gap: 17, shadowColor: "#5E5748", shadowOpacity: 0.09, shadowRadius: 16, shadowOffset: { width: 0, height: 7 }, elevation: 3 },
  identityRow: { flexDirection: "row-reverse", alignItems: "center", gap: 15 },
  avatar: { width: 90, height: 90, borderRadius: 45, backgroundColor: "#E9EADD" },
  identityCopy: { flex: 1, alignItems: "flex-start", gap: 5 },
  userName: { color: COLORS.forest, fontSize: 24, fontWeight: "800", lineHeight: 30, textAlign: "left" },
  nameLeaf: { color: "#78906E", fontSize: 18 },
  userEmail: { color: COLORS.forestMuted, fontSize: 13, textAlign: "left" },
  statusPill: { flexDirection: "row-reverse", alignItems: "center", gap: 5, borderRadius: 12, backgroundColor: "#E8F0E3", paddingHorizontal: 9, paddingVertical: 5 },
  statusText: { color: "#547853", fontSize: 11, fontWeight: "800" },
  identityDivider: { height: 1, backgroundColor: COLORS.border },
  profileStats: { flexDirection: "row-reverse", justifyContent: "space-between" },
  profileStat: { flex: 1, alignItems: "center", gap: 4, paddingHorizontal: 6 },
  profileStatBorder: { borderLeftWidth: 1, borderLeftColor: "#F0EAE0" },
  statLabel: { color: COLORS.forestMuted, fontSize: 10, fontWeight: "700", textAlign: "center" },
  statValue: { color: COLORS.forest, fontSize: 13, fontWeight: "800", textAlign: "center" },

  sectionWrap: { marginHorizontal: 18, gap: 10 },
  sectionHeading: { flexDirection: "row-reverse", alignItems: "center", gap: 6, paddingHorizontal: 3 },
  sectionHeadingText: { color: COLORS.forest, fontSize: 17, fontWeight: "800", textAlign: "right" },
  settingsCard: { borderRadius: 25, overflow: "hidden", backgroundColor: COLORS.card, paddingHorizontal: 17, shadowColor: "#5E5748", shadowOpacity: 0.05, shadowRadius: 11, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  settingRow: { minHeight: 74, flexDirection: "row-reverse", alignItems: "center", gap: 13 },
  settingRowDivided: { borderBottomWidth: 1, borderBottomColor: "#F0EAE0" },
  settingIcon: { width: 43, height: 43, borderRadius: 22, backgroundColor: "#EEF0E4", alignItems: "center", justifyContent: "center" },
  settingCopy: { flex: 1, gap: 3, alignItems: "flex-start" },
  settingTitle: { color: COLORS.forest, fontSize: 15, fontWeight: "800", textAlign: "left" },
  settingValue: { color: COLORS.forestMuted, fontSize: 12.5, textAlign: "left" },
  toggle: { width: 50, height: 29, borderRadius: 15, padding: 3, backgroundColor: "#CFD4C6", justifyContent: "center" },
  toggleEnabled: { backgroundColor: COLORS.forest },
  toggleKnob: { width: 23, height: 23, borderRadius: 12, backgroundColor: COLORS.card, alignSelf: "flex-start" },
  toggleKnobEnabled: { alignSelf: "flex-end" },
  languageValue: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 12, backgroundColor: "#E8F0E3", paddingHorizontal: 8, paddingVertical: 6 },
  languageValueText: { color: COLORS.forest, fontSize: 12, fontWeight: "800" },

  logoutButton: { minHeight: 55, marginHorizontal: 18, borderRadius: 17, borderWidth: 1, borderColor: "#F2D7CF", backgroundColor: COLORS.dangerSurface, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 9 },
  logoutText: { color: COLORS.danger, fontSize: 15, fontWeight: "800" },
  motivationCard: { minHeight: 124, marginHorizontal: 18, overflow: "hidden", borderRadius: 25, backgroundColor: "#F8F1E7", justifyContent: "center", paddingHorizontal: 23 },
  motivationIllustration: { ...StyleSheet.absoluteFillObject, opacity: 0.93 },
  motivationCopy: { maxWidth: "65%", alignItems: "flex-start", gap: 5, zIndex: 1 },
  motivationTitle: { color: COLORS.forest, fontSize: 21, fontWeight: "800", textAlign: "left" },
  motivationText: { color: COLORS.forestMuted, fontSize: 12, lineHeight: 19, textAlign: "left" },

  primaryAction: { minHeight: 54, marginHorizontal: 18, borderRadius: 16, backgroundColor: COLORS.forest, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8 },
  primaryActionText: { color: COLORS.ivory, fontSize: 15, fontWeight: "800" },
  loadingIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: "#E8EBDD", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  loadingText: { marginTop: 13, color: COLORS.forestMuted, fontSize: 14 },
  pressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
});
