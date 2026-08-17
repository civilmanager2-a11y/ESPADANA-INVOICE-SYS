import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  createSessionCookie,
  isAuthenticated,
  passwordMatches,
} from "../api/_auth.js";

test("fixed password creates a valid server-side session", () => {
  const previous = process.env.APP_PASSWORD;
  process.env.APP_PASSWORD = "test-password-123";
  try {
    assert.equal(passwordMatches("test-password-123"), true);
    assert.equal(passwordMatches("wrong-password"), false);

    const cookie = createSessionCookie();
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /Secure/);
    assert.match(cookie, /SameSite=Strict/);
    assert.equal(isAuthenticated({ headers: { cookie } }), true);

    const tampered = cookie.replace(/espadana_session=([^;])/, "espadana_session=x$1");
    assert.equal(isAuthenticated({ headers: { cookie: tampered } }), false);
  } finally {
    if (previous === undefined) delete process.env.APP_PASSWORD;
    else process.env.APP_PASSWORD = previous;
  }
});

test("both application pages contain a syntactically valid login gate", () => {
  for (const filename of ["index.html", "espadana.html"]) {
    const html = fs.readFileSync(new URL(`../${filename}`, import.meta.url), "utf8");
    assert.match(html, /id="login-modal"/);
    assert.match(html, /initializeApp\(\)/);
    const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
    assert.ok(scripts.length > 0);
    for (const [, source] of scripts) new Function(source);
  }
});

test("print preview prepares transparent seller marks for Android printing", () => {
  let createLayout;
  for (const filename of ["index.html", "espadana.html"]) {
    const html = fs.readFileSync(new URL(`../${filename}`, import.meta.url), "utf8");
    assert.match(html, /onclick="printInvoice\(\)"/);
    assert.match(html, /signature-left/);
    assert.match(html, /signature-right/);
    assert.match(html, /name:'overlap'/);
    assert.match(html, /seller-stamp \{ width:3cm!important; height:3cm!important/);
    assert.match(html, /await waitForPrintImages\(\)/);
    assert.match(html, /applySellerMarkLayout\(inv\)/);
    const source = html.match(/(function createSellerMarkLayout\(serial\)\{[\s\S]*?\n\})\nfunction applySellerMarkLayout/);
    assert.ok(source);
    createLayout ||= new Function(`${source[1]}; return createSellerMarkLayout;`)();
  }

  const layouts = Array.from({ length: 15 }, (_, index) => createLayout(380 + index));
  assert.equal(new Set(layouts.map((layout) => layout.mode)).size, 3);
  assert.deepEqual(createLayout(381), createLayout(381));

  for (const filename of ["stamp-print.png", "signature-print.png"]) {
    const image = fs.readFileSync(new URL(`../assets/${filename}`, import.meta.url));
    assert.deepEqual([...image.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  }
});
