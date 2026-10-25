const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const load = require("./load-ts.cjs");
const { PatientStorage } = load("patientStorage");
const { PatientFileCleanup } = load("patientFileCleanup");
const { emptyWorkspace, migrateStoredForm, restoreWorkspace, STORAGE_KEY } = load("patientWorkspace");
const { planPatientWorkspaceReset } = load("patientUpdates");
function fixture(initial = emptyWorkspace(), delay = 60000) {
  let saved = JSON.stringify(initial);
  let failRead = false, failWrite = false, gate;
  const writes = [], errors = [];
  const storage = {
    getItem: async key => { assert.equal(key, STORAGE_KEY); if (failRead) throw Error("read failed"); return saved; },
    setItem: async (key, value) => {
      assert.equal(key, STORAGE_KEY);
      writes.push(JSON.parse(value));
      if (gate) await gate;
      if (failWrite) throw Error("write failed");
      saved = value;
    },
  };
  const store = new PatientStorage(storage, () => errors.push("save failed"), delay);
  return { store, writes, errors, saved: () => JSON.parse(saved), setSaved: value => { saved = value; }, readFails: value => { failRead = value; }, writeFails: value => { failWrite = value; }, gate: value => { gate = value; } };
}
const current = store => store.getSnapshot().workspace;
const form = store => current(store).patients.find(p => p.id === current(store).activeId).form;
const tick = () => new Promise(resolve => setImmediate(resolve));

test("failed restore blocks edits, selections, commits, resets and flush without overwriting saved data; retry restores it", async () => {
  const original = emptyWorkspace(); original.patients[0].form.name = "보존";
  const f = fixture(original); f.readFails(true);
  await f.store.restore();
  assert.equal(f.store.getSnapshot().status, "error");
  assert.throws(() => f.store.edit(previous => ({ ...previous, name: "잘못된 입력" })));
  assert.throws(() => f.store.select("other", migrateStoredForm({})));
  assert.throws(() => f.store.commit("initial", previous => previous));
  await assert.rejects(f.store.replace(() => emptyWorkspace()));
  await f.store.flush();
  assert.equal(f.writes.length, 0);
  assert.deepEqual(f.saved(), original);
  f.readFails(false); await f.store.restore();
  assert.equal(form(f.store).name, "보존");
  assert.equal(f.writes.length, 0, "successful recovery itself must not rewrite storage");
});

test("corrupt JSON, invalid workspaces and unknown versions remain read-only", async () => {
  for (const saved of ["{", "null", "[]", '{"version":99}', '{"version":2,"patients":[]}', '{"version":2,"patients":[{"id":"A","form":null}]}']) {
    const f = fixture(); f.setSaved(saved);
    await f.store.restore(); await f.store.flush();
    assert.equal(f.store.getSnapshot().status, "error", saved);
    assert.equal(f.writes.length, 0);
  }
  const duplicate = emptyWorkspace(); duplicate.patients.push(duplicate.patients[0]);
  assert.throws(() => restoreWorkspace(JSON.stringify(duplicate)));
});

test("legacy patient values and v2 patients retain their data and existing storage key", () => {
  const legacy = restoreWorkspace(JSON.stringify({ name: "기존 환자", bp: "120/80", measuredAt: "2026. 10. 25. 10:30", attachments: [{ id: "a", kind: "photo", uri: "file:///a.jpg", createdAt: "x" }] }));
  assert.equal(legacy.patients[0].form.name, "기존 환자");
  assert.equal(legacy.patients[0].form.measuredTime, "1030");
  assert.deepEqual(restoreWorkspace(JSON.stringify(legacy)), legacy);
  assert.equal(STORAGE_KEY, "ems-log.current-patient.v1");
  assert.equal(legacy.version, 2);
});

test("slow media commit preserves typing and patient selection; queued save persists the newest workspace", async () => {
  const f = fixture(); await f.store.restore();
  f.store.select("B", migrateStoredForm({ name: "환자 B" }));
  f.store.select("initial");
  let release; f.gate(new Promise(resolve => { release = resolve; }));
  const commit = f.store.commit("initial", previous => ({ ...previous, chiefComplaintDrawing: "file:///new.png" }));
  await tick();
  f.store.edit(previous => ({ ...previous, chiefComplaint: "저장 중 입력" }));
  f.store.select("B");
  const flush = f.store.flush();
  release(); await commit; await flush;
  assert.equal(f.saved().activeId, "B");
  assert.equal(f.saved().patients[0].form.chiefComplaint, "저장 중 입력");
  assert.equal(f.saved().patients[0].form.chiefComplaintDrawing, "file:///new.png");
  assert.equal(form(f.store).name, "환자 B");
});

