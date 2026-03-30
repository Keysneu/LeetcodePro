import { UnauthorizedException } from "@nestjs/common";

export const DEFAULT_ADMIN_API_KEY = "leetcodepro-admin-key";
const ADMIN_API_KEY_HEADER = "x-admin-key";

export function resolveAdminApiKey(configuredKey: string | undefined): string {
  const trimmed = configuredKey?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : DEFAULT_ADMIN_API_KEY;
}

export function isAdminKeyAuthorized(expectedKey: string, receivedKey: string | undefined): boolean {
  const trimmed = receivedKey?.trim();
  if (!trimmed) {
    return false;
  }

  return trimmed === expectedKey;
}

export function ensureAdminAuthorized(receivedKey: string | undefined, configuredKey: string | undefined): void {
  const expected = resolveAdminApiKey(configuredKey);
  if (isAdminKeyAuthorized(expected, receivedKey)) {
    return;
  }

  throw new UnauthorizedException(`Missing or invalid ${ADMIN_API_KEY_HEADER} header.`);
}
