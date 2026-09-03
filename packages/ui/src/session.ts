export type CustomerSessionUser = {
  id: string;
  email: string | null;
  displayName: string | null;
  type: string;
  phone?: string | null;
};

let inFlight: Promise<CustomerSessionUser | null> | null = null;
let cached: CustomerSessionUser | null = null;

function readUser(data: unknown): CustomerSessionUser | null {
  const user = (data as { user?: CustomerSessionUser } | null)?.user;
  if (!user || user.type !== "CUSTOMER") return null;
  return user;
}

export function ensureCustomerSession(): Promise<CustomerSessionUser | null> {
  if (inFlight) return inFlight;
  inFlight = fetch("/api/auth/me", { credentials: "same-origin" })
    .then(async (res) => {
      if (res.status === 401 || res.status === 403) {
        cached = null;
        return null;
      }
      if (!res.ok) return cached;
      const user = readUser(await res.json());
      cached = user;
      return user;
    })
    .catch(() => cached)
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}
