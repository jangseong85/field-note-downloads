const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const code = ts.transpileModule(
  fs.readFileSync(
    require("node:path").join(__dirname, "../src/dateTime.ts"),
    "utf8",
  ),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText;
const compiled = { exports: {} };
new Function("module", "exports", code)(compiled, compiled.exports);
const d = compiled.exports;
for (const pasted of ["1985. 01. 08", "1985-01-08", "1985년 01월 08일", "19850108"]) assert.equal(d.dateDigits(pasted), "19850108");
for (const pasted of ["12: 34", "12시 34분", "1234"]) assert.equal(d.timeDigits(pasted), "1234");
assert.equal(d.dateDigits("1985. 01. 081234"), "19850108");
assert.equal(d.formatDate("20261021"), "2026. 10. 21");
assert.equal(d.formatDate("202610"), "2026. 10");
assert.equal(d.formatTime("0815"), "08:15");
assert.equal(d.weekdayForDate("20261021"), "수요일");
assert.equal(d.weekdayForDate("20240229"), "목요일");
for (const value of ["20260229", "20261301", "20260431", "202610", ""])
  assert.equal(d.weekdayForDate(value), null);
for (const value of ["0000", "2359", "0815"])
  assert.equal(d.validTime(value), true);
for (const value of ["2400", "1260", "123", ""])
  assert.equal(d.validTime(value), false);
assert.deepEqual(d.parseTimestamp("2026. 10. 21. 08:15"), {
  date: "20261021",
  time: "0815",
});
assert.deepEqual(d.parseTimestamp("2026. 10. 21 08:15"), {
  date: "20261021",
  time: "0815",
});
assert.deepEqual(d.parseTimestamp(""), { date: "", time: "" });
assert.equal(d.formatTimestamp("20261021", "0815"), "2026. 10. 21. 08:15");
assert.equal(d.formatTimestamp("20260229", "0815"), "");
assert.equal(d.formatTimestamp("20261021", ""), "");
const now = Date.parse("2026-10-23T11:35:00+09:00");
assert.equal(d.relativeOnset("20261021", "0815", now), "2일 3시간 20분 전");
assert.equal(d.relativeOnset("20261023", "1145", now), "10분 후");
assert.equal(d.relativeOnset("20261023", "1135", now), "방금 전");
assert.equal(
  d.relativeOnset("20261231", "2350", Date.parse("2027-01-01T00:10:00+09:00")),
  "20분 전",
);
for (const [date, time] of [
  ["", ""],
  ["20260229", "1200"],
  ["20261023", ""],
  ["20261023", "2400"],
])
  assert.equal(d.relativeOnset(date, time, now), null);
const fields = fs.readFileSync(
  require("node:path").join(__dirname, "../src/DateTimeFields.tsx"),
  "utf8",
);
assert.match(fields, /onChange\("", ""\)/);
assert.match(fields, /날짜와 시간 초기화/);
assert.match(fields, /subscription\.remove\(\)/);
assert.doesNotMatch(fields, /maxLength=/);
const patientScreen = fs.readFileSync(require("node:path").join(__dirname, "../src/PatientNoteScreen.tsx"), "utf8");
const birthInput = patientScreen.slice(patientScreen.indexOf("p.useWheelPicker === false"), patientScreen.indexOf('accessibilityLabel="환자 생년월일 선택"'));
assert.match(birthInput, /dateDigits\(value\)/);
assert.doesNotMatch(birthInput, /maxLength=/);
console.log("PASS: date/time formatting, validation, Onset elapsed and reset");
