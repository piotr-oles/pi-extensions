import { sliceByColumn, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

const FULL_RESET = "\x1b[0m";
const TEXT_RESET = "\x1b[23m\x1b[39m";

export function truncateToolLine(
  text: string,
  width: number,
  ellipsis = "...",
  pad = false,
): string {
  if (width <= 0) {
    return "";
  }

  const textWidth = visibleWidth(text);
  if (textWidth <= width) {
    return pad ? text + " ".repeat(width - textWidth) : text;
  }

  const suffix = sliceByColumn(ellipsis, 0, width, true);
  const prefixWidth = width - visibleWidth(suffix);
  // Remove Pi's final reset so the dots inherit the text color and the card keeps its background.
  const prefix =
    prefixWidth > 0 ? truncateToWidth(text, prefixWidth, "").slice(0, -FULL_RESET.length) : "";
  const line = prefix + suffix + TEXT_RESET;
  return pad ? line + " ".repeat(width - visibleWidth(line)) : line;
}
