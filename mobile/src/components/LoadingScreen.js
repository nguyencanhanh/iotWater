import { ActivityIndicator, SafeAreaView, StyleSheet, Text } from "react-native";
import { colors } from "../theme";

export default function LoadingScreen({ text = "Đang tải..." }) {
  return (
    <SafeAreaView style={styles.container}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={styles.text}>{text}</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background
  },
  text: {
    color: colors.muted,
    marginTop: 10
  }
});
