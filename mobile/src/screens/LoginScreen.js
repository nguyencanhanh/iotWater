import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Alert, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";
import { API_BASE_URL } from "../api";
import { useAuth } from "../context/AuthContext";
import { colors, radius, shadows, spacing } from "../theme";
import { screenStyles } from "./styles";
import { Pressable } from "react-native";

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email || !password) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập email và mật khẩu.");
      return;
    }
    try {
      setLoading(true);
      await login(email, password);
    } catch (error) {
      Alert.alert("Không đăng nhập được", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.glowOne} />
      <View style={styles.glowTwo} />
      <View style={styles.panel}>
        <View style={styles.logoMark}>
          <Ionicons name="water-outline" color={colors.surface} size={30} />
        </View>
        <Text style={styles.logo}>IoT Water</Text>
        <Text style={styles.sub}>Đăng nhập hệ thống giám sát nước</Text>
        <TextInput
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="Email"
          placeholderTextColor="#94a3b8"
          style={screenStyles.input}
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          placeholder="Mật khẩu"
          placeholderTextColor="#94a3b8"
          secureTextEntry
          style={screenStyles.input}
          value={password}
          onChangeText={setPassword}
        />
        <Pressable style={screenStyles.button} onPress={submit} disabled={loading}>
          {loading ? <ActivityIndicator color={colors.surface} /> : <Text style={screenStyles.buttonText}>Đăng nhập</Text>}
        </Pressable>
        <Text style={styles.api}>API: {API_BASE_URL}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: colors.primaryDark,
    padding: spacing.lg
  },
  glowOne: {
    backgroundColor: "rgba(45,212,191,0.22)",
    borderRadius: 160,
    height: 220,
    position: "absolute",
    right: -80,
    top: 80,
    width: 220
  },
  glowTwo: {
    backgroundColor: "rgba(37,99,235,0.18)",
    borderRadius: 160,
    bottom: 80,
    height: 220,
    left: -90,
    position: "absolute",
    width: 220
  },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    ...shadows.card
  },
  logoMark: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    height: 62,
    justifyContent: "center",
    marginBottom: spacing.md,
    width: 62
  },
  logo: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "900"
  },
  sub: {
    color: colors.muted,
    marginBottom: spacing.lg,
    marginTop: spacing.xs
  },
  api: {
    color: colors.muted,
    fontSize: 12,
    marginTop: spacing.md
  }
});
