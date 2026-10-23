import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  LayoutChangeEvent,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";
import { clinicalMetrics as m, clinicalTheme } from "./clinicalTheme";
import { horizontalControlDrag, nearestSegment } from "./controlGestures";

export const RUBBER_SEGMENT_CONFIG = {
  size: "medium",
  trackColor: "#27272a",
  thumbColor: "#fafafa",
  textColor: "#fafafa",
  activeTextColor: "#18181b",
  radius: 10,
  inset: 3,
  equalSlots: true,
  stretch: 100,
  squash: 3,
  speed: 1,
  glide: 75,
  draggable: true,
} as const;
const segment = RUBBER_SEGMENT_CONFIG;
// iOS 26 segmented controls are capsules; Android keeps the reference radius.
const SEGMENT_RADIUS = Platform.OS === "ios" ? 999 : segment.radius;
const SEGMENT_INNER_RADIUS = Platform.OS === "ios" ? 999 : segment.radius - segment.inset;
export const rubberSegmentColors = (isDark: boolean) =>
  isDark
    ? {
        trackColor: "#27272a",
        thumbColor: "#fafafa",
        textColor: "#fafafa",
        activeTextColor: "#18181b",
      }
    : {
        trackColor: "#e9e9ec",
        thumbColor: "#18181b",
        textColor: "#3f3f46",
        activeTextColor: "#fafafa",
      };

