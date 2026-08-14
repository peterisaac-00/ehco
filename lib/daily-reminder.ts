import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";

const REMINDER_ID_KEY = "ehco.daily-reminder.id";
const REMINDER_TASK_TITLE_KEY = "ehco.daily-reminder.task-title";
const REMINDER_HOUR = 20;
const FALLBACK_REMINDER_BODY = "خطوة واحدة الآن تقرّبك من هدفك في Ehco.";
type NotificationsModule = typeof import("expo-notifications");

let notificationsPromise: Promise<NotificationsModule | null> | null = null;
let notificationHandlerConfigured = false;

function isExpoGoRuntime() {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

/**
 * Avoid importing expo-notifications while Expo Go boots on Android.
 * SDK 53+ emits a red error at module import time because remote push is
 * unavailable there, even when the app only needs local reminders.
 */
async function getNotificationsModule(): Promise<NotificationsModule | null> {
  if (Platform.OS === "web" || isExpoGoRuntime()) return null;
  if (!notificationsPromise) {
    notificationsPromise = import("expo-notifications")
      .then((Notifications) => {
        if (!notificationHandlerConfigured) {
          Notifications.setNotificationHandler({
            handleNotification: async () => ({
              shouldShowBanner: true,
              shouldShowList: true,
              shouldPlaySound: false,
              shouldSetBadge: false,
            }),
          });
          notificationHandlerConfigured = true;
        }
        return Notifications;
      })
      .catch(() => null);
  }
  return notificationsPromise;
}

export async function isDailyReminderEnabled() {
  return Boolean(await AsyncStorage.getItem(REMINDER_ID_KEY));
}

export async function enableDailyReminder(taskTitle?: string | null): Promise<"enabled" | "denied" | "unsupported"> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return "unsupported";
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
  const Notifications = await getNotificationsModule();
  if (!Notifications) return;
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
    const Notifications = await getNotificationsModule();
    if (identifier && Notifications) {
      await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => {});
    }
    await AsyncStorage.removeItem(REMINDER_ID_KEY);
    await AsyncStorage.removeItem(REMINDER_TASK_TITLE_KEY);
  } catch {
    // Silent fail
  }
}
