import fs from "node:fs/promises";
import path from "node:path";

import { Resvg } from "@resvg/resvg-js";
import { marked } from "marked";
import satori from "satori";
import { html } from "satori-html";

const fontPath = path.resolve(process.cwd(), "public/fonts/LXGWWenKai-Regular.ttf");

let fontBuffer: Buffer | null = null;
let fontLoadError: Error | null = null;

async function getFontBuffer() {
	if (fontBuffer) return fontBuffer;
	if (fontLoadError) throw fontLoadError;

	try {
		fontBuffer = await fs.readFile(fontPath);
	} catch (err) {
		// ⭐ 核心修改：提供极其清晰的错误提示，而不是晦涩的 ENOENT
		fontLoadError = new Error(
			`[astro-reader] 找不到中文字体文件！\n` +
				`预期路径: ${fontPath}\n` +
				`请确保已将 .ttf 或 .otf 字体文件放置在此路径下。\n` +
				`下载地址参考: https://github.com/lxgw/LxgwWenKai/releases`,
		);
		console.warn("\n⚠️", fontLoadError.message, "\n");
		throw fontLoadError;
	}

	return fontBuffer;
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

	// 1. 准备 HTML 内容
	let bodyHtml = content;
	if (isMarkdown) {
		bodyHtml = await marked.parse(content);
	} else {
		bodyHtml = content.replace(/\n/g, "<br/>");
	}

	// 2. 构建排版结构 (包含完整的 CSS 样式重置)
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

	// 3. Satori: HTML -> SVG
	const markup = html(htmlString);
	const PAGE_WIDTH = 1200;
	const PAGE_HEIGHT = 1600;

	const svg = await satori(markup as any, {
		width: PAGE_WIDTH,
		height: PAGE_HEIGHT,
		fonts: [{ name: "CustomFont", data: fontData, weight: 400, style: "normal" }],
	});

	// 4. Resvg: SVG -> 高清 PNG (2x 缩放保证打印清晰度)
	const resvg = new Resvg(svg, {
		fitTo: { mode: "width", value: PAGE_WIDTH * 2 },
	});
	const pngBuffer = resvg.render().asPng();

	// 5. ⭐ Pdf-lib: PNG -> 真正的 PDF 文件 (完美支持 ESM，无 __dirname 报错)
	const pdfDoc = await PDFDocument.create();

	// 添加一页，使用标准 A4 尺寸 (595.28 x 841.89 points)
	const page = pdfDoc.addPage([595.28, 841.89]);

	// 嵌入我们生成的 PNG 图片
	const pngImage = await pdfDoc.embedPng(pngBuffer);

	// 将图片绘制到页面上，拉伸以完美填满整个 A4 页面
	page.drawImage(pngImage, {
		x: 0,
		y: 0,
		width: 595.28,
		height: 841.89,
	});

	// 保存并返回 Buffer
	const pdfBytes = await pdfDoc.save();
	return Buffer.from(pdfBytes);
}
