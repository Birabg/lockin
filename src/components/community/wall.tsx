"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import "./community.css";
import type { WallTake } from "@/lib/community";
import { TAKE_MAX, votePercents } from "@/lib/wall";
import { Icon } from "@/components/icon";
import { useWall } from "./community-provider";

/* ---------------- Question of the day ---------------- */

export function QuestionCard({ inline = false }: { inline?: boolean }) {
  const { question: q, vote, failed } = useWall();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const [focus, setFocus] = useState(0);
  const titleId = useId();
  // the bars grow from zero once results are showing
  const [grown, setGrown] = useState(false);
  const voted = q?.myVote != null;
  useEffect(() => {
    if (!voted) return setGrown(false);
    const id = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(id);
  }, [voted]);

  if (!q) {
    return (
      <div className={`wall-question ${inline ? "wall-question-inline" : ""}`} aria-busy>
        {failed ? (
          <p className="text-sm text-muted">Couldn&apos;t load today&apos;s question.</p>
        ) : (
          <div className="animate-pulse space-y-2">
            <div className="h-3 w-24 rounded bg-inset" />
            <div className="h-5 w-4/5 rounded bg-inset" />
            <div className="h-9 rounded-xl bg-inset" />
            <div className="h-9 rounded-xl bg-inset" />
          </div>
        )}
      </div>
    );
  }

  const total = q.counts.reduce((a, b) => a + b, 0);
  const pct = votePercents(q.counts);

  const onKey = (e: React.KeyboardEvent, i: number) => {
    const n = q.options.length;
    const step = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (i + step + n) % n;
    setFocus(next);
    refs.current[next]?.focus();
  };

  return (
    <section className={`wall-question ${inline ? "wall-question-inline" : ""}`} aria-labelledby={titleId}>
      <p className="wall-question-label">Question of the day</p>
      <h3 id={titleId} className="wall-question-text">
        {q.question}
      </h3>
      <div role="radiogroup" aria-labelledby={titleId} className="wall-options">
        {q.options.map((o, i) => {
          const mine = q.myVote === i;
          return (
            <button
              key={i}
              ref={(el) => {
                refs.current[i] = el;
              }}
              role="radio"
              aria-checked={mine}
              aria-disabled={voted}
              tabIndex={voted ? (mine ? 0 : -1) : i === focus ? 0 : -1}
              onKeyDown={(e) => onKey(e, i)}
              onClick={() => !voted && vote(i)}
              className={`wall-option ${voted ? "is-shown" : ""} ${mine ? "is-mine" : ""}`}
            >
              {voted && <span className="wall-option-fill" style={{ width: grown ? `${pct[i]}%` : 0 }} aria-hidden />}
              <span className="wall-option-text">
                {o}
                {mine && <span className="sr-only"> (your vote)</span>}
              </span>
              {voted && <span className="wall-option-pct">{pct[i]}%</span>}
            </button>
          );
        })}
      </div>
      <p className="wall-question-foot">
        {total} vote{total === 1 ? "" : "s"} · {voted ? "you voted" : "tap to vote"}
        {inline && (
          <Link href="/dashboard/wall" className="ml-auto font-bold text-primary">
            Hot takes →
          </Link>
        )}
      </p>
    </section>
  );
}

/* ---------------- Hot takes ---------------- */

