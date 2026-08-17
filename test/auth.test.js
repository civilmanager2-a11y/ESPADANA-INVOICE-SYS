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
