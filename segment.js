import { HtmlSegmentConfig } from "./lib/config.js";
import {
	createSentenceBoundaries,
	mapBoundariesToNodes,
} from "./lib/mapper.js";
import { getParser, initParser } from "./lib/parser.js";
import { buildFlattenedText, collectTextNodes } from "./lib/text-collector.js";

export { HtmlSegmentConfig, initParser };

export async function segmentHtml(html, config, getSentenceBoundaries) {
	const parser = await getParser();
	const tree = parser.parse(html);

	const textNodes = collectTextNodes(
		tree.rootNode,
		html,
		config.excludeElements,
	);

	const [flattenedText, nodeRanges] = buildFlattenedText(textNodes);

	const sentenceBoundaries = getSentenceBoundaries(
		config.languageCode,
		flattenedText,
	);

	const sentenceSlices = mapBoundariesToNodes(sentenceBoundaries, nodeRanges);

	return createSentenceBoundaries(sentenceSlices, textNodes);
}
