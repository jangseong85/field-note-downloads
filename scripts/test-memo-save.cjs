const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const test = require("node:test");
function load(name) {
  const compiled = { exports: {} };
  const source = fs.readFileSync(path.join(__dirname, `../src/${name}.ts`), "utf8");
  new Function("module", "exports", ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText)(compiled, compiled.exports);
  return compiled.exports;
}
const { createMediaSaveTask, runMediaSave } = load("mediaSave");
const { updatePatientById, planPatientWorkspaceReset } = load("patientUpdates");
test("explicit all-patient reset removes all records and deduplicates patient-owned files", () => {
  const form = (id) => ({ name: id, idDocument: { uri: `file:///id-${id}` }, chiefComplaintDrawing: "file:///shared", historyDrawing: null, attachments: [{ uri: `file:///audio-${id}` }] });
  const original = { version: 2, activeId: "B", patients: [{ id: "A", form: form("A") }, { id: "B", form: form("B") }] };
  const before = JSON.stringify(original);
  const blank = { id: "fresh", form: { name: "", idDocument: null, chiefComplaintDrawing: null, historyDrawing: null, attachments: [] } };
  const { next, uris } = planPatientWorkspaceReset(original, blank);
  assert.deepEqual(next, { version: 2, activeId: "fresh", patients: [blank] });
  assert.deepEqual(uris.sort(), ["file:///id-A", "file:///id-B", "file:///shared", "file:///audio-A", "file:///audio-B"].sort());
  assert.equal(JSON.stringify(original), before);
  assert.equal(uris.some(uri => uri.includes("sals")), false);
  const app = fs.readFileSync(path.join(__dirname, "../App.tsx"), "utf8");
  const reset = app.slice(app.indexOf("const reset ="), app.indexOf("const openIdentityCamera ="));
  assert.ok(reset.indexOf("await store.replace(") >= 0);
  assert.ok(reset.indexOf("await store.replace(") < reset.indexOf("await cleanupFiles(uris)"));
  assert.doesNotMatch(reset, /AsyncStorage\.clear|removeItem|multiRemove/);
});
function fixture() {
  const source = "file:///cache/recording.m4a";
  const files = new Set([source]);
  let moves = 0;
  const operations = {
    makeDirectoryAsync: async () => {},
    moveAsync: async ({ from, to }) => {
      assert.ok(files.has(from));
      moves++;
      files.delete(from);
      files.add(to);
    },
  };
  const task = createMediaSaveTask(source, "file:///documents/patient-attachments/", "audio.m4a", uri => ({ id: "audio", uri }));
  return { source, files, operations, task, moves: () => moves };
}
test("successful registration leaves no duplicate patient file in cache", async () => {
  const f = fixture();
  const registered = [];
  await runMediaSave(f.task, f.operations, async attachment => { registered.push(attachment); });
  assert.equal(f.files.has(f.source), false);
  assert.equal(f.files.has(f.task.savedUri), true);
  assert.deepEqual(registered, [f.task.value]);
  assert.equal(f.task.committed, true);
});
test("move failure retains source and retry saves that same recording", async () => {
  const f = fixture();
  await assert.rejects(runMediaSave(f.task, { ...f.operations, moveAsync: async () => { throw Error("storage unavailable"); } }, async () => assert.fail("must not commit")));
  assert.equal(f.files.has(f.source), true);
  assert.equal(f.task.moved, false);
  await runMediaSave(f.task, f.operations, async () => {});
  assert.equal(f.task.committed, true);
  assert.equal(f.moves(), 1);
});
test("registration failure retains the moved recording and retries without moving or duplicating it", async () => {
  const f = fixture();
  await assert.rejects(runMediaSave(f.task, f.operations, async () => { throw Error("storage full"); }));
  assert.equal(f.task.moved, true);
  assert.equal(f.task.committed, false);
  assert.equal(f.files.has(f.task.savedUri), true);
  let registrations = 0;
  await runMediaSave(f.task, f.operations, async () => { registrations++; });
  await runMediaSave(f.task, f.operations, async () => { registrations++; });
  assert.equal(registrations, 1);
  assert.equal(f.moves(), 1);
});
test("slow drawing save only changes its original patient, even after selection changes", async () => {
  const f = fixture();
  let workspace = { version: 2, activeId: "A", patients: [{ id: "A", form: { drawing: null, memo: "A" } }, { id: "B", form: { drawing: null, memo: "B" } }] };
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const pending = runMediaSave(f.task, { ...f.operations, makeDirectoryAsync: () => gate }, async attachment => {
    workspace = updatePatientById(workspace, "A", form => ({ ...form, drawing: attachment.uri }));
  });
  workspace = { ...workspace, activeId: "B" };
  release();
  await pending;
  assert.equal(workspace.activeId, "B");
  assert.equal(workspace.patients[0].form.drawing, f.task.savedUri);
  assert.equal(workspace.patients[1].form.drawing, null);
  assert.equal(workspace.patients[1].form.memo, "B");
});
test("late save cannot resurrect a deleted patient or overwrite another patient's form", async () => {
  const workspace = { version: 2, activeId: "B", patients: [{ id: "B", form: { memo: "keep" } }] };
  assert.throws(() => updatePatientById(workspace, "A", form => ({ ...form, memo: "wrong" })));
  assert.equal(workspace.patients[0].form.memo, "keep");
});
test("handwriting modal awaits durable saving and keeps its close guard until completion", () => {
  const source = fs.readFileSync(path.join(__dirname, "../App.tsx"), "utf8");
  const modal = source.slice(source.indexOf("function HandwritingModal("), source.indexOf("const PRETENDARD_BY_WEIGHT"));
  assert.match(modal, /await onSave\(uri\)/);
  assert.match(modal, /onSave: \(uri: string\) => Promise<void>/);
  assert.match(modal, /onRequestClose=\{\(\) => \{ if \(!savingRef.current\) onClose\(\); \}\}/);
  assert.doesNotMatch(source, /onSave=\{\(uri\) => void saveDrawing\(uri\)\}/);
});
test("recording failures retain a retry task and prevent a new recording from replacing it", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/MemoAttachments.tsx"), "utf8");
  assert.match(source, /onBusyChange\(pendingAudio.current !== null\)/);
  assert.match(source, /recordingRef.current \|\| pendingAudio.current/);
  assert.match(source, /녹취 저장 재시도/);
  assert.match(source, /await runMediaSave\(pending.task, FileSystem, pending.commit\)/);
  assert.doesNotMatch(source, /copyAsync/);
});
test("actual recording stop handler retries registration without stopping or recording again", async () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/MemoAttachments.tsx"), "utf8");
  const handler = source.slice(source.indexOf("  async function stopRecording()"), source.indexOf("  const stopRef"));
  const f = fixture();
  let stops = 0, storageWrites = 0, busy = true, retryVisible = false, recordingVisible = true;
  const recordingRef = { current: true }, pendingAudio = { current: null }, operation = { current: false };
  const recorder = { uri: f.source, getStatus: () => ({ durationMillis: 5000, isRecording: recordingRef.current }), stop: async () => { stops++; recordingRef.current = false; } };
  const commit = async () => { storageWrites++; if (storageWrites === 1) throw Error("full"); };
  const code = ts.transpileModule(handler, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const stop = new Function("operation", "recordingRef", "pendingAudio", "setWorking", "recorder", "setRecording", "prepareFile", "recordingOwner", "setAudioNeedsRetry", "runMediaSave", "FileSystem", "Alert", "setAudioModeAsync", "onBusyChange", code + "\nreturn stopRecording;")(
    operation, recordingRef, pendingAudio, () => {}, recorder, value => { recordingVisible = value; }, () => ({ task: f.task, commit }), { current: commit }, value => { retryVisible = value; }, runMediaSave, f.operations, { alert: () => {} }, async () => {}, value => { busy = value; },
  );
  await stop();
  assert.equal(recordingVisible, false);
  assert.equal(retryVisible, true);
  assert.equal(busy, true);
  assert.ok(pendingAudio.current);
  assert.equal(f.files.has(f.task.savedUri), true);
  await stop();
  assert.equal(stops, 1);
  assert.equal(storageWrites, 2);
  assert.equal(retryVisible, false);
  assert.equal(busy, false);
  assert.equal(pendingAudio.current, null);
  assert.equal(f.moves(), 1);
});
test("actual drawing handler binds to patient A while a delayed file transfer completes after selection changes", async () => {
  const source = fs.readFileSync(path.join(__dirname, "../App.tsx"), "utf8");
  const handler = source.slice(source.indexOf("  const saveDrawing = async"), source.indexOf("  const closeDrawing = async"));
  let workspace = { version: 2, activeId: "A", patients: [{ id: "A", form: { chiefComplaintDrawing: null } }, { id: "B", form: { chiefComplaintDrawing: null } }] };
  const workspaceRef = { current: workspace }, drawingSaveTask = { current: null }, drawingSaveBusy = { current: false };
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const files = { documentDirectory: "file:///documents/", makeDirectoryAsync: () => gate, moveAsync: async () => {} };
  const commit = async (id, update) => { workspace = updatePatientById(workspace, id, update); workspaceRef.current = workspace; };
  const code = ts.transpileModule(handler, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const save = new Function("drawingSaveBusy", "drawingTarget", "FileSystem", "drawingSaveTask", "activePatientId", "form", "createMediaSaveTask", "runMediaSave", "commitPatientUpdate", "setDrawingTarget", "store", "deleteLocalFile", code + "\nreturn saveDrawing;")(drawingSaveBusy, "chiefComplaintDrawing", files, drawingSaveTask, "A", workspace.patients[0].form, createMediaSaveTask, runMediaSave, commit, () => {}, { getSnapshot: () => ({ workspace: workspaceRef.current }) }, async () => {});
  const pending = save("file:///cache/A.png");
  assert.equal(drawingSaveBusy.current, true);
  workspace = { ...workspace, activeId: "B" };
  workspaceRef.current = workspace;
  release();
  await pending;
  assert.equal(workspace.patients[1].form.chiefComplaintDrawing, null);
  assert.ok(workspace.patients[0].form.chiefComplaintDrawing);
  assert.equal(drawingSaveBusy.current, false);
});
test("paused recordings resume in place and missing files are reported before playback", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/MemoAttachments.tsx"), "utf8");
  const play = source.slice(source.indexOf("async function play("), source.indexOf("  return (", source.indexOf("async function play(")));
  const resume = play.indexOf("playingId === item.id && playback.isLoaded");
  assert.ok(resume > 0 && resume < play.indexOf("player.replace(item.uri)"), "same recording resumes before any replace");
  assert.match(play.slice(resume, play.indexOf("return;", resume)), /player\.play\(\)/);
  assert.ok(play.indexOf("FileSystem.getInfoAsync(item.uri)") < play.indexOf("player.replace(item.uri)"));
  assert.match(play, /!info\.exists \|\| info\.size === 0/);
});
