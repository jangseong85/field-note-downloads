import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { clinicalTheme } from "./clinicalTheme";
import { TYPE, makeStyles } from "./design";
import { NoteModal } from "./NoteDialogs";
import type { PolicyDocument } from "./privacyNotice";

/** Full-screen reader for the privacy policy and terms, opened from settings. */
export default function PolicyDocumentScreen({
  document,
  isDark,
  onClose,
}: {
  document: PolicyDocument | null;
  isDark: boolean;
  onClose: () => void;
}) {
  const styles = useStyles();
  const t = clinicalTheme(isDark);
  return (
    <NoteModal visible={document !== null} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.page, { backgroundColor: t.surface }]}>
        <View style={[styles.header, { borderBottomColor: t.separator }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="닫기" onPress={onClose} hitSlop={8} style={styles.close}>
            <Ionicons name="chevron-back" size={24} color={t.ink} />
          </Pressable>
          <Text style={[styles.title, { color: t.ink }]}>{document?.title}</Text>
          <View style={styles.close} />
        </View>
        {document && (
          <ScrollView contentContainerStyle={styles.body}>
            <Text style={[styles.paragraph, { color: t.ink }]}>{document.intro}</Text>
            {document.sections.map((section) => (
              <View key={section.heading} style={styles.section}>
                <Text style={[styles.heading, { color: t.ink }]}>{section.heading}</Text>
                {section.paragraphs?.map((paragraph) => (
                  <Text key={paragraph} style={[styles.paragraph, { color: t.ink }]}>{paragraph}</Text>
                ))}
                {section.items?.map((item) => (
                  <View key={item} style={styles.item}>
                    <Text style={[styles.paragraph, { color: t.muted }]}>•</Text>
                    <Text style={[styles.paragraph, styles.itemText, { color: t.ink }]}>{item}</Text>
                  </View>
                ))}
              </View>
            ))}
            {!!document.effective && <Text style={[styles.effective, { color: t.muted }]}>시행일: {document.effective}</Text>}
          </ScrollView>
        )}
      </SafeAreaView>
    </NoteModal>
  );
}

const useStyles = makeStyles({
  page: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8, minHeight: 56, borderBottomWidth: 1 },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  title: { fontSize: TYPE.body, fontFamily: "Pretendard-SemiBold" },
  body: { padding: 20, paddingBottom: 48, gap: 20 },
  section: { gap: 8 },
  heading: { fontSize: TYPE.body, lineHeight: 24, fontFamily: "Pretendard-SemiBold" },
  paragraph: { fontSize: TYPE.sub, lineHeight: 22, fontFamily: "Pretendard-Regular" },
  item: { flexDirection: "row", gap: 8, paddingLeft: 4 },
  itemText: { flex: 1 },
  effective: { fontSize: TYPE.caption, fontFamily: "Pretendard-Regular", marginTop: 8 },
});
