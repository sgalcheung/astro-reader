// hooks/useDefaultLayout.ts
import { useEffect, useState } from "react";

interface UseDefaultLayoutOptions {
	id: string;
	storage?: Storage; // 改为可选
}

export function useDefaultLayout(options: UseDefaultLayoutOptions) {
	const { id, storage } = options;
	const [layout, setLayout] = useState(() => {
		// 服务端默认值
		return {/* 默认布局 */};
	});
	const [isClient, setIsClient] = useState(false);

	useEffect(() => {
		setIsClient(true);
		// 客户端使用真实的 localStorage
		const realStorage = storage || (typeof window !== "undefined" ? localStorage : undefined);

		if (realStorage) {
			const saved = realStorage.getItem(`layout-${id}`);
			if (saved) {
				try {
					setLayout(JSON.parse(saved));
				} catch (e) {
					console.error("解析布局数据失败:", e);
				}
			}
		}
	}, [id, storage]);

	const onLayoutChanged = (newLayout: any) => {
		setLayout(newLayout);
		if (typeof window !== "undefined" && storage) {
			storage.setItem(`layout-${id}`, JSON.stringify(newLayout));
		}
	};

	return { defaultLayout: layout, onLayoutChanged, isClient };
}
