// src/lib/server/qf.ts
import { QF_CLIENT_ID, QF_CLIENT_SECRET, qfAuthBase, qfApiBase } from "./env";

let accessToken: string | null = null;
let tokenExpiresAt = 0; // epoch ms

async function fetchAccessToken(): Promise<string> {
  const url = `${qfAuthBase()}/oauth2/token`;
  const auth = Buffer.from(`${QF_CLIENT_ID()}:${QF_CLIENT_SECRET()}`).toString("base64");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials", scope: "content" }),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("[QF TOKEN ERROR]", res.status, res.statusText, text);
    throw new Error(`QF token error ${res.status}: ${text}`);
  }

  const json = (await res.json()) as { access_token: string; expires_in: number };
  accessToken = json.access_token;
  tokenExpiresAt = Date.now() + (json.expires_in - 60) * 1000; // refresh 60s early
  return accessToken!;
}


export function qfHeaders() {
  return {
    "cache-control": "s-maxage=600, stale-while-revalidate=300",
  };
}


export async function getQfToken(force = false): Promise<string> {
  if (force) {
    accessToken = null;
  }
  if (!accessToken || Date.now() >= tokenExpiresAt) {
    return fetchAccessToken();
  }
  return accessToken;
}

// Generic GET with headers and one automatic retry on invalid/expired token
export async function qfGet<T>(
  path: string,
  init?: { revalidate?: number; query?: Record<string, string> }
): Promise<T> {
  const base = qfApiBase();
  const url = new URL(`${base}${path}`);
  if (init?.query) Object.entries(init.query).forEach(([k, v]) => url.searchParams.set(k, v));

  const attempt = async (forceToken = false) => {
    const token = await getQfToken(forceToken);
    const res = await fetch(url.toString(), {
      headers: {
        "x-auth-token": token,
        "x-client-id": QF_CLIENT_ID(),
      },
      next: { revalidate: init?.revalidate ?? 3600 },
    });
    return res;
  };

  // First try
  let res = await attempt(false);

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    // If token expired/inactive, refresh and retry once
    if (
      (res.status === 401 || res.status === 403) &&
      /invalid_token|expired|inactive/i.test(text)
    ) {
      res = await attempt(true);
      if (!res.ok) {
        const t2 = await res.text().catch(() => "");
        throw new Error(`QF GET ${url} -> ${res.status} ${t2}`);
      }
    } else {
      throw new Error(`QF GET ${url} -> ${res.status} ${text}`);
    }
  }

  return (await res.json()) as T;
}
