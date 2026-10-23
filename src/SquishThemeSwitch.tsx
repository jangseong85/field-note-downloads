// Native interpretation of the React Bits Squish Switch interaction (not its web source).
// Reference: https://reactbits.dev/micro/squish-switch
import React, { useEffect, useRef, useState } from "react";
import { horizontalControlDrag, switchGestureValue } from "./controlGestures";
import {
  AccessibilityInfo,
  Animated,
  PanResponder,
  StyleSheet,
  View,
} from "react-native";
export const SQUISH_SWITCH_CONFIG = {
  trackColor: "#27272a",
  trackOnColor: "#f5f5f5",
  thumbColor: "#4e4e51",
  thumbOnColor: "#27272a",
  width: 53.2,
  height: 26.6,
  radius: 13.3,
  speed: 50,
  stretch: 36,
  hoverScale: 1.035,
  colorDuration: 320,
} as const;
const config = SQUISH_SWITCH_CONFIG;
// Colour and transform share the thumb view: keep their entire graph JS-driven.
// Mixing drivers on that view promotes colour nodes to native and crashes on mount.
const INSET = Math.max(3, Math.round(config.height * 0.11));
const THUMB = config.height - INSET * 2;
const TRAVEL = config.width - INSET * 2 - THUMB;
const stretchForVelocity = (pointsPerSecond: number) =>
  1 + (Math.min(0.4, Math.abs(pointsPerSecond) / 600) * config.stretch) / 100;
