import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "../theme";

export default function EmptyState({ text }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.lg
  },
  text: {
    color: colors.muted
  }
});
