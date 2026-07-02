import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { colors, fonts } from "../theme";
import type { MeetingStatus, TaskStatus } from "../lib/types";
import { STATUS_LABEL, isProcessing } from "../lib/format";

type Variant = "primary" | "accent" | "outline" | "ghost" | "danger";

const BTN_BG: Record<Variant, string> = {
  primary: colors.brand600,
  accent: colors.accent500,
  outline: colors.white,
  ghost: "transparent",
  danger: colors.red600,
};
const BTN_FG: Record<Variant, string> = {
  primary: colors.white,
  accent: colors.white,
  outline: colors.ink,
  ghost: colors.muted,
  danger: colors.white,
};

export function Button({
  title,
  onPress,
  variant = "primary",
  loading,
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: BTN_BG[variant], opacity: inactive ? 0.5 : pressed ? 0.85 : 1 },
        variant === "outline" && styles.btnOutline,
        style,
      ]}
    >
      {loading && <ActivityIndicator size="small" color={BTN_FG[variant]} />}
      <Text style={[styles.btnText, { color: BTN_FG[variant] }]}>{title}</Text>
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Field({
  label,
  ...inputProps
}: { label: string } & TextInputProps) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.slate400}
        style={styles.input}
        {...inputProps}
      />
    </View>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyHint}>{hint}</Text>
    </View>
  );
}

const MEETING_BADGE: Record<MeetingStatus, { bg: string; fg: string }> = {
  recording: { bg: colors.slate100, fg: colors.muted },
  uploaded: { bg: colors.amber50, fg: colors.amber700 },
  transcribing: { bg: colors.brand50, fg: colors.brand700 },
  summarizing: { bg: colors.brand50, fg: colors.brand700 },
  ready: { bg: colors.emerald50, fg: colors.emerald700 },
  failed: { bg: colors.red50, fg: colors.red700 },
};

export function MeetingBadge({ status }: { status: MeetingStatus }) {
  const c = MEETING_BADGE[status];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      {isProcessing(status) && <ActivityIndicator size="small" color={c.fg} style={{ transform: [{ scale: 0.7 }] }} />}
      <Text style={[styles.badgeText, { color: c.fg }]}>{STATUS_LABEL[status]}</Text>
    </View>
  );
}

const TASK_BADGE: Record<TaskStatus, { bg: string; fg: string; label: string }> = {
  needs_assignee: { bg: colors.amber50, fg: colors.amber700, label: "Needs review" },
  open: { bg: colors.brand50, fg: colors.brand700, label: "Open" },
  done: { bg: colors.emerald50, fg: colors.emerald700, label: "Done" },
};

export function TaskBadge({ status }: { status: TaskStatus }) {
  const c = TASK_BADGE[status];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.badgeText, { color: c.fg }]}>{c.label}</Text>
    </View>
  );
}

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const text = name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.brand100,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ fontFamily: fonts.bold, fontSize: size * 0.38, color: colors.brand700 }}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    minHeight: 48,
  },
  btnOutline: {
    borderWidth: 1,
    borderColor: colors.slate300,
  },
  btnText: {
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.slate200,
    padding: 16,
    shadowColor: colors.ink,
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  fieldLabel: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: "#334155",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.slate300,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: fonts.regular,
    color: colors.ink,
    backgroundColor: colors.white,
    minHeight: 48,
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.muted,
    marginBottom: 10,
  },
  empty: {
    alignItems: "center",
    padding: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.slate300,
    backgroundColor: "rgba(255,255,255,0.6)",
  },
  emptyTitle: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.ink,
  },
  emptyHint: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.muted,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 20,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
  },
});
