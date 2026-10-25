import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { clinicalTheme, scrim } from "./clinicalTheme";
import { HISTORY_GROUPS, toggleHistoryItem } from "./historyOptions";
import { NoteModal } from "./NoteDialogs";

type Props = {
  visible: boolean;
  isDark: boolean;
  history: string[];
  label: (item: string) => string;
  title: string;
  onApply: (history: string[]) => void;
  onCancel: () => void;
};

/** Edits a draft; only ✓ writes it back. Close, backdrop and back cancel. */
export default function HistorySheet(p: Props) {
  const t = clinicalTheme(p.isDark);
  const [draft, setDraft] = useState<string[]>(p.history);
  useEffect(() => {
    if (p.visible) setDraft(p.history);
    // A fresh draft each time the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.visible]);
  return (
    <NoteModal
      visible={p.visible}
      transparent
      animationType="slide"
      onRequestClose={p.onCancel}
    >
      <View style={[s.backdrop, { backgroundColor: scrim("modal", p.isDark) }]}>
        <Pressable
          accessibilityLabel="병력 선택 취소"
          style={StyleSheet.absoluteFill}
          onPress={p.onCancel}
        />
        <SafeAreaView
          edges={["bottom"]}
          style={[s.sheet, { backgroundColor: t.surface }]}
        >
          <View style={[s.grabber, { backgroundColor: t.border }]} />
          <View style={s.header}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="취소"
              onPress={p.onCancel}
              style={[s.round, { backgroundColor: t.field }]}
            >
              <Ionicons name="close" size={18} color={t.ink} />
            </Pressable>
            <Text style={[s.title, { color: t.ink }]}>{p.title}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="적용"
              onPress={() => p.onApply(draft)}
              style={[s.round, { backgroundColor: t.accent }]}
            >
              <Ionicons name="checkmark" size={20} color={t.surface} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={s.content}>
            {HISTORY_GROUPS.map((group, index) => (
              <View
                key={group.id}
                accessibilityRole="none"
                accessibilityLabel={group.title}
                style={[
                  s.group,
                  index > 0 && {
                    borderTopColor: t.separator,
                    borderTopWidth: StyleSheet.hairlineWidth,
                  },
                ]}
              >
                {group.items.map((item) => {
                  const selected = draft.includes(item);
                  return (
                    <View key={item} style={s.cell}>
                      <Pressable
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: selected }}
                        accessibilityLabel={`${group.title} ${p.label(item)}`}
                        hitSlop={{ top: 4, bottom: 4 }}
                        onPress={() =>
                          setDraft((current) =>
                            toggleHistoryItem(current, item),
                          )
                        }
                        style={({ pressed }) => [
                          s.chip,
                          {
                            backgroundColor: selected ? t.ink : t.field,
                            opacity: pressed ? 0.6 : 1,
                          },
                        ]}
                      >
                        <Text
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.8}
                          style={[
                            s.chipText,
                            { color: selected ? t.surface : t.ink },
                            selected && s.chipSelected,
                          ]}
                        >
                          {p.label(item)}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            ))}
          </ScrollView>
        </SafeAreaView>
      </View>
    </NoteModal>
  );
}
const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "88%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 16,
  },
  grabber: {
    width: 36,
    height: 5,
    borderRadius: 3,
    alignSelf: "center",
    marginTop: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 17, fontFamily: "Pretendard-SemiBold" },
  content: { paddingBottom: 20 },
  group: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingVertical: 7,
    marginHorizontal: -3,
  },
  cell: { width: "33.333%", padding: 3 },
  chip: {
    minHeight: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  chipText: { fontSize: 14, fontFamily: "Pretendard-Regular" },
  chipSelected: { fontFamily: "Pretendard-SemiBold" },
});
