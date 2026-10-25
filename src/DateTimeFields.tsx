import React, { useEffect, useState } from "react";
import {
  AppState,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  formatDate,
  dateDigits,
  timeDigits,
  formatTime,
  koreanNowParts,
  relativeOnset,
  relativeOnsetMedical,
  validTime,
  weekdayForDate,
} from "./dateTime";
import { ClinicalField, ClinicalInput } from "./ClinicalControls";
import DateTimeWheelPicker from "./DateTimeWheelPicker";
import { clinicalTheme } from "./clinicalTheme";

export default function DateTimeFields({
  title,
  date,
  time,
  isDark,
  onChange,
  onFocus,
  showElapsed = false,
  medical = false,
  useWheelPicker = true,
}: {
  title: string;
  date: string;
  time: string;
  isDark: boolean;
  onChange: (date: string, time: string) => void;
  onFocus?: () => void;
  showElapsed?: boolean;
  medical?: boolean;
  useWheelPicker?: boolean;
}) {
  const [picker, setPicker] = useState<"date" | "time" | null>(null);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!showElapsed) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 30000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") setNow(Date.now());
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [showElapsed, date, time]);
  const relative = showElapsed ? relativeOnset(date, time, now) : null;
  const elapsed = relative && medical ? relativeOnsetMedical(relative) : relative;
  const openPicker = (mode: "date" | "time") => {
    onFocus?.();
    setPicker(mode);
  };
  const { width, fontScale } = useWindowDimensions();
  const stacked = width < 390 || fontScale > 1.15;
  const t = clinicalTheme(isDark);
  const weekday = weekdayForDate(date);
  const invalidDate = date.length === 8 && !weekday;
  const invalidTime = time.length === 4 && !validTime(time);
  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <Text style={[styles.title, { color: t.muted }]}>{title}</Text>
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={title + " 날짜와 시간 초기화"}
            disabled={!date && !time}
            style={styles.now}
            onPress={() => {
              setPicker(null);
              onChange("", "");
            }}
          >
            <Text
              style={[
                styles.nowText,
                { color: t.muted, opacity: date || time ? 1 : 0.4 },
              ]}
            >
              초기화
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={title + " 현재 날짜와 시간 입력"}
            style={styles.now}
            onPress={() => {
              const now = koreanNowParts();
              onChange(now.date, now.time);
            }}
          >
            <Ionicons name="time-outline" size={18} color={t.accent} />
            <Text style={[styles.nowText, { color: t.accent }]}>현재</Text>
          </Pressable>
        </View>
      </View>
      {useWheelPicker ? (
        <View style={[styles.fields, stacked && styles.stacked]}>
          <View style={styles.dateColumn}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={title + " 날짜 선택"}
              accessibilityValue={{
                text: date ? `${formatDate(date)} ${weekday ?? ""}` : "미입력",
              }}
              onPress={() => openPicker("date")}
            >
              <ClinicalField
                isDark={isDark}
                invalid={invalidDate}
                style={styles.dateEntry}
              >
                <Text
                  style={[
                    styles.value,
                    styles.dateInput,
                    { color: date ? t.ink : t.placeholder },
                  ]}
                >
                  {date ? formatDate(date).replace(/ /g, "") : "YYYY.MM.DD"}
                </Text>
                <Text
                  accessibilityLiveRegion="polite"
                  style={[
                    styles.weekday,
                    { color: t.ink, borderLeftColor: t.border },
                  ]}
                >
                  {weekday ?? "요일"}
                </Text>
              </ClinicalField>
            </Pressable>
          </View>
          <View style={[styles.timeColumn, stacked && styles.fullWidth]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={title + " 시간 선택"}
              accessibilityValue={{ text: time ? formatTime(time) : "미입력" }}
              onPress={() => openPicker("time")}
            >
              <ClinicalField isDark={isDark} invalid={invalidTime}>
                <Text
                  style={[
                    styles.value,
                    styles.timeInput,
                    { color: time ? t.ink : t.placeholder },
                  ]}
                >
                  {time ? formatTime(time) : "HH:MM"}
                </Text>
              </ClinicalField>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={[styles.fields, stacked && styles.stacked]}>
          <ClinicalField
            isDark={isDark}
            invalid={invalidDate}
            style={[styles.dateColumn, styles.dateEntry]}
          >
            <ClinicalInput
              isDark={isDark}
              embedded
              value={formatDate(date).replace(/ /g, "")}
              onChangeText={(value) => onChange(dateDigits(value), time)}
              onFocus={onFocus}
              placeholder="YYYY.MM.DD"
              accessibilityLabel={title + " 날짜 직접 입력"}
              keyboardType="number-pad"
              style={[styles.value, styles.dateInput]}
            />
            <Text
              style={[
                styles.weekday,
                { color: t.ink, borderLeftColor: t.border },
              ]}
            >
              {weekday ?? "요일"}
            </Text>
          </ClinicalField>
          <ClinicalField
            isDark={isDark}
            invalid={invalidTime}
            style={[styles.timeColumn, stacked && styles.fullWidth]}
          >
            <ClinicalInput
              isDark={isDark}
              embedded
              value={formatTime(time)}
              onChangeText={(value) => onChange(date, timeDigits(value))}
              onFocus={onFocus}
              placeholder="HH:MM"
              accessibilityLabel={title + " 시간 직접 입력"}
              keyboardType="number-pad"
              style={[styles.value, styles.timeInput]}
            />
          </ClinicalField>
        </View>
      )}
      {elapsed && (
        <Text style={[styles.elapsed, { color: t.muted }]}>{elapsed}</Text>
      )}
      {(invalidDate || invalidTime) && (
        <Text
          accessibilityRole="alert"
          style={[styles.error, { color: t.danger }]}
        >
          {invalidDate
            ? "날짜를 확인해 주세요."
            : "시간은 00:00~23:59로 입력해 주세요."}
        </Text>
      )}
      <DateTimeWheelPicker
        visible={picker !== null}
        title={title}
        date={date}
        time={time}
        initialMode={picker ?? "date"}
        isDark={isDark}
        onCancel={() => setPicker(null)}
        onApply={(d, t) => {
          onChange(d, t);
          setPicker(null);
        }}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  section: { gap: 8, marginBottom: 14 },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { fontFamily: "Pretendard-Medium", fontSize: 13 },
  actions: { flexDirection: "row", alignItems: "center", gap: 12 },
  elapsed: {
    fontFamily: "Pretendard-Regular",
    fontSize: 13,
    fontVariant: ["tabular-nums"],
    paddingHorizontal: 2,
  },
  fields: { flexDirection: "row", gap: 10 },
  stacked: { flexDirection: "column" },
  dateColumn: { flex: 1, minWidth: 0 },
  timeColumn: { width: 84 },
  fullWidth: { width: "100%" },
  dateEntry: { flexDirection: "row", alignItems: "center" },
  dateInput: { flex: 1, paddingHorizontal: 12 },
  value: {
    fontFamily: "Pretendard-Regular",
    fontSize: 16,
    includeFontPadding: false,
    fontVariant: ["tabular-nums"],
  },
  weekday: {
    paddingHorizontal: 8,
    borderLeftWidth: 1,
    fontFamily: "Pretendard-Regular",
    fontSize: 16,
  },
  timeInput: { textAlign: "center", paddingHorizontal: 6, paddingVertical: 16 },
  now: {
    minHeight: 44,
    paddingHorizontal: 4,
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
  },
  nowText: { fontFamily: "Pretendard-Medium", fontSize: 13 },
  error: { fontSize: 12, fontFamily: "Pretendard-Regular" },
});
