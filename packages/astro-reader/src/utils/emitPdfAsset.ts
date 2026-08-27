import { emitAsset } from "astro-emit-asset/emit";

import type { Format } from "../types.ts";

export interface EmitPdfAssetOptions {
	title: string;
	source: string;
	render: () => Promise<Buffer>;
	fromat?: Format;
}

export async function emitPdfAsset(options: EmitPdfAssetOptions): Promise<PdfResult> {
	const { title, source, render, fromat } = options;

	const asset = await emitAsset(`${title}.[hash].${fromat}`, [source, fromat], async () => {
		const data = await render();
		return { data };
	});

	return { src: asset.src };
}

export interface PdfResult {
	src: string;
}
