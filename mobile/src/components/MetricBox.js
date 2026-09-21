import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "../theme";

export default function MetricBox({ label, value, unit, tone = "neutral" }) {
  return (
    <View style={[styles.box, styles[tone]]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value} <Text style={styles.unit}>{unit}</Text></Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flex: 1,
    padding: spacing.md
  },
  good: { backgroundColor: colors.successSoft, borderColor: "#bbf7d0" },
  warn: { backgroundColor: colors.warningSoft, borderColor: "#fed7aa" },
  bad: { backgroundColor: colors.dangerSoft, borderColor: "#fecaca" },
  accent: { backgroundColor: colors.accentSoft, borderColor: "#bfdbfe" },
  neutral: {},
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700"
  },
  value: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
    marginTop: 4
  },
  unit: {
    color: colors.muted,
    fontSize: 11
  }
});