test("failed media commit leaves existing record untouched and a later retry can succeed", async () => {
  const f = fixture(); await f.store.restore(); f.writeFails(true);
  await assert.rejects(f.store.commit("initial", p => ({ ...p, chiefComplaintDrawing: "file:///new.png" })));
  assert.equal(form(f.store).chiefComplaintDrawing, null);
  f.writeFails(false);
  await f.store.commit("initial", p => ({ ...p, chiefComplaintDrawing: "file:///new.png" }));
  assert.equal(f.saved().patients[0].form.chiefComplaintDrawing, "file:///new.png");
  await f.store.flush();
});

function deleteHandlers(f, deleted, alerts) {
  const source = fs.readFileSync(path.join(__dirname, "../App.tsx"), "utf8");
  const document = source.slice(source.indexOf("  const deleteDocument ="), source.indexOf("  const requestDeletePatient ="));
  const drawing = source.slice(source.indexOf("  const deleteDrawing ="), source.indexOf("  const reset ="));
  const code = ts.transpileModule(document + drawing, {compilerOptions:{module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2020}}).outputText;
  return new Function("form", "activePatientId", "commitPatientUpdate", "deleteLocalFile", "Alert", code + "; return { deleteDocument, deleteDrawing };")(
    form(f.store), "initial", (id, update) => f.store.commit(id, update), async uri => {
      const stored = f.saved().patients[0].form;
      assert.notEqual(stored.idDocument?.uri, uri);
      assert.notEqual(stored.chiefComplaintDrawing, uri);
      deleted.push(uri);
    }, {alert: (...args) => alerts.push(args)},
  );
}
for (const kind of ["document", "drawing"]) {
  test(`${kind} delete waits for durable save and preserves the file when storage fails`, async () => {
    const initial = emptyWorkspace();
    initial.patients[0].form.idDocument = { uri: "file:///id.jpg", name: null, birthDate: null, capturedAt: "x" };
    initial.patients[0].form.chiefComplaintDrawing = "file:///draw.png";
    const f = fixture(initial); await f.store.restore();
    const deleted = [], alerts = [];
    const handlers = deleteHandlers(f, deleted, alerts);
    f.writeFails(true);
    const remove = () => kind === "document" ? handlers.deleteDocument() : handlers.deleteDrawing("chiefComplaintDrawing");
    await remove();
    assert.equal(deleted.length, 0);
    assert.deepEqual(f.saved(), initial);
    assert.equal(alerts.length, 1);
    f.writeFails(false); await remove();
    assert.deepEqual(deleted, [kind === "document" ? "file:///id.jpg" : "file:///draw.png"]);
    await f.store.flush();
  });
}

test("reset waits behind pending media writes, plans from latest data and blocks input until durable", async () => {
  const f = fixture(); await f.store.restore();
  let release; f.gate(new Promise(resolve => { release = resolve; }));
  const media = f.store.commit("initial", p => ({ ...p, attachments: [{ id: "a", uri: "file:///audio.m4a", kind: "audio", createdAt: "x" }] }));
  await tick();
  let uris;
  const reset = f.store.replace(workspace => { const plan = planPatientWorkspaceReset(workspace, { id: "reset", form: migrateStoredForm({}) }); uris = plan.uris; return plan.next; });
  f.store.edit(p => ({ ...p, name: "must not edit during reset" }));
  assert.equal(form(f.store).name, "");
  assert.equal(f.store.getSnapshot().busy, true);
  release(); await media; await reset;
  assert.deepEqual(uris, ["file:///audio.m4a"]);
  assert.equal(f.saved().activeId, "reset");
  assert.deepEqual(f.saved().patients[0].form.attachments, []);
  await f.store.flush();
  assert.equal(f.saved().patients.length, 1);
});

test("failed reset keeps old data and unlocks editing", async () => {
  const f = fixture(); await f.store.restore(); f.writeFails(true);
  await assert.rejects(f.store.replace(() => ({ ...emptyWorkspace(), activeId: "other" })));
  assert.equal(current(f.store).activeId, "initial");
  assert.equal(f.store.getSnapshot().busy, false);
  f.store.edit(p => ({ ...p, name: "계속 입력" }));
  f.writeFails(false); await f.store.flush();
  assert.equal(f.saved().patients[0].form.name, "계속 입력");
});

