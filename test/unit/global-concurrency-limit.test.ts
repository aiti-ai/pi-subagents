import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { DEFAULT_GLOBAL_CONCURRENCY_LIMIT, resolveEffectiveGlobalConcurrencyLimit } from "../../src/runs/shared/parallel-utils.ts";
import { loadConfig, updateConfig } from "../../src/extension/config.ts";

const savedAgentDir = process.env.PI_CODING_AGENT_DIR;

afterEach(() => {
	if (savedAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
	else process.env.PI_CODING_AGENT_DIR = savedAgentDir;
});

describe("global concurrency limit resolution", () => {
	it("falls back to the built-in default when nothing is configured", () => {
		assert.equal(resolveEffectiveGlobalConcurrencyLimit(undefined), DEFAULT_GLOBAL_CONCURRENCY_LIMIT);
		assert.equal(DEFAULT_GLOBAL_CONCURRENCY_LIMIT, 20);
	});

	it("honors an explicit config value", () => {
		assert.equal(resolveEffectiveGlobalConcurrencyLimit(6), 6);
	});

	it("ignores invalid explicit values", () => {
		assert.equal(resolveEffectiveGlobalConcurrencyLimit(0), DEFAULT_GLOBAL_CONCURRENCY_LIMIT);
		assert.equal(resolveEffectiveGlobalConcurrencyLimit(2.5), DEFAULT_GLOBAL_CONCURRENCY_LIMIT);
		assert.equal(resolveEffectiveGlobalConcurrencyLimit(-3), DEFAULT_GLOBAL_CONCURRENCY_LIMIT);
	});

	it("rejects a non-integer globalConcurrencyLimit in the extension config file", () => {
		const agentDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-subagents-concurrency-config-"));
		try {
			process.env.PI_CODING_AGENT_DIR = agentDir;
			const configPath = path.join(agentDir, "extensions", "subagent", "config.json");
			fs.mkdirSync(path.dirname(configPath), { recursive: true });
			fs.writeFileSync(configPath, JSON.stringify({}), "utf-8");
			assert.throws(() => updateConfig(() => ({ globalConcurrencyLimit: 2.5 })), /globalConcurrencyLimit must be a positive integer/);
			assert.throws(() => updateConfig(() => ({ globalConcurrencyLimit: 0 })), /globalConcurrencyLimit must be a positive integer/);
			updateConfig(() => ({ globalConcurrencyLimit: 4 }));
			assert.equal(loadConfig().globalConcurrencyLimit, 4);
		} finally {
			fs.rmSync(agentDir, { recursive: true, force: true });
		}
	});

	it("fail closes when the config file itself carries an invalid globalConcurrencyLimit", () => {
		const agentDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-subagents-concurrency-loadconfig-"));
		try {
			process.env.PI_CODING_AGENT_DIR = agentDir;
			const configPath = path.join(agentDir, "extensions", "subagent", "config.json");
			fs.mkdirSync(path.dirname(configPath), { recursive: true });
			fs.writeFileSync(configPath, JSON.stringify({ globalConcurrencyLimit: 0, worktree: false }), "utf-8");
			assert.throws(() => loadConfig(), /globalConcurrencyLimit must be a positive integer/);
		} finally {
			fs.rmSync(agentDir, { recursive: true, force: true });
		}
	});
});
