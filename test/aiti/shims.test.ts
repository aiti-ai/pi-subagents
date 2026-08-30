/**
 * [aiti] L1 widget shim —— pi-web 宿主屏蔽行为 + 纯函数转发一致性。
 *
 * 注：本文件会加载 tui/render.ts（shim 静态 import），需要 @earendil-works/*
 * 在 node_modules 可解析（上游测试环境本就如此）。
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
	asyncId: "aaaaaaaa-1111-2222-3333-444444444444", // [aiti] 0.59 起上游 lane 渲染路径读此字段（projectAsyncLane → asyncId.slice）
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

test("L1-6a: pi-web 宿主下 renderWidget 为 no-op（不碰 ctx、不抛）", () => {
	withHost("pi-web", () => {
		// ctx 传 undefined：no-op 分支不得触碰参数
		assert.doesNotThrow(() => renderWidget(undefined, [JOB_A]));
		assert.doesNotThrow(() => renderWidget(undefined, []));
	});
});

test("L1-6b: widgetRenderKey 稳定且区分状态（变更检测语义，与上游实现一致）", () => {
	const keyA1 = widgetRenderKey(JOB_A, false);
	assert.equal(widgetRenderKey(JOB_A, false), keyA1, "同状态两次调用必须同 key");
	assert.notEqual(widgetRenderKey({ ...JOB_A, status: "completed" }, false), keyA1, "状态变化必须换 key");
	const withAgents = { ...JOB_A, agents: ["worker"] };
	assert.notEqual(widgetRenderKey(withAgents, false), keyA1, "agents 列表变化必须换 key");
});

test("L1-6c: 两宿主下 widgetRenderKey 输出一致（转发不改语义）", () => {
	let keyPi, keyWeb;
	withHost("pi", () => {
		keyPi = widgetRenderKey(JOB_A, true);
	});
	withHost("pi-web", () => {
		keyWeb = widgetRenderKey(JOB_A, true);
	});
	assert.equal(keyPi, keyWeb, "widgetRenderKey 是纯函数，宿主无关");
});
