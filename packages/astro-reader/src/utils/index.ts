import { type Defaults, defaultOptions } from "../types.js";

/** Fills in any `defaults` fields left unset with `render.ts`'s own defaults. */
export function resolveDefaults(defaults: Defaults | undefined): Required<Defaults> {
	const { format, resolution, cropScale } = defaultOptions.defaults;

	return {
		// version: defaults?.version ?? version,
		format: defaults?.format ?? format,
		resolution: defaults?.resolution ?? resolution,
		cropScale: defaults?.cropScale ?? cropScale,
	};
}
