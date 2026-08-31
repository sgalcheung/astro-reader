// typst.ts

// 声明全局 $typst 类型，避免 TypeScript 报错
declare global {
	interface Window {
		$typst: any;
	}
}

let isInitialized = false;
let initPromise: Promise<void> | null = null;

/**
 * 初始化 Typst 编译器和渲染器 (单例模式，确保只加载一次)
 */
export const initTypst = (): Promise<void> => {
	if (isInitialized) return Promise.resolve();
	if (initPromise) return initPromise;

	initPromise = new Promise((resolve, reject) => {
		if (window.$typst) {
			isInitialized = true;
			resolve();
			return;
		}

		const script = document.createElement("script");
		script.type = "module";
		script.src =
			"https://cdn.jsdelivr.net/npm/@myriaddreamin/typst.ts@0.7.0/dist/esm/contrib/all-in-one-lite.bundle.js";
		script.id = "typst-loader";

		script.onload = () => {
			try {
				window.$typst.setCompilerInitOptions({
					getModule: () =>
						"https://cdn.jsdelivr.net/npm/@myriaddreamin/typst-ts-web-compiler@0.7.0/pkg/typst_ts_web_compiler_bg.wasm",
				});
				window.$typst.setRendererInitOptions({
					getModule: () =>
						"https://cdn.jsdelivr.net/npm/@myriaddreamin/typst-ts-renderer@0.7.0/pkg/typst_ts_renderer_bg.wasm",
				});
				isInitialized = true;
				resolve();
			} catch (err) {
				reject(new Error(`Failed to initialize Typst WASM: ${err}`));
			}
		};

		script.onerror = () => {
			reject(new Error("Failed to load Typst compiler script from CDN."));
		};

		document.head.appendChild(script);
	});

	return initPromise;
};

/**
 * 将 Typst 代码渲染为 SVG 字符串
 */
export const renderTypstSvg = async (code: string): Promise<string> => {
	if (!isInitialized || !window.$typst) {
		throw new Error("Typst is not initialized. Call initTypst() first.");
	}
	return await window.$typst.svg({ mainContent: code });
};

/**
 * 将 Typst 代码渲染为 PDF Blob 对象
 */
export const renderTypstPdf = async (code: string): Promise<Blob> => {
	if (!isInitialized || !window.$typst) {
		throw new Error("Typst is not initialized. Call initTypst() first.");
	}
	const pdfData = await window.$typst.pdf({ mainContent: code });
	return new Blob([pdfData], { type: "application/pdf" });
};
