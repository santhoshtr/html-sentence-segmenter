import { HtmlTag, NodeLinearRange, TextNodeInfo } from "./classes.js";

function parseAttribute(attrNode, source) {
	let attrName = null;
	let attrValue = "";

	for (const child of attrNode.children) {
		if (child.type === "attribute_name") {
			attrName = source.slice(child.startIndex, child.endIndex);
		} else if (child.type === "quoted_attribute_value") {
			for (const grandchild of child.children) {
				if (grandchild.type === "attribute_value") {
					attrValue = source.slice(grandchild.startIndex, grandchild.endIndex);
				}
			}
		} else if (child.type === "attribute_value") {
			attrValue = source.slice(child.startIndex, child.endIndex);
		}
	}

	return attrName ? [attrName, attrValue] : null;
}

function parseElement(elementNode, source) {
	if (elementNode.type === "script_element") {
		return new HtmlTag("script", elementNode.startIndex, elementNode.endIndex);
	}
	if (elementNode.type === "style_element") {
		return new HtmlTag("style", elementNode.startIndex, elementNode.endIndex);
	}

	const startTag = elementNode.children.find(
		(child) => child.type === "start_tag",
	);
	if (!startTag) return null;

	const tagNameNode = startTag.children.find(
		(child) => child.type === "tag_name",
	);
	if (!tagNameNode) return null;

	const tagName = source
		.slice(tagNameNode.startIndex, tagNameNode.endIndex)
		.toLowerCase();
	const htmlTag = new HtmlTag(
		tagName,
		elementNode.startIndex,
		elementNode.endIndex,
	);

	for (const child of startTag.children) {
		if (child.type === "attribute") {
			const attr = parseAttribute(child, source);
			if (attr) {
				htmlTag.attributes[attr[0]] = attr[1];
			}
		}
	}

	return htmlTag;
}

function isExcluded(start, end, ranges) {
	for (const [rs, re] of ranges) {
		if (start < re && end > rs) {
			return true;
		}
	}
	return false;
}

function collectExcluded(node, source, excludeElements, ranges) {
	if (node.type === "script_element" || node.type === "style_element") {
		ranges.push([node.startIndex, node.endIndex]);
		return;
	}

	if (node.type === "element") {
		const htmlTag = parseElement(node, source);
		if (htmlTag && excludeElements.includes(htmlTag.name)) {
			ranges.push([node.startIndex, node.endIndex]);
			return;
		}
	}

	for (const child of node.children) {
		collectExcluded(child, source, excludeElements, ranges);
	}
}

function traverse(node, source, textNodes, nodeCounter, excludedRanges) {
	if (node.type === "text") {
		const startIndex = node.startIndex;
		const endIndex = node.endIndex;

		if (isExcluded(startIndex, endIndex, excludedRanges)) {
			return;
		}

		const text = source.slice(startIndex, endIndex);
		const trimmed = text.trim();
		if (trimmed.length > 0) {
			textNodes.push(
				new TextNodeInfo(nodeCounter.value, startIndex, endIndex, text),
			);
			nodeCounter.value++;
		}
	}

	const nstart = node.startIndex;
	const nend = node.endIndex;
	if (isExcluded(nstart, nend, excludedRanges) && node.type === "element") {
		return;
	}

	for (const child of node.children) {
		traverse(child, source, textNodes, nodeCounter, excludedRanges);
	}
}

export function collectTextNodes(node, source, excludeElements) {
	const textNodes = [];
	const nodeCounter = { value: 0 };

	const excludedRanges = [];
	collectExcluded(node, source, excludeElements, excludedRanges);

	if (excludedRanges.length > 0) {
		excludedRanges.sort((a, b) => a[0] - b[0]);
		const merged = [];
		let current = excludedRanges[0];

		for (let i = 1; i < excludedRanges.length; i++) {
			const [s, e] = excludedRanges[i];
			if (s <= current[1]) {
				current[1] = Math.max(current[1], e);
			} else {
				merged.push(current);
				current = [s, e];
			}
		}
		merged.push(current);
		excludedRanges.length = 0;
		excludedRanges.push(...merged);
	}

	traverse(node, source, textNodes, nodeCounter, excludedRanges);
	return textNodes;
}

export function buildFlattenedText(textNodes) {
	let flattened = "";
	const nodeRanges = [];

	for (const node of textNodes) {
		const start = flattened.length;
		flattened += node.rawText;
		const end = flattened.length;

		nodeRanges.push(new NodeLinearRange(node.nodeId, start, end));
	}

	return [flattened, nodeRanges];
}
