import { homedir } from "node:os";
import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parse, postprocess, preprocess } from "micromark";
import { decodeString } from "micromark-util-decode-string";

export function rewriteFileLinks(markdown: string, cwd: string): string {
  if (!markdown.includes("](")) {
    return markdown;
  }

  const events = postprocess(
    parse()
      .document()
      .write(preprocess()(markdown, undefined, true)),
  );
  const linkKinds: ("link" | "image")[] = [];
  let result = "";
  let offset = 0;

  for (const [state, token] of events) {
    if (token.type === "link" || token.type === "image") {
      if (state === "enter") {
        linkKinds.push(token.type);
      } else {
        linkKinds.pop();
      }
    } else if (
      state === "enter" &&
      token.type === "resourceDestinationString" &&
      linkKinds.at(-1) === "link"
    ) {
      const { start, end } = token;
      const href = toFileHref(decodeString(markdown.slice(start.offset, end.offset)), cwd);
      if (href !== undefined) {
        result += markdown.slice(offset, start.offset) + href;
        offset = end.offset;
      }
    }
  }

  return result + markdown.slice(offset);
}

function toFileHref(destination: string, cwd: string): string | undefined {
  const anchor = /#L(\d+)$/.exec(destination);
  const target = anchor ? destination.slice(0, anchor.index) : destination;
  const location = /:\d+(?::\d+)?$/.exec(target);
  const path = location ? target.slice(0, location.index) : target;

  if (!path || path.startsWith("//") || /[?#]/.test(path)) {
    return undefined;
  }

  // A bare filename with a line number can look like a URI scheme.
  const scheme = /^[a-z][a-z0-9+.-]*:/i.exec(target);
  if (
    scheme &&
    !isAbsolute(path) &&
    !(location && scheme[0] === `${path}:` && path.includes("."))
  ) {
    return undefined;
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    return undefined;
  }

  const absolute = decoded.startsWith("~/")
    ? resolve(homedir(), decoded.slice(2))
    : resolve(cwd, decoded);
  const href = pathToFileURL(absolute).href.replaceAll("(", "%28").replaceAll(")", "%29");
  return href + (anchor ? `:${anchor[1]}` : (location?.[0] ?? ""));
}
