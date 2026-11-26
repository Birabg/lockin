import { describe, expect, it } from "vitest";
import { emailChangeEmail, escapeHtml, nudgeEmail, passwordResetEmail, securityNoticeEmail, verificationEmail } from "./email-templates";

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
    expect(mail.html).toContain(`src="${site}/email-mark/mark"`);
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

describe("nudgeEmail", () => {
  const timer = `${site}/dashboard/timer`;
  const mail = nudgeEmail({ name: "Abel Tesfaye", actorName: "Sara Bekele", url: timer, siteUrl: site });

  it("says who nudged, in the subject, heading and text", () => {
    expect(mail.subject).toBe("Sara Bekele nudged you to lock in");
    expect(mail.html).toContain("Sara nudged you to lock in");
    expect(mail.text).toContain("Hey Abel, Sara Bekele thinks it's time to lock in.");
  });

  it("has one Lock in now button to the timer, in the html and the text", () => {
    expect(mail.html.match(/>Lock in now<\/a>/g)).toHaveLength(1);
    expect(mail.html).toContain(`href="${timer}"`);
    expect(mail.text).toContain(timer);
  });

  it("shows the open padlock, the logo and the nudge badge in green", () => {
    expect(mail.html).toContain("Nudge</td>");
    expect(mail.html).toContain("#4ade80");
    expect(mail.html).toContain(`src="${site}/email-mark/open"`);
    expect(mail.html).toContain(`src="${site}/email-mark/mark"`);
  });

  it("says nudges are once a day", () => {
    expect(mail.text).toContain("once a day");
  });

  it("escapes the names", () => {
    const evil = nudgeEmail({ name: "<b>x</b>", actorName: `<script>alert(1)</script>`, url: timer, siteUrl: site });
    expect(evil.html).not.toContain("<script>");
  });
});

describe("renderEmail without a hero", () => {
  it("keeps the plain emails left-aligned and blue", () => {
    const plain = verificationEmail({ name: "Abel", url, siteUrl: site });
    expect(plain.html).not.toContain("text-align:center");
    expect(plain.html).toContain("#4f8ff7");
  });
});

describe("emailChangeEmail", () => {
  const mail = emailChangeEmail({ name: "Abel", newEmail: "new@lockin.example", url, siteUrl: site });

  it("names the new address and carries the link", () => {
    expect(mail.text).toContain("new@lockin.example");
    expect(mail.text).toContain(url);
    expect(mail.html).toContain(`href="${url}"`);
    expect(mail.html.match(/>Confirm new email<\/a>/g)).toHaveLength(1);
  });

  it("escapes the new address", () => {
    const evil = emailChangeEmail({ name: "A", newEmail: `"><script>x</script>`, url, siteUrl: site });
    expect(evil.html).not.toContain("<script>x");
  });
});

describe("securityNoticeEmail", () => {
  const events = ["password-changed", "password-set", "email-change-requested", "email-changed", "signed-out-everywhere"] as const;

  it.each(events)("%s points to a password reset", (event) => {
    const mail = securityNoticeEmail({ name: "Abel", event, detail: "new@lockin.example", siteUrl: site });
    expect(mail.subject.length).toBeGreaterThan(0);
    expect(mail.text).toContain(`${site}/forgot-password`);
    expect(mail.html).toContain(`href="${site}/forgot-password"`);
  });

  it("mentions the new address on email changes", () => {
    const mail = securityNoticeEmail({ name: "Abel", event: "email-changed", detail: "new@lockin.example", siteUrl: site });
    expect(mail.text).toContain("new@lockin.example");
  });
});
