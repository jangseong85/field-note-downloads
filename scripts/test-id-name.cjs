const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const test = require("node:test");
const m = { exports: {} };
new Function("module", "exports", ts.transpileModule(fs.readFileSync(path.join(__dirname, "../src/idDate.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText)(m, m.exports);
const { extractIdentity, nameSegment } = m.exports;
const card = (nameLine) => `주민등록증\n${nameLine}\n850108-1234567\n서울특별시 종로구`;
const today = new Date("2026-10-23T00:00:00+09:00");

test("Hanja printed after the name never joins the name, however OCR reads it", () => {
  for (const [line, expected] of [
    ["홍길동(洪吉童)", "홍길동"],
    ["홍길동(흥길등)", "홍길동"],
    ["홍길동 흥길등", "홍길동"],
    ["김철 금철", "김철"],
    ["김철(金哲", "김철"],
    ["홍길동1흥길등)", "홍길동"],
    ["홍길동l흥길등", "홍길동"],
    ["홍길동 | 洪吉童", "홍길동"],
    ["홍 길 동", "홍길동"],
    ["홍 길동", "홍길동"],
    ["홍길 동", "홍길동"],
    ["홍 길동(洪吉童)", "홍길동"],
    ["홍길 동 흥길등", "홍길동"],
    ["남궁 민수", "남궁민수"],
    ["황보 지영", "황보지영"],
    ["남궁 민 수", "남궁민수"],
    ["제갈 공명(諸葛孔明)", "제갈공명"],
    ["남궁민수(南宮民秀)", "남궁민수"],
  ]) assert.equal(extractIdentity(card(line), today).name, expected, line);
});
test("labelled names and the rest of the identity are unchanged", () => {
  assert.equal(extractIdentity("자동차운전면허증\n성명 홍길동 흥길등\n850108-1234567", today).name, "홍길동");
  const id = extractIdentity(card("홍길동(洪吉童)"), today);
  assert.equal(id.birthDate, "19850108");
  assert.equal(id.gender, "남성");
  assert.equal(nameSegment("   "), "");
});
test("licence class lines and card titles are still not names", () => {
  assert.notEqual(extractIdentity("자동차운전면허증\n1종보통\n성명 홍길동\n850108-1234567", today).name, "1종보통");
  assert.equal(extractIdentity("자동차운전면허증\n1종보통\n성명 홍길동\n850108-1234567", today).name, "홍길동");
});
test("birth date prefers the resident number over issue dates and address numbers", () => {
  const { extractBirthDate } = m.exports;
  for (const [text, expected] of [
    ["주민등록증\n홍길동(洪吉童)\n850108-1234567\n서울특별시 종로구 세종대로 202동 1301호\n2019. 7. 2.\n종로구청장", "19850108"],
    ["주민등록증\n홍길동\n850108-2234567\n2031.13.45 인쇄오류\n2019.07.02", "19850108"],
    ["주민등록증\n홍길동\n850108 1234567", "19850108"],
    ["자동차운전면허증\n11-18-123456-70\n홍길동\n850108-1234567\n2019.07.02", "19850108"],
    ["복지카드\n홍길동\n생년월일 1985. 01. 08.", "19850108"],
    ["복지카드\n발급 2031.99.99\n생년월일 1985.01.08", "19850108"],
  ]) assert.equal(extractBirthDate(text, today), expected, text.replace(/\n/g, " | "));
  assert.equal(extractBirthDate("주민등록증\n홍길동", today), null);
});
test("eight-digit dates are not read as resident numbers; gender comes from the same resident number", () => {
  const { extractBirthDate } = m.exports;
  assert.equal(extractBirthDate("생년월일 20100123", today), "20100123");
  assert.equal(extractBirthDate("복지카드\n홍길동\n20100123", today), "20100123");
  assert.equal(extractBirthDate("주민등록증\n홍길동\n8501081234567", today), "19850108", "hyphen dropped by OCR");
  const licence = extractIdentity("자동차운전면허증\n11-18-123456-70\n홍길동\n850108-2234567", today);
  assert.equal(licence.birthDate, "19850108");
  assert.equal(licence.gender, "여성", "not the licence number's digit");
  assert.equal(extractIdentity("주민등록증\n홍길동\n100123-3234567", today).birthDate, "20100123");
});
