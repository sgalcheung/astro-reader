import { basename, extname } from "node:path";
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
