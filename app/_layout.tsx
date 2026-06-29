import React from 'react';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { Platform, StyleSheet, View } from 'react-native';
import { Colors } from '../src/constants/colors';

// No web o SafeAreaProvider manipula document.body causando erros de cleanup.
// Em navegadores não há notch físico, então usamos View simples.
const SafeWrapper = Platform.OS === 'web'
  ? ({ children }: { children: React.ReactNode }) => <View style={{ flex: 1 }}>{children}</View>
  : ({ children }: { children: React.ReactNode }) => (
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>{children}</SafeAreaProvider>
    );

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeWrapper>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: Colors.background },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="entrada" options={{ headerShown: false }} />
          <Stack.Screen name="saida" options={{ headerShown: false }} />
          <Stack.Screen name="novo-registro" options={{ headerShown: false }} />
          <Stack.Screen name="conferencia/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="conferencia/relatar-erro/[id]" options={{ headerShown: false }} />
        </Stack>
      </SafeWrapper>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
