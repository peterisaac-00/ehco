# Ehco — Current UI/UX Screen Analysis

> **Purpose of this document:** This is an as-built specification of the current Ehco application. It records only routes, visuals, controls, data, and behavior observable from the code and the preview captured on 14 August 2026. It intentionally contains **no redesign proposal, feature suggestion, or inferred functionality**.

## Analysis scope and evidence

The screen inventory was established from the Expo Router route files and the root/tabs navigation definitions. The unauthenticated states of the main product routes, the Login route, Onboarding, Quiz with an unavailable task ID, and OAuth callback without parameters were captured on mobile (**375 × 812**) and desktop (**1280 × 720**) previews. Authenticated populated states were code-observed, because the preview session had no authenticated user or current task.

| ID | Route / screen | Product status | Auth requirement | User-specific data |
|---|---|---|---|---|
| 1 | `/(tabs)` — اليوم | Main product tab | No for guest state; yes for task data | Yes when authenticated |
| 2 | `/(tabs)/plan` — الخطة | Main product tab | No for guest state; yes for plan actions/data | Yes |
| 3 | `/(tabs)/calendar` — التقويم | Main product tab | Yes for populated calendar | Yes |
| 4 | `/(tabs)/profile` — الحساب | Main product tab | No | Yes when authenticated |
| 5 | `/login` — تسجيل الدخول / إنشاء حساب | Public | No | No before success |
| 6 | `/onboarding` — إعداد الهدف | Product route | Backend action requires auth | Yes after submission |
| 7 | `/quiz/[taskId]` — اختبار قصير | Nested product route | Yes | Yes |
| 8 | `/oauth/callback` — حالة عودة OAuth | Utility route | Callback-dependent | Potentially |
| 9 | `/dev/theme-lab` — مختبر المظهر | Developer/internal route | Not observable | No persistent user data |

## Shared application shell

The root stack hides native headers for every listed route. No persistent top app bar, logo image, global back button, floating action button, or floating notification control is implemented. Safe-area handling surrounds the routes. The application status bar uses the automatic device style.

### Persistent bottom navigation

The tab routes use a bottom bar with four equal destinations. It remains at the bottom in the observed mobile and desktop previews.

| Visible label | Icon | Destination | Selection behavior | Interaction behavior |
|---|---|---|---|---|
| اليوم | Filled house | `/(tabs)` | Indigo when active; gray when inactive | Standard tab navigation; light haptic feedback on iOS press-in |
| الخطة | Filled map | `/(tabs)/plan` | Same | Same |
| التقويم | Calendar outline | `/(tabs)/calendar` | Same | Same |
| الحساب | Person-in-circle | `/(tabs)/profile` | Same | Same |

The Quiz and OAuth callback routes do **not** render the tab bar. No screen uses a visible in-app back button; back behavior outside of the tab bar is therefore **Unknown / Not observable** from the implemented UI.

### Shared button behavior

Most labelled actions use the same `PrimaryButton` component. The component has a minimum height of 52 px and a 14 px radius. It is disabled if either its explicit `disabled` flag or its `loading` flag is true. While loading, the text label is replaced by an activity spinner. Disabled buttons use 50% opacity. Pressing gives opacity reduction and a 0.98 scale transform.

| Variant | Background / border | Text | Current uses |
|---|---|---|---|
| Primary | Indigo `#4F46E5` | White | Primary flow actions |
| Secondary | Pale indigo `#EEF2FF`, `#C7D2FE` border | Dark indigo `#4338CA` | Supporting actions and settings |
| Danger | Rose `#E11D48` | White | Defined in the component; not observed on a listed product screen |

---

## Screen: اليوم (Today / Home)

### Purpose

This is the default tab. It is the entry surface for unauthenticated visitors and shows the next open learning task for an authenticated learner.

### Entry Points

The root application route opens this tab. It can also be reached by the اليوم bottom-tab button, by successful local login, by post-approval navigation, by successful segment retry, and by the result-screen actions that open the current task or return to the main screen.

### Exit Points

The user can open `/login`, `/(tabs)/plan`, `/quiz/[taskId]`, or any other bottom tab. No explicit back button exists.

### Layout

In the unauthenticated preview, the page contains a vertically centered right-aligned hero: a small `EHCO` wordmark, a large headline, explanatory copy, and a full-width primary button. The bottom tab bar remains visible.

When authenticated, the scrollable content begins with a small greeting (`مرحبًا [name]`) followed by the large title `مهمتك التالية`. Below it is either a white task card or an empty task card. A pale-indigo instructional card appears at the bottom of the scroll content.

### Elements

| Element | Position and hierarchy | Data / state |
|---|---|---|
| `EHCO` wordmark | Upper section of guest hero | Static text |
| `مسار تعلمك، خطوة واضحة كل يوم` | Guest hero headline | Static text |
| Greeting | Authenticated content top | `user.name`; falls back to `بك` |
| `مهمتك التالية` | Authenticated top-level title | Static text |
| `متاحة الآن` badge | Upper edge of current-task card | Shown only with an open task |
| Task title, description, estimated minutes | Current-task card | Current unlocked/in-quiz task from `tasks.current` |
| `لا توجد مهمة مفتوحة الآن` card | Replaces task card when no current task exists | Dynamic state |
| `كيف يعمل التقدم؟` tip card | Bottom of authenticated content | Static explanatory copy |

### Buttons & Actions

1. **`تسجيل الدخول والبدء`**
   * **Location:** Guest hero, below the copy.
   * **Action:** Navigates to `/login`.
   * **Destination:** Login screen.
   * **Conditions:** Visible only while unauthenticated; not disabled or loading.
   * **Data change / confirmation / error:** No data change; no confirmation; no local error state.

2. **`ابدأ المهمة والاختبار`**
   * **Location:** Bottom of the current-task card.
   * **Action:** Opens the Quiz route with the current task ID.
   * **Destination:** `/quiz/[taskId]`.
   * **Conditions:** Visible only when `tasks.current` returns a task; not explicitly disabled.
   * **Data change / confirmation / error:** No direct data change; Quiz route handles task-opening errors with an alert.

