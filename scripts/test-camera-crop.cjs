const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const path = require("node:path");
const moduleResult = { exports: {} };
new Function("module", "exports", ts.transpileModule(fs.readFileSync(path.join(__dirname, "../src/cameraCrop.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(moduleResult, moduleResult.exports);
const { guideToPhotoCrop, expandGuide } = moduleResult.exports;
test("crop uses guide position rather than assuming the center of the photo", () => {
  assert.deepEqual(guideToPhotoCrop({ width: 3000, height: 4000 }, { width: 300, height: 600 }, { x: 30, y: 150, width: 240, height: 150 }), { originX: 700, originY: 1000, width: 1600, height: 1000 });
  const shifted = guideToPhotoCrop({ width: 3000, height: 4000 }, { width: 300, height: 600 }, { x: 30, y: 210, width: 240, height: 150 });
  assert.equal(shifted.originY, 1400);
});
test("cover inverse maps back to the measured guide across portrait/landscape photos and viewports", () => {
  for (const photo of [{ width: 3024, height: 4032 }, { width: 4032, height: 3024 }, { width: 4000, height: 4000 }]) {
    for (const viewport of [{ width: 360, height: 800 }, { width: 412, height: 915 }, { width: 800, height: 360 }]) {
      const guide = { x: viewport.width * .06, y: viewport.height * .28, width: viewport.width * .88, height: Math.min(viewport.height * .5, viewport.width * .88 / 1.58) };
      const crop = guideToPhotoCrop(photo, viewport, guide);
      const scale = Math.max(viewport.width / photo.width, viewport.height / photo.height);
      const x = crop.originX * scale - (photo.width * scale - viewport.width) / 2;
      const y = crop.originY * scale - (photo.height * scale - viewport.height) / 2;
      assert.ok(Math.abs(x - guide.x) <= scale + 1e-8);
      assert.ok(Math.abs(y - guide.y) <= scale + 1e-8);
      assert.ok(Math.abs(crop.width * scale - guide.width) <= 2 * scale + 1e-8);
      assert.ok(Math.abs(crop.height * scale - guide.height) <= 2 * scale + 1e-8);
      assert.ok(crop.originX >= 0 && crop.originX + crop.width <= photo.width);
      assert.ok(crop.originY >= 0 && crop.originY + crop.height <= photo.height);
    }
  }
});
test("clips edge overlap and rejects invalid or unmeasured geometry", () => {
  assert.deepEqual(guideToPhotoCrop({ width: 3000, height: 4000 }, { width: 300, height: 400 }, { x: -10, y: -10, width: 320, height: 420 }), { originX: 0, originY: 0, width: 3000, height: 4000 });
  for (const width of [0, -1, NaN, Infinity]) assert.throws(() => guideToPhotoCrop({ width, height: 4000 }, { width: 300, height: 600 }, { x: 0, y: 0, width: 10, height: 10 }));
  assert.throws(() => guideToPhotoCrop({ width: 3000, height: 4000 }, { width: 300, height: 600 }, { x: 500, y: 0, width: 10, height: 10 }));
});
test("camera mask and crop share measured guide coordinates", () => {
  const app = fs.readFileSync(path.join(__dirname, "../App.tsx"), "utf8");
  const capture = fs.readFileSync(path.join(__dirname, "../src/identityCapture.ts"), "utf8");
  assert.match(capture, /guideToPhotoCrop\(capturedSource, viewport, expandGuide\(guide, viewport\)\)/, "crop starts from the same measured guide as the mask");
  assert.match(app, /captureIdentityDocument\(photo.uri, viewport, guide/);
  assert.match(app, /setGuideFrame\(\{ x: layout.x, y: layout.y, width: layout.width, height: layout.height \}\)/);
  assert.match(app, /guideTop \+ guideFrame.y/);
  assert.doesNotMatch(app, /portrait \? 0.62 : 0.9/);
});
test("the OCR crop keeps a margin around the guide so edge text survives a loosely held card", () => {
  const viewport = { width: 412, height: 915 };
  const guide = { x: 24.72, y: 300, width: 362.56, height: 229.47 };
  const wide = expandGuide(guide, viewport);
  assert.ok(wide.x < guide.x && wide.y < guide.y);
  assert.ok(Math.abs(wide.width - guide.width * 1.24) < 1e-6 || wide.x === 0 || wide.x + wide.width === viewport.width);
  assert.ok(Math.abs(wide.height - guide.height * 1.3) < 1e-6);
  assert.ok(wide.x >= 0 && wide.x + wide.width <= viewport.width, "never past the preview");
  const crop = guideToPhotoCrop({ width: 3024, height: 4032 }, viewport, wide);
  const tight = guideToPhotoCrop({ width: 3024, height: 4032 }, viewport, guide);
  assert.ok(crop.width > tight.width && crop.height > tight.height);
  assert.ok(crop.originX >= 0 && crop.originX + crop.width <= 3024);
  assert.match(fs.readFileSync(path.join(__dirname, "../src/identityCapture.ts"), "utf8"), /guideToPhotoCrop\(capturedSource, viewport, expandGuide\(guide, viewport\)\)/);
});
