import { Image, StyleSheet, Platform } from "react-native";

import { HelloWave } from "@/components/HelloWave";
import ParallaxScrollView from "@/components/ParallaxScrollView";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";

export default function HomeScreen() {
  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: "#A1CEDC", dark: "#1D3D47" }}
      headerImage={
        <Image
          source={require("@/assets/images/arduino.png")}
          style={styles.reactLogo}
          resizeMode="contain"
        />
      }
    >
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">Welcome!</ThemedText>
        <HelloWave />
      </ThemedView>
      <ThemedView style={styles.sectionContainer}>
        <ThemedText type="subtitle">Alives</ThemedText>
        <ThemedText>alive logs</ThemedText>
      </ThemedView>
      <ThemedView style={styles.sectionContainer}>
        <ThemedText type="subtitle">Alerts</ThemedText>
        <ThemedText>alert logs</ThemedText>
      </ThemedView>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 32,
  },
  sectionContainer: {
    gap: 8,
    marginBottom: 32,
  },
  reactLogo: {
    height: 178,
    width: 290,
  },
});