3. **`الذهاب إلى الخطة`**
   * **Location:** Empty authenticated task card.
   * **Action:** Navigates to the Plan tab.
   * **Destination:** `/(tabs)/plan`.
   * **Conditions:** Visible only when there is no current task.

### Inputs

No inputs are present.

### Interactions

| User action | System response | Result |
|---|---|---|
| Open app while auth state is resolving | Centered indigo activity indicator | Content is delayed until auth resolution completes |
| Open as guest | Render guest hero | User is asked to sign in |
| Open with a current task | Fetch current task | Task card renders |
| Open authenticated with no current task | Current-task query returns no task | Empty card routes toward plan creation/approval |

### Navigation

This tab is part of the bottom navigation. It is a source for the Login, Plan, and Quiz routes.

### States

Loading auth; guest; authenticated/current task loading; authenticated/current task available; authenticated/no task. Query-error display for the current-task request is **Unknown / Not observable** because no dedicated visual error branch is implemented.

### Data

The greeting uses local authentication state. The card data comes from `trpc.tasks.current`: task title, description, estimated minutes, and task ID. It changes with learning progression.

### Current Visual Design

The guest preview uses a large navy Arabic heading, small indigo eyebrow wordmark, muted gray body copy, and a full-width indigo button on a pale gray canvas. Authenticated cards are white with a thin blue-gray border and a 22 px radius. The open-task badge is pale green with dark green text.

### Responsive Behavior

On the observed mobile viewport, content has 20 px-like horizontal padding and the guest hero uses substantial empty vertical space. On the observed desktop viewport, the hero and full-width button expand across the page width; they are not constrained to a centered narrow column. Tablet and landscape behavior are **Unknown / Not observable**.

### Unknown / Not Observable

No populated authenticated Today screen was screenshot-observed. Native keyboard behavior, app-level back behavior, and screen-reader reading order were not observed.

---

## Screen: الخطة (Plan)

### Purpose

This tab lets a learner create a plan, review its generated outline, change the draft’s time/length or requested task variation, recover failed segment preparation, and approve the plan.

### Entry Points

The screen is available through the الخطة bottom tab. It is also reached from Home’s empty-task CTA, onboarding success, calendar empty states, and the result screen after the last plan task.

### Exit Points

It can open Login, Onboarding, Home/current task, and the other bottom tabs. Approving a plan replaces the route with Home.

### Layout

The authenticated page is a vertical scroll view. It starts with `خطة التعلم`, the active goal title, and a time-and-duration subtitle. It then shows one of three major content branches: no draft, draft, or approved plan.

The guest branch is vertically centered and has a title, explanatory copy, and one CTA. The no-draft authenticated branch has a single white card. The draft branch starts with a white summary card, then a vertically stacked day-outline list. Draft controls are grouped in a white rounded edit card after the day list. The approved branch uses a pale-green rounded card.

### Elements

| Element | Position and hierarchy | Data / state |
|---|---|---|
| `خطة التعلم` / active goal | Top of authenticated scroll view | Goal title from `goals.active` |
| Minutes and day count | Immediately below goal title | Active goal’s `dailyMinutes` and `targetDurationDays` |
| `جاهز لبناء الخريطة` card | No-draft branch | Static copy; shown when `draftJson` is absent |
| Draft title and summary card | First draft element | Generated plan outline title/summary |
| Day rows | Below summary | Each day’s sequential day number, title, and focus |
| Segment-failure card | Start of draft edit card | One per failed pending segment; includes its day range |
| Time/length subsection | Draft edit card | Draft values, then editable values |
| Task-variation subsection | Draft edit card after bounds subsection | Free-text edit request |
| Approved card | Draft controls replacement after approval | Static approval confirmation |

### Buttons & Actions

1. **`تسجيل الدخول للبدء`** or **`إعداد الهدف`**
   * **Location:** Centered guest/empty Plan state.
   * **Action:** Goes to Login when unauthenticated; goes to Onboarding when signed in with no active goal.
   * **Destination:** `/login` or `/onboarding`.
   * **Conditions:** Branch-dependent; neither has loading state.

2. **`إنشاء الخطة`**
   * **Location:** No-draft white card.
   * **Action:** Requests initial outline generation for the active goal and refetches the plan on success.
   * **Destination:** Remains on Plan.
   * **Conditions:** Visible only with an active goal and no draft. Disabled while the generation mutation is loading.
   * **Error behavior:** Alert headed `تعذر إنشاء الخطة`.

3. **`إعادة تجهيز الدفعة`**
   * **Location:** Inside each orange-tinted failed-segment card.
   * **Action:** Retries the named segment’s generation, then refreshes plan/task/calendar data.
   * **Destination:** Remains on Plan.
   * **Conditions:** Visible only for failed pending segments in a draft. Loading state applies to the shared retry mutation, so all retry buttons use its pending status.
   * **Error behavior:** Alert headed `تعذر تجهيز الدفعة`.

4. **`حفظ المدة والوقت`**
   * **Location:** Bounds subsection in the draft edit card.
   * **Action:** Sends the typed daily minutes and duration to the draft-only bounds update action; refreshes Plan and active Goal.
   * **Destination:** Remains on Plan.
   * **Conditions:** Disabled unless both field values convert to integers. Only rendered in draft state. Loading spinner while saving.
   * **Error behavior:** Alert headed `تعذر تحديث المدة والوقت`; successful response also creates an alert describing whether the first segment was ready.

5. **`تحديث المسودة`**
   * **Location:** Below the free-text task-variation input.
   * **Action:** Sends the request to the plan-edit action and refetches the plan.
   * **Destination:** Remains on Plan.
   * **Conditions:** Disabled if trimmed request length is fewer than 4 characters; only rendered in draft state; loading spinner during request.
   * **Error behavior:** Alert headed `تعذر تعديل المسودة`; result alert shows accepted/rejected title and returned reason.

6. **`اعتماد الخطة وبدء اليوم الأول`**
   * **Location:** Last action in the draft edit card.
   * **Action:** Approves the plan, invalidates current-task/calendar/plan data, and replaces the route with Home.
   * **Destination:** `/(tabs)`.
   * **Conditions:** Draft state only; loading spinner during approval.
   * **Error behavior:** Alert headed `تعذر اعتماد الخطة`.