function TakeBubble({ take: t, fresh }: { take: WallTake; fresh: boolean }) {
  const { viewer, react, remove, report } = useWall();
  const own = viewer?.username === t.author.username;
  const canDelete = own || !!viewer?.admin;
  const [menu, setMenu] = useState(false);
  const press = useRef<ReturnType<typeof setTimeout> | null>(null);
  const box = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!menu) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [menu]);

  // a long press on touch opens the menu
  const startPress = (e: React.PointerEvent) => {
    if (e.pointerType !== "touch") return;
    press.current = setTimeout(() => setMenu(true), 500);
  };
  const endPress = () => press.current && clearTimeout(press.current);

  return (
    <article
      ref={box}
      tabIndex={0}
      aria-label={`Hot take by @${t.author.username}: ${t.body}. ${t.agree} agree, ${t.disagree} disagree`}
      className={`take ${own ? "is-own" : ""} ${fresh ? "is-fresh" : ""}`}
      onPointerDown={startPress}
      onPointerUp={endPress}
      onPointerLeave={endPress}
      onContextMenu={(e) => {
        if (press.current) e.preventDefault();
      }}
    >
      <div className="take-bubble">
        <p className="take-text">“{t.body}”</p>
        <button
          className="take-menu-btn"
          aria-label="More options for this take"
          aria-haspopup="true"
          aria-expanded={menu}
          onClick={() => setMenu((v) => !v)}
        >
          <Icon name="more" size={16} />
        </button>
        {menu && (
          <div className="take-menu" role="menu">
            {canDelete && (
              <button
                role="menuitem"
                className="text-danger"
                onClick={() => {
                  setMenu(false);
                  if (confirm("Delete this take?")) void remove(t.id);
                }}
              >
                Delete
              </button>
            )}
            {!own && (
              <button
                role="menuitem"
                onClick={() => {
                  setMenu(false);
                  void report(t.id);
                }}
              >
                Report
              </button>
            )}
          </div>
        )}
      </div>
      <div className="take-foot">
        <Link href={`/dashboard/u/${t.author.username}`} className="take-author">
          @{t.author.username}
        </Link>
        <span className="flex-1" />
        <button
          className={`take-pill ${t.myReaction === "agree" ? "is-on" : ""}`}
          aria-pressed={t.myReaction === "agree"}
          aria-label={`Agree, ${t.agree}`}
          onClick={() => react(t.id, "agree")}
        >
          Agree <b>{t.agree}</b>
        </button>
        <button
          className={`take-pill ${t.myReaction === "disagree" ? "is-on" : ""}`}
          aria-pressed={t.myReaction === "disagree"}
          aria-label={`Disagree, ${t.disagree}`}
          onClick={() => react(t.id, "disagree")}
        >
          Nah <b>{t.disagree}</b>
        </button>
      </div>
    </article>
  );
}

function TakeComposer() {
  const { viewer, post } = useWall();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const left = TAKE_MAX - text.length;

  if (!open) {
    return (
      <button className="take-drop" onClick={() => setOpen(true)}>
        Drop a hot take…
      </button>
    );
  }
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    const ok = await post(text);
    setBusy(false);
    if (ok) {
      setText("");
      setOpen(false);
    }
  };
  return (
    <form className="take-compose" onSubmit={submit}>
      <label htmlFor="take-input" className="sr-only">
        Your hot take
      </label>
      <textarea
        id="take-input"
        autoFocus
        value={text}
        maxLength={TAKE_MAX}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submit(e);
        }}
        placeholder={viewer ? "Lo-fi is overrated. Fight me." : "Sign in to post a hot take"}
        rows={3}
      />
      <div className="take-compose-foot">
        <span className={`text-[12px] tabular-nums ${left < 15 ? "text-danger" : "text-subtle"}`} aria-live="polite">
          {left}
        </span>
        <span className="flex-1" />
        <button type="button" onClick={() => setOpen(false)} className="take-compose-cancel">
          Cancel
        </button>
        <button disabled={busy || !text.trim()} className="community-post-btn">
          {busy ? "Posting…" : "Post"}
        </button>
      </div>
    </form>
  );
}

function TakeSkeleton({ own = false }: { own?: boolean }) {
  return <div className={`take-skeleton ${own ? "is-own" : ""}`} aria-hidden />;
}

/* ---------------- The whole wall ---------------- */

export function TheWall({ page = false }: { page?: boolean }) {
  const { takes, hasMore, sort, setSort, more, loadingMore, fresh, failed } = useWall();
  return (
    <section aria-labelledby="wall-title" className={`community-panel ${page ? "community-page" : ""}`}>
      <header className="community-head">
        <h2 id="wall-title" className="community-title">
          The wall
        </h2>
        <span className="wall-live">
          <span className="wall-live-dot" aria-hidden />
          live
        </span>
      </header>

      <QuestionCard />

      <div className="wall-takes-head">
        <h3 className="community-sub">Hot takes</h3>
        <div className="wall-sort" role="group" aria-label="Sort takes">
          {(["new", "hot"] as const).map((s) => (
            <button key={s} aria-pressed={sort === s} onClick={() => sort !== s && setSort(s)}>
              {s === "new" ? "New" : "Hot"}
            </button>
          ))}
        </div>
      </div>

      <div className="wall-takes">
        {takes === null ? (
          failed ? (
            <p className="text-sm text-muted">Couldn&apos;t load takes.</p>
          ) : (
            <>
              <TakeSkeleton />
              <TakeSkeleton own />
              <TakeSkeleton />
            </>
          )
        ) : takes.length === 0 ? (
          <p className="wall-empty">No takes yet. Be the first to say something bold.</p>
        ) : (
          takes.map((t) => <TakeBubble key={t.id} take={t} fresh={fresh.has(t.id)} />)
        )}
      </div>
      {hasMore && takes && (
        <button onClick={more} disabled={loadingMore} className="community-more">
          {loadingMore ? "Loading…" : "See more"}
        </button>
      )}
      <TakeComposer />
    </section>
  );
}
