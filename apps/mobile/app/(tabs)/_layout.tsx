import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSesion } from "../../src/store/sesionStore";
import { Text, View, TouchableOpacity, StyleSheet } from "react-native";

const VERDE = "#1a7f4b";

export default function TabsLayout() {
  const { salir, sesion } = useSesion();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: VERDE,
        tabBarInactiveTintColor: "#666",
        headerStyle: { backgroundColor: VERDE },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "bold" },
        headerRight: () => (
          <TouchableOpacity onPress={salir} style={styles.salirBtn}>
            <Ionicons name="log-out-outline" size={22} color="#fff" />
          </TouchableOpacity>
        ),
      }}
    >
      <Tabs.Screen
        name="mis-predios"
        options={{
          title: "Mis Predios",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="mis-lotes"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="mis-campanas"
        options={{
          title: "Campañas",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="clipboard-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="sync"
        options={{
          title: "Sincronizar",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cloud-upload-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="verificar"
        options={{
          title: "Verificar",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="qr-code-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  salirBtn: { marginRight: 14 },
});
