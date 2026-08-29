/**
 * [aiti] L0 契约守护 —— 源码级断言，不执行代码。
 *
 * 目的：每次 merge upstream/main 后自动验证「我们的插桩还在、我们的纪律没被上游改动破坏」。
 * 红 = merge 冲掉了插桩或上游新增了违反约束的依赖 → 按 SOP「恢复上游原文 + 重打插桩」处理。
 * 运行：npm run test:aiti（node --test，纯文件读取，毫秒级）。
 */
import { readFile, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import assert from "node:assert/strict";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

test("L0-1: async-job-tracker 的 renderWidget import 指向 host shim（插桩②不被 merge 还原）", async () => {
	const file = join(ROOT, "src", "runs", "background", "async-job-tracker.ts");
	const source = await readFile(file, "utf8");
	assert.match(
		source,
		/import \{ renderWidget, widgetRenderKey \} from "\.\.\/\.\.\/host\/shims\/noop-widget\.ts";/,
		"插桩②丢失：async-job-tracker 应从 host/shims/noop-widget 导入 renderWidget",
	);
	assert.doesNotMatch(
		source,
		/from "\.\.\/\.\.\/tui\/render\.ts"/,
		"插桩②被绕过：async-job-tracker 不允许直接 import tui/render",
	);
});

test("L0-3: src/runs/** 引擎层不允许出现指向 src/tui/ 的 import（反向依赖保持为 0）", async () => {
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
		`引擎层新增了 tui 反向依赖（会破坏 host 层与上游拆包论据）：\n${offenders.join("\n")}`,
	);
});

test("L0-4: package.json 发布面完整（@aiti-ai scope + -aiti.N 版本 + ./host export）", async () => {
	const pkg = JSON.parse(await readFile(join(ROOT, "package.json"), "utf8"));
	assert.equal(pkg.name, "@aiti-ai/pi-subagents", "包名必须是 @aiti-ai scope 独立发包");
	assert.match(pkg.version, /^\d+\.\d+\.\d+-aiti\.\d+$/, "版本必须为 上游基线-aiti.N 格式");
	assert.equal(pkg.publishConfig?.registry, "https://npm.alot.pw", "publishConfig 必须指向内部 verdaccio");
	assert.equal(pkg.exports["./host"], "./src/host/index.ts", "./host export 必须存在（pi-web 接入面）");
});

test("L0-6: 载体面插桩保持（fleetView/asyncWidget/slash 经 host caps 门控）", async () => {
  const file = join(ROOT, "src", "extension", "index.ts");
  const source = await readFile(file, "utf8");
  assert.match(
    source,
    /const fleetViewEnabled = config\.fleetView !== false && resolveHostCaps\(\)\.tui;/,
    "插桩丢失：fleetViewEnabled 应受 host caps 门控",
  );
  assert.match(
    source,
    /const asyncWidgetEnabled = config\.asyncWidget !== false && resolveHostCaps\(\)\.widget;/,
    "插桩丢失：asyncWidgetEnabled 应受 host caps 门控",
  );
  assert.match(
    source,
    /if \(resolveHostCaps\(\)\.slash\) \{\n\t\tregisterSlashCommands/,
    "插桩丢失：registerSlashCommands 应受 host caps 门控",
  );
});

test("L0-5: host 层文件只允许出现在 src/host/**（新文件隔离纪律）", async () => {
	// 守护「改动外部化」：host 契约的实现在且只在本目录，防止未来散落。
	const hostIndex = await readFile(join(ROOT, "src", "host", "index.ts"), "utf8");
	assert.match(hostIndex, /export \{ PI_SUBAGENTS_HOST_ENV, detectHost, isPiWebHost/);
	const caps = await readFile(join(ROOT, "src", "host", "caps.ts"), "utf8");
	assert.match(caps, /PI_WEB_HOST_CAPS: HostCaps/);
});
