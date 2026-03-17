import { useEffect, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { View, ActivityIndicator } from "react-native";
import { SesionProvider, useSesion } from "../src/store/sesionStore";
import { inicializarDB } from "../src/services/db";

function NavigationGuard() {
  const { sesion, cargando } = useSesion();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (cargando) return;

    const enAuth = segments[0] === "(auth)";
    if (!sesion && !enAuth) {
      router.replace("/(auth)/login");
    } else if (sesion && enAuth) {
      router.replace("/(tabs)/mis-predios");
    }
  }, [sesion, cargando, segments]);

  return null;
}

export default function RootLayout() {
  const [dbLista, setDbLista] = useState(false);

  useEffect(() => {
    inicializarDB()
      .then(() => setDbLista(true))
      .catch(console.error);
  }, []);

  if (!dbLista) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color="#1a7f4b" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SesionProvider>
        <NavigationGuard />
        <Stack screenOptions={{ headerShown: false }} />
        <StatusBar style="auto" />
      </SesionProvider>
    </GestureHandlerRootView>
  );
}
