import { boolean, index, int, json, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";
import type { LearningPlanOutline, LearningPlanSegment, QuizQuestion } from "../shared/learning";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const goals = mysqlTable("goals", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 160 }).notNull(),
  currentLevel: mysqlEnum("currentLevel", ["beginner", "intermediate", "advanced"]).notNull(),
  dailyMinutes: int("dailyMinutes").notNull(),
  targetDurationDays: int("targetDurationDays").notNull(),
  status: mysqlEnum("status", ["active", "completed", "abandoned"]).notNull().default("active"),
  /** Equals userId for the one active goal, otherwise NULL. Unique index enforces one active goal per owner. */
  activeSlot: int("activeSlot"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("goals_active_slot_unique").on(table.activeSlot),
  index("goals_owner_status_idx").on(table.userId, table.status),
]);

export const plans = mysqlTable("plans", {
  id: int("id").autoincrement().primaryKey(),
  goalId: int("goalId").notNull().unique().references(() => goals.id, { onDelete: "cascade" }),
  totalDurationDays: int("totalDurationDays").notNull(),
  dailyMinutes: int("dailyMinutes").notNull(),
  status: mysqlEnum("status", ["draft", "approved"]).notNull().default("draft"),
  /** Outline only: detailed tasks and quizzes belong to planSegments. */
  draftJson: json("draftJson").$type<LearningPlanOutline>().notNull(),
  aiModel: varchar("aiModel", { length: 100 }).notNull(),
  promptVersion: varchar("promptVersion", { length: 40 }).notNull(),
  generationCount: int("generationCount").notNull().default(1),
  editCount: int("editCount").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const planSegments = mysqlTable("planSegments", {
  id: int("id").autoincrement().primaryKey(),
  planId: int("planId").notNull().references(() => plans.id, { onDelete: "cascade" }),
  startDay: int("startDay").notNull(),
  endDay: int("endDay").notNull(),
  status: mysqlEnum("status", ["pending", "generated"]).notNull().default("pending"),
  detailJson: json("detailJson").$type<LearningPlanSegment>(),
  generationAttempts: int("generationAttempts").notNull().default(0),
  generationStartedAt: timestamp("generationStartedAt"),
  generatedAt: timestamp("generatedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("plan_segments_range_unique").on(table.planId, table.startDay, table.endDay),
  index("plan_segments_status_idx").on(table.planId, table.status, table.startDay),
]);

export const planEditRequests = mysqlTable("planEditRequests", {
  id: int("id").autoincrement().primaryKey(),
  planId: int("planId").notNull().references(() => plans.id, { onDelete: "cascade" }),
  userInput: text("userInput").notNull(),
  decision: mysqlEnum("decision", ["accepted", "rejected"]).notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("plan_edits_plan_created_idx").on(table.planId, table.createdAt)]);

export const tasks = mysqlTable("tasks", {
  id: int("id").autoincrement().primaryKey(),
  planId: int("planId").notNull().references(() => plans.id, { onDelete: "cascade" }),
  dayNumber: int("dayNumber").notNull(),
  orderIndex: int("orderIndex").notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  description: text("description").notNull(),
  estimatedMinutes: int("estimatedMinutes").notNull(),
  status: mysqlEnum("status", ["locked", "unlocked", "in_quiz", "completed"]).notNull().default("locked"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("tasks_plan_sequence_unique").on(table.planId, table.dayNumber, table.orderIndex),
  index("tasks_plan_status_sequence_idx").on(table.planId, table.status, table.dayNumber, table.orderIndex),
]);

export const quizzes = mysqlTable("quizzes", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").notNull().unique().references(() => tasks.id, { onDelete: "cascade" }),
  questions: json("questions").$type<QuizQuestion[]>().notNull(),
  passingThreshold: int("passingThreshold").notNull().default(70),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const quizAttempts = mysqlTable("quizAttempts", {
  id: int("id").autoincrement().primaryKey(),
  quizId: int("quizId").notNull().references(() => quizzes.id, { onDelete: "cascade" }),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  submittedAnswers: json("submittedAnswers").$type<Array<{ questionId: string; optionId: string }>>().notNull(),
  score: int("score").notNull(),
  passed: boolean("passed").notNull(),
  attemptedAt: timestamp("attemptedAt").defaultNow().notNull(),
}, (table) => [index("quiz_attempts_owner_quiz_idx").on(table.userId, table.quizId, table.attemptedAt)]);

export type Goal = typeof goals.$inferSelect;
export type Plan = typeof plans.$inferSelect;
export type PlanSegment = typeof planSegments.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Quiz = typeof quizzes.$inferSelect;
