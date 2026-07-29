import { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { BinMarker, loadBins } from "../../lib/bins";

export function MapScreen() {
  const [bins, setBins] = useState<BinMarker[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const storedBins = await loadBins();
        setBins(storedBins);
      } catch {
        // fallback
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const openGoogleMaps = () => {
    if (typeof window !== "undefined") {
      window.open("https://maps.google.com", "_blank");
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          bin<Text style={{ fontWeight: "700" }}>Go</Text> Map
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Ionicons name="map-outline" size={48} color="#059669" style={{ alignSelf: "center", marginBottom: 12 }} />
          <Text style={styles.title}>Waste Bins & Recyclers Map</Text>
          <Text style={styles.subtitle}>
            Showing {bins.length} waste drop-off locations nearby.
          </Text>

          <TouchableOpacity style={styles.button} onPress={openGoogleMaps} activeOpacity={0.85}>
            <Ionicons name="navigate" size={18} color="#fff" />
            <Text style={styles.buttonText}>Open Google Maps</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.listSection}>
          <Text style={styles.sectionTitle}>Nearby Locations ({bins.length})</Text>
          {bins.map((bin, index) => (
            <View key={bin.id || index} style={styles.binItem}>
              <Ionicons name="trash-outline" size={20} color="#10b981" />
              <View style={styles.binDetails}>
                <Text style={styles.binName}>Bin #{index + 1}</Text>
                <Text style={styles.binCoords}>
                  {bin.latitude.toFixed(4)}, {bin.longitude.toFixed(4)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#ecfdf5" },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderBottomWidth: 1,
    borderBottomColor: "#d1fae5",
    alignItems: "center",
  },
  headerTitle: { fontSize: 20, color: "#059669" },
  content: { padding: 20 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: "#d1fae5",
    alignItems: "center",
    marginBottom: 20,
  },
  title: { fontSize: 20, fontWeight: "700", color: "#1e293b", marginBottom: 6 },
  subtitle: { fontSize: 14, color: "#64748b", textAlign: "center", marginBottom: 20 },
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#10b981",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  listSection: { backgroundColor: "#fff", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#d1fae5" },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#1e293b", marginBottom: 12 },
  binItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  binDetails: { flex: 1 },
  binName: { fontWeight: "600", color: "#1e293b", fontSize: 14 },
  binCoords: { fontSize: 12, color: "#64748b" },
});
