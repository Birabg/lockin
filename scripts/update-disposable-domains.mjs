// Refreshes src/lib/data/disposable-domains.json from the community blocklist
// (https://github.com/disposable-email-domains/disposable-email-domains, CC0).
// Run with: npm run email:domains
import { writeFile } from "node:fs/promises";

const SOURCE = "https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/main/disposable_email_blocklist.conf";
const OUT = new URL("../src/lib/data/disposable-domains.json", import.meta.url);

const res = await fetch(SOURCE);
if (!res.ok) throw new Error(`Download failed: ${res.status}`);
const domains = [
  ...new Set(
    (await res.text())
      .split("\n")
      .map((line) => line.trim().toLowerCase())
      .filter((line) => line && !line.startsWith("#")),
  ),
].sort();
if (domains.length < 1000) throw new Error(`Only ${domains.length} domains, which looks wrong; not writing`);

await writeFile(OUT, JSON.stringify(domains) + "\n");
console.log(`Wrote ${domains.length} domains`);
