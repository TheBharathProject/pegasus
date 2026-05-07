// basePath-aware URL helpers.
//
// next.config.mjs sets basePath: "/pegasus", which means:
//   - <Link href="/login">  → href becomes /pegasus/login (auto-prefixed)
//   - router.push("/login") → goes to /pegasus/login (auto-prefixed)
// but raw window.location.href DOES NOT auto-prefix. So anywhere we
// imperatively bounce the browser to a Pegasus route, route through
// here so dev (without the shell) and prod (behind the shell) both
// land on the right URL.

const BASE_PATH = "/pegasus";

export function withBase(path: string): string {
  // Tolerate both "/foo" and "foo" inputs.
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${BASE_PATH}${p}`;
}

export function goTo(path: string): void {
  if (typeof window === "undefined") return;
  window.location.href = withBase(path);
}
