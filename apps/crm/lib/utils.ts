/**
 * Ensures a URL has a protocol (http:// or https://)
 * Handles case-insensitive protocol detection (e.g., "Https://")
 */
export function ensureProtocol(url: string | null | undefined): string {
  if (!url) return ''
  const trimmed = url.trim()
  // Case-insensitive check for existing protocol
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed
  }
  return `https://${trimmed}`
}

/**
 * Checks if a string looks like a valid URL
 * Returns true for strings that start with http(s):// or look like domain names
 */
export function isValidUrl(str: string | null | undefined): boolean {
  if (!str) return false
  const trimmed = str.trim()
  // Check for explicit protocol
  if (/^https?:\/\//i.test(trimmed)) {
    return true
  }
  // Check for common URL patterns (domain.tld or domain.tld/path)
  // This catches things like "google.com", "example.com/deck.pdf", etc.
  if (/^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}/i.test(trimmed)) {
    return true
  }
  return false
}
