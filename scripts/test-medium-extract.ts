/**
 * Manual smoke test for extractMetadata against Medium (and a control URL).
 * Run: `bun scripts/test-medium-extract.ts`
 */
import { extractMetadata } from "../src/lib/extract";

const URLS = [
  // The article the user asked about
  "https://medium.com/data-science-at-microsoft/designing-decision-heavy-enterprise-ai-systems-without-losing-control-60ac5d25e1e3",
  // Personal-profile Medium URL (@user/...)
  "https://medium.com/@saachikaur19/the-cap-theorem-the-ultimate-rule-of-distributed-systems-9bef458d124b",
  // Custom-domain Medium publication (uxdesign.cc → *.medium.com under the hood, but a non-medium.com host so falls through to the Cloudflare-fallback path)
  "https://uxdesign.cc/figma-config-2024-recap-d8d2c1497da9",
  // Non-Medium control — plain fetch path
  "https://example.com",
];

function preview(s: string | null, n = 120): string {
  if (!s) return "(null)";
  const flat = s.replace(/\s+/g, " ").trim();
  return flat.length > n ? flat.slice(0, n) + "…" : flat;
}

async function main() {
  for (const url of URLS) {
    console.log("\n────────────────────────────────────────");
    console.log("URL:", url);
    const t0 = Date.now();
    try {
      const md = await extractMetadata(url);
      const ms = Date.now() - t0;
      console.log(`took: ${ms}ms`);
      console.log("title:      ", preview(md.title));
      console.log("description:", preview(md.description));
      console.log("ogImage:    ", md.ogImage);
      console.log("domain:     ", md.domain);
      console.log("wordCount:  ", md.wordCount);
      console.log("content:    ", preview(md.content, 200));

      const looksBlocked =
        md.title === "Just a moment..." ||
        md.title?.startsWith("Attention Required");
      if (looksBlocked) {
        console.error(
          "❌ FAIL: extractor returned a Cloudflare challenge page",
        );
        process.exitCode = 1;
      } else if (!md.title && !md.content) {
        console.error("⚠️  WARN: extractor returned empty metadata");
      } else {
        console.log("✅ OK");
      }
    } catch (err) {
      console.error("❌ THREW:", err);
      process.exitCode = 1;
    }
  }
}

main();
