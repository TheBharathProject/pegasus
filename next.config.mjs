// Pegasus is a tool inside the Sypher factory. The shell at sypher.in
// rewrites /pegasus/:path+ to this app's deployment, and basePath here
// makes Next prefix every page route, asset URL, and Link `href` with
// /pegasus automatically.
//
// To link OUT to the apex (sypher.in/blog, /privacy, /terms), use a
// plain <a href="/blog"> — <Link> would prepend /pegasus and route
// inside the tool. See sypher-shell/docs/sypher-factory/repo-structure.md.

/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: "/pegasus",
  // Disable React Strict Mode's dev-only double-invoke of useEffect.
  // Production was already single-fire; strict mode only doubled every
  // page's initial fetch in dev, making the DevTools network panel hard
  // to read while debugging. Flip back to `true` if we want strict mode's
  // safety checks (missing effect cleanup, stale closures, render-time
  // side effects) and re-audit affected pages.
  reactStrictMode: false,
};

export default nextConfig;
