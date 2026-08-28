import * as fss from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { AstroConfig, AstroIntegration } from "astro";
import emitAssetIntegration from "astro-emit-asset";

import { setState } from "./state.js";
import { EXTENSIONS, type AstroReaderImportFile } from "./types.js";
import { extractRawContent } from "./utils/acornHelper.js";
import { sourceNameFor } from "./utils/filePathHelper.js";

export function astroReader(
	options: { fontName?: string; enableProxy?: boolean } = {},
): AstroIntegration {
	return {
		name: "astro-reader",
		hooks: {
			"astro:config:setup": async ({ config, command, updateConfig, logger }) => {
				const isDev = command === "dev";

				if (options.enableProxy) {
					generateProxyAPI(config);
				}

				const host =
					config.server?.host === true ? "localhost" : config.server?.host || "localhost";
				const port = config.server?.port || 4321;
				const devServerUrl = `http://${host}:${port}`;

				setState({
					enableProxy: options.enableProxy,
					fontName: options.fontName,
					devServerUrl,
					filePathMap: {},
					defaults: undefined,
					timeout: undefined,
					isDev,
					logger,
				});

				updateConfig({
					integrations: [emitAssetIntegration()],
					vite: {
						plugins: [typstPlugin(), vitePluginImportContent()],
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

function generateProxyAPI(config: AstroConfig) {
	const rootDir = fileURLToPath(config.root);
	const apiDir = path.join(rootDir, "src/pages/api");
	const apiFilePath = path.join(apiDir, "pdf-proxy.ts");

	if (!fss.existsSync(apiDir)) {
		fss.mkdirSync(apiDir, { recursive: true });
	}

	// 如果 API 文件不存在，则自动写入模板代码
	if (!fss.existsSync(apiFilePath)) {
		const apiTemplate = `
import type { APIRoute } from 'astro';
export const prerender = false; 

export const GET: APIRoute = async ({ request, url }) => {
  const searchParams = new URL(request.url).searchParams;
  const key = searchParams.get('key');
  
  if (!key) {
    return new Response('Missing PDF key', { status: 400 });
  }

  try {
    // 解码 Base64 获取真实 URL 
    // ⚠️ 生产环境安全建议：建议将此逻辑替换为通过 key (作为 ID) 查询数据库获取真实 URL
    const targetUrl = atob(key);
    const fullUrl = targetUrl.startsWith('http') 
      ? targetUrl 
      : new URL(targetUrl, url.origin).toString();

    const response = await fetch(fullUrl, {
      headers: { 
        'x-requested-with': 'XMLHttpRequest',
        // 可在此处添加宿主项目的全局鉴权 Header，例如:
        // 'Authorization': \`Bearer \${process.env.PDF_SECRET}\`
      }
    });

    if (!response.ok) {
      throw new Error(\`Backend fetch failed: \${response.status}\`);
    }

    // 将远程流直接 Pipe 给前端，不占用服务端多余内存
    return new Response(response.body, {
      status: 200,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/pdf',
        'Content-Disposition': 'inline',
        'Cache-Control': 'private, max-age=3600'
      }
    });
  } catch (error) {
    console.error('[PDF Proxy Error]', error);
    return new Response('Failed to load PDF', { status: 500 });
  }
};`;

		fss.writeFileSync(apiFilePath, apiTemplate, "utf-8");
		console.log(
			"✅ [astro-reader] PDF proxy API was automatically generated.: src/pages/api/pdf.ts",
		);
	}
}

function typeDeclarationsFor(extensions: readonly string[]): string {
	return extensions
		.map(
			(ext) =>
				`declare module "*${ext}" {\n  const arif: import("astro-reader").AstroReaderImportFile;\n  export default arif;\n}`,
		)
		.join("\n");
}

type VitePlugin = NonNullable<AstroConfig["vite"]["plugins"]>[number];

function vitePluginImportContent() {
	return {
		name: "vite-plugin-astro-reader-content",
		enforce: "pre",
		async transform(source, id) {
			// 排除带查询参数的文件 (如 ?url, ?raw, ?astro)
			if (!EXTENSIONS.some((ext) => id.endsWith(ext)) || id.includes("?")) return null;

			const filePath = path.isAbsolute(id) ? id : path.resolve(process.cwd(), id);

			// 获取元数据 (虽然 Vite 已经读了一次文件内容作为 code 传给我们，
			// 但为了保持逻辑统一和获取 mtime，我们依然调用 stat)
			const stat = await fs.stat(filePath);
			const sourceKey = `${stat.mtimeMs}-${stat.size}`;
			const sourceName = sourceNameFor(id);

			if (!sourceName) return;

			let processedSource = "";

			if (sourceName.endsWith(".md")) {
				processedSource = extractRawContent(source);
			} else if (sourceName.endsWith(".txt")) {
				processedSource = await fs.readFile(filePath, "utf-8");
				processedSource = processedSource.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
			} else if (sourceName.endsWith(".pdf")) {
				processedSource = id;
			}

			const file: AstroReaderImportFile = {
				source: processedSource,
				sourceName,
				sourceKey,
			};

			return {
				code: `export default ${JSON.stringify(file)}`,
			};
		},
	} satisfies VitePlugin;
}

// https://github.com/Myriad-Dreamin/typst.ts/pull/835
/**
 * Fixed the compilation error of @myriaddreamin/typst-ts-node-compiler.
 * [UNLOADABLE_DEPENDENCY] Could not load
 * ../node_modules/.pnpm/@myriaddreamin+typst-ts-node-compiler-darwin-x64@0.7.0/node_modules/@myriaddreamin/typst-ts-node-compiler-darwin-x64/typst-ts-node-compiler.darwin-x64.node
 * stream did not contain valid UTF-8
 */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

function typstPlugin(): VitePlugin {
	const typstPath = require.resolve("@myriaddreamin/typst-ts-node-compiler");

	return {
		name: "astro-reader-typst",
		enforce: "pre",
		resolveId(id) {
			if (
				id === "@myriaddreamin/typst-ts-node-compiler" ||
				id.startsWith("@myriaddreamin/typst-ts-node-compiler")
			) {
				return {
					id: typstPath,
					external: "absolute",
				};
			}

			return null;
		},
	};
}
