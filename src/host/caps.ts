/**
 * [aiti] Host capability table — declares which upstream carrier subsystems are available per host.
 *
 * Principles (fork modification discipline):
 *   - pi host (upstream): all true — behavior identical to upstream.
 *   - pi-web host: TUI/slash/watchdog/intercom/integrations off (pi-web has its own Fleet web panel
 *     and message rendering pipeline); the core engine surface (runs/agents/shared/api) is unaffected by caps and always available.
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
	/** Status widget rendering of async-job-tracker (a second gate beyond the hasUI gate) */
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
