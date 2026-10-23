const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const test = require("node:test");
const cache = {};
const read = name => fs.readFileSync(path.join(__dirname, "../src/" + name), "utf8");
function load(name) {
  if (cache[name]) return cache[name];
  const result = { exports: {} };
  const code = ts.transpileModule(read(name + ".ts"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  new Function("require", "module", "exports", code)(ref => load(ref.replace("./", "")), result, result.exports);
  return cache[name] = result.exports;
}
const { wheelDraft, changeWheel, wheelParts, monthDays } = load("wheelDateTime");
const { createWheelHold, nearestWheelIndex, wheelHoldDelay } = load("wheelMotion");
function fakeClock() {
  let now = 0, id = 0;
  const tasks = new Map();
  return {
    scheduler: { now: () => now, set: (fn, delay) => { tasks.set(++id, { fn, at: now + delay }); return id; }, clear: key => tasks.delete(key) },
    advance(ms) {
      const end = now + ms;
      for (;;) { const next = [...tasks].sort((a, b) => a[1].at - b[1].at)[0]; if (!next || next[1].at > end) break; now = next[1].at; tasks.delete(next[0]); next[1].fn(); }
      now = end;
    },
    pending: () => tasks.size,
  };
}
test("long hold accelerates, releasing cancels every pending step", () => {
  const clock = fakeClock(), states = []; let value = 0;
  const hold = createWheelHold(direction => { value += direction; return true; }, active => states.push(active), clock.scheduler);
  hold.start(1); clock.advance(800); const early = value;
  clock.advance(2400); const middle = value;
  clock.advance(800); assert.ok(value - middle > early);
  assert.equal(wheelHoldDelay(4000), 55);
  assert.equal(wheelHoldDelay(800), 280);
  assert.equal(wheelHoldDelay(1000), 160);
  assert.equal(wheelHoldDelay(2250), 90);
  hold.stop(); const stopped = value; clock.advance(2000);
  assert.equal(value, stopped); assert.equal(clock.pending(), 0); assert.deepEqual(states, [true, false]);
});
test("hold stops at the endpoint without wrapping, restarting reverses direction", () => {
  const clock = fakeClock(); let value = 58;
  const hold = createWheelHold(direction => { const next = Math.max(0, Math.min(59, value + direction)); if (next === value) return false; value = next; return true; }, () => {}, clock.scheduler);
  hold.start(1); clock.advance(5000); assert.equal(value, 59); assert.equal(clock.pending(), 0);
  hold.start(-1); clock.advance(500); hold.stop(); assert.ok(value < 59 && value >= 0);
});
test("wheel overscroll snaps to a valid endpoint and native momentum is unrestricted", () => {
  assert.equal(nearestWheelIndex(-80, 56, 60), 0);
  assert.equal(nearestWheelIndex(10000, 56, 60), 59);
  assert.equal(nearestWheelIndex(56 * 14.6, 56, 60), 15);
  const source = read("NativeWheelColumn.tsx");
  assert.match(source, /@quidone\/react-native-wheel-picker/);
  assert.match(source, /disableIntervalMomentum=\{false\}/);
  assert.match(source, /delayLongPress=\{350\}/);
  assert.match(source, /onPressOut=\{stop\}/);
  assert.match(source, /if \(!active\)/);
});
const now = { date: "20261023", time: "1430" };
test("wheel preference offers numeric entry in all three contexts and persists separately", () => {
  const app = fs.readFileSync(path.join(__dirname, "../App.tsx"), "utf8");
  const fields = read("DateTimeFields.tsx"), screen = read("PatientNoteScreen.tsx");
  assert.match(app, /ems-log.wheel-picker.v1/);
  assert.match(app, /AsyncStorage.setItem\(WHEEL_PICKER_KEY, String\(enabled\)\)/);
  assert.match(app, /accessibilityLabel="휠 피커 사용"/);
  assert.match(app, /useWheelPicker=\{useWheelPicker\}/);
  assert.equal((screen.match(/useWheelPicker=\{p.useWheelPicker\}/g) || []).length, 2);
  assert.match(screen, /p.useWheelPicker === false/);
  assert.match(screen, /환자 생년월일 직접 입력/);
  assert.match(fields, /onChange\(dateDigits\(value\), time\)/);
  assert.match(fields, /onChange\(date, timeDigits\(value\)\)/);
});
test("existing valid dates and times are restored; blank and invalid inputs use an explicit draft", () => {
  assert.deepEqual(wheelParts(wheelDraft("19991023", "0000", now)), { date: "19991023", time: "0000" });
  assert.deepEqual(wheelParts(wheelDraft("", "", now)), now);
  assert.deepEqual(wheelParts(wheelDraft("20260229", "2400", now)), now);
});
test("month and year changes clamp the day correctly, including century leap rules", () => {
  assert.equal(monthDays(2000, 2), 29); assert.equal(monthDays(2100, 2), 28);
  const january = wheelDraft("20260131", "2359", now);
  assert.equal(wheelParts(changeWheel(january, "month", 2)).date, "20260228");
  assert.equal(wheelParts(changeWheel(wheelDraft("20240229", "2359", now), "year", 2025)).date, "20250228");
  assert.equal(january.day, 31);
});
test("24-hour wheel values preserve leading zeros without rolling into another date", () => {
  let draft = wheelDraft("20261023", "2359", now);
  draft = changeWheel(changeWheel(draft, "hour", 0), "minute", 0);
  assert.deepEqual(wheelParts(draft), { date: "20261023", time: "0000" });
  assert.equal(changeWheel(draft, "hour", 25).hour, 23);
  assert.equal(changeWheel(draft, "minute", -1).minute, 0);
});
test("all three date contexts use the wheel; cancel never commits and applying waits for settling", () => {
  const fields = read("DateTimeFields.tsx"), picker = read("DateTimeWheelPicker.tsx");
  assert.match(fields, /openPicker\("date"\)/); assert.match(fields, /openPicker\("time"\)/);
  assert.match(read("PatientNoteScreen.tsx"), /title="생년월일"/);
  assert.match(picker, /onRequestClose=\{onCancel\}/);
  assert.match(picker, /disabled=\{spinning\}/);
  assert.match(picker, /dateOnly \? time : parts.time/);
  assert.match(picker, /Math.max\(56,/);
  assert.match(fields, /useWheelPicker \?/);
  assert.match(fields, /날짜 직접 입력/);
  assert.match(fields, /시간 직접 입력/);
});
