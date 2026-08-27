import path, { basename, extname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * 从源文件路径或 URL 中提取文件名
 * /home/user/project/demo.md => demo.md
 * file:///home/user/project/score.abc => score.abc
 */
export function sourceNameFor(source: string | URL | null | undefined): string | undefined {
	if (!source) return undefined;
	const path = typeof source === "string" ? source : fileURLToPath(source);
	return basename(path);
}

const UNSAFE_CHARS = /[^a-zA-Z0-9_-]+/g;

/**
 * 从源文件名生成一个安全的、可读的标题
 * 提取文件名主体：去掉扩展名（如 song.ly → song）
 * 过滤不安全字符：只保留字母、数字、下划线和连字符
 * 规范化：
 *  连续的非法字符替换为单个 -
 *  移除首尾的 -
 * 兜底处理：如果结果为空或输入无效，返回 "dv"（default value）
 */
export function titleFor(sourceName: string | undefined): string {
	if (!sourceName) return "dv";
	const stem = basename(sourceName, extname(sourceName));
	const safe = stem.replace(UNSAFE_CHARS, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
	return safe;
}

/**
 * 从 URL 中提取文件名
 * @param url - 完整的 URL 字符串 (例如: "https://example.com/docs/report.pdf?v=1")
 * @returns 提取出的文件名 (例如: "report.pdf")，如果无法提取则返回 "untitled"
 */
export function getUrlFileName(url: string): string {
	try {
		// 1. 使用原生 URL 对象解析，自动处理协议、域名、查询参数和哈希
		const parsedUrl = new URL(url);

		// 2. 获取纯路径部分 (例如: "/docs/report.pdf")
		const pathname = parsedUrl.pathname;

		// 3. 使用 path.basename 提取最后一段作为文件名
		const fileName = path.basename(pathname);

		// 4. 边缘情况处理：如果路径以 '/' 结尾，basename 会返回空字符串
		if (!fileName || fileName === "/") {
			// 尝试从 hostname 中提取一个有意义的名字，或者使用默认值
			return parsedUrl.hostname.replace(/^www\./, "") || "untitled";
		}

		return fileName;
	} catch (error) {
		// 5. 容错处理：如果传入的不是标准 URL (例如相对路径 "/assets/file.pdf")
		// 回退到简单的字符串分割，并移除查询参数
		const fallback = url.split("?")[0]?.split("#")[0]?.split("/").pop();
		return fallback || "untitled";
	}
}
