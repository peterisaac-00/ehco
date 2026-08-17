import { createDirectionalStyles } from "@/lib/directional-layout";
import { useLanguage } from "@/lib/i18n";

/**
 * Keeps bilingual screens visually native in both writing directions without
 * relying on I18nManager, which would require restarting the Expo runtime.
 */
export function useDirectionalStyles() {
  const { isRTL } = useLanguage();
  return createDirectionalStyles(isRTL);
}

export { createDirectionalStyles } from "@/lib/directional-layout";
