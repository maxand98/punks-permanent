interface AssetFetcher {
  fetch(request: Request): Promise<Response>;
}

interface Env {
  ASSETS: AssetFetcher;
}

const AGENT_LINKS = [
  '<https://cryptopunks.website/llms.txt>; rel="alternate"; type="text/markdown"',
  '<https://cryptopunks.website/.well-known/api-catalog>; rel="service-desc"; type="application/json"',
  '<https://cryptopunks.website/.well-known/openapi.json>; rel="service-desc"; type="application/vnd.oai.openapi+json"',
  '<https://cryptopunks.website/.well-known/agent-card.json>; rel="describedby"; type="application/json"',
  '<https://cryptopunks.website/.well-known/mcp/server-card.json>; rel="describedby"; type="application/json"',
  '<https://cryptopunks.website/.well-known/agent-skills/cryptopunks-research/SKILL.md>; rel="service-desc"; type="text/markdown"',
].join(", ");

const CONTENT_TYPES = new Map<string, string>([
  ["/.well-known/api-catalog", "application/linkset+json; charset=utf-8"],
  ["/.well-known/openapi.json", "application/json; charset=utf-8"],
  ["/.well-known/agent-card.json", "application/json; charset=utf-8"],
  ["/.well-known/agent-skills/index.json", "application/json; charset=utf-8"],
  ["/.well-known/agent-skills/cryptopunks-research/SKILL.md", "text/markdown; charset=utf-8"],
  ["/llms.txt", "text/markdown; charset=utf-8"],
  ["/llms-full.txt", "text/markdown; charset=utf-8"],
]);

const AGENT_CARD = {
  protocolVersion: "1.0",
  name: "CryptoPunks Public Dataset Research Agent",
  description: "Read-only research over the complete public CryptoPunks attributes snapshot and decoded event-history shards.",
  version: "1.0.0",
  url: "https://maxand98.com/a2a?tenant=cryptopunks",
  preferredTransport: "JSONRPC",
  supportedInterfaces: [{
    url: "https://maxand98.com/a2a?tenant=cryptopunks",
    protocolBinding: "JSONRPC",
    protocolVersion: "1.0",
    tenant: "cryptopunks",
  }],
  capabilities: { streaming: false, pushNotifications: false, extendedAgentCard: false },
  defaultInputModes: ["text/plain"],
  defaultOutputModes: ["text/plain"],
  skills: [{
    id: "research-punk",
    name: "Research a CryptoPunk",
    description: "Look up any Punk from 0 to 9999 in the public attributes snapshot and decoded history shard, returning traits, recent events, and source URLs.",
    tags: ["CryptoPunks", "traits", "history", "onchain-data"],
    examples: ["Research Punk 7804", "Show the traits and recent history for Punk 0"],
    inputModes: ["text/plain"],
    outputModes: ["text/plain"],
  }],
  securitySchemes: {},
  security: [],
};

const MCP_SERVER_CARD = {
  "$schema": "https://static.modelcontextprotocol.io/schemas/mcp-server-card/v1.json",
  version: "1.0",
  protocolVersion: "2025-11-25",
  serverInfo: { name: "cryptopunks-public-research", title: "CryptoPunks public dataset research", version: "1.0.0" },
  description: "Read-only lookup over the public CryptoPunks attributes snapshot and decoded history shards.",
  transport: { type: "streamable-http", endpoint: "https://maxand98.com/mcp?tenant=cryptopunks" },
  authentication: { required: false },
  capabilities: { tools: true, resources: false, prompts: false },
};

function acceptsMarkdown(request: Request) {
  const accept = request.headers.get("accept")?.toLowerCase() ?? "";
  return accept.includes("text/markdown") || accept.includes("text/x-markdown");
}

function withDiscovery(response: Response, contentType?: string) {
  const headers = new Headers(response.headers);
  headers.set("Link", AGENT_LINKS);
  headers.set("Vary", "Accept");
  if (contentType) headers.set("Content-Type", contentType);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/.well-known/agent-card.json") {
      return withDiscovery(Response.json(AGENT_CARD, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=300",
        },
      }), "application/json; charset=utf-8");
    }
    if (url.pathname === "/.well-known/mcp/server-card.json") {
      return withDiscovery(Response.json(MCP_SERVER_CARD, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=300",
        },
      }), "application/json; charset=utf-8");
    }
    let assetPath = url.pathname;
    if (url.pathname === "/index.md" || (url.pathname === "/" && acceptsMarkdown(request))) {
      assetPath = "/llms.txt";
    }

    const assetUrl = new URL(assetPath, request.url);
    const response = await env.ASSETS.fetch(new Request(assetUrl, request));
    const negotiatedType = assetPath === "/llms.txt" && url.pathname === "/"
      ? "text/markdown; charset=utf-8"
      : CONTENT_TYPES.get(assetPath);
    return withDiscovery(response, negotiatedType);
  },
};
