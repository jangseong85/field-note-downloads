import { emptyWorkspace, restoreWorkspace, STORAGE_KEY, type FormState, type PatientWorkspace } from "./patientWorkspace";
import { updatePatientById } from "./patientUpdates";

type Storage = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<unknown> };
type Snapshot = { workspace: PatientWorkspace; status: "loading" | "ready" | "error"; busy: boolean };

/** Owns the authoritative workspace and serializes every durable mutation. */
export class PatientStorage {
  private snapshot: Snapshot = { workspace: emptyWorkspace(), status: "loading", busy: false };
  private listeners = new Set<() => void>();
  private queue: Promise<void> = Promise.resolve();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private restoring: Promise<void> | null = null;

  constructor(private storage: Storage, private onSaveError: () => void, private delay = 250) {}

  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  private publish(patch: Partial<Snapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach(listener => listener());
  }
  private assertReady() {
    if (this.snapshot.status !== "ready") throw new Error("Patient recovery required");
  }
  private enqueue(action: () => Promise<void>) {
    const task = this.queue.catch(() => undefined).then(action);
    this.queue = task;
    return task;
  }
  private cancelTimer() {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }
  private scheduleSave() {
    this.cancelTimer();
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush().catch(this.onSaveError);
    }, this.delay);
  }

  restore(): Promise<void> {
    if (this.restoring) return this.restoring;
    if (this.snapshot.status === "ready") return Promise.resolve();
    this.publish({ status: "loading" });
    this.restoring = (async () => {
      try {
        const workspace = restoreWorkspace(await this.storage.getItem(STORAGE_KEY));
        this.publish({ workspace, status: "ready" });
      } catch {
        this.publish({ status: "error" });
      } finally {
        this.restoring = null;
      }
    })();
    return this.restoring;
  }

  edit(update: (form: FormState) => FormState) {
    this.assertReady();
    if (this.snapshot.busy) return;
    this.publish({ workspace: updatePatientById(this.snapshot.workspace, this.snapshot.workspace.activeId, update) });
    this.scheduleSave();
  }
  select(id: string, newForm?: FormState) {
    this.assertReady();
    if (this.snapshot.busy) return;
    const workspace = this.snapshot.workspace;
    const patients = newForm ? [...workspace.patients, { id, form: newForm }] : workspace.patients;
    if (!patients.some(patient => patient.id === id)) return;
    this.publish({ workspace: { ...workspace, activeId: id, patients } });
    this.scheduleSave();
  }
  flush() {
    this.cancelTimer();
    if (this.snapshot.status !== "ready" || this.snapshot.busy) return this.queue.catch(() => undefined);
    return this.enqueue(async () => {
      this.assertReady();
      this.cancelTimer();
      await this.storage.setItem(STORAGE_KEY, JSON.stringify(this.snapshot.workspace));
    });
  }
  commit(patientId: string, update: (form: FormState) => FormState) {
    this.assertReady();
    if (this.snapshot.busy) return Promise.reject(new Error("Patient change in progress"));
    return this.enqueue(async () => {
      const before = this.snapshot.workspace;
      const workspace = updatePatientById(before, patientId, update);
      await this.storage.setItem(STORAGE_KEY, JSON.stringify(workspace));
      // Keep typing/selection that happened while the write was pending.
      const latest = updatePatientById(this.snapshot.workspace, patientId, update);
      const changedDuringWrite = this.snapshot.workspace !== before;
      this.publish({ workspace: latest });
      if (changedDuringWrite) this.scheduleSave();
    });
  }
  async replace(plan: (workspace: PatientWorkspace) => PatientWorkspace) {
    this.assertReady();
    if (this.snapshot.busy) throw new Error("Patient change in progress");
    this.cancelTimer();
    this.publish({ busy: true });
    try {
      await this.enqueue(async () => {
        const workspace = plan(this.snapshot.workspace);
        await this.storage.setItem(STORAGE_KEY, JSON.stringify(workspace));
        this.cancelTimer();
        this.publish({ workspace });
      });
    } catch (error) {
      this.scheduleSave();
      throw error;
    } finally {
      this.publish({ busy: false });
    }
  }
}
