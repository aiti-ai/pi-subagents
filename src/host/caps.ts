/**
 * [aiti] Host capability table — declares which upstream carrier subsystems are available per host.
 *
 * Principles (fork modification discipline):
 *   - pi host (upstream): all true — behavior identical to upstream.
 *   - pi-web host: all false. Active gates today: tui (fleet view), widget (async widget), slash (slash commands — the
 *     watchdog slash command is covered transitively). watchdog/intercom/integrations are declarative-only for now:
 *     upstream already gates intercom delivery behind config (default off), gates the watchdog UI through the slash
 *     layer, and runs the herdr bridge data-driven; add a fork-side consumer only if upstream grows a surface none of
 *     those cover.
 *   - caps only decide surface masking, never engine behavior — upstream's test:unit must stay green under both caps.
 */
import { detectHost, type AitiHost } from "./detect.ts";

export interface HostCaps {
	/** TUI rendering (render.ts components, Fleet status bar, widget) */
	tui: boolean;
	/** Slash command UI (the interactive surface of slash-commands; the prompt-template event bridge is not part of this) */
	slash: boolean;
	/** watchdog TUI watchdog UI */
	watchdog: boolean;
	/** intercom supervisor channel UI */
	intercom: boolean;
	/** External integrations such as herdr */
	integrations: boolean;
	/** Status widget rendering of async-job-tracker (enforced in shims/noop-widget.ts: the tracker still calls renderWidget when disabled, so the gate lives in the shim) */
	widget: boolean;
}

export const PI_HOST_CAPS: HostCaps = {
	tui: true,
	slash: true,
	watchdog: true,
	intercom: true,
	integrations: true,
	widget: true,
};

export const PI_WEB_HOST_CAPS: HostCaps = {
	tui: false,
	slash: false,
	watchdog: false,
	intercom: false,
	integrations: false,
	widget: false,
};

export function resolveHostCaps(host: AitiHost = detectHost()): HostCaps {
	return host === "pi-web" ? PI_WEB_HOST_CAPS : PI_HOST_CAPS;
}
