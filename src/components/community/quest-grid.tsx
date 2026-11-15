"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { BoardQuest } from "@/lib/community";
import { Icon } from "@/components/icon";
import { askToSignIn, useQuestActions } from "./community-provider";
import { QuestNote, useQuestDialogs } from "./quests";
import "./community.css";

const SIGNED_IN = { username: "", name: "", avatar: null, admin: false };

/** Every quest on one tab of the quests page, as a wall of notes. */
export function QuestGrid({ initial, signedIn, empty }: { initial: BoardQuest[]; signedIn: boolean; empty: string }) {
  const router = useRouter();
  const [quests, setQuests] = useState<BoardQuest[] | null>(initial);
  // the server's next copy wins
  useEffect(() => setQuests(initial), [initial]);
  const { join } = useQuestActions(setQuests, signedIn ? SIGNED_IN : null);
  const d = useQuestDialogs(() => router.refresh());
  const post = () => (signedIn ? d.post() : askToSignIn("post a quest"));

  return (
    <>
      <div className="quest-grid">
        <button className="quest-empty quest-grid-post" onClick={post}>
          <Icon name="add" size={22} />
          <span className="font-extrabold text-foreground">Post a quest</span>
          <span>{quests?.length ? "Challenge everyone" : empty}</span>
        </button>
        {quests?.map((q) => (
          <QuestNote key={q.id} quest={q} onJoin={join} onOpen={d.open} />
        ))}
      </div>
      {d.dialogs}
    </>
  );
}
