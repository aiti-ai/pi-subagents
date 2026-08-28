/**
 * [aiti] 宿主探测 —— fork 唯一的宿主判定入口（上游无此文件，merge 零冲突）。
 *
 * 约定：
 *   - 只认显式环境变量 PI_SUBAGENTS_HOST，缺省 "pi"（上游宿主）→ 上游用户零感知。
 *   - 不做隐式自动探测（宁可漏声明走 pi 全功能路径，不可误判破坏上游行为）。
 *   - pi-web 装配方（aiti-subagents 扩展 / pi-web 启动 env）负责显式注入。
 */
export const PI_SUBAGENTS_HOST_ENV = "PI_SUBAGENTS_HOST";

export type AitiHost = "pi" | "pi-web";

export function detectHost(env: NodeJS.ProcessEnv = process.env): AitiHost {
	const explicit = String(env[PI_SUBAGENTS_HOST_ENV] ?? "").trim().toLowerCase();
	if (explicit === "pi-web" || explicit === "web") return "pi-web";
	return "pi";
}

export function isPiWebHost(env: NodeJS.ProcessEnv = process.env): boolean {
	return detectHost(env) === "pi-web";
}
