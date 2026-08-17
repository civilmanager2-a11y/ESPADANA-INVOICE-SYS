import { getDatabase } from "./_db.js";
import { allowRequest, isValidMobile, normalizeMobile, readJsonBody, sendJson } from "./_utils.js";

export default async function handler(request, response) {
  if (!allowRequest(request, response, ["POST", "OPTIONS"])) return;
  if (request.method !== "POST") return sendJson(response, 405, { error: "Method not allowed" });

  try {
    const body = await readJsonBody(request);
    const mobile = normalizeMobile(body.mobile);
    if (!isValidMobile(mobile)) return sendJson(response, 400, { error: "شماره موبایل معتبر نیست." });

    const sql = getDatabase();
    const rows = await sql`
      INSERT INTO app_users (mobile, last_seen_at)
      VALUES (${mobile}, now())
      ON CONFLICT (mobile) DO UPDATE SET last_seen_at = now()
      RETURNING mobile, created_at
    `;
    return sendJson(response, 200, { user: rows[0] });
  } catch (error) {
    console.error("users_api_error", error);
    return sendJson(response, 500, { error: "ثبت شماره موبایل انجام نشد." });
  }
}
