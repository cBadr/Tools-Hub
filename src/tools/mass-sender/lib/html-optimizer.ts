import "server-only";
import { parse } from "node-html-parser";
import juice from "juice";
import { convert } from "html-to-text";
import type { OptimizeOptions } from "./html-scorer";

export type { OptimizeOptions } from "./html-scorer";

export async function optimizeEmailHtml(
  html: string,
  options: OptimizeOptions = {},
): Promise<{ html: string; plainText?: string }> {
  let result = html;
  const root = parse(result);

  // 1. Fix missing alt attributes
  if (options.fixMissingAlt) {
    root.querySelectorAll("img:not([alt])").forEach((img) => {
      const src = img.getAttribute("src") ?? "";
      const name = src.split("/").pop()?.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ") ?? "";
      img.setAttribute("alt", name || "");
    });
  }

  // 2. Fix image dimensions (probe over HTTP)
  if (options.fixImageDimensions) {
    const imgs = root.querySelectorAll("img").filter(
      (img) => !img.getAttribute("width") || !img.getAttribute("height"),
    );
    await Promise.allSettled(
      imgs.map(async (img) => {
        const src = img.getAttribute("src") ?? "";
        if (!src.startsWith("http")) return;
        try {
          const probeImageSize = (await import("probe-image-size")).default;
          const info = await probeImageSize(src);
          if (!img.getAttribute("width"))  img.setAttribute("width",  String(info.width));
          if (!img.getAttribute("height")) img.setAttribute("height", String(info.height));
        } catch { /* skip unfetchable */ }
      }),
    );
  }

  // 3. Wrap floating text nodes
  if (options.wrapFloatingText) {
    const body = root.querySelector("body") ?? root;
    const newInner = body.childNodes.map((node) => {
      if (node.nodeType === 3 && node.text.trim()) {
        return `<p>${node.text}</p>`;
      }
      return node.toString();
    }).join("");
    if (body.tagName?.toLowerCase() === "body") {
      body.innerHTML = newInner;
    }
  }

  // 4. Fix relative links
  if (options.fixRelativeLinks && options.baseUrl) {
    const base = options.baseUrl.replace(/\/$/, "");
    root.querySelectorAll("a[href]").forEach((a) => {
      const href = a.getAttribute("href") ?? "";
      if (href.startsWith("/") && !href.startsWith("//")) {
        a.setAttribute("href", `${base}${href}`);
      }
    });
  }

  // 5. Replace display:flex / grid
  if (options.replaceCssLayouts) {
    root.querySelectorAll("[style]").forEach((el) => {
      const style = el.getAttribute("style") ?? "";
      const fixed = style
        .replace(/display\s*:\s*flex\s*;?/gi, "display:block;")
        .replace(/display\s*:\s*grid\s*;?/gi, "display:block;")
        .replace(/flex-direction[^;]*;?/gi, "")
        .replace(/align-items[^;]*;?/gi, "")
        .replace(/justify-content[^;]*;?/gi, "");
      el.setAttribute("style", fixed);
    });
    root.querySelectorAll("style").forEach((styleEl) => {
      styleEl.innerHTML = styleEl.innerHTML
        .replace(/display\s*:\s*flex/gi, "display:block")
        .replace(/display\s*:\s*grid/gi, "display:block");
    });
  }

  // 6. Remove display:none / visibility:hidden elements
  if (options.removeDisplayNone) {
    root.querySelectorAll("[style]").forEach((el) => {
      const style = el.getAttribute("style") ?? "";
      if (/display\s*:\s*none/i.test(style) || /visibility\s*:\s*hidden/i.test(style)) {
        el.remove();
      }
    });
  }

  result = root.toString();

  // 7. Inline CSS
  if (options.inlineCss) {
    try { result = juice(result); } catch { /* non-fatal */ }
  }

  // 8. Convert images to Base64
  if (options.imagesToBase64) {
    const imgSrcRe = /<img([^>]*)\ssrc="(https?:\/\/[^"]+)"([^>]*)>/gi;
    const matches = [...result.matchAll(imgSrcRe)];
    await Promise.allSettled(
      matches.map(async ([full, pre, src, post]) => {
        try {
          const resp = await fetch(src);
          const buf  = Buffer.from(await resp.arrayBuffer());
          const mime = resp.headers.get("content-type") ?? "image/png";
          result = result.replace(full, `<img${pre} src="data:${mime};base64,${buf.toString("base64")}"${post}>`);
        } catch { /* skip */ }
      }),
    );
  }

  // 9. Generate plain text
  let plainText: string | undefined;
  if (options.addPlainText) {
    plainText = convert(result, {
      wordwrap: 80,
      selectors: [
        { selector: "img", format: "skip" },
        { selector: "a",   options: { hideLinkHrefIfSameAsText: true } },
      ],
    });
  }

  return { html: result, plainText };
}
