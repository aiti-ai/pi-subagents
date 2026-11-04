/**
 * [aiti] L1 widget shim — masking behavior on the pi-web host + pure-forwarding consistency.
 *
 * Note: this file loads tui/render.ts (static import in the shim), so @earendil-works/*
 * must be resolvable from node_modules (the upstream test environment already satisfies this).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { PI_SUBAGENTS_HOST_ENV } from "../../src/host/detect.ts";
import { renderWidget, widgetRenderKey } from "../../src/host/shims/noop-widget.ts";

function withHost(value, fn) {
	const saved = process.env[PI_SUBAGENTS_HOST_ENV];
	process.env[PI_SUBAGENTS_HOST_ENV] = value;
	try {
		fn();
	} finally {
		if (saved === undefined) delete process.env[PI_SUBAGENTS_HOST_ENV];
		else process.env[PI_SUBAGENTS_HOST_ENV] = saved;
	}
}

const JOB_A = {
	asyncDir: "/tmp/a",
	asyncId: "aaaaaaaa-1111-2222-3333-444444444444", // [aiti] since 0.59 the upstream lane rendering path reads this field (projectAsyncLane → asyncId.slice)
	status: "running",
	activityState: "active",
	lastActivityAt: 1000,
	currentTool: "read",
	currentToolStartedAt: 1001,
	currentPath: "/x/y.ts",
	turnCount: 2,
	toolCount: 5,
	mode: "foreground",
	agents: ["scout"],
};

test("L1-6a: renderWidget is a no-op on the pi-web host (does not touch ctx, does not throw)", () => {
	withHost("pi-web", () => {
		// ctx passed as undefined: the no-op branch must not touch its arguments
		assert.doesNotThrow(() => renderWidget(undefined, [JOB_A]));
		assert.doesNotThrow(() => renderWidget(undefined, []));
	});
});

test("L1-6b: widgetRenderKey is stable and distinguishes state (change-detection semantics, same as upstream)", () => {
	const keyA1 = widgetRenderKey(JOB_A, false);
	assert.equal(widgetRenderKey(JOB_A, false), keyA1, "two calls with the same state must produce the same key");
	assert.notEqual(widgetRenderKey({ ...JOB_A, status: "completed" }, false), keyA1, "a state change must change the key");
	const withAgents = { ...JOB_A, agents: ["worker"] };
	assert.notEqual(widgetRenderKey(withAgents, false), keyA1, "an agents list change must change the key");
});

test("L1-6c: widgetRenderKey output is identical under both hosts (forwarding does not change semantics)", () => {
	let keyPi, keyWeb;
	withHost("pi", () => {
		keyPi = widgetRenderKey(JOB_A, true);
	});
	withHost("pi-web", () => {
		keyWeb = widgetRenderKey(JOB_A, true);
	});
	assert.equal(keyPi, keyWeb, "widgetRenderKey is a pure function, host-independent");
});
