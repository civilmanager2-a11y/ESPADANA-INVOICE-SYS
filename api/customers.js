import { getDatabase } from "./_db.js";
import { requireAuth } from "./_auth.js";
import { allowRequest, normalizeName, normalizeNationalId, sendJson } from "./_utils.js";

export default async function handler(request, response) {
  if (!allowRequest(request, response, ["GET", "OPTIONS"])) return;
  if (request.method !== "GET") return sendJson(response, 405, { error: "Method not allowed" });
  if (!requireAuth(request, response)) return;

  const rawQuery = String(request.query?.q ?? "").trim().slice(0, 100);
  if (rawQuery.length < 2) return sendJson(response, 200, { customers: [] });

  try {
    const nameQuery = normalizeName(rawQuery);
    const nationalIdQuery = normalizeNationalId(rawQuery);
    const sql = getDatabase();
    const rows = await sql`
      SELECT id, name, economic_number AS eco, national_id AS natid,
             province AS prov, city, postal_code AS postal, address AS addr, phone
      FROM customers
      WHERE normalized_name ILIKE ${`%${nameQuery}%`}
         OR (${nationalIdQuery} <> '' AND normalized_national_id LIKE ${`%${nationalIdQuery}%`})
      ORDER BY
        CASE WHEN normalized_national_id = ${nationalIdQuery} AND ${nationalIdQuery} <> '' THEN 0 ELSE 1 END,
        updated_at DESC
      LIMIT 10
    `;
    return sendJson(response, 200, { customers: rows });
  } catch (error) {
    console.error("customers_api_error", error);
    return sendJson(response, 500, { error: "جست‌وجوی مشتری انجام نشد." });
  }
}
