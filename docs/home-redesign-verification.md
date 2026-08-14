# Home Redesign Verification Notes

## Visual checks — 14 August 2026

The unauthenticated Home route was captured twice at **375 × 812** after the visual-only redesign. The final capture confirms a warm ivory background, deep-green English hero hierarchy, organic layered mountain-and-lake scene, botanical foreground, rounded white action sheet, and a separate bottom tab bar. The primary Arabic login action and the secondary create-account action are readable and not covered by the illustration or navigation.

The preview did not have an authenticated session, so populated-task, no-task, current-task request error, and in-app reminder-dot visual states remain code-verified rather than screenshot-verified. No navigation routes or task-query contracts were modified.

The Home header for authenticated users was additionally checked in source after the mobile review: the notification press target is positioned on the right via RTL row ordering and still opens the pre-existing Profile notification settings route. This did not affect the guest route, which deliberately has no notification header.
