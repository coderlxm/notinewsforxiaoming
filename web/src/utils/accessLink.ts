export function copyEntryAccessLink(publicId: string): Promise<void> {
  const url = new URL(`/p/${encodeURIComponent(publicId)}`, window.location.origin);
  return navigator.clipboard.writeText(url.toString());
}
