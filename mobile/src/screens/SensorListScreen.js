import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import EmptyState from "../components/EmptyState";
import SensorCard from "../components/SensorCard";
import Section from "../components/Section";
import StatCard from "../components/StatCard";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { extractLatest, getUserNumber } from "../utils/format";
import { colors, radius, shadows, spacing } from "../theme";
import Screen from "./Screen";
import { screenStyles } from "./styles";

export default function SensorListScreen({ route, navigation }) {
  const group = route.params?.group || "Không có";
  const { token, user } = useAuth();
  const userNumber = getUserNumber(user);
  const [state, setState] = useState({ loading: true, refreshing: false, error: "", sensors: [], latest: {} });

  const load = useCallback(async (refreshing = false) => {
    try {
      setState((prev) => ({ ...prev, loading: !refreshing, refreshing, error: "" }));
      const [list, info] = await Promise.all([
        api.sensorsInGroup(token, userNumber, group),
        api.groupInfo(token, userNumber)
      ]);
      setState({
        loading: false,
        refreshing: false,
        error: "",
        sensors: list.senInGroup || [],
        latest: info.valueSenS || {}
      });
    } catch (error) {
      setState((prev) => ({ ...prev, loading: false, refreshing: false, error: error.message }));
    }
  }, [group, token, userNumber]);

  useEffect(() => {
    load();
  }, [load]);

  const connected = state.sensors.filter((sensor) => Boolean(extractLatest(state.latest, sensor))).length;
  const lost = Math.max(state.sensors.length - connected, 0);

  return (
    <Screen loading={state.loading} error={state.error} refreshing={state.refreshing} onRefresh={() => load(true)}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>{group || "Không có"}</Text>
        <Text style={styles.heroSub}>Chạm vào logger để xem số liệu tổng quan, biểu đồ và bảng chi tiết.</Text>
      </View>
      <View style={screenStyles.grid}>
        <StatCard title="Logger" value={state.sensors.length} icon="speedometer-outline" />
        <StatCard title="Mất tín hiệu" value={lost} tone={lost ? "bad" : "good"} icon="unlink-outline" />
      </View>

      <Section title="Logger trong nhóm">
        {state.sensors.map((sensor) => (
          <SensorCard
            key={sensor.id}
            sensor={sensor}
            latest={extractLatest(state.latest, sensor)}
            onPress={() => navigation.navigate("SensorDetail", { sensor })}
          />
        ))}
        {!state.sensors.length ? <EmptyState text="Nhóm này chưa có logger." /> : null}
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
  heroTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900"
  },
  heroSub: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5
  }
});
