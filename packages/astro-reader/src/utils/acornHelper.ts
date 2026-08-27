import { parse } from "acorn";

export function extractRawContent(source: string): string {
	const ast = parse(source, {
		ecmaVersion: "latest",
		sourceType: "module",
	});

	for (const node of ast.body) {
		if (
			node.type !== "ExportNamedDeclaration" ||
			node.declaration?.type !== "FunctionDeclaration" ||
			node.declaration.id?.name !== "rawContent"
		) {
			continue;
		}

		const statement = node.declaration.body.body[0];

		if (
			statement?.type === "ReturnStatement" &&
			statement.argument?.type === "Literal" &&
			typeof statement.argument.value === "string"
		) {
			return statement.argument.value;
		}
	}

	throw new Error("Unable to extract rawContent() from Astro Markdown module");
}
