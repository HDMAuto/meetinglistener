import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { api } from "../lib/api";
import { relativeTime } from "../lib/format";
import { Card, EmptyState } from "../components/ui";
import { colors, fonts } from "../theme";
import type { RootStackParamList } from "../navigation";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function NotificationsScreen() {
  const navigation = useNavigation<Nav>();
  const qc = useQueryClient();

  const { data: notifications } = useQuery({
    queryKey: ["notifications"],
    queryFn: api.listNotifications,
  });
  const { data: meetings } = useQuery({ queryKey: ["meetings"], queryFn: api.listMeetings });

  const markRead = useMutation({
    mutationFn: (id: string) => api.markNotificationRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const titleFor = (meetingId: string) =>
    meetings?.find((m) => m.id === meetingId)?.title ?? "a meeting";

  return (
    <View style={styles.screen}>
      <FlatList
        data={notifications ?? []}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
        ListEmptyComponent={
          <EmptyState
            title="You're all caught up"
            hint="When a task is assigned to you, it'll show up here."
          />
        }
        renderItem={({ item }) => (
          <Card
            style={[
              styles.row,
              !item.read && { borderColor: colors.brand100, backgroundColor: "#F0FDFA99" },
            ]}
          >
            <Pressable
              style={{ flex: 1 }}
              onPress={() => navigation.navigate("MeetingDetail", { id: item.meetingId })}
            >
              <Text style={styles.text}>
                You were assigned a task in{" "}
                <Text style={{ fontFamily: fonts.semibold, color: colors.brand700 }}>
                  {titleFor(item.meetingId)}
                </Text>
              </Text>
              <Text style={styles.time}>{relativeTime(item.createdAt)}</Text>
            </Pressable>
            {!item.read && (
              <Pressable
                onPress={() => markRead.mutate(item.id)}
                style={styles.readBtn}
                disabled={markRead.isPending}
              >
                <Text style={styles.readBtnText}>Mark read</Text>
              </Pressable>
            )}
          </Card>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.slate50 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  text: { fontFamily: fonts.regular, fontSize: 14, color: colors.ink, lineHeight: 20 },
  time: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 3 },
  readBtn: { paddingHorizontal: 10, paddingVertical: 8, minHeight: 36, justifyContent: "center" },
  readBtnText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.brand700 },
});
