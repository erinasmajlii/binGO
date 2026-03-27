import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { supabase } from "../../lib/supabase";

export function RegisterScreen() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    address: "",
    acceptTerms: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: string, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleRegister = async () => {
    setError(null);

    if (!form.name.trim()) { setError("Full name is required."); return; }
    if (!form.email.trim()) { setError("Email is required."); return; }
    if (form.password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (form.password !== form.confirmPassword) { setError("Passwords do not match."); return; }
    if (!form.acceptTerms) { setError("You must accept the terms & conditions."); return; }

    setLoading(true);
    const { error: signUpError } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        data: { name: form.name.trim(), address: form.address.trim() },
      },
    });
    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    Alert.alert(
      "Account created!",
      "Check your email to confirm your account, then log in.",
      [{ text: "OK", onPress: () => router.replace("/(tabs)/home") }]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* Decorative circles */}
      <View style={[styles.circle, { top: -60, left: -60, width: 180, height: 180, backgroundColor: "#a7f3d0" }]} />
      <View style={[styles.circle, { bottom: -60, right: -60, width: 200, height: 200, backgroundColor: "#a7f3d0" }]} />

      <View style={styles.header}>
        <Text style={styles.subtitle}>Welcome to</Text>
        <Text style={styles.title}>
          bin<Text style={styles.titleBold}>Go</Text>
        </Text>
        <Text style={styles.description}>
          How you manage your waste?{"\n"}If not, then start from now.
        </Text>
      </View>

      <TextInput
        style={styles.input}
        placeholder="Full name"
        placeholderTextColor="#94a3b8"
        value={form.name}
        onChangeText={(v) => set("name", v)}
      />
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
      <TextInput
        style={styles.input}
        placeholder="Confirm password"
        placeholderTextColor="#94a3b8"
        secureTextEntry
        value={form.confirmPassword}
        onChangeText={(v) => set("confirmPassword", v)}
      />
      <TextInput
        style={styles.input}
        placeholder="Address"
        placeholderTextColor="#94a3b8"
        value={form.address}
        onChangeText={(v) => set("address", v)}
      />

      <View style={styles.termsRow}>
        <Switch
          value={form.acceptTerms}
          onValueChange={(v) => set("acceptTerms", v)}
          trackColor={{ true: "#10b981" }}
          thumbColor="#fff"
        />
        <Text style={styles.termsText}>I accept the terms & conditions</Text>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleRegister}
        disabled={loading}
        activeOpacity={0.85}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.buttonText}>Register</Text>
        }
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.replace("/(tabs)/home")} style={styles.skip}>
        <Text style={styles.skipText}>Already have an account? Login</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0fdf4" },
  content: { padding: 24, paddingBottom: 48, alignItems: "center" },
  circle: { position: "absolute", borderRadius: 999, opacity: 0.5 },
  header: { alignItems: "center", marginBottom: 28, zIndex: 1 },
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
    marginBottom: 12,
  },
  termsRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 20, width: "100%" },
  termsText: { color: "#475569", fontSize: 13 },
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
  },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  skip: { paddingVertical: 8 },
  skipText: { color: "#059669", fontSize: 14 },
  errorText: { color: "#dc2626", fontSize: 13, marginBottom: 12, textAlign: "center", width: "100%" },
  buttonDisabled: { opacity: 0.6 },
});
