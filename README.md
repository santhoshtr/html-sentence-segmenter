# HTML Sentence Segmentation Tool

A JavaScript library and web interface for segmenting sentences within HTML content. The tool parses HTML, identifies sentence boundaries while preserving the original HTML structure, and provides visual highlighting of each sentence.

## What This Tool Does

This tool solves the problem of identifying and highlighting sentences in HTML content while maintaining the relationship between text and its surrounding markup. Unlike simple text-based sentence splitting, this library:

1. **Parses HTML** using tree-sitter to understand the document structure
2. **Extracts text content** from appropriate elements while ignoring excluded elements (scripts, styles, code blocks, etc.)
3. **Segments sentences** using a language-aware sentence boundary detection algorithm
4. **Maps boundaries back** to the original HTML character positions
5. **Highlights sentences** visually using the CSS Custom Highlights API

The web interface (`index.html`) demonstrates this functionality by fetching Wikipedia articles and highlighting each sentence in a different color.

## Algorithm Overview

### High-Level Process

```
HTML Input → Tree-sitter Parse → Text Node Extraction → Flatten Text →
Sentence Segmentation → Boundary Mapping → Highlight Generation
```

### Detailed Algorithm Steps

#### Step 1: HTML Parsing with Tree-sitter

The tool uses [tree-sitter](https://tree-sitter.github.io/tree-sitter/), a parser generator tool and an incremental parsing library, to convert HTML into an Abstract Syntax Tree (AST). Tree-sitter provides:
- Robust parsing of malformed HTML
- Incremental parsing capability (re-parsing only changed portions)
- Precise character index positions for all nodes

```javascript
const parser = await getParser();
const tree = parser.parse(html);
```

The parser is initialized with the tree-sitter HTML grammar loaded as a WebAssembly module.

#### Step 2: Text Node Collection

The algorithm traverses the AST to collect text nodes while excluding certain HTML elements that should not be segmented:

**Excluded Elements:**
- `script`, `style`, `noscript` - Code content
- `iframe`, `svg`, `math` - Embedded content
- `pre`, `code`, `textarea` - Preformatted/code content
- `meta`, `link`, `base`, `head` - Metadata elements

The collection process:
1. **Identify excluded ranges**: First pass finds all excluded elements and records their character ranges
2. **Merge overlapping ranges**: Adjacent or overlapping excluded ranges are merged for efficiency
3. **Extract text nodes**: Second pass collects text nodes, skipping those within excluded ranges
4. **Track positions**: Each text node stores its original HTML start/end positions and raw text

```javascript
function collectTextNodes(node, source, excludeElements) {
    // Collect excluded element character ranges
    const excludedRanges = [];
    collectExcluded(node, source, excludeElements, excludedRanges);

    // Merge overlapping excluded ranges
    // ...

    // Traverse and collect text nodes
    const textNodes = [];
    traverse(node, source, textNodes, nodeCounter, excludedRanges);
    return textNodes;
}
```

#### Step 3: Flatten Text and Build Mapping

To use sentence segmentation (which works on plain text), the algorithm:
1. Concatenates all text node contents into a single flattened string
2. Creates a mapping from the flattened string positions back to original text nodes

```javascript
function buildFlattenedText(textNodes) {
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
```

This creates:
- `flattenedText`: All text concatenated: "After reading Erwin Schrödinger's book What Is Life? in 1946, Watson changed his professional ambitions..."
- `nodeRanges`: Mapping array where each entry maps a text node ID to its range in the flattened string

#### Step 4: Sentence Boundary Detection

The tool uses [sentencex-wasm](https://github.com/wikimedia/sentencex), a WebAssembly port of the [sentnecex](https://github.com/wikimedia/sentencex) library, to detect sentence boundaries. This library:

- Uses language-specific rules for sentence boundary detection
- Handles abbreviations, decimal numbers, and other edge cases
- Supports multiple languages

```javascript
const sentenceBoundaries = getSentenceBoundaries(
    config.languageCode,
    flattenedText
);
```

The function returns an array of boundary objects:
```javascript
[
    { start_index: 0, end_index: 45 },   // "After reading Erwin Schrödinger's book..."
    { start_index: 46, end_index: 112 },  // "What Is Life? in 1946, Watson changed..."
    // ...
]
```

#### Step 5: Map Boundaries Back to Original HTML

This is the critical step that reconciles flat text positions with the original HTML structure:

```javascript
function mapBoundariesToNodes(boundaries, nodeRanges) {
    const slices = [];

    for (const boundary of boundaries) {
        const sentStart = boundary.start_index;
        const sentEnd = boundary.end_index;

        // Find all nodes that overlap with this sentence
        for (const range of nodeRanges) {
            if (range.globalEnd <= sentStart || range.globalStart >= sentEnd) {
                continue; // No overlap
            }

            // Calculate the intersection (local positions within this node)
            const localStart = sentStart <= range.globalStart ? 0 : sentStart - range.globalStart;
            const localEnd = sentEnd >= range.globalEnd
                ? range.globalEnd - range.globalStart
                : sentEnd - range.globalStart;

            slices.push(new PerNodeSentenceSlice(sentenceId, range.nodeId, localStart, localEnd));
        }
    }

    return slices;
}
```

A sentence may span multiple HTML elements. For example:
```html
<p>After reading <a href="#">Erwin Schrödinger</a>'s book <em>What Is Life?</em></p>
```

This sentence spans three text nodes (before the link, inside the link, inside the `<em>`). The mapping step produces slices for each node that the sentence touches.

#### Step 6: Create Sentence Boundaries

The final step converts node-relative positions back to absolute HTML character positions:

```javascript
function createSentenceBoundaries(slices, textNodes) {
    const sentenceMap = new Map();

    for (const slice of slices) {
        const node = textNodes.find(n => n.nodeId === slice.nodeId);
        if (node) {
            // Convert local position to absolute HTML position
            const startIndex = node.startIndex + slice.localStart;
            const endIndex = node.startIndex + slice.localEnd;

            // Group by sentence ID
            if (!sentenceMap.has(slice.sentenceId)) {
                sentenceMap.set(slice.sentenceId, []);
            }
            sentenceMap.get(slice.sentenceId).push({ start: startIndex, end: endIndex });
        }
    }

    return sentenceMap;
}
```

The result is a Map where:
- Keys: Sentence IDs (0, 1, 2, ...)
- Values: Arrays of `{start, end}` position pairs in the original HTML

### Visual Highlighting

The web interface uses the [CSS Custom Highlights API](https://developer.mozilla.org/en-US/docs/Web/API/CSS_Custom_Highlights_API) to visually highlight sentences:

1. Create `Range` objects representing each sentence piece in the DOM
2. Add ranges to `CSS.highlights` with color class names
3. CSS `::highlight()` pseudo-element styles the highlighted text

```javascript
const range = new Range();
range.setStart(textNode, startIndex);
range.setEnd(textNode, endIndex);

const h = new Highlight(range);
CSS.highlights.set(highlightClass, h);
```

## Usage

### As a Library

```javascript
import { HtmlSegmentConfig, segmentHtml, initParser } from "./segment.js";
import init, { get_sentence_boundaries } from "sentencex-wasm";

// Initialize parsers
await initParser();
await init();

// Segment HTML
const html = "<p>Hello world. This is a test.</p>";
const config = new HtmlSegmentConfig("en");
const sentences = await segmentHtml(html, config, get_sentence_boundaries);

// sentences is a Map:
// Map(2) {
//   0 => [{ start: 3, end: 16 }],    // "Hello world."
//   1 => [{ start: 17, end: 31 }]    // "This is a test."
// }
```

### Configuration

```javascript
const config = new HtmlSegmentConfig("en", [
    "script", "style", "noscript", "iframe", "svg",
    "math", "pre", "code", "textarea", "title",
    "meta", "link", "base", "head"
]);
```

- `languageCode`: ISO 639-1 language code for sentence segmentation rules
- `excludeElements`: Array of HTML tag names to exclude from segmentation

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         index.html                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Wikipedia API │  │ DOM Parser   │  │ CSS Highlights API   │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        segment.js                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ tree-sitter  │  │ Text Node    │  │ Boundary Mapping     │  │
│  │ (WASM)       │  │ Collector    │  │                      │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     sentencex-wasm                               │
│              (Sentence boundary detection)                      │
└─────────────────────────────────────────────────────────────────┘
```

## Dependencies

- **[tree-sitter](https://tree-sitter.github.io/)**: HTML parsing via WebAssembly
- **[sentencex-wasm](https://github.com/wikimedia/sentencex)**: Language-aware sentence segmentation

## Browser Support

The tool requires modern browser features:
- [WebAssembly](https://caniuse.com/wasm)
- [CSS Custom Highlights API](https://caniuse.com/mdn-api_css_highlights) (Chrome/Edge 105+, Firefox 131+)

## Files

- `index.html` - Web interface demonstrating sentence highlighting
- `segment.js` - Core segmentation library (371 lines)
- `styles.css` - Visual styling for highlighted sentences
