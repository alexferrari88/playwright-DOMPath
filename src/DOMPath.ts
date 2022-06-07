import { ElementHandle, Locator } from "playwright";

require("css.escape");

export const cssPath = async function cssPath(
  elHandle: ElementHandle | Locator,
  optimized?: boolean
): Promise<string> {
  return (await (elHandle as ElementHandle).evaluate(
    async (node, optimized) => {
      function nodeNameInCorrectCase(node: Element): string {
        const shadowRoot = node.shadowRoot;
        const shadowRootType = shadowRoot && shadowRoot.mode;
        if (shadowRootType) {
          return `#shadow-root (${shadowRootType})`;
        }

        // If there is no local #name, it's case sensitive
        if (!node.localName) {
          return node.nodeName;
        }

        // If the names are different lengths, there is a prefix and it's case sensitive
        if (node.localName.length !== node.nodeName.length) {
          return node.nodeName;
        }

        // Return the localname, which will be case insensitive if its an html node
        return node.localName as string;
      }
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

      const cssPathStep = function cssPathStep(
        node: Element,
        optimized: boolean,
        isTargetNode: boolean
      ): Step | null {
        function idSelector(id: string): string {
          return `#${CSS.escape(id)}`;
        }

        if (node.nodeType !== Node.ELEMENT_NODE) {
          return null;
        }

        const id = node.id;
        if (optimized) {
          if (id) {
            return new Step(idSelector(id), true);
          }
          const nodeNameLower = node.nodeName.toLowerCase();
          if (
            nodeNameLower === "body" ||
            nodeNameLower === "head" ||
            nodeNameLower === "html"
          ) {
            return new Step(nodeNameInCorrectCase(node), true);
          }
        }
        const nodeName = nodeNameInCorrectCase(node);

        if (id) {
          return new Step(nodeName + idSelector(id), true);
        }
        const parent = node.parentNode;
        if (!parent || parent.nodeType === Node.DOCUMENT_NODE) {
          return new Step(nodeName, true);
        }

        function prefixedElementClassNames(node: Element): string[] {
          const classAttribute = node.className;
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

        const prefixedOwnClassNamesArray = prefixedElementClassNames(node);
        let needsClassNames = false;
        let needsNthChild = false;
        let ownIndex = -1;
        let elementIndex = -1;
        const siblings = (parent as Node).childNodes;
        for (
          let i = 0;
          siblings &&
          (ownIndex === -1 || !needsNthChild) &&
          i < siblings.length;
          ++i
        ) {
          const sibling = siblings[i];
          if (sibling.nodeType !== Node.ELEMENT_NODE) {
            continue;
          }
          elementIndex += 1;
          if (sibling === node) {
            ownIndex = elementIndex;
            continue;
          }
          if (needsNthChild) {
            continue;
          }
          if (nodeNameInCorrectCase(sibling as Element) !== nodeName) {
            continue;
          }

          needsClassNames = true;
          const ownClassNames = new Set<string>(prefixedOwnClassNamesArray);
          if (!ownClassNames.size) {
            needsNthChild = true;
            continue;
          }
          const siblingClassNamesArray = prefixedElementClassNames(
            sibling as Element
          );
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
          node.getAttribute("type") &&
          !node.id &&
          !node.className
        ) {
          result += `[type=${CSS.escape(node.getAttribute("type") || "")}]`;
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

      if (node.nodeType !== Node.ELEMENT_NODE) {
        return "";
      }

      const steps = [];
      let contextNode: Element | Node | null = node as Element | Node | null;
      while (contextNode) {
        const step = cssPathStep(
          contextNode as Element,
          Boolean(optimized),
          contextNode === node
        );
        if (!step) {
          break;
        } // Error - bail out early.
        steps.push(step);
        if (step.optimized) {
          break;
        }
        contextNode = (contextNode as Node).parentNode;
      }

      steps.reverse();
      return steps.join(" > ");
    },
    optimized
  )) as string;
};

export const xPath = async function xPath(
  elHandle: ElementHandle | Locator,
  optimized?: boolean
): Promise<string> {
  return (await (elHandle as ElementHandle).evaluate(
    async (node, optimized) => {
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
      const xPathValue = function xPathValue(
        node: Element,
        optimized?: boolean
      ): Step | null {
        let ownValue;
        const ownIndex = xPathIndex(node);
        if (ownIndex === -1) {
          return null;
        } // Error.

        switch (node.nodeType) {
          case Node.ELEMENT_NODE:
            if (optimized && node.id) {
              return new Step(`//*[@id="${node.id}"]`, true);
            }
            ownValue = node.localName;
            break;
          case Node.ATTRIBUTE_NODE:
            ownValue = `@${node.nodeName}`;
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

        return new Step(ownValue, node.nodeType === Node.DOCUMENT_NODE);
      };

      const xPathIndex = function xPathIndex(node: Element): number {
        /**
         * Returns -1 in case of error, 0 if no siblings matching the same expression,
         * <XPath index among the same expression-matching sibling nodes> otherwise.
         */
        function areNodesSimilar(left: Element, right: Element): boolean {
          if (left === right) {
            return true;
          }

          if (
            left.nodeType === Node.ELEMENT_NODE &&
            right.nodeType === Node.ELEMENT_NODE
          ) {
            return left.localName === right.localName;
          }

          if (left.nodeType === right.nodeType) {
            return true;
          }

          // XPath treats CDATA as text nodes.
          const leftType =
            left.nodeType === Node.CDATA_SECTION_NODE
              ? Node.TEXT_NODE
              : left.nodeType;
          const rightType =
            right.nodeType === Node.CDATA_SECTION_NODE
              ? Node.TEXT_NODE
              : right.nodeType;
          return leftType === rightType;
        }

        const parentNode = node.parentNode;
        const siblings = parentNode ? parentNode.children : null;
        if (!siblings) {
          return 0;
        } // Root node - no siblings.
        let hasSameNamedElements;
        for (let i = 0; i < siblings.length; ++i) {
          if (areNodesSimilar(node, siblings[i]) && !(siblings[i] === node)) {
            hasSameNamedElements = true;
            break;
          }
        }
        if (!hasSameNamedElements) {
          return 0;
        }
        let ownIndex = 1; // XPath indices start with 1.
        for (let i = 0; i < siblings.length; ++i) {
          if (areNodesSimilar(node, siblings[i])) {
            if (siblings[i] === node) {
              return ownIndex;
            }
            ++ownIndex;
          }
        }
        return -1; // An error occurred: |node| not found in parent's children.
      };

      if (node.nodeType === Node.DOCUMENT_NODE) {
        return "/";
      }

      const steps = [];
      let contextNode: Element | Node | null = node as Element | Node | null;
      while (contextNode) {
        const step = xPathValue(contextNode as Element, optimized);
        if (!step) {
          break;
        } // Error - bail out early.
        steps.push(step);
        if (step.optimized) {
          break;
        }
        contextNode = (contextNode as Node).parentNode;
      }

      steps.reverse();
      return (steps.length && steps[0].optimized ? "" : "/") + steps.join("/");
    },
    optimized
  )) as string;
};
