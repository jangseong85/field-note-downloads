const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const test = require("node:test");
const cache = {};
function load(name) {
  if (cache[name]) return cache[name];
  const m = { exports: {} };
  const source = fs.readFileSync(path.join(__dirname, `../src/${name}.ts`), "utf8");
  new Function("require", "module", "exports", ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText)(
    (ref) => load(ref.replace("./", "")), m, m.exports,
  );
  return (cache[name] = m.exports);
}
const sms = load("smsMessage");
const history = load("historyOptions");
const review = load("reviewChecklist");
const terms = load("terms");
const blank = { id: "a", bp: "", pr: "", rr: "", spo2: "", bt: "", bst: "", measuredDate: "", measuredTime: "", measuredAt: "" };
const source = {
  sender: { affiliation: "화정119안전센터", rank: "소방교", name: "김구급" },
  name: "홍길동",
  birthDate: "19850108",
  chiefComplaint: "흉통,\n어지러움",
  onsetDate: "20261023",
  onsetTime: "1020",
  measurements: [
    { ...blank, id: "1", bp: "120/80", measuredTime: "1030" },
    { ...blank, id: "2", bp: "150/90", pr: "96", spo2: "95", bt: "36.8", bst: "58", measuredTime: "1052" },
  ],
  historySummary: "과거력: 고혈압, 당뇨",
  photoCount: 2,
};

test("SMS body keeps the fixed order, one colon per line and dashes for unmeasured vitals", () => {
  const body = sms.buildSmsMessage(source, sms.SMS_SECTIONS, "20261023");
  assert.equal(body, [
    "[화정119안전센터 소방교 김구급]",
    "환자: 홍길동 / 1985.01.08",
    "주증상: 흉통, 어지러움 (Onset 10:20)",
    "V/S(10:52): BP 150/90, PR 96, RR -, SpO2 95%, BT 36.8, BST 58",
    "과거력: 고혈압, 당뇨",
    "첨부: 사진 2장",
  ].join("\n"));
  for (const line of body.split("\n")) assert.ok((line.match(/: /g) || []).length <= 1, line);
});
test("unticked sections and empty data are left out; empty sections are not selectable", () => {
  const body = sms.buildSmsMessage({ ...source, photoCount: 0 }, ["vitals"], "20261023");
  assert.equal(body, "V/S(10:52): BP 150/90, PR 96, RR -, SpO2 95%, BT 36.8, BST 58");
  const empty = { ...source, sender: { affiliation: "", rank: "", name: "" }, name: "", birthDate: "", chiefComplaint: "", onsetDate: "", onsetTime: "", measurements: [blank], historySummary: "" };
  assert.deepEqual(sms.smsLines(empty, "20261023"), { affiliation: null, identity: null, complaint: null, vitals: null, history: null });
  assert.equal(sms.smsLines({ ...empty, sender: { affiliation: "", rank: "", name: "김구급" } }, "20261023").affiliation, "[김구급]");
});
test("onset from another day shows its date; medical mode switches the line labels", () => {
  assert.equal(sms.smsLines({ ...source, onsetDate: "20261022" }, "20261023").complaint, "주증상: 흉통, 어지러움 (Onset 10.22 10:20)");
  const lines = sms.smsLines({ ...source, medical: true }, "20261023");
  assert.equal(lines.identity, "Pt: 홍길동 / 1985.01.08");
  assert.match(lines.complaint, /^C\/C: /);
  assert.match(sms.buildSmsMessage({ ...source, medical: true }, [], "20261023"), /^Photos: 2$/);
});
test("history list keeps every earlier stored label and the dialysis rule", () => {
  for (const old of ["고혈압", "당뇨", "고지혈증", "뇌경색", "뇌출혈", "협심증", "심근경색", "천식", "COPD", "신부전", "투석 월·수·금", "투석 화·목·토", "암", "치매", "우울증"])
    assert.ok(history.HISTORY_OPTIONS.includes(old), old);
  assert.equal(history.HISTORY_OPTIONS.length, 29);
  assert.equal(new Set(history.HISTORY_OPTIONS).size, 29);
  assert.deepEqual(history.toggleHistoryItem([], "투석 월·수·금"), ["신부전", "투석 월·수·금"]);
  assert.deepEqual(history.toggleHistoryItem(["신부전", "투석 월·수·금"], "투석 화·목·토"), ["신부전", "투석 화·목·토"]);
  assert.deepEqual(history.toggleHistoryItem(["신부전", "투석 월·수·금"], "신부전"), []);
  assert.equal(history.historySummary(["당뇨", "투석 월·수·금", "신부전", "고혈압"]), "과거력: 고혈압, 당뇨, 신부전(투석 월·수·금)");
  assert.equal(history.historySummary(["고혈압", "당뇨"], (item) => terms.historyTerm(item, true), "PHx"), "PHx: HTN, DM");
  for (const item of history.HISTORY_OPTIONS) assert.ok(terms.historyTerm(item, true), item);
});
test("checklist starts with common checks, de-duplicates shared items and reads answers from memo lines", () => {
  assert.deepEqual(review.reviewGroups([]), []);
  const groups = review.reviewGroups(["심부전", "COPD", "당뇨"]);
  assert.deepEqual(groups.map((g) => g.title), ["공통", "심부전", "당뇨"], "Home O2 appears once");
  const meal = groups.find((g) => g.title === "당뇨").items.find((i) => i.id === "lastMeal");
  assert.equal(meal.kind, "time");
  let memo = "보호자 말로는 어제부터 어지러움";
  assert.equal(review.reviewAnswer(memo, meal), null);
  memo = review.upsertReviewAnswer(memo, meal, "07:10 (약 3시간 전)", false);
  assert.equal(memo, "보호자 말로는 어제부터 어지러움\n마지막 식사: 07:10 (약 3시간 전)");
  memo = review.upsertReviewAnswer(memo, meal, "", false);
  assert.equal(memo, "보호자 말로는 어제부터 어지러움\n마지막 식사: 확인", "an existing line is replaced, never duplicated");
  assert.equal(review.reviewAnswer("Last meal: 07:10", meal), "07:10", "medical-mode lines are recognised too");
  assert.equal(review.reviewAnswer(memo.replace("마지막 식사: 확인", ""), meal), null, "deleting the line unchecks it");
});
test("quick time and date answers are Korea time", () => {
  const now = new Date("2026-10-23T01:40:00Z");
  assert.equal(review.timeAnswer(0, now, false), "10:40 (방금)");
  assert.equal(review.timeAnswer(120, now, false), "08:40 (약 2시간 전)");
  assert.equal(review.timeAnswer(30, now, true), "10:10 (30 min ago)");
  assert.equal(review.dateAnswer(1, now, false), "10.22 (어제)");
});
