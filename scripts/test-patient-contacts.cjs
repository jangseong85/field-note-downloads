const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const path = require("node:path");
const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const phoneModule = { exports: {} };
new Function("module", "exports", ts.transpileModule(read("src/phoneNumber.ts"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(phoneModule, phoneModule.exports);
function harness() {
  let cursor = 0;
  const state = [];
  const React = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState: initial => { const i = cursor++; if (!(i in state)) state[i] = initial; return [state[i], next => state[i] = next]; },
    createContext: value => ({ value }), useContext: context => context.value, useMemo: fn => fn(),
  };
  const module = { exports: {} };
  const source = ts.transpileModule(read("src/PatientContacts.tsx"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2020 } }).outputText;
  new Function("require", "module", "exports", source)(name => {
    if (name === "react") return React;
    if (name === "react-native") return { Pressable: "Button", View: "View", Text: "Text", StyleSheet: { create: x => x, absoluteFill: {} }, KeyboardAvoidingView: "KAV", Platform: { OS: "ios" } };
    if (name === "@expo/vector-icons") return { Ionicons: "Icon" };
    if (name === "react-native-safe-area-context") return { SafeAreaView: "SafeArea" };
    if (name === "./ClinicalControls") return { ClinicalInput: "Input" };
    if (name === "./NoteDialogs") return { NoteModal: "Dialog" };
    if (name === "./clinicalTheme") return { clinicalTheme: () => ({}), scrim: () => "rgba(0,0,0,0.4)" };
    if (name === "./phoneNumber") return phoneModule.exports;
    if (name === "./design") {
      const m = { exports: {} };
      new Function("require", "module", "exports", ts.transpileModule(read("src/design.ts"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(ref => ref === "react" ? React : ref === "react-native" ? { StyleSheet: { create: x => x } } : undefined, m, m.exports);
      return m.exports;
    }
    if (name === "./terms") { const m = { exports: {} }; new Function("module", "exports", ts.transpileModule(read("src/terms.ts"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(m, m.exports); return m.exports; }
    throw Error(name);
  }, module, module.exports);
  return props => { cursor = 0; return module.exports.default(props); };
}
function nodes(node) {
  if (!node || typeof node !== "object") return [];
  return [node, ...(node.props?.children ?? []).flat(Infinity).flatMap(nodes)];
}
test("guardian edits are draft-only until apply; phone fields update independently", () => {
  const render = harness();
  const changes = [];
  const props = { isDark: true, form: { patientPhone: "", guardianPhone: "", guardianName: "", guardianRelation: "" }, onUpdate: (...args) => changes.push(args) };
  let tree = render(props);
  let all = nodes(tree);
  all.find(n => n.props.accessibilityLabel === "환자 연락처 입력").props.onChangeText("01012345678");
  assert.deepEqual(changes, [["patientPhone", "010-1234-5678"]]);
  changes.length = 0;
  all.find(n => n.props.accessibilityLabel === "보호자 관계와 이름 설정").props.onPress();
  all = nodes(render(props));
  all.find(n => n.type === "Button" && nodes(n).some(c => c.type === "Text" && c.props.children.includes("부모"))).props.onPress();
  all.find(n => n.props.accessibilityLabel === "보호자 이름 입력").props.onChangeText(" 보호자 ");
  assert.equal(changes.length, 0);
  all = nodes(render(props));
  all.find(n => n.type === "Button" && n.props.accessibilityLabel === "적용").props.onPress();
  assert.deepEqual(changes, [["guardianRelation", "부모"], ["guardianName", "보호자"]]);
  assert.equal(nodes(render(props)).find(n => n.type === "Dialog").props.visible, false);
});
test("phone formatting is progressive, idempotent and supports deletion and paste", () => {
  const f = phoneModule.exports.formatPhoneNumber;
  for (const [input, expected] of [["", ""], ["010", "010"], ["0104", "010-4"], ["0101234", "010-1234"], ["01012345", "010-1234-5"], ["01012345678", "010-1234-5678"], ["010-1234-", "010-1234"], ["010 1234 5678", "010-1234-5678"], ["0101234567899", "0101234567899"], ["02-1234-5678", "02-1234-5678"], ["02-123-4567", "02-123-4567"], ["0311234567", "031-123-4567"], ["03112345678", "031-1234-5678"], ["+82 10 1234 5678", "+82 10-1234-5678"], ["+1 (415) 555-0123", "+14155550123"], ["+", "+"]]) {
    assert.equal(f(input), expected);
    assert.equal(f(f(input)), expected);
  }
});
test("both contact inputs preserve all pasted digits without native length truncation", () => {
  const render = harness(), changes = [];
  const all = nodes(render({ isDark: false, form: { patientPhone: "", guardianPhone: "", guardianName: "", guardianRelation: "" }, onUpdate: (...args) => changes.push(args) }));
  for (const [label, key] of [["환자 연락처 입력", "patientPhone"], ["보호자 연락처 입력", "guardianPhone"]]) {
    const input = all.find(n => n.props.accessibilityLabel === label);
    assert.equal(input.props.maxLength, undefined);
    input.props.onChangeText("+82 10 1234 5678");
    assert.deepEqual(changes.pop(), [key, "+82 10-1234-5678"]);
    input.props.onChangeText("0101234567899");
    assert.deepEqual(changes.pop(), [key, "0101234567899"]);
  }
});
test("contacts are blank by default and patient-owned; affiliation is separate storage", () => {
  const app = read("App.tsx") + read("src/patientWorkspace.ts");
  for (const field of ["patientPhone", "guardianPhone", "guardianName", "guardianRelation"]) assert.match(app, new RegExp(`${field}: ""`));
  assert.match(read("src/PatientNoteScreen.tsx"), /PatientContacts\s+key=\{p.activePatientId\}/);
  assert.match(read("src/RecordAffiliation.tsx"), /ems-log.affiliation.v1/);
  assert.match(read("src/RecordAffiliation.tsx"), /\[AFFILIATION_KEY, next\.affiliation\]/);
});
test("기타 opens a typed relation that is saved as written and comes back on reopen", () => {
  const render = harness();
  const changes = [];
  const props = { isDark: false, form: { patientPhone: "", guardianPhone: "", guardianName: "", guardianRelation: "" }, onUpdate: (...args) => changes.push(args) };
  const chip = (all, label) => all.find(n => n.props.accessibilityRole === "radio" && nodes(n).some(c => c.type === "Text" && c.props.children.includes(label)));
  const typed = all => all.find(n => n.props.accessibilityLabel === "보호자 관계 직접 입력");
  const apply = all => all.find(n => n.type === "Button" && n.props.accessibilityLabel === "적용").props.onPress();
  nodes(render(props)).find(n => n.props.accessibilityLabel === "보호자 관계와 이름 설정").props.onPress();
  let all = nodes(render(props));
  assert.equal(typed(all), undefined);
  chip(all, "기타").props.onPress();
  all = nodes(render(props));
  typed(all).props.onChangeText(" 조카 ");
  apply(nodes(render(props)));
  assert.deepEqual(changes[0], ["guardianRelation", "조카"]);

  changes.length = 0;
  const saved = { ...props, form: { ...props.form, guardianRelation: "조카" } };
  nodes(render(saved)).find(n => n.props.accessibilityLabel === "보호자 관계와 이름 설정").props.onPress();
  all = nodes(render(saved));
  assert.equal(chip(all, "기타").props.accessibilityState.selected, true);
  assert.equal(typed(all).props.value, "조카");
  typed(all).props.onChangeText("");
  apply(nodes(render(saved)));
  assert.deepEqual(changes[0], ["guardianRelation", "기타"]);

  changes.length = 0;
  const family = { ...props, form: { ...props.form, guardianRelation: "배우자" } };
  nodes(render(family)).find(n => n.props.accessibilityLabel === "보호자 관계와 이름 설정").props.onPress();
  all = nodes(render(family));
  assert.equal(chip(all, "배우자").props.accessibilityState.selected, true);
  assert.equal(typed(all), undefined);
});
test("the guardian sheet rises above the keyboard on Android too, so the name field stays visible", () => {
  const source = read("src/PatientContacts.tsx");
  assert.match(source, /<KeyboardAvoidingView behavior="padding" style=\{\[sheet\.backdrop/);
  assert.doesNotMatch(source, /Platform\.OS === "ios" \? "padding" : undefined/);
});
test("English mode labels relations, but the saved value stays Korean", () => {
  const render = harness();
  const changes = [];
  const props = { isDark: false, medical: true, form: { patientPhone: "", guardianPhone: "", guardianName: "홍길동", guardianRelation: "배우자" }, onUpdate: (...args) => changes.push(args) };
  let all = nodes(render(props));
  assert.ok(all.some(n => n.type === "Text" && [].concat(n.props.children).join("") === "Spouse · 홍길동"));
  all.find(n => n.props.accessibilityLabel === "보호자 관계와 이름 설정").props.onPress();
  all = nodes(render(props));
  const chip = all.find(n => n.props.accessibilityRole === "radio" && n.props.accessibilityState.selected);
  assert.ok(nodes(chip).some(c => c.type === "Text" && [].concat(c.props.children).join("") === "Spouse"));
  all.find(n => n.type === "Button" && n.props.accessibilityLabel === "적용").props.onPress();
  assert.deepEqual(changes[0], ["guardianRelation", "배우자"]);
});
