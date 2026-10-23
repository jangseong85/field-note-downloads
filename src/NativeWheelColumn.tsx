import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import WheelPicker, {
  RenderItemContainerProps,
  useScrollContentOffset,
  withVirtualized,
} from "@quidone/react-native-wheel-picker";
import { createWheelHold } from "./wheelMotion";
import { clinicalTheme } from "./clinicalTheme";
const VirtualizedWheelPicker = withVirtualized(WheelPicker);

// Keep the library's native-driven curved faces, adding our bounded hold gesture.
function WheelItem({
  info,
  start,
  stop,
}: {
  info: RenderItemContainerProps<{
    value: number;
    label: string;
    rowHeight: number;
  }>;
  start: (index: number) => void;
  stop: () => void;
}) {
  const offset = useScrollContentOffset();
  const suppressed = useRef(false);
  const { faces, index, renderItem, item, itemTextStyle } = info;
  // Our container receives the same row height as the picker.
  const height = item.rowHeight;
  const animatedStyle = useMemo(() => {
    const inputRange = faces.map((face) => height * (index + face.index));
    return {
      height,
      opacity: offset.interpolate({
        inputRange,
        outputRange: faces.map((face) => face.opacity),
        extrapolate: "clamp",
      }),
      transform: [
        {
          translateY: offset.interpolate({
            inputRange,
            outputRange: faces.map((face) => face.offsetY),
            extrapolate: "extend",
          }),
        },
        {
          rotateX: offset.interpolate({
            inputRange,
            outputRange: faces.map((face) => `${face.deg}deg`),
            extrapolate: "extend",
          }),
        },
        { perspective: 1000 },
      ],
    };
  }, [offset, faces, height, index]);
  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        accessible={false}
        delayLongPress={350}
        onPressIn={() => {
          suppressed.current = false;
        }}
        onLongPress={() => {
          suppressed.current = true;
          start(index);
        }}
        onPressOut={stop}
        onPress={() => {
          if (!suppressed.current && !info.readOnly)
            info.listRef.current?.scrollToIndex({ index, animated: true });
        }}
        style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
      >
        {renderItem({ item, index, itemTextStyle })}
      </Pressable>
    </Animated.View>
  );
}

function NativeWheelColumn({
  label,
  value,
  values,
  rowHeight,
  rows,
  isDark,
  onChange,
  onBusy,
  active,
}: {
  label: string;
  value: number;
  values: number[];
  rowHeight: number;
  rows: number;
  isDark: boolean;
  onChange: (value: number) => void;
  onBusy: (busy: boolean) => void;
  active: boolean;
}) {
  const t = clinicalTheme(isDark);
  const latest = useRef({ values, value, active, onChange, onBusy });
  latest.current = { values, value, active, onChange, onBusy };
  const list = useRef<
    RenderItemContainerProps<{ value: number }>["listRef"] | null
  >(null);
  const currentIndex = useRef(values.indexOf(value));
  const held = useRef(false);
  const hold = useRef(
    createWheelHold(
      (direction) => {
        const p = latest.current;
        if (!p.active) return false;
        const next = Math.max(
          0,
          Math.min(p.values.length - 1, currentIndex.current + direction),
        );
        if (next === currentIndex.current) return false;
        currentIndex.current = next;
        list.current?.current?.scrollToIndex({ index: next, animated: false });
        p.onChange(p.values[next]!);
        return true;
      },
      (running) => {
        held.current = running;
        latest.current.onBusy(running);
      },
    ),
  ).current;
  useEffect(() => {
    currentIndex.current = Math.max(0, latest.current.values.indexOf(value));
  }, [value, values.length]);
  useEffect(() => {
    if (!active) hold.stop();
  }, [active, hold]);
  useEffect(
    () => () => {
      hold.stop();
      latest.current.onBusy(false);
    },
    [hold],
  );
  const data = useMemo(
    () =>
      values.map((n) => ({
        value: n,
        label: label === "년" ? String(n) : String(n).padStart(2, "0"),
        rowHeight,
      })),
    [values, label, rowHeight],
  );
  const startHold = useCallback(
    (index: number) => {
      if (latest.current.active && index !== currentIndex.current)
        hold.start(index < currentIndex.current ? -1 : 1);
    },
    [hold],
  );
  const stopHold = useCallback(() => hold.stop(), [hold]);
  const renderContainer = useCallback(
    (
      info: RenderItemContainerProps<{
        value: number;
        label: string;
        rowHeight: number;
      }>,
    ) => {
      list.current = info.listRef;
      return (
        <WheelItem
          key={info.key}
          info={info}
          start={startHold}
          stop={stopHold}
        />
      );
    },
    [startHold, stopHold],
  );
  const Picker = values.length > 100 ? VirtualizedWheelPicker : WheelPicker;
  return (
    <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
      <Text
        style={{
          color: t.muted,
          fontSize: 13,
          textAlign: "center",
          fontFamily: "Pretendard-Medium",
        }}
      >
        {label}
      </Text>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{
          min: values[0],
          max: values[values.length - 1],
          now: value,
          text: String(value),
        }}
        accessibilityActions={[
          { name: "increment", label: "다음 값" },
          { name: "decrement", label: "이전 값" },
        ]}
        onAccessibilityAction={(event) => {
          const step =
            event.nativeEvent.actionName === "increment"
              ? 1
              : event.nativeEvent.actionName === "decrement"
                ? -1
                : 0;
          if (active && step)
            onChange(
              values[
                Math.max(
                  0,
                  Math.min(values.length - 1, values.indexOf(value) + step),
                )
              ]!,
            );
        }}
      >
        <Picker
          data={data}
          value={value}
          width="100%"
          itemHeight={rowHeight}
          visibleItemCount={rows}
          readOnly={!active}
          disableIntervalMomentum={false}
          initialNumToRender={15}
          maxToRenderPerBatch={12}
          windowSize={7}
          itemTextStyle={{
            fontFamily: "Pretendard-Medium",
            fontSize: 24,
            color: t.ink,
            fontVariant: ["tabular-nums"],
          }}
          overlayItemStyle={{
            backgroundColor: t.ink,
            borderRadius: 12,
            opacity: 0.06,
          }}
          _onScrollStart={() => {
            if (active) onBusy(true);
          }}
          _onScrollEnd={() => {
            if (!held.current) onBusy(false);
          }}
          onValueChanging={({ index }) => {
            if (!held.current) currentIndex.current = index;
          }}
          onValueChanged={({ item }) => {
            if (latest.current.active && !held.current) onChange(item.value);
          }}
          renderItemContainer={renderContainer}
        />
      </View>
    </View>
  );
}
export default React.memo(NativeWheelColumn);
