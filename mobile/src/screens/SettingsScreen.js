import { useCallback, useEffect, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import ChipGroup from "../components/ChipGroup";
import Section from "../components/Section";
import SegmentControl from "../components/SegmentControl";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { colors, radius, shadows, spacing } from "../theme";
import { getUserNumber } from "../utils/format";
import Screen from "./Screen";
import { screenStyles } from "./styles";

const tabs = [
  { label: "Nhóm", value: "group" },
  { label: "DNP", value: "dnp" },
  { label: "Chung", value: "general" }
];

export default function SettingsScreen() {
  const { token, user, logout } = useAuth();
  const userNumber = getUserNumber(user);
  const [active, setActive] = useState("group");
  const [groups, setGroups] = useState([]);
  const [sensors, setSensors] = useState([]);
  const [selectedSensor, setSelectedSensor] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState("Không có");
  const [newGroup, setNewGroup] = useState("");
  const [dnpName, setDnpName] = useState("DNP");
  const [dnpIds, setDnpIds] = useState("");
  const [zoom, setZoom] = useState("15");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [groupData, dnp, general] = await Promise.all([
        api.groups(token, userNumber),
        api.dnpConfig(token, userNumber),
        api.generalSettings(token, userNumber)
      ]);
      setGroups(groupData.group || []);
      setSensors(groupData.sen_group || []);
      setDnpName(dnp.config?.name || "DNP");
      setDnpIds((dnp.config?.loggerIds || []).join(","));
      setZoom(String(general.setting?.mapTooltipMinZoom ?? 15));
    } catch {
      // Settings remains usable for logout even when API fails.
    }
  }, [token, userNumber]);

  useEffect(() => {
    load();
  }, [load]);

  const sensorNames = useMemo(() => sensors.map((item) => item.name), [sensors]);

  const changeGroup = async () => {
    if (!selectedSensor) {
      Alert.alert("Chưa chọn logger", "Hãy chọn logger cần đổi nhóm.");
      return;
    }
    try {
      await api.changeGroup(token, { user: userNumber, name: selectedSensor, newGroup: selectedGroup });
      load();
      Alert.alert("Đã đổi nhóm", "Logger đã được cập nhật nhóm.");
    } catch (error) {
      Alert.alert("Không đổi được nhóm", error.message);
    }
  };

  const addGroup = async () => {
    if (!newGroup.trim()) return;
    try {
      await api.addGroup(token, { user: userNumber, name: newGroup.trim() });
      setNewGroup("");
      load();
    } catch (error) {
      Alert.alert("Không thêm được nhóm", error.message);
    }
  };

  const deleteGroup = async () => {
    if (!selectedGroup || selectedGroup === "Không có") return;
    try {
      await api.deleteGroup(token, { user: userNumber, name: selectedGroup });
      setSelectedGroup("Không có");
      load();
    } catch (error) {
      Alert.alert("Không xóa được nhóm", error.message);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      await Promise.all([
        api.saveDnpConfig(token, {
          user: userNumber,
          name: dnpName,
          loggerIds: dnpIds.split(",").map((item) => Number(item.trim())).filter(Number.isFinite)
        }),
        api.saveGeneralSettings(token, {
          user: userNumber,
          mapTooltipMinZoom: Number(zoom)
        })
      ]);
      Alert.alert("Đã lưu", "Cài đặt đã được cập nhật.");
    } catch (err) {
      Alert.alert("Không lưu được", err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen onRefresh={load}>
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name="settings-outline" color={colors.surface} size={24} />
        </View>
        <View style={styles.heroCopy}>
          <Text style={styles.heroTitle}>Cài đặt hệ thống</Text>
          <Text style={styles.heroSub}>Đổi nhóm logger, cấu hình DNP và thông số chung giống khu vực cài đặt trên web.</Text>
        </View>
      </View>
      <SegmentControl options={tabs} value={active} onChange={setActive} />

      {active === "group" ? (
        <>
          <Section title="Đổi nhóm logger">
            <ChipGroup items={sensorNames} value={selectedSensor} onChange={setSelectedSensor} />
            <ChipGroup items={groups} value={selectedGroup} onChange={setSelectedGroup} />
            <Pressable style={screenStyles.button} onPress={changeGroup}>
              <Text style={screenStyles.buttonText}>Đổi nhóm</Text>
            </Pressable>
          </Section>
          <Section title="Quản lý nhóm" subtitle="Tên nhóm mới đặt ngay dưới danh sách để thao tác nhanh trên điện thoại.">
            <TextInput style={screenStyles.input} value={newGroup} onChangeText={setNewGroup} placeholder="Tên nhóm mới" />
            <Pressable style={screenStyles.button} onPress={addGroup}>
              <Text style={screenStyles.buttonText}>Thêm nhóm</Text>
            </Pressable>
            <Pressable style={[screenStyles.outlineButton, { marginTop: 8 }]} onPress={deleteGroup}>
              <Text style={screenStyles.outlineText}>Xóa nhóm đang chọn</Text>
            </Pressable>
          </Section>
        </>
      ) : null}

      {active === "dnp" ? (
        <Section title="Cấu hình DNP" subtitle="Các logger DNP sẽ dùng cho báo cáo tổng hợp.">
          <TextInput style={screenStyles.input} value={dnpName} onChangeText={setDnpName} placeholder="Tên DNP" />
          <TextInput style={screenStyles.input} value={dnpIds} onChangeText={setDnpIds} placeholder="Logger IDs: 101,102" />
          <Pressable style={screenStyles.button} onPress={saveSettings} disabled={saving}>
            {saving ? <ActivityIndicator color={colors.surface} /> : <Text style={screenStyles.buttonText}>Lưu DNP</Text>}
          </Pressable>
        </Section>
      ) : null}

      {active === "general" ? (
        <>
          <Section title="Cài đặt chung" subtitle="Cấu hình chung ảnh hưởng đến toàn bộ giao diện vận hành.">
            <TextInput style={screenStyles.input} value={zoom} onChangeText={setZoom} keyboardType="numeric" placeholder="Map tooltip min zoom" />
            <Pressable style={screenStyles.button} onPress={saveSettings} disabled={saving}>
              {saving ? <ActivityIndicator color={colors.surface} /> : <Text style={screenStyles.buttonText}>Lưu cài đặt</Text>}
            </Pressable>
          </Section>
          <Section title="Tài khoản">
            <View style={screenStyles.listItem}>
              <Text style={screenStyles.itemTitle}>{user?.name}</Text>
              <Text style={screenStyles.itemSub}>{user?.role}</Text>
            </View>
            <Pressable style={screenStyles.outlineButton} onPress={logout}>
              <Text style={screenStyles.outlineText}>Đăng xuất</Text>
            </Pressable>
          </Section>
        </>
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
    backgroundColor: colors.primaryDark,
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
