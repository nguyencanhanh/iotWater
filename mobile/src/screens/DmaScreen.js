import { useCallback, useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import DateRangePicker from "../components/DateRangePicker";
import MetricBox from "../components/MetricBox";
import Section from "../components/Section";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { colors, radius, shadows, spacing } from "../theme";
import { formatNumber, getUserNumber, todayInput } from "../utils/format";
import Screen from "./Screen";
import { screenStyles } from "./styles";

export default function DmaScreen() {
  const { token, user } = useAuth();
  const userNumber = getUserNumber(user);
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [fromDate, setFromDate] = useState(todayInput());
  const [toDate, setToDate] = useState(todayInput());
  const [result, setResult] = useState(null);
  const [formName, setFormName] = useState("");
  const [formInlets, setFormInlets] = useState("");
  const [formConsumes, setFormConsumes] = useState("");
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await api.dmas(token, userNumber);
      setItems(data.dmas || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token, userNumber]);

  useEffect(() => {
    load();
  }, [load]);

  const ids = (value) => value.split(",").map((item) => Number(item.trim())).filter(Number.isFinite);

  const calculate = async () => {
    if (!selected) {
      Alert.alert("Chưa chọn DMA", "Hãy chọn một DMA để tính thất thoát.");
      return;
    }
    try {
      setCalculating(true);
      const data = await api.dmaCalculate(token, { user: userNumber, dmaId: selected._id, fromDate, toDate });
      setResult(data.result);
    } catch (err) {
      Alert.alert("Không tính được DMA", err.message);
    } finally {
      setCalculating(false);
    }
  };

  const save = async () => {
    if (!formName.trim()) {
      Alert.alert("Thiếu tên DMA", "Nhập tên DMA trước khi lưu.");
      return;
    }
    try {
      const payload = {
        user: userNumber,
        name: formName,
        inletLoggerIds: ids(formInlets),
        consumeLoggerIds: ids(formConsumes),
        sensorLinks: []
      };
      if (selected) await api.dmaUpdate(token, selected._id, payload);
      else await api.dmaCreate(token, payload);
      setFormName("");
      setFormInlets("");
      setFormConsumes("");
      setSelected(null);
      load();
    } catch (err) {
      Alert.alert("Không lưu được DMA", err.message);
    }
  };

  const remove = async () => {
    if (!selected) return;
    try {
      await api.dmaDelete(token, selected._id, userNumber);
      setSelected(null);
      setResult(null);
      load();
    } catch (err) {
      Alert.alert("Không xóa được DMA", err.message);
    }
  };

  const select = (item) => {
    setSelected(item);
    setFormName(item.name || "");
    setFormInlets((item.inletLoggerIds || []).join(","));
    setFormConsumes((item.consumeLoggerIds || []).join(","));
  };

  return (
    <Screen loading={loading} error={error} onRefresh={load}>
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name="analytics-outline" color={colors.surface} size={24} />
        </View>
        <View style={styles.heroCopy}>
          <Text style={styles.heroTitle}>Tính thất thoát DMA</Text>
          <Text style={styles.heroSub}>Chọn bộ DMA đã lưu, chọn ngày rồi tính nhanh nước vào, tiêu thụ và thất thoát.</Text>
        </View>
      </View>

      <Section title="Bộ DMA đã lưu">
        {items.map((item) => (
          <Pressable key={item._id} style={[screenStyles.listItem, selected?._id === item._id && screenStyles.selectedItem]} onPress={() => select(item)}>
            <Text style={screenStyles.itemTitle}>{item.name}</Text>
            <Text style={screenStyles.itemSub}>{item.group || "Không có nhóm"} · Inlet {item.inletLoggerIds?.length || 0}</Text>
          </Pressable>
        ))}
      </Section>

      <Section title="Tính thất thoát" subtitle={selected ? `Đang chọn ${selected.name}` : "Chọn một DMA ở trên trước khi tính."}>
        <DateRangePicker fromDate={fromDate} toDate={toDate} onFromDateChange={setFromDate} onToDateChange={setToDate} />
        <Pressable style={screenStyles.button} onPress={calculate} disabled={calculating}>
          {calculating ? <ActivityIndicator color={colors.surface} /> : <Text style={screenStyles.buttonText}>Tính DMA</Text>}
        </Pressable>
      </Section>

      {result ? (
        <Section title="Kết quả">
          <View style={screenStyles.grid}>
            <MetricBox label="Nước vào" value={formatNumber(result.inletTotal)} unit="m³" />
            <MetricBox label="Tiêu thụ" value={formatNumber(result.accountedTotal)} unit="m³" />
            <MetricBox label="Thất thoát" value={formatNumber(result.loss)} unit="m³" />
            <MetricBox label="Tỷ lệ" value={formatNumber(result.lossRate)} unit="%" />
          </View>
        </Section>
      ) : null}

      <Section title={selected ? "Sửa DMA" : "Tạo DMA"} subtitle="Bản mobile nhập nhanh ID logger, cấu hình cây chi tiết nên làm trên web.">
        <TextInput style={screenStyles.input} value={formName} onChangeText={setFormName} placeholder="Tên DMA" />
        <TextInput style={screenStyles.input} value={formInlets} onChangeText={setFormInlets} placeholder="Logger nước vào: 101,102" />
        <TextInput style={screenStyles.input} value={formConsumes} onChangeText={setFormConsumes} placeholder="Logger tiêu thụ: 201,202" />
        <Pressable style={screenStyles.button} onPress={save}>
          <Text style={screenStyles.buttonText}>Lưu DMA</Text>
        </Pressable>
        {selected ? (
          <Pressable style={[screenStyles.outlineButton, { marginTop: 8 }]} onPress={remove}>
            <Text style={screenStyles.outlineText}>Xóa DMA</Text>
          </Pressable>
        ) : null}
      </Section>
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
    backgroundColor: colors.primary,
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
