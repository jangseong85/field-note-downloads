import React, { useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { NoteModal } from "./NoteDialogs";
import { SafeAreaView } from "react-native-safe-area-context";
import { RecordTabs } from "./ClinicalControls";
import WheelColumn from "./NativeWheelColumn";
import { wheelRange } from "./wheelOptions";
import { clinicalTheme } from "./clinicalTheme";
import { formatDate, formatTime, weekdayForDate } from "./dateTime";
import {
  changeWheel,
  monthDays,
  wheelDraft,
  wheelParts,
  WheelDraft,
} from "./wheelDateTime";

type Props = {
  visible: boolean;
  title: string;
  date: string;
  time?: string;
  isDark: boolean;
  initialMode?: "date" | "time";
  dateOnly?: boolean;
  onCancel: () => void;
  onApply: (date: string, time: string) => void;
};

export default function DateTimeWheelPicker(props: Props) {
  // Each opening gets the correct initial mode/draft before the first modal frame.
  // Hidden pickers do no row or animation setup work.
  return props.visible ? <WheelPickerSession {...props} /> : null;
}

function WheelPickerSession({
  visible,
  title,
  date,
  time = "",
  isDark,
  initialMode = "date",
  dateOnly = false,
  onCancel,
  onApply,
}: Props) {
  const t = clinicalTheme(isDark),
    { height, fontScale } = useWindowDimensions();
  const [draft, setDraft] = useState(() => wheelDraft(date, time));
  const [mode, setMode] = useState<"date" | "time">(initialMode);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const columnHandlers = useMemo(() => {
    const forPart = (part: keyof WheelDraft) => ({
      onChange: (value: number) =>
        setDraft((previous) =>
          previous[part] === value
            ? previous
            : changeWheel(previous, part, value),
        ),
      onBusy: (value: boolean) =>
        setBusy((previous) =>
          previous[part] === value ? previous : { ...previous, [part]: value },
        ),
    });
    return {
      year: forPart("year"),
      month: forPart("month"),
      day: forPart("day"),
      hour: forPart("hour"),
      minute: forPart("minute"),
    };
  }, []);
  const rowHeight = Math.max(56, Math.ceil(24 * fontScale + 20)),
    rows = height < 760 || fontScale > 1.2 ? 3 : 5;
  const parts = wheelParts(draft),
    spinning = Object.values(busy).some(Boolean);
  const columns: {
    part: keyof WheelDraft;
    label: string;
    from: number;
    to: number;
  }[] =
    mode === "date" || dateOnly
      ? [
          { part: "year", label: "년", from: 1900, to: 2100 },
          { part: "month", label: "월", from: 1, to: 12 },
          {
            part: "day",
            label: "일",
            from: 1,
            to: monthDays(draft.year, draft.month),
          },
        ]
      : [
          { part: "hour", label: "시", from: 0, to: 23 },
          { part: "minute", label: "분", from: 0, to: 59 },
        ];
  return (
    <NoteModal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View style={styles.stage}>
        <Pressable
          accessible={false}
          style={StyleSheet.absoluteFill}
          onPress={onCancel}
        />
        <SafeAreaView
          edges={["bottom"]}
          accessibilityViewIsModal
          style={[styles.sheet, { backgroundColor: t.surface }]}
        >
          <View style={styles.header}>
            <Text
              accessibilityRole="header"
              style={[styles.title, { color: t.ink }]}
            >
              {title}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={onCancel}
              style={styles.headerButton}
            >
              <Text style={[styles.buttonText, { color: t.muted }]}>취소</Text>
            </Pressable>
          </View>
          {!dateOnly && (
            <RecordTabs
              isDark={isDark}
              options={[
                { id: "date", label: "날짜" },
                { id: "time", label: "시간" },
              ]}
              label="날짜 또는 시간 선택"
              selectedId={mode}
              disabled={spinning}
              onSelect={(value) => setMode(value as "date" | "time")}
            />
          )}
          <View style={styles.wheels}>
            {columns.map((c) => (
              <WheelColumn
                key={c.part}
                label={c.label}
                value={draft[c.part]}
                values={wheelRange(c.from, c.to)}
                rowHeight={rowHeight}
                active={visible}
                rows={rows}
                isDark={isDark}
                {...columnHandlers[c.part]}
              />
            ))}
          </View>
          <Text style={[styles.summary, { color: t.muted }]}>
            {formatDate(parts.date).replace(/ /g, "")} ·{" "}
            {weekdayForDate(parts.date)}
            {!dateOnly ? ` · ${formatTime(parts.time)}` : ""}
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={spinning}
            accessibilityLabel={`${title} 선택 적용`}
            onPress={() => onApply(parts.date, dateOnly ? time : parts.time)}
            style={[
              styles.apply,
              { backgroundColor: t.ink, opacity: spinning ? 0.45 : 1 },
            ]}
          >
            <Text style={[styles.buttonText, { color: t.surface }]}>
              선택 적용
            </Text>
          </Pressable>
        </SafeAreaView>
      </View>
    </NoteModal>
  );
}
const styles = StyleSheet.create({
  stage: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,.42)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { fontSize: 20, fontFamily: "Pretendard-SemiBold", flex: 1 },
  headerButton: {
    minHeight: 48,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  buttonText: { fontSize: 16, fontFamily: "Pretendard-Medium" },
  wheels: { flexDirection: "row", gap: 10 },
  column: { flex: 1, minWidth: 0 },
  columnLabel: {
    fontSize: 13,
    fontFamily: "Pretendard-Medium",
    textAlign: "center",
    marginBottom: 6,
  },
  selection: { position: "absolute", left: 0, right: 0, borderRadius: 14 },
  wheelRow: { justifyContent: "center", alignItems: "center" },
  summary: {
    fontSize: 14,
    fontFamily: "Pretendard-Regular",
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  apply: {
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    marginBottom: 12,
  },
});
