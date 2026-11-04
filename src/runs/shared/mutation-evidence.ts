import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { ArtifactPaths, TimeoutRecoveryProjection, TimeoutRecoverySummary, TrackedMutationEvidence, TrackedMutationFingerprint, TrackedMutationSnapshot } from "../../shared/types.ts";

const MAX_TRACKED_PATHS = 500;
const MAX_HASH_BYTES = 1024 * 1024;
const MAX_TIMEOUT_FILES = 20;

function gitArguments(args: string[]): string[] {
	// Mutation evidence must not block child startup on a stale fsmonitor daemon.
	return ["-c", "core.fsmonitor=false", ...args];
}

/**
 * Async git calls (2026-09-12 execSync→async conversion): error shape aligned with execFileSync (err.stdout/stderr).
 * Performance red line: execFileSync/spawnSync must never be reintroduced inside the pi extension process.
 */
function gitOutput(cwd: string, args: string[], maxBuffer = MAX_HASH_BYTES): Promise<string> {
	return new Promise((resolve, reject) => {
		execFile("git", gitArguments(args), { cwd, encoding: "utf-8", maxBuffer, windowsHide: true }, (err, stdout) => {
			if (err) { (err as Error & { stdout?: string }).stdout = typeof stdout === "string" ? stdout : ""; reject(err); }
			else resolve(String(stdout ?? ""));
		});
	});
}

function splitNul(output: string): string[] {
	return output.split("\0").filter((part) => part.length > 0);
}

async function hashLargeDiff(cwd: string, relativePath: string): Promise<string> {
	const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-subagents-tracked-diff-"));
	const diffPath = path.join(tempDir, "diff.patch");
	try {
		await new Promise<void>((resolve, reject) => {
			execFile("git", gitArguments(["diff", "--no-ext-diff", "--binary", `--output=${diffPath}`, "HEAD", "--", relativePath]), { cwd, windowsHide: true }, (err: Error | null) => (err ? reject(err) : resolve()));
		});
		const hash = createHash("sha256");
		const buffer = Buffer.allocUnsafe(64 * 1024);
		const fd = fs.openSync(diffPath, "r");
		try {
			let chunks = 0;
			for (;;) {
				const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, null);
				if (bytesRead === 0) break;
				hash.update(buffer.subarray(0, bytesRead));
				// Large-diff hashing yields to the event loop (2026-10-10): yield once every 32 chunks (~2MB) to avoid monopolizing it for long stretches.
				if (++chunks % 32 === 0) await new Promise<void>((resolve) => setImmediate(resolve));
			}
		} finally {
			fs.closeSync(fd);
		}
		return hash.digest("hex");
	} finally {
		fs.rmSync(tempDir, { recursive: true, force: true });
	}
}

async function listChangedTrackedFiles(cwd: string): Promise<{ paths: string[]; truncated: boolean }> {
	const paths = splitNul(await gitOutput(cwd, ["diff", "--no-ext-diff", "--name-only", "-z", "HEAD", "--"], MAX_HASH_BYTES));
	return { paths: paths.slice(0, MAX_TRACKED_PATHS), truncated: paths.length > MAX_TRACKED_PATHS };
}

async function fingerprintPath(cwd: string, relativePath: string): Promise<TrackedMutationFingerprint> {
	try {
		const diff = await gitOutput(cwd, ["diff", "--no-ext-diff", "--binary", "HEAD", "--", relativePath], MAX_HASH_BYTES);
		return { kind: "diff", digest: createHash("sha256").update(diff).digest("hex") };
	} catch {
		return { kind: "diff", digest: await hashLargeDiff(cwd, relativePath) };
	}
}

function sameFingerprint(left: TrackedMutationFingerprint | undefined, right: TrackedMutationFingerprint): boolean {
	if (!left || left.kind !== "diff" || right.kind !== "diff") return false;
	return left.digest === right.digest;
}

export async function snapshotTrackedMutations(cwd: string): Promise<TrackedMutationSnapshot> {
	try {
		const changed = await listChangedTrackedFiles(cwd);
		const fingerprints: Record<string, TrackedMutationFingerprint> = {};
		for (const file of changed.paths) fingerprints[file] = await fingerprintPath(cwd, file);
		return { source: "tracked-files", trackedOnly: true, cwd, dirtyFiles: changed.paths, fingerprints, truncated: changed.truncated };
	} catch (error) {
		return { source: "tracked-files", trackedOnly: true, cwd, dirtyFiles: [], fingerprints: {}, unavailable: error instanceof Error ? error.message : String(error) };
	}
}

export async function collectTrackedMutationEvidence(snapshot: TrackedMutationSnapshot, cwd = snapshot.cwd): Promise<TrackedMutationEvidence> {
	if (snapshot.unavailable) {
		return { source: "tracked-files", trackedOnly: true, changedFiles: [], attemptedMutation: false, unavailable: snapshot.unavailable };
	}
	try {
		const current = await listChangedTrackedFiles(cwd);
		const startDirty = new Set(snapshot.dirtyFiles);
		const candidates = new Set([...snapshot.dirtyFiles, ...current.paths]);
		const changedFiles: string[] = [];
		for (const file of candidates) {
			if (!startDirty.has(file)) {
				if (!snapshot.truncated) changedFiles.push(file);
				continue;
			}
			if (!sameFingerprint(snapshot.fingerprints[file], await fingerprintPath(cwd, file))) changedFiles.push(file);
		}
		changedFiles.sort();
		return {
			source: "tracked-files",
			trackedOnly: true,
			changedFiles,
			attemptedMutation: changedFiles.length > 0,
			truncated: snapshot.truncated || current.truncated || undefined,
		};
	} catch (error) {
		return { source: "tracked-files", trackedOnly: true, changedFiles: [], attemptedMutation: false, unavailable: error instanceof Error ? error.message : String(error) };
	}
}

