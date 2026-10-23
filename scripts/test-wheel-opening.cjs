const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), ts = require("typescript");
function harness() {
  let cursor = 0; const hooks = [], cache = {};
  const memo = (fn, deps) => { const i = cursor++; if (!hooks[i] || deps.some((d, j) => !Object.is(d, hooks[i].deps[j]))) hooks[i] = { deps, value: fn() }; return hooks[i].value; };
  const React = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState: initial => { const i = cursor++; if (!(i in hooks)) hooks[i] = typeof initial === "function" ? initial() : initial; return [hooks[i], v => hooks[i] = typeof v === "function" ? v(hooks[i]) : v]; },
    useMemo: memo, useEffect: () => {},
  };
  function load(name) {
    if (cache[name]) return cache[name];
    const m = { exports: {} }, file = name === "DateTimeWheelPicker" ? name + ".tsx" : name + ".ts";
    const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, "../src", file), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
    new Function("require", "module", "exports", source)(ref => {
      if (ref === "react") return React;
      if (ref === "react-native") return { View: "View", Text: "Text", Pressable: "Button", Modal: "Modal", StyleSheet: { create: x => x }, useWindowDimensions: () => ({ height: 850, fontScale: 1 }) };
      if (ref === "react-native-safe-area-context") return { SafeAreaView: "SafeAreaView" };
      if (ref === "./ClinicalControls") return { RecordTabs: "Tabs" };
      if (ref === "./NativeWheelColumn") return { __esModule: true, default: "Column" };
      if (ref === "./clinicalTheme") return { clinicalTheme: () => ({}) };
      if (ref === "./NoteDialogs") return { NoteModal: "Modal" };
      return load(ref.replace("./", ""));
    }, m, m.exports);
    return cache[name] = m.exports;
  }
  const Picker = load("DateTimeWheelPicker").default;
  let session;
  return { render(props) { const element = Picker(props); if (!element) { session = null; hooks.length = 0; return null; } session = element.type; cursor = 0; return session(element.props); } };
}
function nodes(n) { return !n || typeof n !== "object" ? [] : [n, ...(n.props?.children || []).flat(Infinity).flatMap(nodes)]; }
const base = { visible: true, title: "Onset", date: "20261023", time: "1234", initialMode: "time", isDark: true, onApply() {}, onCancel() {} };
test("time opens with only hour/minute on the FIRST render; hidden picker does no row work", () => {
  const h = harness();
  assert.equal(h.render({ ...base, visible: false }), null);
  const first = nodes(h.render(base)).filter(n => n.type === "Column");
  assert.deepEqual(first.map(n => n.props.label), ["시", "분"]);
  assert.equal(first.reduce((sum, n) => sum + n.props.values.length, 0), 84);
});
test("busy rerenders preserve lists and callbacks; each opening starts a fresh correct draft", () => {
  const h = harness(), applied = [];
  const props = { ...base, onApply: (...args) => applied.push(args) };
  let all = nodes(h.render(props));
  const first = all.filter(n => n.type === "Column");
  first[0].props.onBusy(true);
  const busy = nodes(h.render(props)).filter(n => n.type === "Column");
  for (let i = 0; i < first.length; i++) {
    assert.equal(first[i].props.values, busy[i].props.values);
    assert.equal(first[i].props.onChange, busy[i].props.onChange);
    assert.equal(first[i].props.onBusy, busy[i].props.onBusy);
  }
  busy[0].props.onChange(19);
  assert.equal(applied.length, 0);
  h.render({ ...props, visible: false });
  all = nodes(h.render({ ...props, initialMode: "date", date: "19850108" }));
  const reopened = all.filter(n => n.type === "Column");
  assert.deepEqual(reopened.map(n => [n.props.label, n.props.value]), [["년", 1985], ["월", 1], ["일", 8]]);
  const apply = all.find(n => n.props.accessibilityLabel === "Onset 선택 적용");
  assert.equal(apply.props.disabled, false);
  apply.props.onPress();
  assert.deepEqual(applied, [["19850108", "1234"]]);
});
test("row interpolation graphs are cached and long year list is virtualized", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/NativeWheelColumn.tsx"), "utf8");
  assert.match(source, /const animatedStyle = useMemo/);
  assert.match(source, /\[offset, faces, height, index\]/);
  assert.match(source, /values.length > 100 \? VirtualizedWheelPicker : WheelPicker/);
  assert.match(source, /renderItemContainer=\{renderContainer\}/);
  assert.match(source, /React.memo\(NativeWheelColumn\)/);
});
