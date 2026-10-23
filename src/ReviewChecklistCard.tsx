import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { clinicalTheme } from "./clinicalTheme";
import {
  ReviewItem,
  dateAnswer,
  reviewAnswer,
  reviewGroups,
  timeAnswer,
  unknownAnswer,
  upsertReviewAnswer,
} from "./reviewChecklist";

type Props = {
  isDark: boolean;
  medical: boolean;
  history: string[];
  memo: string;
  label: (item: string) => string;
  onMemoChange: (memo: string) => void;
};

/** Optional, collapsed by default. One action per row: tap opens the answer field under it. */
export default function ReviewChecklist(p: Props) {
  const t = clinicalTheme(p.isDark);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const groups = reviewGroups(p.history);
  if (!groups.length) return null;
  const items = groups.flatMap((group) => group.items);
  const done = items.filter((entry) => reviewAnswer(p.memo, entry) !== null).length;
  const write = (entry: ReviewItem, answer: string) => {
    p.onMemoChange(upsertReviewAnswer(p.memo, entry, answer, p.medical));
    setEditing(null);
    setDraft("");
  };
  const quick = (entry: ReviewItem): { label: string; answer: () => string }[] => {
    const now = () => new Date();
    if (entry.kind === "time")
      return [
        { label: p.medical ? "Now" : "지금", answer: () => timeAnswer(0, now(), p.medical) },
        { label: p.medical ? "30 min" : "30분 전", answer: () => timeAnswer(30, now(), p.medical) },
        { label: p.medical ? "1 h" : "1시간 전", answer: () => timeAnswer(60, now(), p.medical) },
        { label: p.medical ? "2 h" : "2시간 전", answer: () => timeAnswer(120, now(), p.medical) },
        { label: p.medical ? "Unknown" : "모름", answer: () => unknownAnswer(p.medical) },
      ];
    if (entry.kind === "date")
      return [
        { label: p.medical ? "Today" : "오늘", answer: () => dateAnswer(0, now(), p.medical) },
        { label: p.medical ? "Yesterday" : "어제", answer: () => dateAnswer(1, now(), p.medical) },
        { label: p.medical ? "2 days" : "그제", answer: () => dateAnswer(2, now(), p.medical) },
        { label: p.medical ? "Unknown" : "모름", answer: () => unknownAnswer(p.medical) },
      ];
    return [];
  };
  return (
    <View style={[s.card, { backgroundColor: t.field }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${p.medical ? "Checklist" : "검토사항"} ${done} / ${items.length}`}
        onPress={() => setOpen((value) => !value)}
        style={s.header}
      >
        <Ionicons name="list" size={17} color={t.accent} />
        <Text style={[s.title, { color: t.ink }]}>{p.medical ? "Checklist" : "검토사항"}</Text>
        <Text style={[s.count, { color: t.muted }]}>
          {done} / {items.length}
        </Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={t.muted} />
      </Pressable>
      {open &&
        groups.map((group) => (
          <View key={group.title}>
            <Text style={[s.group, { color: t.muted }]}>
              {group.title === "공통" ? (p.medical ? "Common" : "공통") : p.label(group.title)}
            </Text>
            {group.items.map((entry) => {
              const answer = reviewAnswer(p.memo, entry);
              const editingThis = editing === entry.id;
              return (
                <View key={entry.id}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ checked: answer !== null, expanded: editingThis }}
                    onPress={() => {
                      setEditing(editingThis ? null : entry.id);
                      setDraft("");
                    }}
                    style={[s.row, { borderTopColor: t.separator }]}
                  >
                    <View
                      style={[
                        s.dot,
                        answer !== null
                          ? { backgroundColor: t.accent, borderColor: t.accent }
                          : { borderColor: t.border },
                      ]}
                    >
                      {answer !== null && <Ionicons name="checkmark" size={12} color={t.surface} />}
                    </View>
                    <Text style={[s.label, { color: entry.critical ? t.danger : t.ink }]}>
                      {p.medical ? entry.en : entry.ko}
                    </Text>
                    {answer !== null && (
                      <Text numberOfLines={1} style={[s.answer, { color: t.muted }]}>
                        {answer}
                      </Text>
                    )}
                  </Pressable>
                  {editingThis && (
                    <View style={s.editor}>
                      {quick(entry).length > 0 && (
                        <View style={s.quick}>
                          {quick(entry).map((option) => (
                            <Pressable
                              key={option.label}
                              accessibilityRole="button"
                              onPress={() => write(entry, option.answer())}
                              style={[s.quickButton, { backgroundColor: t.surface }]}
                            >
                              <Text style={[s.quickText, { color: t.ink }]}>{option.label}</Text>
                            </Pressable>
                          ))}
                        </View>
                      )}
                      <View style={s.inputRow}>
                        <TextInput
                          autoFocus={entry.kind === "text"}
                          value={draft}
                          onChangeText={setDraft}
                          onSubmitEditing={() => write(entry, draft)}
                          returnKeyType="done"
                          placeholder={p.medical ? "Answer, or tap ✓" : "답을 적거나 ✓만 누르세요"}
                          placeholderTextColor={t.placeholder}
                          accessibilityLabel={`${p.medical ? entry.en : entry.ko} 답 입력`}
                          style={[s.input, { backgroundColor: t.surface, color: t.ink, borderColor: t.accent }]}
                        />
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={draft.trim() ? "답 기록" : "확인만 기록"}
                          onPress={() => write(entry, draft)}
                          style={[s.confirm, { backgroundColor: t.surface }]}
                        >
                          <Ionicons name="checkmark" size={20} color={t.accent} />
                        </Pressable>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        ))}
    </View>
  );
}
const s = StyleSheet.create({
  card: { borderRadius: 14, paddingHorizontal: 12, marginBottom: 12 },
  header: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 8 },
  title: { flex: 1, fontSize: 15, fontFamily: "Pretendard-Medium" },
  count: { fontSize: 13, fontFamily: "Pretendard-Regular", fontVariant: ["tabular-nums"] },
  group: { fontSize: 12, fontFamily: "Pretendard-Medium", marginTop: 6, marginBottom: 2 },
  row: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 10, borderTopWidth: StyleSheet.hairlineWidth },
  dot: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 14, fontFamily: "Pretendard-Regular" },
  answer: { flex: 1, textAlign: "right", fontSize: 13, fontFamily: "Pretendard-Regular" },
  editor: { paddingLeft: 30, paddingBottom: 10, gap: 8 },
  quick: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  quickButton: { minHeight: 36, paddingHorizontal: 12, borderRadius: 18, justifyContent: "center" },
  quickText: { fontSize: 13, fontFamily: "Pretendard-Medium" },
  inputRow: { flexDirection: "row", gap: 6, alignItems: "center" },
  input: { flex: 1, minHeight: 44, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, fontSize: 15 },
  confirm: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
});
