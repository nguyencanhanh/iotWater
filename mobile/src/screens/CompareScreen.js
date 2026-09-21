import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import ChipGroup from "../components/ChipGroup";
import DateRangePicker from "../components/DateRangePicker";
import LineChart from "../components/LineChart";
import Section from "../components/Section";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { colors } from "../theme";
import { getUserNumber, todayInput } from "../utils/format";
import Screen from "./Screen";
import { screenStyles } from "./styles";

export default function CompareScreen() {
  const { token, user } = useAuth();
  const userNumber = getUserNumber(user);
  const [groups, setGroups] = useState({});
  const [sensorA, setSensorA] = useState(null);
  const [sensorB, setSensorB] = useState(null);
  const [dateA, setDateA] = useState(todayInput());
  const [dateB, setDateB] = useState(todayInput());
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.groupInfo(token, userNumber).then((data) => setGroups(data.data || {})).catch(() => {});
  }, [token, userNumber]);

  const sensors = useMemo(() => Object.values(groups).flat(), [groups]);

  const run = async () => {
    if (!sensorA || !sensorB) {
      Alert.alert("Chưa chọn đủ logger", "Hãy chọn logger A và logger B.");
      return;
    }
    try {
      setLoading(true);
      const [a, b] = await Promise.all([
        api.sensorSeries(token, { user: userNumber, sen_name: sensorA.id, timeGet: [`${dateA}T00:00:00.000Z`, `${dateA}T23:59:59.000Z`] }),
        api.sensorSeries(token, { user: userNumber, sen_name: sensorB.id, timeGet: [`${dateB}T00:00:00.000Z`, `${dateB}T23:59:59.000Z`] })
      ]);
      setResult({ a, b });
    } catch (error) {
      Alert.alert("Không so sánh được", error.message);
    } finally {
      setLoading(false);
    }
  };

  const labels = (result?.a?.sensorH || []).filter(Boolean).slice(-80).map((_, index) => String(index + 1));

  return (
    <Screen>
      <Section title="Logger A">
        <ChipGroup items={sensors} value={sensorA} getLabel={(item) => item.name} onChange={setSensorA} />
      </Section>
      <Section title="Logger B">
        <ChipGroup items={sensors} value={sensorB} getLabel={(item) => item.name} onChange={setSensorB} />
      </Section>
      <Section title="Ngày so sánh">
        <DateRangePicker fromDate={dateA} toDate={dateB} onFromDateChange={setDateA} onToDateChange={setDateB} />
        <Pressable style={screenStyles.button} onPress={run} disabled={loading}>
          {loading ? <ActivityIndicator color={colors.surface} /> : <Text style={screenStyles.buttonText}>So sánh</Text>}
        </Pressable>
      </Section>
      {result ? (
        <Section title="Áp suất">
          <LineChart
            labels={labels}
            datasets={[
              { data: (result.a.sensorH || []).filter(Boolean).slice(-80), color: () => colors.primary },
              { data: (result.b.sensorH || []).filter(Boolean).slice(-80), color: () => "#2563eb" }
            ]}
          />
          <View style={screenStyles.listItem}>
            <Text style={screenStyles.itemTitle}>{sensorA?.name} vs {sensorB?.name}</Text>
            <Text style={screenStyles.itemSub}>So sánh áp suất theo dữ liệu trong ngày đã chọn.</Text>
          </View>
        </Section>
      ) : null}
    </Screen>
  );
}
