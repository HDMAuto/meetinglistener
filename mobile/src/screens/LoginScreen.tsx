import { useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  Pressable,
  View,
} from "react-native";
import { useAuth } from "../auth/AuthContext";
import { Button, Field } from "../components/ui";
import { ApiError } from "../lib/api";
import { colors, fonts } from "../theme";

export function LoginScreen() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    setLoading(true);
    try {
      if (mode === "login") await login(email.trim(), password);
      else await register(name.trim(), email.trim(), password);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "EMAIL_TAKEN") setError("That email is already registered.");
        else if (err.code === "INVALID_CREDENTIALS") setError("Wrong email or password.");
        else if (err.code === "INVALID_BODY") setError("Password must be at least 6 characters.");
        else setError(err.message);
      } else {
        setError("Could not reach the server. Is the backend running?");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.slate50 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Image
          source={require("../../assets/icon.png")}
          style={styles.logo}
          accessibilityLabel="Briefly logo"
        />
        <Text style={styles.appName}>
          Meeting<Text style={{ color: colors.brand600 }}>Listener</Text>
        </Text>

        <Text style={styles.heading}>
          {mode === "login" ? "Welcome back" : "Create your account"}
        </Text>
        <Text style={styles.sub}>
          {mode === "login"
            ? "Sign in to your dashboard."
            : "Start turning meetings into action."}
        </Text>

        <View style={{ width: "100%", marginTop: 28 }}>
          {mode === "register" && (
            <Field
              label="Name"
              value={name}
              onChangeText={setName}
              placeholder="Ada Lovelace"
              autoCapitalize="words"
              autoComplete="name"
            />
          )}
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@company.com"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Button
            title={mode === "login" ? "Sign in" : "Create account"}
            onPress={onSubmit}
            loading={loading}
          />

          <Pressable
            onPress={() => {
              setMode(mode === "login" ? "register" : "login");
              setError(null);
            }}
            style={{ marginTop: 20, alignItems: "center", minHeight: 44, justifyContent: "center" }}
          >
            <Text style={styles.switchText}>
              {mode === "login" ? "New here? " : "Already have an account? "}
              <Text style={{ color: colors.brand600, fontFamily: fonts.semibold }}>
                {mode === "login" ? "Create an account" : "Sign in"}
              </Text>
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
    paddingVertical: 48,
  },
  logo: { width: 96, height: 96, marginBottom: 4 },
  appName: {
    fontFamily: fonts.extrabold,
    fontSize: 22,
    color: colors.ink,
    marginBottom: 24,
  },
  heading: {
    fontFamily: fonts.bold,
    fontSize: 26,
    color: colors.ink,
  },
  sub: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.muted,
    marginTop: 6,
  },
  errorBox: {
    backgroundColor: colors.red50,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.red700,
  },
  switchText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.muted,
  },
});
