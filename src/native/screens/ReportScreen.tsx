import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useState, useRef } from "react";
import { router } from "expo-router";
import * as Location from "expo-location";
import { BinMarker, loadBins } from "../../lib/bins";
import { setActiveRoute } from "../../lib/route";
import { CATEGORY_LABELS, saveCaptureRecord } from "../../lib/trashStats";
import { classifyTrashPhotoWithModel } from "../../lib/trashClassifierApi";

export function ReportScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [showCamera, setShowCamera] = useState(false);
  const [capturedPhotoUri, setCapturedPhotoUri] = useState<string | null>(null);
  const [captureLabel, setCaptureLabel] = useState<string | null>(null);
  const cameraRef = useRef<CameraView | null>(null);

  const toRadians = (value: number) => (value * Math.PI) / 180;

  const distanceInMeters = (
    fromLat: number,
    fromLon: number,
    toLat: number,
    toLon: number
  ) => {
    const earthRadius = 6371000;
    const dLat = toRadians(toLat - fromLat);
    const dLon = toRadians(toLon - fromLon);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRadians(fromLat)) * Math.cos(toRadians(toLat)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

    return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const getNearestBin = (bins: BinMarker[], latitude: number, longitude: number) => {
    if (bins.length === 0) return null;

    let nearest: BinMarker | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const bin of bins) {
      const distance = distanceInMeters(latitude, longitude, bin.latitude, bin.longitude);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = bin;
      }
    }

    return nearest;
  };

  const handleOpenCamera = async () => {
    const { granted } = await requestPermission();
    if (!granted) {
      Alert.alert("Permission denied", "Camera permission is required to take photos.");
      return;
    }
    setCapturedPhotoUri(null);
    setCaptureLabel(null);
    setShowCamera(true);
  };

  const takePhoto = async () => {
    if (cameraRef.current) {
      const photo = await cameraRef.current.takePictureAsync();
      setCapturedPhotoUri(photo.uri);
      setCaptureLabel("Analyzing...");

      let classified;
      try {
        classified = await classifyTrashPhotoWithModel(photo.uri);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        Alert.alert(
          "AI classifier unavailable",
          `Could not classify this image using the model API. ${message}`
        );
        setCapturedPhotoUri(null);
        setCaptureLabel(null);
        return;
      }

      await saveCaptureRecord(photo.uri, classified.category, classified.confidence);

      const detectionText = `${CATEGORY_LABELS[classified.category]} (${Math.round(classified.confidence * 100)}%)`;
      setCaptureLabel(detectionText);
      let statusText = `Detected ${detectionText}. Opening map...`;

      let bins = await loadBins();

      if (bins.length === 0) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        bins = await loadBins();
      }

      try {
        if (bins.length === 0) {
          statusText = `Detected ${detectionText}. No bins saved yet, but opening map.`;
        } else {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== "granted") {
            statusText = `Detected ${detectionText}. Enable location for nearest-bin routing.`;
          } else {
            const current = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });

            const nearest = getNearestBin(bins, current.coords.latitude, current.coords.longitude);
            if (nearest) {
              await setActiveRoute({
                destination: nearest,
                createdAt: Date.now(),
              });
              statusText = `Detected ${detectionText}. Route to nearest bin is ready.`;
            }
          }
        }
      } catch {
        statusText = `Detected ${detectionText}. Saved report, opening map.`;
      }

      setTimeout(() => {
        setCapturedPhotoUri(null);
        setCaptureLabel(null);
        setShowCamera(false);
        router.push("/(tabs)/map");
      }, 1300);
    }
  };

  if (showCamera) {
    return (
      <View style={styles.cameraContainer}>
        {capturedPhotoUri ? (
          <Image source={{ uri: capturedPhotoUri }} style={styles.camera} />
        ) : (
          <CameraView 
            style={styles.camera} 
            ref={cameraRef} 
            facing="back"
          />
        )}

        {captureLabel ? (
          <View style={styles.overlayBadge}>
            <Ionicons name="sparkles" size={16} color="#ecfeff" />
            <Text style={styles.overlayBadgeText}>{captureLabel}</Text>
          </View>
        ) : null}

        <View style={styles.cameraControls}>
          <TouchableOpacity style={[styles.captureButton, capturedPhotoUri ? styles.captureButtonDisabled : null]} onPress={takePhoto} disabled={Boolean(capturedPhotoUri)}>
            <Ionicons name="camera" size={30} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.closeButton} onPress={() => {
            setCapturedPhotoUri(null);
            setCaptureLabel(null);
            setShowCamera(false);
          }}>
            <Ionicons name="close" size={30} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Report Trash</Text>
        <Text style={styles.subtitle}>
          Snap a photo of litter to earn EcoXP.
        </Text>

        <TouchableOpacity style={styles.button} activeOpacity={0.85} onPress={handleOpenCamera}>
          <Ionicons name="camera" size={20} color="#fff" />
          <Text style={styles.buttonText}>Open Camera</Text>
        </TouchableOpacity>

        <View style={styles.tipsCard}>
          <View style={styles.tipsHeader}>
            <Ionicons name="checkmark-circle" size={20} color="#10b981" />
            <Text style={styles.tipsTitle}>Tips for better reports</Text>
          </View>

          {[
            "Make sure the trash is clearly visible",
            "Include a bit of the surrounding context",
            "Avoid motion blur",
          ].map((tip, i) => (
            <View key={i} style={styles.tipRow}>
              <View style={styles.dot} />
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#ecfdf5" },
  content: { padding: 24, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: "700", color: "#1e293b", marginBottom: 8 },
  subtitle: { color: "#475569", fontSize: 14, lineHeight: 20, marginBottom: 24 },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#10b981",
    paddingVertical: 16,
    borderRadius: 16,
    marginBottom: 24,
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  tipsCard: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d1fae5",
    borderRadius: 16,
    padding: 20,
  },
  tipsHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  tipsTitle: { fontSize: 16, fontWeight: "700", color: "#1e293b" },
  tipRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 12 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#34d399", marginTop: 5 },
  tipText: { color: "#475569", fontSize: 14, flex: 1, lineHeight: 20 },
  cameraContainer: { flex: 1, position: "relative" },
  camera: { flex: 1 },
  overlayBadge: {
    position: "absolute",
    top: 58,
    left: 16,
    right: 16,
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 14,
    backgroundColor: "rgba(6,95,70,0.88)",
    borderWidth: 1,
    borderColor: "#6ee7b7",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  overlayBadgeText: {
    color: "#ecfeff",
    fontWeight: "700",
    fontSize: 14,
  },
  cameraControls: {
    position: "absolute",
    bottom: 50,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#10b981",
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 20,
  },
  captureButtonDisabled: {
    opacity: 0.65,
  },
  closeButton: {
    position: "absolute",
    top: 50,
    right: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
});
