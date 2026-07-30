import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const expectedImageHash =
  "ac39af4793119ee46bbff351d8cb6b5f23da60222126add4268e261199a2921b";
const image = await readFile(
  new URL("../public/assets/punks.png", import.meta.url),
);
const actualImageHash = createHash("sha256").update(image).digest("hex");

if (actualImageHash !== expectedImageHash) {
  throw new Error(`Composite hash mismatch: ${actualImageHash}`);
}

const catalog = JSON.parse(
  await readFile(
    new URL("../public/data/punks-attributes.json", import.meta.url),
    "utf8",
  ),
);

const expectedTypes = {
  Male: 6039,
  Female: 3840,
  Zombie: 88,
  Ape: 24,
  Alien: 9,
};

if (catalog.punks.length !== 10_000) {
  throw new Error(`Expected 10000 Punks, received ${catalog.punks.length}`);
}

for (const [type, count] of Object.entries(expectedTypes)) {
  if (catalog.counts.types[type] !== count) {
    throw new Error(
      `Expected ${count} ${type} Punks, received ${catalog.counts.types[type]}`,
    );
  }
}

if (catalog.punks[7804].join(", ") !== "Alien, Cap Forward, Pipe, Small Shades") {
  throw new Error("Punk #7804 golden attribute fixture does not match.");
}

process.stdout.write(
  `Verified 10,000 onchain attribute records at block ${catalog.source.blockNumber}\n`,
);
process.stdout.write(`Verified composite SHA-256 ${actualImageHash}\n`);
