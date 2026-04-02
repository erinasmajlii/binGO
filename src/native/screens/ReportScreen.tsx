import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useState, useRef } from "react";

export function ReportScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [showCamera, setShowCamera] = useState(false);
  const cameraRef = useRef(null);

  const handleOpenCamera = async () => {
    const { granted } = await requestPermission();
    if (!granted) {
      Alert.alert("Permission denied", "Camera permission is required to take photos.");
      return;
    }
    setShowCamera(true);
  };

  const takePhoto = async () => {
    if (cameraRef.current) {
      const photo = await cameraRef.current.takePictureAsync();
      Alert.alert("Photo taken", `Photo saved at ${photo.uri}`);
      setShowCamera(false);
      // Here you can upload the photo or process it
    }
  };

  if (showCamera) {
    return (
      <View style={styles.cameraContainer}>
        <CameraView 
          style={styles.camera} 
          ref={cameraRef} 
          facing="back"
        />
        <View style={styles.cameraControls}>
          <TouchableOpacity style={styles.captureButton} onPress={takePhoto}>
            <Ionicons name="camera" size={30} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.closeButton} onPress={() => setShowCamera(false)}>
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
