"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  deleteTake as deleteTakeAction,
  joinQuest,
  leaveQuest,
  loadQuestBoard,
  loadWall,
  postTake as postTakeAction,
  reactToTake,
  report as reportAction,
  vote as voteAction,
  type Viewer,
} from "@/app/actions/community";
import type { BoardQuest, WallQuestion, WallSort, WallTake } from "@/lib/community";
import { toast } from "@/components/toaster";

const POLL_MS = 30_000;

/* ---------------- Asking guests to sign in ---------------- */

let guestAsk: string | null = null;
const guestListeners = new Set<() => void>();
const setGuestAsk = (v: string | null) => {
  guestAsk = v;
  guestListeners.forEach((l) => l());
};
/** Open the "sign in to join in" prompt. `what` finishes the sentence "Sign in to …". */
export const askToSignIn = (what: string) => setGuestAsk(what);
export const closeSignIn = () => setGuestAsk(null);
export function useGuestAsk() {
  return useSyncExternalStore(
    (fn) => {
      guestListeners.add(fn);
      return () => guestListeners.delete(fn);
    },
    () => guestAsk,
    () => null,
  );
}

/* ---------------- Polling while the tab is visible ---------------- */

export function usePoll(fn: () => void, ms = POLL_MS, enabled = true) {
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  });
  useEffect(() => {
    if (!enabled) return;
    const tick = () => document.visibilityState === "visible" && ref.current();
    const id = setInterval(tick, ms);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [ms, enabled]);
}

/* ---------------- Quests ---------------- */

export type QuestState = {
  quests: BoardQuest[] | null;
  total: number;
  viewer: Viewer;
  failed: boolean;
  reload: () => Promise<void>;
  join: (id: string) => Promise<void>;
  leave: (id: string) => Promise<void>;
};

/** Optimistic join and leave for any list of quests: the change shows at once and rolls back with a toast if the server says no. */
export function useQuestActions(
  setQuests: (fn: (qs: BoardQuest[] | null) => BoardQuest[] | null) => void,
  viewer: Viewer,
  busyRef?: React.RefObject<number>,
) {
  const patch = useCallback(
    (id: string, joined: boolean) =>
      setQuests(
        (qs) =>
          qs?.map((q) =>
            q.id !== id
              ? q
              : {
                  ...q,
                  joinCount: Math.max(0, q.joinCount + (joined ? 1 : -1)),
                  me: joined ? { joined: true, progressSec: 0, progressSessions: 0, completedAt: null } : null,
                  ...(q.type === "solo" ? { progressSec: 0, progressSessions: 0, done: false } : {}),
                },
          ) ?? null,
      ),
    [setQuests],
  );
  const run = useCallback(
    async (id: string, joined: boolean) => {
      if (!viewer) return askToSignIn(joined ? "join quests" : "leave quests");
      if (busyRef) busyRef.current++;
      patch(id, joined);
      try {
        const res = await (joined ? joinQuest(id) : leaveQuest(id));
        if (res.error) {
          patch(id, !joined);
          toast(res.error, "error");
        }
      } catch {
        patch(id, !joined);
        toast("Couldn't reach the server. Try again.", "error");
      } finally {
        if (busyRef) busyRef.current--;
      }
    },
    [viewer, patch, busyRef],
  );
  return { join: (id: string) => run(id, true), leave: (id: string) => run(id, false) };
}

