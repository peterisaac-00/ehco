import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => new Map<string, string>());
const runtime = vi.hoisted(() => ({ executionEnvironment: "standalone" }));
const notifications = vi.hoisted(() => ({
  setNotificationHandler: vi.fn(),
  getPermissionsAsync: vi.fn(),
  requestPermissionsAsync: vi.fn(),
  setNotificationChannelAsync: vi.fn(),
  scheduleNotificationAsync: vi.fn(),
  cancelScheduledNotificationAsync: vi.fn().mockResolvedValue(undefined),
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DAILY: "daily" },
}));

vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("expo-constants", () => ({
  default: runtime,
  ExecutionEnvironment: { StoreClient: "storeClient" },
}));
vi.mock("expo-notifications", () => notifications);
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => { storage.set(key, value); }),
    removeItem: vi.fn(async (key: string) => { storage.delete(key); }),
  },
}));

import { disableDailyReminder, enableDailyReminder, isDailyReminderEnabled, syncDailyReminderTask } from "../lib/daily-reminder";

describe("daily task-aware reminder", () => {
  beforeEach(() => {
    storage.clear();
    vi.clearAllMocks();
    runtime.executionEnvironment = "standalone";
    notifications.getPermissionsAsync.mockResolvedValue({ status: "granted" });
    notifications.cancelScheduledNotificationAsync.mockResolvedValue(undefined);
    notifications.scheduleNotificationAsync.mockResolvedValueOnce("reminder-1").mockResolvedValueOnce("reminder-2");
  });

  it("schedules the actual current task and reschedules only after it changes", async () => {
    await expect(enableDailyReminder("مراجعة الجبر")).resolves.toBe("enabled");
    expect(notifications.scheduleNotificationAsync).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.objectContaining({ body: "مهمتك الحالية: مراجعة الجبر" }),
    }));
    expect(await isDailyReminderEnabled()).toBe(true);

    await syncDailyReminderTask("مراجعة الجبر");
    expect(notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);

    await syncDailyReminderTask("حل مسائل الجبر");
    expect(notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith("reminder-1");
    expect(notifications.scheduleNotificationAsync).toHaveBeenLastCalledWith(expect.objectContaining({
      content: expect.objectContaining({ body: "مهمتك الحالية: حل مسائل الجبر" }),
    }));

    await disableDailyReminder();
    expect(await isDailyReminderEnabled()).toBe(false);
  });

  it("returns a safe denied state if notifications are unavailable in the runtime", async () => {
    notifications.getPermissionsAsync.mockRejectedValueOnce(new Error("Notifications unavailable"));

    await expect(enableDailyReminder("مراجعة الجبر")).resolves.toBe("denied");
    expect(notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(await isDailyReminderEnabled()).toBe(false);
  });

  it("does not load notifications in Expo Go", async () => {
    runtime.executionEnvironment = "storeClient";

    await expect(enableDailyReminder("مراجعة الجبر")).resolves.toBe("unsupported");
    expect(notifications.getPermissionsAsync).not.toHaveBeenCalled();
    expect(notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});
