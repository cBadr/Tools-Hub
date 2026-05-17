import { parse, type HTMLElement } from "node-html-parser";
import juice from "juice";
import { convert } from "html-to-text";

export interface OptimizeOptions {
  fixMissingAlt?: boolean;
  fixImageDimensions?: boolean;
  wrapFloatingText?: boolean;
  fixRelativeLinks?: boolean;
  baseUrl?: string;
  replaceCssLayouts?: boolean;
  removeDisplayNone?: boolean;
  inlineCss?: boolean;
  addPlainText?: boolean;
  imagesToBase64?: boolean;
  addUnsubscribeHeader?: boolean;
}

export interface HtmlIssue {
  id: string;
  severity: "error" | "warning" | "info";
  message: string;
  fixKey?: keyof OptimizeOptions;
  count?: number;
}

export interface InboxScore {
  score: number;
  issues: HtmlIssue[];
  plainText?: string;
}

// ─── Scorer (client-safe, no fetch) ──────────────────────────────────────────

export function scoreHtml(html: string): InboxScore {
  const issues: HtmlIssue[] = [];
  let score = 100;

  try {
    const root = parse(html);

    // Images without alt
    const imgsNoAlt = root.querySelectorAll("img:not([alt])");
    if (imgsNoAlt.length > 0) {
      issues.push({ id: "missing_alt", severity: "warning", message: `${imgsNoAlt.length} صورة بدون خاصية alt`, fixKey: "fixMissingAlt", count: imgsNoAlt.length });
      score -= Math.min(imgsNoAlt.length * 3, 10);
    }

    // Images without dimensions
    const imgsNoDims = root.querySelectorAll("img").filter(
      (img) => !img.getAttribute("width") || !img.getAttribute("height"),
    );
    if (imgsNoDims.length > 0) {
      issues.push({ id: "missing_dims", severity: "info", message: `${imgsNoDims.length} صورة بدون width/height`, fixKey: "fixImageDimensions", count: imgsNoDims.length });
      score -= Math.min(imgsNoDims.length * 2, 8);
    }

    // Flex / Grid
    const flexCount = (html.match(/display\s*:\s*flex/gi) ?? []).length;
    const gridCount = (html.match(/display\s*:\s*grid/gi) ?? []).length;
    if (flexCount + gridCount > 0) {
      issues.push({ id: "flex_grid", severity: "error", message: `display:flex/grid موجود (${flexCount + gridCount} مرة) — Outlook لا يدعمه`, fixKey: "replaceCssLayouts", count: flexCount + gridCount });
      score -= Math.min((flexCount + gridCount) * 5, 20);
    }

    // display:none / visibility:hidden
    const hiddenCount = (html.match(/display\s*:\s*none|visibility\s*:\s*hidden/gi) ?? []).length;
    if (hiddenCount > 0) {
      issues.push({ id: "hidden_elements", severity: "warning", message: `${hiddenCount} عنصر مخفي — قد يُثير فلاتر الـ Spam`, fixKey: "removeDisplayNone", count: hiddenCount });
      score -= Math.min(hiddenCount * 4, 15);
    }

    // Relative links
    const relLinks = root.querySelectorAll("a[href]").filter((a) => {
      const href = a.getAttribute("href") ?? "";
      return href.startsWith("/") && !href.startsWith("//");
    });
    if (relLinks.length > 0) {
      issues.push({ id: "relative_links", severity: "warning", message: `${relLinks.length} رابط نسبي — لن يعمل في الإيميل`, fixKey: "fixRelativeLinks", count: relLinks.length });
      score -= Math.min(relLinks.length * 3, 12);
    }

    // Style blocks (inline CSS needed)
    const styleBlocks = root.querySelectorAll("style").length;
    if (styleBlocks > 0) {
      issues.push({ id: "style_blocks", severity: "info", message: `${styleBlocks} كتلة <style> — يُفضّل تحويلها لـ inline styles`, fixKey: "inlineCss", count: styleBlocks });
      score -= Math.min(styleBlocks * 3, 10);
    }

    // Image-to-text ratio
    const textLen = root.text.trim().length;
    const imgCount = root.querySelectorAll("img").length;
    if (imgCount > 0 && textLen < imgCount * 50) {
      issues.push({ id: "image_text_ratio", severity: "error", message: "نسبة الصور إلى النص مرتفعة — خطر Spam", count: imgCount });
      score -= 15;
    }

    // No plain text version hint
    if (html.length > 200) {
      issues.push({ id: "no_plain_text", severity: "info", message: "لا توجد نسخة Plain Text — أضفها لتحسين التسليم", fixKey: "addPlainText" });
      score -= 5;
    }
  } catch {
    // parse errors don't crash scoring
  }

  return { score: Math.max(score, 0), issues };
}

// ─── Optimizer (server-only — may fetch image sizes) ─────────────────────────

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

  // 2. Fix image dimensions (fetch header to probe size)
  if (options.fixImageDimensions) {
    const imgs = root.querySelectorAll("img").filter(
      (img) => !img.getAttribute("width") || !img.getAttribute("height"),
    );
    await Promise.allSettled(
      imgs.map(async (img) => {
        const src = img.getAttribute("src") ?? "";
        if (!src.startsWith("http")) return;
        try {
          // probe-image-size: read just enough bytes to detect dimensions
          const probeImageSize = (await import("probe-image-size")).default;
          const info = await probeImageSize(src);
          if (!img.getAttribute("width"))  img.setAttribute("width",  String(info.width));
          if (!img.getAttribute("height")) img.setAttribute("height", String(info.height));
        } catch { /* skip unfetchable images */ }
      }),
    );
  }

  // 3. Wrap floating text nodes (rebuild body HTML with wrapped text nodes)
  if (options.wrapFloatingText) {
    const body = root.querySelector("body") ?? root;
    const newInner = body.childNodes.map((node) => {
      if (node.nodeType === 3 /* TEXT_NODE */ && node.text.trim()) {
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

  // 5. Replace display:flex / grid with table structure
  if (options.replaceCssLayouts) {
    // Simple replacement in style attributes
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
    // Also in <style> blocks
    root.querySelectorAll("style").forEach((styleEl) => {
      let css = styleEl.innerHTML;
      css = css
        .replace(/display\s*:\s*flex/gi, "display:block")
        .replace(/display\s*:\s*grid/gi, "display:block");
      styleEl.innerHTML = css;
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

  // 7. Inline CSS (juice operates on the full HTML string)
  if (options.inlineCss) {
    try {
      result = juice(result);
    } catch { /* juice failure is non-fatal */ }
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
          const b64  = `data:${mime};base64,${buf.toString("base64")}`;
          result = result.replace(full, `<img${pre} src="${b64}"${post}>`);
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
