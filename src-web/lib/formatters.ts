import xmlFormat from 'xml-formatter';
import { type Node, parseTree, stripComments } from "jsonc-parser";

const INDENT = '  ';

export async function tryFormatJson(text: string): Promise<string> {
  if (text === '') return text;

  try {
    const tree = parseTree(stripComments(text), undefined, {
      allowEmptyContent: true,
      allowTrailingComma: true,
    })

    // If we couldn't parse the tree, return the original text
    if (tree) {
      return convertNodeToJSON(tree)
    }
    // convertNodeToJSON can throw an error if the tree is invalid
  } catch (err) {
    console.warn('Failed to format JSON', err);
    // Nothing
  }

  try {
    return JSON.stringify(JSON.parse(text), null, 2);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (err) {
    // Nothing
  }

  return text;
}

export async function tryFormatXml(text: string): Promise<string> {
  if (text === '') return text;

  try {
    return xmlFormat(text, { throwOnFailure: true, strictMode: false, indentation: INDENT });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (err) {
    return text;
  }
}

class InvalidJSONCNodeError extends Error {
  constructor() {
    super()
    this.message = "Invalid JSONC node"
  }
}

function convertNodeToJSON(node: Node): string {
  switch (node.type) {
    case "string":
      return JSON.stringify(node.value)
    case "null":
      return "null"
    case "array":
      if (!node.children) {
        throw new InvalidJSONCNodeError()
      }

      return `[${node.children
        .map((child) => convertNodeToJSON(child))
        .join(",")}]`
    case "number":
      return JSON.stringify(node.value)
    case "boolean":
      return JSON.stringify(node.value)
    case "object":
      if (!node.children) {
        throw new InvalidJSONCNodeError()
      }

      return `{${node.children
        .map((child) => convertNodeToJSON(child))
        .join(",")}}`
    case "property": {
      if (!node.children || node.children.length !== 2) {
        throw new InvalidJSONCNodeError()
      }

      const [keyNode, valueNode] = node.children

      // If the valueNode configuration is wrong, this will return an error, which will propagate up
      return `${JSON.stringify(keyNode)}:${convertNodeToJSON(valueNode!)}`
    }
  }
}

