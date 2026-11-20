"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { scheduleQuestion } from "@/app/actions/admin";
import { btnPrimary, inputCls } from "@/components/ui";
import { toast } from "@/components/toaster";

/** Put a question on the wall for a given day. Days without one use the built-in bank. */
export function QuestionForm({ today }: { today: string }) {
  const router = useRouter();
  const [day, setDay] = useState(today);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await scheduleQuestion({ day, question, options });
      if (res.error) return toast(res.error, "error");
      toast(`Scheduled for ${day}`);
      setQuestion("");
      setOptions(["", "", "", ""]);
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="panel flex flex-col gap-3 p-5">
      <h2 className="font-extrabold">Schedule a question</h2>
      <input type="date" min={today} value={day} onChange={(e) => setDay(e.target.value)} className={inputCls} aria-label="Day" required />
      <input
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        maxLength={120}
        placeholder="The question"
        aria-label="Question"
        className={inputCls}
        required
      />
      <div className="grid grid-cols-2 gap-2">
        {options.map((o, i) => (
          <input
            key={i}
            value={o}
            maxLength={40}
            onChange={(e) => setOptions((os) => os.map((x, j) => (j === i ? e.target.value : x)))}
            placeholder={`Option ${i + 1}${i >= 2 ? " (optional)" : ""}`}
            aria-label={`Option ${i + 1}`}
            className={inputCls}
            required={i < 2}
          />
        ))}
      </div>
      <button disabled={pending} className={`${btnPrimary} h-10 self-end text-sm`}>
        {pending ? "Saving…" : "Schedule"}
      </button>
    </form>
  );
}
