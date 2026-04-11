/**
 * Rewrite external download URLs so browsers actually save the file instead
 * of opening a preview page.
 *
 * Background: when the frontend triggers an `<a download target="_blank">`
 * with a cross-origin URL, Chrome / Firefox silently drop the `download`
 * attribute and navigate to the URL. For Google Drive share links like
 * `drive.google.com/file/d/{ID}/view?usp=sharing`, that lands on the Drive
 * preview page — the user sees the preview but nothing is ever saved to disk.
 *
 * Fix: convert the share link to `uc?export=download&id={ID}`, which Drive
 * serves with `Content-Type: application/octet-stream`. The browser honours
 * that and downloads the bytes directly.
 *
 * Idempotent: URLs that are already in the `uc?export=download` form (or any
 * non-Drive URL) pass through unchanged.
 */
export function normalizeDownloadUrl(url: string | null | undefined): string {
  if (!url) return ''
  const driveShareMatch = url.match(/drive\.google\.com\/file\/d\/([^/?#]+)/i)
  if (driveShareMatch) {
    // `confirm=t` skips the "Google can't scan this file for viruses" interstitial
    // that Drive shows for files larger than ~100 MB. Without it, the endpoint
    // returns HTML instead of the file bytes.
    return `https://drive.google.com/uc?export=download&confirm=t&id=${driveShareMatch[1]}`
  }
  return url
}
