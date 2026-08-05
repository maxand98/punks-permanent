import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";

const DIST = new URL("../dist/", import.meta.url);
const EXCLUDED = new Set(["release-manifest.json", "SHA256SUMS"]);

async function filesBelow(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = [];
  for (const entry of entries) {
    const relative = `${prefix}${entry.name}`;
    if (EXCLUDED.has(relative)) continue;
    if (entry.isDirectory()) {
      paths.push(...(await filesBelow(new URL(`${entry.name}/`, directory), `${relative}/`)));
    } else if (entry.isFile()) {
      paths.push(relative);
    }
  }
  return paths;
}

async function describe(path) {
  const url = new URL(path, DIST);
  const [contents, metadata] = await Promise.all([readFile(url), stat(url)]);
  return {
    path,
    bytes: metadata.size,
    sha256: createHash("sha256").update(contents).digest("hex"),
  };
}

const paths = (await filesBelow(DIST)).sort();
const files = [];
for (let start = 0; start < paths.length; start += 250) {
  files.push(...(await Promise.all(paths.slice(start, start + 250).map(describe))));
}
const attributes = JSON.parse(
  await readFile(new URL("data/punks-attributes.json", DIST), "utf8"),
);
const history = JSON.parse(
  await readFile(new URL("data/history-manifest.json", DIST), "utf8"),
);
const state = JSON.parse(
  await readFile(new URL("data/market-state.json", DIST), "utf8"),
);
const routes = JSON.parse(
  await readFile(new URL("route-manifest.json", DIST), "utf8"),
);
const manifest = {
  schema: "https://cryptopunks.website/schemas/release-manifest-v1.json",
  project: "Punks Permanent",
  licence: "CC0-1.0",
  unofficial: true,
  contracts: {
    market: state.source.contract,
    data: attributes.source.contract,
  },
  checkpoints: {
    attributes: attributes.source.blockNumber,
    history: history.source.snapshotBlock,
    marketState: state.source.blockNumber,
  },
  routes: {
    fixed: routes.fixedRoutes.length,
    punkDetails: routes.punkDetails.to - routes.punkDetails.from + 1,
    generatedShells: routes.generatedRouteShells,
  },
  payload: {
    files: files.length,
    bytes: files.reduce((total, file) => total + file.bytes, 0),
  },
  files,
};
await writeFile(
  new URL("release-manifest.json", DIST),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
);

const checksumPaths = [...paths, "release-manifest.json"].sort();
const checksums = [];
for (let start = 0; start < checksumPaths.length; start += 250) {
  checksums.push(
    ...(await Promise.all(checksumPaths.slice(start, start + 250).map(describe))),
  );
}
await writeFile(
  new URL("SHA256SUMS", DIST),
  `${checksums.map((file) => `${file.sha256}  ${file.path}`).join("\n")}\n`,
  "utf8",
);
process.stdout.write(
  `Wrote release manifest for ${files.length.toLocaleString()} files (${manifest.payload.bytes.toLocaleString()} bytes)\n`,
);
