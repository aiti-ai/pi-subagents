/**
 * [aiti] Host detection — the fork's single host-classification entry point (no such file upstream, zero merge conflicts).
 *
 * Conventions:
 *   - Only the explicit env var PI_SUBAGENTS_HOST is honored; default "pi" (upstream host) → zero upstream user impact.
 *   - No implicit auto-detection (prefer a missing declaration with the full upstream path over a misclassification that breaks upstream behavior).
 *   - The pi-web installer (aiti-subagents extension / pi-web launch env) is responsible for injecting it explicitly.
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
