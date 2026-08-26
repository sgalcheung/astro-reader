import fs from "node:fs/promises";
import path from "node:path";

import { marked } from "marked";
import { html } from "satori-html";

import type { Page } from "../types.js";
import { emitPdfAsset } from "../utils/emitPdfAsset.ts";
import {
	renderContentToPdf,
	renderHtmlToSvg,
	renderSatoriToSvg,
} from "../utils/satoriRenderer.ts";
import { convertSvgToPdf } from "../utils/svgToPdf.ts";
import { getUrlFileName } from "../utils/urlHelper.ts";

export interface LocalFileContent {
	resourceType: "pdf" | "markdown" | "text";
	filePath: string;
	sourceKey: string;
	assetTitle: string;
}

export function fromImportFile(file: LocalFileContent, outputFormat: 'pdf' | 'svg'): DocumentResource {
	return {
		title: file.assetTitle,
		cacheKey: file.sourceKey,
		cacheFormat: file.resourceType === "pdf" ? "pdf" : "svg",
		render: async () => {
			if (file.resourceType === "pdf") {
				return await fs.readFile(file.filePath);
			}

			let rawText = await fs.readFile(file.filePath, "utf-8");
    
			return renderContentToPdf(
				file.assetTitle,
				rawText,
				file.resourceType === "markdown",
        outputFormat
			);
		},
	};
}

export async function fromUrlFile(url: string): Promise<DocumentResource> {
	const ext = path.extname(url).toLowerCase();

	if (ext === ".md") {
		return await fromMarkdownPathOrUrl(url);
	} else if (ext === ".txt") {
		return await fromTextPathOrUrl(url);
	}

	return await fromPdfPathOrUrl(url);
}

/**
 * Unified handling of remote URLs and local file paths
 * @param pathOrUrl - Remote URL (http/https) or local relative/absolute path
 */
export async function fromPdfPathOrUrl(
	pathOrUrl: string,
): Promise<DocumentResource> {
	const isRemote =
		pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://");
	const fileName = isRemote
		? getUrlFileName(pathOrUrl)
		: path.basename(pathOrUrl);

	if (isRemote) {
		return {
			title: fileName,
			cacheKey: pathOrUrl,
			cacheFormat: pathOrUrl.endsWith("pdf") ? "pdf" : "svg",
			render: async () => {
				const res = await fetch(pathOrUrl);
				if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
				return Buffer.from(await res.arrayBuffer());
			},
		};
	} else {
		const absolutePath = path.resolve(process.cwd(), pathOrUrl);
		const stat = await fs.stat(absolutePath);
		return {
			title: fileName,
			cacheFormat: pathOrUrl.endsWith("pdf") ? "pdf" : "svg",
			cacheKey: `${stat.mtimeMs}-${stat.size}`,
			render: async () => fs.readFile(absolutePath),
		};
	}
}

export async function fromMarkdownPathOrUrl(
	pathOrUrl: string,
): Promise<DocumentResource> {
	const isRemote =
		pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://");
	const fileName = isRemote
		? getUrlFileName(pathOrUrl)
		: path.basename(pathOrUrl);
	const title = fileName.replace(/\.[^/.]+$/, "") || fileName;

	let readText: () => Promise<string>;
	let cacheKey: string;

	if (isRemote) {
		cacheKey = pathOrUrl;
		readText = async () => {
			const res = await fetch(pathOrUrl);
			return await res.text();
		};
	} else {
		const absolutePath = path.resolve(process.cwd(), pathOrUrl);
		const stat = await fs.stat(absolutePath);
		cacheKey = `${stat.mtimeMs}-${stat.size}`;
		readText = async () => fs.readFile(absolutePath, "utf-8");
	}

	return {
		title,
		cacheKey,
		render: async () => {
			const markdownContent = await readText();

			const htmlBody = await marked.parse(markdownContent);
			const fullHtml = `
        <div style="display:flex; flex-direction:column; width:100%; height:100%; padding:80px; font-family:CustomFont; background:#ffffff; color:#333333;">
          <h1 style="font-size:56px; font-weight:bold; margin-bottom:40px; border-bottom:3px solid #f0f0f0; padding-bottom:20px; color:#111111;">${title}</h1>
          <div style="display:flex; font-size:28px; line-height:1.8; letter-spacing:1px;">
            ${htmlBody}
          </div>
        </div>
      `;
			const markup = html(fullHtml);

			return renderSatoriToSvg(markup);
		},
	};
}

export async function fromTextPathOrUrl(
	pathOrUrl: string,
): Promise<DocumentResource> {
	const isRemote =
		pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://");
	const fileName = isRemote
		? getUrlFileName(pathOrUrl)
		: path.basename(pathOrUrl);
	const title = fileName.replace(/\.[^/.]+$/, "") || fileName;

	let readText: () => Promise<string>;
	let cacheKey: string;

	if (isRemote) {
		cacheKey = pathOrUrl;
		readText = async () => {
			const res = await fetch(pathOrUrl);
			if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
			return await res.text();
		};
	} else {
		const absolutePath = path.resolve(process.cwd(), pathOrUrl);
		const stat = await fs.stat(absolutePath);
		cacheKey = `${stat.mtimeMs}-${stat.size}`;
		readText = async () => fs.readFile(absolutePath, "utf-8");
	}

	const PAGE_WIDTH = 1200;
	const PAGE_HEIGHT = 1600;

	return {
		title,
		cacheKey,
		render: async () => {
			const textContent = await readText();

			// 1. 构建带有内联 CSS 的 HTML 字符串 (支持 whiteSpace: pre-wrap 保留换行)
			const htmlString = `
        <div style="display:flex; flex-direction:column; width:100%; height:100%; padding:80px; font-family:'CustomFont'; background:#ffffff; color:#333333;">
          <h1 style="font-size:56px; font-weight:bold; margin-bottom:40px; border-bottom:3px solid #f0f0f0; padding-bottom:20px; color:#111111;">${title}</h1>
          <div style="display:flex; font-size:28px; line-height:1.8; letter-spacing:1px; white-space:pre-wrap;">${textContent}</div>
        </div>
      `;

			// 2. 使用 Satori 生成 SVG Buffer
			const svgBuffer = await renderHtmlToSvg(
				htmlString,
				PAGE_WIDTH,
				PAGE_HEIGHT,
			);

			// 3. 根据目标格式决定最终输出
			// if (targetFormat === "pdf") {
			// 	// ⚠️ 转换为真正的 PDF (包含图片嵌入)
			// 	return await convertSvgToPdf(svgBuffer, PAGE_WIDTH, PAGE_HEIGHT);
			// }

			// 默认返回 SVG Buffer (推荐，体积更小，网页渲染更清晰)
			return svgBuffer;
		},
	};
}

export interface DocumentResource {
	title: string;
	cacheKey: string;
	cacheFormat?: string;
	render: () => Promise<Buffer>;
}

export async function getDocumentViewer(
	resource: DocumentResource,
): Promise<Page> {
	try {
		return await emitPdfAsset({
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
