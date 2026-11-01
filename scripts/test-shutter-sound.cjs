const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const read = name => fs.readFileSync(path.join(__dirname, "..", name), "utf8");

test("wound and ID photos play the soft shutter click and drop expo-camera's beep when the module exists", () => {
  for (const [file, call] of [
    ["src/MemoAttachments.tsx", /ShutterSound\?\.play\(\);\s+const photo = await camera\.current!\.takePictureAsync\(\{ quality: 0\.7, shutterSound: !ShutterSound \}\)/],
    ["App.tsx", /ShutterSound\?\.play\(\);\s+const photo = await cameraRef\.current\?\.takePictureAsync\(\{ quality: 1, skipProcessing: false, shutterSound: !ShutterSound \}\)/],
  ]) assert.match(read(file), call, file);
  assert.doesNotMatch(read("App.tsx"), /SoftShutter/);
  const kotlin = read("modules/shutter-sound/android/src/main/java/expo/modules/shuttersound/ShutterSoundModule.kt");
  assert.match(kotlin, /it\.load\(context, R\.raw\.soft_shutter, 1\)/, "soft bundled click, not the loud system shutter");
  assert.doesNotMatch(kotlin, /MediaActionSound/);
  assert.match(kotlin, /private const val VOLUME = 0\.45f/);
  assert.ok(fs.statSync(path.join(__dirname, "../modules/shutter-sound/android/src/main/res/raw/soft_shutter.wav")).size < 20000);
  assert.match(read("modules/shutter-sound/expo-module.config.json"), /expo\.modules\.shuttersound\.ShutterSoundModule/);
});

test("the splash intro can be skipped with a tap and the built page stays light", () => {
  const app = read("App.tsx");
  assert.match(app, /accessibilityLabel="인트로 건너뛰기" onPress=\{finishIntro\} style=\{StyleSheet\.absoluteFill\}/);
  assert.doesNotMatch(app, /setShowIntro\(true\)/, "only a cold start shows the intro");
  const sync = read("scripts/sync-web-splash.mjs");
  assert.match(sync, /\(\) => `<script type="module">/, "function replacement keeps $' in the bundle from duplicating the page");
  assert.match(read("web-splash/src/App.tsx"), /field24-scene-v3\.jpg/);
  assert.match(read("web-splash/src/App.tsx"), /<span className="brand-119">119<\/span><span className="brand-bar" aria-hidden="true">\|<\/span>FIELD NOTE/);
});
