import { getDatabase } from "./_db.js";
import { requireAuth } from "./_auth.js";
import { allowRequest, readJsonBody, sendJson, validateInvoiceInput } from "./_utils.js";

export default async function handler(request, response) {
  if (!allowRequest(request, response, ["POST", "OPTIONS"])) return;
  if (request.method !== "POST") return sendJson(response, 405, { error: "Method not allowed" });
  if (!requireAuth(request, response)) return;

  try {
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
