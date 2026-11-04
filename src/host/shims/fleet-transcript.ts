/**
 * [aiti] fleet-transcript shim — adapter for the engine layer's (runs/background/run-status) reverse dependency on TUI.
 *
 * Background: upstream 0.84.0 introduced readFleetTranscript from `tui/fleet-transcript.ts` into
 * `runs/background/run-status.ts` (the second engine→TUI reverse dependency). The function is pure transcript
 * parsing (path validation + tail read + record parsing) with no TUI rendering, so this shim forwards as-is.
 *
 * Note: this file may import tui/* (the L0 contract only constrains src/runs/**).
 */
export { readFleetTranscript } from "../../tui/fleet-transcript.ts";
export type { FleetTranscript, FleetTranscriptEvent } from "../../tui/fleet-transcript.ts";
