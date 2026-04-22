import { useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing } from "react-native";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";

type RecycleIconProps = {
  size: number;
  color: string;
  spin: Animated.AnimatedInterpolation<string>;
};

function RecycleIcon({ size, color, spin }: RecycleIconProps) {
  return (
    <Animated.View style={[styles.recycleIcon, { transform: [{ rotate: spin }] }]}>
      <MaterialCommunityIcons name="recycle" size={size} color={color} />
    </Animated.View>
  );
}

function TrashCanHero() {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 2600,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    loop.start();

    return () => {
      loop.stop();
    };
  }, [spin]);

  const ringSpinInterpolate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });
  const reverseRingSpinInterpolate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "-360deg"],
  });
  const iconSpinInterpolate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View style={styles.heroWrap}>
      <View style={styles.binShadow} />

      <View style={styles.binLid}>
        <View style={styles.binLidLip} />
        <View style={styles.binHandle} />
      </View>

      <View style={styles.binBody}>
        <View style={styles.binInnerGlow} />
        <View style={styles.binRib1} />
        <View style={styles.binRib2} />
        <View style={styles.binRib3} />
        <View style={styles.binBase} />

        <View style={styles.binBadge}>
          <Animated.View style={[styles.badgeRingOuter, { transform: [{ rotate: ringSpinInterpolate }] }]} />
          <Animated.View style={[styles.badgeRingInner, { transform: [{ rotate: reverseRingSpinInterpolate }] }]} />

          <View style={styles.coreIconWrap}>
            <RecycleIcon size={66} color="#16a34a" spin={iconSpinInterpolate} />
          </View>
        </View>
      </View>

      <View style={styles.binWheelLeft} />
      <View style={styles.binWheelRight} />

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
    bottom: 8,
    width: 156,
    height: 18,
    borderRadius: 999,
    backgroundColor: "#34d399",
    opacity: 0.23,
  },
  binLid: {
    width: 164,
    height: 30,
    borderRadius: 12,
    backgroundColor: "#ecfdf5",
    borderWidth: 3,
    borderColor: "#a7f3d0",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 3,
    zIndex: 2,
  },
  binLidLip: {
    position: "absolute",
    bottom: -5,
    width: 146,
    height: 8,
    borderRadius: 8,
    backgroundColor: "#34d399",
  },
  binHandle: {
    position: "absolute",
    top: -11,
    width: 54,
    height: 10,
    borderRadius: 7,
    backgroundColor: "#10b981",
  },
  binBody: {
    width: 168,
    height: 176,
    borderBottomLeftRadius: 42,
    borderBottomRightRadius: 42,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: "#34d399",
    borderWidth: 5,
    borderColor: "#d1fae5",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: "#047857",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 7,
  },
  binInnerGlow: {
    position: "absolute",
    top: 10,
    left: 14,
    right: 14,
    height: 54,
    borderRadius: 14,
    backgroundColor: "#6ee7b7",
    opacity: 0.5,
  },
  binRib1: {
    position: "absolute",
    top: 38,
    width: 7,
    height: 122,
    borderRadius: 999,
    backgroundColor: "#10b981",
    opacity: 0.35,
  },
  binRib2: {
    position: "absolute",
    top: 38,
    left: 46,
    width: 6,
    height: 122,
    borderRadius: 999,
    backgroundColor: "#10b981",
    opacity: 0.3,
  },
  binRib3: {
    position: "absolute",
    top: 38,
    right: 46,
    width: 6,
    height: 122,
    borderRadius: 999,
    backgroundColor: "#10b981",
    opacity: 0.3,
  },
  binBase: {
    position: "absolute",
    bottom: 5,
    width: 122,
    height: 12,
    borderRadius: 999,
    backgroundColor: "#bbf7d0",
    opacity: 0.75,
  },
  binBadge: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#ecfdf5",
    borderWidth: 4,
    borderColor: "#a7f3d0",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeRingOuter: {
    position: "absolute",
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 7,
    borderColor: "#22c55e",
    borderTopColor: "#15803d",
    borderRightColor: "#16a34a",
  },
  badgeRingInner: {
    position: "absolute",
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: "#bbf7d0",
    borderTopColor: "#d9fbe6",
  },
  coreIconWrap: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: "#f0fdf4",
    borderWidth: 2,
    borderColor: "#dcfce7",
    alignItems: "center",
    justifyContent: "center",
  },
  recycleIcon: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  binWheelLeft: {
    position: "absolute",
    bottom: 6,
    left: 63,
    width: 16,
    height: 16,
    borderRadius: 999,
    backgroundColor: "#065f46",
    borderWidth: 2,
    borderColor: "#6ee7b7",
  },
  binWheelRight: {
    position: "absolute",
    bottom: 6,
    right: 63,
    width: 16,
    height: 16,
    borderRadius: 999,
    backgroundColor: "#065f46",
    borderWidth: 2,
    borderColor: "#6ee7b7",
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
