import fs from "node:fs/promises";
import path from "node:path";

import { Resvg } from "@resvg/resvg-js";
import { marked } from "marked";
import { PDFDocument } from "pdf-lib";
import satori from "satori";
import { html } from "satori-html";
import { fontData, experimental_getFontFileURL, type FontData } from "astro:assets";
import { getState } from "../state.ts";


// const fontPath = path.resolve(process.cwd(), "public/fonts/LXGWWenKai-Regular.ttf");

// let fontBuffer: Buffer | null = null;
// let fontLoadError: Error | null = null;

// async function getFontBuffer() {
// 	if (fontBuffer) return fontBuffer;
// 	if (fontLoadError) throw fontLoadError;

// 	try {
// 		fontBuffer = await fs.readFile(fontPath);
// 	} catch (err) {
// 		// ⭐ 核心修改：提供极其清晰的错误提示，而不是晦涩的 ENOENT
// 		fontLoadError = new Error(
// 			`[astro-reader] 找不到中文字体文件！\n` +
// 				`预期路径: ${fontPath}\n` +
// 				`请确保已将 .ttf 或 .otf 字体文件放置在此路径下。\n` +
// 				`下载地址参考: https://github.com/lxgw/LxgwWenKai/releases`,
// 		);
// 		console.warn("\n⚠️", fontLoadError.message, "\n");
// 		throw fontLoadError;
// 	}

// 	return fontBuffer;
// }

// https://docs.astro.build/en/guides/fonts/#accessing-font-data-programmatically
let fontBuffer: ArrayBuffer | null = null;
let fontInfo: FontData["src"][0] | undefined;
let fontUrl:string;

function isEmptyRecord(record:typeof fontData) {
  return record === null || record === undefined || 
         (typeof record === 'object' && Object.keys(record).length === 0);
}

async function getFontBuffer() {
  if (fontBuffer) return fontBuffer;

  const { fontName, devServerUrl, isDev } = getState();

try {
if (isEmptyRecord(fontData)) {
    throw new Error(
      `\n[astro-reader] No font configuration found.\n` +
        `Please ensure that the fonts are configured correctly in the fonts section of astro.config.mjs.`
    );
  }

  // TODO: default use first subsets
  const targetFontKey = fontName || Object.keys(fontData)[0]!;
  const fontVariants = fontData[targetFontKey];

  if (!fontVariants || fontVariants.length === 0) {
    throw new Error(
      `\n[astro-reader] No font named "${fontName || 'default'}" was found.\n` +
        `Please ensure that the fonts are configured correctly in the fonts section of astro.config.mjs.`
    );
  }

 fontInfo = fontVariants[0]?.src?.[0];

  if (!fontInfo || !fontInfo.url) {
    throw new Error(
      `\n[astro-reader] Unable to retrieve the URL path for the font "${targetFontKey}".\n` +
        `Please check if the font configuration contains a valid src path.`
    );
  }

  const baseUrl = isDev ? devServerUrl : (import.meta.env.SITE || 'http://localhost:4321');
   fontUrl = experimental_getFontFileURL(fontInfo.url, new URL(baseUrl));

    const response = await fetch(fontUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    fontBuffer = await response.arrayBuffer();
    return fontBuffer;
  } catch (fetchError) {
    console.warn(`[astro-reader] Fetching font from ${fontUrl} failed. Falling back to local fs.readFile.`);
    
    try {
      const publicFontsDir = path.resolve(process.cwd(), "public/fonts");
      const publicDir = path.resolve(process.cwd(), "public");

      let localFontBuffer = await readFirstTtfFromDir(publicFontsDir);

      if (!localFontBuffer) {
        localFontBuffer = await readFirstTtfFromDir(publicDir);
      }

      if(!localFontBuffer){
        throw new Error("No .ttf or .otf font files were found in the public/fonts or public directory.")
      }

      fontBuffer = localFontBuffer;
      return fontBuffer;

    } catch (fsError) {
      throw new Error(
        `\n[astro-reader] Font loading failed completely! \n` +
        `Fetch error: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}\n` +
        `FS read error: ${fsError instanceof Error ? fsError.message : String(fsError)}\n` +
        `Please ensure that the font file exists in the public directory and that astro.config.mjs is configured correctly.`
      );
    }
  }
}

async function readFirstTtfFromDir(dirPath: string): Promise<ArrayBuffer | null> {
  try {
    const files = await fs.readdir(dirPath);
    const ttfFile = files.find((f) => f.endsWith(".ttf") || f.endsWith(".otf"));
    
    if (ttfFile) {
      const filePath = path.join(dirPath, ttfFile);
      const buffer = await fs.readFile(filePath);
      // 将 Node.js Buffer 转换为标准的 ArrayBuffer
      return buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength
      ) as ArrayBuffer;
    }
  } catch (e) {
    // 目录不存在 (ENOENT) 或无权限，静默返回 null，交由上层处理
  }
  return null;
}

