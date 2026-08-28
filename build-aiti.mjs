#!/usr/bin/env node
/**
 * [aiti] build-aiti.mjs —— 把上游 TS 源编译为 JS 发布产物（独立包 @aiti-ai/pi-subagents）。
 *
 * 为什么必须编译：pi-web（turbopack）不能编译 node_modules 里的 .ts 源
 * （pi-web/next.config.ts 踩坑记录），上游以纯 .ts 发布、只适配 pi 的 strip-types 直跑。
 *
 * 策略：esbuild 双入口 bundle（根扩展 index.ts + host 面 src/host/index.ts），
 * external 全部 @earendil-works/*（运行时从宿主 node_modules 解析，避免双实例）
 * 与 node:* 内建。上游 import 的 .ts 后缀由 bundle 模式原生消化。
 *
 * 发布：生成 dist/package.json（根 package.json 镜像，exports 指向编译产物），
 * `npm publish ./dist` —— 仓库内 exports 保持 .ts 源形态（与上游同构，merge 冲突最小）。
 *
 * 用法：node build-aiti.mjs [--publish]（--publish = 构建后直接 npm publish ./dist）
 */
import { build } from "esbuild";
import { readFile, writeFile, rm, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(root, "dist");
const publish = process.argv.includes("--publish");

const COMMON = {
	bundle: true,
	format: "esm",
	platform: "node",
	target: "node20",
	sourcemap: true,
	legalComments: "inline",
	external: ["@earendil-works/*"],
	logLevel: "warning",
};

const ENTRIES = [
	{ in: path.join(root, "index.ts"), out: "index" },
	{ in: path.join(root, "src", "host", "index.ts"), out: "host" },
];

async function main() {
	console.log("[aiti] cleaning dist/ …");
	await rm(dist, { recursive: true, force: true });
	await mkdir(dist, { recursive: true });

	for (const entry of ENTRIES) {
		console.log(`[aiti] bundling ${path.relative(root, entry.in)} → dist/${entry.out}.js`);
		await build({ ...COMMON, entryPoints: [entry.in], outfile: path.join(dist, `${entry.out}.js`) });
	}

	const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
	const distPkg = {
		name: pkg.name,
		version: pkg.version,
		description: pkg.description,
		author: pkg.author,
		license: pkg.license,
		type: "module",
		main: "./index.js",
		exports: {
			".": "./index.js",
			"./host": "./host.js",
		},
		files: ["index.js", "host.js", "*.map"],
		publishConfig: pkg.publishConfig,
		repository: pkg.repository,
		keywords: pkg.keywords,
		engines: pkg.engines,
	};
	await writeFile(path.join(dist, "package.json"), `${JSON.stringify(distPkg, null, 2)}\n`);
	console.log(`[aiti] dist/package.json written (${distPkg.name}@${distPkg.version})`);

	if (publish) {
		console.log("[aiti] publishing dist/ …");
		await writeFile(path.join(dist, "README.md"), `# ${distPkg.name}\n\n[aiti fork] compiled publish artifact of nicobailon/pi-subagents @ ${pkg.version.replace(/-aiti\.\d+$/, "")} + host adaptation layer.\n`);
		const { execFileSync } = await import("node:child_process");
		execFileSync("npm", ["publish", "--access", "restricted", "."], { cwd: dist, stdio: "inherit" });
	}
	console.log("[aiti] done.");
}

main().catch((error) => {
	console.error("[aiti] build failed:", error);
	process.exit(1);
});
