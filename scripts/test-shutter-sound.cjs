const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const read = name => fs.readFileSync(path.join(__dirname, "..", name), "utf8");

test("wound and ID photos play the phone's shutter click and drop expo-camera's beep when the module exists", () => {
  for (const [file, call] of [
    ["src/MemoAttachments.tsx", /ShutterSound\?\.play\(\);\s+const photo = await camera\.current!\.takePictureAsync\(\{ quality: 0\.7, shutterSound: !ShutterSound \}\)/],
    ["App.tsx", /ShutterSound\?\.play\(\);\s+const photo = await cameraRef\.current\?\.takePictureAsync\(\{ quality: 1, skipProcessing: false, shutterSound: !ShutterSound \}\)/],
  ]) assert.match(read(file), call, file);
  assert.doesNotMatch(read("App.tsx"), /SoftShutter/);
  const kotlin = read("modules/shutter-sound/android/src/main/java/expo/modules/shuttersound/ShutterSoundModule.kt");
  assert.match(kotlin, /load\(MediaActionSound\.SHUTTER_CLICK\)/);
  assert.match(kotlin, /play\(MediaActionSound\.SHUTTER_CLICK\)/);
  assert.match(read("modules/shutter-sound/expo-module.config.json"), /expo\.modules\.shuttersound\.ShutterSoundModule/);
});
