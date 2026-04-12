import { describe, it, expect } from "vitest";
import { isAllowedUrl } from "./url-safety";

// Replicate normalizeUrl logic (used in route files but not exported)
function normalizeUrl(url: string): string {
  return url.toLowerCase().replace(/\/+$/, "");
}

describe("isAllowedUrl", () => {
  describe("allows valid public URLs", () => {
    it("allows https://example.com", () => {
      expect(isAllowedUrl("https://example.com")).toBe(true);
    });

    it("allows http://blog.dev", () => {
      expect(isAllowedUrl("http://blog.dev")).toBe(true);
    });
  });

  describe("blocks blocked hosts", () => {
    it.each([
      "http://localhost",
      "http://127.0.0.1",
      "http://0.0.0.0",
      "http://169.254.169.254",
      "http://metadata.google.internal",
      "http://[::1]",
    ])("blocks %s", (url) => {
      expect(isAllowedUrl(url)).toBe(false);
    });
  });

  describe("blocks private IP ranges", () => {
    it.each([
      ["http://10.0.0.1", "10.x.x.x (class A private)"],
      ["http://172.16.0.1", "172.16.x.x (class B private lower bound)"],
      ["http://172.31.255.255", "172.31.x.x (class B private upper bound)"],
      ["http://192.168.1.1", "192.168.x.x (class C private)"],
    ])("blocks %s (%s)", (url) => {
      expect(isAllowedUrl(url)).toBe(false);
    });
  });

  describe("allows IPs outside private ranges", () => {
    it("allows 172.15.0.1 (below private range)", () => {
      expect(isAllowedUrl("http://172.15.0.1")).toBe(true);
    });

    it("allows 172.32.0.1 (above private range)", () => {
      expect(isAllowedUrl("http://172.32.0.1")).toBe(true);
    });

    it("allows https://192.167.1.1 (not 192.168)", () => {
      expect(isAllowedUrl("https://192.167.1.1")).toBe(true);
    });
  });

  describe("blocks non-HTTP protocols", () => {
    it("blocks ftp://example.com", () => {
      expect(isAllowedUrl("ftp://example.com")).toBe(false);
    });

    it("blocks file:///etc/passwd", () => {
      expect(isAllowedUrl("file:///etc/passwd")).toBe(false);
    });
  });

  describe("blocks IPv6 loopback and link-local", () => {
    it.each([
      ["http://[fe80::1]", "link-local"],
      ["http://[fc00::1]", "unique local (fc)"],
      ["http://[fd00::1]", "unique local (fd)"],
    ])("blocks %s (%s)", (url) => {
      expect(isAllowedUrl(url)).toBe(false);
    });
  });

  describe("blocks invalid URLs", () => {
    it("blocks empty string", () => {
      expect(isAllowedUrl("")).toBe(false);
    });

    it("blocks non-URL string", () => {
      expect(isAllowedUrl("not-a-url")).toBe(false);
    });
  });
});

describe("normalizeUrl", () => {
  it("lowercases and strips trailing slash", () => {
    expect(normalizeUrl("https://Example.COM/")).toBe("https://example.com");
  });

  it("strips multiple trailing slashes", () => {
    expect(normalizeUrl("https://foo.com///")).toBe("https://foo.com");
  });

  it("leaves already-normalized URLs unchanged", () => {
    expect(normalizeUrl("https://foo.com")).toBe("https://foo.com");
  });

  it("lowercases all-caps URL", () => {
    expect(normalizeUrl("HTTPS://FOO.COM")).toBe("https://foo.com");
  });
});
