import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  isValidMobile,
  normalizeDigits,
  normalizeMobile,
  normalizeName,
  normalizeNationalId,
  validateInvoiceInput,
} from "../api/_utils.js";

test("normalizes Persian and Arabic digits", () => {
  assert.equal(normalizeDigits("۰۱۲٣٤۵"), "012345");
  assert.equal(normalizeMobile("۰۹۱۲-۳۴۵-۶۷۸۹"), "09123456789");
  assert.equal(normalizeNationalId("۱۴۰۰-۴۶۲۹۵۸۳"), "14004629583");
});

test("validates Iranian mobile numbers", () => {
  assert.equal(isValidMobile("09123456789"), true);
  assert.equal(isValidMobile("9123456789"), false);
});

test("normalizes Persian customer names", () => {
  assert.equal(normalizeName("  شركت  ياس  "), "شرکت یاس");
});

test("accepts a complete invoice and rejects missing items", () => {
  const base = {
    issuerMobile: "09123456789",
    invoice: {
      name: "شرکت نمونه",
      natid: "14000000000",
      items: [{ desc: "پنل خورشیدی", qty: 2, price: 1000 }],
    },
  };
  const validated = validateInvoiceInput(base).value;
  assert.equal(validated.customerKey, "nat:14000000000");
  assert.equal(validated.invoice.total, 2200);
  assert.match(validateInvoiceInput({ ...base, invoice: { ...base.invoice, items: [] } }).error, /حداقل/);
});

test("database schema starts invoice numbering at 380", () => {
  const schema = fs.readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");
  assert.match(schema, /invoice_number\s+bigint[^\n]*START WITH 380/);
});