7. **`فتح مهمة اليوم`**
   * **Location:** Approved pale-green card.
   * **Action:** Replaces the route with Home.
   * **Destination:** `/(tabs)`.
   * **Conditions:** Shown only when plan status is `approved`.

### Inputs

| Input | Type / default | Required and validation | Editability / errors |
|---|---|---|---|
| Daily minutes | Numeric keypad; initialized from draft `dailyMinutes`; placeholder `دقيقة يوميًا`; 3-character UI max | Integer required by button. Server requires 30–480 minutes and workload-consistent duration. | Draft only. Server failure appears in an alert. |
| Duration days | Numeric keypad; initialized from draft duration; placeholder `عدد الأيام`; 2-character UI max | Integer required by button. Server requires 1–90 days and workload-consistent duration. | Draft only. Server failure appears in an alert. |
| Task variation / intensity request | Multiline text; empty by default; placeholder `مثال: اجعل الأيام العملية أكثر تنوعًا`; 1,500-character max | Button needs trimmed length of at least 4; server repeats the 4–1,500-character constraint. | Draft only; returned acceptance/rejection explanation appears in an alert. |

### Interactions

| User action | System response | Result |
|---|---|---|
| Signed-in user has no active goal | Centered empty Plan state | Can enter Onboarding |
| Plan data is loading after active goal resolves | Centered spinner | Plan content waits; no explicit Plan-query error state is rendered |
| Draft fields load | Local minutes/days states initialize from draft | Inputs show current draft values |
| Plan has a recorded failed segment | Orange failure card renders | Retry action becomes available |
| Plan is approved | Edit controls disappear | Approved confirmation and `فتح مهمة اليوم` appear |

### Navigation

The Plan tab is a bottom-navigation destination. It is a state-dependent junction: creation/approval operations remain in-place, while approval redirects to Home.

### States

Unauthenticated; active-goal loading; no active goal; active goal without draft; draft; draft with failed segment(s); bounds saving; edit saving; approving; approved. A direct Plan-query error state is **Unknown / Not observable** because no UI branch handles `plan.isError`.

### Data

The screen reads the active goal, the plan draft/status, and failed segment records. The outline title, summary, day number/title/focus, duration, daily minutes, failed range, and approval state are all dynamic and user-specific.

### Current Visual Design

The previewed guest state is a sparse centered right-aligned message with a full-width primary button. In code-observed plan states, white cards use thin `#E2E8F0` borders, 18–20 px radii, and 16–18 px interior padding. Day rows use small pale-indigo numbered circles. The failure card is warm pale orange with an orange border and dark orange copy. The approved card is pale green with a green border.

### Responsive Behavior

The observed desktop guest state stretches its primary CTA nearly across the width of the viewport. The mobile version uses the same bottom tab arrangement and stacked layout. The day list and edit card are scrollable as part of the screen’s main scroll view. Tablet and landscape behavior are **Unknown / Not observable**.

### Unknown / Not Observable

No generated outline, failed segment, draft editing, or approved state was screenshot-observed. The exact native alert presentation and keyboard overlap behavior were not observed.

---

## Screen: التقويم (Calendar)

### Purpose

This tab displays the learner’s plan-day progression and provides a route into the currently open task’s Quiz screen.

### Entry Points

The التقويم bottom-tab item opens the route. It is also the natural destination after the user chooses the calendar tab from another tab.

### Exit Points

It can navigate to Login, Onboarding, Plan, a current task’s Quiz route, and the other bottom tabs.

### Layout

The populated state is a `FlatList`: a right-aligned header followed by one vertically stacked card per calendar day. The header contains a small indigo eyebrow, the active goal title, and a completion sentence. Each day card uses a circular day badge on the right in the RTL row, a top line with state text and `اليوم [number]`, and a task title. Only the current card exposes estimated duration or `الاختبار جاهز للإكمال` metadata.

All non-populated branches use a vertically centered `CalendarEmpty` layout with title, copy, and one full-width primary button.

### Elements

| Element | Position and hierarchy | Data / state |
|---|---|---|
| `تقويم التقدم` | Populated header eyebrow | Static text |
| Goal title | Populated header | Active goal title |
| Completion sentence | Populated header | Completed day count and loaded day count |
| Day badge | Each day-card side | Day number; gray locked, indigo current, green complete |
| State label and symbol | Each day-card top line | `✓ مكتمل`, `▶ متاح الآن`, or `🔒 مقفل` |
| Task title | Each card main copy | Hidden task title is replaced by `مهمة اليوم محفوظة حتى تُفتح` |
| Current task metadata | Current day only | Estimated minutes or in-quiz status |

### Buttons & Actions

1. **`تسجيل الدخول`**
   * **Location:** Centered unauthenticated empty state.
   * **Action / destination:** Opens `/login`.
   * **Conditions:** Visible only to a guest.

2. **`إعادة المحاولة`**
   * **Location:** Centered calendar-query error state.
   * **Action:** Refetches calendar data in place.
   * **Conditions:** Visible only when `calendar.isError`; no explicit loading label on the button.

3. **`إعداد الهدف`**
   * **Location:** Centered no-active-goal state.
   * **Action / destination:** Opens `/onboarding`.

4. **`فتح الخطة`**
   * **Location:** Centered unapproved-plan state and empty-generated-task state.
   * **Action / destination:** Opens `/(tabs)/plan`.

5. **Current day card (unlabelled pressable card)**
   * **Location:** The card whose task status is `unlocked` or `in_quiz`.
   * **Action / destination:** Opens `/quiz/[taskId]`.
   * **Conditions:** The completed and locked cards are plain non-pressable views. The current card has a pressed opacity/scale state.
   * **Data change / confirmation / error:** No direct data change or confirmation.

### Inputs

No inputs are present.

### Interactions

