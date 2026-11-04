/**
 * [aiti] widget shim — adapter for the engine layer's (async-job-tracker) reverse dependency on TUI.
 *
 * Background: upstream `runs/background/async-job-tracker.ts` imports renderWidget / widgetRenderKey from
 * `tui/render.ts` — the only engine→TUI reverse dependency in the tree (target of packaging-split PR #1).
 * This shim points the engine-side import at the host layer:
 *   - pi host: both forward to the real implementation, byte-identical to upstream.
 *   - pi-web host: renderWidget is a no-op (the Web Fleet panel replaces it); widgetRenderKey still forwards —
 *     it is a pure function (state JSON serialization) driving change detection of background jobs; disabling it would break engine behavior.
 *
 * Note: this file may import tui/* (the L0 contract only constrains src/runs/**); render.ts has no top-level side effects,
 * so pi-web's node process can safely load it (component class definitions do not trigger terminal rendering).
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
