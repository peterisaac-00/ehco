import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const REMINDER_ID_KEY = "ehco.daily-reminder.id";
const REMINDER_TASK_TITLE_KEY = "ehco.daily-reminder.task-title";
const REMINDER_HOUR = 20;
const FALLBACK_REMINDER_BODY = "خطوة واحدة الآن تقرّبك من هدفك في Ehco.";

if (Platform.OS !== "web") {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
  } catch {
    // Ignore notifications handler errors in Expo Go or limited runtimes
  }
}

export async function isDailyReminderEnabled() {
  return Boolean(await AsyncStorage.getItem(REMINDER_ID_KEY));
}

export async function enableDailyReminder(taskTitle?: string | null): Promise<"enabled" | "denied" | "unsupported"> {
  if (Platform.OS === "web") return "unsupported";
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("learning-reminders", {
        name: "Learning reminders",
        importance: Notifications.AndroidImportance.DEFAULT,
      }).catch(() => {});
    }
    const current = await Notifications.getPermissionsAsync().catch(() => ({ status: "denied" as const }));
    const permission = current.status === "granted" ? current : await Notifications.requestPermissionsAsync().catch(() => ({ status: "denied" as const }));
    if (permission.status !== "granted") return "denied";

    await scheduleTaskAwareReminder(taskTitle);
    return "enabled";
  } catch {
    return "denied";
  }
}

export async function scheduleTaskAwareReminder(taskTitle?: string | null) {
  if (Platform.OS === "web") return;
  try {
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
  } catch {
    // Gracefully handle notification scheduling limitations in Expo Go
  }
}

export async function syncDailyReminderTask(taskTitle?: string | null) {
  try {
    const identifier = await AsyncStorage.getItem(REMINDER_ID_KEY);
    if (!identifier) return;
    const normalizedTitle = taskTitle?.trim().slice(0, 140) || null;
    const scheduledTitle = await AsyncStorage.getItem(REMINDER_TASK_TITLE_KEY);
    if (scheduledTitle === normalizedTitle) return;
    await scheduleTaskAwareReminder(normalizedTitle);
  } catch {
    // Silent fail for reminder sync
  }
}

export async function disableDailyReminder() {
  try {
    const identifier = await AsyncStorage.getItem(REMINDER_ID_KEY);
    if (identifier && Platform.OS !== "web") {
      await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => {});
    }
    await AsyncStorage.removeItem(REMINDER_ID_KEY);
    await AsyncStorage.removeItem(REMINDER_TASK_TITLE_KEY);
  } catch {
    // Silent fail
  }
}
