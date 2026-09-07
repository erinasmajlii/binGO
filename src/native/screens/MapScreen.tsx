import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  ActivityIndicator,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, {
  LatLng,
  LongPressEvent,
  Marker,
  Polyline,
  Region,
} from "react-native-maps";
import { useFocusEffect } from "expo-router";
import * as Location from "expo-location";
import {
  BinMarker,
  loadBins,
  addBinToDatabase,
  removeBinFromDatabase,
  subscribeToBinsRealtimeUpdates,
  RealtimeConnectionStatus,
} from "../../lib/bins";
import { distanceInMeters, formatDistance } from "../../lib/geo";
import { useAuth } from "../../lib/AuthContext";

import { clearActiveRoute, getActiveRoute } from "../../lib/route";

const initialRegion: Region = {
  latitude: 41.3275,
  longitude: 19.8187,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

export function MapScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [location, setLocation] =
    useState<Location.LocationObjectCoords | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mapInitialRegion, setMapInitialRegion] = useState<Region | null>(null);
  const [bins, setBins] = useState<BinMarker[]>([]);
  const [binsLoaded, setBinsLoaded] = useState(false);
  const [routeCoords, setRouteCoords] = useState<LatLng[]>([]);
  const [routeDistanceMeters, setRouteDistanceMeters] = useState<number | null>(
    null,
  );
  const [routeDestination, setRouteDestination] = useState<BinMarker | null>(
    null,
  );
  const [isRouting, setIsRouting] = useState(false);
  const [isAddingBin, setIsAddingBin] = useState(false);
  const [liveStatus, setLiveStatus] = useState<RealtimeConnectionStatus>("connected");
  const mapRef = useRef<MapView | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const hasMeaningfulMovement = (
    current: Location.LocationObjectCoords | null,
    next: Location.LocationObjectCoords,
  ) => {
    if (!current) return true;
    // Ignore tiny GPS jitter while standing still.
    return distanceInMeters(current.latitude, current.longitude, next.latitude, next.longitude) >= 2;
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
                : currentLocation,
            );
          },
        );
      } catch (err) {
        console.error("Location error:", err);
        setErrorMessage(
          "Could not read your location. Check device settings and GPS.",
        );
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
    let cancelled = false;

    (async () => {
      try {
        // Initial load of bins from Supabase (or local storage fallback)
        const storedBins = await loadBins();
        if (cancelled) return;

        // De-duplicate bins from storage by rounded coordinates
        const seen = new Set<string>();
        const uniqueBins = storedBins.filter((bin) => {
          const key = `${bin.latitude.toFixed(6)}:${bin.longitude.toFixed(6)}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        setBins(uniqueBins);
        setBinsLoaded(true);

        // Set up real-time subscription to listen for changes from other users/devices
        const unsubscribe = subscribeToBinsRealtimeUpdates(
          (updatedBins) => {
            // De-duplicate updated bins
            const seenUpdated = new Set<string>();
            const uniqueUpdated = updatedBins.filter((bin) => {
              const key = `${bin.latitude.toFixed(6)}:${bin.longitude.toFixed(6)}`;
              if (seenUpdated.has(key)) return false;
              seenUpdated.add(key);
              return true;
            });

            setBins(uniqueUpdated);
          },
          (status) => {
            if (!cancelled) setLiveStatus(status);
          },
        );

        if (cancelled) {
          // Component unmounted while the subscription was being set up —
          // tear it straight down instead of leaking it via the ref, since
          // the cleanup below already ran before `unsubscribeRef` was set.
          unsubscribe?.();
          return;
        }

        unsubscribeRef.current = unsubscribe;
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load bins:", err);
          setBinsLoaded(true);
        }
      }
    })();

    // Cleanup: unsubscribe when component unmounts
    return () => {
      cancelled = true;
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, []);

  const lat = location?.latitude ?? initialRegion.latitude;
  const lon = location?.longitude ?? initialRegion.longitude;

  const routeStart = routeCoords.length > 0 ? routeCoords[0] : null;
  const routeEnd =
    routeCoords.length > 0 ? routeCoords[routeCoords.length - 1] : null;

  const startConnectorDistance =
    location && routeStart
      ? distanceInMeters(
          location.latitude,
          location.longitude,
          routeStart.latitude,
          routeStart.longitude,
        )
      : 0;

  const endConnectorDistance =
    routeDestination && routeEnd
      ? distanceInMeters(
          routeEnd.latitude,
          routeEnd.longitude,
          routeDestination.latitude,
          routeDestination.longitude,
        )
      : 0;

  const shouldShowStartConnector = startConnectorDistance > 2;
  const shouldShowEndConnector = endConnectorDistance > 2;

  const displayDistance =
    routeDistanceMeters === null
      ? null
      : routeDistanceMeters +
        (shouldShowStartConnector ? startConnectorDistance : 0) +
        (shouldShowEndConnector ? endConnectorDistance : 0);

  const renderFallbackRoute = useCallback(
    (destination: BinMarker, source: Location.LocationObjectCoords) => {
      const fallbackCoords: LatLng[] = [
        { latitude: source.latitude, longitude: source.longitude },
        { latitude: destination.latitude, longitude: destination.longitude },
      ];

      setRouteCoords(fallbackCoords);
      setRouteDistanceMeters(
        distanceInMeters(
          source.latitude,
          source.longitude,
          destination.latitude,
          destination.longitude,
        ),
      );

      mapRef.current?.fitToCoordinates(fallbackCoords, {
        edgePadding: { top: 80, right: 40, bottom: 180, left: 40 },
        animated: true,
      });
    },
    [],
  );

  const buildRoute = useCallback(
    async (destination: BinMarker) => {
      if (!location) return;

      setIsRouting(true);
      setRouteDestination(destination);

      try {
        const response = await fetch(
          `https://router.project-osrm.org/route/v1/foot/${location.longitude},${location.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=geojson`,
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
        setRouteDistanceMeters(
          typeof route?.distance === "number" ? route.distance : null,
        );
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
    [location, renderFallbackRoute],
  );

  const clearRoute = useCallback(() => {
    setRouteCoords([]);
    setRouteDistanceMeters(null);
    setRouteDestination(null);
    setIsRouting(false);
  }, []);

  const findNearestBin = useCallback(
    (sourceBins: BinMarker[] = bins): BinMarker | null => {
      if (!location || sourceBins.length === 0) return null;

      let nearest: BinMarker | null = null;
      let minDistance = Infinity;

      for (const bin of sourceBins) {
        const distance = distanceInMeters(
          location.latitude,
          location.longitude,
          bin.latitude,
          bin.longitude,
        );
        if (distance < minDistance) {
          minDistance = distance;
          nearest = bin;
        }
      }

      return nearest;
    },
    [location, bins],
  );

  const routeToNearestBin = useCallback(
    (availableBins: BinMarker[]) => {
      const nearest = findNearestBin(availableBins);
      if (nearest) {
        void buildRoute(nearest);
        return;
      }
      clearRoute();
    },
    [findNearestBin, buildRoute, clearRoute],
  );

  // Keeps the active route consistent with the real bins/location state.
  // Gated on `binsLoaded`: right after a scan, MapScreen mounts with `bins`
  // still empty while the real list loads asynchronously from Supabase —
  // without this guard, that momentary empty list looked identical to "the
  // destination bin was deleted" and cleared the just-computed route
  // before it ever had a chance to render.
  useEffect(() => {
    if (!binsLoaded || !routeDestination) return;

    const destinationStillExists = bins.some(
      (bin) => bin.id === routeDestination.id,
    );

    if (!destinationStillExists) {
      // Routed bin disappeared (removed locally or via realtime) — reroute
      // to whatever's next-nearest, or clear if none remain.
      if (bins.length > 0 && location) {
        routeToNearestBin(bins);
      } else {
        clearRoute();
      }
      return;
    }

    // Destination is still valid but no line has been drawn for it yet —
    // happens when location wasn't ready yet the moment this screen first
    // picked up the route request from a scan. Draw it now that it is.
    if (routeCoords.length === 0 && location) {
      void buildRoute(routeDestination);
    }
  }, [binsLoaded, bins, routeDestination, location, routeCoords.length, routeToNearestBin, clearRoute, buildRoute]);

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
    }, [buildRoute, location]),
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
        500,
      );
    }
  };

  const makeBinId = () => `bin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const addBinAtCurrentLocation = async () => {
    if (isAddingBin) return;

    if (!user) {
      setErrorMessage("Sign in to add bins to the shared map.");
      return;
    }

    if (!location) {
      setErrorMessage("Current location is not available yet.");
      return;
    }

    const existsNearby = bins.some(
      (bin) =>
        distanceInMeters(
          bin.latitude,
          bin.longitude,
          location.latitude,
          location.longitude,
        ) < 3,
    );
    if (existsNearby) {
      setErrorMessage("A bin already exists at this location.");
      return;
    }

    const newBin: BinMarker = {
      id: makeBinId(),
      latitude: location.latitude,
      longitude: location.longitude,
      source: "current",
    };

    setIsAddingBin(true);
    try {
      const saved = await addBinToDatabase(newBin);
      if (saved) {
        setBins((prev) => [...prev, newBin]);
        setErrorMessage(null);
      } else {
        setErrorMessage("Could not add this bin. Check your connection and try again.");
      }
    } finally {
      setIsAddingBin(false);
    }
  };

  const addBinManually = async (event: LongPressEvent) => {
    if (isAddingBin) return;

    if (!user) {
      setErrorMessage("Sign in to add bins to the shared map.");
      return;
    }

    const { latitude, longitude } = event.nativeEvent.coordinate;

    const existsNearby = bins.some(
      (bin) =>
        distanceInMeters(bin.latitude, bin.longitude, latitude, longitude) < 3,
    );
    if (existsNearby) {
      setErrorMessage("A bin already exists at this location.");
      return;
    }

    const newBin: BinMarker = {
      id: makeBinId(),
      latitude,
      longitude,
      source: "manual",
    };

    setIsAddingBin(true);
    try {
      const saved = await addBinToDatabase(newBin);
      if (saved) {
        setBins((prev) => [...prev, newBin]);
        setErrorMessage(null);
      } else {
        setErrorMessage("Could not add this bin. Check your connection and try again.");
      }
    } finally {
      setIsAddingBin(false);
    }
  };

  const removeBin = (id: string) => {
    if (!user) {
      setErrorMessage("Sign in to remove bins from the shared map.");
      return;
    }

    Alert.alert("Remove bin", "Do you want to remove this bin marker?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          const removed = await removeBinFromDatabase(id);
          if (!removed) {
            setErrorMessage("Could not remove this bin. Check your connection and try again.");
            return;
          }

          const nextBins = bins.filter((bin) => bin.id !== id);
          const removedRoutedBin =
            routeDestination?.id === id ||
            (routeDestination !== null &&
              !nextBins.some((bin) => bin.id === routeDestination.id));

          setBins(nextBins);
          setErrorMessage(null);

          if (removedRoutedBin) {
            if (nextBins.length > 0 && location) {
              routeToNearestBin(nextBins);
            } else {
              clearRoute();
            }
          }
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
      <View style={[styles.header, { paddingTop: Math.max(12, insets.top) }]}>
        <Text style={styles.title}>Map</Text>
        <Text style={styles.subtitle}>
          {permissionDenied
            ? "Location access is off. Enable it to show your current position."
            : errorMessage || "Showing your live position on the map."}
        </Text>
        {liveStatus === "reconnecting" ? (
          <Text style={styles.liveStatusText}>Reconnecting live map updates…</Text>
        ) : null}
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
              {
                latitude: routeDestination.latitude,
                longitude: routeDestination.longitude,
              },
            ]}
            strokeColor="#0284c7"
            strokeWidth={4}
            lineDashPattern={[8, 8]}
          />
        ) : null}
      </MapView>

      <View style={styles.footer}>
        <Text style={styles.helperText}>
          Long press map to place manually. Tap a bin to remove it.
        </Text>
        {routeDestination ? (
          <View style={styles.routeCard}>
            <Text style={styles.routeTitle}>Nearest Bin Route</Text>
            <Text style={styles.routeValue}>
              {isRouting
                ? "Calculating route..."
                : `Distance: ${formatDistance(displayDistance)}`}
            </Text>
          </View>
        ) : null}
        <TouchableOpacity
          style={[styles.button, styles.spacing, isAddingBin && styles.buttonDisabled]}
          onPress={addBinAtCurrentLocation}
          activeOpacity={0.85}
          disabled={isAddingBin}
        >
          <Text style={styles.buttonText}>{isAddingBin ? "Adding..." : "Add Bin At My Location"}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.spacing, isRouting && styles.buttonDisabled]}
          onPress={() => {
            if (isRouting) return;
            const nearestBin = findNearestBin();
            if (nearestBin) {
              void buildRoute(nearestBin);
              setErrorMessage(null);
            } else {
              setErrorMessage(
                "No bins found on the map. Add one to start routing.",
              );
              clearRoute();
            }
          }}
          activeOpacity={0.85}
          disabled={isRouting}
        >
          <Text style={styles.buttonText}>Refresh Route</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.button}
          onPress={recenterMap}
          activeOpacity={0.85}
        >
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
  liveStatusText: { marginTop: 4, fontSize: 12, color: "#b45309", fontWeight: "600" },
  map: { flex: 1 },
  footer: { padding: 16, backgroundColor: "#ecfdf5" },
  helperText: { marginBottom: 10, color: "#475569", fontSize: 12 },
  spacing: { marginBottom: 10 },
  button: {
    backgroundColor: "#10b981",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  buttonDisabled: { opacity: 0.6 },
  routeCard: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#bae6fd",
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
  },
  routeTitle: { color: "#0f172a", fontSize: 12, fontWeight: "700" },
  routeValue: {
    color: "#0369a1",
    marginTop: 2,
    fontSize: 13,
    fontWeight: "600",
  },
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
