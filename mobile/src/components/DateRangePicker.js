import { StyleSheet, TextInput, View } from "react-native";
import { colors, radius, spacing } from "../theme";

export default function DateRangePicker({ fromDate, toDate, onFromDateChange, onToDateChange }) {
  return (
    <View style={styles.row}>
      <TextInput style={styles.input} value={fromDate} onChangeText={onFromDateChange} placeholder="YYYY-MM-DD" />
      <TextInput style={styles.input} value={toDate} onChangeText={onToDateChange} placeholder="YYYY-MM-DD" />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.sm
  },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderColor: "#cbd5e1",
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: spacing.md,
    paddingVertical: 11
  }
});
