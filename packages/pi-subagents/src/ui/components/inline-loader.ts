import type { Component, TUI } from "@earendil-works/pi-tui";
import { Loader } from "@earendil-works/pi-tui";

export class InlineLoader implements Component {
  private readonly loader: Loader;

  constructor(tui: TUI, spinnerColorFn: (str: string) => string) {
    this.loader = new Loader(tui, spinnerColorFn, () => "");
  }

  render(width: number): string[] {
    return this.loader
      .render(width)
      .map((line) => line.trim())
      .filter((line) => line !== "");
  }

  invalidate() {
    this.loader.invalidate();
  }

  start() {
    this.loader.start();
  }

  stop() {
    this.loader.stop();
  }
}
