"use client";

import { useEffect, useRef, useState } from "react";

export type NavItem = { id: string; label: string };

/** Jump links to each section; the one you're reading lights up as you scroll. */
export function SettingsNav({ items }: { items: NavItem[] }) {
  const [active, setActive] = useState(items[0]?.id);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      // at the very bottom the last sections can't reach the line, so the last one wins
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
        return setActive(items[items.length - 1]?.id);
      }
      let current = items[0]?.id;
      for (const i of items) {
        const el = document.getElementById(i.id);
        if (el && el.getBoundingClientRect().top <= 140) current = i.id;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [items]);

  // on phones the chips scroll sideways: keep the lit one in view
  const nav = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = nav.current;
    const link = el?.querySelector<HTMLElement>("[aria-current]");
    if (el && link && el.scrollWidth > el.clientWidth) {
      el.scrollTo({ left: link.offsetLeft - el.clientWidth / 2 + link.offsetWidth / 2, behavior: "smooth" });
    }
  }, [active]);

  return (
    <nav ref={nav} aria-label="Settings sections" className="set-nav">
      {items.map((i) => (
        <a key={i.id} href={`#${i.id}`} aria-current={active === i.id ? "true" : undefined} className="set-nav-link">
          {i.label}
        </a>
      ))}
    </nav>
  );
}