| User action | System response | Result |
|---|---|---|
| Open while query is loading | Centered indigo activity indicator | Calendar is withheld pending data |
| Tap current card | Route push with current task ID | Quiz opens |
| View a locked card | No press response | Future task detail remains hidden |
| View a completed day | Static completed treatment | No navigation from that card |

### Navigation

This is a bottom-tab route. It has conditional outbound routes based on auth/goal/plan state and an embedded task route only for an open task.

### States

Guest; loading; error; no active goal; draft/unapproved plan; approved plan with no generated tasks; populated locked/current/completed days. A day may hold an `in_quiz` task, rendered as current with `الاختبار جاهز للإكمال`.

### Data

`trpc.calendar.get` supplies the active goal, plan status, and day/task statuses. The completion figure is calculated in the client as days whose every task is completed. Task title and estimated minutes are deliberately absent for locked tasks.

### Current Visual Design

Cards are white with `#E2E8F0` borders and 18 px radii. Current cards change to pale lavender `#F5F3FF` with an indigo border; locked cards use pale gray. Green is used for completion. The current card’s pressed state fades and scales to 0.99. The current tab is indigo in the preview.

### Responsive Behavior

The populated list is vertically scrollable. The observed unauthenticated screen stretches the primary action across mobile and desktop widths, retaining the bottom bar. Card behavior on tablet/landscape is **Unknown / Not observable**.

### Unknown / Not Observable

No populated calendar was screenshot-observed. List virtualization details, long-title wrapping under actual data, and native accessibility focus traversal were not observed.

---

## Screen: الحساب (Profile)

### Purpose

This tab shows basic session identity and the local daily-reminder setting, and exposes login/logout actions.

### Entry Points

The الحساب bottom-tab item opens this screen.

### Exit Points

The guest login action opens `/login`; tab navigation remains available. Local logout removes session state and leaves the screen rendering its guest values.

### Layout

The page has a large `الحساب` heading at the top. Two white rounded cards follow: account identity and learning settings. A secondary reminder button appears below them, followed by either a secondary logout button or a primary login button. The bottom tab bar remains visible.

### Elements

| Element | Position and hierarchy | Data / state |
|---|---|---|
| `الحساب` | Top title | Static text |
| Account card name | First card | `user.name`; falls back to `ضيف` |
| Account card secondary copy | First card | `user.email`; falls back to `سجّل الدخول لحفظ تقدمك` |
| `إعدادات التعلّم` card | Second card | Static title and 8:00 PM device-time reminder copy |
| Reminder button | Below cards | Label changes from enable to disable |
| Session button | Final button | Login for guest; logout for authenticated user |

### Buttons & Actions

1. **`تفعيل التنبيه اليومي`** / **`إيقاف التنبيه اليومي`**
   * **Location:** Below the two cards; secondary style.
   * **Action:** Enables local daily notification with the current open task title, or cancels the stored scheduled reminder.
   * **Destination:** Remains on Profile.
   * **Conditions:** Label derives from persisted reminder state. Disabled by loading state while toggle operation is in progress.
   * **Data change / confirmation / error:** Changes local notification scheduling and local storage. On web, or if permission is denied, an alert says either `غير متاح على الويب` or `إذن الإشعارات مطلوب`. No confirmation dialog is used.

2. **`تسجيل الخروج`**
   * **Location:** Final secondary button for an authenticated user.
   * **Action:** Attempts API logout, always clears local session/user data afterward.
   * **Destination:** No explicit route change.
   * **Conditions:** Only visible when authenticated; no visible loading flag is passed to the button.

3. **`تسجيل الدخول`**
   * **Location:** Final primary button for a guest.
   * **Action / destination:** Pushes `/login`.
   * **Conditions:** Only visible when unauthenticated.

### Inputs

No text inputs, switches, or pickers are present. The reminder control is a labelled button rather than a native toggle.

### Interactions

| User action | System response | Result |
|---|---|---|
| Reminder currently enabled and current task title changes | Screen synchronizes scheduled local reminder | New schedule uses the current task title |
| Enable reminder on supported device with permission | Existing reminder is cancelled, then daily reminder is scheduled | Label becomes `إيقاف التنبيه اليومي` |
| Disable reminder | Existing scheduled identifier is cancelled/removed | Label returns to enable text |
| Logout | Local user/session cleared even after network logout failure | Guest identity text and Login button render |

### Navigation

This is a bottom-tab route. Only the guest Login button changes route.

### States

Guest; authenticated; reminder enabled; reminder disabled; reminder loading; unsupported web notification; permission denied. The rendered query state of the current task is not displayed independently.

### Data

Identity comes from local auth state. The reminder text itself is static, while the scheduled notification body uses `tasks.current.task.title` if present. The profile does not display that task title.

### Current Visual Design

The preview shows a pale gray background, large dark-navy heading, two white thin-bordered 20 px cards, a pale-indigo secondary reminder control, and a full-width indigo guest login button. Text is right aligned.

### Responsive Behavior

On both observed viewport sizes, cards and actions expand horizontally with the page instead of moving to a multi-column layout. The bottom bar stays horizontally distributed. Tablet/landscape behavior is **Unknown / Not observable**.

### Unknown / Not Observable

No authenticated name/email state or enabled-reminder label was screenshot-observed. The exact native permission dialog and delivered system notification appearance are external to the app and not observable in preview.

---

## Screen: تسجيل الدخول / إنشاء حساب (Login / Register)

### Purpose

This public screen performs local username/password authentication. It has two internal modes: Login and Register.

### Entry Points

It is reached from guest CTAs on Today, Plan, Calendar, and Profile. It can also be opened directly at `/login`.

### Exit Points

Successful login or registration stores session/user data, invalidates query cache, and replaces the route with Home. The inline mode link changes the same screen between Login and Register.

### Layout

The screen uses a keyboard-avoiding container and scroll view. The top/right brand block shows `EHCO`, a mode-specific large title, and mode-specific supporting copy. A white bordered rounded card contains the labels, inputs, and primary submit action. Below the card, centered inline text contains the unlabelled text-link action for mode switching.

### Elements

