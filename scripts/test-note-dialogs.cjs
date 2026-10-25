const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const test = require("node:test");
const read = name => fs.readFileSync(path.join(__dirname, "..", name), "utf8");
function harness(file, { os = "android" } = {}) {
  const refs = [];
  let cursor = 0, context;
  const React = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    createContext: () => ({}),
    useContext: () => context,
    useEffect: () => {},
    useMemo: fn => fn(),
    useCallback: fn => fn,
    useRef: value => { const index = cursor++; return refs[index] ??= { current: value }; },
    useState: value => { const i = cursor++; const slot = refs[i] ??= { state: typeof value === "function" ? value() : value }; return [slot.state, next => { slot.state = typeof next === "function" ? next(slot.state) : next; }]; },
  };
  class Value {
    constructor(value) { this.value = value; }
    setValue(value) { this.value = value; }
    stopAnimation(callback) { callback?.(this.value); }
    interpolate(config) { return { value: this.value, ...config }; }
  }
  const rn = {
    Animated: { Value, View: "AnimatedView", divide: () => 1, multiply: () => 1, subtract: () => 1,
      spring: () => ({ start() {} }), timing: () => ({ start() {} }),
      parallel: () => ({ start() {} }), sequence: () => ({ start() {} }) },
    PanResponder: { create: handlers => ({ panHandlers: handlers }) },
    StyleSheet: { create: value => value },
    View: "View", Modal: "Modal", Pressable: "Pressable", ScrollView: "ScrollView", Text: "Text",
    Platform: { OS: os },
    AccessibilityInfo: { isReduceMotionEnabled: () => Promise.resolve(false) },
    Easing: { out: fn => fn, quad: x => x },
    useWindowDimensions: () => ({ width: 390, height: 844 }),
  };
  const result = { exports: {} };
  const compiled = ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
  new Function("require", "module", "exports", compiled)(name => {
    if (name === "react") return React;
    if (name === "react-native") return rn;
    if (name === "@expo/vector-icons") return { Ionicons: "Icon" };
    if (name === "./clinicalTheme") return { clinicalTheme: () => ({}), scrim: () => "rgba(0,0,0,0.4)", clinicalMetrics: { fieldHeight: 52, radius: 14, fontSize: 16, padding: 12, touchHeight: 44 } };
    if (name === "./NoteDialogs" && file !== "src/NoteDialogs.tsx") return { NoteModal: "Modal" };
    if (name === "./RecordAffiliation") return { __esModule: true, default: "Affiliation" };
    if (name === "./SquishThemeSwitch") return { __esModule: true, default: "Switch" };
    if (name === "./controlGestures") {
      const m = { exports: {} };
      new Function("module", "exports", ts.transpileModule(read("src/controlGestures.ts"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(m, m.exports);
      return m.exports;
    }
    throw Error(name);
  }, result, result.exports);
  return { exports: result.exports, render: (fn, props) => { cursor = 0; return fn(props); }, setContext: value => { context = value; } };
}
const gesture = (dx, dy = 0) => ({ dx, dy, vx: 0.8 });
test("field focus and validation change only border colour, never geometry", () => {
  const h = harness("src/ClinicalControls.tsx");
  const flatten = styles => Object.assign({}, ...styles.flat(Infinity).filter(Boolean));
  const normal = flatten(h.render(h.exports.ClinicalField, { isDark: false, children: null, style: { height: 120 } }).props.style);
  for (const state of [{ focused: true }, { invalid: true }, { focused: true, invalid: true }]) {
    const active = flatten(h.render(h.exports.ClinicalField, { isDark: false, children: null, style: { height: 120 }, ...state }).props.style);
    assert.equal(normal.borderWidth, 1); assert.equal(active.borderWidth, 1);
    delete normal.borderColor; delete active.borderColor;
    assert.deepEqual(active, normal);
  }
  assert.match(read("src/ClinicalControls.tsx"), /borderWidth: embedded \? 0 : 1/);
  assert.doesNotMatch(read("src/ClinicalControls.tsx"), /borderWidth: [^\n]*focused/);
  assert.match(read("src/ResizableMemoInput.tsx"), /height: height - 2/);
});
test("Rubber Segment uses theme colours, equal slots and draggable selection", () => {
  const h = harness("src/ClinicalControls.tsx");
  assert.deepEqual(h.exports.RUBBER_SEGMENT_CONFIG, {
    size: "medium", trackColor: "#27272a", thumbColor: "#fafafa", textColor: "#fafafa", activeTextColor: "#18181b",
    radius: 10, inset: 3, equalSlots: true, stretch: 100, squash: 3, speed: 1, glide: 75, draggable: true,
  });
  assert.match(read("src/ClinicalControls.tsx"), /segmentCopies/);
  const dark = h.exports.rubberSegmentColors(true);
  const light = h.exports.rubberSegmentColors(false);
  assert.equal(dark.thumbColor, light.activeTextColor);
  assert.equal(light.thumbColor, dark.activeTextColor);
  assert.notEqual(dark.trackColor, light.trackColor);
  assert.match(read("src/ClinicalControls.tsx"), /backgroundColor: colors.trackColor/);
  assert.match(read("src/ClinicalControls.tsx"), /backgroundColor: colors.thumbColor/);
  assert.match(read("src/ClinicalControls.tsx"), /color: colors.activeTextColor/);
});
test("Squish matches the requested reference configuration without forcing theme state", () => {
  const h = harness("src/SquishThemeSwitch.tsx");
  assert.deepEqual(h.exports.SQUISH_SWITCH_CONFIG, {
    trackColor: "#27272a", trackOnColor: "#f5f5f5", thumbColor: "#4e4e51", thumbOnColor: "#27272a",
    width: 53.2, height: 26.6, radius: 13.3, speed: 50, stretch: 36, hoverScale: 1.035, colorDuration: 320,
  });
  const source = read("src/SquishThemeSwitch.tsx");
  assert.match(source, /duration: reduceMotion \? 0 : config.colorDuration/);
  assert.match(source, /pointerType === "mouse"/);
  assert.match(source, /hoverTo\(config.hoverScale\)/);
  assert.match(source, /outputRange: \[palette.trackColor, palette.trackOnColor\]/);
});
test("Squish controlled switch commits one tap and responds to changed props", () => {
  const h = harness("src/SquishThemeSwitch.tsx"), changes = [];
  let view = h.render(h.exports.default, { checked: false, onChange: value => changes.push(value) });
  view.props.onPanResponderGrant(); view.props.onPanResponderRelease(null, gesture(0));
  assert.deepEqual(changes, [true]);
  view = h.render(h.exports.default, { checked: true, onChange: value => changes.push(value) });
  assert.equal(view.props.accessibilityState.checked, true);
  view.props.onPanResponderGrant(); view.props.onPanResponderRelease(null, gesture(0));
  assert.deepEqual(changes, [true, false]);
});
test("Squish drag commits only on release, cancel and vertical movement never toggle", () => {
  const h = harness("src/SquishThemeSwitch.tsx"), changes = [];
  const { props: p } = h.render(h.exports.default, { checked: false, onChange: value => changes.push(value) });
  p.onPanResponderGrant(); p.onPanResponderMove(null, gesture(30));
  assert.deepEqual(changes, []);
  p.onPanResponderRelease(null, gesture(30)); assert.deepEqual(changes, [true]);
  changes.length = 0;
  p.onPanResponderGrant(); p.onPanResponderMove(null, gesture(30)); p.onPanResponderTerminate();
  assert.deepEqual(changes, []);
  p.onPanResponderGrant(); p.onPanResponderRelease(null, gesture(1, 30)); assert.deepEqual(changes, []);
});
test("disabled switch ignores gestures and accessibility activation", () => {
  const h = harness("src/SquishThemeSwitch.tsx");
  const { props: p } = h.render(h.exports.default, { checked: false, disabled: true, onChange: () => assert.fail("disabled") });
  assert.equal(p.onStartShouldSetPanResponder(), false);
  p.onAccessibilityTap(); p.onAccessibilityAction({ nativeEvent: { actionName: "activate" } });
});
test("slightly diagonal switch taps are accepted; deliberate vertical scroll stays cancelled", () => {
  const h = harness("src/SquishThemeSwitch.tsx"), changes = [];
  const p = h.render(h.exports.default, { checked: false, onChange: value => changes.push(value) }).props;
  p.onPanResponderGrant();
  p.onPanResponderMove(null, gesture(2, 5));
  assert.equal(p.onPanResponderTerminationRequest(), false);
  p.onPanResponderRelease(null, gesture(2, 5));
  assert.deepEqual(changes, [true]);
  changes.length = 0;
  p.onPanResponderGrant(); p.onPanResponderMove(null, gesture(2, 25));
  assert.equal(p.onPanResponderTerminationRequest(), true);
  p.onPanResponderRelease(null, gesture(1, 2));
  assert.deepEqual(changes, []);
  assert.ok(p.hitSlop.top >= 6);
});
test("segment drag previews without changing records and commits exactly once on release", () => {
  const h = harness("src/ClinicalControls.tsx"), changes = [];
  const props = { isDark: true, options: [{ id: "a", label: "A" }, { id: "b", label: "B" }, { id: "c", label: "C" }], selectedId: "a", onSelect: id => changes.push(id), label: "환자" };
  let root = h.render(h.exports.RecordTabs, props);
  find(root, "ScrollView")[0].props.onLayout({ nativeEvent: { layout: { width: 300 } } });
  function all(node) { if (!node || typeof node !== "object") return []; if (Array.isArray(node)) return node.flatMap(all); return [node, ...all(node.props?.children)]; }
  all(root).filter(n => n.type?.name === "RecordTab").forEach((n, i) => n.props.onLayout({ nativeEvent: { layout: { x: 3 + i * 98, width: 98 } } }));
  root = h.render(h.exports.RecordTabs, props);
  root.props.ref.current = { measureInWindow: fn => fn(100) }; root.props.onLayout();
  const p = root.props;
  assert.equal(p.onMoveShouldSetPanResponderCapture(null, { dx: 2, dy: 20, x0: 150 }), false);
  assert.equal(p.onMoveShouldSetPanResponderCapture(null, { dx: 20, dy: 2, x0: 150 }), true);
  p.onPanResponderGrant(null, { x0: 150 }); p.onPanResponderMove(null, { moveX: 340 });
  assert.deepEqual(changes, []);
  p.onPanResponderRelease(); p.onPanResponderRelease();
  assert.deepEqual(changes, ["c"]);
  changes.length = 0;
  p.onPanResponderGrant(null, { x0: 150 }); p.onPanResponderMove(null, { moveX: 240 }); p.onPanResponderTerminate();
  assert.deepEqual(changes, []);
  const disabled = h.render(h.exports.RecordTabs, { ...props, disabled: true });
  assert.equal(disabled.props.onMoveShouldSetPanResponderCapture(null, { dx: 20, dy: 0, x0: 150 }), false);
  const empty = h.render(h.exports.RecordTabs, { ...props, selectedId: "", disabled: false });
  assert.equal(empty.props.onMoveShouldSetPanResponderCapture(null, { dx: 20, dy: 0, x0: 150 }), true);
  empty.props.onPanResponderGrant(null, { x0: 150 }); empty.props.onPanResponderMove(null, { moveX: 340 }); empty.props.onPanResponderRelease();
  assert.deepEqual(changes, ["c"]);
  changes.length = 0;
  empty.props.onPanResponderGrant(null, { x0: 150 }); empty.props.onPanResponderMove(null, { moveX: 240, dx: 20, dy: 40 }); empty.props.onPanResponderRelease();
  assert.deepEqual(changes, []);
  find(empty, "ScrollView")[0].props.onLayout({ nativeEvent: { layout: { width: 150 } } });
  const overflow = h.render(h.exports.RecordTabs, props);
  assert.equal(overflow.props.onMoveShouldSetPanResponderCapture(null, { dx: 20, dy: 0, x0: 250 }), false);
  assert.equal(overflow.props.onMoveShouldSetPanResponderCapture(null, { dx: 20, dy: 0, x0: 150 }), true);
  assert.equal(overflow.props.onMoveShouldSetPanResponderCapture(null, { dx: 20, dy: 0, x0: 0, moveX: 170 }), true);
  assert.equal(overflow.props.onMoveShouldSetPanResponderCapture(null, { dx: 20, dy: 0, x0: 0, moveX: 270 }), false);
});
function find(node, type) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(child => find(child, type));
  return [...(node.type === type ? [node] : []), ...find(node.props?.children, type)];
}
test("central confirmation never acts on show, back or backdrop; double presses act once", async () => {
  const h = harness("src/NoteDialogs.tsx"), calls = [];
  const current = { id: 1, title: "환자 삭제", buttons: [
    { text: "취소", style: "cancel", onPress: () => calls.push("cancel") },
    { text: "삭제", style: "destructive", onPress: () => calls.push("delete") },
  ] };
  h.setContext({ queue: [current], dismiss: id => calls.push(`dismiss:${id}`), alert() {} });
  const panel = props => h.render(h.exports.NoteAlertPanel, props).props.children[0];
  let modal = h.render(h.exports.NoteAlertPanel, { isDark: true });
  assert.equal(modal.type, "Modal");
  let dialog = modal.props.children[0];
  assert.equal(modal.props.onRequestClose, dialog.props.onClose);
  assert.deepEqual(calls, []);
  dialog.props.onClose(); dialog.props.onClose();
  assert.deepEqual(calls, ["dismiss:1", "cancel"]);
  calls.length = 0; current.id = 2;
  dialog = panel({ isDark: false });
  const destructive = find(dialog, "Pressable")[0];
  destructive.props.onPress(); destructive.props.onPress();
  await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(calls, ["dismiss:2", "delete"]);
});
test("memo and app use central dialogs, not the native Alert import", () => {
  for (const file of ["App.tsx", "src/PatientNoteScreen.tsx", "src/MemoAttachments.tsx"]) {
    const source = read(file);
    assert.match(source, /useNoteAlert\(\)/);
    assert.doesNotMatch(source, /^\s+Alert,/m);
  }
  const app = read("App.tsx");
  assert.match(app, /<NoteDialogProvider>/);
  assert.match(app, /<NoteDialogHost isDark=\{isDark\}/);
  assert.equal((app.match(/<SquishThemeSwitch\b/g) || []).length, 4, "dark mode, wheel picker, medical terms in the Android dialog + settings");
  assert.doesNotMatch(app, /text: isDark \? "라이트 모드로 변경"/);
  assert.doesNotMatch(read("src/SquishThemeSwitch.tsx"), /Ionicons|sunny|moon/);
  assert.doesNotMatch(read("src/SquishThemeSwitch.tsx"), /useNativeDriver: true/);
  assert.match(app, /환자 기록 전체 초기화/);
  assert.doesNotMatch(app, /선택 환자 초기화/);
  assert.match(read("src/terms.ts"), /complaintPlaceholder: "주증상 및 증상 경과를 입력하세요"/);
  assert.match(read("src/PatientNoteScreen.tsx"), /placeholder=\{L\.complaintPlaceholder\}/);
});
test("iOS uses the system alert; Android keeps the app's central dialog", async () => {
  const request = { id: 3, title: "사진 삭제", buttons: [{ text: "취소", style: "cancel" }, { text: "삭제", style: "destructive", onPress: () => calls.push("delete") }] };
  const calls = [];
  const ctx = { queue: [request], dismiss: id => calls.push(`dismiss:${id}`), alert: (...a) => calls.push(["alert", ...a]) };
  const ios = harness("src/NoteDialogs.tsx", { os: "ios" });
  ios.setContext(ctx);
  assert.equal(ios.render(ios.exports.NoteDialogHost, { isDark: true }), null, "no app-drawn dialog on iOS");
  const buttons = ios.exports.nativeAlertButtons(request, ctx.dismiss, ctx.alert);
  assert.deepEqual(buttons.map(b => [b.text, b.style]), [["삭제", "destructive"], ["취소", "cancel"]]);
  buttons[0].onPress(); buttons[0].onPress(); buttons[1].onPress();
  await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(calls, ["dismiss:3", "delete"], "one press acts once and dismisses first");
  calls.length = 0;
  const failing = ios.exports.nativeAlertButtons({ id: 4, title: "x", buttons: [{ text: "확인", onPress: () => { throw Error("boom"); } }] }, ctx.dismiss, ctx.alert);
  failing[0].onPress();
  await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(calls[0], "dismiss:4");
  assert.equal(calls[1][1], "작업 확인", "a failing action is reported");
  const android = harness("src/NoteDialogs.tsx", { os: "android" });
  android.setContext(ctx);
  assert.equal(android.render(android.exports.NoteDialogHost, { isDark: true }).type, android.exports.NoteAlertPanel);
  const plain = android.render(android.exports.NoteModal, { visible: true, children: "content" });
  assert.equal(plain.type, "Modal");
});
test("every app modal goes through NoteModal so iOS alerts stay visible", () => {
  for (const file of ["App.tsx", "src/DateTimeWheelPicker.tsx", "src/MemoAttachments.tsx", "src/PatientNoteScreen.tsx", "src/PatientContacts.tsx", "src/RecordAffiliation.tsx"]) {
    assert.doesNotMatch(read(file), /<Modal\b/, file);
  }
  const dialogs = read("src/NoteDialogs.tsx");
  assert.equal((dialogs.match(/<Modal\b/g) || []).length, 2, "only NoteModal and the Android root alert use the raw Modal");
});
test("splash HTML is generated locally and bundled for both platforms", () => {
  const app = read("App.tsx");
  assert.match(app, /Platform\.OS === "ios"\s*\? `\$\{FileSystem\.bundleDirectory \?\? ""\}field24-splash\.html`\s*: "file:\/\/\/android_asset\/splash\/index\.html"/);
  assert.match(app, /source=\{\{ uri: SPLASH_URI \}\}/);
  assert.match(app, /onError=\{finishIntro\}/);
  assert.ok(JSON.parse(read("app.json")).expo.plugins.includes("./plugins/withSplashWebAsset"));
  const plugin = read("plugins/withSplashWebAsset.js");
  assert.match(plugin, /assets\/web\/splash\/index\.html/);
  assert.match(plugin, /app\/src\/main\/assets\/splash\/index\.html/);
  assert.match(plugin, /field24-splash\.html/);
  assert.ok(fs.existsSync(path.join(__dirname, "../assets/web/splash/index.html")));
  assert.match(read("scripts/sync-web-splash.mjs"), /resolve\(root, "assets\/web\/splash"\)/);
});
test("record options popover sits under the ⋯ button inside the screen edges", () => {
  const { popoverPosition, POPOVER_WIDTH } = harness("src/RecordOptionsPopover.tsx", { os: "ios" }).exports;
  assert.deepEqual(popoverPosition({ x: 330, y: 60, width: 44, height: 44 }, 390), { top: 112, right: 16, width: POPOVER_WIDTH });
  assert.equal(popoverPosition({ x: 370, y: 60, width: 44, height: 44 }, 390).right, 16, "never past the right edge");
  assert.equal(popoverPosition({ x: 300, y: 60, width: 44, height: 44 }, 320).width, 288, "narrow screens keep 16pt edges");
  assert.equal(popoverPosition(null, 390).right, 16);
});
test("record options popover keeps Squish toggles, edits affiliation in place and resets after closing", () => {
  const h = harness("src/RecordOptionsPopover.tsx", { os: "ios" }), calls = [];
  const texts = node => !node || typeof node !== "object" ? (typeof node === "string" ? [node] : []) : Array.isArray(node) ? node.flatMap(texts) : texts(node.props?.children);
  const pressableWith = (root, label) => find(root, "Pressable").find(n => texts(n).includes(label));
  const props = {
    visible: true, isDark: true, anchor: { x: 330, y: 60, width: 44, height: 44 }, affiliation: "화정119안전센터",
    useWheelPicker: true, wheelPreferenceReady: true, showReset: true,
    medicalTerms: false, onMedicalTermsChange: v => calls.push(`terms:${v}`),
    onThemeChange: v => calls.push(`theme:${v}`), onWheelChange: v => calls.push(`wheel:${v}`),
    onAffiliationSaved() {}, onReset: () => calls.push("reset"), onClose: () => calls.push("close"),
  };
  let root = h.render(h.exports.default, props);
  const switches = find(root, "Switch");
  assert.equal(switches.length, 3, "dark mode, wheel picker and medical terms stay Squish toggles");
  assert.equal(switches[2].props.accessibilityLabel, "의학용어로 표시");
  assert.equal(switches[2].props.onChange, props.onMedicalTermsChange);
  assert.equal(switches[0].props.checked, true);
  assert.equal(switches[0].props.onChange, props.onThemeChange);
  assert.equal(switches[1].props.accessibilityLabel, "휠 피커 사용");
  switches[1].props.onChange(false);
  assert.ok(texts(root).includes("화정119안전센터"));
  pressableWith(root, "환자 기록 전체 초기화").props.onPress();
  assert.deepEqual(calls, ["wheel:false", "close", "reset"], "popover closes before the reset confirmation is queued");
  assert.equal(pressableWith(h.render(h.exports.default, { ...props, showReset: false }), "환자 기록 전체 초기화"), undefined);
  root = h.render(h.exports.default, props);
  find(root, "Pressable").find(n => n.props.accessibilityLabel === "소속 설정").props.onPress();
  root = h.render(h.exports.default, props);
  assert.equal(find(root, "Affiliation").length, 1, "affiliation edits inside the same popover, no second modal");
  assert.equal(find(root, "Switch").length, 0);
});
test("iOS uses the record options popover; Android keeps the centred options dialog", () => {
  const app = read("App.tsx");
  assert.match(app, /Platform\.OS === "ios" \? \(\s*<RecordOptionsPopover/);
  assert.match(app, /<CenteredDialog visible=\{optionsVisible\} isDark=\{isDark\} title="기록 옵션"/);
  assert.match(app, /ref=\{optionsButtonRef\}[^>]*onPress=\{openOptions\}/);
});
test("Squish toggles follow the surface: light mode never shows a white 'on' track on a white panel", () => {
  const h = harness("src/SquishThemeSwitch.tsx");
  const { SQUISH_LIGHT_COLORS, SQUISH_SWITCH_CONFIG } = h.exports;
  assert.notEqual(SQUISH_LIGHT_COLORS.trackOnColor.toLowerCase(), "#f5f5f5");
  assert.notEqual(SQUISH_LIGHT_COLORS.trackOnColor, SQUISH_LIGHT_COLORS.thumbOnColor);
  assert.equal(SQUISH_SWITCH_CONFIG.trackOnColor, "#f5f5f5", "dark reference colours are unchanged");
  const source = read("src/SquishThemeSwitch.tsx");
  assert.match(source, /const palette = isDark \? config : SQUISH_LIGHT_COLORS/);
  assert.match(source, /outputRange: \[palette.trackColor, palette.trackOnColor\]/);
  for (const file of ["App.tsx", "src/RecordOptionsPopover.tsx"]) {
    const tags = read(file).match(/<SquishThemeSwitch[\s\S]*?\/>/g) || [];
    assert.ok(tags.length > 0);
    for (const tag of tags) assert.match(tag, /isDark=\{/, `${file}: ${tag.slice(0, 60)}`);
  }
});
