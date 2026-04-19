import { useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing } from "react-native";
import { router } from "expo-router";

function TrashCanHero() {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 4600,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    loop.start();
    return () => loop.stop();
  }, [spin]);

  const spinInterpolate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View style={styles.heroWrap}>
      <View style={styles.binShadow} />

      <View style={styles.binLid}>
        <View style={styles.binHandle} />
      </View>

      <View style={styles.binBody}>
        <View style={styles.binInnerGlow} />

        <View style={styles.binBadge}>
          <Animated.View style={[styles.starOrbit, { transform: [{ rotate: spinInterpolate }] }]}>
            <Text style={[styles.orbitStar, styles.orbitStarTop]}>✦</Text>
            <Text style={[styles.orbitStar, styles.orbitStarRight]}>•</Text>
            <Text style={[styles.orbitStar, styles.orbitStarBottom]}>✦</Text>
            <Text style={[styles.orbitStar, styles.orbitStarLeft]}>•</Text>
          </Animated.View>

          <View style={styles.coreStarWrap}>
            <Text style={styles.coreStar}>★</Text>
          </View>
        </View>
      </View>

      <View style={[styles.sparkle, styles.sparkleLeft]} />
      <View style={[styles.sparkle, styles.sparkleMid]} />
      <View style={[styles.sparkle, styles.sparkleRight]} />
    </View>
  );
}

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

        <TrashCanHero />

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
    marginBottom: 24,
    fontWeight: "300",
  },
  titleBold: {
    fontWeight: "700",
  },
  heroWrap: {
    width: 240,
    height: 240,
    marginBottom: 28,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  binShadow: {
    position: "absolute",
    bottom: 16,
    width: 132,
    height: 22,
    borderRadius: 999,
    backgroundColor: "#7dd3af",
    opacity: 0.35,
  },
  binLid: {
    width: 150,
    height: 34,
    borderRadius: 14,
    backgroundColor: "#f8fffc",
    borderWidth: 5,
    borderColor: "#e4fff3",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
    zIndex: 2,
  },
  binHandle: {
    position: "absolute",
    top: -16,
    width: 54,
    height: 20,
    borderRadius: 12,
    borderWidth: 5,
    borderColor: "#f8fffc",
    backgroundColor: "#8fd9bd",
  },
  binBody: {
    width: 186,
    height: 172,
    borderBottomLeftRadius: 90,
    borderBottomRightRadius: 90,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    backgroundColor: "#98dfc4",
    borderWidth: 8,
    borderColor: "#f7fffb",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: "#0f766e",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 8,
  },
  binInnerGlow: {
    position: "absolute",
    top: 20,
    left: 22,
    right: 22,
    height: 64,
    borderRadius: 999,
    backgroundColor: "#b7ecd6",
    opacity: 0.65,
  },
  binBadge: {
    width: 116,
    height: 116,
    borderRadius: 58,
    backgroundColor: "#84d8b7",
    borderWidth: 6,
    borderColor: "#e9fff5",
    alignItems: "center",
    justifyContent: "center",
  },
  starOrbit: {
    position: "absolute",
    width: 108,
    height: 108,
  },
  orbitStar: {
    position: "absolute",
    color: "#eafff6",
    fontWeight: "800",
  },
  orbitStarTop: {
    top: 2,
    left: 50,
    fontSize: 16,
  },
  orbitStarRight: {
    top: 46,
    right: 2,
    fontSize: 18,
  },
  orbitStarBottom: {
    bottom: 2,
    left: 50,
    fontSize: 16,
  },
  orbitStarLeft: {
    top: 46,
    left: 2,
    fontSize: 18,
  },
  coreStarWrap: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#edfff7",
    borderWidth: 4,
    borderColor: "#d2f7e8",
    alignItems: "center",
    justifyContent: "center",
  },
  coreStar: {
    color: "#55b58d",
    fontSize: 30,
    marginTop: -1,
  },
  sparkle: {
    position: "absolute",
    backgroundColor: "#effff8",
    borderRadius: 999,
    opacity: 0.95,
  },
  sparkleLeft: {
    width: 10,
    height: 10,
    left: 30,
    top: 142,
  },
  sparkleMid: {
    width: 12,
    height: 12,
    left: 22,
    top: 164,
  },
  sparkleRight: {
    width: 9,
    height: 9,
    left: 36,
    top: 188,
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
