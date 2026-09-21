import { Ionicons } from "@expo/vector-icons";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { colors } from "../theme";
import { useAuth } from "../context/AuthContext";
import LoadingScreen from "../components/LoadingScreen";
import LoginScreen from "../screens/LoginScreen";
import HomeScreen from "../screens/HomeScreen";
import SensorGroupScreen from "../screens/SensorGroupScreen";
import SensorListScreen from "../screens/SensorListScreen";
import SensorDetailScreen from "../screens/SensorDetailScreen";
import ReportScreen from "../screens/ReportScreen";
import CompareScreen from "../screens/CompareScreen";
import PrvScreen from "../screens/PrvScreen";
import DmaScreen from "../screens/DmaScreen";
import SettingsScreen from "../screens/SettingsScreen";

const RootStack = createNativeStackNavigator();
const SensorStack = createNativeStackNavigator();
const ReportStack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

const headerOptions = {
  headerStyle: { backgroundColor: colors.primaryDark },
  headerTintColor: colors.surface,
  headerTitleStyle: { fontWeight: "900" },
  headerShadowVisible: false
};

function SensorsNavigator() {
  return (
    <SensorStack.Navigator screenOptions={headerOptions}>
      <SensorStack.Screen name="SensorGroups" component={SensorGroupScreen} options={{ title: "Logger" }} />
      <SensorStack.Screen name="SensorList" component={SensorListScreen} options={({ route }) => ({ title: route.params?.group || "Logger" })} />
      <SensorStack.Screen name="SensorDetail" component={SensorDetailScreen} options={{ title: "Chi tiết logger" }} />
    </SensorStack.Navigator>
  );
}

function ReportNavigator() {
  return (
    <ReportStack.Navigator screenOptions={headerOptions}>
      <ReportStack.Screen name="ReportMain" component={ReportScreen} options={{ title: "Báo cáo" }} />
      <ReportStack.Screen name="Compare" component={CompareScreen} options={{ title: "So sánh" }} />
    </ReportStack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: colors.primaryDark },
        headerTintColor: colors.surface,
        headerTitleStyle: { fontWeight: "900" },
        headerShadowVisible: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "800" },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: 22,
          borderTopWidth: 0,
          bottom: 12,
          elevation: 12,
          height: 70,
          left: 12,
          paddingBottom: 10,
          paddingTop: 8,
          position: "absolute",
          right: 12,
          shadowColor: "#0f172a",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.14,
          shadowRadius: 18
        },
        tabBarIcon: ({ color, size }) => {
          const icons = {
            Home: "home-outline",
            Sensors: "speedometer-outline",
            Reports: "document-text-outline",
            Prv: "git-branch-outline",
            Dma: "analytics-outline",
            Settings: "settings-outline"
          };
          return <Ionicons name={icons[route.name]} color={color} size={size} />;
        }
      })}
    >
      <Tabs.Screen name="Home" component={HomeScreen} options={{ title: "Trang chủ", tabBarLabel: "Trang chủ" }} />
      <Tabs.Screen name="Sensors" component={SensorsNavigator} options={{ headerShown: false, tabBarLabel: "Logger" }} />
      <Tabs.Screen name="Reports" component={ReportNavigator} options={{ headerShown: false, tabBarLabel: "Báo cáo" }} />
      <Tabs.Screen name="Prv" component={PrvScreen} options={{ title: "PRV", tabBarLabel: "PRV" }} />
      <Tabs.Screen name="Dma" component={DmaScreen} options={{ title: "DMA", tabBarLabel: "DMA" }} />
      <Tabs.Screen name="Settings" component={SettingsScreen} options={{ title: "Cài đặt", tabBarLabel: "Cài đặt" }} />
    </Tabs.Navigator>
  );
}

export default function AppNavigation() {
  const { booting, isAuthenticated } = useAuth();
  if (booting) return <LoadingScreen text="Đang mở IoT Water..." />;

  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <RootStack.Screen name="Main" component={MainTabs} />
        ) : (
          <RootStack.Screen name="Login" component={LoginScreen} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
