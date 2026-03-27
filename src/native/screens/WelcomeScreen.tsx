import { View, Text, Image, TouchableOpacity, StyleSheet } from "react-native";
import { router } from "expo-router";

export function WelcomeScreen() {
  return (
    <View style={styles.container}>
      {/* Decorative circles */}
      <View style={[styles.circle, { top: -80, left: -80, width: 220, height: 220, backgroundColor: "#a7f3d0" }]} />
      <View style={[styles.circle, { top: -20, left: -20, width: 150, height: 150, backgroundColor: "#6ee7b7" }]} />
      <View style={[styles.circle, { bottom: -80, right: -80, width: 260, height: 260, backgroundColor: "#a7f3d0" }]} />
      <View style={[styles.circle, { bottom: -20, right: -20, width: 180, height: 180, backgroundColor: "#6ee7b7" }]} />

      <View style={styles.content}>
        <Text style={styles.title}>
          bin<Text style={styles.titleBold}>Go</Text>
        </Text>

        <Image
          source={require("../../../assets/earth_illustration.png")}
          style={styles.illustration}
          resizeMode="contain"
        />

        <Text style={styles.tagline}>Manage your waste effectively!</Text>

        <TouchableOpacity style={styles.button} onPress={() => router.push("/register")} activeOpacity={0.85}>
          <Text style={styles.buttonText}>Get Started</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    overflow: "hidden",
  },
  circle: {
    position: "absolute",
    borderRadius: 999,
    opacity: 0.7,
  },
  content: {
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
    zIndex: 1,
  },
  title: {
    fontSize: 52,
    color: "#059669",
    marginBottom: 28,
    fontWeight: "300",
  },
  titleBold: {
    fontWeight: "700",
  },
  illustration: {
    width: 240,
    height: 200,
    marginBottom: 24,
  },
  tagline: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 32,
    textAlign: "center",
  },
  button: {
    backgroundColor: "#10b981",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 14,
    width: "100%",
    maxWidth: 280,
    alignItems: "center",
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
});
