import { useCallback, useEffect, useRef, useState } from "react";
import { View, ActivityIndicator, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import MapView, { LatLng, MapPressEvent, Marker, Polyline, Region } from "react-native-maps";
import { useFocusEffect } from "@react-navigation/native";
import * as Location from "expo-location";
import { BinMarker, loadBins, saveBins } from "../../lib/bins";
import { clearActiveRoute, getActiveRoute } from "../../lib/route";

export function MapScreen() {
  const [location, setLocation] = useState<Location.LocationObjectCoords | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mapInitialRegion, setMapInitialRegion] = useState<Region | null>(null);
  const [bins, setBins] = useState<BinMarker[]>([]);
  const [binsLoaded, setBinsLoaded] = useState(false);
  const [routeCoords, setRouteCoords] = useState<LatLng[]>([]);
  const [routeDistanceMeters, setRouteDistanceMeters] = useState<number | null>(null);
  const [routeDestination, setRouteDestination] = useState<BinMarker | null>(null);
  const [isRouting, setIsRouting] = useState(false);
  const mapRef = useRef<MapView | null>(null);

  const hasMeaningfulMovement = (
    current: Location.LocationObjectCoords | null,
    next: Location.LocationObjectCoords
  ) => {
    if (!current) return true;

    const earthRadius = 6371000;
    const toRadians = (value: number) => (value * Math.PI) / 180;
    const dLat = toRadians(next.latitude - current.latitude);
    const dLon = toRadians(next.longitude - current.longitude);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRadians(current.latitude)) *
        Math.cos(toRadians(next.latitude)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const distance = earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    // Ignore tiny GPS jitter while standing still.
    return distance >= 2;
  };

  const initialRegion: Region = {
    latitude: 41.3275,
    longitude: 19.8187,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setPermissionDenied(true);
          setMapInitialRegion(initialRegion);
          return;
        }

        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setLocation(current.coords);
        setMapInitialRegion({
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });

        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 4000,
            distanceInterval: 5,
          },
          (nextLocation) => {
            setLocation((currentLocation) =>
              hasMeaningfulMovement(currentLocation, nextLocation.coords)
                ? nextLocation.coords
                : currentLocation
            );
          }
        );
      } catch (err) {
        console.log("Location error:", err);
        setErrorMessage("Could not read your location. Check device settings and GPS.");
        setMapInitialRegion(initialRegion);
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      subscription?.remove();
    };
  }, []);

  useEffect(() => {
    (async () => {
      const storedBins = await loadBins();

      // De-duplicate bins from storage by rounded coordinates.
      const seen = new Set<string>();
      const uniqueBins = storedBins.filter((bin) => {
        const key = `${bin.latitude.toFixed(6)}:${bin.longitude.toFixed(6)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      setBins(uniqueBins);
      setBinsLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!binsLoaded) return;
    void saveBins(bins);
  }, [bins, binsLoaded]);

  const lat = location?.latitude ?? initialRegion.latitude;
  const lon = location?.longitude ?? initialRegion.longitude;

  const toRadians = (value: number) => (value * Math.PI) / 180;

  const distanceInMeters = (fromLat: number, fromLon: number, toLat: number, toLon: number) => {
    const earthRadius = 6371000;
    const dLat = toRadians(toLat - fromLat);
    const dLon = toRadians(toLon - fromLon);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRadians(fromLat)) * Math.cos(toRadians(toLat)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

    return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const formatDistance = (meters: number | null) => {
    if (meters === null) return "";
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(2)} km`;
  };

  const routeStart = routeCoords.length > 0 ? routeCoords[0] : null;
  const routeEnd = routeCoords.length > 0 ? routeCoords[routeCoords.length - 1] : null;

  const startConnectorDistance =
    location && routeStart
      ? distanceInMeters(location.latitude, location.longitude, routeStart.latitude, routeStart.longitude)
      : 0;

  const endConnectorDistance =
    routeDestination && routeEnd
      ? distanceInMeters(routeEnd.latitude, routeEnd.longitude, routeDestination.latitude, routeDestination.longitude)
      : 0;

  const shouldShowStartConnector = startConnectorDistance > 2;
  const shouldShowEndConnector = endConnectorDistance > 2;

  const displayDistance =
    routeDistanceMeters === null
      ? null
      : routeDistanceMeters +
        (shouldShowStartConnector ? startConnectorDistance : 0) +
        (shouldShowEndConnector ? endConnectorDistance : 0);

  const renderFallbackRoute = useCallback((destination: BinMarker, source: Location.LocationObjectCoords) => {
    const fallbackCoords: LatLng[] = [
      { latitude: source.latitude, longitude: source.longitude },
      { latitude: destination.latitude, longitude: destination.longitude },
    ];

    setRouteCoords(fallbackCoords);
    setRouteDistanceMeters(
      distanceInMeters(source.latitude, source.longitude, destination.latitude, destination.longitude)
    );

    mapRef.current?.fitToCoordinates(fallbackCoords, {
      edgePadding: { top: 80, right: 40, bottom: 180, left: 40 },
      animated: true,
    });
  }, []);

  const buildRoute = useCallback(
    async (destination: BinMarker) => {
      if (!location) return;

      setIsRouting(true);
      setRouteDestination(destination);

      try {
        const response = await fetch(
          `https://router.project-osrm.org/route/v1/foot/${location.longitude},${location.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=geojson`
        );

        if (!response.ok) {
          renderFallbackRoute(destination, location);
          return;
        }

        const data = await response.json();
        const route = data?.routes?.[0];
        const geometry = route?.geometry?.coordinates;

        if (!Array.isArray(geometry) || geometry.length < 2) {
          renderFallbackRoute(destination, location);
          return;
        }

        const coords: LatLng[] = geometry.map((point: [number, number]) => ({
          latitude: point[1],
          longitude: point[0],
        }));

        setRouteCoords(coords);
        setRouteDistanceMeters(typeof route?.distance === "number" ? route.distance : null);
        mapRef.current?.fitToCoordinates(coords, {
          edgePadding: { top: 80, right: 40, bottom: 180, left: 40 },
          animated: true,
        });
      } catch {
        renderFallbackRoute(destination, location);
      } finally {
        setIsRouting(false);
      }
    },
    [location, renderFallbackRoute]
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;

      (async () => {
        const routeRequest = await getActiveRoute();
        if (!active || !routeRequest?.destination) return;

        setRouteDestination(routeRequest.destination);
        await clearActiveRoute();

        if (location) {
          await buildRoute(routeRequest.destination);
        }
      })();

      return () => {
        active = false;
      };
    }, [buildRoute, location])
  );

  const recenterMap = () => {
    if (location) {
      mapRef.current?.animateToRegion(
        {
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        500
      );
    }
  };

  const addBinAtCurrentLocation = () => {
    if (!location) {
      setErrorMessage("Current location is not available yet.");
      return;
    }

    const existsNearby = bins.some(
      (bin) => distanceInMeters(bin.latitude, bin.longitude, location.latitude, location.longitude) < 3
    );
    if (existsNearby) {
      setErrorMessage("A bin already exists at this location.");
      return;
    }

    const newBin: BinMarker = {
      id: `bin-${Date.now()}`,
      latitude: location.latitude,
      longitude: location.longitude,
      source: "current",
    };

    setBins((prev) => [...prev, newBin]);
    setErrorMessage(null);
  };

  const addBinManually = (event: MapPressEvent) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;

    const existsNearby = bins.some(
      (bin) => distanceInMeters(bin.latitude, bin.longitude, latitude, longitude) < 3
    );
    if (existsNearby) {
      setErrorMessage("A bin already exists at this location.");
      return;
    }

    const newBin: BinMarker = {
      id: `bin-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      latitude,
      longitude,
      source: "manual",
    };

    setBins((prev) => [...prev, newBin]);
    setErrorMessage(null);
  };

  const removeBin = (id: string) => {
    Alert.alert("Remove bin", "Do you want to remove this bin marker?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          setBins((prev) => prev.filter((bin) => bin.id !== id));
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Map</Text>
        <Text style={styles.subtitle}>
          {permissionDenied
            ? "Location access is off. Enable it to show your current position."
            : errorMessage || "Showing your live position on the map."}
        </Text>
      </View>

      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={mapInitialRegion ?? initialRegion}
        onLongPress={addBinManually}
        showsUserLocation
        showsMyLocationButton
      >
        {location ? (
          <Marker
            coordinate={{ latitude: lat, longitude: lon }}
            title="Your Location"
            description="This is your current position"
          />
        ) : null}

        {bins.map((bin) => (
          <Marker
            key={bin.id}
            coordinate={{ latitude: bin.latitude, longitude: bin.longitude }}
            title="Bin"
            onPress={() => removeBin(bin.id)}
            description={
              bin.source === "current"
                ? "Placed at your current location"
                : "Placed manually"
            }
          >
            <View style={styles.binMarker}>
              <Text style={styles.binEmoji}>🗑️</Text>
            </View>
          </Marker>
        ))}

        {routeCoords.length > 1 ? (
          <Polyline
            coordinates={routeCoords}
            strokeColor="#0ea5e9"
            strokeWidth={5}
            lineDashPattern={[1]}
          />
        ) : null}

        {location && routeStart && shouldShowStartConnector ? (
          <Polyline
            coordinates={[
              { latitude: location.latitude, longitude: location.longitude },
              routeStart,
            ]}
            strokeColor="#0284c7"
            strokeWidth={4}
            lineDashPattern={[8, 8]}
          />
        ) : null}

        {routeDestination && routeEnd && shouldShowEndConnector ? (
          <Polyline
            coordinates={[
              routeEnd,
              { latitude: routeDestination.latitude, longitude: routeDestination.longitude },
            ]}
            strokeColor="#0284c7"
            strokeWidth={4}
            lineDashPattern={[8, 8]}
          />
        ) : null}
      </MapView>

      <View style={styles.footer}>
        <Text style={styles.helperText}>Long press map to place manually. Tap a bin to remove it.</Text>
        {routeDestination ? (
          <View style={styles.routeCard}>
            <Text style={styles.routeTitle}>Nearest Bin Route</Text>
            <Text style={styles.routeValue}>
              {isRouting ? "Calculating route..." : `Distance: ${formatDistance(displayDistance)}`}
            </Text>
          </View>
        ) : null}
        <TouchableOpacity style={[styles.button, styles.spacing]} onPress={addBinAtCurrentLocation} activeOpacity={0.85}>
          <Text style={styles.buttonText}>Add Bin At My Location</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.spacing]}
          onPress={() => {
            if (routeDestination) {
              void buildRoute(routeDestination);
            }
          }}
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>Refresh Route</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={recenterMap} activeOpacity={0.85}>
          <Text style={styles.buttonText}>Recenter on me</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#ecfdf5" },
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 28, fontWeight: "700", color: "#1e293b" },
  subtitle: { marginTop: 6, fontSize: 13, color: "#475569" },
  map: { flex: 1 },
  footer: { padding: 16, backgroundColor: "#ecfdf5" },
  helperText: { marginBottom: 10, color: "#475569", fontSize: 12 },
  spacing: { marginBottom: 10 },
  button: { backgroundColor: "#10b981", paddingVertical: 14, borderRadius: 14, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  routeCard: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#bae6fd",
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
  },
  routeTitle: { color: "#0f172a", fontSize: 12, fontWeight: "700" },
  routeValue: { color: "#0369a1", marginTop: 2, fontSize: 13, fontWeight: "600" },
  binMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    borderWidth: 2,
    borderColor: "#10b981",
    alignItems: "center",
    justifyContent: "center",
  },
  binEmoji: {
    fontSize: 16,
  },
});
