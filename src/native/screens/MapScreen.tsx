import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { WebView } from "react-native-webview";
import * as Location from "expo-location";

export function MapScreen() {
  const [location, setLocation] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        try {
          const loc = await Location.getCurrentPositionAsync({});
          setLocation(loc.coords);
        } catch (err) {
          console.log("Location error:", err);
        }
      }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  const lat = location?.latitude || 41.3275;
  const lon = location?.longitude || 19.8187;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body { margin: 0; padding: 0; }
        #map { position: absolute; top: 0; bottom: 0; width: 100%; }
        .info { background: white; padding: 10px; border-radius: 5px; box-shadow: 0 0 15px rgba(0,0,0,0.2); }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        const map = L.map('map').setView([${lat}, ${lon}], 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap',
          maxZoom: 19
        }).addTo(map);
        
        L.circleMarker([${lat}, ${lon}], {
          color: '#10b981',
          fillColor: '#10b981',
          fillOpacity: 0.8,
          radius: 8,
          weight: 3
        }).bindPopup('<b>Your Location</b>').addTo(map).openPopup();
      </script>
    </body>
    </html>
  `;

  return (
    <View style={{ flex: 1 }}>
      <WebView
        source={{ html: htmlContent }}
        style={{ flex: 1 }}
        javaScriptEnabled
        domStorageEnabled
      />
    </View>
  );
}