| Element | Login mode | Register mode |
|---|---|---|
| Eyebrow | `EHCO` | `EHCO` |
| Large title | `مرحبًا بعودتك` | `أنشئ حسابك` |
| Supporting copy | `اكتب اسم المستخدم وكلمة المرور للمتابعة.` | `لن تحتاج Google أو أي تسجيل خارجي.` |
| Form fields | Username, password | Username, password, confirm password |
| Primary action | `تسجيل الدخول` | `إنشاء الحساب والبدء` |
| Inline switch | `إنشاء حساب` | `تسجيل الدخول` |

### Buttons & Actions

1. **`تسجيل الدخول`**
   * **Location:** Bottom of the Login form card.
   * **Action:** Submits trimmed username and raw password to local login.
   * **Destination:** Home on success.
   * **Conditions:** Disabled until username and password validation pass; loading while login request is pending.
   * **Error behavior:** Alert headed `تعذر تسجيل الدخول` with API message.

2. **`إنشاء الحساب والبدء`**
   * **Location:** Bottom of Register form card.
   * **Action:** Submits username/password to registration.
   * **Destination:** Home on success.
   * **Conditions:** Same base validation plus matching password confirmation; loading while registration is pending.
   * **Error behavior:** Alert headed `تعذر إنشاء الحساب` with API message.

3. **`إنشاء حساب`** / **`تسجيل الدخول`** inline text link
   * **Location:** Centered below the form card.
   * **Action:** Switches screen mode and clears only confirmation-password state.
   * **Destination:** Same `/login` route, different mode.
   * **Conditions:** Always shown; not a `PrimaryButton`; no loading state.

### Inputs

| Input | Type / placeholder | Required / validation | Limits and behavior |
|---|---|---|---|
| `اسم المستخدم` | Plain text; `مثال: peter_01` | Required. Client regex allows English letters, digits, and `_`; 3–32 characters. | `autoCapitalize="none"`, no autocorrect, UI max 32. Text aligns left. Server applies the same character/length rules. |
| `كلمة المرور` | Secure password; `ثمانية أحرف على الأقل` | Required; at least 8 characters. | UI max 128. Password visibility toggle is not present. Login keyboard submit triggers submit only when valid. |
| `تأكيد كلمة المرور` | Secure password; `أعد كتابة كلمة المرور` | Register only; must equal password. | UI max 128. Inline error is exactly `كلمتا المرور غير متطابقتين.` when non-empty and unequal. |

### Interactions

| User action | System response | Result |
|---|---|---|
| Enter invalid credentials format | Submit button stays disabled | No request is made |
| Submit via keyboard on valid Login password | Calls same submit handler | Login request begins |
| Toggle modes | Confirmation password clears | Form title, copy, fields, CTA, and link text change |
| Authentication succeeds | Session and user information are stored | Route replaces to Home |

### Navigation

The route is not part of bottom navigation. It has no visible back button and no native header.

### States

Login form; Register form; disabled submit; pending login/register; mismatched confirm password; API alert error; successful redirect.

### Data

Before successful authentication the field values are local ephemeral state. On success, session token and user identity are persisted through the auth layer.

### Current Visual Design

The mobile preview shows a right-aligned brand block above a white `#FFFFFF` card with a light border, 22 px radius, and 18 px padding. Inputs are pale gray `#F8FAFC`, bordered, 50 px minimum height, and 12 px radius. The switch action is indigo text within centered inline copy. On desktop, the card and inputs stretch close to full width.

### Responsive Behavior

The screen scrolls and uses keyboard avoidance. The observed desktop layout remains one column but expands horizontally; it does not become a multi-column login layout. Tablet and landscape behavior are **Unknown / Not observable**.

### Unknown / Not Observable

No API-error alert was screenshot-observed. Native password keyboard behavior and password-manager integrations are not observable.

---

## Screen: إعداد الهدف (Onboarding)

### Purpose

This route collects a learning goal, current level, daily study minutes, and target duration before plan creation.

### Entry Points

It is reached from Plan’s signed-in/no-goal CTA and Calendar’s no-active-goal CTA. It is also directly routable at `/onboarding`.

### Exit Points

On successful goal creation it replaces the route with Plan. On active-goal conflict, its alert offers either Plan or dismissal.

### Layout

The scroll view begins with an indigo eyebrow `خطوتك الأولى`, a large title `لنصمّم مسارك`, and explanatory copy. A white rounded form card follows. It contains sequential question labels, the goal text field, three level-selection buttons in a row, two numeric fields, then a full-width primary CTA below the form card.

### Elements

| Element | Position and hierarchy | Default / data |
|---|---|---|
| Intro eyebrow/title/copy | Top of scroll view | Static Arabic copy |
| Goal field | First field in card | Empty |
| Three level buttons | Below level label | `beginner` selected by default |
| Daily-minutes field | Below level controls | Default string `60` |
| Duration field | Below daily-minutes field | Default string `30` |
| `إنشاء خريطة التعلم` | Below form card | Primary action |

### Buttons & Actions

1. **`مبتدئ`**, **`متوسط`**, **`متقدم`**
   * **Location:** One horizontal row under `مستواك الحالي`.
   * **Action:** Selects local level state.
   * **Destination:** Remains on Onboarding.
   * **Conditions:** The active level uses primary indigo treatment; inactive levels use secondary pale-indigo treatment. None are disabled or loading.
   * **Data change:** Local state only until goal submission.

2. **`إنشاء خريطة التعلم`**
   * **Location:** Below the form card.
   * **Action:** Performs local basic checks, then calls goal creation.
   * **Destination:** Replaces route with `/(tabs)/plan` on success.
   * **Conditions:** Not proactively disabled by field state. Displays spinner while the create mutation is pending.
   * **Error behavior:** Invalid local basic values trigger `راجع البيانات`. General server error triggers `تعذر إنشاء الهدف`. Active-goal conflict shows `لديك هدف قائم` with alert options below.

3. **`فتح الخطة`** (alert action)
   * **Location:** Active-goal conflict alert.
   * **Action / destination:** Replaces route with Plan.
   * **Conditions:** Appears only when backend returns conflict.

4. **`حسنًا`** (alert action)
   * **Location:** Active-goal conflict alert.
   * **Action:** Dismisses the alert.
   * **Conditions:** Appears only when backend returns conflict; marked as cancel.

