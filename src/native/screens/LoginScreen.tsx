import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { supabase } from "../../lib/supabase";

export function LoginScreen() {
  const [form, setForm] = useState({
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleLogin = async () => {
    setError(null);

    if (!form.email.trim()) { setError("Email is required."); return; }
    if (!form.password) { setError("Password is required."); return; }

    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: form.email.trim(),
      password: form.password,
    });
    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    // Navigate to home on success
    router.replace("/(tabs)/home");
  };

  const handleGuestLogin = async () => {
    setError(null);
    setLoading(true);
    
    // Create a temporary guest account using a fake email
    const randomId = Math.floor(Math.random() * 100000000);
    const guestEmail = `guest_${randomId}@bin-go.temp.com`;
    const guestPass = `GuestPass${randomId}!`;
    
    const { error: signUpError } = await supabase.auth.signUp({
      email: guestEmail,
      password: guestPass,
      options: { data: { name: "Guest User" } }
    });
    
    setLoading(false);
    
    if (signUpError) {
      setError("Could not create guest session: " + signUpError.message);
      return;
    }
    
    router.replace("/(tabs)/home");
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* Decorative circles */}
      <View style={[styles.circle, { top: -60, left: -60, width: 180, height: 180, backgroundColor: "#a7f3d0" }]} />
      <View style={[styles.circle, { bottom: -60, right: -60, width: 200, height: 200, backgroundColor: "#a7f3d0" }]} />

      <View style={styles.header}>
        <Text style={styles.subtitle}>Welcome back to</Text>
        <Text style={styles.title}>
          bin<Text style={styles.titleBold}>Go</Text>
        </Text>
        <Text style={styles.description}>
          Let's continue making the world a cleaner place.
        </Text>
      </View>

      <TextInput
        style={styles.input}
        placeholder="Email address"
        placeholderTextColor="#94a3b8"
        keyboardType="email-address"
        autoCapitalize="none"
        value={form.email}
        onChangeText={(v) => set("email", v)}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#94a3b8"
        secureTextEntry
        value={form.password}
        onChangeText={(v) => set("password", v)}
      />

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleLogin}
        disabled={loading}
        activeOpacity={0.85}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.buttonText}>Log in</Text>
        }
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.replace("/register")} style={styles.skip}>
        <Text style={styles.skipText}>Don't have an account? Register</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={handleGuestLogin} style={styles.guestBtn}>
        <Text style={styles.guestBtnText}>Continue as Guest</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0fdf4" },
  content: { padding: 24, paddingVertical: 80, alignItems: "center", flexGrow: 1, justifyContent: "center" },
  circle: { position: "absolute", borderRadius: 999, opacity: 0.5 },
  header: { alignItems: "center", marginBottom: 40, zIndex: 1 },
  subtitle: { color: "#475569", fontSize: 14, marginBottom: 4 },
  title: { fontSize: 48, color: "#059669", fontWeight: "300", marginBottom: 8 },
  titleBold: { fontWeight: "700" },
  description: { color: "#475569", fontSize: 13, textAlign: "center", lineHeight: 20 },
  input: {
    width: "100%",
    borderWidth: 2,
    borderColor: "#1e293b",
    borderRadius: 99,
    paddingHorizontal: 22,
    paddingVertical: 14,
    fontSize: 15,
    color: "#1e293b",
    backgroundColor: "#fff",
    marginBottom: 16,
  },
  button: {
    width: "100%",
    backgroundColor: "#10b981",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 16,
    marginTop: 8,
  },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  skip: { paddingVertical: 8, marginTop: 16 },
  skipText: { color: "#059669", fontSize: 14 },
  guestBtn: { paddingVertical: 12, marginTop: 8, backgroundColor: "#ecfdf5", width: "100%", borderRadius: 16, alignItems: "center" },
  guestBtnText: { color: "#059669", fontSize: 15, fontWeight: "600" },
  errorText: { color: "#dc2626", fontSize: 13, marginBottom: 12, textAlign: "center", width: "100%" },
  buttonDisabled: { opacity: 0.6 },
});
