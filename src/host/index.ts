/**
 * [aiti] host 面统一出口 —— `@aiti-ai/pi-subagents/host` 的稳定契约。
 *
 * pi-web（及未来其他非 TUI 宿主）只准经由此面接入，不 import 上游深路径：
 * 上游内部重构被本文件隔离，调用方零改动（§4.4 exports 面稳定契约）。
 *
 * P0 范围：宿主探测 + 能力表 + spawn env 约定常量。
 * P0.5 追加：createPiWebHost 查询/控制面（run 状态快照 / steer / wait）。
 */
export { PI_SUBAGENTS_HOST_ENV, detectHost, isPiWebHost, type AitiHost } from "./detect.ts";
export { PI_HOST_CAPS, PI_WEB_HOST_CAPS, resolveHostCaps, type HostCaps } from "./caps.ts";

/**
 * 子代理 RPC 通道（§5.4 /web attach 桥）env 约定：
 * pi-web 宿主在自身进程 env 注入以下两项，上游 spawn 的 env 透传链
 * （spawnEnv = {...process.env, ...}）会自动带给每个子代理进程：
 *   - PI_WEB_BRIDGE_AUTO=1：headless web-bridge 扩展自动起桥（跳过 TUI 交互菜单）
 *   - PI_WEB_BRIDGE_BASE：已运行 pi-web 地址（等价 /web --no-spawn，复用不新起实例）
 * headless web-bridge 扩展本体在 pi-web-ext/aiti-attach-agent（自持仓库，非本 fork）。
 */
export const PI_WEB_BRIDGE_AUTO_ENV = "PI_WEB_BRIDGE_AUTO";
export const PI_WEB_BRIDGE_BASE_ENV = "PI_WEB_BRIDGE_BASE";
