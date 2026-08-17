const MOBILE_PATTERN = /^09\d{9}$/;

export function normalizeDigits(value = "") {
  const persian = "۰۱۲۳۴۵۶۷۸۹";
  const arabic = "٠١٢٣٤٥٦٧٨٩";
  return String(value)
    .replace(/[۰-۹]/g, (digit) => String(persian.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(arabic.indexOf(digit)));
}

export function normalizeMobile(value = "") {
  return normalizeDigits(value).replace(/\D/g, "");
}

export function isValidMobile(value) {
  return MOBILE_PATTERN.test(normalizeMobile(value));
}

export function normalizeName(value = "") {
  return String(value)
    .trim()
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("fa-IR");
}

export function normalizeNationalId(value = "") {
  return normalizeDigits(value).replace(/\D/g, "");
}

export function cleanText(value, maxLength = 500) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function sendJson(response, status, payload) {
  response.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(payload));
}

export function allowRequest(request, response, methods) {
  const origin = request.headers.origin;
  const allowedOrigins = new Set([
    "https://civilmanager2-a11y.github.io",
    process.env.APP_ORIGIN,
  ].filter(Boolean));

  if (origin && allowedOrigins.has(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
  }
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Access-Control-Allow-Methods", methods.join(", "));

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return false;
  }
  return true;
}

export async function readJsonBody(request) {
  if (request.body && typeof request.body === "object") return request.body;
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 1_000_000) throw new Error("PAYLOAD_TOO_LARGE");
  }
  return body ? JSON.parse(body) : {};
}

export function validateInvoiceInput(input) {
  const issuerMobile = normalizeMobile(input?.issuerMobile);
  const invoice = input?.invoice ?? {};
  const name = cleanText(invoice.name, 200);
  const items = Array.isArray(invoice.items) ? invoice.items.slice(0, 100) : [];

  if (!isValidMobile(issuerMobile)) return { error: "شماره موبایل اقدام‌کننده معتبر نیست." };
  if (!name) return { error: "نام خریدار الزامی است." };
  if (!items.length) return { error: "حداقل یک ردیف کالا یا خدمات الزامی است." };

  const safeItems = items.map((item, index) => {
    const qty = Number(item?.qty) || 0;
    const price = Number(item?.price) || 0;
    const total = qty * price;
    const discount = Math.max(0, Math.min(Number(item?.discount) || 0, total));
    const afterDisc = total - discount;
    const vat = afterDisc * 0.1;
    return {
      row: index + 1,
      desc: cleanText(item?.desc, 500),
      unit: cleanText(item?.unit, 50),
      qty,
      price,
      total,
      discount,
      afterDisc,
      vat,
      payable: afterDisc + vat,
    };
  });

  if (safeItems.some((item) => !item.desc || item.qty <= 0 || item.price <= 0)) {
    return { error: "شرح، مقدار و مبلغ همه ردیف‌ها باید معتبر باشند." };
  }
  const summary = safeItems.reduce((result, item) => ({
    subtotal: result.subtotal + item.total,
    discount: result.discount + item.discount,
    afterDisc: result.afterDisc + item.afterDisc,
    vat: result.vat + item.vat,
    total: result.total + item.payable,
  }), { subtotal: 0, discount: 0, afterDisc: 0, vat: 0, total: 0 });

  const customer = {
    name,
    eco: cleanText(invoice.eco, 50),
    natid: cleanText(invoice.natid, 50),
    prov: cleanText(invoice.prov, 100),
    city: cleanText(invoice.city, 100),
    postal: cleanText(invoice.postal, 20),
    addr: cleanText(invoice.addr, 1000),
    phone: cleanText(invoice.phone, 50),
  };
  const normalizedName = normalizeName(customer.name);
  const normalizedNationalId = normalizeNationalId(customer.natid);

  return {
    value: {
      issuerMobile,
      customer,
      customerKey: normalizedNationalId ? `nat:${normalizedNationalId}` : `name:${normalizedName}`,
      normalizedName,
      normalizedNationalId,
      invoice: {
        date: cleanText(invoice.date, 20),
        notes: cleanText(invoice.notes, 2000),
        shippingTerms: cleanText(invoice.shippingTerms, 1000),
        validityTerms: cleanText(invoice.validityTerms, 1000),
        items: safeItems,
        ...summary,
      },
    },
  };
}
