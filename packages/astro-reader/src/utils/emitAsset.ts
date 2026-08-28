import { emitAsset } from "astro-emit-asset/emit";

import type { Format } from "../types.js";

export interface EmitDVAssetOptions {
	title: string;
	source: string;
	render: () => Promise<Buffer>;
	fromat?: Format;
}

export async function emitDVAsset(options: EmitDVAssetOptions): Promise<DVResult> {
	const { title, source, render, fromat } = options;

	const asset = await emitAsset(`${title}.[hash].${fromat}`, [source, fromat], async () => {
		const data = await render();
		return { data };
	});

	return { src: asset.src };
}

export interface DVResult {
	src: string;
}
