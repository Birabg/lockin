import { describe, expect, it } from "vitest";
import { EMAIL_ERRORS, checkMailDomain, checkNewEmail, isDisposableDomain, isValidEmail } from "./email-domain";

const dnsError = (code: string) => Object.assign(new Error(code), { code });

/** A fake resolver: each record type maps to an answer, or to an error code. */
function resolver(answers: {
  mx?: { exchange: string; priority: number }[] | string;
  a?: string[] | string;
  aaaa?: string[] | string;
  delayMs?: number;
}) {
  const answer = <T>(v: T | string | undefined): Promise<T> =>
    new Promise((resolve, reject) =>
      setTimeout(() => {
        if (v === undefined) reject(dnsError("ENODATA"));
        else if (typeof v === "string") reject(dnsError(v));
        else resolve(v);
      }, answers.delayMs ?? 0),
    );
  return {
    resolveMx: () => answer(answers.mx),
    resolve4: () => answer(answers.a),
    resolve6: () => answer(answers.aaaa),
  };
}

describe("isValidEmail", () => {
  it("accepts ordinary addresses", () => {
    expect(isValidEmail("abel@gmail.com")).toBe(true);
    expect(isValidEmail("a.b+focus@sub.example.org")).toBe(true);
  });
  it("rejects malformed ones", () => {
    for (const bad of ["", "abel", "abel@", "@gmail.com", "abel@gmail", "a b@gmail.com", "abel@@gmail.com", `${"a".repeat(250)}@x.com`]) {
      expect(isValidEmail(bad), bad).toBe(false);
    }
  });
});

describe("isDisposableDomain", () => {
  it("catches well-known throwaway domains and their subdomains", () => {
    expect(isDisposableDomain("mailinator.com")).toBe(true);
    expect(isDisposableDomain("10minutemail.com")).toBe(true);
    expect(isDisposableDomain("guerrillamail.com")).toBe(true);
    expect(isDisposableDomain("inbox.mailinator.com")).toBe(true);
    expect(isDisposableDomain("MAILINATOR.COM")).toBe(true);
  });
  it("lets real providers through", () => {
    for (const ok of ["gmail.com", "outlook.com", "proton.me", "astu.edu.et", "com"]) expect(isDisposableDomain(ok), ok).toBe(false);
  });
});

describe("checkMailDomain", () => {
  it("is ok with MX records", async () => {
    expect(await checkMailDomain("x.com", resolver({ mx: [{ exchange: "mx.x.com", priority: 10 }] }))).toBe("ok");
  });

  it("treats a null MX as no mail (RFC 7505)", async () => {
    expect(await checkMailDomain("x.com", resolver({ mx: [{ exchange: "", priority: 0 }], a: ["1.2.3.4"] }))).toBe("no-mail");
  });

  it("falls back to an A or AAAA record when there's no MX", async () => {
    expect(await checkMailDomain("x.com", resolver({ a: ["1.2.3.4"] }))).toBe("ok");
    expect(await checkMailDomain("x.com", resolver({ aaaa: ["::1"] }))).toBe("ok");
  });

  it("is no-mail when the domain doesn't exist or has no records at all", async () => {
    expect(await checkMailDomain("nope.invalid", resolver({ mx: "ENOTFOUND" }))).toBe("no-mail");
    expect(await checkMailDomain("x.com", resolver({}))).toBe("no-mail");
  });

  it("is unknown (so signup is allowed) when DNS itself fails", async () => {
    expect(await checkMailDomain("x.com", resolver({ mx: "ESERVFAIL" }))).toBe("unknown");
    expect(await checkMailDomain("x.com", resolver({ mx: "ECONNREFUSED" }))).toBe("unknown");
    expect(await checkMailDomain("x.com", resolver({ a: "ETIMEOUT" }))).toBe("unknown");
  });

  it("gives up after the timeout and calls it unknown", async () => {
    const started = Date.now();
    expect(await checkMailDomain("x.com", resolver({ mx: [{ exchange: "mx", priority: 1 }], delayMs: 500 }), 50)).toBe("unknown");
    expect(Date.now() - started).toBeLessThan(400);
  });
});

describe("checkNewEmail", () => {
  const good = resolver({ mx: [{ exchange: "mx", priority: 1 }] });

  it("normalizes a good address", async () => {
    expect(await checkNewEmail("  Abel@Gmail.com ", { resolver: good, env: {} })).toEqual({ ok: true, email: "abel@gmail.com" });
  });

  it("rejects bad formats before any lookup", async () => {
    expect(await checkNewEmail("abel@", { resolver: good, env: {} })).toEqual({ ok: false, error: EMAIL_ERRORS.format });
  });

  it("rejects disposable domains", async () => {
    expect(await checkNewEmail("x@mailinator.com", { resolver: good, env: {} })).toEqual({ ok: false, error: EMAIL_ERRORS.disposable });
  });

  it("rejects domains that can't receive mail, with a suggestion when it looks like a typo", async () => {
    const none = resolver({ mx: "ENOTFOUND" });
    expect(await checkNewEmail("x@nowhere-at-all.invalid", { resolver: none, env: {} })).toEqual({ ok: false, error: EMAIL_ERRORS.noMail });
    expect(await checkNewEmail("x@gmail.co", { resolver: none, env: {} })).toEqual({
      ok: false,
      error: EMAIL_ERRORS.noMail,
      suggestion: "x@gmail.com",
    });
  });

  it("offers the fix when a typo'd domain is also a throwaway one", async () => {
    // gmial.com is on the disposable list
    expect(await checkNewEmail("x@gmial.com", { resolver: good, env: {} })).toEqual({
      ok: false,
      error: EMAIL_ERRORS.disposable,
      suggestion: "x@gmail.com",
    });
  });

  it("allows the address when DNS is down", async () => {
    expect(await checkNewEmail("x@company.io", { resolver: resolver({ mx: "ESERVFAIL" }), env: {} })).toEqual({
      ok: true,
      email: "x@company.io",
    });
  });

  it("skips DNS for test domains, but still blocks disposable ones", async () => {
    const env = { EMAIL_TEST_DOMAINS: "example.com, mailinator.com" };
    const none = resolver({ mx: "ENOTFOUND" });
    expect(await checkNewEmail("x@example.com", { resolver: none, env })).toEqual({ ok: true, email: "x@example.com" });
    expect((await checkNewEmail("x@mailinator.com", { resolver: none, env })).ok).toBe(false);
  });
});
