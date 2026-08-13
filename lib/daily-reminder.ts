import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const REMINDER_ID_KEY = "ehco.daily-reminder.id";
const REMINDER_TASK_TITLE_KEY = "ehco.daily-reminder.task-title";
const REMINDER_HOUR = 20;
const FALLBACK_REMINDER_BODY = "خطوة واحدة الآن تقرّبك من هدفك في Ehco.";

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export async function isDailyReminderEnabled() {
  return Boolean(await AsyncStorage.getItem(REMINDER_ID_KEY));
}

export async function enableDailyReminder(taskTitle?: string | null): Promise<"enabled" | "denied" | "unsupported"> {
  if (Platform.OS === "web") return "unsupported";
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("learning-reminders", {
      name: "Learning reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  const permission = current.status === "granted" ? current : await Notifications.requestPermissionsAsync();
  if (permission.status !== "granted") return "denied";

  await scheduleTaskAwareReminder(taskTitle);
  return "enabled";
}

export async function scheduleTaskAwareReminder(taskTitle?: string | null) {
  if (Platform.OS === "web") return;
  await disableDailyReminder();
  const normalizedTitle = taskTitle?.trim().slice(0, 140) || null;
  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: "وقت تقدمك اليومي",
      body: normalizedTitle ? `مهمتك الحالية: ${normalizedTitle}` : FALLBACK_REMINDER_BODY,
      data: { url: "/(tabs)" },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: REMINDER_HOUR,
      minute: 0,
      channelId: Platform.OS === "android" ? "learning-reminders" : undefined,
    },
  });
  await AsyncStorage.setItem(REMINDER_ID_KEY, identifier);
  if (normalizedTitle) await AsyncStorage.setItem(REMINDER_TASK_TITLE_KEY, normalizedTitle);
}

export async function syncDailyReminderTask(taskTitle?: string | null) {
  const identifier = await AsyncStorage.getItem(REMINDER_ID_KEY);
  if (!identifier) return;
  const normalizedTitle = taskTitle?.trim().slice(0, 140) || null;
  const scheduledTitle = await AsyncStorage.getItem(REMINDER_TASK_TITLE_KEY);
  if (scheduledTitle === normalizedTitle) return;
  await scheduleTaskAwareReminder(normalizedTitle);
}

export async function disableDailyReminder() {
  const identifier = await AsyncStorage.getItem(REMINDER_ID_KEY);
  if (identifier && Platform.OS !== "web") await Notifications.cancelScheduledNotificationAsync(identifier);
  await AsyncStorage.removeItem(REMINDER_ID_KEY);
  await AsyncStorage.removeItem(REMINDER_TASK_TITLE_KEY);
}
