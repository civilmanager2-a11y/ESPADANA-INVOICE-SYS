import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { mapInvoiceDetail, parseInvoiceListQuery } from "../api/invoices.js";

test("invoice list query uses bounded pagination and trimmed search", () => {
  assert.deepEqual(
    parseInvoiceListQuery({ query: { page: "3", limit: "500", q: "  شرکت اسپادانا  " } }),
    { page: 3, limit: 50, query: "شرکت اسپادانا", offset: 100 },
  );
  assert.deepEqual(
    parseInvoiceListQuery({ query: { page: "bad", limit: "0" } }),
    { page: 1, limit: 25, query: "", offset: 0 },
  );
});

test("database invoice payload is mapped to the printable client model", () => {
  const invoice = mapInvoiceDetail({
    invoice_number: "380",
    customer_id: "12",
    issuer_mobile: "09123456789",
    created_at: "2026-08-17T10:00:00.000Z",
    payload: { name: "خریدار نمونه", items: [{ desc: "سازه" }], total: 1000 },
  });
  assert.equal(invoice.serial, 380);
  assert.equal(invoice.customerId, 12);
  assert.equal(invoice.issuerMobile, "09123456789");
  assert.equal(invoice.name, "خریدار نمونه");
  assert.equal(invoice.items.length, 1);
});

test("web and Android-facing pages load shared invoices from the server", () => {
  for (const filename of ["index.html", "espadana.html"]) {
    const html = fs.readFileSync(new URL(`../${filename}`, import.meta.url), "utf8");
    assert.match(html, /\/api\/invoices\?page=/);
    assert.match(html, /\/api\/invoices\?number=/);
    assert.match(html, /همگام‌سازی فاکتورهای همه کاربران/);
    assert.match(html, /invoiceListState/);
    assert.doesNotMatch(html, /var list=getInvs\(\)\.slice\(\)\.reverse\(\)/);
  }
});