### Inputs

| Input | Type / placeholder / default | Required / validation | Limits and error behavior |
|---|---|---|---|
| `ما الهدف الذي تريد تحقيقه؟` | Text; `مثال: تحسين الإنجليزية للمحادثة`; default empty | Required. Local submit requires trimmed length ≥ 3; server requires 3–160 characters. | UI max 160. Invalid local submission causes `راجع البيانات` alert. |
| `دقائق متاحة يوميًا` | Numeric keypad; default `60` | Required integer. Server requires 30–480. | UI max 3; no placeholder or inline error. |
| `مدة المسار بالأيام (حتى 90)` | Numeric keypad; default `30` | Required integer. Server requires 1–90. | UI max 2; no placeholder or inline error. |

The level selector is required as part of submission state and defaults to `مبتدئ`.

### Interactions

| User action | System response | Result |
|---|---|---|
| Enter title shorter than 3 or non-integer numeric strings | Local `راجع البيانات` alert | API is not called |
| Submit acceptable basic fields | Goal mutation begins | CTA shows loading spinner |
| Create succeeds | Route replacement | Plan tab opens |
| Existing active goal conflict | Alert with two actions | User can open plan or dismiss |

### Navigation

Onboarding is outside bottom navigation and does not show the tab bar. No visible back button is implemented.

### States

Initial defaults; level selected; local invalid submission alert; goal creation pending; creation error alert; active-goal conflict alert; success redirect.

### Data

Before submission, all form values are local. Submission writes the user-specific active goal: title, level, daily minutes, and target duration.

### Current Visual Design

The preview uses a large navy heading, indigo eyebrow, muted right-aligned explanatory copy, a white 20 px-radius form card, and a full-width indigo CTA. Inputs have pale-gray fill, light border, 12 px radius, and right-aligned content. The three level controls share one horizontal row.

### Responsive Behavior

The screen scrolls vertically. The three level buttons remain horizontal at the observed mobile and desktop widths. On desktop the form expands across the width; it does not constrain itself to a mobile-width content column. Tablet and landscape behavior are **Unknown / Not observable**.

### Unknown / Not Observable

The route is visually accessible without a current session in preview, but its backend creation operation is protected. The resulting unauthenticated alert behavior was not observed. Native numeric keypad behavior is also not observable in web preview.

---

## Screen: اختبار قصير (Quiz)

### Purpose

This nested screen begins a quiz for an open task, collects one multiple-choice answer for each question, sends answers for server-side grading, and presents pass/fail/retry outcomes.

### Entry Points

It is opened from Home’s current-task button or Calendar’s current day card, with `/quiz/[taskId]`. A quiz that was previously entered may also be resumed from an `in_quiz` task via the current card.

### Exit Points

The result view can replace the route with Home or Plan. The quiz screen has no visible back control. The current task route is not reachable from locked/completed calendar cards.

### Layout

While opening, the full safe-area screen shows only a centered indigo activity indicator. In the question state, the screen has a scrollable top/content region and an anchored footer. The header contains `اختبار قصير`, task title, and instruction. Each question is a white rounded card with a pale-indigo numbered badge, bold prompt, and stacked option buttons. The anchored footer displays an answer counter and the submit button.

The result state is a vertically centered full-screen stack: circular status icon, success/retry label, large percentage, explanatory copy, optional segment status, then action buttons.

### Elements

| Element | Position and hierarchy | Data / state |
|---|---|---|
| `اختبار قصير` | Question header eyebrow | Static text |
| Task title | Question header | Task from `beginQuiz` |
| Question cards | Scrollable main content | Safe client quiz questions; options only |
| Answer counter | Anchored footer | Selected count / total question count |
| Result icon | Result top | `✓` for success; `↻` for failure |
| Percentage | Result center | Server-returned score |
| Segment note / failure copy | Result below message | Generation state of next segment |

### Buttons & Actions

1. **Question option (unlabelled pressable choice)**
   * **Location:** Inside each question’s vertical option group.
   * **Action:** Sets that question’s selected option ID in local answer state.
   * **Destination:** Remains on Quiz.
   * **Conditions:** Every option is visible; selected option gets indigo border/fill. No explicit disabled state.
   * **Accessibility:** Radio role and selected state are set.

2. **`أكمل الإجابات للتحقق`** / **`تحقق من الإجابات`**
   * **Location:** Anchored footer below scroll content.
   * **Action:** Sends the collected question/option IDs to server-side grading.
   * **Destination:** Replaces question state with result state.
   * **Conditions:** Disabled until every question has one selection. When complete, label becomes `تحقق من الإجابات`. Loading spinner during submission.
   * **Error behavior:** Alert headed `تعذر تصحيح الاختبار`.

3. **`إعادة تجهيز الدفعة التالية`**
   * **Location:** Result action stack before the normal success action.
   * **Action:** Retries next segment generation.
   * **Destination:** Replaces route with Home on retry success.
   * **Conditions:** Visible only after a passed quiz if next-segment preparation failed and a next start day exists. Loading spinner while retrying.
   * **Error behavior:** Alert headed `تعذر تجهيز الدفعة التالية`.

4. **`فتح مهمة اليوم`**
   * **Location:** Success result action stack when the plan is not complete.
   * **Action / destination:** Replaces route with Home.
   * **Conditions:** Visible only after a passed non-final result.

5. **`العودة إلى الخطة`**
   * **Location:** Success result action stack when the plan is complete.
   * **Action / destination:** Replaces route with Plan.
   * **Conditions:** Visible only after a passed final result.

6. **`إعادة الاختبار`**
   * **Location:** Failure result action stack.
   * **Action:** Clears local answers/outcome and begins the same task’s quiz again.
   * **Destination:** Returns to question state in same route.
   * **Conditions:** Visible only after failed quiz. New safe question order/options may be returned.

7. **`العودة إلى الرئيسية`**
   * **Location:** Last secondary action on every result state.
   * **Action / destination:** Replaces route with Home.
   * **Conditions:** Always present in result state.

### Inputs

