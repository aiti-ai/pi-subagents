/**
 * [aiti] Unified host surface — the stable contract of `@aiti-ai/pi-subagents/host`.
 *
 * pi-web (and future non-TUI hosts) must integrate only through this surface, never importing upstream deep paths:
 * upstream internal refactors are isolated by this file, so callers need zero changes (§4.4 stable exports-surface contract).
 *
 * P0 scope: host detection + capability table + spawn env convention constants.
 * P0.5 addition: the createPiWebHost query/control surface (run status snapshots / steer / wait).
 */
export { PI_SUBAGENTS_HOST_ENV, detectHost, isPiWebHost, type AitiHost } from "./detect.ts";
export { PI_HOST_CAPS, PI_WEB_HOST_CAPS, resolveHostCaps, type HostCaps } from "./caps.ts";

/**
 * Subagent RPC channel (§5.4 /web attach bridge) env conventions:
 * The pi-web host injects the following two entries into its own process env; the upstream spawn env passthrough chain
 * (spawnEnv = {...process.env, ...}) carries them automatically into every subagent process:
 *   - PI_WEB_BRIDGE_AUTO=1: the headless web-bridge extension starts the bridge automatically (skipping the TUI interactive menu)
 *   - PI_WEB_BRIDGE_BASE: address of an already-running pi-web (equivalent to /web --no-spawn; reuses rather than spawns an instance)
 * The headless web-bridge extension itself lives in pi-web-ext/aiti-attach-agent (a separate repository, not this fork).
 */
export const PI_WEB_BRIDGE_AUTO_ENV = "PI_WEB_BRIDGE_AUTO";
export const PI_WEB_BRIDGE_BASE_ENV = "PI_WEB_BRIDGE_BASE";
