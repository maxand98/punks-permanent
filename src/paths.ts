const contentRoot = new URL(/* @vite-ignore */ "../", import.meta.url);

export function contentUrl(path = "/") {
  const relative = path.replace(/^\/+/, "");
  return new URL(relative || "./", contentRoot).toString();
}

export function applicationPathname() {
  const rootPath = contentRoot.pathname.endsWith("/")
    ? contentRoot.pathname
    : `${contentRoot.pathname}/`;
  if (location.pathname === rootPath.slice(0, -1)) return "/";
  if (location.pathname.startsWith(rootPath)) {
    return `/${location.pathname.slice(rootPath.length)}`;
  }
  return location.pathname;
}
