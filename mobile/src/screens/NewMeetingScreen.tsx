import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api";
import { Button, Card, Field } from "../components/ui";
import { colors, fonts } from "../theme";
import type { RootStackParamList } from "../navigation";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function NewMeetingScreen() {
  const navigation = useNavigation<Nav>();
  const qc = useQueryClient();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const [title, setTitle] = useState("");
  const [phase, setPhase] = useState<"idle" | "recording" | "recorded">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (phase !== "recording") return;
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  async function startRecording() {
    setError(null);
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) {
      setError("Microphone access was denied. Enable it in Settings to record.");
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    setElapsed(0);
    setPhase("recording");
  }

  async function stopRecording() {
    await recorder.stop();
    setPhase("recorded");
  }

  async function onSubmit() {
    if (!title.trim() || phase !== "recorded" || !recorder.uri) return;
    setSubmitting(true);
    setError(null);
    try {
      const meeting = await api.createMeeting(title.trim());
      await api.uploadAudio(meeting.id, recorder.uri);
      qc.invalidateQueries({ queryKey: ["meetings"] });
      navigation.replace("MeetingDetail", { id: meeting.id });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
      setSubmitting(false);
    }
  }

  const mmss = `${Math.floor(elapsed / 60)}:${(elapsed % 60).toString().padStart(2, "0")}`;

  return (
    <View style={styles.screen}>
      <Field
        label="Meeting title"
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. Q3 Sprint Planning"
        autoFocus
      />

      <Text style={styles.label}>Audio</Text>
      <Card style={[styles.recorderCard, phase === "recording" && styles.recorderActive]}>
        <View style={styles.recorderRow}>
          <View style={[styles.dot, phase === "recording" && { backgroundColor: colors.red600 }]} />
          <Text style={styles.recorderText}>
            {phase === "recording"
              ? `Recording… ${mmss}`
              : phase === "recorded"
                ? `Recorded ${mmss} of audio ✓`
                : "Record from the microphone"}
          </Text>
        </View>
        {phase === "recording" ? (
          <Button title="Stop" variant="outline" onPress={stopRecording} />
        ) : (
          <Button
            title={phase === "recorded" ? "Re-record" : "Record"}
            onPress={startRecording}
          />
        )}
      </Card>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={{ flex: 1 }} />

      <Button
        title="Create & process"
        variant="accent"
        onPress={onSubmit}
        loading={submitting}
        disabled={!title.trim() || phase !== "recorded"}
      />
      <Button
        title="Cancel"
        variant="ghost"
        onPress={() => navigation.goBack()}
        style={{ marginTop: 8, marginBottom: 12 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.slate50, padding: 20 },
  label: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: "#334155",
    marginBottom: 6,
  },
  recorderCard: {
    gap: 14,
  },
  recorderActive: {
    borderColor: colors.brand500,
    backgroundColor: colors.brand50,
  },
  recorderRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.slate300 },
  recorderText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  errorBox: {
    backgroundColor: colors.red50,
    borderRadius: 10,
    padding: 12,
    marginTop: 16,
  },
  errorText: { fontFamily: fonts.medium, fontSize: 14, color: colors.red700 },
});