There are no text inputs. Each question requires one option selection. The submit action is disabled until `answeredCount === questions.length`. Server input requires at least one answer and at most 10 answer records; the app’s displayed number of questions controls the normal user flow.

### Interactions

| User action | System response | Result |
|---|---|---|
| Open task route with valid task ID | Starts `beginQuiz` mutation | Centered loading indicator, then questions or alert error |
| Select option | Updates local answer map | Option visual changes; counter increments |
| Submit complete set | Server grades; task/calendar queries invalidate | Result state shows score and progression outcome |
| Fail below pass threshold | Result says `تحتاج محاولة أخرى` | Next task stays locked; retry is available |
| Pass | Result says `نجحت في الاختبار` | Next task is opened, plan completion shown, or segment retry state may be shown |

### Navigation

Quiz is a nested route outside the tab navigator. It is only linked by current/open task controls. Result actions return to a tab route by replacement, not by a visible back action.

### States

Invalid/no-data route loading; begin-quiz request pending; question selection incomplete; complete and ready to submit; submission loading; failed result; passed non-final result; passed final result; passed result with next segment prepared; passed result with retryable next-segment failure; next-segment retry loading.

### Data

Task title and question prompts/options come from `tasks.beginQuiz`. The client does not receive `answerId` or explanation fields in the safe question payload. Score, pass state, plan completion, and segment state come from `tasks.submitQuiz` and change with the learner’s answers and progression.

### Current Visual Design

Question cards are white with 20 px radius and light border. The number badge is pale indigo. Options are pale gray with 12 px radius; a selected option turns pale indigo with a 2 px indigo border. The footer is white with a light top border. Result icons are 80 px circles: green-tinted for success and pale yellow for retry. The percentage is large navy type at 52 px. The preview route without a valid task stayed on the centered indigo loading spinner.

### Responsive Behavior

Questions scroll vertically while the submit footer remains anchored. No desktop populated Quiz layout was observed. Tablet, landscape, and very long question/option wrapping behavior are **Unknown / Not observable**.

### Unknown / Not Observable

No real quiz question, selected-option, result, retry, or segment-failure state was screenshot-observed. The visual display of an alert error is not observable in the web screenshot.

---

## Screen: OAuth Callback Status

### Purpose

This utility route receives OAuth callback parameters or a direct session token, persists session information, and shows processing/success/error feedback. It remains in the route inventory even though current product login is local username/password.

### Entry Points

The route is directly addressable at `/oauth/callback` and can be entered with callback/deep-link parameters such as code/state, error, or session token/user payload.

### Exit Points

Success redirects automatically to `/(tabs)` after approximately one second. Error does not expose an in-app action button.

### Layout

The full safe-area page contains a centered themed view. It displays exactly one of three state layouts: processing spinner plus `Completing authentication...`; success copy `Authentication successful!` and `Redirecting...`; or error heading `Authentication failed` with the error message below.

### Elements

| Element | State | Data |
|---|---|---|
| Large activity indicator | Processing | Static spinner |
| Processing/success copy | Processing or success | Static English text |
| Error heading | Error | Static English text in error color |
| Error message | Error | Parsed callback or exception message |

### Buttons & Actions

No visible buttons, icon buttons, close controls, or navigation controls are implemented.

### Inputs

No user-entered inputs are present. Callback parameters are route/deep-link input rather than UI fields.

### Interactions

| Trigger | System response | Result |
|---|---|---|
| Valid session token / successful code exchange | Stores token and possible user info, sets success | Auto-replaces route with tabs after one second |
| Error callback parameter, missing code/state, missing token, or exception | Sets error and message | Error state remains on screen |

### Navigation

There is no bottom navigation and no visible back control. Only automatic success redirection is implemented.

### States

Processing; success; error. The preview opened without parameters and displayed `Authentication failed` with `Missing code or state parameter`.

### Data

The route may write session token and user information from its callback payload. Error copy is dynamic; success/processing copy is static.

### Current Visual Design

The observed error preview is visually sparse: a pale background, centered rose heading, and centered dark explanatory message. No card, logo, border, or button appears.

### Responsive Behavior

Centered content remains centered in the observed mobile viewport. Desktop and other success states were not captured; exact responsive behavior is **Unknown / Not observable**.

### Unknown / Not Observable

Successful OAuth callback visuals and actual external-provider handoff were not observed.

---

## Screen: مختبر المظهر (Theme Lab — developer/internal)

### Purpose

This developer-facing route demonstrates global palette tokens, light/dark theme application, icon rendering, press count, and swatch values. It is not in the primary learner tab flow.

### Entry Points

The file defines a route at `/dev/theme-lab`. No in-app visible entry button from the documented product screens was found.

### Exit Points

No screen-specific outbound buttons are defined. Normal system/router navigation is **Unknown / Not observable**.

### Layout

The safe-area screen contains a vertical scroll view. The first row has two side-by-side scheme tiles. A themed card follows with token explanation, five rounded sample buttons, a `useColors()` information panel, press count, and last action. A second themed card lists all palette names and live hexadecimal swatches.

### Elements

| Element | Position / data |
|---|---|
| `Light preview`, `Dark preview` tiles | Top row; active scheme styling updates |
| `Tailwind tokens` card | First main card; static explanatory copy |
| Token buttons | Primary, Surface, Success, Warning, Error |
| `useColors()` panel | Shows current background/text/tint strings, press count, last action |
| `Palette values` card | Lists token name, color dot, and live hex value |

### Buttons & Actions

1. **`Light preview`** and **`Dark preview`**
   * **Location:** Top row.
   * **Action:** Changes global app color scheme and updates last-action text.
   * **Destination:** Remains on the same route.
   * **Conditions:** Selected tile uses active background/text. No disabled/loading state.

2. **`Primary`**, **`Surface`**, **`Success`**, **`Warning`**, **`Error`**
   * **Location:** Wrapped row inside the token card.
   * **Action:** Increments local press count and writes matching last-action text.
   * **Destination:** Same route.
   * **Conditions:** No disabled/loading/error state.

### Inputs

No text, numeric, password, or selection inputs are present. Theme tiles act as press controls.

