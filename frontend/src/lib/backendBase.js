/**
 * API host without trailing slash and without `/api`.
 * In local Next dev (port 3000+), default to Nest on :8001 so requests do not hit Next (which 404s on /api/*).
 */
export function resolveBackendBase() {
  const fromEnv = (process.env.NEXT_PUBLIC_BACKEND_URL || process.env.REACT_APP_BACKEND_URL || "")
    .trim()
    .replace(/\/$/, "");
  if (fromEnv) {
    return fromEnv;
  }
  if (typeof window !== "undefined") {
    const { hostname, port } = window.location;
    const isLocal = hostname === "localhost" || hostname === "127.0.0.1";
    const nextDevPorts = new Set(["3000", "3001", "3002", "3003"]);
    if (isLocal && nextDevPorts.has(port)) {
      return "http://localhost:8001";
    }
    return window.location.origin.replace(/\/$/, "");
  }
  return "http://localhost:8001";
}
