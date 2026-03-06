export class HtmlSegmentConfig {
	constructor(languageCode = "en", excludeElements = null) {
		this.languageCode = languageCode;
		this.excludeElements = excludeElements || [
			"script",
			"style",
			"noscript",
			"iframe",
			"svg",
			"math",
			"pre",
			"code",
			"textarea",
			"title",
			"meta",
			"link",
			"base",
			"head",
		];
	}
}
