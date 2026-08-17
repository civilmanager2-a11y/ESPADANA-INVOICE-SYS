import { getDatabase } from "./_db.js";
import { sendJson } from "./_utils.js";

export default async function handler(_request, response) {
  try {
    const sql = getDatabase();
    const result = await sql`SELECT true AS database_connected`;
    return sendJson(response, 200, { ok: true, databaseConnected: result[0].database_connected });
  } catch (error) {
    console.error("health_api_error", error);
    return sendJson(response, 503, { ok: false, databaseConnected: false });
  }
}
