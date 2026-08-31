import markdownContent from "../content/marked-demo.md?raw";
import txtContent from "../content/plain-text-to-pdf.txt?raw";
import typstContent from "../content/typst-demo.typ?raw";

export type Tabs = {
	[x: string]: string;
};

const playgroundTabs: Tabs = {
	Markdown: markdownContent,
	TXT: txtContent,
	Typst: typstContent,
};

export default playgroundTabs;
