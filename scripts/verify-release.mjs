import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const DIST = new URL("../dist/", import.meta.url);
const manifest = JSON.parse(
  await readFile(new URL("release-manifest.json", DIST), "utf8"),
);
const checksums = (
  await readFile(new URL("SHA256SUMS", DIST), "utf8")
)
  .trim()
  .split("\n")
  .map((line) => {
    const [sha256, path] = line.split("  ");
    return { sha256, path };
  });

if (manifest.routes.generatedShells !== 10_010) {
  throw new Error(
    `Expected 10,010 route shells, received ${manifest.routes.generatedShells}.`,
  );
}
for (const path of [
  "index.html",
  "cryptopunks/owners/index.html",
  "cryptopunks/details/0/index.html",
  "cryptopunks/details/9999/index.html",
  "route-manifest.json",
]) {
  await readFile(new URL(path, DIST));
}

const rootIndex = await readFile(new URL("index.html", DIST), "utf8");
const detailIndex = await readFile(
  new URL("cryptopunks/details/7804/index.html", DIST),
  "utf8",
);
if (/\b(?:src|href)="\//.test(rootIndex)) {
  throw new Error("Root index contains a root-absolute asset URL.");
}
if (!detailIndex.includes('../../../assets/')) {
  throw new Error("Nested Punk route does not point back to release assets.");
}

for (let start = 0; start < checksums.length; start += 250) {
  await Promise.all(
    checksums.slice(start, start + 250).map(async (expected) => {
      const contents = await readFile(new URL(expected.path, DIST));
      const actual = createHash("sha256").update(contents).digest("hex");
      if (actual !== expected.sha256) {
        throw new Error(`Release checksum mismatch: ${expected.path}`);
      }
    }),
  );
}
process.stdout.write(
  `Verified ${checksums.length.toLocaleString()} release checksums and direct static routes\n`,
);
