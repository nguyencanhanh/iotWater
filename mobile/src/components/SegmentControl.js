import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, shadows } from "../theme";

export default function SegmentControl({ options, value, onChange }) {
  return (
    <View style={styles.segment}>
      {options.map((option) => {
        const key = option.value ?? option;
        const label = option.label ?? option;
        const active = value === key;
        return (
          <Pressable key={key} style={[styles.button, active && styles.active]} onPress={() => onChange(key)}>
            <Text style={[styles.text, active && styles.activeText]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  segment: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.xl,
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: 10,
    padding: 4,
    ...shadows.soft
  },
  button: {
    alignItems: "center",
    borderRadius: radius.lg,
    flex: 1,
    paddingVertical: 9
  },
  active: {
    backgroundColor: colors.primary
  },
  text: {
    color: "#475569",
    fontWeight: "800"
  },
  activeText: {
    color: colors.surface
  }
});
