import { createHmac, createHash, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "espadana_session";
const SESSION_SECONDS = 24 * 60 * 60;

function getPassword() {
  return String(process.env.APP_PASSWORD ?? "");
}

function digest(value) {
  return createHash("sha256").update(String(value)).digest();
}

function signature(expiresAt, password) {
  return createHmac("sha256", password).update(`espadana:${expiresAt}`).digest("hex");
}

function parseCookies(header = "") {
  return String(header).split(";").reduce((cookies, part) => {
    const separator = part.indexOf("=");
    if (separator < 0) return cookies;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key) {
      try {
        cookies[key] = decodeURIComponent(value);
      } catch {
        cookies[key] = "";
      }
    }
    return cookies;
  }, {});
}

export function isPasswordConfigured() {
  return getPassword().length > 0;
}

export function passwordMatches(candidate) {
  const password = getPassword();
  return Boolean(password) && timingSafeEqual(digest(candidate), digest(password));
}

export function createSessionCookie() {
  const password = getPassword();
  if (!password) throw new Error("APP_PASSWORD_NOT_CONFIGURED");
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const token = `${expiresAt}.${signature(expiresAt, password)}`;
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}`;
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export function isAuthenticated(request) {
  const password = getPassword();
  if (!password) return false;
  const token = parseCookies(request.headers.cookie)[COOKIE_NAME] ?? "";
  const [expiresRaw, suppliedSignature, ...extra] = token.split(".");
  const expiresAt = Number(expiresRaw);
  if (extra.length || !Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) return false;
  const expectedSignature = signature(expiresAt, password);
  return /^[a-f0-9]{64}$/.test(suppliedSignature ?? "") &&
    timingSafeEqual(Buffer.from(suppliedSignature, "hex"), Buffer.from(expectedSignature, "hex"));
}

export function requireAuth(request, response) {
  if (isAuthenticated(request)) return true;
  response.status(401).setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify({ error: "برای استفاده از سامانه ابتدا وارد شوید." }));
  return false;
}
