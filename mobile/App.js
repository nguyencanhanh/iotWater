import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "./src/context/AuthContext";
import AppNavigation from "./src/navigation";

export default function App() {
  return (
    <AuthProvider>
      <StatusBar style="light" backgroundColor="#0f766e" />
      <AppNavigation />
    </AuthProvider>
  );
}
