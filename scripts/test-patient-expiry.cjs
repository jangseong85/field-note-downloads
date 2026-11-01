const test = require("node:test");
const assert = require("node:assert/strict");
const load = require("./load-ts.cjs");
const { PatientStorage } = load("patientStorage");
const { emptyWorkspace, isBlankForm, migrateStoredForm, planPatientExpiry, restoreWorkspace, PATIENT_RETENTION_MS, STORAGE_KEY } = load("patientWorkspace");
const DAY = PATIENT_RETENTION_MS;
const record = (id, createdAt, name = id) => ({ id, form: { ...migrateStoredForm({}), name }, ...(createdAt === undefined ? {} : { createdAt }) });

test("retention period is 24 hours", () => assert.equal(DAY, 24 * 60 * 60 * 1000));

test("legacy records without createdAt get a full period from the first check instead of being deleted", () => {
  const plan = planPatientExpiry({ version: 2, activeId: "A", patients: [record("A")] }, 1000, "blank");
  assert.equal(plan.changed, true);
  assert.deepEqual(plan.removed, []);
  assert.equal(plan.next.patients[0].createdAt, 1000);
  assert.equal(planPatientExpiry(plan.next, 1000 + DAY - 1, "blank").changed, false);
});

test("records 24 hours or older are removed, newer ones kept, active patient preserved when it survives", () => {
  const now = 10 * DAY;
  const workspace = { version: 2, activeId: "new", patients: [record("old", now - DAY), record("new", now - DAY + 1)] };
  const plan = planPatientExpiry(workspace, now, "blank");
  assert.deepEqual(plan.removed.map(p => p.id), ["old"]);
  assert.deepEqual(plan.next.patients.map(p => p.id), ["new"]);
  assert.equal(plan.next.activeId, "new");
});

test("an expired active patient moves to the newest remaining one; all expired leaves one blank patient", () => {
  const now = 10 * DAY;
  const moved = planPatientExpiry({ version: 2, activeId: "old", patients: [record("old", 0), record("B", now), record("C", now)] }, now, "blank");
  assert.equal(moved.next.activeId, "C");
  const empty = planPatientExpiry({ version: 2, activeId: "old", patients: [record("old", 0)] }, now, "blank");
  assert.deepEqual(empty.next.patients.map(p => [p.id, p.createdAt]), [["blank", now]]);
  assert.equal(empty.next.activeId, "blank");
  assert.ok(isBlankForm(empty.next.patients[0].form));
  assert.ok(!isBlankForm(record("x", 0).form));
});

test("a createdAt in the future (clock moved back) is reset to now so it cannot outlive the period", () => {
  const plan = planPatientExpiry({ version: 2, activeId: "A", patients: [record("A", 50 * DAY)] }, DAY, "blank");
  assert.equal(plan.next.patients[0].createdAt, DAY);
});

test("restore keeps valid createdAt and drops invalid values", () => {
  const restored = restoreWorkspace(JSON.stringify({ version: 2, activeId: "A", patients: [record("A", 123), { ...record("B"), createdAt: "x" }] }));
  assert.equal(restored.patients[0].createdAt, 123);
  assert.equal("createdAt" in restored.patients[1], false);
});

test("store.expire stamps, persists, removes expired records and returns their files; new patients are stamped", async () => {
  let clock = 5 * DAY, saved = JSON.stringify(emptyWorkspace());
  const storage = { getItem: async key => { assert.equal(key, STORAGE_KEY); return saved; }, setItem: async (_key, value) => { saved = value; } };
  const store = new PatientStorage(storage, () => assert.fail("save error"), 60000, () => clock);
  await store.restore();
  const first = await store.expire("blank-1");
  assert.deepEqual(first.removed, []);
  assert.equal(JSON.parse(saved).patients[0].createdAt, clock, "legacy stamp is persisted");
  assert.deepEqual(await store.expire("blank-2"), { removed: [], uris: [] });
  clock += 1000;
  store.select("second", migrateStoredForm({}));
  assert.equal(store.getSnapshot().workspace.patients[1].createdAt, clock);
  await store.commit("initial", form => ({ ...form, chiefComplaintDrawing: "file:///drawing.png" }));
  clock = 6 * DAY;
  const second = await store.expire("blank-3");
  assert.deepEqual(second.removed.map(p => p.id), ["initial"]);
  assert.deepEqual(second.uris, ["file:///drawing.png"]);
  assert.deepEqual(JSON.parse(saved).patients.map(p => p.id), ["second"]);
  assert.equal(store.getSnapshot().workspace.activeId, "second");
});
