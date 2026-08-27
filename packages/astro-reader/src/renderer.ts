import { NodeCompiler } from "@myriaddreamin/typst-ts-node-compiler";
import markdown2typst from "markdown2typst";

export async function renderContent(content: string, outputFormat: string): Promise<Buffer> {
	const md2typstString = markdown2typst(content);
	const showLink = "#show link: it => { set text(fill: blue); underline(it) }";
	const typstSource = `${showLink} \n${md2typstString}`;

	const $typst = NodeCompiler.create();

	let svgResult = "";

	if (outputFormat === "svg") {
		svgResult = $typst.plainSvg({
			mainFileContent: typstSource,
		});
	} else if (outputFormat === "pdf") {
		svgResult = $typst.svg({
			mainFileContent: typstSource,
		});
	}

	return Buffer.from(svgResult);
}
