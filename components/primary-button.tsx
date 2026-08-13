import { ActivityIndicator, Pressable, StyleSheet, Text, type ViewStyle } from "react-native";

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
  style?: ViewStyle;
};

export function PrimaryButton({ label, onPress, loading = false, disabled = false, variant = "primary", style }: PrimaryButtonProps) {
  const palette = variant === "danger" ? styles.danger : variant === "secondary" ? styles.secondary : styles.primary;
  const textStyle = variant === "secondary" ? styles.secondaryText : styles.primaryText;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [styles.button, palette, style, (disabled || loading) && styles.disabled, pressed && styles.pressed]}
    >
      {loading ? <ActivityIndicator color={variant === "secondary" ? "#4F46E5" : "#FFFFFF"} /> : <Text style={[styles.label, textStyle]}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  primary: { backgroundColor: "#4F46E5" },
  secondary: { backgroundColor: "#EEF2FF", borderWidth: 1, borderColor: "#C7D2FE" },
  danger: { backgroundColor: "#E11D48" },
  label: { fontSize: 16, fontWeight: "700" },
  primaryText: { color: "#FFFFFF" },
  secondaryText: { color: "#4338CA" },
  pressed: { opacity: 0.86, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.5 },
});
