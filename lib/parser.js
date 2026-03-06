import { Language, Parser } from "/public/web-tree-sitter.js";
let parserInstance = null;

export async function initParser() {
  await Parser.init();
  const parser = new Parser();
  const HTML = await Language.load("./tree-sitter-html.wasm");
  parser.setLanguage(HTML);
  parserInstance = parser;
  return parser;
}

export async function getParser() {
  if (!parserInstance) {
    parserInstance = await initParser();
  }
  return parserInstance;
}