function useQuestState(enabled: boolean, limit: number): QuestState {
  const [data, setData] = useState<{ quests: BoardQuest[] | null; total: number; viewer: Viewer }>({
    quests: null,
    total: 0,
    viewer: null,
  });
  const [failed, setFailed] = useState(false);
  const busy = useRef(0);

  const reload = useCallback(async () => {
    try {
      const res = await loadQuestBoard(limit);
      if (busy.current === 0) setData(res);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [limit]);

  useEffect(() => {
    if (enabled) void reload();
  }, [enabled, reload]);
  usePoll(reload, POLL_MS, enabled);

  const setQuests = useCallback(
    (fn: (qs: BoardQuest[] | null) => BoardQuest[] | null) => setData((d) => ({ ...d, quests: fn(d.quests) })),
    [],
  );
  const { join, leave } = useQuestActions(setQuests, data.viewer, busy);
  return { ...data, failed, reload, join, leave };
}

/* ---------------- The wall ---------------- */

export type WallState = {
  question: WallQuestion | null;
  takes: WallTake[] | null;
  hasMore: boolean;
  viewer: Viewer;
  sort: WallSort;
  failed: boolean;
  loadingMore: boolean;
  /** Takes that arrived since the last look, to slide in. */
  fresh: Set<string>;
  setSort: (s: WallSort) => void;
  more: () => Promise<void>;
  vote: (option: number) => Promise<void>;
  react: (takeId: string, value: "agree" | "disagree") => Promise<void>;
  post: (body: string) => Promise<boolean>;
  remove: (takeId: string) => Promise<void>;
  report: (takeId: string) => Promise<void>;
};

function useWallState(enabled: boolean): WallState {
  const [question, setQuestion] = useState<WallQuestion | null>(null);
  const [takes, setTakes] = useState<WallTake[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [viewer, setViewer] = useState<Viewer>(null);
  const [sort, setSortState] = useState<WallSort>("new");
  const [failed, setFailed] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const busy = useRef(0);
  const seen = useRef<Set<string> | null>(null);
  const shown = useRef(0);
  useEffect(() => {
    shown.current = takes?.length ?? 0;
  }, [takes]);

  const refresh = useCallback(async (s: WallSort, reset: boolean) => {
    try {
      const res = await loadWall(s, 0, reset ? 6 : Math.min(60, Math.max(6, shown.current)));
      if (busy.current > 0) return;
      // takes nobody has seen yet slide in; the first load and a re-sort just appear
      if (seen.current && !reset) setFresh(new Set(res.takes.filter((t) => !seen.current!.has(t.id)).map((t) => t.id)));
      else setFresh(new Set());
      seen.current = new Set(res.takes.map((t) => t.id));
      setQuestion(res.question);
      setTakes(res.takes);
      setHasMore(res.hasMore);
      setViewer(res.viewer);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    if (enabled) void refresh(sort, true);
  }, [enabled, sort, refresh]);
  usePoll(() => refresh(sort, false), POLL_MS, enabled);

  const setSort = useCallback((s: WallSort) => {
    setTakes(null);
    setSortState(s);
  }, []);

  const more = useCallback(async () => {
    setLoadingMore(true);
    try {
      const res = await loadWall(sort, shown.current);
      setTakes((ts) => {
        const have = new Set(ts?.map((t) => t.id));
        return [...(ts ?? []), ...res.takes.filter((t) => !have.has(t.id))];
      });
      res.takes.forEach((t) => seen.current?.add(t.id));
      setHasMore(res.hasMore);
    } catch {
      toast("Couldn't load more takes.", "error");
    } finally {
      setLoadingMore(false);
    }
  }, [sort]);

  /** Do something optimistic: apply it, call the server, undo it if that fails. */
  const optimistic = useCallback(async (apply: () => void, undo: () => void, call: () => Promise<{ error?: string }>) => {
    busy.current++;
    apply();
    try {
      const res = await call();
      if (res.error) {
        undo();
        toast(res.error, "error");
      }
    } catch {
      undo();
      toast("Couldn't reach the server. Try again.", "error");
    } finally {
      busy.current--;
    }
  }, []);

  const vote = useCallback(
    async (option: number) => {
      if (!viewer) return askToSignIn("vote");
      const q = question;
      if (!q || q.myVote !== null) return;
      const bump = (by: number) => (x: WallQuestion | null) =>
        x && { ...x, myVote: by > 0 ? option : null, counts: x.counts.map((c, i) => (i === option ? c + by : c)) };
      await optimistic(
        () => setQuestion(bump(1)),
        () => setQuestion(bump(-1)),
        () => voteAction(q.id, option),
      );
    },
    [viewer, question, optimistic],
  );

  const react = useCallback(
    async (takeId: string, value: "agree" | "disagree") => {
      if (!viewer) return askToSignIn("agree or disagree");
      const before = takes?.find((t) => t.id === takeId);
      if (!before) return;
      // pressing your current reaction again takes it back
      const next = before.myReaction === value ? null : value;
      const set = (t: WallTake) => setTakes((ts) => ts?.map((x) => (x.id === takeId ? t : x)) ?? null);
      const after: WallTake = {
        ...before,
        myReaction: next,
        agree: before.agree - (before.myReaction === "agree" ? 1 : 0) + (next === "agree" ? 1 : 0),
        disagree: before.disagree - (before.myReaction === "disagree" ? 1 : 0) + (next === "disagree" ? 1 : 0),
      };
      await optimistic(
        () => set(after),
        () => set(before),
        () => reactToTake(takeId, next),
      );
    },
    [viewer, takes, optimistic],
  );

  const post = useCallback(
    async (body: string) => {
      if (!viewer) {
        askToSignIn("post a hot take");
        return false;
      }
      try {
        const res = await postTakeAction(body);
        if (res.error || !res.id) {
          toast(res.error ?? "Couldn't post that.", "error");
          return false;
        }
        const take: WallTake = {
          id: res.id,
          body: body.trim(),
          createdAt: new Date(),
          author: { username: viewer.username, name: viewer.name, avatar: viewer.avatar },
          agree: 0,
          disagree: 0,
          myReaction: null,
        };
        seen.current?.add(take.id);
        setFresh(new Set([take.id]));
        setTakes((ts) => [take, ...(ts ?? [])]);
        return true;
      } catch {
        toast("Couldn't reach the server. Try again.", "error");
        return false;
      }
    },
    [viewer],
  );

  const remove = useCallback(
    async (takeId: string) => {
      const index = takes?.findIndex((t) => t.id === takeId) ?? -1;
      const before = index >= 0 ? takes![index] : null;
      if (!before) return;
      await optimistic(
        () => setTakes((ts) => ts?.filter((t) => t.id !== takeId) ?? null),
        () => setTakes((ts) => (ts ? [...ts.slice(0, index), before, ...ts.slice(index)] : ts)),
        () => deleteTakeAction(takeId),
      );
    },
    [takes, optimistic],
  );

  const report = useCallback(
    async (takeId: string) => {
      if (!viewer) return askToSignIn("report takes");
      const res = await reportAction("take", takeId).catch(() => ({ error: "Couldn't reach the server. Try again." }));
      if (res.error) return toast(res.error, "error");
      // hide it for you straight away; enough reports hide it for everyone
      setTakes((ts) => ts?.filter((t) => t.id !== takeId) ?? null);
      toast("Thanks. We'll take a look.");
    },
    [viewer],
  );

  return { question, takes, hasMore, viewer, sort, failed, loadingMore, fresh, setSort, more, vote, react, post, remove, report };
}

/* ---------------- Sharing one copy with every panel on the page ---------------- */

const QuestContext = createContext<QuestState | null>(null);
const WallContext = createContext<WallState | null>(null);

/** Fetches the quest board and the wall once for the page, apart from the feed, and keeps them fresh. */
export function CommunityProvider({
  quests = false,
  wall = false,
  children,
}: {
  quests?: boolean;
  wall?: boolean;
  children: React.ReactNode;
}) {
  const questState = useQuestState(quests, 8);
  const wallState = useWallState(wall);
  return (
    <QuestContext.Provider value={quests ? questState : null}>
      <WallContext.Provider value={wall ? wallState : null}>{children}</WallContext.Provider>
    </QuestContext.Provider>
  );
}

export function useQuests() {
  const ctx = useContext(QuestContext);
  if (!ctx) throw new Error("useQuests needs <CommunityProvider quests>");
  return ctx;
}

export function useWall() {
  const ctx = useContext(WallContext);
  if (!ctx) throw new Error("useWall needs <CommunityProvider wall>");
  return ctx;
}
