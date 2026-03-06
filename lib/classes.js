export class HtmlTag {
	constructor(name, startIndex, endIndex) {
		this.name = name;
		this.attributes = {};
		this.startIndex = startIndex;
		this.endIndex = endIndex;
	}
}

export class TextNodeInfo {
	constructor(nodeId, startIndex, endIndex, rawText) {
		this.nodeId = nodeId;
		this.startIndex = startIndex;
		this.endIndex = endIndex;
		this.rawText = rawText;
	}
}

export class NodeLinearRange {
	constructor(nodeId, globalStart, globalEnd) {
		this.nodeId = nodeId;
		this.globalStart = globalStart;
		this.globalEnd = globalEnd;
	}
}

export class PerNodeSentenceSlice {
	constructor(sentenceId, nodeId, localStart, localEnd) {
		this.sentenceId = sentenceId;
		this.nodeId = nodeId;
		this.localStart = localStart;
		this.localEnd = localEnd;
	}
}
