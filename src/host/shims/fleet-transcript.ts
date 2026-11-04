/**
 * [aiti] fleet-transcript shim —— 引擎层（runs/background/run-status）→ TUI 反向依赖的转接板。
 *
 * 背景：上游 0.84.0 在 `runs/background/run-status.ts` 引入 `tui/fleet-transcript.ts` 的
 * readFleetTranscript（引擎→TUI 第二处反向依赖）。该函数是纯转录文件解析（路径校验 +
 * tail 读取 + 记录解析），不含任何 TUI 渲染，两宿主行为一致，因此本 shim 纯转发。
 *
 * 注：本文件允许 import tui/*（L0 契约只约束 src/runs/**）。
 */
export { readFleetTranscript } from "../../tui/fleet-transcript.ts";
export type { FleetTranscript, FleetTranscriptEvent } from "../../tui/fleet-transcript.ts";
