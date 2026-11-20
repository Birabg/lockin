import { describe, expect, it } from "vitest";
import { escapeHtml, passwordResetEmail, verificationEmail } from "./email-templates";

const site = "https://lockin.example";
const url = `${site}/verify-email?token=abc_DEF-123`;

describe("verificationEmail", () => {
  const mail = verificationEmail({ name: "Abel", url, siteUrl: site });

  it("has the link in both the html and the plain text", () => {
    expect(mail.text).toContain(url);
    expect(mail.html).toContain(`href="${url}"`);
    expect(mail.subject).toMatch(/verify/i);
  });

  it("says the link expires in 24 hours", () => {
    expect(mail.text).toContain("24 hours");
    expect(mail.html).toContain("24 hours");
  });

  it("shows the logo from the site and one button", () => {
    expect(mail.html).toContain(`src="${site}/pwa-icon/192"`);
    expect(mail.html.match(/>Verify email<\/a>/g)).toHaveLength(1);
  });

  it("escapes the person's name", () => {
    const evil = verificationEmail({ name: `<img src=x onerror="alert(1)">`, url, siteUrl: site });
    expect(evil.html).not.toContain("<img src=x");
    expect(evil.html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  it("sets its own dark colors", () => {
    expect(mail.html).toContain('name="color-scheme" content="dark"');
  });
});

describe("passwordResetEmail", () => {
  it("has the reset link and the 1 hour expiry", () => {
    const reset = `${site}/reset-password?token=xyz`;
    const mail = passwordResetEmail({ url: reset, siteUrl: site });
    expect(mail.text).toContain(reset);
    expect(mail.html).toContain(`href="${reset}"`);
    expect(mail.text).toContain("1 hour");
  });
});

describe("escapeHtml", () => {
  it("escapes the five HTML characters", () => {
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });
});
