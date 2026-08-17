import { getDatabase } from "./_db.js";
import { requireAuth } from "./_auth.js";
import {
  allowRequest,
  cleanText,
  normalizeName,
  normalizeNationalId,
  readJsonBody,
  sendJson,
  validateInvoiceInput,
} from "./_utils.js";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 50;

function queryValue(request, key) {
  const value = request.query?.[key];
  return Array.isArray(value) ? value[0] : value;
}

function positiveInteger(value, fallback, maximum = Number.MAX_SAFE_INTEGER) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, maximum);
}

export function parseInvoiceListQuery(request) {
  const page = positiveInteger(queryValue(request, "page"), 1);
  const limit = positiveInteger(queryValue(request, "limit"), DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const query = cleanText(queryValue(request, "q"), 100);
  return { page, limit, query, offset: (page - 1) * limit };
}

function invoicePayload(payload) {
  if (payload && typeof payload === "object") return payload;
  try {
    return JSON.parse(payload);
  } catch {
    return {};
  }
}

export function mapInvoiceDetail(row) {
  return {
    ...invoicePayload(row.payload),
    serial: Number(row.invoice_number),
    customerId: Number(row.customer_id),
    issuerMobile: row.issuer_mobile,
    createdAt: row.created_at,
  };
}

async function listInvoices(request, response) {
  const { page, limit, query, offset } = parseInvoiceListQuery(request);
  const normalizedQuery = normalizeName(query);
  const digitQuery = normalizeNationalId(query);
  const namePattern = `%${normalizedQuery}%`;
  const digitPattern = `%${digitQuery}%`;
  const sql = getDatabase();
  const rows = await sql`
    SELECT
      i.invoice_number,
      i.invoice_date,
      i.issuer_mobile,
      i.total,
      i.created_at,
      c.name AS customer_name,
      COALESCE(jsonb_array_length(i.payload->'items'), 0) AS item_count,
      COUNT(*) OVER() AS total_count
    FROM invoices i
    JOIN customers c ON c.id = i.customer_id
    WHERE ${normalizedQuery} = ''
       OR c.normalized_name ILIKE ${namePattern}
       OR (${digitQuery} <> '' AND (
         c.normalized_national_id LIKE ${digitPattern}
         OR i.issuer_mobile LIKE ${digitPattern}
         OR CAST(i.invoice_number AS text) = ${digitQuery}
       ))
    ORDER BY i.invoice_number DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  const total = rows.length ? Number(rows[0].total_count) : 0;
  return sendJson(response, 200, {
    invoices: rows.map((row) => ({
      serial: Number(row.invoice_number),
      date: row.invoice_date,
      name: row.customer_name,
      issuerMobile: row.issuer_mobile,
      total: Number(row.total),
      itemCount: Number(row.item_count),
      createdAt: row.created_at,
    })),
    page,
    limit,
    total,
    hasMore: offset + rows.length < total,
  });
}

async function getInvoice(request, response) {
  const rawNumber = normalizeNationalId(queryValue(request, "number"));
  if (!/^[1-9]\d*$/.test(rawNumber)) {
    return sendJson(response, 400, { error: "شماره فاکتور معتبر نیست." });
  }

  const sql = getDatabase();
  const rows = await sql`
    SELECT invoice_number, customer_id, issuer_mobile, payload, created_at
    FROM invoices
    WHERE invoice_number = ${rawNumber}
    LIMIT 1
  `;
  if (!rows.length) return sendJson(response, 404, { error: "فاکتور پیدا نشد." });
  return sendJson(response, 200, { invoice: mapInvoiceDetail(rows[0]) });
}

export default async function handler(request, response) {
  if (!allowRequest(request, response, ["GET", "POST", "OPTIONS"])) return;
  if (!requireAuth(request, response)) return;

  try {
    if (request.method === "GET") {
      return queryValue(request, "number")
        ? await getInvoice(request, response)
        : await listInvoices(request, response);
    }
    if (request.method !== "POST") return sendJson(response, 405, { error: "Method not allowed" });

    const validation = validateInvoiceInput(await readJsonBody(request));
    if (validation.error) return sendJson(response, 400, { error: validation.error });

    const { issuerMobile, customer, customerKey, normalizedName, normalizedNationalId, invoice } = validation.value;
    const payload = { ...customer, ...invoice };
    const sql = getDatabase();
    const rows = await sql`
      WITH registered_user AS (
        INSERT INTO app_users (mobile, last_seen_at)
        VALUES (${issuerMobile}, now())
        ON CONFLICT (mobile) DO UPDATE SET last_seen_at = now()
        RETURNING mobile
      ), saved_customer AS (
        INSERT INTO customers (
          customer_key, name, normalized_name, economic_number, national_id,
          normalized_national_id, province, city, postal_code, address, phone,
          created_by_mobile, updated_at
        )
        SELECT ${customerKey}, ${customer.name}, ${normalizedName}, ${customer.eco}, ${customer.natid},
               ${normalizedNationalId}, ${customer.prov}, ${customer.city}, ${customer.postal},
               ${customer.addr}, ${customer.phone}, registered_user.mobile, now()
        FROM registered_user
        ON CONFLICT (customer_key) DO UPDATE SET
          name = EXCLUDED.name,
          normalized_name = EXCLUDED.normalized_name,
          economic_number = EXCLUDED.economic_number,
          national_id = EXCLUDED.national_id,
          normalized_national_id = EXCLUDED.normalized_national_id,
          province = EXCLUDED.province,
          city = EXCLUDED.city,
          postal_code = EXCLUDED.postal_code,
          address = EXCLUDED.address,
          phone = EXCLUDED.phone,
          updated_at = now()
        RETURNING id
      )
      INSERT INTO invoices (
        customer_id, issuer_mobile, invoice_date, payload,
        shipping_terms, validity_terms, subtotal, discount, vat, total
      )
      SELECT saved_customer.id, registered_user.mobile, ${invoice.date}, ${JSON.stringify(payload)}::jsonb,
             ${invoice.shippingTerms}, ${invoice.validityTerms}, ${invoice.subtotal},
             ${invoice.discount}, ${invoice.vat}, ${invoice.total}
      FROM saved_customer CROSS JOIN registered_user
      RETURNING invoice_number, customer_id, created_at
    `;

    return sendJson(response, 201, {
      invoiceNumber: Number(rows[0].invoice_number),
      customerId: Number(rows[0].customer_id),
      createdAt: rows[0].created_at,
    });
  } catch (error) {
    console.error("invoices_api_error", error);
    return sendJson(response, 500, { error: "ثبت فاکتور در سرور انجام نشد؛ شماره‌ای تخصیص داده نشد." });
  }
}
