import { promises as dns } from "node:dns";
import { z } from "zod";
import disposable from "./data/disposable-domains.json";
import { domainOf, normalizeEmail, suggestEmail } from "./email-check";

// zod's email rule, plus the overall length limit from RFC 5321
const emailSchema = z.email().max(254);

export function isValidEmail(email: string): boolean {
  return emailSchema.safeParse(email).success;
}

/**
 * Server-side checks that an address can really receive mail, for signup (and any future change of email).
 * Kept free of "server-only" so tests can import it; it's only ever called from server actions.
 */

const DISPOSABLE = new Set<string>(disposable);

/** True for a throwaway-mail domain, or any subdomain of one ("x.mailinator.com"). */
export function isDisposableDomain(domain: string): boolean {
  const parts = domain.toLowerCase().split(".");
  for (let i = 0; i < parts.length - 1; i++) if (DISPOSABLE.has(parts.slice(i).join("."))) return true;
  return false;
}

export type MailDomain = "ok" | "no-mail" | "unknown";

type Resolver = {
  resolveMx: (domain: string) => Promise<{ exchange: string; priority: number }[]>;
  resolve4: (domain: string) => Promise<string[]>;
  resolve6: (domain: string) => Promise<string[]>;
};

// definite answers from DNS: the name doesn't exist, or it exists with no records of that type
const NOT_FOUND = new Set(["ENOTFOUND", "ENODATA"]);
const codeOf = (e: unknown) => (e && typeof e === "object" && "code" in e ? String(e.code) : "");

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error("timeout"), { code: "ETIMEOUT" })), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Can this domain receive mail? MX records first; with none, an A/AAAA record still counts (RFC 5321 §5.1).
 * A "null MX" (a single MX of ".") means the domain says it takes no mail (RFC 7505).
 * Anything that isn't a clear answer (timeouts, server failures) is "unknown", so real people aren't blocked by a flaky resolver.
 */
export async function checkMailDomain(domain: string, resolver: Resolver = dns, timeoutMs = 2500): Promise<MailDomain> {
  const deadline = Date.now() + timeoutMs;
  const left = () => Math.max(1, deadline - Date.now());
  try {
    const mx = await withTimeout(resolver.resolveMx(domain), left());
    if (mx.length === 1 && (mx[0].exchange === "" || mx[0].exchange === ".")) return "no-mail";
    if (mx.some((r) => r.exchange)) return "ok";
  } catch (e) {
    if (!NOT_FOUND.has(codeOf(e))) return "unknown";
    // the whole name doesn't exist, so there's no point asking for A records
    if (codeOf(e) === "ENOTFOUND") return "no-mail";
  }
  // no MX: fall back to an address record
  const results = await Promise.allSettled([
    withTimeout(resolver.resolve4(domain), left()),
    withTimeout(resolver.resolve6(domain), left()),
  ]);
  if (results.some((r) => r.status === "fulfilled" && r.value.length > 0)) return "ok";
  if (results.every((r) => r.status === "rejected" && NOT_FOUND.has(codeOf(r.reason)))) return "no-mail";
  return "unknown";
}

export const EMAIL_ERRORS = {
  format: "Enter a valid email",
  disposable: "Please use a permanent email address.",
  noMail: "This email domain can't receive mail. Check for typos.",
} as const;

export type EmailCheck = { ok: true; email: string } | { ok: false; error: string; suggestion?: string };

/** Domains that skip the DNS check, for tests (EMAIL_TEST_DOMAINS="example.com"). Never set in production. */
function testDomains(env: Record<string, string | undefined>) {
  return (env.EMAIL_TEST_DOMAINS ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

/** Everything a new address has to pass. Returns the normalized address when it's fine. */
export async function checkNewEmail(
  raw: string,
  opts: { resolver?: Resolver; env?: Record<string, string | undefined> } = {},
): Promise<EmailCheck> {
  const email = normalizeEmail(raw);
  if (!isValidEmail(email)) return { ok: false, error: EMAIL_ERRORS.format };
  const domain = domainOf(email);
  // typo'd popular domains are often registered as throwaway mail too ("gmial.com"), so offer the fix with either error
  const fail = (error: string): EmailCheck => {
    const suggestion = suggestEmail(email);
    return suggestion ? { ok: false, error, suggestion } : { ok: false, error };
  };
  if (isDisposableDomain(domain)) return fail(EMAIL_ERRORS.disposable);
  if (testDomains(opts.env ?? process.env).includes(domain)) return { ok: true, email };
  if ((await checkMailDomain(domain, opts.resolver)) === "no-mail") return fail(EMAIL_ERRORS.noMail);
  return { ok: true, email };
}
