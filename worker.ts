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
  '<https://cryptopunks.website/.well-known/agent-skills/cryptopunks-research/SKILL.md>; rel="service-desc"; type="text/markdown"',
].join(", ");

const CONTENT_TYPES = new Map<string, string>([
  ["/.well-known/api-catalog", "application/linkset+json; charset=utf-8"],
  ["/.well-known/openapi.json", "application/json; charset=utf-8"],
  ["/.well-known/agent-skills/index.json", "application/json; charset=utf-8"],
  ["/.well-known/agent-skills/cryptopunks-research/SKILL.md", "text/markdown; charset=utf-8"],
  ["/llms.txt", "text/markdown; charset=utf-8"],
  ["/llms-full.txt", "text/markdown; charset=utf-8"],
]);

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
