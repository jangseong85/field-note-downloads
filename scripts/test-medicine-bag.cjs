const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const loadTs = require("./load-ts.cjs");
const read = name => fs.readFileSync(path.join(__dirname, "..", name), "utf8");
const { MEDICINE_BAG_PROMPT, CHATGPT_PACKAGE } = loadTs("medicineBagPrompt");
const { fitContain, initialCrop, dragCrop, displayToImageCrop, capLongEdge, strokePath } = loadTs("medicineBagCrop");

test("prompt asks for exactly the three agreed sections and a fixed unreadable sentence", () => {
  const sections = MEDICINE_BAG_PROMPT.match(/^\d\. .+$/gm);
  assert.deepEqual(sections, ["1. 약물명", "2. 부작용", "3. 추정 병력"]);
  assert.match(MEDICINE_BAG_PROMPT, /"판독 불가: 약 이름 부분을 다시 촬영 바람"만 쓴다/);
  assert.match(MEDICINE_BAG_PROMPT, /인사말, 서론, 요약, 주의 문구, 추가 질문, 진료 권고/);
  assert.match(MEDICINE_BAG_PROMPT, /사람 이름, 병원·약국명, 연락처, 주소는 사진에 보여도 쓰지 않는다/);
  assert.match(MEDICINE_BAG_PROMPT, /추측으로 약을 추가하지 않는다/);
});

test("contain fit and the first frame stay inside the shown photo", () => {
  const display = fitContain({ width: 4000, height: 3000 }, { width: 400, height: 600 });
  assert.deepEqual(display, { x: 0, y: 150, width: 400, height: 300 });
  const crop = initialCrop(display);
  assert.ok(crop.x >= display.x && crop.y >= display.y);
  assert.ok(crop.x + crop.width <= display.x + display.width && crop.y + crop.height <= display.y + display.height);
});

test("dragging moves or resizes without leaving the photo or collapsing", () => {
  const bounds = { x: 0, y: 100, width: 400, height: 300 };
  const start = { x: 100, y: 200, width: 200, height: 100 };
  assert.deepEqual(dragCrop(start, "move", -500, -500, bounds), { x: 0, y: 100, width: 200, height: 100 });
  assert.deepEqual(dragCrop(start, "move", 500, 500, bounds), { x: 200, y: 300, width: 200, height: 100 });
  assert.deepEqual(dragCrop(start, "br", 1000, 1000, bounds), { x: 100, y: 200, width: 300, height: 200 });
  const shrunk = dragCrop(start, "tl", 1000, 1000, bounds, 48);
  assert.equal(shrunk.width, 48);
  assert.equal(shrunk.height, 48);
  assert.equal(shrunk.x + shrunk.width, 300);
});

test("photo crop never includes pixels outside the on-screen frame", () => {
  const display = { x: 0, y: 150, width: 400, height: 300 };
  const image = { width: 4000, height: 3000 };
  const crop = displayToImageCrop({ x: 10.05, y: 160.05, width: 100, height: 50 }, display, image);
  assert.ok(crop.originX >= 100.5 && crop.originY >= 100.5);
  assert.ok(crop.originX + crop.width <= 1105.5 && crop.originY + crop.height <= 600.5);
  const whole = displayToImageCrop(display, display, image);
  assert.deepEqual(whole, { originX: 0, originY: 0, width: 4000, height: 3000 });
});

test("long edge cap and stroke paths", () => {
  assert.equal(capLongEdge({ width: 1000, height: 800 }, 2048), null);
  assert.deepEqual(capLongEdge({ width: 4000, height: 3000 }, 2048), { width: 2048, height: null });
  assert.deepEqual(capLongEdge({ width: 3000, height: 4000 }, 2048), { width: null, height: 2048 });
  assert.equal(strokePath([{ x: 1, y: 2 }]), "M1.0 2.0 L1.0 2.0");
  assert.equal(strokePath([{ x: 1, y: 2 }, { x: 3, y: 4 }]), "M1.0 2.0 L3.0 4.0");
});

test("Android hands the image and prompt only to the ChatGPT app", () => {
  const kotlin = read("modules/chatgpt-share/android/src/main/java/expo/modules/chatgptshare/ChatGptShareModule.kt");
  assert.match(kotlin, new RegExp(`"${CHATGPT_PACKAGE.replace(/\./g, "\\.")}"`));
  assert.match(kotlin, /setPackage\(CHATGPT_PACKAGE\)/);
  assert.match(kotlin, /Intent\.ACTION_SEND\)/);
  assert.match(kotlin, /EXTRA_STREAM/);
  assert.match(kotlin, /EXTRA_TEXT, prompt/);
  assert.match(kotlin, /FLAG_GRANT_READ_URI_PERMISSION/);
  assert.match(read("modules/chatgpt-share/android/src/main/AndroidManifest.xml"), /<package android:name="com\.openai\.chatgpt" \/>/);
  assert.equal(JSON.parse(read("modules/chatgpt-share/expo-module.config.json")).android.modules[0], "expo.modules.chatgptshare.ChatGptShareModule");
});

test("medicine-bag files are temporary and the sent copy is what the preview shows", () => {
  const screen = read("src/MedicineBagAnalysis.tsx");
  assert.match(screen, /captureRef\(previewRef/);
  assert.match(screen, /strokes\.length\s*\?/);
  assert.match(screen, /state === "active" && shared\.current/);
  assert.doesNotMatch(screen, /documentDirectory|onAppend/, "nothing is saved to the patient record");
  assert.match(read("src/medicineBagFiles.ts"), /cacheDirectory/);
  assert.match(read("App.tsx"), /useEffect\(\(\) => \{ void clearMedicineBagFiles\(\); \}, \[\]\)/);
  assert.match(read("src/PatientNoteScreen.tsx"), /<MedicineBagAnalysis\b/);
});
