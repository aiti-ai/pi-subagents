/**
 * [aiti] L1 宿主探测与能力表 —— 行为矩阵测试。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { PI_SUBAGENTS_HOST_ENV, detectHost, isPiWebHost } from "../../src/host/detect.ts";
import { PI_HOST_CAPS, PI_WEB_HOST_CAPS, resolveHostCaps } from "../../src/host/caps.ts";

const CAP_KEYS = ["tui", "slash", "watchdog", "intercom", "integrations", "widget"];

function withEnv(value, fn) {
	const saved = process.env[PI_SUBAGENTS_HOST_ENV];
	if (value === undefined) delete process.env[PI_SUBAGENTS_HOST_ENV];
	else process.env[PI_SUBAGENTS_HOST_ENV] = value;
	try {
		fn();
	} finally {
		if (saved === undefined) delete process.env[PI_SUBAGENTS_HOST_ENV];
		else process.env[PI_SUBAGENTS_HOST_ENV] = saved;
	}
}

test("L1-5a: 缺省宿主 = pi（上游零感知）", () => {
	withEnv(undefined, () => {
		assert.equal(detectHost(), "pi");
		assert.equal(isPiWebHost(), false);
		assert.deepEqual(resolveHostCaps(), PI_HOST_CAPS);
	});
});

test("L1-5b: 显式 pi-web / web（大小写不敏感）→ pi-web caps", () => {
	for (const value of ["pi-web", "web", "PI-WEB", " Web "]) {
		withEnv(value, () => {
			assert.equal(detectHost(), "pi-web", `值 ${JSON.stringify(value)} 应识别为 pi-web`);
			assert.equal(isPiWebHost(), true);
		});
	}
});

test("L1-5c: 无效值保守回退 pi（宁可走上游全功能路径，不可误判）", () => {
	for (const value of ["", "unknown", "piweb", "next", "browser"]) {
		withEnv(value, () => assert.equal(detectHost(), "pi", `值 ${JSON.stringify(value)} 应回退 pi`));
	}
});

test("L1-5d: caps 矩阵——pi 全开 / pi-web 全关 / 仅声明载体面（core 不参与）", () => {
	for (const key of CAP_KEYS) {
		assert.equal(PI_HOST_CAPS[key], true, `pi caps.${key} 应为 true`);
		assert.equal(PI_WEB_HOST_CAPS[key], false, `pi-web caps.${key} 应为 false`);
	}
});

test("L1-5e: resolveHostCaps 可传参（无全局状态，可测试性）", () => {
	assert.deepEqual(resolveHostCaps("pi-web"), PI_WEB_HOST_CAPS);
	assert.deepEqual(resolveHostCaps("pi"), PI_HOST_CAPS);
});
