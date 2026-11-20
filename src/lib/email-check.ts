/**
 * Email helpers that don't need the network, shared by the signup form (typo hints) and the server.
 * Kept dependency-free for the browser; the format, DNS and disposable-domain checks live in email-domain.ts.
 */

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export function domainOf(email: string): string {
  return email.slice(email.lastIndexOf("@") + 1);
}

/** Popular mailbox providers. A domain one or two typos away from one of these gets a "Did you mean" hint. */
export const COMMON_DOMAINS = [
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "ymail.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "gmx.com",
  "mail.com",
  "yandex.com",
  "zoho.com",
  "hotmail.co.uk",
  "yahoo.co.uk",
  "outlook.fr",
  "hotmail.fr",
  "yahoo.fr",
  "web.de",
  "gmx.de",
  "gmx.net",
  "outlook.de",
  "hotmail.de",
  "yahoo.de",
  "live.co.uk",
  "yahoo.ca",
  "hotmail.it",
  "yahoo.in",
  "qq.com",
  "163.com",
  "naver.com",
];

/** Edit distance where swapping two neighbouring letters counts as one edit ("gmial" → "gmail"). */
export function editDistance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

/**
 * "name@gmial.com" → "name@gmail.com", or null when the domain looks fine.
 * Only suggests, never blocks: plenty of real domains are one letter off a popular one.
 */
export function suggestEmail(raw: string): string | null {
  const email = normalizeEmail(raw);
  const at = email.lastIndexOf("@");
  if (at < 1) return null;
  const domain = email.slice(at + 1);
  if (!domain || COMMON_DOMAINS.includes(domain)) return null;
  // short domains need a closer match, so "aol.co" → "aol.com" but "abc.io" isn't dragged anywhere
  const maxEdits = domain.length <= 7 ? 1 : 2;
  let best: { domain: string; dist: number } | null = null;
  for (const candidate of COMMON_DOMAINS) {
    const dist = editDistance(domain, candidate);
    if (dist <= maxEdits && (!best || dist < best.dist)) best = { domain: candidate, dist };
  }
  return best ? `${email.slice(0, at)}@${best.domain}` : null;
}
