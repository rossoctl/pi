import type { FileEntry } from "./session-manager.ts";

/**
 * Pluggable storage backend for session persistence (mirrors issue #2032).
 *
 * The default is local-file persistence inside SessionManager. When an instance is
 * injected, SessionManager delegates persistence and load to it, externalizing the
 * session log (e.g. to Redis). The interface deals in Pi's native FileEntry — the
 * backend stores and returns entries verbatim (native passthrough).
 *
 * Writes are fire-and-forget from SessionManager's synchronous append path; the
 * caller (harness) is responsible for awaiting durability at turn boundaries.
 */
export interface SessionStorageBackend {
	/** Append one entry to the session's log. */
	append(sessionId: string, entry: FileEntry): Promise<void>;
	/** Read entries in append order, optionally from a 1-based position offset. */
	read(sessionId: string, fromPosition?: number): Promise<FileEntry[]>;
	/** Most recent checkpoint entry (a custom entry with customType "checkpoint"), or null. */
	latestCheckpoint(sessionId: string): Promise<FileEntry | null>;
	/** All known session ids. */
	list(): Promise<string[]>;
}
