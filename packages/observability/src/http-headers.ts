export function securityHeaders(isProduction = process.env.NODE_ENV === "production"): Record<string, string> {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "X-DNS-Prefetch-Control": "off",
    ...(isProduction ? { "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload" } : {}),
  };
}

export function contentSecurityPolicy(nonce: string, isDev = process.env.NODE_ENV !== "production") {
  const sentry = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN || "";
  let sentryHost = "";
  try {
    if (sentry) sentryHost = new URL(sentry).origin;
  } catch {
    sentryHost = "";
  }
  const connect = isDev
    ? "'self' ws: wss: http://localhost:* http://127.0.0.1:*"
    : ["'self'", sentryHost].filter(Boolean).join(" ");
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https://images.unsplash.com",
    "font-src 'self' data:",
    `connect-src ${connect}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export function applySecurityHeaders(headers: { set(name: string, value: string): void }, nonce?: string) {
  for (const [name, value] of Object.entries(securityHeaders())) {
    headers.set(name, value);
  }
  if (nonce) {
    headers.set("Content-Security-Policy", contentSecurityPolicy(nonce));
  }
}

export function nextConfigHeaders() {
  const items = Object.entries(securityHeaders(true)).map(([key, value]) => ({ key, value }));
  return [
    {
      source: "/:path*",
      headers: items.filter((row) => row.key !== "Strict-Transport-Security" || process.env.NODE_ENV === "production"),
    },
  ];
}
