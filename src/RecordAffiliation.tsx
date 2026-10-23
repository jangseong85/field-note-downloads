import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ClinicalInput } from "./ClinicalControls";
import { clinicalTheme } from "./clinicalTheme";
import { useNoteAlert } from "./NoteDialogs";
import type { SenderInfo } from "./smsMessage";

export const AFFILIATION_KEY = "ems-log.affiliation.v1";
export const PARAMEDIC_RANK_KEY = "ems-log.paramedic-rank.v1";
export const PARAMEDIC_NAME_KEY = "ems-log.paramedic-name.v1";

/** Reads the device-level sender details. Every field is optional. */
export async function loadSender(): Promise<SenderInfo> {
  const saved = new Map(
    await AsyncStorage.multiGet([AFFILIATION_KEY, PARAMEDIC_RANK_KEY, PARAMEDIC_NAME_KEY]),
  );
  return {
    affiliation: saved.get(AFFILIATION_KEY) ?? "",
    rank: saved.get(PARAMEDIC_RANK_KEY) ?? "",
    name: saved.get(PARAMEDIC_NAME_KEY) ?? "",
  };
}

/** Device-level setting, deliberately separate from patient/reset storage. */
export default function RecordAffiliation({ isDark, onSaved }: { isDark: boolean; onSaved: (sender: SenderInfo) => void }) {
  const t = clinicalTheme(isDark);
  const alert = useNoteAlert();
  const [sender, setSender] = useState<SenderInfo>({ affiliation: "", rank: "", name: "" });
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    void loadSender()
      .then((saved) => {
        if (active) {
          setSender(saved);
          setReady(true);
        }
      })
      .catch(() => {
        if (active)
          alert(
            "소속 설정",
            "저장된 소속을 불러오지 못했습니다. 창을 다시 열어 주세요.",
          );
      });
    return () => {
      active = false;
    };
  }, [alert]);
  const labelStyle = {
    color: t.muted,
    fontSize: 13,
    fontFamily: "Pretendard-Medium",
  };
  const update = (key: keyof SenderInfo) => (value: string) =>
    setSender((previous) => ({ ...previous, [key]: value }));
  return (
    <View style={{ gap: 8 }}>
      <Text style={labelStyle}>소속</Text>
      <ClinicalInput
        isDark={isDark}
        value={sender.affiliation}
        onChangeText={update("affiliation")}
        editable={ready && !saving}
        maxLength={100}
        placeholder="소속 입력"
        accessibilityLabel="소속 입력"
        autoCorrect={false}
      />
      <Text style={labelStyle}>계급 · 성명</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <ClinicalInput
          isDark={isDark}
          value={sender.rank}
          onChangeText={update("rank")}
          editable={ready && !saving}
          maxLength={20}
          placeholder="계급"
          accessibilityLabel="대원 계급 입력"
          autoCorrect={false}
          style={{ flex: 2 }}
        />
        <ClinicalInput
          isDark={isDark}
          value={sender.name}
          onChangeText={update("name")}
          editable={ready && !saving}
          maxLength={30}
          placeholder="성명"
          accessibilityLabel="대원 성명 입력"
          autoCorrect={false}
          style={{ flex: 3 }}
        />
      </View>
      <Pressable
        accessibilityRole="button"
        disabled={!ready || saving}
        style={{
          minHeight: 44,
          alignItems: "flex-end",
          justifyContent: "center",
          opacity: ready && !saving ? 1 : 0.4,
        }}
        onPress={async () => {
          setSaving(true);
          const next = {
            affiliation: sender.affiliation.trim(),
            rank: sender.rank.trim(),
            name: sender.name.trim(),
          };
          try {
            await AsyncStorage.multiSet([
              [AFFILIATION_KEY, next.affiliation],
              [PARAMEDIC_RANK_KEY, next.rank],
              [PARAMEDIC_NAME_KEY, next.name],
            ]);
            setSender(next);
            onSaved(next);
            alert("소속 설정", "저장했습니다.");
          } catch {
            alert("소속 설정", "저장하지 못했습니다. 다시 시도해 주세요.");
          } finally {
            setSaving(false);
          }
        }}
      >
        <Text
          style={{
            color: t.accent,
            fontFamily: "Pretendard-Medium",
            fontSize: 14,
          }}
        >
          {saving ? "저장 중" : "저장"}
        </Text>
      </Pressable>
    </View>
  );
}