### Interactions

Tap scheme tiles changes global theme context. Tap token samples updates local press count and last-action display. Scroll exposes palette values.

### Navigation

Not shown in root stack’s explicit `Stack.Screen` list, but present as a file-system route. It has no bottom bar or in-screen navigation.

### States

Light/dark scheme; press count starting at zero; changing last-action text. No loading, error, or persistence state is implemented.

### Data

Palette values come from theme configuration and selected global scheme. Press count and last action are local ephemeral state.

### Current Visual Design

It is a technical token demonstration using themed rounded cards, swatches, text labels, and mixed English copy. The exact rendered route was not screenshot-observed.

### Responsive Behavior

The content is vertically scrollable and token buttons can wrap. Other responsive behavior is **Unknown / Not observable**.

### Unknown / Not Observable

Its intended production availability and access control are not observable.

---

## Navigation map

```text
App root
│
├── Bottom tabs
│   ├── اليوم (Home)
│   │   ├── Guest → /login
│   │   ├── Current task → /quiz/[taskId]
│   │   └── No current task → /(tabs)/plan
│   ├── الخطة (Plan)
│   │   ├── Guest → /login
│   │   ├── No active goal → /onboarding
│   │   ├── Approval success → /(tabs) [replace]
│   │   └── Approved plan → /(tabs) [replace]
│   ├── التقويم (Calendar)
│   │   ├── Guest → /login
│   │   ├── No active goal → /onboarding
│   │   ├── Draft / empty segment state → /(tabs)/plan
│   │   └── Current day → /quiz/[taskId]
│   └── الحساب (Profile)
│       └── Guest Login → /login
│
├── /login
│   ├── Mode switch: Login ↔ Register [same route]
│   └── Success → /(tabs) [replace]
├── /onboarding
│   ├── Success → /(tabs)/plan [replace]
│   └── Active-goal alert → /(tabs)/plan [replace]
├── /quiz/[taskId]
│   ├── Pass / non-final → /(tabs) [replace]
│   ├── Pass / final → /(tabs)/plan [replace]
│   ├── Retry-segment success → /(tabs) [replace]
│   └── Failed quiz retry → same route
├── /oauth/callback
│   └── Success → /(tabs) [automatic replace]
└── /dev/theme-lab
    └── No in-screen outgoing route observed
```

## Cross-screen data display map

| Displayed information | Source | Static or dynamic | Progress-dependent |
|---|---|---|---|
| `EHCO`, headlines, instructional copy | Route source strings | Static | No |
| User name/email | Local auth state | Dynamic | Indirectly; changes with session |
| Goal title, current level, daily minutes, duration | Goal/plan queries or local onboarding state | Dynamic | Yes |
| Draft title, summary, day title/focus | Generated plan outline | Dynamic | Yes |
| Segment failure range | Failed-segment query | Dynamic | Yes |
| Calendar day/task status and completion count | Calendar query + client grouping | Dynamic | Yes |
| Current task title/description/minutes | Current-task query | Dynamic | Yes |
| Quiz questions/options | Begin-quiz result | Dynamic | Yes |
| Quiz score/pass/final state | Submit-quiz result | Dynamic | Yes |
| Reminder scheduled task title | Current-task query passed to local scheduler | Dynamic but not visually shown | Yes |
| Theme swatches / token values | Theme configuration | Dynamic only with selected theme | No |

## Current visual language

The screenshot-observed product UI is primarily Arabic and right aligned. It uses a cool light background (`#F8FAFC`), white surface cards, dark navy foreground (`#0F172A`), muted slate copy (`#64748B`), thin blue-gray borders (`#E2E8F0`), and indigo primary actions (`#4F46E5`). Theme configuration defines dark equivalents and semantic success/warning/error tones; the default preview is light.

| Visual property | Current implementation |
|---|---|
| Type hierarchy | Large headings commonly 25–31 px and 800 weight; card titles 19–22 px and 700/800; body 14–16 px; eyebrow labels 12–13 px at 800/900 |
| Font family | Platform/system font definitions; a custom product font is not declared in the reviewed route styles |
| Direction/alignment | Most product copy is right aligned; a few technical/dev labels and centered result texts differ |
| Cards | White surface, thin border, 18–22 px rounded corners, 15–20 px padding; no shadow declarations in reviewed screens |
| Inputs | Pale gray fill, light border, 12 px radius, minimum 48–52 px height |
| Buttons | Full-width in product flows; 14 px radius; primary indigo and secondary pale-indigo styles |
| Icons | SF Symbols on iOS / Material-icon mapping elsewhere for tab icons; text glyphs `✓`, `▶`, `🔒`, `↻` appear in status/result contexts |
| Images/illustrations | No content image, illustration, or logo image is rendered in reviewed product screens; `EHCO` appears as text |
| Density | Sparse hero/empty states; moderate vertical density in forms, plan lists, calendar cards, and quiz cards |

## Responsive behavior summary

The application is configured for mobile portrait use, while its web preview was viewed at mobile and desktop widths. Observed product screens keep a **single-column composition** and a horizontal bottom tab bar at both widths. Content cards and full-width actions expand on desktop rather than staying within a narrow mobile-width container. Forms and list screens use vertical scrolling; Quiz additionally anchors its action footer below scrollable questions. Tablet-specific and landscape-specific behavior are **Unknown / Not observable**. No element was observed to disappear, become a side navigation rail, or switch to a multi-column layout.

## Complete screen inventory

1. اليوم (Today / Home)
2. الخطة (Plan)
3. التقويم (Calendar)
4. الحساب (Profile)
5. تسجيل الدخول / إنشاء حساب (Login / Register modes)
6. إعداد الهدف (Onboarding)
7. اختبار قصير (Quiz)
8. OAuth Callback Status
9. مختبر المظهر (Theme Lab — developer/internal)

## Unknown / Not Observable summary

The following were not inferred: populated authenticated visual states in preview; device-native notification and permission UI; tablet and landscape layouts; exact behavior of system back gestures; user-specific real content length; screen-reader traversal; external OAuth provider handoff; and any route not present in the file-system route inventory.
