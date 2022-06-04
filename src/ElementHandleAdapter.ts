import { ElementHandle } from "playwright";

export class ElementHandleAdapter {
  #node: ElementHandle;
  #nodeType: number | undefined;
  #nodeName: string | undefined = undefined;
  #localName: string | undefined;
  #parentNode: ElementHandleAdapter | null = null;

  constructor(elHandle: ElementHandle) {
    this.#node = elHandle;
  }

  async nodeType(): Promise<number> {
    if (this.#nodeType === undefined) {
      this.#nodeType = (await (
        await this.#node.getProperty("nodeType")
      ).jsonValue()) as number;
    }
    return this.#nodeType;
  }

  async nodeName(): Promise<string> {
    if (this.#nodeName === undefined) {
      this.#nodeName = (await (
        await this.#node.getProperty("nodeName")
      ).jsonValue()) as string;
    }
    return this.#nodeName;
  }

  async localName(): Promise<string> {
    if (this.#localName === undefined) {
      this.#localName = (await (
        await this.#node.getProperty("localName")
      ).jsonValue()) as string;
    }
    return this.#localName;
  }

  async parentNode(): Promise<ElementHandleAdapter | null> {
    if (this.#parentNode === null) {
      const parent = (await this.#node.getProperty("parentNode")).asElement();
      this.#parentNode = parent ? new ElementHandleAdapter(parent) : null;
    }
    return this.#parentNode;
  }

  async children(): Promise<ElementHandleAdapter[]> {
    const childrenNodes = await this.#node.$$(":scope > *");
    return childrenNodes.map((child) => new ElementHandleAdapter(child));
  }

  async getAttribute(attr: string): Promise<string | null> {
    return this.#node.getAttribute(attr);
  }

  async getProperty(property: string): Promise<any | null> {
    return (await this.#node.getProperty(property)).jsonValue();
  }

  async nodeNameInCorrectCase(): Promise<string> {
    const shadowRoot = (await this.#node.getProperty(
      "shadowRoot"
    )) as unknown as ShadowRoot;
    const shadowRootType = shadowRoot && shadowRoot.mode;
    if (shadowRootType) {
      return "#shadow-root (" + shadowRootType + ")";
    }

    // If there is no local #name, it's case sensitive
    if (!(await this.localName())) {
      return await this.nodeName();
    }

    // If the names are different lengths, there is a prefix and it's case sensitive
    if ((await this.localName()).length !== (await this.nodeName()).length) {
      return await this.nodeName();
    }

    // Return the localname, which will be case insensitive if its an html node
    return await this.localName();
  }

  async isEqualTo(other: ElementHandleAdapter): Promise<boolean> {
    const otherNode = other.#node;
    return this.#node.evaluate(
      (thisNode, otherNode) => thisNode == otherNode,
      otherNode
    );
  }

  async isStrictlyEqualTo(other: ElementHandleAdapter): Promise<boolean> {
    const otherNode = other.#node;
    return this.#node.evaluate(
      (thisNode, otherNode) => thisNode === otherNode,
      otherNode
    );
  }
}
