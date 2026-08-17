import type { TextStyle, ViewStyle } from "react-native";

/** Pure, testable layout tokens for the active content language. */
export function createDirectionalStyles(isRTL: boolean) {
  const direction: "rtl" | "ltr" = isRTL ? "rtl" : "ltr";

  return {
    isRTL,
    direction,
    row: { flexDirection: isRTL ? "row-reverse" : "row" } as Pick<ViewStyle, "flexDirection">,
    text: { textAlign: isRTL ? "right" : "left", writingDirection: direction } as Pick<TextStyle, "textAlign" | "writingDirection">,
    start: { alignItems: isRTL ? "flex-end" : "flex-start" } as Pick<ViewStyle, "alignItems">,
    end: { alignItems: isRTL ? "flex-start" : "flex-end" } as Pick<ViewStyle, "alignItems">,
  };
}