export function ClinicalField({
  isDark,
  focused = false,
  invalid = false,
  children,
  style,
}: {
  isDark: boolean;
  focused?: boolean;
  invalid?: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const t = clinicalTheme(isDark);
  return (
    <View
      style={[
        styles.field,
        {
          backgroundColor: t.field,
          borderColor: invalid ? t.danger : focused ? t.accent : "transparent",
          borderWidth: 1,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
export function ClinicalInput({
  isDark,
  embedded = false,
  style,
  onFocus,
  onBlur,
  ...props
}: TextInputProps & { isDark: boolean; embedded?: boolean }) {
  const t = clinicalTheme(isDark);
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      {...props}
      underlineColorAndroid="transparent"
      placeholderTextColor={t.placeholder}
      selectionColor={t.accent}
      cursorColor={t.accent}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      style={[
        styles.input,
        !embedded && styles.field,
        {
          color: t.ink,
          backgroundColor: embedded ? "transparent" : t.field,
          borderColor: focused ? t.accent : "transparent",
          borderWidth: embedded ? 0 : 1,
        },
        embedded && { borderWidth: 0, minHeight: m.fieldHeight - 2 },
        style,
      ]}
    />
  );
}
export function RecordTabs({
  isDark,
  options,
  selectedId,
  onSelect,
  disabled = false,
  label,
  selectionRole = "tab",
}: {
  isDark: boolean;
  options: { id: string; label: string }[];
  selectedId: string;
  onSelect: (id: string) => void;
  disabled?: boolean;
  label: string;
  selectionRole?: "tab" | "radio";
}) {
  const [reduceMotion, setReduceMotion] = useState(true);
  const colors = rubberSegmentColors(isDark);
  const [slots, setSlots] = useState<
    Record<string, { x: number; width: number }>
  >({});
  const [viewportWidth, setViewportWidth] = useState(0);
  const slotWidth = Math.max(
    64,
    (viewportWidth - segment.inset * 2) / Math.max(1, options.length),
  );
  const overflow = viewportWidth > 0 && slotWidth * options.length + segment.inset * 2 > viewportWidth + 1;
  const scroll = useRef<ScrollView>(null);
  const root = useRef<View>(null);
  const pageX = useRef<number | null>(null);
  const scrollOffset = useRef(0);
  const [dragging, setDragging] = useState(false);
  const dragged = useRef(false);
  const previousId = useRef<string | null>(null);
  const left = useRef(new Animated.Value(0)).current;
  const right = useRef(new Animated.Value(0)).current;
  const slot = options.some((option) => option.id === selectedId)
    ? slots[selectedId]
    : undefined;
  const latest = useRef({
    options,
    slots,
    selectedId,
    disabled,
    viewportWidth,
    slot,
    reduceMotion,
    overflow,
  });
  latest.current = {
    options,
    slots,
    selectedId,
    disabled,
    viewportWidth,
    slot,
    reduceMotion,
    overflow,
  };
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  const pan = useRef({
    active: false,
    selectedId: "",
    anchor: 0,
    center: 0,
    width: 0,
  });
  const restore = () => {
    const current = latest.current.slot;
    if (!current) return;
    if (latest.current.reduceMotion) {
      left.setValue(current.x);
      right.setValue(current.x + current.width);
      return;
    }
    Animated.parallel([
      Animated.spring(left, {
        toValue: current.x,
        stiffness: 350,
        damping: 30,
        useNativeDriver: false,
      }),
      Animated.spring(right, {
        toValue: current.x + current.width,
        stiffness: 350,
        damping: 30,
        useNativeDriver: false,
      }),
    ]).start();
  };
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: event => {
        const p = latest.current;
        if (!p.overflow || p.disabled || !p.slot || pageX.current === null) return false;
        const start = event.nativeEvent.pageX - pageX.current + scrollOffset.current;
        return start >= p.slot.x && start <= p.slot.x + p.slot.width;
      },
      onMoveShouldSetPanResponderCapture: (_, gesture) => {
        const p = latest.current;
        if (
          p.disabled ||
          !p.options.some((option) => p.slots[option.id]) ||
          pageX.current === null ||
          !horizontalControlDrag(gesture.dx, gesture.dy)
        )
          return false;
        const touchStart = gesture.x0 || gesture.moveX - gesture.dx;
        const start = touchStart - pageX.current + scrollOffset.current;
        const contentWidth =
          Math.max(
            ...p.options.map((option) => {
              const measured = p.slots[option.id];
              return measured ? measured.x + measured.width : 0;
            }),
          ) + segment.inset;
        // Overflow rails still scroll normally unless the drag starts on the selected tab.
        return (
          contentWidth <= p.viewportWidth + 1 ||
          (!!p.slot && start >= p.slot.x && start <= p.slot.x + p.slot.width)
        );
      },
      onPanResponderGrant: (_, gesture) => {
        const p = latest.current;
        if (p.disabled || pageX.current === null) return;
        const start = gesture.x0 - pageX.current + scrollOffset.current;
        const nearest = nearestSegment(
          p.options.map((option) => option.id),
          p.slots,
          start,
        );
        const origin = p.slot ?? (nearest ? p.slots[nearest] : undefined);
        if (!origin) return;
        pan.current = {
          active: true,
          selectedId: p.selectedId,
          anchor:
            start >= origin.x && start <= origin.x + origin.width
              ? start - origin.x
              : origin.width / 2,
          center: origin.x + origin.width / 2,
          width: origin.width,
        };
        dragged.current = true;
        left.stopAnimation();
        right.stopAnimation();
        left.setValue(origin.x);
        right.setValue(origin.x + origin.width);
        setDragging(true);
      },
      onPanResponderMove: (_, gesture) => {
        const p = latest.current;
        if (
          pan.current.active &&
          Math.abs(gesture.dy) > 12 &&
          Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.3
        ) {
          pan.current.active = false;
          setDragging(false);
          restore();
          return;
        }
        if (
          !pan.current.active ||
          p.disabled ||
          p.selectedId !== pan.current.selectedId ||
          pageX.current === null
        )
          return;
        const measured = p.options
          .map((option) => p.slots[option.id])
          .filter(Boolean);
        const min = Math.min(...measured.map((s) => s!.x));
        const max =
          Math.max(...measured.map((s) => s!.x + s!.width)) - pan.current.width;
        const position = Math.max(
          min,
          Math.min(
            max,
            gesture.moveX -
              pageX.current +
              scrollOffset.current -
              pan.current.anchor,
          ),
        );
        left.setValue(position);
        right.setValue(position + pan.current.width);
        pan.current.center = position + pan.current.width / 2;
      },
      onPanResponderRelease: () => {
        const p = latest.current;
        const valid =
          pan.current.active &&
          !p.disabled &&
          p.selectedId === pan.current.selectedId;
        const id = valid
          ? nearestSegment(
              p.options.map((option) => option.id),
              p.slots,
              pan.current.center,
            )
          : null;
        pan.current.active = false;
        setDragging(false);
        restore();
        if (id && id !== p.selectedId) selectRef.current(id);
      },
      onPanResponderTerminate: () => {
        pan.current.active = false;
        setDragging(false);
        restore();
      },
      onPanResponderTerminationRequest: () => !pan.current.active,
    }),
  ).current;
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduceMotion(enabled);
      })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);
  useEffect(() => {
    if (!slot) return;
    const targetLeft = slot.x,
      targetRight = slot.x + slot.width;
    const changed =
      previousId.current !== null && previousId.current !== selectedId;
    previousId.current = selectedId;
    left.stopAnimation();
    right.stopAnimation();
    if (!changed || reduceMotion) {
      left.setValue(targetLeft);
      right.setValue(targetRight);
      return;
    }
    // React Bits Rubber Segment: the leading edge travels first, the trailing
    // edge catches up after either a tap or a committed drag.
    let cancelled = false;
    let transition: Animated.CompositeAnimation | undefined;
    left.stopAnimation((currentLeft) =>
      right.stopAnimation((currentRight) => {
        if (cancelled) return;
        const towardRight =
          (targetLeft + targetRight) / 2 >= (currentLeft + currentRight) / 2;
        const lead = towardRight ? right : left,
          trail = towardRight ? left : right;
        const gain = segment.stretch / 100,
          direction = towardRight ? 1 : -1;
        const trailTarget = towardRight ? targetLeft : targetRight;
        transition = Animated.sequence([
          Animated.parallel([
            Animated.timing(left, {
              toValue:
                targetLeft +
                (Math.min(currentLeft, targetLeft) - targetLeft) * gain,
              duration: 190 / segment.speed,
              useNativeDriver: false,
            }),
            Animated.timing(right, {
              toValue:
                targetRight +
                (Math.max(currentRight, targetRight) - targetRight) * gain,
              duration: 190 / segment.speed,
              useNativeDriver: false,
            }),
          ]),
          Animated.parallel([
            Animated.timing(lead, {
              toValue: towardRight ? targetRight : targetLeft,
              duration: 300 / segment.speed,
              useNativeDriver: false,
            }),
            Animated.sequence([
              Animated.timing(trail, {
                toValue: trailTarget + direction * segment.squash,
                duration: 300 / segment.speed,
                useNativeDriver: false,
              }),
              Animated.spring(trail, {
                toValue: trailTarget,
                stiffness: 350,
                damping: 30,
                mass: 0.7,
                useNativeDriver: false,
              }),
            ]),
          ]),
        ]);
        transition.start();
      }),
    );
    return () => {
      cancelled = true;
      transition?.stop();
    };
  }, [selectedId, slot, reduceMotion, left, right]);
  useEffect(() => {
    if (slot && viewportWidth > 0)
      scroll.current?.scrollTo({
        x: Math.max(0, slot.x + slot.width / 2 - viewportWidth / 2),
        animated: !reduceMotion,
      });
  }, [selectedId, slot, viewportWidth, reduceMotion]);
  function measure(id: string, event: LayoutChangeEvent) {
    const { x, width } = event.nativeEvent.layout;
    setSlots((previous) =>
      previous[id]?.x === x && previous[id]?.width === width
        ? previous
        : { ...previous, [id]: { x, width } },
    );
  }
  return (
    <View
      ref={root}
      collapsable={false}
      {...responder.panHandlers}
      onLayout={() =>
        root.current?.measureInWindow((x) => {
          pageX.current = x;
        })
      }
      style={styles.tabTrack}
    >
      <ScrollView
        ref={scroll}
        horizontal
        scrollEnabled={overflow}
        scrollEventThrottle={16}
        onScroll={(event) => {
          scrollOffset.current = event.nativeEvent.contentOffset.x;
        }}
        onLayout={(event) => setViewportWidth(event.nativeEvent.layout.width)}
        onTouchStart={() => {
          dragged.current = false;
        }}
        onScrollBeginDrag={() => {
          dragged.current = true;
        }}
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.tabScroll}
        accessibilityLabel={label}
      >
        <View style={styles.tabs}>
          <View
            pointerEvents="none"
            style={[
              styles.segmentTrack,
              { backgroundColor: colors.trackColor },
            ]}
          />
          {options.map((option) => (
            <RecordTab
              key={option.id}
              option={option}
              selected={option.id === selectedId}
              disabled={disabled}
              reduceMotion={reduceMotion}
              isDark={isDark}
              selectionRole={selectionRole}
              width={slotWidth}
              onLayout={(event) => measure(option.id, event)}
              onSelect={(id) => {
                if (!disabled && !dragged.current) onSelect(id);
              }}
            />
          ))}
          {(slot || dragging) && (
            <Animated.View
              pointerEvents="none"
              accessible={false}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[
                styles.segmentThumb,
                {
                  left,
                  width: Animated.subtract(right, left),
                  backgroundColor: colors.thumbColor,
                },
              ]}
            >
              <Animated.View
                style={[
                  styles.segmentCopies,
                  {
                    width: slotWidth * options.length + segment.inset * 2,
                    transform: [{ translateX: Animated.multiply(left, -1) }],
                  },
                ]}
              >
                {options.map((option) => (
                  <View
                    key={option.id}
                    style={[styles.segmentCopy, { width: slotWidth }]}
                  >
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.tabText,
                        {
                          color: colors.activeTextColor,
                          fontFamily: "Pretendard-SemiBold",
                        },
                      ]}
                    >
                      {option.label}
                    </Text>
                  </View>
                ))}
              </Animated.View>
            </Animated.View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function RecordTab({
  option,
  selected,
  disabled,
  reduceMotion,
  isDark,
  onSelect,
  onLayout,
  selectionRole,
  width,
}: {
  option: { id: string; label: string };
  selected: boolean;
  disabled: boolean;
  reduceMotion: boolean;
  isDark: boolean;
  onSelect: (id: string) => void;
  onLayout: (event: LayoutChangeEvent) => void;
  selectionRole: "tab" | "radio";
  width: number;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (disabled || reduceMotion) {
      scale.stopAnimation();
      scale.setValue(1);
    }
    return () => scale.stopAnimation();
  }, [disabled, reduceMotion, scale]);
  function press(down: boolean) {
    scale.stopAnimation();
    if (reduceMotion) {
      scale.setValue(1);
      return;
    }
    Animated.spring(scale, {
      toValue: down ? 0.96 : 1,
      speed: 28,
      bounciness: 3,
      useNativeDriver: true,
    }).start();
  }
  return (
    <Pressable
      onLayout={onLayout}
      disabled={disabled}
      accessibilityRole={selectionRole}
      accessibilityLabel={option.label}
      accessibilityState={
        selectionRole === "radio"
          ? { checked: selected, disabled }
          : { selected, disabled }
      }
      onPressIn={() => press(true)}
      onPressOut={() => press(false)}
      onPress={() => onSelect(option.id)}
      style={({ pressed }) => [
        styles.tabHit,
        { width, opacity: disabled ? 0.5 : pressed ? 0.75 : 1 },
      ]}
    >
      <Animated.View style={[styles.tab, { transform: [{ scale }] }]}>
        <Text
          numberOfLines={1}
          style={[
            styles.tabText,
            {
              color: rubberSegmentColors(isDark).textColor,
              fontFamily: "Pretendard-SemiBold",
            },
          ]}
        >
          {option.label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  field: {
    minHeight: m.fieldHeight,
    borderRadius: m.radius,
    borderWidth: 1,
    overflow: "hidden",
  },
  input: {
    minWidth: 0,
    minHeight: m.fieldHeight,
    paddingHorizontal: m.padding,
    paddingVertical: 12,
    fontFamily: "Pretendard-Regular",
    fontSize: m.fontSize,
    includeFontPadding: false,
    fontVariant: ["tabular-nums"],
  },
  tabTrack: { minWidth: 0 },
  tabScroll: { flexGrow: 1 },
  tabs: {
    flexDirection: "row",
    flexGrow: 1,
    alignItems: "center",
    gap: 0,
    paddingHorizontal: segment.inset,
    borderRadius: SEGMENT_RADIUS,
    overflow: "hidden",
  },
  segmentThumb: {
    position: "absolute",
    top: 4,
    bottom: 4,
    borderRadius: SEGMENT_INNER_RADIUS,
    overflow: "hidden",
  },
  segmentCopies: {
    position: "absolute",
    top: -4,
    flexDirection: "row",
    paddingHorizontal: segment.inset,
  },
  segmentCopy: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  segmentTrack: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 1,
    bottom: 1,
    backgroundColor: segment.trackColor,
    borderRadius: SEGMENT_RADIUS,
  },
  tabHit: { minHeight: m.touchHeight },
  tab: {
    minHeight: m.touchHeight,
    minWidth: 64,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: SEGMENT_INNER_RADIUS,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
  },
  tabText: { fontSize: 13 },
});
