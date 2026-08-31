// inspired by satori-playground: https://github.com/vercel/satori/tree/main/playground

import { markdown } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";
import CodeMirror from "@uiw/react-codemirror";
import copy from "copy-to-clipboard";
// import { EditorView } from '@codemirror/view'
import * as fflate from "fflate";
import { Base64 } from "js-base64";
import { useEffect, useState, useRef, useCallback } from "react";
import toast, { Toaster } from "react-hot-toast";
// import packageJson from 'astro-reader/package.json'
import { Group, Panel } from "react-resizable-panels";

import playgroundTabs, { type Tabs as TTabs } from "../cards/playground-data";
import previewTabs from "../cards/preview-tabs";
import Introduction from "../components/introduction";
import PanelResizeHandle from "../components/panel-resize-handle";
import { initTypst, renderTypstPdf, renderTypstSvg } from "../playground/typst";
import { routes } from "../routing";
import { useDefaultLayout } from "./hooks/useDefaultLayout";

const cardNames = Object.keys(playgroundTabs);
const editedCards: TTabs = { ...playgroundTabs };

function PlaygroundPreview({ code }: { code: string }) {
	// 1. 统一将所有状态声明放在组件顶部
	const [options, setOptions] = useState<object | null>(null);
	const [debug, setDebug] = useState(false);
	const [fontEmbed, setFontEmbed] = useState(true);
	const [emojiType, setEmojiType] = useState("twemoji");
	const [objectURL, setObjectURL] = useState<string>("");
	const [renderType, setRenderType] = useState<"svg" | "pdf">("svg");
	const [pdfUrl, setPdfUrl] = useState<string>("");
	const [isTypstReady, setIsTypstReady] = useState<boolean>(false);
	const [renderError, setRenderError] = useState<string | null>(null); // 👈 修复 TS 类型
	const [width, setWidth] = useState(400 * 2);
	const [height, setHeight] = useState(200 * 2);
	const [iframeNode, setIframeNode] = useState<HTMLElement | undefined>();
	const previewContainerRef = useRef<HTMLDivElement>(null);

	const [scaleRatio, setScaleRatio] = useState(1);
	const [loadingResources, setLoadingResources] = useState(true);

	const [result, setResult] = useState("");
	const [renderedTimeSpent, setRenderTime] = useState<number>(0);
	// const updateIframeRef = useCallback(
	//   (node: HTMLIFrameElement) => {
	//     if (node) {
	//       if (node.contentWindow?.document) {
	//         /* Force tailwindcss to create stylesheets on first render */
	//         const forceUpdate = () => {
	//           return setTimeout(() => {
	//             const div = doc.createElement('div')
	//             div.classList.add('hidden')
	//             doc.body.appendChild(div)
	//             setTimeout(() => {
	//               doc.body.removeChild(div)
	//             }, 300)
	//           }, 200)
	//         }
	//         const doc = node.contentWindow.document
	//         const script = doc.createElement('script')
	//         script.src = 'https://cdn.tailwindcss.com'
	//         doc.head.appendChild(script)
	//         script.addEventListener('load', () => {
	//           const configScript = doc.createElement('script')
	//           configScript.text = `
	//           tailwind.config = {
	//             plugins: [{
	//               handler({ addBase }) {
	//                 addBase({
	//                   'html': {
	//                     'line-height': 1.2,
	//                   }
	//                 })
	//               }
	//             }]
	//           }
	//         `
	//           doc.head.appendChild(configScript)
	//         })
	//         const updateClass = () => {
	//           Array.from(doc.querySelectorAll('[tw]')).forEach((v) => {
	//             const tw = v.getAttribute('tw')
	//             if (tw) {
	//               v.setAttribute('class', tw)
	//               v.removeAttribute('tw')
	//             }
	//           })
	//         }
	//         forceUpdate()
	//         const observer = new MutationObserver(updateClass)
	//         observer.observe(doc.body, { childList: true, subtree: true })
	//         setIframeNode(doc.body)
	//       }
	//     }
	//   },
	//   [setIframeNode]
	// ) // eslint-disable-line]

	const sizeRef = useRef([width, height]);
	sizeRef.current = [width, height];
	const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

	// 2. 初始化 Typst 引擎
	useEffect(() => {
		initTypst()
			.then(() => {
				setIsTypstReady(true);
				setLoadingResources(false);
			})
			.catch((err) => {
				console.error(err);
				setRenderError(err.message);
				setLoadingResources(false);
			});
	}, []);

	useEffect(() => {
		if (overrideOptions) {
			setWidth(Math.min(overrideOptions.width || 800, 2000));
			setHeight(Math.min(overrideOptions.height || 800, 2000));
			setDebug(!!overrideOptions.debug);
			setEmojiType(overrideOptions.emojiType || "twemoji");
			setFontEmbed(!!overrideOptions.fontEmbed);
		}
	}, [overrideOptions]);

	// 3. 计算缩放比例以适应容器
	function updateScaleRatio() {
		if (!previewContainerRef.current) return;

		const [w, h] = sizeRef.current;
		const containerWidth = previewContainerRef.current.clientWidth;
		const containerHeight = previewContainerRef.current.clientHeight;
		setScaleRatio(Math.min(1, Math.min(containerWidth / w, containerHeight / h)));
	}

	useEffect(() => {
		(async () => {
			setOptions({});
		})();
	}, []);

	useEffect(() => {
		if (!previewContainerRef.current) return;

		const observer = new ResizeObserver(updateScaleRatio);
		observer.observe(previewContainerRef.current);

		return () => {
			observer.disconnect();
		};
	}, []);

	useEffect(() => {
		updateScaleRatio();
	}, [width, height, updateScaleRatio]);

	// 4. 核心渲染逻辑 (精简了依赖项，避免无效重渲染)
	useEffect(() => {
		if (!isTypstReady || !code.trim()) return;

		// 清理之前的 URL 防止内存泄漏
		if (objectURL) {
			URL.revokeObjectURL(objectURL);
			setObjectURL("");
		}

		let cancelled = false;

		// 防抖：延迟 300ms 执行
		debounceTimerRef.current = setTimeout(async () => {
			if (cancelled) return;

			setRenderError(null);
			setLoadingResources(true);
			const startTime = performance.now();

			try {
				if (renderType === "svg") {
					const svg = await renderTypstSvg(code);
					if (!cancelled) {
						setResult(svg);
						setRenderTime(performance.now() - startTime);
					}
				} else if (renderType === "pdf") {
					const blob = await renderTypstPdf(code);
					if (!cancelled) {
						const url = URL.createObjectURL(blob);
						setObjectURL(url);
						setRenderTime(performance.now() - startTime);
					}
				}
			} catch (err: any) {
				if (!cancelled) {
					console.error("Typst compilation error:", err);
					setRenderError(err.message || String(err));
					setResult("");
					setObjectURL("");
				}
			} finally {
				if (!cancelled) {
					setLoadingResources(false);
				}
			}
		}, 300);

		return () => {
			cancelled = true;
			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current);
			}
		};
	}, [code, renderType, isTypstReady]); // 👈 移除了未使用的依赖项，提升性能

	// 5. 组件卸载时清理 URL，防止内存泄漏
	useEffect(() => {
		return () => {
			if (objectURL) URL.revokeObjectURL(objectURL);
		};
	}, [objectURL]);

	const activeCard =
		previewTabs.find((text) => text.split(" ")[0].toLowerCase() === renderType) ?? previewTabs[0];

	return (
		<>
			<Panel>
				<Tabs
					options={previewTabs}
					active={activeCard}
					onChange={(text) => {
						const _renderType = text.split(" ")[0].toLowerCase();
						if (_renderType === "svg" || _renderType === "pdf") {
							setRenderType(_renderType);
						}
					}}
				>
					<div className="preview-card flex-1 min-h-0 flex flex-col">
						{renderError ? (
							<div className="error p-5 text-red-600 bg-red-50 border-l-4 border-red-500 font-mono text-sm whitespace-pre-wrap break-words m-4 rounded">
								{renderError}
							</div>
						) : null}

						{/* 👇 核心修改区：使用 Flex 居中 + 纯白背景 + 中心缩放 */}
						<div
							className="result-container flex-1 min-h-0 relative justify-center overflow-auto p-4"
							style={{ backgroundColor: "#ffffff" }}
							ref={previewContainerRef}
						>
							{renderType === "svg" ? (
								<div className="min-w-full min-h-full flex items-center justify-center p-4">
									{/* 👇 1. 占位层：占据缩放后的真实物理尺寸，用于正确触发浏览器的滚动条 */}
									<div
										style={{
											width: `${width * scaleRatio}px`,
											height: `${height * scaleRatio}px`,
											flexShrink: 0,
										}}
										className="relative"
									>
										{/* 👇 2. 渲染层：保持原始尺寸，从左上角缩放，完美填满占位层 */}
										<div
											style={{
												width: `${width}px`,
												height: `${height}px`,
												transform: `scale(${scaleRatio})`,
												transformOrigin: "top left", // 👈 关键：必须改为 top left
												position: "absolute",
												top: 0,
												left: 0,
											}}
											dangerouslySetInnerHTML={{ __html: result }}
										/>
									</div>
								</div>
							) : renderType === "pdf" && objectURL ? (
								// 👉 PDF 专属：直接 100% 撑满父容器，让浏览器原生处理滚动和缩放，无需 transform
								<iframe
									key="pdf"
									style={{
										position: "absolute",
										top: 0,
										left: 0,
										width: "100%",
										height: "100%",
										border: "none",
									}}
									src={`${objectURL}#toolbar=0&navpanes=0&scrollbar=0`}
									title="PDF Preview"
								/>
							) : null}
						</div>

						<footer className="shrink-0 flex justify-between items-center px-4 py-2 text-xs text-gray-500 border-t border-gray-200 bg-gray-50">
							<span className="ellipsis truncate">
								{loadingResources ? "Compiling..." : `[${renderType.toUpperCase()}] Generated in `}
							</span>
							<span className="data font-mono">
								{loadingResources ? "" : `${~~(renderedTimeSpent * 100) / 100}ms.`}
								{renderType === "pdf" && objectURL ? (
									<a
										href={objectURL}
										target="_blank"
										rel="noreferrer"
										className="ml-2 text-blue-600 hover:underline"
									>
										(View in New Tab ↗)
									</a>
								) : (
									""
								)}
							</span>
							<span className="font-mono">
								[{width}×{height}]
							</span>
						</footer>
					</div>
				</Tabs>
			</Panel>

			<PanelResizeHandle />

			<Panel>
				<div className="controller p-4">
					<h2 className="title text-sm font-semibold mb-4">Configurations</h2>
					<div className="content space-y-4">
						<div className="control">
							<label htmlFor="width" className="block text-xs font-medium text-gray-600 mb-1">
								Container Width
							</label>
							<div className="flex items-center gap-2">
								<input
									type="range"
									value={width}
									onChange={(e) => setWidth(Number(e.target.value))}
									min={100}
									max={1200}
									step={10}
									className="flex-1"
								/>
								<input
									id="width"
									type="number"
									value={width}
									onChange={(e) => setWidth(Number(e.target.value))}
									min={100}
									max={1200}
									step={10}
									className="w-20 px-2 py-1 text-sm border rounded"
								/>
								<span className="text-xs text-gray-500">px</span>
							</div>
						</div>
						<div className="control">
							<label htmlFor="height" className="block text-xs font-medium text-gray-600 mb-1">
								Container Height
							</label>
							<div className="flex items-center gap-2">
								<input
									type="range"
									value={height}
									onChange={(e) => setHeight(Number(e.target.value))}
									min={100}
									max={1200}
									step={10}
									className="flex-1"
								/>
								<input
									id="height"
									type="number"
									value={height}
									onChange={(e) => setHeight(Number(e.target.value))}
									min={100}
									max={1200}
									step={10}
									className="w-20 px-2 py-1 text-sm border rounded"
								/>
								<span className="text-xs text-gray-500">px</span>
							</div>
						</div>
						<div className="control pt-2 flex gap-2">
							<button
								className="px-3 py-1.5 text-xs font-medium rounded border border-gray-300 hover:bg-gray-100 transition-colors"
								onClick={() => {
									setWidth(800);
									setHeight(600);
								}}
							>
								Reset (800x600)
							</button>
							<button
								className="px-3 py-1.5 text-xs font-medium rounded border border-gray-300 hover:bg-gray-100 transition-colors"
								onClick={() => {
									setWidth(1200);
									setHeight(600);
								}}
							>
								2:1
							</button>
							<button
								className="px-3 py-1.5 text-xs font-medium rounded border border-gray-300 hover:bg-gray-100 transition-colors"
								onClick={() => {
									setWidth(1200);
									setHeight(630);
								}}
							>
								1.9:1
							</button>
						</div>

						<div className="control pt-4 border-t border-gray-200">
							<label htmlFor="export" className="block text-xs font-medium text-gray-600 mb-2">
								Export
							</label>
							<div className="flex gap-2">
								<a
									className={`flex-1 text-center px-3 py-2 text-xs font-medium rounded transition-colors ${
										!result || renderType !== "svg"
											? "bg-gray-100 text-gray-400 cursor-not-allowed"
											: "bg-blue-600 text-white hover:bg-blue-700"
									}`}
									href={
										result && renderType === "svg"
											? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(result)}`
											: undefined
									}
									target={result && renderType === "svg" ? "_blank" : undefined}
									download={result && renderType === "svg" ? "document.svg" : undefined}
									rel="noreferrer"
								>
									Export SVG
								</a>
								<a
									className={`flex-1 text-center px-3 py-2 text-xs font-medium rounded border transition-colors ${
										!result || renderType !== "svg"
											? "border-gray-200 text-gray-400 cursor-not-allowed"
											: "border-gray-300 text-gray-700 hover:bg-gray-50"
									}`}
									href="#"
									onClick={(e) => {
										e.preventDefault();
										if (!result || renderType !== "svg") return;
										window.open?.("")?.document.write(result);
									}}
								>
									View SVG ↗
								</a>
							</div>
						</div>
					</div>
				</div>
			</Panel>
		</>
	);
}

interface ITabs {
	options: string[];
	active: string;
	onChange: (value: string) => void;
	children: React.ReactNode;
}

function Tabs({ options, active, onChange, children }: ITabs) {
	return (
		<div className="tabs">
			<div className="tabs-container">
				{options.map((option) => (
					<div
						title={option}
						className={"tab" + (active === option ? " active" : "")}
						key={option}
						onClick={() => onChange(option)}
					>
						{option}
					</div>
				))}
			</div>

			{children}
		</div>
	);
}

function PlaygroundEditor({
	value,
	onChange,
	isDarkMode,
}: {
	value: string;
	onChange: (value: string) => void;
	isDarkMode: boolean;
}) {
	return (
		<div
			style={{
				height: "100%",
				position: "relative",
				background: isDarkMode ? "#282c34" : "#ffffff",
				transition: "background 0.3s ease",
			}}
		>
			<CodeMirror
				value={value}
				height="100%"
				extensions={[
					markdown(),
					// EditorView.lineWrapping,
					...(isDarkMode ? [oneDark] : []),
				]}
				onChange={onChange}
				theme="light"
				basicSetup={{
					lineNumbers: true,
					foldGutter: true,
					dropCursor: false,
					allowMultipleSelections: false,
					indentOnInput: true,
					bracketMatching: true,
					closeBrackets: true,
					autocompletion: true,
					rectangularSelection: true,
					crosshairCursor: false,
					highlightActiveLine: true,
					highlightSelectionMatches: true,
				}}
				style={{
					height: "100%",
					fontSize: "14px",
				}}
			/>
		</div>
	);
}

// For sharing & resuming.
const currentOptions = {};
let overrideOptions: any = null;

function ResetCode({
	activeCard,
	onChange,
	isDarkMode,
}: {
	activeCard: string;
	onChange: (value: string) => void;
	isDarkMode: boolean;
}) {
	return (
		<button
			onClick={() => {
				const value = playgroundTabs[activeCard];

				editedCards[activeCard] = value;
				onChange(value);

				window.history.replaceState(null, "", "/");

				toast.success("Content reset");
			}}
			style={{
				padding: "6px 14px",
				borderRadius: "6px",
				border: isDarkMode ? "1px solid #444" : "1px solid #d1d5db",
				background: isDarkMode ? "#2d2d2d" : "#ffffff",
				color: isDarkMode ? "#e5e7eb" : "#374151",
				cursor: "pointer",
				fontSize: "13px",
				fontWeight: 500,
				// 👇 核心：强制文字完美垂直和水平居中
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				transition: "all 0.2s",
				// 防止被全局 button 样式覆盖
				lineHeight: "1",
			}}
			// 鼠标悬停效果
			onMouseEnter={(e) => {
				e.currentTarget.style.background = isDarkMode ? "#3d3d3d" : "#f3f4f6";
			}}
			onMouseLeave={(e) => {
				e.currentTarget.style.background = isDarkMode ? "#2d2d2d" : "#ffffff";
			}}
		>
			Reset
		</button>
	);
}

export default function Playground() {
	const [activeCard, setActiveCard] = useState<string>("Markdown");
	const [showIntroduction, setShowIntroduction] = useState(false);
	const [isMobileView, setIsMobileView] = useState(false);

	const [code, setCode] = useState(editedCards["Markdown"]);

	// ✅ 新增：主题状态管理 (自动识别 + 记忆偏好)
	const [isDarkMode, setIsDarkMode] = useState(() => {
		if (typeof window === "undefined") return true; // SSR 兜底
		const saved = localStorage.getItem("playground-theme");
		if (saved !== null) return saved === "dark";
		// 🚀 自动识别操作系统是黑夜还是白天
		return window.matchMedia("(prefers-color-scheme: dark)").matches;
	});

	// 保存用户的手动选择
	useEffect(() => {
		if (typeof window !== "undefined") {
			localStorage.setItem("playground-theme", isDarkMode ? "dark" : "light");
		}
	}, [isDarkMode]);

	// 监听系统主题变化（如果用户没有手动设置过，则实时跟随系统）
	useEffect(() => {
		if (typeof window === "undefined") return;
		const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
		const handleChange = (e: MediaQueryListEvent) => {
			if (!localStorage.getItem("playground-theme")) {
				setIsDarkMode(e.matches);
			}
		};
		mediaQuery.addEventListener("change", handleChange);
		return () => mediaQuery.removeEventListener("change", handleChange);
	}, []);

	// set isMobileView to true if the screen is less than 600px wide
	useEffect(() => {
		const handleResize = () => {
			setIsMobileView(window.innerWidth < 600);
		};
		handleResize();
		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, []);

	useEffect(() => {
		try {
			const hasVisited = localStorage.getItem("_vercel_og_playground_visited");
			if (hasVisited) return;
		} catch (e) {
			console.error(e);
		}

		setShowIntroduction(true);
	}, []);

	const [hydrated, setHydrated] = useState(false);
	useEffect(() => {
		setHydrated(true);
	}, []);

	useEffect(() => {
		const params = new URL(String(document.location)).searchParams;
		const shared = params.get("share");

		if (!shared) return;

		try {
			const decompressedData = fflate.strFromU8(fflate.decompressSync(Base64.toUint8Array(shared)));

			let decoded: {
				code: string;
				options?: any;
				tab?: string;
			};

			try {
				decoded = JSON.parse(decompressedData);
			} catch {
				decoded = {
					code: decompressedData,
					tab: "Markdown",
				};
			}

			const tab = decoded.tab || "Markdown";

			editedCards[tab] = decoded.code;

			if (decoded.options) {
				overrideOptions = decoded.options;
			}

			setActiveCard(tab);
			setCode(decoded.code);
		} catch (e) {
			console.error("Failed to parse shared card:", e);
		}
	}, []);

	const editorPanel = (
		<Panel>
			<Tabs
				options={cardNames}
				active={activeCard}
				onChange={(name: string) => {
					setActiveCard(name);
					setCode(editedCards[name]);
				}}
			>
				<div className="editor">
					<div
						className="editor-controls"
						style={{
							display: "flex",
							alignItems: "center",
							gap: "10px",
							padding: "8px 12px",
							borderBottom: isDarkMode ? "1px solid #333" : "1px solid #e5e7eb",
							background: isDarkMode ? "#1e1e1e" : "#f9fafb",
							color: isDarkMode ? "#e5e7eb" : "#374151",
						}}
					>
						<ResetCode
							activeCard={activeCard}
							isDarkMode={isDarkMode}
							onChange={(value) => {
								editedCards[activeCard] = value;
								setCode(value);
							}}
						/>
						<button
							onClick={() => {
								const code = editedCards[activeCard];
								const compressed = Base64.fromUint8Array(
									fflate.deflateSync(
										fflate.strToU8(
											JSON.stringify({
												code,
												options: currentOptions,
												tab: activeCard,
											}),
										),
									),
									true,
								);

								window.history.replaceState(null, "", "?share=" + compressed);
								copy(window.location.href);
								toast.success("Copied to clipboard");
							}}
							style={{
								padding: "6px 12px",
								borderRadius: "6px",
								border: isDarkMode ? "1px solid #444" : "1px solid #d1d5db",
								background: isDarkMode ? "#2d2d2d" : "#ffffff",
								color: isDarkMode ? "#e5e7eb" : "#374151",
								cursor: "pointer",
								fontSize: "13px",
								fontWeight: 500,
								display: "flex", // 👈 强制居中
								alignItems: "center", // 👈 强制居中
								justifyContent: "center", // 👈 强制居中
								lineHeight: "1",
								transition: "all 0.2s",
							}}
							onMouseEnter={(e) => {
								e.currentTarget.style.background = isDarkMode ? "#3d3d3d" : "#f3f4f6";
							}}
							onMouseLeave={(e) => {
								e.currentTarget.style.background = isDarkMode ? "#2d2d2d" : "#ffffff";
							}}
						>
							Share
						</button>
						<button
							onClick={() => setIsDarkMode((prev) => !prev)}
							style={{
								marginLeft: "auto", // 推到最右侧
								padding: "6px 12px",
								borderRadius: "6px",
								border: isDarkMode ? "1px solid #444" : "1px solid #d1d5db",
								background: isDarkMode ? "#2d2d2d" : "#ffffff",
								color: isDarkMode ? "#e5e7eb" : "#374151",
								cursor: "pointer",
								fontSize: "13px",
								fontWeight: 500,
								display: "flex",
								alignItems: "center",
								gap: "6px",
								transition: "all 0.2s",
							}}
						>
							{isDarkMode ? "☀️ Light" : "🌙 Dark"}
						</button>
					</div>
					<div className="editor-container" style={{ flex: 1, overflow: "hidden" }}>
						<PlaygroundEditor
							key={activeCard}
							value={code}
							isDarkMode={isDarkMode}
							onChange={(value) => {
								editedCards[activeCard] = value;
								setCode(value);
							}}
						/>
					</div>
				</div>
			</Tabs>
		</Panel>
	);

	const {
		defaultLayout: verticalLayout,
		onLayoutChanged: onVerticalLayoutChanged,
		isClient: isVerticalClient,
	} = useDefaultLayout({
		id: "og-playground-vertical",
		storage: typeof window !== "undefined" ? localStorage : undefined,
	});

	const previewPanel = (
		<Panel>
			<Group
				orientation="vertical"
				defaultLayout={verticalLayout}
				onLayoutChanged={onVerticalLayoutChanged}
			>
				<PlaygroundPreview code={code} />
			</Group>
		</Panel>
	);

	const { defaultLayout, onLayoutChanged, isClient } = useDefaultLayout({
		id: "og-playground",
		storage: typeof window !== "undefined" ? localStorage : undefined,
	});

	return (
		<>
			{showIntroduction ? (
				<Introduction
					onClose={() => {
						setShowIntroduction(false);
						localStorage.setItem("_vercel_og_playground_visited", "1");
					}}
				/>
			) : null}
			<Toaster
				toastOptions={{
					style: {
						fontSize: 13,
						borderRadius: 6,
						padding: "2px 4px 2px 12px",
					},
				}}
			/>
			<nav>
				<h1>
					{/* <svg viewBox='0 0 75 65' fill='#000' height='12'>
            <title>Vercel</title>
            <path d='M37.59.25l36.95 64H.64l36.95-64z'></path>
          </svg> */}
					Astro Reader Playground
				</h1>
				<ul>
					{/* // TODO: add doc? */}
					<li>
						<a href={routes.home()}>Home</a>
					</li>
					<li>
						<a href={routes.repoHome()}>GitHub</a>
					</li>
				</ul>
			</nav>
			<div className="container">
				{hydrated ? (
					<Group
						orientation={isMobileView ? "vertical" : "horizontal"}
						defaultLayout={defaultLayout}
						onLayoutChanged={onLayoutChanged}
					>
						{isMobileView ? previewPanel : editorPanel}
						<PanelResizeHandle />
						{isMobileView ? editorPanel : previewPanel}
					</Group>
				) : null}
			</div>
		</>
	);
}
