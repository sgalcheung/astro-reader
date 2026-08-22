import { Resvg } from "@resvg/resvg-js";
import { PDFDocument } from "pdf-lib"; // ⭐ 替换掉 pdfkit

export async function convertSvgToPdf(
	svgBuffer: Buffer,
	width: number,
	height: number,
): Promise<Buffer> {
	// 1. 使用 resvg 将 SVG 渲染为高清 PNG (2x 缩放保证打印清晰度)
	const resvg = new Resvg(svgBuffer, {
		fitTo: { mode: "width", value: width * 2 },
	});
	const pngData = resvg.render();
	const pngBuffer = pngData.asPng();

	// 2. ⭐ 使用 pdf-lib 创建 PDF 并将 PNG 嵌入 (彻底解决 __dirname 报错)
	const pdfDoc = await PDFDocument.create();

	// 添加一页，尺寸与原始 SVG 尺寸一致 (pt)
	const page = pdfDoc.addPage([width, height]);

	// 嵌入我们生成的 PNG 图片
	const pngImage = await pdfDoc.embedPng(pngBuffer);

	// 将图片绘制到页面上，铺满整个页面
	page.drawImage(pngImage, {
		x: 0,
		y: 0,
		width: width,
		height: height,
	});

	// 保存并返回 Buffer
	const pdfBytes = await pdfDoc.save();
	return Buffer.from(pdfBytes);
}
