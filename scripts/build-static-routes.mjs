import { mkdir, readFile, writeFile } from "node:fs/promises";

const DIST = new URL("../dist/", import.meta.url);
const rootIndex = await readFile(new URL("index.html", DIST), "utf8");
const fixedRoutes = [
  "cryptopunks",
  "cryptopunks/search",
  "cryptopunks/owners",
  "cryptopunks/accountinfo",
  "cryptopunks/largest-sales",
  "cryptopunks/transactions",
  "cryptopunks/bids",
  "cryptopunks/types",
  "cryptopunks/attributes",
  "cryptopunks/attribute-counts",
  "cryptopunks/all",
  "cryptopunks/leaderboard",
  "cryptopunks/topsales",
  "cryptopunks/recents",
  "cryptopunks/forSale",
  "cryptopunks/sales",
  "cryptopunks/wrapped",
  "cryptopunks/terms",
];
const routes = [
  ...fixedRoutes,
  ...Array.from(
    { length: 10_000 },
    (_, id) => `cryptopunks/details/${id}`,
  ),
];

function routeIndex(route) {
  const depth = route.split("/").length;
  const prefix = "../".repeat(depth);
  return rootIndex.replaceAll("./assets/", `${prefix}assets/`);
}

for (const route of routes) {
  const directory = new URL(`${route}/`, DIST);
  await mkdir(directory, { recursive: true });
  await writeFile(new URL("index.html", directory), routeIndex(route), "utf8");
}

await writeFile(new URL("404.html", DIST), rootIndex, "utf8");
await writeFile(
  new URL("route-manifest.json", DIST),
  `${JSON.stringify(
    {
      schema:
        "https://cryptopunks.website/schemas/static-route-manifest-v1.json",
      fixedRoutes: fixedRoutes.map((route) => `/${route}`),
      punkDetails: {
        pattern: "/cryptopunks/details/:id",
        from: 0,
        to: 9_999,
      },
      generatedRouteShells: routes.length,
    },
    null,
    2,
  )}\n`,
  "utf8",
);
process.stdout.write(
  `Wrote ${routes.length.toLocaleString()} static route shells plus 404.html\n`,
);