export default function SquishThemeSwitch({
  checked,
  onChange,
  disabled = false,
  accessibilityLabel = "다크 모드",
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const [reduceMotion, setReduceMotion] = useState(true);
  const x = useRef(new Animated.Value(checked ? TRAVEL : 0)).current;
  const stretch = useRef(new Animated.Value(1)).current;
  const hover = useRef(new Animated.Value(1)).current;
  const color = useRef(new Animated.Value(checked ? 1 : 0)).current;
  const refs = useRef({
    checked,
    disabled,
    reduceMotion,
    onChange,
    down: checked,
    start: checked ? TRAVEL : 0,
    dragging: false,
    vertical: false,
  });
  Object.assign(refs.current, { checked, disabled, reduceMotion, onChange });
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted) setReduceMotion(value);
      })
      .catch(() => {});
    const listener = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );
    return () => {
      mounted = false;
      listener.remove();
    };
  }, []);
  function settle(next: boolean) {
    x.stopAnimation();
    stretch.stopAnimation();
    if (refs.current.reduceMotion) {
      x.setValue(next ? TRAVEL : 0);
      stretch.setValue(1);
      return;
    }
    Animated.parallel([
      Animated.spring(x, {
        toValue: next ? TRAVEL : 0,
        stiffness: 170 - (50 - config.speed) * 1.1,
        damping: 21.5,
        mass: 0.9,
        useNativeDriver: false,
      }),
      Animated.sequence([
        Animated.timing(stretch, {
          toValue: stretchForVelocity(TRAVEL / 0.18),
          duration: 80,
          useNativeDriver: false,
        }),
        Animated.spring(stretch, {
          toValue: 1,
          stiffness: 350,
          damping: 23,
          useNativeDriver: false,
        }),
      ]),
    ]).start();
  }
  // The controlled value is authoritative, including changes from another switch.
  useEffect(() => {
    if (!refs.current.dragging) settle(checked);
    return () => {
      x.stopAnimation();
      stretch.stopAnimation();
    };
    // settle uses current props through refs; animated values remain stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checked, reduceMotion, disabled, x, stretch]);
  useEffect(() => {
    const transition = Animated.timing(color, {
      toValue: checked ? 1 : 0,
      duration: reduceMotion ? 0 : config.colorDuration,
      useNativeDriver: false,
    });
    transition.start();
    return () => transition.stop();
  }, [checked, color, reduceMotion]);
  useEffect(() => {
    if (disabled || reduceMotion) {
      hover.stopAnimation();
      hover.setValue(1);
    }
    return () => hover.stopAnimation();
  }, [disabled, reduceMotion, hover]);
  const hoverTo = (value: number) => {
    hover.stopAnimation();
    Animated.spring(hover, {
      toValue: value,
      stiffness: 450,
      damping: 30,
      useNativeDriver: false,
    }).start();
  };
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !refs.current.disabled,
      onMoveShouldSetPanResponder: (_, gesture) =>
        !refs.current.disabled && horizontalControlDrag(gesture.dx, gesture.dy),
      onPanResponderGrant: () => {
        refs.current.dragging = true;
        refs.current.down = refs.current.checked;
        refs.current.vertical = false;
        x.stopAnimation((value) => {
          refs.current.start = value;
        });
      },
      onPanResponderMove: (_, gesture) => {
        if (
          Math.abs(gesture.dy) >= 10 &&
          Math.abs(gesture.dy) > Math.abs(gesture.dx)
        )
          refs.current.vertical = true;
        if (
          refs.current.disabled ||
          refs.current.vertical ||
          (Math.abs(gesture.dy) > Math.abs(gesture.dx) &&
            Math.abs(gesture.dy) > 8)
        )
          return;
        x.setValue(
          Math.max(0, Math.min(TRAVEL, refs.current.start + gesture.dx)),
        );
        if (!refs.current.reduceMotion)
          stretch.setValue(stretchForVelocity(gesture.vx * 1000));
      },
      onPanResponderRelease: (_, gesture) => {
        refs.current.dragging = false;
        const next = switchGestureValue({
          checked: refs.current.checked,
          down: refs.current.down,
          start: refs.current.start,
          travel: TRAVEL,
          dx: gesture.dx,
          dy: gesture.dy,
          disabled: refs.current.disabled,
          vertical: refs.current.vertical,
        });
        settle(next);
        if (next !== refs.current.checked) refs.current.onChange(next);
      },
      onPanResponderTerminate: () => {
        refs.current.dragging = false;
        settle(refs.current.checked);
      },
      onPanResponderTerminationRequest: () => refs.current.vertical,
    }),
  ).current;
  const activate = () => {
    if (!disabled) onChange(!checked);
  };
  return (
    <View
      {...responder.panHandlers}
      hitSlop={{ top: 6, bottom: 6, left: 8, right: 8 }}
      accessible
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked, disabled }}
      accessibilityActions={[
        { name: "activate", label: `${accessibilityLabel} 전환` },
      ]}
      onAccessibilityTap={activate}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "activate") activate();
      }}
      style={[styles.touch, { opacity: disabled ? 0.45 : 1 }]}
      onPointerEnter={(event) => {
        if (
          event.nativeEvent.pointerType === "mouse" &&
          !disabled &&
          !reduceMotion
        )
          hoverTo(config.hoverScale);
      }}
      onPointerLeave={() => {
        if (!reduceMotion) hoverTo(1);
      }}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.track,
          {
            backgroundColor: color.interpolate({
              inputRange: [0, 1],
              outputRange: [config.trackColor, config.trackOnColor],
            }),
          },
        ]}
      >
        <Animated.View
          style={[styles.thumbPosition, { transform: [{ translateX: x }] }]}
        >
          <Animated.View
            style={[
              styles.thumb,
              {
                backgroundColor: color.interpolate({
                  inputRange: [0, 1],
                  outputRange: [config.thumbColor, config.thumbOnColor],
                }),
                transform: [
                  { scaleX: Animated.multiply(stretch, hover) },
                  { scaleY: Animated.divide(hover, stretch) },
                ],
              },
            ]}
          ></Animated.View>
        </Animated.View>
      </Animated.View>
    </View>
  );
}
const styles = StyleSheet.create({
  touch: {
    width: 88,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  track: {
    width: config.width,
    height: config.height,
    borderRadius: config.radius,
  },
  thumbPosition: { position: "absolute", left: INSET, top: INSET },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: config.radius - INSET,
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },
});
