export function getPixelUrl(trackingId: string, baseUrl: string): string {
  return `${baseUrl}/api/track/${trackingId}`;
}

export function getHtmlSnippet(trackingId: string, baseUrl: string): string {
  const pixelUrl = getPixelUrl(trackingId, baseUrl);
  return `<img src="${pixelUrl}" width="1" height="1" style="display:none;" alt="" />`;
}

export function getMarkdownSnippet(trackingId: string, baseUrl: string): string {
  const pixelUrl = getPixelUrl(trackingId, baseUrl);
  return `![](${pixelUrl})`;
}
