import { describe, expect, it } from "vitest";
import { domainOf, editDistance, normalizeEmail, suggestEmail } from "./email-check";

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Abel@Gmail.COM ")).toBe("abel@gmail.com");
  });
  it("finds the domain after the last @", () => {
    expect(domainOf("a@b@c.com")).toBe("c.com");
  });
});

describe("editDistance", () => {
  it("counts a swap of neighbouring letters as one edit", () => {
    expect(editDistance("gmial.com", "gmail.com")).toBe(1);
    expect(editDistance("gmail.co", "gmail.com")).toBe(1);
    expect(editDistance("hotnail.com", "hotmail.com")).toBe(1);
    expect(editDistance("same", "same")).toBe(0);
  });
});

describe("suggestEmail", () => {
  it.each([
    ["name@gmial.com", "name@gmail.com"],
    ["name@gmail.co", "name@gmail.com"],
    ["name@gmail.con", "name@gmail.com"],
    ["name@gamil.com", "name@gmail.com"],
    ["name@yaho.com", "name@yahoo.com"],
    ["name@hotnail.com", "name@hotmail.com"],
    ["name@outlok.com", "name@outlook.com"],
    ["Name@ICLOUD.CM", "name@icloud.com"],
  ])("%s → %s", (typo, fixed) => {
    expect(suggestEmail(typo)).toBe(fixed);
  });

  it("leaves correct and unrelated domains alone", () => {
    expect(suggestEmail("name@gmail.com")).toBeNull();
    expect(suggestEmail("name@mail.com")).toBeNull();
    expect(suggestEmail("name@astu.edu.et")).toBeNull();
    expect(suggestEmail("name@company.io")).toBeNull();
  });

  it("ignores things that aren't addresses yet", () => {
    expect(suggestEmail("")).toBeNull();
    expect(suggestEmail("name")).toBeNull();
    expect(suggestEmail("@gmial.com")).toBeNull();
    expect(suggestEmail("name@")).toBeNull();
  });
});
