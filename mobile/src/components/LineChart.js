import { Dimensions, StyleSheet, Text, View } from "react-native";
import { LineChart as KitLineChart } from "react-native-chart-kit";
import { colors, radius, shadows, spacing } from "../theme";

const chartConfig = {
  backgroundGradientFrom: colors.surface,
  backgroundGradientTo: colors.surface,
  color: (opacity = 1) => `rgba(15, 118, 110, ${opacity})`,
  decimalPlaces: 1,
  labelColor: () => colors.muted,
  propsForDots: {
    r: "2"
  }
};

export default function LineChart({ title, labels = [], datasets = [] }) {
  const cleanDatasets = datasets
    .map((dataset) => ({
      data: (dataset.data || []).map((value) => Number(value) || 0),
      color: dataset.color,
      strokeWidth: dataset.strokeWidth || 2,
      label: dataset.label
    }))
    .filter((dataset) => dataset.data.length);

  if (!cleanDatasets.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Chưa có dữ liệu biểu đồ.</Text>
      </View>
    );
  }

  const dataLength = Math.max(labels.length, ...cleanDatasets.map((dataset) => dataset.data.length));
  const normalizedLabels = Array.from({ length: dataLength }, (_, index) => labels[index] || String(index + 1));
  const normalizedDatasets = cleanDatasets.map((dataset) => ({
    ...dataset,
    data: dataset.data.length === dataLength
      ? dataset.data
      : [...dataset.data, ...Array.from({ length: dataLength - dataset.data.length }, () => dataset.data[dataset.data.length - 1] || 0)]
  }));
  const width = Math.max(Dimensions.get("window").width - 28, 320);
  const labelStep = Math.max(Math.ceil(normalizedLabels.length / 6), 1);
  const chartLabels = normalizedLabels.map((label, index) => (index % labelStep === 0 ? label : ""));

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        {title ? <Text style={styles.title}>{title}</Text> : null}
        <View style={styles.legend}>
          {cleanDatasets.map((dataset, index) => {
            const color = dataset.color?.() || colors.primary;
            return dataset.label ? (
              <View key={`${dataset.label}-${index}`} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: color }]} />
                <Text style={styles.legendText}>{dataset.label}</Text>
              </View>
            ) : null;
          })}
        </View>
      </View>
      <KitLineChart
        data={{ labels: chartLabels, datasets: normalizedDatasets }}
        width={width}
        height={220}
        chartConfig={chartConfig}
        bezier
        fromZero={false}
        style={styles.chart}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.xl,
    borderWidth: 1,
    marginBottom: spacing.md,
    overflow: "hidden",
    paddingTop: spacing.md,
    ...shadows.card
  },
  header: {
    paddingHorizontal: spacing.md
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
    marginBottom: spacing.sm
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.sm
  },
  legendItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5
  },
  legendDot: {
    borderRadius: 999,
    height: 8,
    width: 8
  },
  legendText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800"
  },
  chart: {
    borderRadius: radius.md
  },
  empty: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.lg
  },
  emptyText: {
    color: colors.muted
  }
});
