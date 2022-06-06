import { ElementHandle } from "playwright";

class ElementHandleAdapter {
  #node: ElementHandle;

  #nodeId: string | undefined;

  #nodeClass: string | undefined;

  #nodeType: number | undefined;

  #nodeName: string | undefined = undefined;

  #localName: string | undefined;

  // eslint-disable-next-line no-use-before-define
  #parentNode: ElementHandleAdapter | null = null;

  constructor(elHandle: ElementHandle) {
    this.#node = elHandle;
  }

  async getParams(): Promise<this> {
    const [nodeType, nodeId, nodeName, localName, nodeClass] =
      await this.#node.evaluate((el) => {
        return [
          (el as Element).nodeType,
          (el as Element).id,
          (el as Element).nodeName,
          (el as Element).localName,
          (el as Element).className,
        ];
      });
    this.#nodeType = nodeType;
    this.#nodeId = nodeId;
    this.#nodeName = nodeName;
    this.#localName = localName;
    this.#nodeClass = nodeClass;
    return this;
  }

  // async nodeType(): Promise<number> {
  //   if (this.#nodeType === undefined) {
  //     this.#nodeType = (await (
  //       await this.#node.getProperty("nodeType")
  //     ).jsonValue()) as number;
  //   }
  //   return this.#nodeType;
  // }

  nodeType(): number {
    return this.#nodeType as number;
  }

  localName(): string {
    return this.#localName as string;
  }

  nodeName(): string {
    return this.#nodeName as string;
  }

  nodeId(): string {
    return this.#nodeId as string;
  }

  nodeClass(): string {
    return this.#nodeClass as string;
  }

  // async nodeName(): Promise<string> {
  //   if (this.#nodeName === undefined) {
  //     this.#nodeName = (await (
  //       await this.#node.getProperty("nodeName")
  //     ).jsonValue()) as string;
  //   }
  //   return this.#nodeName;
  // }

  // async localName(): Promise<string> {
  //   if (this.#localName === undefined) {
  //     this.#localName = (await (
  //       await this.#node.getProperty("localName")
  //     ).jsonValue()) as string;
  //   }
  //   return this.#localName;
  // }

  async parentNode(): Promise<ElementHandleAdapter | null> {
    if (this.#parentNode === null) {
      const parent = (await this.#node.getProperty("parentNode")).asElement();
      if (parent) {
        this.#parentNode = new ElementHandleAdapter(parent);
        await this.#parentNode.getParams();
      } else {
        this.#parentNode = null;
      }
    }
    return this.#parentNode;
  }

  async children(): Promise<ElementHandleAdapter[]> {
    const childrenNodes = await this.#node.$$(":scope > *");
    const elHandleChildren = childrenNodes.map(
      (child) => new ElementHandleAdapter(child)
    );
    await Promise.all(elHandleChildren.map((el) => el.getParams()));
    return elHandleChildren;
  }

  async getAttribute(attr: string): Promise<string | null> {
    return this.#node.getAttribute(attr);
  }

  async getProperty(property: string): Promise<unknown | null> {
    return (await this.#node.getProperty(property)).jsonValue();
  }

  async nodeNameInCorrectCase(): Promise<string> {
    const shadowRoot = (await this.#node.getProperty(
      "shadowRoot"
      // eslint-disable-next-line no-undef
    )) as unknown as ShadowRoot;
    const shadowRootType = shadowRoot && shadowRoot.mode;
    if (shadowRootType) {
      return `#shadow-root (${shadowRootType})`;
    }

    // If there is no local #name, it's case sensitive
    if (!this.localName()) {
      return this.nodeName();
    }

    // If the names are different lengths, there is a prefix and it's case sensitive
    if ((this.localName() as string).length !== this.nodeName().length) {
      return this.nodeName();
    }

    // Return the localname, which will be case insensitive if its an html node
    return this.localName() as string;
  }

  async isEqualTo(other: ElementHandleAdapter): Promise<boolean> {
    const otherNode = other.#node;
    return this.#node.evaluate(
      // eslint-disable-next-line no-shadow, eqeqeq
      (thisNode, otherNode) => thisNode == otherNode,
      otherNode
    );
  }

  async isStrictlyEqualTo(other: ElementHandleAdapter): Promise<boolean> {
    const otherNode = other.#node;
    return this.#node.evaluate(
      // eslint-disable-next-line no-shadow
      (thisNode, otherNode) => thisNode === otherNode,
      otherNode
    );
  }
}

export default ElementHandleAdapter;
