import { JSDOM } from "jsdom";
import { ElementHandleAdapter } from "./ElementHandleAdapter";

const Node = new JSDOM("").window.Node;

export const fullQualifiedSelector = async function (
  node: ElementHandleAdapter,
  justSelector?: boolean
): Promise<string> {
  if ((await node.nodeType()) !== Node.ELEMENT_NODE) {
    return (await node.localName()) || (await node.nodeName()).toLowerCase();
  }
  return cssPath(node, justSelector);
};

export const cssPath = async function (
  node: ElementHandleAdapter,
  optimized?: boolean
): Promise<string> {
  if ((await node.nodeType()) !== Node.ELEMENT_NODE) {
    return "";
  }

  const steps = [];
  let contextNode: ElementHandleAdapter | null =
    node as ElementHandleAdapter | null;
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
const cssPathStep = async function (
  node: ElementHandleAdapter,
  optimized: boolean,
  isTargetNode: boolean
): Promise<Step | null> {
  if ((await node.nodeType()) !== Node.ELEMENT_NODE) {
    return null;
  }

  const id = await node.getAttribute("id");
  if (optimized) {
    if (id) {
      return new Step(idSelector(id), true);
    }
    const nodeNameLower = (await node.nodeName()).toLowerCase();
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
  if (!parent || (await parent.nodeType()) === Node.DOCUMENT_NODE) {
    return new Step(nodeName, true);
  }

  async function prefixedElementClassNames(
    node: ElementHandleAdapter
  ): Promise<string[]> {
    const classAttribute = await node.getAttribute("class");
    if (!classAttribute) {
      return [];
    }

    return classAttribute
      .split(/\s+/g)
      .filter(Boolean)
      .map(function (name) {
        // The prefix is required to store "__proto__" in a object-based map.
        return "$" + name;
      });
  }

  function idSelector(id: string): string {
    return "#" + CSS.escape(id);
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
    if ((await sibling.nodeType()) !== Node.ELEMENT_NODE) {
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
    !(await node.getAttribute("id")) &&
    !(await node.getAttribute("class"))
  ) {
    result +=
      "[type=" + CSS.escape((await node.getAttribute("type")) || "") + "]";
  }
  if (needsNthChild) {
    result += ":nth-child(" + (ownIndex + 1) + ")";
  } else if (needsClassNames) {
    for (const prefixedName of prefixedOwnClassNamesArray) {
      result += "." + CSS.escape(prefixedName.slice(1));
    }
  }

  return new Step(result, false);
};

export const xPath = async function (
  node: ElementHandleAdapter,
  optimized?: boolean
): Promise<string> {
  if ((await node.nodeType()) === Node.DOCUMENT_NODE) {
    return "/";
  }

  const steps = [];
  let contextNode: ElementHandleAdapter | null =
    node as ElementHandleAdapter | null;
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

const xPathValue = async function (
  node: ElementHandleAdapter,
  optimized?: boolean
): Promise<Step | null> {
  let ownValue;
  const ownIndex = await xPathIndex(node);
  if (ownIndex === -1) {
    return null;
  } // Error.

  switch (await node.nodeType()) {
    case Node.ELEMENT_NODE:
      if (optimized && (await node.getAttribute("id"))) {
        return new Step(
          '//*[@id="' + (await node.getAttribute("id")) + '"]',
          true
        );
      }
      ownValue = await node.localName();
      break;
    case Node.ATTRIBUTE_NODE:
      ownValue = "@" + (await node.nodeName());
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
    ownValue += "[" + ownIndex + "]";
  }

  return new Step(ownValue, (await node.nodeType()) === Node.DOCUMENT_NODE);
};

const xPathIndex = async function (
  node: ElementHandleAdapter
): Promise<number> {
  /**
   * Returns -1 in case of error, 0 if no siblings matching the same expression,
   * <XPath index among the same expression-matching sibling nodes> otherwise.
   */
  async function areNodesSimilar(
    left: ElementHandleAdapter,
    right: ElementHandleAdapter
  ): Promise<boolean> {
    if (await left.isStrictlyEqualTo(right)) {
      return true;
    }

    if (
      (await left.nodeType()) === Node.ELEMENT_NODE &&
      (await right.nodeType()) === Node.ELEMENT_NODE
    ) {
      return (await left.localName()) === (await right.localName());
    }

    if ((await left.nodeType()) === (await right.nodeType())) {
      return true;
    }

    // XPath treats CDATA as text nodes.
    const leftType =
      (await left.nodeType()) === Node.CDATA_SECTION_NODE
        ? Node.TEXT_NODE
        : await left.nodeType();
    const rightType =
      (await right.nodeType()) === Node.CDATA_SECTION_NODE
        ? Node.TEXT_NODE
        : await right.nodeType();
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

export class Step {
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

// export const canGetJSPath = function (node: ElementHandleAdapter): boolean {
//   let wp: (ElementHandleAdapter | null) | ElementHandleAdapter = node;
//   while (wp) {
//     const shadowRoot = wp.ancestorShadowRoot();
//     if (
//       shadowRoot &&
//       shadowRoot.shadowRootType() !== ElementHandleAdapter.ShadowRootTypes.Open
//     ) {
//       return false;
//     }
//     wp = wp.ancestorShadowHost();
//   }
//   return true;
// };

// export const jsPath = function (
//   node: ElementHandleAdapter,
//   optimized?: boolean
// ): string {
//   if (node.nodeType() !== Node.ELEMENT_NODE) {
//     return "";
//   }

//   const path = [];
//   let wp: (ElementHandleAdapter | null) | ElementHandleAdapter = node;
//   while (wp) {
//     path.push(cssPath(wp, optimized));
//     wp = wp.ancestorShadowHost();
//   }
//   path.reverse();
//   let result = "";
//   for (let i = 0; i < path.length; ++i) {
//     const string = JSON.stringify(path[i]);
//     if (i) {
//       result += `.shadowRoot.querySelector(${string})`;
//     } else {
//       result += `document.querySelector(${string})`;
//     }
//   }
//   return result;
// };
