import { useCallback, useEffect, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, TextInput, View } from "react-native";
import LineChart from "../components/LineChart";
import MetricBox from "../components/MetricBox";
import Section from "../components/Section";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { endOfDayIso, formatNumber, getUserNumber, startOfDayIso, todayInput } from "../utils/format";
import Screen from "./Screen";
import { screenStyles } from "./styles";
import { colors, radius, shadows, spacing } from "../theme";

export default function SensorDetailScreen({ route }) {
  const sensor = route.params?.sensor;
  const { token, user } = useAuth();
  const userNumber = getUserNumber(user);
  const [date, setDate] = useState(todayInput());
  const [state, setState] = useState({ loading: true, refreshing: false, error: "", detail: null });

  const load = useCallback(async (refreshing = false) => {
    try {
      setState((prev) => ({ ...prev, loading: !refreshing, refreshing, error: "" }));
      const data = await api.sensorSeries(token, {
        user: userNumber,
        sen_name: sensor.id,
        timeGet: [startOfDayIso(date), endOfDayIso(date)]
      });
      setState({ loading: false, refreshing: false, error: "", detail: data });
    } catch (error) {
      setState((prev) => ({ ...prev, loading: false, refreshing: false, error: error.message }));
    }
  }, [date, sensor?.id, token, userNumber]);

  useEffect(() => {
    load();
  }, [load]);

  const chart = useMemo(() => {
    const clean = (values) => (values || []).filter((value) => value !== null && value !== undefined).slice(-80);
    const pressure = clean(state.detail?.sensorH);
    const flow = clean(state.detail?.flowH);
    const length = Math.max(pressure.length, flow.length);
    const labels = Array.from({ length }, (_, index) => String(index + 1));
    return { labels, pressure, flow };
  }, [state.detail]);

  const param = state.detail?.param || {};

  return (
    <Screen loading={state.loading} error={state.error} refreshing={state.refreshing} onRefresh={() => load(true)}>
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.sensorIcon}>
            <Ionicons name="speedometer-outline" color={colors.surface} size={24} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>{sensor?.name || "Logger"}</Text>
            <Text style={styles.heroSub}>ID {sensor?.id} · Nhóm {sensor?.group || "Không có"}</Text>
          </View>
        </View>
        <View style={styles.dateRow}>
          <Ionicons name="calendar-outline" color={colors.primary} size={18} />
          <TextInput
            style={styles.dateInput}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#94a3b8"
          />
        </View>
      </View>

      <Section title="Số liệu tổng quan" subtitle="Các chỉ số chính trong ngày đã chọn.">
        <View style={screenStyles.grid}>
          <MetricBox label="Áp thấp nhất" value={formatNumber(param.minPressure)} unit="m" tone="neutral" />
          <MetricBox label="Áp cao nhất" value={formatNumber(param.maxPressure)} unit="m" tone="warn" />
          <MetricBox label="Áp trung bình" value={formatNumber(param.avgPressure)} unit="m" tone="good" />
          <MetricBox label="Lưu TB" value={formatNumber(param.avgFlow)} unit="m³/h" tone="accent" />
        </View>
      </Section>

      <Section title="Biểu đồ dữ liệu" subtitle="Áp suất và lưu lượng hiển thị chung để so sánh nhanh.">
        <LineChart
          title="Áp suất và lưu lượng"
          labels={chart.labels}
          datasets={[
            { data: chart.pressure, color: () => colors.primary, label: "Áp suất" },
            { data: chart.flow, color: () => colors.accent, label: "Lưu lượng" }
          ]}
        />
      </Section>

      <Section title="Số liệu chi tiết" subtitle="20 bản ghi mới nhất trong khoảng xem.">
        {(state.detail?.sensorT || []).filter(Boolean).slice(-20).reverse().map((row, index) => (
          <View key={`${row.createAt}-${index}`} style={screenStyles.listItem}>
            <Text style={screenStyles.itemTitle}>{new Date(row.createAt).toLocaleString("vi-VN")}</Text>
            <Text style={screenStyles.itemSub}>Áp {formatNumber(row.Pressure)} m · Lưu {formatNumber(row.flow)} m³/h</Text>
          </View>
        ))}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.xl,
    borderWidth: 1,
    marginBottom: spacing.lg,
    padding: spacing.lg,
    ...shadows.card
  },
  heroTop: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md
  },
  sensorIcon: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    height: 48,
    justifyContent: "center",
    width: 48
  },
  heroCopy: {
    flex: 1
  },
  heroTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900"
  },
  heroSub: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 4
  },
  dateRow: {
    alignItems: "center",
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md
  },
  dateInput: {
    color: colors.text,
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    paddingVertical: 12
  }
});
