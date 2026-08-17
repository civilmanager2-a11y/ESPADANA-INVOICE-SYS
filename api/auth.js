import {
  clearSessionCookie,
  createSessionCookie,
  isAuthenticated,
  isPasswordConfigured,
  passwordMatches,
} from "./_auth.js";
import { allowRequest, readJsonBody, sendJson } from "./_utils.js";

export default async function handler(request, response) {
  if (!allowRequest(request, response, ["GET", "POST", "DELETE", "OPTIONS"])) return;

  if (request.method === "GET") {
    return sendJson(response, 200, {
      authenticated: isAuthenticated(request),
      configured: isPasswordConfigured(),
    });
  }

  if (request.method === "DELETE") {
    response.setHeader("Set-Cookie", clearSessionCookie());
    return sendJson(response, 200, { authenticated: false });
  }

  if (request.method !== "POST") return sendJson(response, 405, { error: "Method not allowed" });
  if (!isPasswordConfigured()) return sendJson(response, 503, { error: "رمز ورود سامانه روی سرور تنظیم نشده است." });

  try {
    const body = await readJsonBody(request);
    if (!passwordMatches(body.password)) return sendJson(response, 401, { error: "رمز ورود نادرست است." });
    response.setHeader("Set-Cookie", createSessionCookie());
    return sendJson(response, 200, { authenticated: true });
  } catch (error) {
    console.error("auth_api_error", error);
    return sendJson(response, 400, { error: "درخواست ورود معتبر نیست." });
  }
}
