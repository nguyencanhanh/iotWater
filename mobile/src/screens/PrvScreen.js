import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import LineChart from "../components/LineChart";
import MetricBox from "../components/MetricBox";
import Section from "../components/Section";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { colors } from "../theme";
import { formatNumber, getUserNumber, lastNumber } from "../utils/format";
import Screen from "./Screen";
import { screenStyles } from "./styles";

export default function PrvScreen() {
  const { token, user } = useAuth();
  const userNumber = getUserNumber(user);
  const [items, setItems] = useState([]);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await api.prvs(token, userNumber);
      setItems(data.info || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token, userNumber]);

  useEffect(() => {
    load();
  }, [load]);

  const open = async (item) => {
    try {
      const data = await api.prvDetail(token, userNumber, item.id);
      setDetail(data);
    } catch (err) {
      Alert.alert("Không tải được PRV", err.message);
    }
  };

  const chartLabels = (detail?.prvDataP1 || []).slice(-80).map((_, index) => String(index + 1));

  return (
    <Screen loading={loading} error={error} onRefresh={load}>
      <Section title="Danh sách PRV">
        {items.map((item) => (
          <Pressable key={item.id} style={screenStyles.listItem} onPress={() => open(item)}>
            <Text style={screenStyles.itemTitle}>{item.name}</Text>
            <Text style={screenStyles.itemSub}>ID {item.id}</Text>
          </Pressable>
        ))}
      </Section>

      {detail ? (
        <>
          <Section title={detail.info?.name || "Chi tiết PRV"}>
            <View style={screenStyles.grid}>
              <MetricBox label="P1" value={formatNumber(lastNumber(detail.prvDataP1))} unit="m" />
              <MetricBox label="P2" value={formatNumber(lastNumber(detail.prvDataP2))} unit="m" />
              <MetricBox label="P3" value={formatNumber(lastNumber(detail.prvDataP3))} unit="m" />
              <MetricBox label="Flow" value={formatNumber(lastNumber(detail.prvDataF))} unit="m³/h" />
            </View>
          </Section>
          <Section title="Biểu đồ PRV">
            <LineChart
              labels={chartLabels}
              datasets={[
                { data: (detail.prvDataP1 || []).filter(Boolean).slice(-80), color: () => colors.primary },
                { data: (detail.prvDataP2 || []).filter(Boolean).slice(-80), color: () => "#2563eb" },
                { data: (detail.prvDataF || []).filter(Boolean).slice(-80), color: () => "#d97706" }
              ]}
            />
          </Section>
          <Section title="Lịch điều khiển">
            {(detail.time || []).map((item, index) => (
              <View key={`${item.time}-${index}`} style={screenStyles.listItem}>
                <Text style={screenStyles.itemTitle}>{item.time}</Text>
                <Text style={screenStyles.itemSub}>Min {item.minSetpoint} · Max {item.maxSetpoint}</Text>
              </View>
            ))}
          </Section>
        </>
      ) : null}
    </Screen>
  );
}
