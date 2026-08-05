import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const required = [
  "public/robots.txt",
  "public/sitemap.xml",
  "public/llms.txt",
  "public/llms-full.txt",
  "public/.well-known/api-catalog",
  "public/.well-known/openapi.json",
  "public/.well-known/agent-card.json",
  "public/.well-known/mcp/server-card.json",
  "public/.well-known/agent-skills/index.json",
  "public/.well-known/agent-skills/cryptopunks-research/SKILL.md",
];

for (const path of required) assert.ok((await readFile(path)).length > 0, `${path} must not be empty`);
const skill = await readFile(required.at(-1));
const index = JSON.parse(await readFile("public/.well-known/agent-skills/index.json", "utf8"));
const digest = `sha256:${createHash("sha256").update(skill).digest("hex")}`;
assert.equal(index.skills[0].digest, digest, "Agent Skill digest must match SKILL.md");
JSON.parse(await readFile("public/.well-known/api-catalog", "utf8"));
JSON.parse(await readFile("public/.well-known/openapi.json", "utf8"));
const card = JSON.parse(await readFile("public/.well-known/agent-card.json", "utf8"));
assert.equal(card.protocolVersion, "1.0", "Agent Card must use A2A 1.0");
assert.ok(card.supportedInterfaces.some((entry) => entry.protocolBinding === "JSONRPC" && entry.url.includes("tenant=cryptopunks")), "Agent Card must advertise the CryptoPunks JSON-RPC tenant");
assert.ok(card.skills.length > 0, "Agent Card must advertise a real skill");
const mcpCard = JSON.parse(await readFile("public/.well-known/mcp/server-card.json", "utf8"));
assert.equal(mcpCard.transport.type, "streamable-http", "MCP Server Card must advertise Streamable HTTP");
assert.ok(mcpCard.transport.endpoint.includes("tenant=cryptopunks"), "MCP Server Card must advertise the CryptoPunks tenant");
console.log("Agent discovery files verified.");
