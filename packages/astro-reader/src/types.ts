import type { AstroIntegrationLogger } from "astro";

import type { Metadata } from "./utils/metadata.ts";

/**
 * for import resource type
 */
export const EXTENSION_MAP = {
	".md": "markdown",
	".txt": "text",
	".pdf": "pdf",
} as const;

export type Extension = keyof typeof EXTENSION_MAP;
type ResourceType = (typeof EXTENSION_MAP)[keyof typeof EXTENSION_MAP];
export const EXTENSIONS = Object.keys(EXTENSION_MAP) as Extension[];
export const RESOURCE_TYPES = Object.values(EXTENSION_MAP) as ResourceType[];

export interface AstroReaderImportFile {
	source: string;
	sourceName: string;
	sourceKey: string;
}

/**
 * for output file type
 * for astro-emit-asset to cache store type
 * how to view the result of the file
 */
export const FORMATS = {
	SVG: "svg",
	PDF: "pdf",
} as const;

export type Format = (typeof FORMATS)[keyof typeof FORMATS];

export const RESOURCE_TO_FORMAT: Record<ResourceType, Format> = {
	text: FORMATS.SVG,
	markdown: FORMATS.SVG,
	pdf: FORMATS.PDF,
};

export interface Defaults {
	/**
	 * LilyPond version to use for every block that
	 * doesn't already declare `\version`.
	 * @default "2.26.0"
	 */
	// version?: LilypondVersion;

	/**
	 * Output format.
	 * @default "svg"
	 */
	format?: Format;

	/**
	 * Resolution in DPI (only applies to PNG).
	 * @default 144
	 */
	resolution?: number;

	/**
	 * Multiplies the `width`/`height` on a cropped score's `<img>` tag.
	 * Helps compensate for LilyPond's internal size units (points/mm)
	 * appearing too small when converted to pixels. Only affects the `<img>`
	 * dimensions on the page; rendered files are not affected.
	 * Has no effect on uncropped (paginated) output.
	 * @default 1.5
	 */
	cropScale?: number;
}

/**
 * The subset of `LilypondDefaults` that `render()` itself reads. `version`
 * and `format` are resolved by the caller before reaching `render()`.
 */
export type RenderDefaults = Omit<Defaults, "format">;

export interface InternalRenderOptions {
	/**
	 * Output format.
	 * @default "svg"
	 */
	format?: Format;

	/**
	 * Crop the output tightly to the content bounding box, producing one
	 * continuous image instead of paginated output. Disable for full-page,
	 * potentially multi-page output.
	 * @default true
	 */
	crop?: boolean;

	/**
	 * Defaults for rendering each score. `version` and `crop` aren't read
	 * here — see `RenderDefaults`.
	 */
	defaults?: RenderDefaults;

	/**
	 * Path to the `lilypond` binary.
	 * @default "lilypond"
	 */
	// binaryPath?: string;

	/**
	 * Extra directories LilyPond should search for `\include`d files.
	 * Typically the directory containing the source `.ly`/Markdown file.
	 */
	includePaths?: string[];

	/**
	 * Base name to give the temp input file passed to LilyPond, so build
	 * output (e.g. `Processing "bach-schenker.ly"`). Falls back to
	 * `"input.ly"` when omitted or unsafe to use as a filename.
	 */
	sourceName?: string;

	/**
	 * Milliseconds to wait for a single `lilypond` invocation before
	 * aborting it, so a pathological score can't hang the build forever.
	 * @default 60000
	 */
	timeout?: number;

	/**
	 * Warning and failure logging from LilyPond.
	 */
	logger: Pick<AstroIntegrationLogger, "warn" | "error">;
}

const defaultDefaults: Required<Defaults> = {
	// version: '2.26.0',
	format: "svg",
	resolution: 144,
	cropScale: 1.5,
};

export const defaultOptions: Required<
	Omit<InternalRenderOptions, "includePaths" | "sourceName" | "defaults" | "logger">
> & { defaults: Required<Defaults> } = {
	format: defaultDefaults.format,
	crop: true,
	// binaryPath: 'lilypond',
	timeout: 60_000,
	defaults: defaultDefaults,
};

export interface Page {
	src: string;
	width?: number;
	height?: number;
}

export interface ImageResult {
	format: Format;
	page: Page;
	alt?: string;
}

export interface Score {
	source: string;
	alt: string;
	sourceName?: string;
	includePaths: string[];
	assetTitle: string;
	meta: Metadata;
}
