const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "169.254.169.254", // AWS metadata
  "metadata.google.internal", // GCP metadata
  "[::1]",
]);

/**
 * Validates that a URL is safe to fetch (not targeting internal/private networks).
 * Prevents SSRF attacks by blocking private IPs, metadata endpoints, and non-HTTP protocols.
 */
export function isAllowedUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);

    if (!["http:", "https:"].includes(url.protocol)) {
      return false;
    }

    if (BLOCKED_HOSTS.has(url.hostname)) {
      return false;
    }

    // Block private IP ranges
    const parts = url.hostname.split(".");
    if (parts.length === 4 && parts.every((p) => /^\d+$/.test(p))) {
      const a = parseInt(parts[0]);
      const b = parseInt(parts[1]);

      // 10.0.0.0/8
      if (a === 10) return false;
      // 172.16.0.0/12
      if (a === 172 && b >= 16 && b <= 31) return false;
      // 192.168.0.0/16
      if (a === 192 && b === 168) return false;
      // 0.0.0.0/8
      if (a === 0) return false;
    }

    // Block IPv6 loopback and link-local
    if (
      url.hostname.startsWith("[fe80:") ||
      url.hostname.startsWith("[fc") ||
      url.hostname.startsWith("[fd")
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
