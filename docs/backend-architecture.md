# Ehco Backend Architecture

## Boundary and ownership

The mobile client is only responsible for collecting input and rendering state. It never determines a quiz score, unlocks a task, decides plan limits, or authorizes access to another user's record. Those decisions are made by protected server procedures and ownership-scoped database queries.

## Persistence model

Goals use a nullable `activeSlot` that equals the owner ID only while the goal is active. A unique index on this column allows many completed or abandoned goals while preventing two active goals for the same owner. A plan first stores a light outline for the complete user-selected duration. Its detailed content is held in seven-day plan segments; only a validated segment materializes its tasks and quizzes. A task moves from `locked` to `unlocked`, then `in_quiz`, and finally `completed` only after a successful server-side grade.

## Performance and consistency

List queries are indexed by their owner and lifecycle state. The calendar merges the small plan outline with already materialized task rows instead of expanding AI content at request time. Segment materialization and quiz-pass paths run in transactions so a partial write cannot expose a future task or orphan an attempt. A short-lived, conditional generation lease is written before invoking Gemini, preventing concurrent requests from paying twice for the same segment. AI responses are parsed and validated against the shared schema before they are saved; model output is never treated as permission or a source of trusted scores.

## AI contract

The server uses the live model catalog and a Gemini provider from server-side code. One small call generates the long-range outline. Separate bounded calls generate the detailed seven-day segments and question pools when required. Generation and edit attempts are bounded per plan; every result is independently checked for duration, daily-time, task-count, and quiz-answer consistency.
