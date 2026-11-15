"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, useTransition } from "react";
import { createQuest, deleteQuest, joinQuest, leaveQuest, loadQuestDetail, report, type NewQuest } from "@/app/actions/community";
import type { BoardQuest } from "@/lib/community";
import {
  QUEST_COLORS,
  QUEST_LENGTHS,
  QUEST_TITLE_MAX,
  endsIn,
  noteTilt,
  questColor,
  questGoalText,
  questShare,
  type QuestColor,
  type QuestLength,
} from "@/lib/quests";
import { Avatar, btnGhost, btnPrimary, inputCls } from "@/components/ui";
import { Icon } from "@/components/icon";
import { toast } from "@/components/toaster";
import { askToSignIn, useQuests } from "./community-provider";
import { Modal } from "./modal";
import "./community.css";

const mins = (sec: number) => Math.floor(sec / 60);
const fmtMin = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}` : `${m}m`);

/** "120m / 300m" or "2 / 3 sessions": whichever target the quest has, time first. */
function progressText(q: BoardQuest, sec: number, sessions: number) {
  const bits: string[] = [];
  if (q.targetMinutes) bits.push(`${fmtMin(mins(sec))} / ${fmtMin(q.targetMinutes)}`);
  if (q.targetSessions) bits.push(`${sessions} / ${q.targetSessions} sessions`);
  return bits.join(" · ");
}

const weekday = (d: Date) => new Date(d).toLocaleDateString(undefined, { weekday: "long" });

/* ---------------- One sticky note ---------------- */

type NoteProps = {
  quest: BoardQuest;
  onJoin: (id: string) => void;
  onOpen: (id: string) => void;
  size?: "board" | "strip";
};

export function QuestNote({ quest: q, onJoin, onOpen, size = "board" }: NoteProps) {
  const color = questColor(q.color);
  const joined = !!q.me;
  const showBar = q.type === "group" || joined;
  const share = questShare(q, q.progressSec, q.progressSessions);
  const ended = new Date(q.endsAt).getTime() <= Date.now();
  const goal = questGoalText(q);
  return (
    <article
      className={`quest-note ${size === "strip" ? "quest-note-strip" : ""} ${q.done ? "is-done" : ""}`}
      style={{ "--paper": color.paper, "--pin": color.pin, "--tilt": `${noteTilt(q.id)}deg` } as React.CSSProperties}
      tabIndex={0}
      role="button"
      aria-label={`Quest: ${q.title}. ${goal}, ${q.type}. Open details`}
      onClick={() => onOpen(q.id)}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(q.id);
        }
      }}
    >
      <span className="quest-pin" aria-hidden />
      {q.done && (
        <span className="quest-stamp" aria-label="Done">
          Done ✓
        </span>
      )}
      <p className="quest-title">{q.title}</p>
      <p className="quest-meta">
        by @{q.creator.username} · <span suppressHydrationWarning>{endsIn(new Date(q.endsAt))}</span>
      </p>
      <p className="quest-goal">
        <span className="quest-type">{q.type === "group" ? "Group" : "Solo"}</span> {goal}
      </p>
      {showBar && (
        <div className="quest-progress">
          <div
            className="quest-bar"
            role="progressbar"
            aria-label={q.type === "group" ? "Group progress" : "Your progress"}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(share * 100)}
          >
            <span style={{ width: `${share * 100}%` }} />
          </div>
          <p className="quest-progress-text">{progressText(q, q.progressSec, q.progressSessions)}</p>
        </div>
      )}
      <div className="quest-foot">
        <span className="quest-count">
          <b>{q.joinCount}</b> in
        </span>
        {!ended && (
          <button
            className={`quest-join ${joined ? "is-joined" : ""}`}
            aria-pressed={joined}
            aria-label={
              joined ? `Joined quest: ${q.title}. Open details to leave` : `Join quest: ${goal} before ${weekday(q.endsAt)}, ${q.title}`
            }
            onClick={(e) => {
              e.stopPropagation();
              if (joined) onOpen(q.id);
              else onJoin(q.id);
            }}
          >
            {joined ? "Joined ✓" : "Join"}
          </button>
        )}
      </div>
    </article>
  );
}

function EmptyNote({ onPost }: { onPost: () => void }) {
  return (
    <button className="quest-empty" onClick={onPost}>
      <span className="text-[15px] font-extrabold">No quests yet.</span>
      <span>Post the first challenge.</span>
    </button>
  );
}

function NoteSkeleton() {
  return <div className="quest-skeleton" aria-hidden />;
}

/* ---------------- The board (left column) and the strip (above the feed on smaller screens) ---------------- */

/** Open details, open the post form: shared by the board, the strip and the quests page. */
export function useQuestDialogs(onChange?: () => void) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  return {
    open: setOpenId,
    post: () => setPosting(true),
    dialogs: (
      <>
        {openId && <QuestDetail id={openId} onClose={() => setOpenId(null)} onChange={onChange} />}
        {posting && <PostQuest onClose={() => setPosting(false)} onPosted={onChange} />}
      </>
    ),
  };
}

export function QuestBoard() {
  const { quests, viewer, failed, reload, join } = useQuests();
  const d = useQuestDialogs(reload);
  const post = () => (viewer ? d.post() : askToSignIn("post a quest"));
  const shown = quests?.slice(0, 5);
  return (
    <section aria-labelledby="quest-board-title" className="community-panel">
      <header className="community-head">
        <h2 id="quest-board-title" className="community-title">
          Quest board
        </h2>
        <button onClick={post} className="community-post-btn">
          <Icon name="add" size={15} /> Post
        </button>
      </header>
      <div className="quest-stack">
        {quests === null ? (
          failed ? (
            <p className="text-sm text-muted">Couldn&apos;t load quests.</p>
          ) : (
            <>
              <NoteSkeleton />
              <NoteSkeleton />
              <NoteSkeleton />
            </>
          )
        ) : shown!.length === 0 ? (
          <EmptyNote onPost={post} />
        ) : (
          shown!.map((q) => <QuestNote key={q.id} quest={q} onJoin={join} onOpen={d.open} />)
        )}
      </div>
      {quests !== null && quests.length > 0 && (
        <Link href="/dashboard/quests" className="community-more">
          See all quests →
        </Link>
      )}
      {d.dialogs}
    </section>
  );
}

export function QuestStrip() {
  const { quests, viewer, reload, join } = useQuests();
  const d = useQuestDialogs(reload);
  const post = () => (viewer ? d.post() : askToSignIn("post a quest"));
  return (
    <section aria-labelledby="quest-strip-title" className="quest-strip-wrap">
      <header className="mb-1 flex items-center justify-between px-1">
        <h2 id="quest-strip-title" className="community-title">
          Quest board
        </h2>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/quests" className="text-[13px] font-bold text-muted hover:text-foreground">
            See all
          </Link>
          <button onClick={post} className="community-post-btn">
            <Icon name="add" size={15} /> Post
          </button>
        </div>
      </header>
      <div className="quest-strip" role="list">
        {quests === null ? (
          <>
            <NoteSkeleton />
            <NoteSkeleton />
          </>
        ) : quests.length === 0 ? (
          <EmptyNote onPost={post} />
        ) : (
          quests.map((q) => (
            <div role="listitem" key={q.id} className="quest-strip-item">
              <QuestNote quest={q} onJoin={join} onOpen={d.open} size="strip" />
            </div>
          ))
        )}
      </div>
      {d.dialogs}
    </section>
  );
}

/* ---------------- Detail popover ---------------- */

type Detail = NonNullable<Awaited<ReturnType<typeof loadQuestDetail>>>;

function QuestDetail({ id, onClose, onChange }: { id: string; onClose: () => void; onChange?: () => void }) {
  const [detail, setDetail] = useState<Detail | null | undefined>(undefined);
  const [pending, start] = useTransition();

  useEffect(() => {
    let live = true;
    loadQuestDetail(id)
      .then((d) => live && setDetail(d))
      .catch(() => live && setDetail(null));
    return () => {
      live = false;
    };
  }, [id]);

  const q = detail?.quest;
  const act = (fn: () => Promise<{ error?: string }>, done: string, closeAfter = false) =>
    start(async () => {
      const res = await fn().catch(() => ({ error: "Couldn't reach the server. Try again." }));
      if (res.error) return toast(res.error, "error");
      toast(done);
      onChange?.();
      if (closeAfter) onClose();
      else setDetail(await loadQuestDetail(id).catch(() => detail));
    });

  return (
    <Modal label={q ? `Quest: ${q.title}` : "Quest"} onClose={onClose}>
      {detail === undefined ? (
        <div className="space-y-3 p-1" aria-label="Loading">
          <div className="h-6 w-2/3 animate-pulse rounded bg-inset" />
          <div className="h-16 animate-pulse rounded-xl bg-inset" />
        </div>
      ) : !q ? (
        <p className="p-2 text-sm text-muted">This quest isn&apos;t around anymore.</p>
      ) : (
        <div className="quest-detail">
          <div
            className="quest-detail-paper"
            style={{ "--paper": questColor(q.color).paper, "--pin": questColor(q.color).pin } as React.CSSProperties}
          >
            <span className="quest-pin" aria-hidden />
            <h2 className="text-lg leading-tight font-extrabold">{q.title}</h2>
            <p className="quest-meta mt-1">
              by @{q.creator.username} · <span suppressHydrationWarning>{endsIn(new Date(q.endsAt))}</span>
            </p>
            {q.description && <p className="mt-2 text-[14px] leading-snug">{q.description}</p>}
          </div>

          <h3 className="quest-detail-label">Rules</h3>
          <ul className="quest-rules">
            <li>
              {q.type === "group" ? "Group: everyone's sessions add up to" : "Solo: each person aims for"} <b>{questGoalText(q)}</b>
            </li>
            {q.minSessionMin && <li>Only sessions of at least {q.minSessionMin} minutes count</li>}
            {q.tag && (
              <li>
                Only sessions labelled <b>“{q.tag}”</b> count
              </li>
            )}
            <li>
              Ends{" "}
              <span suppressHydrationWarning>
                {new Date(q.endsAt).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}
              </span>
            </li>
          </ul>

          {(q.me || q.type === "group") && (
            <>
              <h3 className="quest-detail-label">{q.type === "group" ? "Group progress" : "Your progress"}</h3>
              <div className="quest-detail-bar">
                <span style={{ width: `${questShare(q, q.progressSec, q.progressSessions) * 100}%` }} />
              </div>
              <p className="mt-1.5 text-[13px] text-muted">
                {progressText(q, q.progressSec, q.progressSessions)}
                {q.type === "group" && q.me && <> · you: {fmtMin(mins(q.me.progressSec))}</>}
                {q.done && " · done ✓"}
              </p>
            </>
          )}

          <h3 className="quest-detail-label">
            Top people <span className="font-semibold text-subtle normal-case">· {q.joinCount} in</span>
          </h3>
          {detail!.top.length === 0 ? (
            <p className="text-sm text-muted">Nobody yet.</p>
          ) : (
            <ol className="quest-people">
              {detail!.top.map((p, i) => (
                <li key={p.user.username}>
                  <span className="w-4 text-right text-[12px] font-bold text-subtle">{i + 1}</span>
                  <Avatar name={p.user.name} src={p.user.avatar} size={26} />
                  <Link
                    href={`/dashboard/u/${p.user.username}`}
                    className="min-w-0 flex-1 truncate text-[14px] font-semibold hover:underline"
                  >
                    {p.user.name}
                  </Link>
                  <span className="text-[13px] text-muted tabular-nums">
                    {fmtMin(mins(p.progressSec))}
                    {p.completedAt && " ✓"}
                  </span>
                </li>
              ))}
            </ol>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            {new Date(q.endsAt).getTime() > Date.now() &&
              (q.me ? (
                <button
                  disabled={pending}
                  onClick={() => act(() => leaveQuest(q.id), "You left the quest")}
                  className={`${btnGhost} h-10 text-sm`}
                >
                  Leave quest
                </button>
              ) : (
                <button
                  disabled={pending}
                  onClick={() => (detail!.signedIn ? act(() => joinQuest(q.id), "You're in. Go lock in!") : askToSignIn("join quests"))}
                  className={`${btnPrimary} h-10 text-sm`}
                >
                  Join quest
                </button>
              ))}
            <span className="flex-1" />
            {detail!.canDelete ? (
              <button
                disabled={pending}
                onClick={() => confirm("Delete this quest for everyone?") && act(() => deleteQuest(q.id), "Quest deleted", true)}
                className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-bold text-danger hover:bg-danger/10"
              >
                <Icon name="delete" size={16} /> Delete
              </button>
            ) : (
              <button
                disabled={pending}
                onClick={() => {
                  if (!detail!.signedIn) return askToSignIn("report quests");
                  act(() => report("quest", q.id), "Thanks. We'll take a look.", true);
                }}
                className="h-10 rounded-full px-3 text-sm font-bold text-muted hover:bg-inset hover:text-foreground"
              >
                Report
              </button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ---------------- Posting a quest ---------------- */

function PostQuest({ onClose, onPosted }: { onClose: () => void; onPosted?: () => void }) {
  const router = useRouter();
  const uid = useId();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"solo" | "group">("solo");
  const [unit, setUnit] = useState<"minutes" | "sessions">("sessions");
  const [target, setTarget] = useState("3");
  const [minLen, setMinLen] = useState("50");
  const [length, setLength] = useState<QuestLength>("3d");
  const [custom, setCustom] = useState("");
  const [color, setColor] = useState<QuestColor>("butter");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const n = Number(target);
    const min = minLen.trim() ? Number(minLen) : null;
    const input: NewQuest = {
      title,
      description,
      type,
      targetMinutes: unit === "minutes" ? n : null,
      targetSessions: unit === "sessions" ? n : null,
      minSessionMin: min,
      tag: null,
      length,
      // "Today" ends at the poster's own midnight, which only the browser knows
      customEnd:
        length === "custom" && custom
          ? new Date(custom).toISOString()
          : length === "today"
            ? new Date(new Date().setHours(23, 59, 59, 0)).toISOString()
            : null,
      color,
    };
    start(async () => {
      const res = await createQuest(input).catch(
        () => ({ error: "Couldn't reach the server. Try again." }) as { error: string; id?: string },
      );
      if (res.error) return setError(res.error);
      toast("Quest pinned to the board 📌");
      onPosted?.();
      router.refresh();
      onClose();
    });
  };

  const preview = {
    targetMinutes: unit === "minutes" ? Number(target) || null : null,
    targetSessions: unit === "sessions" ? Number(target) || null : null,
    minSessionMin: Number(minLen) || null,
  };

  return (
    <Modal label="Post a quest" onClose={onClose}>
      <form onSubmit={submit} className="quest-form">
        <h2 className="text-lg font-extrabold tracking-tight">Post a quest</h2>

        <label className="quest-field">
          <span>Challenge</span>
          <input
            className={inputCls}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={QUEST_TITLE_MAX}
            placeholder="3 deep sessions before Friday"
            required
            autoFocus
          />
          <small>
            {title.length}/{QUEST_TITLE_MAX}
          </small>
        </label>

        <fieldset className="quest-field">
          <legend>Type</legend>
          <div className="quest-seg">
            {(["solo", "group"] as const).map((t) => (
              <label key={t} className={type === t ? "is-on" : ""}>
                <input type="radio" name={`${uid}-type`} value={t} checked={type === t} onChange={() => setType(t)} className="sr-only" />
                {t === "solo" ? "Solo · everyone races" : "Group · we add up"}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="quest-field">
            <span>Target</span>
            <div className="flex gap-2">
              <input
                className={`${inputCls} w-16! shrink-0 px-3!`}
                inputMode="numeric"
                type="number"
                min={1}
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                required
                aria-label="Target amount"
              />
              <select
                className={`${inputCls} min-w-0 flex-1 px-3!`}
                value={unit}
                onChange={(e) => setUnit(e.target.value as "minutes" | "sessions")}
                aria-label="Target unit"
              >
                <option value="sessions">sessions</option>
                <option value="minutes">minutes</option>
              </select>
            </div>
          </label>
          <label className="quest-field">
            <span>Min. session (optional)</span>
            <div className="flex items-center gap-2">
              <input
                className={inputCls}
                inputMode="numeric"
                type="number"
                min={5}
                max={480}
                value={minLen}
                onChange={(e) => setMinLen(e.target.value)}
                placeholder="none"
              />
              <span className="text-sm text-muted">min</span>
            </div>
          </label>
        </div>

        <fieldset className="quest-field">
          <legend>Ends</legend>
          <div className="quest-seg">
            {(Object.keys(QUEST_LENGTHS) as QuestLength[]).map((l) => (
              <label key={l} className={length === l ? "is-on" : ""}>
                <input
                  type="radio"
                  name={`${uid}-len`}
                  value={l}
                  checked={length === l}
                  onChange={() => setLength(l)}
                  className="sr-only"
                />
                {QUEST_LENGTHS[l]}
              </label>
            ))}
          </div>
          {length === "custom" && (
            <input
              type="datetime-local"
              className={`${inputCls} mt-2`}
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              required
              aria-label="Custom end"
            />
          )}
        </fieldset>

        <fieldset className="quest-field">
          <legend>Note colour</legend>
          <div className="flex gap-2.5" role="radiogroup">
            {(Object.keys(QUEST_COLORS) as QuestColor[]).map((c) => (
              <label
                key={c}
                className="quest-swatch"
                style={{ "--paper": QUEST_COLORS[c].paper } as React.CSSProperties}
                title={QUEST_COLORS[c].name}
              >
                <input
                  type="radio"
                  name={`${uid}-color`}
                  value={c}
                  checked={color === c}
                  onChange={() => setColor(c)}
                  className="sr-only"
                  aria-label={QUEST_COLORS[c].name}
                />
                <span aria-hidden />
              </label>
            ))}
          </div>
        </fieldset>

        <label className="quest-field">
          <span>Details (optional)</span>
          <textarea
            className={`${inputCls} min-h-16 resize-none`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={200}
            placeholder="Anything people should know"
          />
        </label>

        {error && (
          <p role="alert" className="text-sm font-semibold text-danger">
            {error}
          </p>
        )}
        <div className="flex items-center gap-2 pt-1">
          <p className="flex-1 truncate text-[13px] text-muted">{questGoalText(preview) || "Set a target"}</p>
          <button type="button" onClick={onClose} className={`${btnGhost} h-10 text-sm`}>
            Cancel
          </button>
          <button disabled={pending} className={`${btnPrimary} h-10 text-sm`}>
            {pending ? "Pinning…" : "Pin it"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
