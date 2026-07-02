import { useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { api } from "../lib/api";
import type { Meeting } from "../lib/types";
import { formatDate, formatDuration, isProcessing } from "../lib/format";
import { Card, EmptyState, MeetingBadge } from "../components/ui";
import { useAuth } from "../auth/AuthContext";
import { colors, fonts } from "../theme";
import type { RootStackParamList } from "../navigation";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function MeetingsScreen() {
  const navigation = useNavigation<Nav>();
  const { user, logout } = useAuth();
  const [search, setSearch] = useState("");

  const { data: meetings, isRefetching, refetch } = useQuery({
    queryKey: ["meetings"],
    queryFn: api.listMeetings,
    refetchInterval: (q) =>
      (q.state.data ?? []).some((m: Meeting) => isProcessing(m.status)) ? 4000 : false,
  });

  const filtered = useMemo(() => {
    const list = meetings ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((m) =>
      [m.title, m.summary ?? "", m.goal ?? ""].some((t) => t.toLowerCase().includes(q)),
    );
  }, [meetings, search]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>Hi, {user?.name.split(" ")[0]}</Text>
          <Text style={styles.subtitle}>
            {meetings?.length ?? 0} meeting{(meetings?.length ?? 0) === 1 ? "" : "s"}
          </Text>
        </View>
        <Pressable onPress={logout} hitSlop={12} style={{ minHeight: 44, justifyContent: "center" }}>
          <Text style={styles.signOut}>Sign out</Text>
        </Pressable>
      </View>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search meetings, summaries, goals…"
        placeholderTextColor={colors.slate400}
        style={styles.search}
        accessibilityLabel="Search meetings"
      />

      <FlatList
        data={filtered}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ paddingBottom: 120, paddingTop: 4 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brand600} />
        }
        ListEmptyComponent={
          meetings && meetings.length > 0 ? (
            <EmptyState title="No matches" hint={`Nothing matches “${search}”.`} />
          ) : (
            <EmptyState
              title="No meetings yet"
              hint="Tap the + button to record your first meeting — we'll transcribe it, summarize it, and pull out the tasks."
            />
          )
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => navigation.navigate("MeetingDetail", { id: item.id })}>
            <Card style={{ marginBottom: 12 }}>
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <MeetingBadge status={item.status} />
              </View>
              <Text style={styles.cardSummary} numberOfLines={3}>
                {item.summary
                  ? item.summary
                  : isProcessing(item.status)
                    ? "Processing — transcript and summary on the way…"
                    : item.status === "failed"
                      ? (item.errorMessage ?? "Processing failed.")
                      : "No summary yet."}
              </Text>
              <Text style={styles.cardMeta}>
                {formatDate(item.createdAt)} · {formatDuration(item.durationSec)}
              </Text>
            </Card>
          </Pressable>
        )}
      />

      <Pressable
        onPress={() => navigation.navigate("NewMeeting")}
        style={({ pressed }) => [styles.fab, pressed && { transform: [{ scale: 0.96 }] }]}
        accessibilityLabel="New meeting"
      >
        <Text style={styles.fabPlus}>＋</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.slate50, paddingHorizontal: 20 },
  header: { flexDirection: "row", alignItems: "center", paddingTop: 12, paddingBottom: 8 },
  greeting: { fontFamily: fonts.bold, fontSize: 24, color: colors.ink },
  subtitle: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 2 },
  signOut: { fontFamily: fonts.medium, fontSize: 14, color: colors.muted },
  search: {
    borderWidth: 1,
    borderColor: colors.slate300,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    fontFamily: fonts.regular,
    color: colors.ink,
    backgroundColor: colors.white,
    marginBottom: 12,
    minHeight: 44,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  cardTitle: { flex: 1, fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
  cardSummary: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.muted,
    lineHeight: 20,
    marginTop: 8,
  },
  cardMeta: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.slate400,
    marginTop: 10,
  },
  fab: {
    position: "absolute",
    right: 24,
    bottom: 28,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.accent500,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.ink,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  fabPlus: { color: colors.white, fontSize: 28, lineHeight: 32 },
});
