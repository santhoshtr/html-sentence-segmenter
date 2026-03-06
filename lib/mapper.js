import { PerNodeSentenceSlice } from "./classes.js";

export function mapBoundariesToNodes(boundaries, nodeRanges) {
	const slices = [];

	for (let sentenceId = 0; sentenceId < boundaries.length; sentenceId++) {
		const boundary = boundaries[sentenceId];

		const sentStart = boundary.start_index;
		const sentEnd = boundary.end_index;
		for (const range of nodeRanges) {
			if (range.globalEnd <= sentStart || range.globalStart >= sentEnd) {
				continue;
			}

			const localStart =
				sentStart <= range.globalStart ? 0 : sentStart - range.globalStart;
			const localEnd =
				sentEnd >= range.globalEnd
					? range.globalEnd - range.globalStart
					: sentEnd - range.globalStart;

			slices.push(
				new PerNodeSentenceSlice(
					sentenceId,
					range.nodeId,
					localStart,
					localEnd,
				),
			);
		}
	}

	return slices;
}

export function createSentenceBoundaries(slices, textNodes) {
	const sentenceMap = new Map();

	for (const slice of slices) {
		const node = textNodes.find((n) => n.nodeId === slice.nodeId);
		if (node) {
			const startIndex = node.startIndex + slice.localStart;
			const endIndex = node.startIndex + slice.localEnd;

			if (!sentenceMap.has(slice.sentenceId)) {
				sentenceMap.set(slice.sentenceId, []);
			}
			sentenceMap.get(slice.sentenceId).push({
				start: startIndex,
				end: endIndex,
			});
		}
	}

	return sentenceMap;
}
