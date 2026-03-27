import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

export function ReportScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Report Trash</Text>
        <Text style={styles.subtitle}>
          Snap a photo of litter to earn EcoXP.
        </Text>

        <TouchableOpacity style={styles.button} activeOpacity={0.85}>
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
});
