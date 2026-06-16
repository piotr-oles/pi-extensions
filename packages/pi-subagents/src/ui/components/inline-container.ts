import type { Component } from "@earendil-works/pi-tui";
import { Container, wrapTextWithAnsi, visibleWidth, truncateToWidth } from "@earendil-works/pi-tui";

export class InlineContainer implements Component {
  private readonly container: Container;

  constructor(private readonly gap: string = " ") {
    this.container = new Container();
  }

  clear() {
    this.container.clear();
  }

  addChild(component: Component) {
    this.container.addChild(component);
  }

  removeChild(component: Component) {
    this.container.removeChild(component);
  }

  render(width: number): string[] {
    const parts: string[] = [];
    let remainingWidth = width;
    for (let index = 0; index < this.container.children.length; ++index) {
      const child = this.container.children[index];
      const rendered = child.render(remainingWidth);
      if (rendered.length === 0) {
        continue;
      }
      const part = rendered[0].trim();
      if (rendered.length > 1 || part.includes("\n")) {
        throw new Error(
          `Cannot render multi-line component in InlineContainer, index=${index}, rendered=${JSON.stringify(rendered)}.`,
        );
      }
      parts.push(part);
      remainingWidth -= visibleWidth(part + this.gap);
      if (remainingWidth <= 0) {
        break;
      }
    }

    const text = parts.join(this.gap);

    return [truncateToWidth(text, width, '', true)];
  }

  invalidate() {
    this.container.invalidate();
  }
}
