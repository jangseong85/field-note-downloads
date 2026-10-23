const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const test = require("node:test");
const read = name => fs.readFileSync(path.join(__dirname, "..", name), "utf8");
const moduleResult = { exports: {} };
new Function("module", "exports", ts.transpileModule(read("src/clinicalTheme.ts"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(moduleResult, moduleResult.exports);
const { clinicalTheme, clinicalMetrics } = moduleResult.exports;
const luminance = hex => {
  const c = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return c[0] * .2126 + c[1] * .7152 + c[2] * .0722;
};
const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);
for (const dark of [false, true]) test(`${dark ? "dark" : "light"} input, label and accent contrast`, () => {
  const t = clinicalTheme(dark);
  for (const text of ["ink", "muted", "placeholder", "accent"]) for (const background of ["surface", "field"]) assert.ok(contrast(t[text], t[background]) >= 4.5, `${text} on ${background}: ${contrast(t[text], t[background]).toFixed(2)}`);
});
test("appearance changes colours without changing field metrics", () => {
  assert.equal(clinicalMetrics.fieldHeight, 52);
  assert.equal(clinicalMetrics.radius, 14);
  assert.equal(clinicalMetrics.fontSize, 16);
  assert.deepEqual(Object.keys(clinicalTheme(true)), Object.keys(clinicalTheme(false)));
});
test("calm action colors are separate from red identity and danger", () => {
  for (const mode of [false, true]) {
    const t = clinicalTheme(mode);
    assert.notEqual(t.accent, t.brand);
    assert.notEqual(t.accent, t.danger);
    for (const background of ["surface", "field"]) assert.ok(contrast(t.danger, t[background]) >= 4.5);
  }
  assert.match(read("App.tsx"), /noteBrandNumber, \{ color: clinicalTheme\(isDark\).brand \}/);
  assert.match(read("src/NoteDialogs.tsx"), /\? t.danger/);
});
test("patient and measurement tabs use exactly the same implementation", () => {
  const app = read("src/PatientNoteScreen.tsx");
  assert.equal((app.match(/<RecordTabs\b/g) || []).length, 3);
  assert.match(app, /selectionRole="radio"/);
  assert.doesNotMatch(app, /style=\{\[styles\.(patientTab|measurementTab)[,\]]/);
});
test("record tabs provide press feedback and respect reduced motion", () => {
  const controls = read("src/ClinicalControls.tsx");
  assert.match(controls, /function RecordTab\(/);
  assert.match(controls, /onPressIn=\{\(\) => press\(true\)\}/);
  assert.match(controls, /onPressOut=\{\(\) => press\(false\)\}/);
  assert.match(controls, /Animated\.spring\(scale/);
  assert.match(controls, /AccessibilityInfo\.isReduceMotionEnabled/);
  assert.match(controls, /reduceMotionChanged/);
  assert.match(controls, /\{ selected, disabled \}/);
  assert.match(controls, /if \(!changed \|\| reduceMotion\)/);
  assert.match(controls, /Animated\.subtract\(right, left\)/);
  assert.match(controls, /segment\.squash/);
  assert.match(controls, /segment\.stretch \/ 100/);
  assert.match(controls, /draggable: true/);
  assert.match(controls, /!disabled && !dragged\.current/);
  assert.match(controls, /onMoveShouldSetPanResponderCapture/);
  assert.doesNotMatch(read("App.tsx"), /<PatientNoteScreen key=/);
  assert.match(read("src/PatientNoteScreen.tsx"), /<View key=\{p.activePatientId\} style=\{s.body\}/);
});
test("requested helper copy and privacy footer are removed", () => {
  const screen = read("src/PatientNoteScreen.tsx");
  for (const text of ["확인된 정보만 입력", "증상과 경과", "회차별 측정 기록", "병력은 선택하고, 메모는 자유롭게", "이 기기에 저장되는 환자 기록", "lock-closed-outline"]) {
    assert.ok(!screen.includes(text), text);
  }
  const app = read("App.tsx");
  assert.ok(!app.includes('"현장 기록"'));
  assert.match(app, /activeTab !== "memo" && <Text style=\{\[styles\.noteTitle/);
});
test("date and memo share field surfaces; dates open an explicit wheel editor", () => {
  for (const file of ["src/DateTimeFields.tsx", "src/ResizableMemoInput.tsx"]) {
    assert.match(read(file), /<ClinicalField\b/);
  }
  assert.match(read("src/ResizableMemoInput.tsx"), /<ClinicalInput\b/);
  assert.match(read("src/DateTimeFields.tsx"), /<DateTimeWheelPicker\b/);
  assert.match(read("src/DateTimeFields.tsx"), /useWheelPicker \?/);
});
test("birth date and age share the same entry row and input typography", () => {
  const source = read("src/PatientNoteScreen.tsx");
  assert.match(source, /<View style=\{s.birthEntry\}>/);
  assert.match(source, /age: \{\s*fontSize: 16,\s*fontFamily: "Pretendard-Regular"/);
  assert.match(source, /borderLeftColor: t.border/);
  assert.doesNotMatch(source, /s.sexOption|s.sexText/);
});
test("attachments are a separate component surface without static action captions", () => {
  const source = read("src/PatientNoteScreen.tsx");
  assert.match(source, /s.attachmentsSection/);
  assert.match(source, /<MemoAttachments\s+key=\{p.activePatientId\}/);
  const media = read("src/MemoAttachments.tsx");
  assert.doesNotMatch(media, /현장 음성 기록|환부·현장 촬영|중지를 누르면 이 환자 기록에 저장/);
  assert.match(media, /durationText\(recordingState.durationMillis \/ 1000\)/);
});
test("vitals have no dash placeholder, tall cards or internal separator", () => {
  const app = read("src/PatientNoteScreen.tsx");
  const vitals = app.slice(app.indexOf("s.vitalsBoard"), app.indexOf('heading("병력과 메모"'));
  assert.match(vitals, /s.vitalCell/);
  assert.doesNotMatch(vitals, /placeholder="—"|styles.divider|styles.vitalBox|styles.mapBadge/);
  assert.match(vitals, /s.map/);
});
test("vital entries use large centered numbers with label above and unit below", () => {
  const app = read("src/PatientNoteScreen.tsx");
  const block = app.slice(app.indexOf("<View style={s.vitalsBoard}>"), app.indexOf("{map !== null"));
  assert.ok(block.indexOf("s.vitalLabel") < block.indexOf("<ClinicalInput"));
  assert.ok(block.indexOf("s.unit") > block.indexOf("<ClinicalInput"));
  assert.match(app, /vitalInput: \{[^}]*textAlign: "center"[^}]*fontSize: 28/);
  assert.match(app, /bloodPressureInput: \{\s*fontSize: 24/);
  assert.match(app, /!form\[vital.key\] && s.vitalPlaceholder/);
  assert.match(app, /vitalPlaceholder: \{ fontSize: 16/);
  assert.match(block, /borderColor:\s*focusedVital === vital.key \? t.accent : "transparent"/);
  assert.match(block, /fontScale > 1.7/);
  assert.doesNotMatch(block, /textAlign: "right"/);
});
test("SALS is neither mounted nor offered by the app, and its stored records are untouched", () => {
  const app = read("App.tsx");
  assert.doesNotMatch(app, /import SalsPage|<SalsPage\b|key: "sals"|activeTab === "sals"/);
  assert.doesNotMatch(app, /removeItem\([^\n]*sals|multiRemove\(\[[^\]]*sals/);
  assert.ok(fs.existsSync(path.join(__dirname, "../src/SalsPage.tsx")));
});
test("the old memo screen was replaced rather than hidden below the new one", () => {
  const app = read("App.tsx");
  assert.match(app, /<PatientNoteScreen\b/);
  assert.doesNotMatch(app, /function AdvancedPatient\(|function MemoCard\(|<MemoCard\b/);
  assert.match(read("src/PatientNoteScreen.tsx"), /onUpdate\("historyMemo", value\)/);
});
