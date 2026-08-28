export interface CatalogItem {
	label: string;
	link: string;
	fileUrl: string;
}

export interface CatalogType extends Array<{
	label: string;
	items: Array<CatalogItem>;
}> {}

export type SiteInfo = {
	catalogs: CatalogType;
};

// const PROXY_SERVER = "https://cors-anywhere.herokuapp.com" as const;

// const toProxyPdfUrl = (fileUrl: string) => `${PROXY_SERVER}/${fileUrl}`;

export const siteInfo: SiteInfo = {
	catalogs: [
		{
			label: "Getting Started",
			items: [
				{
					label: "helloworld",
					link: "/getting-started/helloworld",
					fileUrl: "src/content/helloworld.pdf",
				},
				{
					label: "Sample PDF",
					link: "/getting-started/sample-pdf",
					fileUrl: "https://ontheline.trincoll.edu/images/bookdown/sample-local-pdf.pdf",
				},
			],
		},
		{
			label: "txt-asset",
			items: [
				{
					label: "plain-text-to-pdf",
					link: "/txt-asset/plain-text-to-pdf",
					fileUrl: "src/content/plain-text-to-pdf.txt",
				},
			],
		},
		{
			label: "markdown-assert",
			items: [
				{
					label: "marked-demo",
					link: "/markdown-assert/marked-demo",
					fileUrl: "src/content/marked-demo.md",
				},
			],
		},
		{
			label: "More PDFs",
			items: [
				{
					label: "mozilla PDF.js demo",
					link: "/more-pdf/mozilla PDF.js demo",
					fileUrl: "https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf",
				},
				{
					label: "专栏导语（本地）",
					link: "/more-pdf/jpa-research-methods-local",
					fileUrl: "src/content/jpa-research-methods.pdf",
				},
			],
		},
	],
};
