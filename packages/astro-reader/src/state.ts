import type { AstroIntegrationLogger } from "astro";

import type { Defaults } from "./types.ts";

export interface State {
	/**
	 * 是否启用自动代理 API 生成。
	 * 设为 true 时，会自动在宿主项目的 src/pages/api/ 下生成 pdf-proxy.ts
	 */
	enableProxy?: boolean | undefined;
	fontName?: string | undefined;
	devServerUrl: string;
	filePathMap: Record<string, string>;
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
