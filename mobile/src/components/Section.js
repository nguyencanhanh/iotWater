import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../theme";

export default function Section({ title, subtitle, children }) {
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: spacing.xl
  },
  header: {
    marginBottom: spacing.sm
  },
  title: {
    ...typography.section
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 3
  }
});
