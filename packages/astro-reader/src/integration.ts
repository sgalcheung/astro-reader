import fs from "node:fs/promises";
import path from "node:path";

import type { AstroConfig, AstroIntegration } from "astro";
import emitAssetIntegration from "astro-emit-asset";

import { setState } from "./state.ts";
import { EXTENSIONS } from "./types.ts";
import { titleFor } from "./utils/titleFor.ts";
import { typeDeclarationsFor } from "./utils/typeDeclarationsFor.ts";

export function astroReader(options: { fontName?: string } = {}): AstroIntegration {
	return {
		name: "astro-reader",
		hooks: {
			"astro:config:setup": async ({ config, command, updateConfig, logger }) => {
				const isDev = command === "dev";

        const host = config.server?.host === true ? 'localhost' : (config.server?.host || 'localhost');
        const port = config.server?.port || 4321;
        const devServerUrl = `http://${host}:${port}`;

				setState({
					fontName:options.fontName,
          devServerUrl,
					defaults: undefined,
					timeout: undefined,
					isDev,
					logger,
				});

				updateConfig({
					integrations: [emitAssetIntegration()],
					vite: {
						plugins: [vitePluginImportContent()],
					},
				});

				// const existingProcessor = config.markdown?.processor;

				// if (existingProcessor?.name === "satteri") {
				// TODO
				// injectMarkdownPlugin(
				//   existingProcessor,
				//   'mdastPlugins',
				//   satteriPlugin(options),
				// );
				// 	updateConfig({ markdown: { processor: existingProcessor } });
				// 	logger?.info("Registered Sätteri mdast plugin");
				// 	return;
				// }

				// if (existingProcessor?.name === 'unified') {
				//   injectMarkdownPlugin(existingProcessor, 'remarkPlugins', [
				//     // remarkPlugin, //TODO
				//     options,
				//   ]);
				//   updateConfig({ markdown: { processor: existingProcessor } });
				//   logger?.info('Registered unified remark plugin');
				//   return;
				// }

				// throw new Error(
				// 	"astro-lilypond requires a processor-based Astro markdown config. " +
				// 		"Set `markdown.processor` to `satteri(…)` (Astro 7 default) or " +
				// 		"`unified(…)` from `@astrojs/markdown-remark`, then add this integration. " +
				// 		`Detected processor: ${existingProcessor?.name ?? "none"}.`,
				// );
			},

			"astro:config:done": ({ injectTypes }) => {
				injectTypes({
					filename: "astro-reader-types.d.ts",
					content: typeDeclarationsFor(EXTENSIONS),
				});
			},
		},
	};
}

type VitePlugin = NonNullable<AstroConfig["vite"]["plugins"]>[number];

function vitePluginImportContent() {
	return {
		name: "vite-plugin-astro-reader-content-loader",
		enforce: "pre",

		async transform(code, id) {
			const isMd = id.endsWith(".md") || id.endsWith(".markdown");
			const isPdf = id.endsWith(".pdf");
			const isText = id.endsWith(".txt");

			// 排除带查询参数的文件 (如 ?url, ?raw, ?astro)
			if (!(isMd || isPdf || isText) || id.includes("?")) {
				return null; // 放行，交给 Astro 或 Vite 默认处理
			}

			// ⚠️ 强烈建议：限制拦截范围，避免破坏 Astro 的 Content Collections
			// 例如：只拦截 src/data/ 或 src/assets/ 目录下的文件
			// if (!id.includes('/data/') && !id.includes('/assets/')) {
			//   return null;
			// }

			const absolutePath = path.isAbsolute(id) ? id : path.resolve(process.cwd(), id);

			try {
				// 获取元数据 (虽然 Vite 已经读了一次文件内容作为 code 传给我们，
				// 但为了保持逻辑统一和获取 mtime，我们依然调用 stat)
				const stat = await fs.stat(absolutePath);
				const sourceKey = `${stat.mtimeMs}-${stat.size}`;
				const assetTitle = titleFor(absolutePath);

				let resourceType: "pdf" | "markdown" | "text" = "text";
				if (isPdf) resourceType = "pdf";
				else if (isMd) resourceType = "markdown";

				// ⭐ 核心：返回新的代码对象。Vite 会停止后续的 transform，
				// Astro 的 Markdown 插件将不会处理这个文件。
				return {
					code: `export default {
            resourceType: ${JSON.stringify(resourceType)},
            filePath: ${JSON.stringify(absolutePath)},
            sourceKey: ${JSON.stringify(sourceKey)},
            assetTitle: ${JSON.stringify(assetTitle)}
          };`,
					map: null,
				};
			} catch (err) {
				console.error(`[astro-reader] Failed to transform ${id}:`, err);
				return null; // 出错时回退
			}
		},

		// async load(id: string) {
		// 	const isPdf = id.endsWith(".pdf");
		// 	const isText = id.endsWith(".txt");

		// 	if (!(isPdf || isText) || id.includes("?")) {
		// 		return null;
		// 	}

		// 	const stat = await fs.stat(id);
		// 	const sourceKey = `${stat.mtimeMs}-${stat.size}`;
		// 	const assetTitle = titleFor(id);

		// 	let resourceType: "pdf" | "text" = "text";
		// 	if (isPdf) resourceType = "pdf";

		// 	return `
		//     export default {
		//       resourceType: ${JSON.stringify(resourceType)},
		//       filePath: ${JSON.stringify(id)},
		//       sourceKey: ${JSON.stringify(sourceKey)},
		//       assetTitle: ${JSON.stringify(assetTitle)}
		//     };
		//   `;
		// },
	} satisfies VitePlugin;
}
