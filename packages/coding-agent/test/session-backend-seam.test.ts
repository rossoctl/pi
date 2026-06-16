import { describe, expect, it } from "vitest";
import type { FileEntry } from "../src/core/session-manager.ts";
import { SessionManager } from "../src/core/session-manager.ts";
import type { SessionStorageBackend } from "../src/core/session-storage-backend.ts";

/** In-memory backend that pushes synchronously (so fire-and-forget writes are observable). */
class FakeBackend implements SessionStorageBackend {
	store = new Map<string, FileEntry[]>();
	append(sessionId: string, entry: FileEntry): Promise<void> {
		const arr = this.store.get(sessionId) ?? [];
		arr.push(entry);
		this.store.set(sessionId, arr);
		return Promise.resolve();
	}
	read(sessionId: string, fromPosition = 1): Promise<FileEntry[]> {
		return Promise.resolve((this.store.get(sessionId) ?? []).slice(fromPosition - 1));
	}
	latestCheckpoint(sessionId: string): Promise<FileEntry | null> {
		const arr = (this.store.get(sessionId) ?? []).filter(
			(e) => e.type === "custom" && (e as { customType?: string }).customType === "checkpoint",
		);
		return Promise.resolve(arr.length ? arr[arr.length - 1] : null);
	}
	list(): Promise<string[]> {
		return Promise.resolve([...this.store.keys()]);
	}
}

describe("SessionManager backend seam", () => {
	it("persists a turn to the backend and resumes an identical tree in a fresh instance", async () => {
		const backend = new FakeBackend();
		const sm = SessionManager.create(process.cwd(), undefined, undefined, backend);
		const sid = sm.getSessionId();

		sm.appendMessage({ role: "user", content: "hello" } as never);
		sm.appendMessage({ role: "assistant", content: "hi there" } as never);
		sm.appendCustomEntry("checkpoint", { ctx: "reconstructed" });
		sm.appendMessage({ role: "user", content: "again" } as never);

		// Header + 4 entries landed in the backend, in order.
		const stored = backend.store.get(sid)!;
		expect(stored[0].type).toBe("session");
		expect(stored.map((e) => e.type)).toEqual(["session", "message", "message", "custom", "message"]);

		// Fresh instance reconstructs the identical entry list.
		const resumed = await SessionManager.openFromBackend(sid, backend, process.cwd());
		expect(resumed.getEntries().map((e) => JSON.stringify(e))).toEqual(sm.getEntries().map((e) => JSON.stringify(e)));

		// Checkpoint is findable.
		const cp = await backend.latestCheckpoint(sid);
		expect((cp as { customType?: string }).customType).toBe("checkpoint");
	});
});
