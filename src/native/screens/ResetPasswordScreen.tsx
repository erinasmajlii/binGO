import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { supabase } from "../../lib/supabase";

type Stage = "verifying" | "ready" | "invalid";

/**
 * Landing screen for the password-reset deep link (bingo://reset-password?code=...).
 * The email link points at Supabase, which verifies the recovery token
 * server-side and redirects here with a short-lived PKCE `code` — this
 * screen redeems that code for a real session, then lets the user set a
 * new password via supabase.auth.updateUser().
 */
export function ResetPasswordScreen() {
  const [stage, setStage] = useState<Stage>("verifying");
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const handledRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    const redeem = async (url: string | null) => {
      if (!url || handledRef.current) return;

      const code = Linking.parse(url).queryParams?.code;
      if (!code || typeof code !== "string") {
        if (mounted) {
          setStage("invalid");
          setError("This reset link is missing its verification code.");
        }
        return;
      }

      if (!supabase) {
        if (mounted) {
          setStage("invalid");
          setError("Supabase is not configured on this device.");
        }
        return;
      }

      handledRef.current = true;
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (!mounted) return;

      if (exchangeError) {
        setStage("invalid");
        setError(
          exchangeError.message.toLowerCase().includes("expired")
            ? "This reset link has expired. Request a new one from the login screen."
            : exchangeError.message,
        );
        return;
      }

      setStage("ready");
    };

    Linking.getInitialURL().then(redeem);
    const subscription = Linking.addEventListener("url", ({ url }) => redeem(url));

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  const handleSetPassword = async () => {
    setError(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!supabase) {
      setError("Supabase is not configured on this device.");
      return;
    }

    setSubmitting(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        return;
      }

      setSuccess(true);
      setTimeout(() => router.replace("/(tabs)/home"), 1200);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message || "Could not update the password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>
          bin<Text style={styles.titleBold}>Go</Text>
        </Text>
        <Text style={styles.subtitle}>Reset your password</Text>

        {stage === "verifying" ? (
          <View style={styles.stateBox}>
            <ActivityIndicator color="#10b981" />
            <Text style={styles.stateText}>Verifying your reset link…</Text>
          </View>
        ) : null}

        {stage === "invalid" ? (
          <View style={styles.stateBox}>
            <Text style={styles.errorText}>{error || "This reset link is invalid."}</Text>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.replace("/(tabs)/profile")}>
              <Text style={styles.secondaryBtnText}>Back to login</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {stage === "ready" && !success ? (
          <View style={styles.formBox}>
            <Text style={styles.label}>NEW PASSWORD</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter new password"
              placeholderTextColor="#94a3b8"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            <Text style={styles.label}>CONFIRM PASSWORD</Text>
            <TextInput
              style={styles.input}
              placeholder="Re-enter new password"
              placeholderTextColor="#94a3b8"
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.primaryBtn, submitting && styles.primaryBtnDisabled]}
              onPress={handleSetPassword}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>Set new password</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}

        {success ? (
          <View style={styles.stateBox}>
            <Text style={styles.successText}>Password updated. Signing you in…</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f0fdf4" },
  content: { flexGrow: 1, padding: 24, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 40, color: "#059669", fontWeight: "300", marginBottom: 4 },
  titleBold: { fontWeight: "700" },
  subtitle: { color: "#475569", fontSize: 15, marginBottom: 28 },
  stateBox: { alignItems: "center", gap: 12, width: "100%" },
  stateText: { color: "#475569", fontSize: 14 },
  formBox: { width: "100%" },
  label: { fontSize: 11, fontWeight: "600", color: "#475569", marginBottom: 6 },
  input: {
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#1e293b",
    borderRadius: 99,
    paddingHorizontal: 22,
    paddingVertical: 14,
    fontSize: 15,
    color: "#1e293b",
    marginBottom: 14,
  },
  errorText: { color: "#dc2626", fontSize: 13, textAlign: "center", marginBottom: 12 },
  successText: { color: "#059669", fontSize: 15, fontWeight: "600", textAlign: "center" },
  primaryBtn: {
    width: "100%",
    backgroundColor: "#10b981",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  secondaryBtn: { paddingVertical: 10 },
  secondaryBtnText: { color: "#059669", fontSize: 14, fontWeight: "600" },
});
