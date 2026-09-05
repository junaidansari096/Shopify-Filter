import { describe, it, expect, vi } from "vitest";
import { LatestRequestGuard } from "../app/utils/requestGuard";

describe("LatestRequestGuard (stale request protection)", () => {
  it("aborts the previous request when a new one is issued", () => {
    const guard = new LatestRequestGuard();

    const first = guard.next();
    expect(first.signal.aborted).toBe(false);

    // User clicks a second filter quickly.
    guard.next();
    // The first request's signal is now aborted.
    expect(first.signal.aborted).toBe(true);
  });

  it("marks the latest (authoritative) request as active", () => {
    const guard = new LatestRequestGuard();
    guard.next(); // superseded
    const latest = guard.next(); // authoritative
    expect(latest.signal.aborted).toBe(false);
  });

  it("allows a fetch using the signal to be cancelled on abort", () => {
    const guard = new LatestRequestGuard();
    const req = guard.next();

    const abortSpy = vi.fn();
    req.signal.addEventListener("abort", abortSpy);

    guard.next(); // abort current
    expect(abortSpy).toHaveBeenCalledTimes(1);
    expect(req.signal.aborted).toBe(true);
  });

  it("exposes whether the current request is aborted", () => {
    const guard = new LatestRequestGuard();
    guard.next();
    expect(guard.aborted).toBe(false);
    guard.next(); // aborts the prior, sets a new controller
    // The new controller is active, not aborted.
    expect(guard.aborted).toBe(false);
  });

  it("clears the controller", () => {
    const guard = new LatestRequestGuard();
    guard.next();
    guard.clear();
    expect(guard.aborted).toBe(false);
  });
});
