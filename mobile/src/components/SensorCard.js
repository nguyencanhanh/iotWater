import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, shadows, spacing } from "../theme";
import { formatNumber } from "../utils/format";
import MetricBox from "./MetricBox";

export default function SensorCard({ sensor, latest, onPress }) {
  const pressure = Number(latest?.Pressure);
  const flow = Number(latest?.flow);
  const connected = latest && (Number.isFinite(pressure) || Number.isFinite(flow));
  const warning = sensor?.warning && sensor.warning !== "normal";

  return (
    <Pressable style={[styles.card, !connected && styles.lostCard, warning && styles.warningCard]} onPress={onPress}>
      <View style={styles.header}>
        <View style={[styles.statusDot, connected ? styles.dotOnline : styles.dotOffline]} />
        <View style={styles.titleWrap}>
          <Text style={styles.title} numberOfLines={2}>{sensor.name || `Logger ${sensor.id}`}</Text>
          <Text style={styles.sub}>ID {sensor.id} · Nhóm {sensor.group || "Không có"}</Text>
        </View>
        <View style={[styles.badge, !connected && styles.badgeOff, warning && styles.badgeWarn]}>
          <Ionicons
            name={warning ? "warning" : connected ? "checkmark-circle" : "unlink-outline"}
            color={warning ? colors.warning : connected ? colors.success : colors.danger}
            size={14}
          />
          <Text style={[styles.badgeText, !connected && styles.badgeOffText, warning && styles.badgeWarnText]}>
            {warning ? "Cảnh báo" : connected ? "Kết nối" : "Mất tín hiệu"}
          </Text>
        </View>
      </View>
      <View style={styles.metrics}>
        <MetricBox label="Áp suất" value={formatNumber(latest?.Pressure)} unit="m" tone={warning ? "warn" : "neutral"} />
        <MetricBox label="Lưu lượng" value={formatNumber(latest?.flow)} unit="m³/h" tone="accent" />
        <MetricBox label="Pin" value={formatNumber(latest?.battery, 0)} unit="%" tone={Number(latest?.battery) < 20 ? "bad" : "good"} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.xl,
    borderWidth: 1,
    marginBottom: spacing.md,
    padding: spacing.md,
    ...shadows.card
  },
  lostCard: {
    borderColor: "#fecaca"
  },
  warningCard: {
    borderColor: "#fed7aa"
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm
  },
  statusDot: {
    borderRadius: 999,
    height: 11,
    width: 11
  },
  dotOnline: {
    backgroundColor: colors.success
  },
  dotOffline: {
    backgroundColor: colors.danger
  },
  titleWrap: { flex: 1 },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800"
  },
  sub: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 4
  },
  badge: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  badgeText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: "900"
  },
  badgeOff: {
    backgroundColor: colors.dangerSoft,
  },
  badgeOffText: {
    color: colors.danger
  },
  badgeWarn: {
    backgroundColor: colors.warningSoft
  },
  badgeWarnText: {
    color: colors.warning
  },
  metrics: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md
  }
});
