import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  ActivityIndicator,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import * as Location from "expo-location";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import {
  BinMarker,
  BinReport,
  BinStatus,
  loadBins,
  addBinToDatabase,
  removeBinFromDatabase,
  reportBinStatus,
  fetchBinReports,
  subscribeToBinsRealtimeUpdates,
  RealtimeConnectionStatus,
} from "../../lib/bins";
import { distanceInMeters, formatDistance } from "../../lib/geo";
import { useAuth } from "../../lib/AuthContext";
import { useI18n } from "../../lib/i18n/I18nContext";
import { clearActiveRoute, getActiveRoute } from "../../lib/route";

type LatLon = { latitude: number; longitude: number };

const initialCenter: LatLon = {
  latitude: 41.3275,
  longitude: 19.8187,
};
const DEFAULT_ZOOM = 15;

function binDivIcon(status: BinStatus | null): L.DivIcon {
  const border = status === "full" ? "#f59e0b" : status === "damaged" ? "#dc2626" : "#10b981";
  const bg = status === "full" ? "#fffbeb" : status === "damaged" ? "#fef2f2" : "#ffffff";
  const emoji = status === "damaged" ? "⚠️" : "🗑️";
  return L.divIcon({
    className: "bingo-bin-marker",
    html: `<div style="width:32px;height:32px;border-radius:16px;background:${bg};border:2px solid ${border};display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 1px 4px rgba(0,0,0,0.25);">${emoji}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

const userLocationIcon = L.divIcon({
  className: "bingo-user-marker",
  html: `<div style="width:16px;height:16px;border-radius:8px;background:#2563eb;border:3px solid #fff;box-shadow:0 0 0 2px #2563eb, 0 1px 4px rgba(0,0,0,0.35);"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export function MapScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const { user } = useAuth();
  const [location, setLocation] = useState<LatLon | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [bins, setBins] = useState<BinMarker[]>([]);
  const [binsLoaded, setBinsLoaded] = useState(false);
  const [routeCoords, setRouteCoords] = useState<LatLon[]>([]);
  const [routeDistanceMeters, setRouteDistanceMeters] = useState<number | null>(null);
  const [routeDestination, setRouteDestination] = useState<BinMarker | null>(null);
  const [isRouting, setIsRouting] = useState(false);
  const [isAddingBin, setIsAddingBin] = useState(false);
  const [liveStatus, setLiveStatus] = useState<RealtimeConnectionStatus>("connected");
  const [selectedBin, setSelectedBin] = useState<BinMarker | null>(null);
  const [binReports, setBinReports] = useState<BinReport[]>([]);
  const [loadingBinReports, setLoadingBinReports] = useState(false);
  const [submittingReport, setSubmittingReport] = useState(false);
  const mapRef = useRef<L.Map | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const hasMeaningfulMovement = (current: LatLon | null, next: LatLon) => {
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
          return;
        }

        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setLocation({ latitude: current.coords.latitude, longitude: current.coords.longitude });

        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 4000,
            distanceInterval: 5,
          },
          (nextLocation) => {
            const next = { latitude: nextLocation.coords.latitude, longitude: nextLocation.coords.longitude };
            setLocation((currentLocation) => (hasMeaningfulMovement(currentLocation, next) ? next : currentLocation));
          },
        );
      } catch (err) {
        console.error("Location error:", err);
        setErrorMessage(t("map.couldNotReadLocation"));
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      subscription?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-once: must not re-request location permission / re-subscribe on language change
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const storedBins = await loadBins();
        if (cancelled) return;

        const seen = new Set<string>();
        const uniqueBins = storedBins.filter((bin) => {
          const key = `${bin.latitude.toFixed(6)}:${bin.longitude.toFixed(6)}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        setBins(uniqueBins);
        setBinsLoaded(true);

        const unsubscribe = subscribeToBinsRealtimeUpdates(
          (updatedBins) => {
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

    return () => {
      cancelled = true;
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, []);

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

  const renderFallbackRoute = useCallback((destination: BinMarker, source: LatLon) => {
    const fallbackCoords: LatLon[] = [
      { latitude: source.latitude, longitude: source.longitude },
      { latitude: destination.latitude, longitude: destination.longitude },
    ];

    setRouteCoords(fallbackCoords);
    setRouteDistanceMeters(
      distanceInMeters(source.latitude, source.longitude, destination.latitude, destination.longitude),
    );

    mapRef.current?.fitBounds(
      L.latLngBounds(fallbackCoords.map((c) => [c.latitude, c.longitude] as [number, number])),
      { padding: [60, 60] },
    );
  }, []);

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

        const coords: LatLon[] = geometry.map((point: [number, number]) => ({
          latitude: point[1],
          longitude: point[0],
        }));

        setRouteCoords(coords);
        setRouteDistanceMeters(typeof route?.distance === "number" ? route.distance : null);
        mapRef.current?.fitBounds(
          L.latLngBounds(coords.map((c) => [c.latitude, c.longitude] as [number, number])),
          { padding: [60, 60] },
        );
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
        const distance = distanceInMeters(location.latitude, location.longitude, bin.latitude, bin.longitude);
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

  // Keeps the active route consistent with the real bins/location state —
  // same logic as the native map screen (see MapScreen.tsx for the full
  // rationale on the binsLoaded gate).
  useEffect(() => {
    if (!binsLoaded || !routeDestination) return;

    const destinationStillExists = bins.some((bin) => bin.id === routeDestination.id);

    if (!destinationStillExists) {
      if (bins.length > 0 && location) {
        routeToNearestBin(bins);
      } else {
        clearRoute();
      }
      return;
    }

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
      mapRef.current?.flyTo([location.latitude, location.longitude], DEFAULT_ZOOM, { duration: 0.5 });
    }
  };

  const makeBinId = () => `bin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const addBinAtCurrentLocation = async () => {
    if (isAddingBin) return;

    if (!user) {
      setErrorMessage(t("map.signInToAddBins"));
      return;
    }

    if (!location) {
      setErrorMessage(t("map.locationNotAvailable"));
      return;
    }

    const existsNearby = bins.some(
      (bin) => distanceInMeters(bin.latitude, bin.longitude, location.latitude, location.longitude) < 3,
    );
    if (existsNearby) {
      setErrorMessage(t("map.binAlreadyExists"));
      return;
    }

    const newBin: BinMarker = {
      id: makeBinId(),
      latitude: location.latitude,
      longitude: location.longitude,
      source: "current",
      currentStatus: null,
      statusUpdatedAt: null,
    };

    setIsAddingBin(true);
    try {
      const saved = await addBinToDatabase(newBin);
      if (saved) {
        setBins((prev) => [...prev, saved]);
        setErrorMessage(null);
      } else {
        setErrorMessage(t("map.couldNotAddBin"));
      }
    } finally {
      setIsAddingBin(false);
    }
  };

  const addBinManually = async (latitude: number, longitude: number) => {
    if (isAddingBin) return;

    if (!user) {
      setErrorMessage(t("map.signInToAddBins"));
      return;
    }

    const existsNearby = bins.some((bin) => distanceInMeters(bin.latitude, bin.longitude, latitude, longitude) < 3);
    if (existsNearby) {
      setErrorMessage(t("map.binAlreadyExists"));
      return;
    }

    const newBin: BinMarker = {
      id: makeBinId(),
      latitude,
      longitude,
      source: "manual",
      currentStatus: null,
      statusUpdatedAt: null,
    };

    setIsAddingBin(true);
    try {
      const saved = await addBinToDatabase(newBin);
      if (saved) {
        setBins((prev) => [...prev, saved]);
        setErrorMessage(null);
      } else {
        setErrorMessage(t("map.couldNotAddBin"));
      }
    } finally {
      setIsAddingBin(false);
    }
  };

  const removeBin = (id: string) => {
    if (!user) {
      setErrorMessage(t("map.signInToRemoveBins"));
      return;
    }

    // react-native-web's Alert.alert() is a documented no-op — the browser's
    // own confirm() is the real cross-platform equivalent here.
    if (!window.confirm(t("map.removeBinMessage"))) {
      return;
    }

    (async () => {
      const removed = await removeBinFromDatabase(id);
      if (!removed) {
        setErrorMessage(t("map.couldNotRemoveBin"));
        return;
      }

      const nextBins = bins.filter((bin) => bin.id !== id);
      const removedRoutedBin =
        routeDestination?.id === id ||
        (routeDestination !== null && !nextBins.some((bin) => bin.id === routeDestination.id));

      setBins(nextBins);
      setErrorMessage(null);
      setSelectedBin((current) => (current?.id === id ? null : current));

      if (removedRoutedBin) {
        if (nextBins.length > 0 && location) {
          routeToNearestBin(nextBins);
        } else {
          clearRoute();
        }
      }
    })();
  };

  const openBinDetails = useCallback(async (bin: BinMarker) => {
    setSelectedBin(bin);
    setLoadingBinReports(true);
    try {
      const reports = await fetchBinReports(bin.id);
      setBinReports(reports);
    } finally {
      setLoadingBinReports(false);
    }
  }, []);

  const closeBinDetails = useCallback(() => {
    setSelectedBin(null);
    setBinReports([]);
  }, []);

  const handleReportStatus = useCallback(
    async (status: BinStatus) => {
      if (!selectedBin) return;

      if (!user) {
        setErrorMessage(t("map.signInToReport"));
        return;
      }

      setSubmittingReport(true);
      try {
        const success = await reportBinStatus(selectedBin.id, status);
        if (!success) {
          setErrorMessage(t("map.couldNotSubmitReport"));
          return;
        }

        const nowIso = new Date().toISOString();
        setBins((prev) =>
          prev.map((bin) =>
            bin.id === selectedBin.id ? { ...bin, currentStatus: status, statusUpdatedAt: nowIso } : bin,
          ),
        );
        setSelectedBin((prev) =>
          prev && prev.id === selectedBin.id ? { ...prev, currentStatus: status, statusUpdatedAt: nowIso } : prev,
        );
        const reports = await fetchBinReports(selectedBin.id);
        setBinReports(reports);
        setErrorMessage(null);
      } finally {
        setSubmittingReport(false);
      }
    },
    [selectedBin, user, t],
  );

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  // Re-resolve against the live `bins` list so a status change shows
  // immediately while the modal is still open (see MapScreen.tsx).
  const liveSelectedBin = selectedBin ? bins.find((b) => b.id === selectedBin.id) ?? selectedBin : null;

  const center: [number, number] = location
    ? [location.latitude, location.longitude]
    : [initialCenter.latitude, initialCenter.longitude];

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(12, insets.top) }]}>
        <Text style={styles.title}>{t("map.title")}</Text>
        <Text style={styles.subtitle}>
          {permissionDenied ? t("map.locationOff") : errorMessage || t("map.showingLivePosition")}
        </Text>
        {liveStatus === "reconnecting" ? <Text style={styles.liveStatusText}>{t("map.reconnecting")}</Text> : null}
      </View>

      <View style={styles.mapWrapper}>
        <MapContainer center={center} zoom={DEFAULT_ZOOM} style={styles.map as object} ref={mapRef}>
          {/* Voyager: a free, no-API-key tile style that reads much closer to
              the clean light theme phones show (Google/Apple Maps) than raw
              OpenStreetMap's default colorful tiles — pixel-identical isn't
              possible on web without a paid Google Maps API key. */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            subdomains="abcd"
            maxZoom={20}
          />

          <MapClickHandler onMapClick={(lat, lon) => void addBinManually(lat, lon)} />

          {location ? (
            <Marker position={[location.latitude, location.longitude]} icon={userLocationIcon}>
              <Popup>
                <strong>{t("map.yourLocationTitle")}</strong>
                <br />
                {t("map.yourLocationDescription")}
              </Popup>
            </Marker>
          ) : null}

          {bins.map((bin) => (
            <Marker
              key={bin.id}
              position={[bin.latitude, bin.longitude]}
              icon={binDivIcon(bin.currentStatus)}
              eventHandlers={{ click: () => openBinDetails(bin) }}
            />
          ))}

          {routeCoords.length > 1 ? (
            <Polyline
              positions={routeCoords.map((c) => [c.latitude, c.longitude])}
              pathOptions={{ color: "#0ea5e9", weight: 5, dashArray: "1,6" }}
            />
          ) : null}

          {location && routeStart && shouldShowStartConnector ? (
            <Polyline
              positions={[
                [location.latitude, location.longitude],
                [routeStart.latitude, routeStart.longitude],
              ]}
              pathOptions={{ color: "#0284c7", weight: 4, dashArray: "8,8" }}
            />
          ) : null}

          {routeDestination && routeEnd && shouldShowEndConnector ? (
            <Polyline
              positions={[
                [routeEnd.latitude, routeEnd.longitude],
                [routeDestination.latitude, routeDestination.longitude],
              ]}
              pathOptions={{ color: "#0284c7", weight: 4, dashArray: "8,8" }}
            />
          ) : null}
        </MapContainer>
      </View>

      <View style={styles.footer}>
        <Text style={styles.helperText}>{t("map.helperTextWeb")}</Text>
        {routeDestination ? (
          <View style={styles.routeCard}>
            <Text style={styles.routeTitle}>{t("map.nearestBinRoute")}</Text>
            <Text style={styles.routeValue}>
              {isRouting ? t("map.calculatingRoute") : t("map.distanceLabel", { distance: formatDistance(displayDistance) })}
            </Text>
          </View>
        ) : null}
        <TouchableOpacity
          style={[styles.button, styles.spacing, isAddingBin && styles.buttonDisabled]}
          onPress={addBinAtCurrentLocation}
          activeOpacity={0.85}
          disabled={isAddingBin}
        >
          <Text style={styles.buttonText}>{isAddingBin ? t("map.adding") : t("map.addBinAtLocation")}</Text>
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
              setErrorMessage(t("map.noBinsAddOne"));
              clearRoute();
            }
          }}
          activeOpacity={0.85}
          disabled={isRouting}
        >
          <Text style={styles.buttonText}>{t("map.refreshRoute")}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={recenterMap} activeOpacity={0.85}>
          <Text style={styles.buttonText}>{t("map.recenterOnMe")}</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={selectedBin !== null} animationType="slide" transparent onRequestClose={closeBinDetails}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            {liveSelectedBin ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.modalTitle}>{t("map.binDetails")}</Text>
                <Text style={styles.modalSubtitle}>
                  {liveSelectedBin.latitude.toFixed(5)}, {liveSelectedBin.longitude.toFixed(5)} ·{" "}
                  {liveSelectedBin.source === "current" ? t("map.placedAtLocation") : t("map.placedManually")}
                </Text>

                <View
                  style={[
                    styles.modalStatusRow,
                    liveSelectedBin.currentStatus === "full"
                      ? styles.modalStatusRowFull
                      : liveSelectedBin.currentStatus === "damaged"
                        ? styles.modalStatusRowDamaged
                        : styles.modalStatusRowClear,
                  ]}
                >
                  <Ionicons
                    name={
                      liveSelectedBin.currentStatus === "full"
                        ? "archive"
                        : liveSelectedBin.currentStatus === "damaged"
                          ? "warning"
                          : "checkmark-circle"
                    }
                    size={20}
                    color={
                      liveSelectedBin.currentStatus === "full"
                        ? "#b45309"
                        : liveSelectedBin.currentStatus === "damaged"
                          ? "#b91c1c"
                          : "#059669"
                    }
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalStatusText}>
                      {liveSelectedBin.currentStatus === "full"
                        ? t("map.reportedFull")
                        : liveSelectedBin.currentStatus === "damaged"
                          ? t("map.reportedDamaged")
                          : t("map.noOpenReports")}
                    </Text>
                    {liveSelectedBin.statusUpdatedAt ? (
                      <Text style={styles.modalStatusSubtext}>
                        {new Date(liveSelectedBin.statusUpdatedAt).toLocaleString()}
                      </Text>
                    ) : null}
                  </View>
                </View>

                <Text style={styles.modalSectionTitle}>{t("map.reportCondition")}</Text>
                <View style={styles.modalActionRow}>
                  <TouchableOpacity
                    style={[
                      styles.modalActionBtn,
                      styles.modalActionBtnFull,
                      submittingReport && styles.modalActionBtnDisabled,
                    ]}
                    onPress={() => handleReportStatus("full")}
                    disabled={submittingReport}
                  >
                    <Ionicons name="archive" size={18} color="#b45309" />
                    <Text style={styles.modalActionBtnText}>{t("map.full")}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.modalActionBtn,
                      styles.modalActionBtnDamaged,
                      submittingReport && styles.modalActionBtnDisabled,
                    ]}
                    onPress={() => handleReportStatus("damaged")}
                    disabled={submittingReport}
                  >
                    <Ionicons name="warning" size={18} color="#b91c1c" />
                    <Text style={styles.modalActionBtnText}>{t("map.damaged")}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalActionBtn, styles.modalActionBtnDelete]}
                    onPress={() => {
                      const binId = liveSelectedBin.id;
                      closeBinDetails();
                      removeBin(binId);
                    }}
                  >
                    <Ionicons name="trash" size={18} color="#475569" />
                    <Text style={styles.modalActionBtnText}>{t("common.delete")}</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.modalSectionTitle}>
                  {t("map.recentReports")} {binReports.length > 0 ? `(${binReports.length})` : ""}
                </Text>
                {loadingBinReports ? (
                  <ActivityIndicator size="small" color="#10b981" style={{ marginVertical: 8 }} />
                ) : binReports.length === 0 ? (
                  <Text style={styles.modalEmptyText}>{t("map.noReportsYet")}</Text>
                ) : (
                  binReports.map((report) => (
                    <View key={report.id} style={styles.modalReportRow}>
                      <Ionicons
                        name={report.status === "full" ? "archive" : "warning"}
                        size={14}
                        color={report.status === "full" ? "#b45309" : "#b91c1c"}
                      />
                      <Text style={styles.modalReportText}>
                        {report.status === "full" ? t("map.full") : t("map.damaged")}
                      </Text>
                      <Text style={styles.modalReportTime}>{new Date(report.createdAt).toLocaleString()}</Text>
                    </View>
                  ))
                )}

                <TouchableOpacity style={styles.modalCloseBtn} onPress={closeBinDetails}>
                  <Text style={styles.modalCloseBtnText}>{t("common.close")}</Text>
                </TouchableOpacity>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#ecfdf5" },
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 28, fontWeight: "700", color: "#1e293b" },
  subtitle: { marginTop: 6, fontSize: 13, color: "#475569" },
  liveStatusText: { marginTop: 4, fontSize: 12, color: "#b45309", fontWeight: "600" },
  mapWrapper: { flex: 1 },
  map: { flex: 1, width: "100%", height: "100%" },
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
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15,23,42,0.4)",
  },
  modalSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: "80%",
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#e2e8f0",
    alignSelf: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: "#64748b",
    marginBottom: 16,
  },
  modalStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  modalStatusRowClear: {
    backgroundColor: "#ecfdf5",
    borderColor: "#a7f3d0",
  },
  modalStatusRowFull: {
    backgroundColor: "#fffbeb",
    borderColor: "#f59e0b",
  },
  modalStatusRowDamaged: {
    backgroundColor: "#fef2f2",
    borderColor: "#dc2626",
  },
  modalStatusText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1e293b",
  },
  modalStatusSubtext: {
    fontSize: 12,
    color: "#64748b",
  },
  modalSectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
    marginBottom: 8,
    marginTop: 4,
  },
  modalActionRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  modalActionBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    gap: 4,
  },
  modalActionBtnFull: {
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#f59e0b",
  },
  modalActionBtnDamaged: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#dc2626",
  },
  modalActionBtnDelete: {
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  modalActionBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1e293b",
  },
  modalActionBtnDisabled: {
    opacity: 0.5,
  },
  modalReportRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  modalReportText: {
    fontSize: 13,
    color: "#1e293b",
    fontWeight: "600",
  },
  modalReportTime: {
    fontSize: 11,
    color: "#94a3b8",
  },
  modalEmptyText: {
    fontSize: 13,
    color: "#94a3b8",
    paddingVertical: 8,
  },
  modalCloseBtn: {
    marginTop: 16,
    alignItems: "center",
    paddingVertical: 12,
  },
  modalCloseBtnText: {
    color: "#059669",
    fontWeight: "600",
    fontSize: 14,
  },
});
