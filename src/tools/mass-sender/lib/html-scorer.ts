// Client-safe: only node-html-parser (pure JS, no Node.js APIs)
import { parse } from "node-html-parser";

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
}

export function scoreHtml(html: string): InboxScore {
  const issues: HtmlIssue[] = [];
  let score = 100;

  try {
    const root = parse(html);

    const imgsNoAlt = root.querySelectorAll("img:not([alt])");
    if (imgsNoAlt.length > 0) {
      issues.push({ id: "missing_alt", severity: "warning", message: `${imgsNoAlt.length} صورة بدون خاصية alt`, fixKey: "fixMissingAlt", count: imgsNoAlt.length });
      score -= Math.min(imgsNoAlt.length * 3, 10);
    }

    const imgsNoDims = root.querySelectorAll("img").filter(
      (img) => !img.getAttribute("width") || !img.getAttribute("height"),
    );
    if (imgsNoDims.length > 0) {
      issues.push({ id: "missing_dims", severity: "info", message: `${imgsNoDims.length} صورة بدون width/height`, fixKey: "fixImageDimensions", count: imgsNoDims.length });
      score -= Math.min(imgsNoDims.length * 2, 8);
    }

    const flexCount = (html.match(/display\s*:\s*flex/gi) ?? []).length;
    const gridCount = (html.match(/display\s*:\s*grid/gi) ?? []).length;
    if (flexCount + gridCount > 0) {
      issues.push({ id: "flex_grid", severity: "error", message: `display:flex/grid موجود (${flexCount + gridCount} مرة) — Outlook لا يدعمه`, fixKey: "replaceCssLayouts", count: flexCount + gridCount });
      score -= Math.min((flexCount + gridCount) * 5, 20);
    }

    const hiddenCount = (html.match(/display\s*:\s*none|visibility\s*:\s*hidden/gi) ?? []).length;
    if (hiddenCount > 0) {
      issues.push({ id: "hidden_elements", severity: "warning", message: `${hiddenCount} عنصر مخفي — قد يُثير فلاتر الـ Spam`, fixKey: "removeDisplayNone", count: hiddenCount });
      score -= Math.min(hiddenCount * 4, 15);
    }

    const relLinks = root.querySelectorAll("a[href]").filter((a) => {
      const href = a.getAttribute("href") ?? "";
      return href.startsWith("/") && !href.startsWith("//");
    });
    if (relLinks.length > 0) {
      issues.push({ id: "relative_links", severity: "warning", message: `${relLinks.length} رابط نسبي — لن يعمل في الإيميل`, fixKey: "fixRelativeLinks", count: relLinks.length });
      score -= Math.min(relLinks.length * 3, 12);
    }

    const styleBlocks = root.querySelectorAll("style").length;
    if (styleBlocks > 0) {
      issues.push({ id: "style_blocks", severity: "info", message: `${styleBlocks} كتلة <style> — يُفضّل تحويلها لـ inline styles`, fixKey: "inlineCss", count: styleBlocks });
      score -= Math.min(styleBlocks * 3, 10);
    }

    const textLen = root.text.trim().length;
    const imgCount = root.querySelectorAll("img").length;
    if (imgCount > 0 && textLen < imgCount * 50) {
      issues.push({ id: "image_text_ratio", severity: "error", message: "نسبة الصور إلى النص مرتفعة — خطر Spam", count: imgCount });
      score -= 15;
    }

    if (html.length > 200) {
      issues.push({ id: "no_plain_text", severity: "info", message: "لا توجد نسخة Plain Text — أضفها لتحسين التسليم", fixKey: "addPlainText" });
      score -= 5;
    }
  } catch { /* parse errors don't crash scoring */ }

  return { score: Math.max(score, 0), issues };
}
