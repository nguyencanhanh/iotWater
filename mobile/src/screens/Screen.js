import { RefreshControl, ScrollView, Text, View } from "react-native";
import LoadingScreen from "../components/LoadingScreen";
import { screenStyles } from "./styles";

export default function Screen({ children, loading, error, refreshing = false, onRefresh }) {
  if (loading) return <LoadingScreen />;
  return (
    <View style={screenStyles.scroll}>
      <View style={screenStyles.topGlow} />
      <ScrollView
        style={screenStyles.scroll}
        contentContainerStyle={screenStyles.content}
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}
      >
        {error ? <Text style={screenStyles.errorBox}>{error}</Text> : null}
        {children}
      </ScrollView>
    </View>
  );
}
