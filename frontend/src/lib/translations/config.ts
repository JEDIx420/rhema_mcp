const DEFAULT_RHELO_API_BASE_URL = "https://api.rhelobible.com";

export interface RemoteTranslationConfig {
  enabled: boolean;
  baseUrl: string;
}

export function normalizeRheloApiBaseUrl(value?: string): string {
  const candidate = (value || DEFAULT_RHELO_API_BASE_URL).trim().replace(/\/+$/, "");
  const parsed = new URL(candidate);
  const localDevelopment = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (parsed.protocol !== "https:" && !(localDevelopment && parsed.protocol === "http:")) {
    throw new Error("Rhelo API base URL must use HTTPS outside local development");
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error("Rhelo API base URL must not contain credentials, query parameters, or fragments");
  }
  return candidate;
}

export function getRemoteTranslationConfig(): RemoteTranslationConfig {
  return {
    enabled: process.env.NEXT_PUBLIC_RHELO_REMOTE_TRANSLATIONS_ENABLED === "true",
    baseUrl: normalizeRheloApiBaseUrl(process.env.NEXT_PUBLIC_RHELO_API_BASE_URL),
  };
}
