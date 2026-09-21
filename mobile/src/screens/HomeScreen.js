import { useCallback, useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import EmptyState from "../components/EmptyState";
import Section from "../components/Section";
import StatCard from "../components/StatCard";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { colors, radius, shadows, spacing } from "../theme";
import { getUserNumber } from "../utils/format";
import Screen from "./Screen";
import { screenStyles } from "./styles";

export default function HomeScreen() {
  const { token, user } = useAuth();
  const userNumber = getUserNumber(user);
  const [state, setState] = useState({ loading: true, refreshing: false, error: "", info: null, warnings: [], messages: [] });
  const [message, setMessage] = useState("");

  const load = useCallback(async (refreshing = false) => {
    try {
      setState((prev) => ({ ...prev, loading: !refreshing, refreshing, error: "" }));
      const [info, warnings, messages] = await Promise.all([
        api.groupInfo(token, userNumber),
        api.warningHistory(token, userNumber, "", { limit: 30 }),
        api.homeMessages(token, userNumber)
      ]);
      setState({
        loading: false,
        refreshing: false,
        error: "",
        info,
        warnings: warnings.histories || [],
        messages: messages.messages || []
      });
    } catch (error) {
      setState((prev) => ({ ...prev, loading: false, refreshing: false, error: error.message }));
    }
  }, [token, userNumber]);

  useEffect(() => {
    load();
  }, [load]);

  const createMessage = async () => {
    if (!message.trim()) return;
    try {
      await api.createHomeMessage(token, { user: userNumber, sender: user?.name || "Mobile", message });
      setMessage("");
      load(true);
    } catch (error) {
      Alert.alert("Không gửi được thông báo", error.message);
    }
  };

  const deleteMessage = async (id) => {
    try {
      await api.deleteHomeMessage(token, id);
      load(true);
    } catch (error) {
      Alert.alert("Không xóa được", error.message);
    }
  };

  const groups = state.info?.data || {};
  const sensors = Object.values(groups).flat();
  const online = state.info?.dataSensorOnline || 0;
  const offline = Math.max(sensors.length - online, 0);

  return (
    <Screen loading={state.loading} error={state.error} refreshing={state.refreshing} onRefresh={() => load(true)}>
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name="water-outline" color={colors.surface} size={28} />
        </View>
        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>IoT Water Mobile</Text>
          <Text style={styles.heroTitle}>Giám sát mạng logger</Text>
          <Text style={styles.heroSub}>Theo dõi kết nối, cảnh báo và tin nhắn vận hành theo thời gian thực.</Text>
        </View>
      </View>

      <View style={screenStyles.grid}>
        <StatCard title="Tổng số" value={sensors.length} icon="globe-outline" />
        <StatCard title="Mất tín hiệu" value={offline} tone={offline ? "bad" : "good"} icon="unlink-outline" />
        <StatCard title="Kết nối" value={online} tone="good" icon="checkmark-circle" />
        <StatCard title="Cảnh báo" value={state.warnings.length} tone={state.warnings.length ? "warn" : "good"} icon="warning" />
      </View>

      <Section title="Nhóm logger" subtitle="Chạm vào tab Logger bên dưới để xem chi tiết từng nhóm.">
        {Object.entries(groups).map(([name, items]) => (
          <View key={name} style={screenStyles.listItem}>
            <View style={screenStyles.rowBetween}>
              <Text style={screenStyles.itemTitle}>{name || "Không có"}</Text>
              <View style={[screenStyles.pill, styles.groupPill]}>
                <Text style={[screenStyles.pillText, styles.groupPillText]}>{items.length} logger</Text>
              </View>
            </View>
          </View>
        ))}
      </Section>

      <Section title="Cảnh báo hôm nay" subtitle="Hiển thị các cảnh báo mới nhất trong ngày.">
        {state.warnings.length ? state.warnings.map((item, index) => (
          <View key={`${item.sensorId || item.name}-${index}`} style={[screenStyles.listItem, styles.warningItem]}>
            <View style={styles.warningIcon}>
              <Ionicons name="warning" color={colors.warning} size={18} />
            </View>
            <View style={styles.warningCopy}>
              <Text style={screenStyles.itemTitle}>{item.sensorName || item.name || "Logger"}</Text>
              <Text style={screenStyles.itemSub}>{item.message || item.type || "Cảnh báo"}</Text>
              <Text style={screenStyles.itemSub}>{item.createAt ? new Date(item.createAt).toLocaleString("vi-VN") : ""}</Text>
            </View>
          </View>
        )) : <EmptyState text="Chưa có cảnh báo hôm nay." />}
      </Section>

      <Section title="Tin nhắn vận hành" subtitle="Gửi nhanh thông báo cho người đang theo dõi trang chủ.">
        <TextInput
          placeholder="Nội dung thông báo"
          placeholderTextColor="#94a3b8"
          style={[screenStyles.input, styles.messageInput]}
          value={message}
          onChangeText={setMessage}
          multiline
        />
        <Pressable style={screenStyles.button} onPress={createMessage}>
          <Text style={screenStyles.buttonText}>Gửi thông báo</Text>
        </Pressable>
        {state.messages.map((item) => (
          <Pressable key={item._id} style={[screenStyles.listItem, styles.messageCard]} onLongPress={() => deleteMessage(item._id)}>
            <View style={screenStyles.rowBetween}>
              <Text style={screenStyles.itemTitle}>{item.sender || "Người gửi"}</Text>
              <Ionicons name="trash-outline" color={colors.muted} size={16} />
            </View>
            <Text style={screenStyles.itemSub}>{item.message}</Text>
          </Pressable>
        ))}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: "center",
    backgroundColor: colors.primaryDark,
    borderRadius: radius.xl,
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.lg,
    ...shadows.card
  },
  heroIcon: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: radius.xl,
    height: 58,
    justifyContent: "center",
    width: 58
  },
  heroCopy: { flex: 1 },
  eyebrow: {
    color: colors.primarySoft,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.7,
    textTransform: "uppercase"
  },
  heroTitle: {
    color: colors.surface,
    fontSize: 22,
    fontWeight: "900",
    marginTop: 4
  },
  heroSub: {
    color: "#d1fae5",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5
  },
  groupPill: {
    backgroundColor: colors.primarySoft
  },
  groupPillText: {
    color: colors.primaryDark
  },
  warningItem: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md
  },
  warningIcon: {
    alignItems: "center",
    backgroundColor: colors.warningSoft,
    borderRadius: radius.md,
    height: 36,
    justifyContent: "center",
    width: 36
  },
  warningCopy: {
    flex: 1
  },
  messageInput: {
    minHeight: 84,
    textAlignVertical: "top"
  },
  messageCard: {
    marginTop: spacing.sm
  }
});
