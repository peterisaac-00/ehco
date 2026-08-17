import { describe, expect, it } from "vitest";

import { createDirectionalStyles } from "../lib/directional-layout";

describe("bilingual layout direction", () => {
  it("uses RTL ordering and alignment for Arabic", () => {
    const styles = createDirectionalStyles(true);

    expect(styles).toMatchObject({
      isRTL: true,
      direction: "rtl",
      row: { flexDirection: "row-reverse" },
      text: { textAlign: "right", writingDirection: "rtl" },
      start: { alignItems: "flex-end" },
    });
  });

  it("uses LTR ordering and alignment for English", () => {
    const styles = createDirectionalStyles(false);

    expect(styles).toMatchObject({
      isRTL: false,
      direction: "ltr",
      row: { flexDirection: "row" },
      text: { textAlign: "left", writingDirection: "ltr" },
      start: { alignItems: "flex-start" },
    });
  });
});
