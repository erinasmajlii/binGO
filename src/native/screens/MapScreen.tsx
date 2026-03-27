import { useState, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import WebView, { WebViewMessageEvent } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";

interface Pin {
  latitude: number;
  longitude: number;
}

const MAP_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map').setView([3.1390, 101.6869], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);

    var marker = null;
    var greenIcon = L.divIcon({
      className: '',
      html: '<div style="width:28px;height:28px;background:#10b981;border:3px solid #fff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 8px rgba(0,0,0,0.3)"></div>',
      iconSize: [28, 28],
      iconAnchor: [14, 28]
    });

    map.on('click', function(e) {
      var lat = e.latlng.lat;
      var lng = e.latlng.lng;
      if (marker) { map.removeLayer(marker); }
      marker = L.marker([lat, lng], { icon: greenIcon }).addTo(map);
      window.ReactNativeWebView.postMessage(JSON.stringify({ lat: lat, lng: lng }));
    });
  </script>
</body>
</html>
`;

export function MapScreen() {
  const [pin, setPin] = useState<Pin | null>(null);
  const webViewRef = useRef<WebView>(null);

  const handleMessage = (e: WebViewMessageEvent) => {
    try {
      const { lat, lng } = JSON.parse(e.nativeEvent.data);
      setPin({ latitude: lat, longitude: lng });
    } catch {}
  };

  const clearPin = () => {
    setPin(null);
    webViewRef.current?.injectJavaScript(`
      if (marker) { map.removeLayer(marker); marker = null; }
      true;
    `);
  };

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ html: MAP_HTML }}
        style={styles.map}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={["*"]}
      />

      {/* Header overlay */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Map</Text>
        <Text style={styles.headerSub}>Tap anywhere to drop a pin</Text>
      </View>

      {/* Pin info panel */}
      {pin && (
        <View style={styles.infoPanel}>
          <View style={styles.infoPanelLeft}>
            <Ionicons name="location" size={20} color="#10b981" />
            <View>
              <Text style={styles.infoPanelTitle}>Pinned Location</Text>
              <Text style={styles.infoPanelCoords}>
                {pin.latitude.toFixed(5)}, {pin.longitude.toFixed(5)}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={clearPin} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={22} color="#94a3b8" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  header: {
    position: "absolute",
    top: 56,
    left: 16,
    right: 16,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#1e293b" },
  headerSub: { fontSize: 12, color: "#64748b", marginTop: 2 },
  infoPanel: {
    position: "absolute",
    bottom: 32,
    left: 16,
    right: 16,
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
  },
  infoPanelLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  infoPanelTitle: { fontSize: 13, fontWeight: "600", color: "#1e293b" },
  infoPanelCoords: { fontSize: 12, color: "#64748b", marginTop: 2 },
});
