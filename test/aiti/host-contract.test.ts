/**
 * [aiti] L0 contract guard — source-level assertions; no code is executed.
 *
 * Purpose: after every merge of upstream/main, verify automatically that our instrumentation is intact
 * and that upstream changes did not break our discipline.
 * Run: npm run test:aiti (node --test, pure file reads, millisecond-level).
 */
import { readFile, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import assert from "node:assert/strict";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

test("L0-1: async-job-tracker's renderWidget import points at the host shim (instrumentation #2 survives merges)", async () => {
	const file = join(ROOT, "src", "runs", "background", "async-job-tracker.ts");
	const source = await readFile(file, "utf8");
	assert.match(
		source,
		/import \{ renderWidget, widgetRenderKey \} from "\.\.\/\.\.\/host\/shims\/noop-widget\.ts";/,
		"instrumentation #2 lost: async-job-tracker must import renderWidget from host/shims/noop-widget",
	);
	assert.doesNotMatch(
		source,
		/from "\.\.\/\.\.\/tui\/render\.ts"/,
		"instrumentation #2 bypassed: async-job-tracker must not import tui/render directly",
	);
});

test("L0-3: src/runs/** engine layer must not import from src/tui/ (reverse dependency stays at zero)", async () => {
	const offenders = [];
	async function scan(dir) {
		for (const entry of await readdir(dir, { withFileTypes: true })) {
			const full = join(dir, entry.name);
			if (entry.isDirectory()) {
				await scan(full);
			} else if (entry.name.endsWith(".ts")) {
				const source = await readFile(full, "utf8");
				if (/from\s+"[^"]*\/tui\//.test(source)) offenders.push(full);
			}
		}
	}
	await scan(join(ROOT, "src", "runs"));
	assert.deepEqual(
		offenders,
		[],
		`Engine layer gained a tui reverse dependency (it would break the host-layer and upstream-split rationale):\n${offenders.join("\n")}`,
	);
});

test("L0-4: package.json publish surface is complete (@aiti-ai scope + -aiti.N version + ./host export)", async () => {
	const pkg = JSON.parse(await readFile(join(ROOT, "package.json"), "utf8"));
	assert.equal(pkg.name, "@aiti-ai/pi-subagents", "package name must be the standalone @aiti-ai scope package");
	assert.match(pkg.version, /^\d+\.\d+\.\d+-aiti\.\d+$/, "version must follow the upstream-baseline-aiti.N format");
	assert.equal(pkg.publishConfig, undefined, "publishConfig must stay absent: publish routing is machine-level .npmrc plus an explicit --registry flag on the dist-pkg tarball, and the source root is private:true anyway");
	assert.equal(pkg.exports["./host"], "./src/host/index.ts", "./host export must exist (the pi-web integration surface)");
});

test("L0-6: carrier-surface instrumentation is preserved (fleetView/asyncWidget/slash gated by host caps)", async () => {
  const file = join(ROOT, "src", "extension", "index.ts");
  const source = await readFile(file, "utf8");
  assert.match(
    source,
    /const fleetViewEnabled = config\.fleetView !== false && resolveHostCaps\(\)\.tui;/,
    "instrumentation lost: fleetViewEnabled must be gated by host caps",
  );
  assert.match(
    source,
    /const asyncWidgetEnabled = config\.asyncWidget !== false && resolveHostCaps\(\)\.widget;/,
    "instrumentation lost: asyncWidgetEnabled must be gated by host caps",
  );
  assert.match(
    source,
    /const disposeSlashCommands = resolveHostCaps\(\)\.slash && slashCommandsEnabled\n\t\t\? registerSlashCommands/,
    "instrumentation lost: registerSlashCommands must be gated by host caps (layered with the upstream enableSlashCommands switch since 0.84.0)",
  );
  assert.match(
    source,
    /: \{ dispose\(\) \{\} \};/,
    "instrumentation lost: a no-op dispose fallback must exist when slash is disabled (the upstream cleanup chain calls it unconditionally)",
  );
});

test("L0-5: host layer files are only allowed under src/host/** (new-file isolation discipline)", async () => {
	// Guard "changes stay externalized": the host contract lives in and only in this directory, so it cannot scatter later.
	const hostIndex = await readFile(join(ROOT, "src", "host", "index.ts"), "utf8");
	assert.match(hostIndex, /export \{ PI_SUBAGENTS_HOST_ENV, detectHost, isPiWebHost/);
	const caps = await readFile(join(ROOT, "src", "host", "caps.ts"), "utf8");
	assert.match(caps, /PI_WEB_HOST_CAPS: HostCaps/);
});