/**
 * 通用的 Satori 渲染函数，接收 Satori 节点 (JSX 或 satori-html 生成的对象)
 */
export async function renderSatoriToSvg(node: any, width = 1200, height = 1600): Promise<Buffer> {
	const fontData = await getFontBuffer();

	const svg = await satori(node, {
		width,
		height,
		fonts: [
			{
				name: "CustomFont",
				data: fontData,
				weight: 400,
				style: "normal",
			},
		],
	});

	return Buffer.from(svg, "utf-8");
}

/**
 * 将 HTML 字符串通过 Satori 渲染为 SVG Buffer
 */
export async function renderHtmlToSvg(
	htmlString: string,
	width = 1200,
	height = 1600,
): Promise<Buffer> {
	const fontData = await getFontBuffer();

	// 1. 将 HTML 字符串转换为 Satori 兼容的虚拟 DOM 节点
	const markup = html(htmlString);

	// 2. 生成 SVG
	const svg = await satori(markup as any, {
		width,
		height,
		fonts: [
			{
				name: "CustomFont",
				data: fontData,
				weight: 400,
				style: "normal",
			},
		],
	});

	return Buffer.from(svg, "utf-8");
}

export async function renderContentToPdf(
	title: string,
	content: string,
	isMarkdown = false,
): Promise<Buffer> {
	const fontData = await getFontBuffer();

	let bodyHtml = content;
	if (isMarkdown) {
		bodyHtml = await marked.parse(content);
	} else {
		bodyHtml = content.replace(/\n/g, "<br/>");
	}

	const htmlString = `
    <div style="display:flex; flex-direction:column; width:100%; height:100%; padding:60px; font-family:'CustomFont'; background:#ffffff; color:#333333; box-sizing: border-box;">
      <h1 style="font-size:48px; font-weight:bold; margin: 0 0 30px 0; padding-bottom:15px; border-bottom:2px solid #eee; color:#111; line-height: 1.2;">
        ${title}
      </h1>
      
      <div style="display: flex; flex-direction: column; font-size:24px; line-height:1.8; letter-spacing:0.02em; gap: 15px;">
        ${bodyHtml}
      </div>

      <style>
        * { box-sizing: border-box; }
        p { margin: 0 0 20px 0; line-height: 1.8; }
        ul, ol { margin: 0 0 20px 0; padding-left: 40px; display: flex; flex-direction: column; gap: 10px; }
        li { margin: 0; line-height: 1.6; }
        blockquote { margin: 0 0 20px 0; padding: 15px 20px; border-left: 4px solid #ddd; background: #f9f9f9; color: #555; font-style: italic; }
        pre { margin: 0 0 20px 0; background: #f4f4f4; padding: 20px; border-radius: 8px; overflow-x: auto; font-family: monospace; font-size: 20px; line-height: 1.5; }
        code { font-family: monospace; background: #f4f4f4; padding: 2px 6px; border-radius: 4px; font-size: 20px; }
        pre code { background: transparent; padding: 0; }
        h2 { font-size: 36px; margin: 30px 0 15px 0; font-weight: bold; line-height: 1.3; }
        h3 { font-size: 28px; margin: 25px 0 12px 0; font-weight: bold; line-height: 1.3; }
        a { color: #007bff; text-decoration: underline; }
      </style>
    </div>
  `;

	// Satori: HTML -> SVG
	const markup = html(htmlString);
	const PAGE_WIDTH = 1200;
	const PAGE_HEIGHT = 1600;

	const svg = await satori(markup as any, {
		width: PAGE_WIDTH,
		height: PAGE_HEIGHT,
		fonts: [{ name: "CustomFont", data: fontData, weight: 400, style: "normal" }],
	});

	// Resvg: SVG -> PNG (2x)
	const resvg = new Resvg(svg, {
		fitTo: { mode: "width", value: PAGE_WIDTH * 2 },
	});
	const pngBuffer = resvg.render().asPng();

	// ⭐ Pdf-lib: PNG -> PDF
	const pdfDoc = await PDFDocument.create();

	// page A4 size (595.28 x 841.89 points)
	const page = pdfDoc.addPage([595.28, 841.89]);

	const pngImage = await pdfDoc.embedPng(pngBuffer);

	page.drawImage(pngImage, {
		x: 0,
		y: 0,
		width: 595.28,
		height: 841.89,
	});

	const pdfBytes = await pdfDoc.save();
	return Buffer.from(pdfBytes);
}
