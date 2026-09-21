import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { colors, radius, shadows, spacing } from "../theme";

const toneMap = {
  neutral: { bg: colors.accentSoft, fg: colors.accent, icon: "globe-outline" },
  good: { bg: colors.successSoft, fg: colors.success, icon: "checkmark-circle" },
  warn: { bg: colors.warningSoft, fg: colors.warning, icon: "warning" },
  bad: { bg: colors.dangerSoft, fg: colors.danger, icon: "unlink-outline" }
};

export default function StatCard({ title, value, tone = "neutral", icon }) {
  const palette = toneMap[tone] || toneMap.neutral;
  return (
    <View style={[styles.card, { borderColor: palette.bg }]}>
      <View style={[styles.iconBox, { backgroundColor: palette.fg }]}>
        <Ionicons name={icon || palette.icon} color={colors.surface} size={18} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.value}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    flexBasis: "47%",
    flexGrow: 1,
    gap: spacing.md,
    padding: spacing.md,
    ...shadows.soft
  },
  iconBox: {
    alignItems: "center",
    borderRadius: radius.md,
    height: 38,
    justifyContent: "center",
    width: 38
  },
  copy: { flex: 1 },
  title: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 17
  },
  value: {
    color: colors.text,
    fontSize: 21,
    fontWeight: "900",
    marginTop: 2
  }
});
