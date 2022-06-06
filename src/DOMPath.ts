/* eslint-disable no-continue */
/* eslint-disable no-shadow */
import { JSDOM } from "jsdom";
import { ElementHandle, Locator } from "playwright";
import PlaywrightElementAdapter from "./PlaywrightElementAdapter";

require("css.escape");

const { Node } = new JSDOM("").window;

class Step {
  value: string;

  optimized: boolean;

  constructor(value: string, optimized: boolean) {
    this.value = value;
    this.optimized = optimized || false;
  }

  toString(): string {
    return this.value;
  }
}

const cssPathStep = async function cssPathStep(
  node: PlaywrightElementAdapter,
  optimized: boolean,
  isTargetNode: boolean
): Promise<Step | null> {
  function idSelector(id: string): string {
    // eslint-disable-next-line no-undef
    return `#${CSS.escape(id)}`;
  }

  if (node.nodeType() !== Node.ELEMENT_NODE) {
    return null;
  }

  const id = node.nodeId();
  if (optimized) {
    if (id) {
      return new Step(idSelector(id), true);
    }
    const nodeNameLower = node.nodeName().toLowerCase();
    if (
      nodeNameLower === "body" ||
      nodeNameLower === "head" ||
      nodeNameLower === "html"
    ) {
      return new Step(await node.nodeNameInCorrectCase(), true);
    }
  }
  const nodeName = await node.nodeNameInCorrectCase();

  if (id) {
    return new Step(nodeName + idSelector(id), true);
  }
  const parent = await node.parentNode();
  if (!parent || parent.nodeType() === Node.DOCUMENT_NODE) {
    return new Step(nodeName, true);
  }

  async function prefixedElementClassNames(
    node: PlaywrightElementAdapter
  ): Promise<string[]> {
    const classAttribute = node.nodeClass();
    if (!classAttribute) {
      return [];
    }

    return classAttribute
      .split(/\s+/g)
      .filter(Boolean)
      .map(
        (name) =>
          // The prefix is required to store "__proto__" in a object-based map.
          `$${name}`
      );
  }

  const prefixedOwnClassNamesArray = await prefixedElementClassNames(node);
  let needsClassNames = false;
  let needsNthChild = false;
  let ownIndex = -1;
  let elementIndex = -1;
  const siblings = await parent.children();
  for (
    let i = 0;
    siblings && (ownIndex === -1 || !needsNthChild) && i < siblings.length;
    ++i
  ) {
    const sibling = siblings[i];
    if (sibling.nodeType() !== Node.ELEMENT_NODE) {
      continue;
    }
    elementIndex += 1;
    if (await sibling.isStrictlyEqualTo(node)) {
      ownIndex = elementIndex;
      continue;
    }
    if (needsNthChild) {
      continue;
    }
    if ((await sibling.nodeNameInCorrectCase()) !== nodeName) {
      continue;
    }

    needsClassNames = true;
    const ownClassNames = new Set<string>(prefixedOwnClassNamesArray);
    if (!ownClassNames.size) {
      needsNthChild = true;
      continue;
    }
    const siblingClassNamesArray = await prefixedElementClassNames(sibling);
    for (let j = 0; j < siblingClassNamesArray.length; ++j) {
      const siblingClass = siblingClassNamesArray[j];
      if (!ownClassNames.has(siblingClass)) {
        continue;
      }
      ownClassNames.delete(siblingClass);
      if (!ownClassNames.size) {
        needsNthChild = true;
        break;
      }
    }
  }

  let result = nodeName;
  if (
    isTargetNode &&
    nodeName.toLowerCase() === "input" &&
    (await node.getAttribute("type")) &&
    !node.nodeId() &&
    !node.nodeClass()
  ) {
    result += `[type=${CSS.escape((await node.getAttribute("type")) || "")}]`;
  }
  if (needsNthChild) {
    result += `:nth-child(${ownIndex + 1})`;
  } else if (needsClassNames) {
    for (const prefixedName of prefixedOwnClassNamesArray) {
      result += `.${CSS.escape(prefixedName.slice(1))}`;
    }
  }

  return new Step(result, false);
};

