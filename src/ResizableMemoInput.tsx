import React, { useRef, useState } from "react";
import { PanResponder, StyleSheet, TextInputProps, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ClinicalField, ClinicalInput } from "./ClinicalControls";
import { clinicalTheme } from "./clinicalTheme";

export default function ResizableMemoInput({
  isDark,
  ...props
}: TextInputProps & { isDark: boolean }) {
  const [height, setHeight] = useState(120);
  const [focused, setFocused] = useState(false);
  const t = clinicalTheme(isDark);
  const heightRef = useRef(height);
  const startHeight = useRef(height);
  const changeHeight = (next: number) => {
    heightRef.current = Math.max(104, Math.min(600, next));
    setHeight(heightRef.current);
  };
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startHeight.current = heightRef.current;
      },
      onPanResponderMove: (_, gesture) =>
        changeHeight(startHeight.current + gesture.dy),
      onPanResponderTerminationRequest: () => false,
    }),
  ).current;
  return (
    <ClinicalField
      isDark={isDark}
      focused={focused}
      style={[styles.editor, { height }]}
    >
      <ClinicalInput
        {...props}
        isDark={isDark}
        embedded
        onFocus={(event) => {
          setFocused(true);
          props.onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          props.onBlur?.(event);
        }}
        multiline
        textAlignVertical="top"
        style={[styles.input, { height: height - 2 }]}
      />
      <View
        {...pan.panHandlers}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="입력창 높이 조절"
        accessibilityHint="오른쪽 아래 모서리를 위아래로 끌어 조절합니다"
        accessibilityActions={[
          { name: "increment", label: "입력창 늘리기" },
          { name: "decrement", label: "입력창 줄이기" },
        ]}
        onAccessibilityAction={(event) =>
          changeHeight(
            heightRef.current +
              (event.nativeEvent.actionName === "increment" ? 48 : -48),
          )
        }
        style={styles.handle}
      >
        <Ionicons name="resize-outline" size={17} color={t.muted} />
      </View>
    </ClinicalField>
  );
}
const styles = StyleSheet.create({
  editor: {
    position: "relative",
    overflow: "hidden",
  },
  input: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 34,
    fontSize: 16,
    lineHeight: 25,
    fontFamily: "Pretendard-Regular",
    includeFontPadding: false,
  },
  handle: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 44,
    height: 44,
    alignItems: "flex-end",
    justifyContent: "flex-end",
    padding: 7,
  },
});