function formatPathList(paths: string[]): string {
	if (paths.length === 0) return "none";
	const shown = paths.slice(0, MAX_TIMEOUT_FILES).join(", ");
	return paths.length > MAX_TIMEOUT_FILES ? `${shown}, ... (${paths.length - MAX_TIMEOUT_FILES} more)` : shown;
}

/** Keep status and completion details to bounded routing evidence, not raw output or effects. */
export function projectTimeoutRecovery(value: unknown): TimeoutRecoveryProjection | undefined {
	if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
	const source = value as Record<string, unknown>;
	const termination = source.termination === "timed-out" || source.termination === "stopped" ? source.termination : undefined;
	if (!termination || !Array.isArray(source.changedFiles)) return undefined;
	const allChangedFiles = source.changedFiles.filter((file): file is string => typeof file === "string");
	const changedFiles = allChangedFiles.slice(0, MAX_TIMEOUT_FILES);
	const reportStatus = source.reportStatus === "missing"
		|| source.reportStatus === "written"
		|| source.reportStatus === "not-requested"
		|| source.reportStatus === "unknown"
		? source.reportStatus
		: undefined;
	return {
		termination,
		changedFiles,
		...(source.truncated === true || allChangedFiles.length > changedFiles.length ? { truncated: true } : {}),
		...(source.recoveryNeeded === true ? { recoveryNeeded: true } : {}),
		...(source.reason === "timed-out-with-dirty-worktree" ? { reason: source.reason } : {}),
		...(reportStatus ? { reportStatus } : {}),
	};
}

/** Render only the bounded recovery route needed by a parent/operator. */
export function formatTimeoutRecoveryLines(value: unknown, indent = ""): string[] {
	const recovery = projectTimeoutRecovery(value);
	if (!recovery?.recoveryNeeded) return [];
	const changedFiles = recovery.changedFiles.length > 0
		? `${recovery.changedFiles.join(", ")}${recovery.truncated ? ", …" : ""}`
		: "none";
	const changedFileCount = recovery.changedFiles.length > 0 ? `${recovery.changedFiles.length}${recovery.truncated ? "+" : ""}` : "0";
	return [
		`${indent}Recovery needed: review the diff and artifacts before resuming or launching dependent stages.`,
		`${indent}Recovery evidence: requested report: ${recovery.reportStatus ?? "unknown"}; changed tracked files: ${changedFiles} (${changedFileCount}); classification: ${recovery.reason ?? recovery.termination}`,
	];
}

export function buildTimeoutRecoverySummary(input: {
	termination: "timed-out" | "stopped";
	evidence: TrackedMutationEvidence;
	requiredOutputMissing?: boolean;
	currentTool?: string;
	currentToolArgs?: string;
	currentPath?: string;
	sessionFile?: string;
	transcriptPath?: string;
	artifactPaths?: ArtifactPaths;
}): TimeoutRecoverySummary {
	const warning = "Inspect partial changes before retrying or resuming the child.";
	const changedFiles = input.evidence.changedFiles.slice(0, MAX_TIMEOUT_FILES);
	let reportStatus: "missing" | "written" | "not-requested" = "not-requested";
	if (input.requiredOutputMissing === true) reportStatus = "missing";
	else if (input.requiredOutputMissing === false) reportStatus = "written";
	const recoveryNeeded = input.termination === "timed-out"
		&& reportStatus === "missing"
		&& input.evidence.changedFiles.length > 0;
	const lines = [
		"Recovery summary:",
		`- termination: ${input.termination}`,
		`- changed tracked files: ${input.evidence.unavailable ? `unavailable (${input.evidence.unavailable})` : formatPathList(input.evidence.changedFiles)}`,
	];
	if (input.requiredOutputMissing !== undefined) lines.push(`- requested report: ${reportStatus}`);
	if (recoveryNeeded) lines.push("- Recovery needed: review the diff and artifacts before resuming or launching dependent stages.");
	if (input.currentTool) lines.push(`- active tool: ${input.currentTool}${input.currentToolArgs ? ` — ${input.currentToolArgs}` : ""}`);
	if (input.currentPath) lines.push(`- active path: ${input.currentPath}`);
	if (input.sessionFile) lines.push(`- session file: ${input.sessionFile}`);
	if (input.transcriptPath) lines.push(`- transcript: ${input.transcriptPath}`);
	if (input.artifactPaths?.outputPath) lines.push(`- output artifact: ${input.artifactPaths.outputPath}`);
	if (input.artifactPaths?.metadataPath) lines.push(`- metadata artifact: ${input.artifactPaths.metadataPath}`);
	lines.push(`Warning: ${warning}`);
	return {
		termination: input.termination,
		changedFiles,
		truncated: input.evidence.changedFiles.length > changedFiles.length || input.evidence.truncated || undefined,
		...(recoveryNeeded ? { recoveryNeeded: true, reason: "timed-out-with-dirty-worktree" as const } : {}),
		reportStatus,
		currentTool: input.currentTool,
		currentToolArgs: input.currentToolArgs,
		currentPath: input.currentPath,
		sessionFile: input.sessionFile,
		transcriptPath: input.transcriptPath,
		artifactPaths: input.artifactPaths,
		warning,
		message: lines.join("\n"),
	};
}
