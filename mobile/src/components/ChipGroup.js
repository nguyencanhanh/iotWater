import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { colors, shadows, spacing } from "../theme";

export default function ChipGroup({ items, value, onChange, getLabel = (item) => item }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      {items.map((item) => {
        const key = String(item?._id ?? item?.id ?? item);
        const label = getLabel(item);
        const active = value === item || value === key || value === label;
        return (
          <Pressable key={key} style={[styles.chip, active && styles.active]} onPress={() => onChange(item)}>
            <Text style={[styles.text, active && styles.activeText]}>{label || "Không có"}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: spacing.sm,
    marginRight: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    ...shadows.soft
  },
  active: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  text: {
    color: "#334155",
    fontWeight: "700"
  },
  activeText: {
    color: colors.surface
  }
});
