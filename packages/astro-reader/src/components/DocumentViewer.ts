import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path, { extname } from "node:path";

import { renderContent } from "../renderer.js";
import {
	EXTENSION_MAP,
	RESOURCE_TO_FORMAT,
	type AstroReaderImportFile,
	type Extension,
	type Format,
	type Page,
} from "../types.js";
import { emitDVAsset } from "../utils/emitAsset.js";
import { sourceNameFor, titleFor } from "../utils/filePathHelper.js";

export function fromImportFile(
	file: AstroReaderImportFile,
	outputFormat: Format,
): DocumentResource {
	const title = titleFor(file.sourceName);
	const ext = extname(file.sourceName).toLowerCase();
	if (!(ext in EXTENSION_MAP)) {
		throw new Error(`Unsupported file extension: ${ext}`);
	}

	const resourceType = EXTENSION_MAP[ext as Extension];
	const cacheFormat = RESOURCE_TO_FORMAT[resourceType];

	return {
		title,
		cacheKey: file.sourceKey,
		cacheFormat,
		render: async () => {
			if (resourceType == EXTENSION_MAP[".md"] || resourceType == EXTENSION_MAP[".txt"]) {
				return renderContent(file.source, outputFormat);
			}

			return await fs.readFile(file.source);
		},
	};
}

export async function fromUrlFile(
	pathOrUrl: string,
	outputFormat: Format,
): Promise<DocumentResource> {
	const isRemote = pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://");
	const fileName = sourceNameFor(pathOrUrl);
	const title = titleFor(fileName);
	const ext = path.extname(pathOrUrl).toLowerCase();

	let buffer: Buffer;
	let cacheKey: string;
	if (isRemote) {
		const response = await fetch(pathOrUrl);
		if (!response.ok) {
			throw new Error(`Failed to fetch ${pathOrUrl}: ${response.status} ${response.statusText}`);
		}
		const arrayBuffer = await response.arrayBuffer();
		buffer = Buffer.from(arrayBuffer);
		cacheKey = createHash("sha256").update(buffer).digest("hex");
	} else {
		buffer = await fs.readFile(pathOrUrl);
		const stat = await fs.stat(pathOrUrl);
		cacheKey = `${stat.mtimeMs}-${stat.size}`;
	}

	const resourceType = EXTENSION_MAP[ext as Extension];
	const cacheFormat = RESOURCE_TO_FORMAT[resourceType];

	const isTextType = ext === ".md" || ext === ".txt";

	return {
		title,
		cacheKey,
		cacheFormat,
		render: async () => {
			if (isTextType) {
				return renderContent(buffer.toString("utf-8"), outputFormat);
			}

			return buffer;
		},
	};
}

export interface DocumentResource {
	title: string;
	cacheKey: string;
	cacheFormat: Format;
	render: () => Promise<Buffer>;
}

export async function getDocumentViewer(resource: DocumentResource): Promise<Page> {
	try {
		return await emitDVAsset({
			title: resource.title,
			source: resource.cacheKey,
			fromat: resource.cacheFormat,
			render: resource.render,
		});
	} catch (err) {
		console.error("[getDocumentViewer] Error:", err);
		return { src: "" };
	}
}
