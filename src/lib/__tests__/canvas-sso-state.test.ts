// @vitest-environment node
import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

class FakeWorker extends EventEmitter {
  static instances: FakeWorker[] = [];
  postMessage = vi.fn();
  terminate = vi.fn(() => Promise.resolve(1));
  constructor() {
    super();
    FakeWorker.instances.push(this);
  }
}

vi.mock("node:worker_threads", () => ({ Worker: FakeWorker }));
vi.mock("@/lib/sso-input-relay", () => ({ subscribeSsoInputs: () => () => undefined }));

const { startSession, hasActiveSession, terminateSessionIfCurrent } = await import(
  "../canvas-sso-state"
);

function start(sessionId: string) {
  const enqueue = vi.fn();
  const close = vi.fn();
  const onTerminate = vi.fn();
  const ok = startSession("user_1", sessionId, "u", "p", enqueue, close, vi.fn(), onTerminate);
  return { ok, enqueue, close, onTerminate, worker: FakeWorker.instances.at(-1)! };
}

describe("canvas-sso-state retry isolation", () => {
  beforeEach(() => {
    terminateSessionIfCurrent("user_1", "a");
    terminateSessionIfCurrent("user_1", "b");
    FakeWorker.instances.length = 0;
  });

  it("closes the superseded stream and keeps the new login alive", () => {
    const first = start("a");
    const second = start("b");
    expect(first.ok && second.ok).toBe(true);

    // The old stream is told why and closed; its resources are released.
    expect(first.enqueue).toHaveBeenCalledWith("error", expect.objectContaining({ message: expect.stringMatching(/newer Canvas login/) }));
    expect(first.close).toHaveBeenCalled();
    expect(first.onTerminate).toHaveBeenCalledTimes(1);

    // terminate() makes the old worker exit non-zero — that must not end "b".
    first.worker.emit("exit", 1);
    first.worker.emit("error", new Error("late"));
    first.worker.emit("message", { type: "error", message: "late" });

    expect(hasActiveSession("user_1")).toBe(true);
    expect(second.onTerminate).not.toHaveBeenCalled();
    expect(second.close).not.toHaveBeenCalled();
    expect(second.enqueue).not.toHaveBeenCalled();
  });

  it("still ends the current login when its own worker exits", () => {
    const only = start("a");
    only.worker.emit("exit", 1);
    expect(hasActiveSession("user_1")).toBe(false);
    expect(only.enqueue).toHaveBeenCalledWith("error", { message: "Browser process exited unexpectedly." });
    expect(only.close).toHaveBeenCalled();
    expect(only.onTerminate).toHaveBeenCalledTimes(1);
  });
});