export const cssPath = async function cssPath(
  elHandle: ElementHandle | Locator,
  optimized?: boolean
): Promise<string> {
  const node = new PlaywrightElementAdapter(elHandle);
  await node.init();
  if (node.nodeType() !== Node.ELEMENT_NODE) {
    return "";
  }

  const steps = [];
  let contextNode: PlaywrightElementAdapter | null =
    node as PlaywrightElementAdapter | null;
  while (contextNode) {
    const step = await cssPathStep(
      contextNode,
      Boolean(optimized),
      await contextNode.isStrictlyEqualTo(node)
    );
    if (!step) {
      break;
    } // Error - bail out early.
    steps.push(step);
    if (step.optimized) {
      break;
    }
    contextNode = await contextNode.parentNode();
  }

  steps.reverse();
  return steps.join(" > ");
};

export const xPath = async function xPath(
  elHandle: ElementHandle | Locator,
  optimized?: boolean
): Promise<string> {
  const node = new PlaywrightElementAdapter(elHandle);
  await node.init();
  if (node.nodeType() === Node.DOCUMENT_NODE) {
    return "/";
  }

  const steps = [];
  let contextNode: PlaywrightElementAdapter | null =
    node as PlaywrightElementAdapter | null;
  while (contextNode) {
    const step = await xPathValue(contextNode, optimized);
    if (!step) {
      break;
    } // Error - bail out early.
    steps.push(step);
    if (step.optimized) {
      break;
    }
    contextNode = await contextNode.parentNode();
  }

  steps.reverse();
  return (steps.length && steps[0].optimized ? "" : "/") + steps.join("/");
};

const xPathValue = async function xPathValue(
  node: PlaywrightElementAdapter,
  optimized?: boolean
): Promise<Step | null> {
  let ownValue;
  const ownIndex = await xPathIndex(node);
  if (ownIndex === -1) {
    return null;
  } // Error.

  switch (node.nodeType()) {
    case Node.ELEMENT_NODE:
      if (optimized && node.nodeId()) {
        return new Step(`//*[@id="${node.nodeId()}"]`, true);
      }
      ownValue = node.localName();
      break;
    case Node.ATTRIBUTE_NODE:
      ownValue = `@${node.nodeName()}`;
      break;
    case Node.TEXT_NODE:
    case Node.CDATA_SECTION_NODE:
      ownValue = "text()";
      break;
    case Node.PROCESSING_INSTRUCTION_NODE:
      ownValue = "processing-instruction()";
      break;
    case Node.COMMENT_NODE:
      ownValue = "comment()";
      break;
    case Node.DOCUMENT_NODE:
      ownValue = "";
      break;
    default:
      ownValue = "";
      break;
  }

  if (ownIndex > 0) {
    ownValue += `[${ownIndex}]`;
  }

  return new Step(ownValue, node.nodeType() === Node.DOCUMENT_NODE);
};

const xPathIndex = async function xPathIndex(
  node: PlaywrightElementAdapter
): Promise<number> {
  /**
   * Returns -1 in case of error, 0 if no siblings matching the same expression,
   * <XPath index among the same expression-matching sibling nodes> otherwise.
   */
  async function areNodesSimilar(
    left: PlaywrightElementAdapter,
    right: PlaywrightElementAdapter
  ): Promise<boolean> {
    if (await left.isStrictlyEqualTo(right)) {
      return true;
    }

    if (
      left.nodeType() === Node.ELEMENT_NODE &&
      right.nodeType() === Node.ELEMENT_NODE
    ) {
      return left.localName() === right.localName();
    }

    if (left.nodeType() === right.nodeType()) {
      return true;
    }

    // XPath treats CDATA as text nodes.
    const leftType =
      left.nodeType() === Node.CDATA_SECTION_NODE
        ? Node.TEXT_NODE
        : left.nodeType();
    const rightType =
      right.nodeType() === Node.CDATA_SECTION_NODE
        ? Node.TEXT_NODE
        : right.nodeType();
    return leftType === rightType;
  }

  const parentNode = await node.parentNode();
  const siblings = parentNode ? await parentNode.children() : null;
  if (!siblings) {
    return 0;
  } // Root node - no siblings.
  let hasSameNamedElements;
  for (let i = 0; i < siblings.length; ++i) {
    if (
      (await areNodesSimilar(node, siblings[i])) &&
      !(await siblings[i].isStrictlyEqualTo(node))
    ) {
      hasSameNamedElements = true;
      break;
    }
  }
  if (!hasSameNamedElements) {
    return 0;
  }
  let ownIndex = 1; // XPath indices start with 1.
  for (let i = 0; i < siblings.length; ++i) {
    if (await areNodesSimilar(node, siblings[i])) {
      if (await siblings[i].isStrictlyEqualTo(node)) {
        return ownIndex;
      }
      ++ownIndex;
    }
  }
  return -1; // An error occurred: |node| not found in parent's children.
};
