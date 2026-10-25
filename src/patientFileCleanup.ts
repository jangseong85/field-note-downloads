/** Failed paths remain available for an explicit retry; no patient paths are logged. */
export class PatientFileCleanup {
  private pending = new Set<string>();
  private running: Promise<number> | null = null;
  constructor(private deleteFile: (uri: string) => Promise<void>, private retained: (uri: string) => boolean = () => false) {}
  async remove(uris: (string | null | undefined)[]): Promise<number> {
    uris.forEach(uri => { if (uri) this.pending.add(uri); });
    return this.retry();
  }
  async retry(): Promise<number> {
    if (this.running) {
      await this.running;
      return this.retry();
    }
    this.running = (async () => {
      await Promise.all([...this.pending].map(async uri => {
        if (this.retained(uri)) { this.pending.delete(uri); return; }
        try { await this.deleteFile(uri); this.pending.delete(uri); }
        catch { /* Retain the URI until the user retries. */ }
      }));
      return this.pending.size;
    })();
    try { return await this.running; }
    finally { this.running = null; }
  }
}
