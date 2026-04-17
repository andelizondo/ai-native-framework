export const AUTH_TEST_BYPASS_COOKIE = "dashboard_e2e_auth";

export function clearBypassCookieInBrowser() {
  document.cookie = `${AUTH_TEST_BYPASS_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}
