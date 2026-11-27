"use client";

import { useRef, useState, useTransition } from "react";
import { chooseBanner, saveBanner } from "@/app/actions/media";
import { toast } from "@/components/toaster";
import { btnGhost, colorFor } from "@/components/ui";
import { BANNER_PRESETS, bannerUrl, type BannerPresetId } from "@/lib/banner-presets";
import { bannerImage, uploadBlob } from "@/lib/upload";

/** The wide picture across the top of the profile: one of ours, an upload, or none (a colour wash). */
export function BannerForm({ banner, name }: { banner: string | null; name: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [picking, setPicking] = useState(false);
  // shows the pick at once; the server's answer replaces it
  const [shown, setShown] = useState<{ for: string | null; url: string | null } | null>(null);
  const current = shown && shown.for === banner ? shown.url : banner;

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    start(async () => {
      try {
        await saveBanner(await uploadBlob("banner", await bannerImage(file)));
        setPicking(false);
        toast("Banner updated");
      } catch (err) {
        toast(err instanceof Error ? err.message : "Couldn't upload that banner", "error");
      }
    });
  }

  function onPreset(id: BannerPresetId) {
    setShown({ for: banner, url: bannerUrl(id) });
    start(async () => {
      try {
        await chooseBanner(id);
      } catch (err) {
        setShown(null);
        toast(err instanceof Error ? err.message : "Couldn't set that banner", "error");
      }
    });
  }

  return (
    <div className="set-banner-wrap">
      <div
        className="set-banner"
        data-busy={pending || undefined}
        style={{
          ["--cover" as string]: colorFor(name),
          ...(current && { backgroundImage: `url(${JSON.stringify(current)})` }),
        }}
      >
        <span className="set-banner-tag">Profile banner</span>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-2">
        <input ref={input} type="file" accept="image/*" onChange={onFile} className="sr-only" aria-label="Choose a banner image" tabIndex={-1} />
        <button type="button" onClick={() => input.current?.click()} disabled={pending} className={`${btnGhost} h-9 px-3.5 text-[13px]`}>
          {pending ? "Saving…" : "Upload banner"}
        </button>
        <button
          type="button"
          onClick={() => setPicking((v) => !v)}
          aria-expanded={picking}
          aria-controls="banner-presets"
          className={`${btnGhost} h-9 px-3.5 text-[13px]`}
        >
          {picking ? "Done" : "Pick a banner"}
        </button>
        {current && (
          <button
            type="button"
            onClick={() => {
              setShown({ for: banner, url: null });
              start(() => saveBanner(null));
            }}
            disabled={pending}
            className={`${btnGhost} h-9 px-3.5 text-[13px]`}
          >
            Remove
          </button>
        )}
      </div>

      {picking && (
        <div id="banner-presets" role="group" aria-label="Built-in banners" className="set-banner-presets">
          {BANNER_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onPreset(p.id)}
              disabled={pending}
              aria-pressed={current === bannerUrl(p.id)}
              className="set-banner-preset"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- small static SVGs */}
              <img src={bannerUrl(p.id)} alt="" width={240} height={60} />
              <span>{p.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
