import { useEffect, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import ChipGroup from "../components/ChipGroup";
import DateRangePicker from "../components/DateRangePicker";
import EmptyState from "../components/EmptyState";
import LineChart from "../components/LineChart";
import Section from "../components/Section";
import SegmentControl from "../components/SegmentControl";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { colors, radius, shadows, spacing } from "../theme";
import { formatNumber, getUserNumber, todayInput } from "../utils/format";
import Screen from "./Screen";
import { screenStyles } from "./styles";

const metricOptions = [
  { label: "Lưu lượng", value: "flow" },
  { label: "Áp suất", value: "pressure" },
  { label: "Đồng hồ", value: "meter" }
];

const intervalOptions = [
  { label: "5p", value: 5 },
  { label: "15p", value: 15 },
  { label: "30p", value: 30 },
  { label: "1h", value: 60 },
  { label: "3h", value: 180 },
  { label: "6h", value: 360 },
  { label: "1 ngày", value: 1440 }
];

export default function ReportScreen({ navigation }) {
  const { token, user } = useAuth();
  const userNumber = getUserNumber(user);
  const [groups, setGroups] = useState({});
  const [selectedIds, setSelectedIds] = useState([]);
  const [metric, setMetric] = useState("flow");
  const [intervalMinutes, setIntervalMinutes] = useState(60);
  const [fromDate, setFromDate] = useState(todayInput());
  const [toDate, setToDate] = useState(todayInput());
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.groupInfo(token, userNumber).then((data) => setGroups(data.data || {})).catch(() => {});
  }, [token, userNumber]);

  const sensors = useMemo(() => Object.values(groups).flat(), [groups]);

  const toggleSensor = (sensor) => {
    setSelectedIds((prev) => prev.includes(sensor.id) ? prev.filter((id) => id !== sensor.id) : [...prev, sensor.id]);
  };

  const run = async () => {
    if (!selectedIds.length) {
      Alert.alert("Chưa chọn logger", "Hãy chọn ít nhất một logger.");
      return;
    }
    try {
      setLoading(true);
      const data = await api.report(token, {
        user: userNumber,
        loggerIds: selectedIds,
        fromDate: `${fromDate}T00:00:00.000Z`,
        toDate: `${toDate}T23:59:59.000Z`,
        metric,
        intervalMinutes
      });
      setResult(data);
    } catch (error) {
      Alert.alert("Không tạo được báo cáo", error.message);
    } finally {
      setLoading(false);
    }
  };

  const labels = (result?.labels || []).map((label) => new Date(label).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }));
  const datasets = (result?.series || []).slice(0, 4).map((serie, index) => ({
    data: (serie.values || []).map((value) => value ?? 0),
    color: () => ["#0f766e", "#2563eb", "#dc2626", "#d97706"][index] || colors.primary
  }));

  return (
    <Screen>
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name="document-text-outline" color={colors.surface} size={24} />
        </View>
        <View style={styles.heroCopy}>
          <Text style={styles.heroTitle}>Báo cáo logger</Text>
          <Text style={styles.heroSub}>Chọn nhiều logger để hiển thị chung trên một biểu đồ như web.</Text>
        </View>
      </View>

      <Section title="Nguồn dữ liệu" subtitle={`${selectedIds.length} logger đang chọn`}>
        <Pressable style={[screenStyles.outlineButton, { marginBottom: 10 }]} onPress={() => navigation.navigate("Compare")}>
          <Text style={screenStyles.outlineText}>Mở so sánh logger</Text>
        </Pressable>
        <ChipGroup
          items={sensors}
          value={null}
          getLabel={(sensor) => `${selectedIds.includes(sensor.id) ? "✓ " : ""}${sensor.name}`}
          onChange={toggleSensor}
        />
        {!sensors.length ? <EmptyState text="Không tải được danh sách logger." /> : null}
      </Section>

      <Section title="Bộ lọc báo cáo">
        <DateRangePicker fromDate={fromDate} toDate={toDate} onFromDateChange={setFromDate} onToDateChange={setToDate} />
        <SegmentControl options={metricOptions} value={metric} onChange={setMetric} />
        <ChipGroup
          items={intervalOptions}
          value={intervalMinutes}
          getLabel={(item) => item.label}
          onChange={(item) => setIntervalMinutes(item.value)}
        />
        <Pressable style={screenStyles.button} onPress={run} disabled={loading}>
          {loading ? <ActivityIndicator color={colors.surface} /> : <Text style={screenStyles.buttonText}>Tạo báo cáo</Text>}
        </Pressable>
      </Section>

      {result ? (
        <Section title="Biểu đồ so sánh" subtitle="Các đường dữ liệu được gom theo khoảng hiển thị đã chọn.">
          <LineChart labels={labels} datasets={datasets} />
          {(result.series || []).map((serie) => (
            <View key={serie.id} style={screenStyles.listItem}>
              <Text style={screenStyles.itemTitle}>{serie.name || `Logger ${serie.id}`}</Text>
              <Text style={screenStyles.itemSub}>
                Mẫu {serie.values?.filter((value) => value !== null).length || 0} · TB {formatNumber(serie.stats?.avgFlow || serie.stats?.avgPressure)}
              </Text>
            </View>
          ))}
        </Section>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.xl,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.lg,
    ...shadows.card
  },
  heroIcon: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    height: 50,
    justifyContent: "center",
    width: 50
  },
  heroCopy: { flex: 1 },
  heroTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900"
  },
  heroSub: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4
  }
});
