import { useCallback, useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import EmptyState from "../components/EmptyState";
import Section from "../components/Section";
import StatCard from "../components/StatCard";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { getUserNumber } from "../utils/format";
import { colors, radius, shadows, spacing } from "../theme";
import Screen from "./Screen";
import { screenStyles } from "./styles";

export default function SensorGroupScreen({ navigation }) {
  const { token, user } = useAuth();
  const userNumber = getUserNumber(user);
  const [state, setState] = useState({ loading: true, refreshing: false, error: "", groups: {}, latest: {}, online: 0 });

  const load = useCallback(async (refreshing = false) => {
    try {
      setState((prev) => ({ ...prev, loading: !refreshing, refreshing, error: "" }));
      const data = await api.groupInfo(token, userNumber);
      setState({
        loading: false,
        refreshing: false,
        error: "",
        groups: data.data || {},
        latest: data.valueSenS || {},
        online: data.dataSensorOnline || 0
      });
    } catch (error) {
      setState((prev) => ({ ...prev, loading: false, refreshing: false, error: error.message }));
    }
  }, [token, userNumber]);

  useEffect(() => {
    load();
  }, [load]);

  const groupEntries = Object.entries(state.groups);
  const total = groupEntries.reduce((sum, [, sensors]) => sum + sensors.length, 0);

  return (
    <Screen loading={state.loading} error={state.error} refreshing={state.refreshing} onRefresh={() => load(true)}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Danh sách logger</Text>
        <Text style={styles.heroSub}>Quản lý logger theo nhóm giống sidebar trên web, nhưng gọn hơn cho điện thoại.</Text>
      </View>
      <View style={screenStyles.grid}>
        <StatCard title="Tổng logger" value={total} icon="speedometer-outline" />
        <StatCard title="Kết nối" value={state.online} tone="good" icon="checkmark-circle" />
      </View>

      <Section title="Nhóm logger">
        {groupEntries.map(([name, sensors]) => (
          <Pressable
            key={name}
            style={styles.groupCard}
            onPress={() => navigation.navigate("SensorList", { group: name })}
          >
            <View style={styles.groupIcon}>
              <Ionicons name="folder-open-outline" color={colors.primary} size={22} />
            </View>
            <View style={styles.groupCopy}>
              <Text style={screenStyles.itemTitle}>{name || "Không có"}</Text>
              <Text style={screenStyles.itemSub}>{sensors.length} logger</Text>
            </View>
            <Ionicons name="chevron-forward" color={colors.muted} size={20} />
          </Pressable>
        ))}
        {!groupEntries.length ? <EmptyState text="Chưa có nhóm logger." /> : null}
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
  },
  groupCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.xl,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    ...shadows.soft
  },
  groupIcon: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: radius.lg,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  groupCopy: {
    flex: 1
  }
});
