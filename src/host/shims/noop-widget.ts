/**
 * [aiti] widget shim —— 引擎层（async-job-tracker）→ TUI 反向依赖的唯一转接板。
 *
 * 背景：上游 `runs/background/async-job-tracker.ts` import 了 `tui/render.ts` 的
 * renderWidget / widgetRenderKey，是引擎→TUI 全场唯一的反向依赖（拆包 PR① 的目标）。
 * 本 shim 让引擎侧 import 指向 host 层：
 *   - pi 宿主：两者都转发真实现，行为与上游逐字节一致。
 *   - pi-web 宿主：renderWidget no-op（Web Fleet 面板替代）；widgetRenderKey 仍转发——
 *     它是纯函数（状态 JSON 序列化），驱动后台任务的变更检测，关掉会破坏引擎行为。
 *
 * 注：本文件允许 import tui/*（L0 契约只约束 src/runs/**）；render.ts 顶层无副作用，
 * pi-web 的 node 进程可安全加载（组件类定义不触发终端渲染）。
 */
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { renderWidget as renderTuiWidget, widgetRenderKey as tuiWidgetRenderKey } from "../../tui/render.ts";
import type { AsyncJobState } from "../../shared/types.ts";
import type { AsyncWidgetLayout } from "../../shared/types.ts";
import { resolveHostCaps } from "../caps.ts";

export function renderWidget(ctx: ExtensionContext, jobs: AsyncJobState[], initiallyCollapsed = false, layout: AsyncWidgetLayout = "adaptive"): void {
	if (!resolveHostCaps().widget) return;
	renderTuiWidget(ctx, jobs, initiallyCollapsed, layout);
}

export function widgetRenderKey(job: AsyncJobState, expanded = false): string {
	return tuiWidgetRenderKey(job, expanded);
}
