import { describe, expect, it } from "vitest";
import { banProblem, decisionsFor, isContentType, isDecisionFor, snippet, tallyReasons } from "./admin-rules";

describe("decisionsFor", () => {
  it("offers hide and delete for content", () => {
    for (const t of ["post", "comment", "quest", "take"] as const) expect(decisionsFor(t)).toEqual(["dismiss", "hide", "delete"]);
  });
  it("offers ban, not hide or delete, for a person", () => {
    expect(decisionsFor("user")).toEqual(["dismiss", "ban"]);
    expect(isDecisionFor("user", "delete")).toBe(false);
    expect(isDecisionFor("post", "ban")).toBe(false);
    expect(isDecisionFor("post", "hide")).toBe(true);
    expect(isDecisionFor("post", "nuke")).toBe(false);
  });
  it("knows what counts as content", () => {
    expect(isContentType("take")).toBe(true);
    expect(isContentType("user")).toBe(false);
  });
});

describe("tallyReasons", () => {
  it("counts repeats in picker order, and names reports without a reason", () => {
    expect(tallyReasons(["other", "spam", null, "spam", "harassment"])).toBe("spam ×2, harassment, other, no reason");
  });
  it("handles one reason", () => {
    expect(tallyReasons(["inappropriate"])).toBe("inappropriate");
  });
});

describe("snippet", () => {
  it("squashes whitespace and leaves short text alone", () => {
    expect(snippet("  hello\n\n  there  ")).toBe("hello there");
  });
  it("cuts long text at a word with an ellipsis", () => {
    const out = snippet("one two three four five six seven eight nine ten", 20);
    expect(out.length).toBeLessThanOrEqual(20);
    expect(out).toBe("one two three four…");
  });
  it("cuts mid-word when there's no sensible space", () => {
    expect(snippet("a".repeat(50), 10)).toBe(`${"a".repeat(9)}…`);
  });
});

describe("banProblem", () => {
  const admins = (u: string) => u === "boss";
  it("refuses banning yourself or an admin", () => {
    expect(banProblem({ id: "1", username: "boss" }, { id: "1" }, admins)).toMatch(/yourself/);
    expect(banProblem({ id: "2", username: "boss" }, { id: "1" }, admins)).toMatch(/Admins/);
  });
  it("allows anyone else", () => {
    expect(banProblem({ id: "3", username: "someone" }, { id: "1" }, admins)).toBeNull();
  });
});
