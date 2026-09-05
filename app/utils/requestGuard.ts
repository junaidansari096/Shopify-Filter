export interface GuardedRequest {
  signal: AbortSignal;
}

/**
 * Ensures only the most recent request is authoritative by aborting any
 * previously issued controller. This prevents stale responses from
 * overwriting a newer filter selection when shoppers click quickly.
 */
export class LatestRequestGuard {
  private controller: AbortController | null = null;

  next(): GuardedRequest {
    if (this.controller) {
      this.controller.abort();
    }
    this.controller = new AbortController();
    return { signal: this.controller.signal };
  }

  get aborted(): boolean {
    return this.controller?.signal.aborted ?? false;
  }

  abortCurrent(): void {
    this.controller?.abort();
  }

  clear(): void {
    this.controller = null;
  }
}
