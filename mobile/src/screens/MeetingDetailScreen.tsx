import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { api } from "../lib/api";
import type { Task, User } from "../lib/types";
import { STATUS_LABEL, formatDateTime, formatDuration, isProcessing } from "../lib/format";
import { Avatar, Button, Card, MeetingBadge, SectionTitle, TaskBadge } from "../components/ui";
import { colors, fonts } from "../theme";
import type { RootStackParamList } from "../navigation";

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, "MeetingDetail">;

export function MeetingDetailScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const qc = useQueryClient();

  const { data: meeting } = useQuery({
    queryKey: ["meeting", params.id],
    queryFn: () => api.getMeeting(params.id),
    refetchInterval: (q) => (q.state.data && isProcessing(q.state.data.status) ? 3000 : false),
  });
  const ready = meeting?.status === "ready";

  const { data: tasks } = useQuery({
    queryKey: ["tasks", params.id],
    queryFn: () => api.listTasks(params.id),
    enabled: ready,
  });
  const { data: transcript } = useQuery({
    queryKey: ["transcript", params.id],
    queryFn: () => api.getTranscript(params.id).catch(() => null),
    enabled: ready,
  });
  const { data: users } = useQuery({ queryKey: ["users"], queryFn: api.listUsers, enabled: ready });

  const deleteMeeting = useMutation({
    mutationFn: () => api.deleteMeeting(params.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meetings"] });
      navigation.goBack();
    },
  });

  function confirmDelete() {
    Alert.alert(
      "Delete meeting?",
      `This permanently deletes “${meeting?.title}” — its transcript, tasks, and notifications.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => deleteMeeting.mutate() },
      ],
    );
  }

  if (!meeting) return <View style={styles.screen} />;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{meeting.title}</Text>
          <Text style={styles.meta}>
            {formatDateTime(meeting.createdAt)} · {formatDuration(meeting.durationSec)}
          </Text>
        </View>
        <MeetingBadge status={meeting.status} />
      </View>

      {isProcessing(meeting.status) && (
        <Card style={{ marginTop: 16 }}>
          <Text style={styles.processingTitle}>{STATUS_LABEL[meeting.status]}…</Text>
          <Text style={styles.processingHint}>
            This runs in the background — the screen updates automatically when it's done.
          </Text>
        </Card>
      )}

      {meeting.status === "failed" && (
        <Card style={{ marginTop: 16, borderColor: "#FECACA" }}>
          <Text style={[styles.processingTitle, { color: colors.red700 }]}>Processing failed</Text>
          <Text style={styles.processingHint}>
            {meeting.errorMessage ?? "Something went wrong while processing this meeting."}
          </Text>
        </Card>
      )}

      {ready && (
        <>
          {meeting.goal && (
            <View style={styles.goalBox}>
              <Text style={styles.goalLabel}>MEETING GOAL</Text>
              <Text style={styles.goalText}>{meeting.goal}</Text>
            </View>
          )}

          <Card style={{ marginTop: 16 }}>
            <SectionTitle>Summary</SectionTitle>
            {(meeting.summary ?? "No summary.")
              .split("\n")
              .filter(Boolean)
              .map((p, i) => (
                <Text key={i} style={styles.summaryText}>
                  {p}
                </Text>
              ))}
          </Card>

          <Card style={{ marginTop: 16 }}>
            <SectionTitle>Assignments{tasks ? ` (${tasks.length})` : ""}</SectionTitle>
            {!tasks || tasks.length === 0 ? (
              <Text style={styles.processingHint}>No action items were detected.</Text>
            ) : (
              tasks.map((t) => (
                <TaskRow key={t.id} task={t} users={users ?? []} meetingId={params.id} />
              ))
            )}
          </Card>

          <Card style={{ marginTop: 16 }}>
            <SectionTitle>Notes · Transcript</SectionTitle>
            {transcript ? (
              transcript.segments && transcript.segments.length > 0 ? (
                transcript.segments.map((u, i) => (
                  <Text key={i} style={styles.transcriptText}>
                    <Text style={{ fontFamily: fonts.semibold, color: colors.brand700 }}>
                      Speaker {u.speaker}:
                    </Text>{" "}
                    {u.text}
                  </Text>
                ))
              ) : (
                <Text style={styles.transcriptText}>{transcript.fullText}</Text>
              )
            ) : (
              <Text style={styles.processingHint}>No transcript available.</Text>
            )}
          </Card>
        </>
      )}

      <Button
        title="Delete meeting"
        variant="danger"
        onPress={confirmDelete}
        loading={deleteMeeting.isPending}
        style={{ marginTop: 24 }}
      />
    </ScrollView>
  );
}

function TaskRow({ task, users, meetingId }: { task: Task; users: User[]; meetingId: string }) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["tasks", meetingId] });
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  const assign = useMutation({
    mutationFn: (assigneeId: string) => api.assignTask(task.id, assigneeId),
    onSuccess: invalidate,
  });
  const complete = useMutation({
    mutationFn: () => api.completeTask(task.id),
    onSuccess: invalidate,
  });

  const assignee = users.find((u) => u.id === task.assigneeId);
  const suggested = users.filter((u) => task.suggestedAssigneeIds.includes(u.id));
  const others = users.filter((u) => !task.suggestedAssigneeIds.includes(u.id));

  return (
    <View style={styles.taskRow}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
        <Text
          style={[
            styles.taskDesc,
            task.status === "done" && { color: colors.slate400, textDecorationLine: "line-through" },
          ]}
        >
          {task.description}
        </Text>
        <TaskBadge status={task.status} />
      </View>

      {task.status === "needs_assignee" ? (
        <View style={styles.pickerBox}>
          <Text style={styles.pickerLabel}>
            Who is this for?{task.assigneeText ? ` (heard as “${task.assigneeText}”)` : ""}
          </Text>
          <View style={styles.chipWrap}>
            {[...suggested, ...others].map((u) => (
              <Pressable
                key={u.id}
                onPress={() => assign.mutate(u.id)}
                disabled={assign.isPending}
                style={({ pressed }) => [
                  styles.chip,
                  suggested.some((s) => s.id === u.id) && styles.chipSuggested,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={styles.chipText}>{u.name}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : (
        <View style={styles.assigneeRow}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
            <Avatar name={assignee?.name ?? task.assigneeText ?? "?"} size={28} />
            <Text style={styles.assigneeName}>
              {assignee?.name ?? task.assigneeText ?? "Unassigned"}
            </Text>
          </View>
          {task.status === "open" && (
            <Pressable
              onPress={() => complete.mutate()}
              disabled={complete.isPending}
              style={styles.doneBtn}
            >
              <Text style={styles.doneBtnText}>Mark done</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.slate50 },
  headerRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  title: { fontFamily: fonts.bold, fontSize: 22, color: colors.ink },
  meta: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 4 },
  processingTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  processingHint: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 4, lineHeight: 19 },
  goalBox: {
    marginTop: 16,
    backgroundColor: colors.brand50,
    borderColor: colors.brand100,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  goalLabel: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1, color: colors.brand700 },
  goalText: { fontFamily: fonts.medium, fontSize: 15, color: colors.brand900, marginTop: 6, lineHeight: 22 },
  summaryText: { fontFamily: fonts.regular, fontSize: 15, color: "#334155", lineHeight: 23, marginBottom: 10 },
  transcriptText: { fontFamily: fonts.regular, fontSize: 14, color: "#334155", lineHeight: 21, marginBottom: 8 },
  taskRow: {
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    backgroundColor: colors.white,
  },
  taskDesc: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.ink, lineHeight: 21 },
  pickerBox: { backgroundColor: colors.amber50, borderRadius: 10, padding: 10, marginTop: 10 },
  pickerLabel: { fontFamily: fonts.semibold, fontSize: 12, color: colors.amber700 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.slate300,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.white,
    minHeight: 36,
  },
  chipSuggested: { borderColor: colors.brand500, backgroundColor: colors.brand50 },
  chipText: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink },
  assigneeRow: { flexDirection: "row", alignItems: "center", marginTop: 10, gap: 8 },
  assigneeName: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted },
  doneBtn: {
    borderWidth: 1,
    borderColor: colors.slate300,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 36,
    justifyContent: "center",
  },
  doneBtnText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink },
});
