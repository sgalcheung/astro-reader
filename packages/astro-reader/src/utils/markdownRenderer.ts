









/** @lollopanta/mdtoimage
import { renderMarkdownToImage } from "@lollopanta/mdtoimage";
import { getState } from "../state.ts";
import { experimental_getFontFileURL, fontData } from "astro:assets";
import path from "node:path";

export async function renderMarkdownToSvg(
	mdContent: string,
): Promise<Buffer> {
	const { fontName, devServerUrl, isDev } = getState();

	const targetFontKey = fontName || Object.keys(fontData)[0]!;
	const fontVariants = fontData[targetFontKey];

	if (!fontVariants || fontVariants.length === 0) {
		throw new Error(
			`\n[astro-reader] No font named "${fontName || "default"}" was found.\n` +
				`Please ensure that the fonts are configured correctly in the fonts section of astro.config.mjs.`,
		);
	}

	const fontInfo = fontVariants[0]?.src?.[0];
	if (!fontInfo || !fontInfo.url) {
		throw new Error(
			`\n[astro-reader] Unable to retrieve the URL path for the font "${targetFontKey}".\n` +
				`Please check if the font configuration contains a valid src path.`,
		);
	}

	const baseUrl = isDev
		? devServerUrl
		: import.meta.env.SITE || "http://localhost:4321";
	// const fontUrl = experimental_getFontFileURL(fontInfo.url, new URL(baseUrl));
	// const fontUrl = (new URL(fontInfo.url,baseUrl)).toString();

	const result = await renderMarkdownToImage({
		input: mdContent,
		format: "svg",
		width: 1200,
		// theme: "dark",
		// fonts: {
		// 	body: {
		// 		path: path.resolve(process.cwd(),fontInfo.url),
		// 	},
		// },
		watermark: true, // default behavior
	});

  const buffer = Buffer.from(result.svg!, "utf-8");

	return buffer;
}
*/
