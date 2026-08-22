import type { AstroIntegrationLogger } from "astro";

import type { Defaults } from "./types.ts";
// import type { LilypondDefaults } from "./render.js";

export interface State {
	fontName?: string | undefined;
  devServerUrl: string;
	defaults: Defaults | undefined;
	timeout: number | undefined;
	isDev: boolean;
	logger: Pick<AstroIntegrationLogger, "warn" | "error">;
}

const KEY = "astro-pdf:state";
const store = globalThis as unknown as Record<string, State | undefined>;

export function setState(state: State): void {
	store[KEY] = state;
}

export function getState(): State {
	const state = store[KEY];
	if (!state) {
		throw new Error("astro-pdf: please initialize state.");
	}
	return state;
}

export function resetStateForTests(): void {
	store[KEY] = undefined;
}
