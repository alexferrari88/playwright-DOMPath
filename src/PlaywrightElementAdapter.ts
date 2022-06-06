import { ElementHandle, Locator } from "playwright";

class PlaywrightElementAdapter {
  #node: ElementHandle | Locator;

  #nodeId: string | undefined;

  #nodeClass: string | undefined;

  #nodeType: number | undefined;

  #nodeName: string | undefined = undefined;

  #localName: string | undefined;

  // eslint-disable-next-line no-use-before-define
  #parentNode: PlaywrightElementAdapter | null = null;

  isElementHandle(e: Locator | ElementHandle): e is ElementHandle {
    return (e as ElementHandle).$ !== undefined;
  }

  async toElementHandle(): Promise<this> {
    if (!this.isElementHandle(this.#node)) {
      const locatorToElementHandle = await (
        this.#node as Locator
      ).elementHandles();
      if (locatorToElementHandle.length > 0)
        this.#node = locatorToElementHandle[0];
    }
    return this;
  }

  constructor(el: ElementHandle | Locator) {
    this.#node = el;
  }

  async init(): Promise<this> {
    if (!this.isElementHandle(this.#node)) {
      await this.toElementHandle();
    }
    await this.getParams();
    return this;
  }

  async getParams(): Promise<this> {
    const [nodeType, nodeId, nodeName, localName, nodeClass] = await (
      this.#node as ElementHandle
    ).evaluate((el) => {
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

  async parentNode(): Promise<PlaywrightElementAdapter | null> {
    if (this.#parentNode === null) {
      const parent = (
        await (this.#node as ElementHandle).getProperty("parentNode")
      ).asElement();
      if (parent) {
        this.#parentNode = new PlaywrightElementAdapter(parent);
        await this.#parentNode.init();
      } else {
        this.#parentNode = null;
      }
    }
    return this.#parentNode;
  }

  async children(): Promise<PlaywrightElementAdapter[]> {
    const childrenNodes = await (this.#node as ElementHandle).$$(":scope > *");
    const elHandleChildren = childrenNodes.map(
      (child) => new PlaywrightElementAdapter(child)
    );
    await Promise.all(elHandleChildren.map((el) => el.init()));
    return elHandleChildren;
  }

  async getAttribute(attr: string): Promise<string | null> {
    return (this.#node as ElementHandle).getAttribute(attr);
  }

  async getProperty(property: string): Promise<unknown | null> {
    return (
      await (this.#node as ElementHandle).getProperty(property)
    ).jsonValue();
  }

  async nodeNameInCorrectCase(): Promise<string> {
    const shadowRoot = (await (this.#node as ElementHandle).getProperty(
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

  async isEqualTo(other: PlaywrightElementAdapter): Promise<boolean> {
    const otherNode = other.#node;
    return (this.#node as ElementHandle).evaluate(
      // eslint-disable-next-line no-shadow, eqeqeq
      (thisNode, otherNode) => thisNode == otherNode,
      otherNode
    );
  }

  async isStrictlyEqualTo(other: PlaywrightElementAdapter): Promise<boolean> {
    const otherNode = other.#node;
    return (this.#node as ElementHandle).evaluate(
      // eslint-disable-next-line no-shadow
      (thisNode, otherNode) => thisNode === otherNode,
      otherNode
    );
  }
}

export default PlaywrightElementAdapter;