test("file cleanup reports failures, retains retry paths and never removes a retained file", async () => {
  const attempts = [];
  let fail = true;
  const cleanup = new PatientFileCleanup(async uri => { attempts.push(uri); if (fail) throw Error("EACCES"); }, uri => uri === "shared");
  assert.equal(await cleanup.remove(["private", "private", "shared", null]), 1);
  assert.deepEqual(attempts, ["private"]);
  fail = false;
  assert.equal(await cleanup.retry(), 0);
  assert.deepEqual(attempts, ["private", "private"]);
  assert.equal(await cleanup.retry(), 0);
  assert.equal(attempts.length, 2);
});

test("background transition flushes pending input without waiting for the debounce", async () => {
  const f = fixture(); await f.store.restore();
  const effects = [];
  let onChange, removed = false;
  const hook = load("usePatientWorkspace", {
    "@react-native-async-storage/async-storage": {},
    "./patientStorage": { PatientStorage: class { constructor() { return f.store; } } },
    react: {
      useRef: value => ({current:value}), useState: init => [init()], useCallback: fn => fn,
      useSyncExternalStore: (_subscribe, snapshot) => snapshot(), useEffect: fn => effects.push(fn),
    },
    "react-native": { AppState: { addEventListener: (_name, fn) => { onChange=fn; return {remove:()=>{removed=true}}; } } },
  }).usePatientWorkspace;
  const view = hook(() => assert.fail("save must succeed"));
  const dispose = effects[0]();
  view.setForm(p => ({...p, chiefComplaint:"최신 입력"}));
  onChange("background"); await tick();
  assert.equal(f.saved().patients[0].form.chiefComplaint, "최신 입력");
  dispose(); await tick(); assert.equal(removed,true);
});

test("autosave debounces typing, reports a failed write and can flush the latest input on retry", async () => {
  const f = fixture(emptyWorkspace(), 5); await f.store.restore();
  f.writeFails(true);
  f.store.edit(p => ({...p, name:"이전 입력"}));
  f.store.edit(p => ({...p, name:"최신 입력"}));
  await new Promise(resolve => setTimeout(resolve, 25));
  assert.equal(f.writes.length,1);
  assert.equal(f.errors.length,1);
  assert.equal(form(f.store).name,"최신 입력");
  assert.equal(f.saved().patients[0].form.name,"");
  f.writeFails(false); await f.store.flush();
  assert.equal(f.saved().patients[0].form.name,"최신 입력");
});

test("cleanup hook exposes retry and retries outstanding private files when the app becomes active", async () => {
  let fail=true, onChange, removed=false;
  const effects=[], alerts=[], deleted=[];
  const {usePatientFileCleanup} = load("usePatientFileCleanup", {
    react:{useRef:value=>({current:value}), useState:init=>[init()], useCallback:fn=>fn, useEffect:fn=>effects.push(fn)},
    "react-native":{AppState:{addEventListener:(_name,fn)=>{onChange=fn;return {remove:()=>{removed=true}}}}},
    "expo-file-system/legacy":{deleteAsync:async uri=>{if(fail) throw Error("EACCES"); deleted.push(uri)}},
    "./NoteDialogs":{useNoteAlert:()=> (...args)=>alerts.push(args)},
  });
  const cleanup=usePatientFileCleanup(uri=>uri==="shared");
  const dispose=effects[0]();
  await cleanup(["private","shared"]);
  assert.equal(alerts.length,1);
  const retry=alerts[0][2].find(button=>button.text==="재시도");
  assert.ok(retry);
  fail=false; await retry.onPress();
  assert.deepEqual(deleted,["private"]);
  fail=true; await cleanup(["another"]);
  fail=false; onChange("active"); await tick();
  assert.deepEqual(deleted,["private","another"]);
  dispose(); assert.equal(removed,true);
});

test("failed recovery renders a retry screen before exposing the patient editor", () => {
  const source=fs.readFileSync(path.join(__dirname,"../App.tsx"),"utf8");
  const recovery=source.indexOf('if (recoveryStatus === "error")');
  assert.ok(recovery>0 && recovery<source.indexOf("<PatientNoteScreen"));
  const screen=source.slice(recovery,source.indexOf("if (!loaded",recovery));
  assert.match(screen,/기록 보호를 위해 입력과 저장을 중지했습니다/);
  assert.match(screen,/store\.restore\(\)/);
  assert.doesNotMatch(source,/Promise\.all\(\[\s*AsyncStorage\.getItem\(STORAGE_KEY\)/);
});
