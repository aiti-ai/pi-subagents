/**
 * [aiti] L1 host detection and capability table — behavior matrix tests.
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

test("L1-5a: default host = pi (zero upstream awareness)", () => {
	withEnv(undefined, () => {
		assert.equal(detectHost(), "pi");
		assert.equal(isPiWebHost(), false);
		assert.deepEqual(resolveHostCaps(), PI_HOST_CAPS);
	});
});

test("L1-5b: explicit pi-web / web (case-insensitive) → pi-web caps", () => {
	for (const value of ["pi-web", "web", "PI-WEB", " Web "]) {
		withEnv(value, () => {
			assert.equal(detectHost(), "pi-web", `value ${JSON.stringify(value)} should be recognized as pi-web`);
			assert.equal(isPiWebHost(), true);
		});
	}
});

test("L1-5c: invalid values conservatively fall back to pi (prefer the full upstream path over misclassification)", () => {
	for (const value of ["", "unknown", "piweb", "next", "browser"]) {
		withEnv(value, () => assert.equal(detectHost(), "pi", `value ${JSON.stringify(value)} should fall back to pi`));
	}
});

test("L1-5d: caps matrix — pi all on / pi-web all off / declared carrier surfaces only (core not involved)", () => {
	for (const key of CAP_KEYS) {
		assert.equal(PI_HOST_CAPS[key], true, `pi caps.${key} should be true`);
		assert.equal(PI_WEB_HOST_CAPS[key], false, `pi-web caps.${key} should be false`);
	}
});

test("L1-5e: resolveHostCaps accepts an argument (no global state, testable)", () => {
	assert.deepEqual(resolveHostCaps("pi-web"), PI_WEB_HOST_CAPS);
	assert.deepEqual(resolveHostCaps("pi"), PI_HOST_CAPS);
});
