export type TrackingType = "img" | "css" | "js" | "font";

export interface TrackingTypeInfo {
  type: TrackingType;
  label: string;
  description: string;
  compatibility: "high" | "medium" | "low";
}

export const TRACKING_TYPES: TrackingTypeInfo[] = [
  {
    type: "img",
    label: "Image Pixel",
    description: "Classic 1×1 transparent GIF. Works in most email clients.",
    compatibility: "high",
  },
  {
    type: "css",
    label: "CSS Beacon",
    description: "Stylesheet request. Works in clients that block images but load CSS.",
    compatibility: "medium",
  },
  {
    type: "font",
    label: "Web Font",
    description: "Custom font request via @font-face. Bypasses some image blockers.",
    compatibility: "medium",
  },
  {
    type: "js",
    label: "JavaScript",
    description: "Script tag. Works only in web-based email clients (Gmail, Outlook Web).",
    compatibility: "low",
  },
];

export function getPixelUrl(
  trackingId: string,
  baseUrl: string,
  type: TrackingType = "img",
  recipientEmail?: string
): string {
  const params = new URLSearchParams();
  if (type !== "img") params.set("t", type);
  if (recipientEmail) params.set("e", recipientEmail);
  const qs = params.toString();
  return `${baseUrl}/api/track/${trackingId}${qs ? `?${qs}` : ""}`;
}

export function getSnippet(
  trackingId: string,
  baseUrl: string,
  type: TrackingType = "img",
  recipientEmail?: string
): string {
  const url = getPixelUrl(trackingId, baseUrl, type, recipientEmail);
  switch (type) {
    case "img":
      return `<img src="${url}" width="1" height="1" style="display:none" alt="" />`;
    case "css":
      return `<link rel="stylesheet" href="${url}" />`;
    case "js":
      return `<script src="${url}"><\/script>`;
    case "font":
      return `<style>@font-face{font-family:'t';src:url('${url}')}body{font-family:'t',Arial,sans-serif}</style>`;
  }
}

// Legacy alias used in a few places
export function getHtmlSnippet(trackingId: string, baseUrl: string): string {
  return getSnippet(trackingId, baseUrl, "img");
}
