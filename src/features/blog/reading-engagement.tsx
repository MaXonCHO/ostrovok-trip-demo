"use client";

import { useEffect, useRef, useState } from "react";
import { BookmarkSimple, Check, ThumbsUp, Trash } from "@phosphor-icons/react";
import { useAccount } from "@/features/planner/account-provider";

interface Note {
  id: string;
  text: string;
  createdAt: string;
}
interface ReadingState {
  progress: number;
  activeSeconds: number;
  liked: boolean;
  notes: Note[];
}
const likesKey = "ostrovok-blog-useful-v1";
const normalize = (text: string) => text.replace(/\s+/g, " ").trim();
function localLike(key: string): { liked: boolean; pending: boolean } | null {
  try {
    const state = JSON.parse(localStorage.getItem(likesKey) || "{}")[key];
    return typeof state?.liked === "boolean" ? state : null;
  } catch {
    return null;
  }
}
function saveLike(key: string, liked: boolean, pending: boolean) {
  try {
    const state = JSON.parse(localStorage.getItem(likesKey) || "{}");
    state[key] = { liked, pending };
    localStorage.setItem(likesKey, JSON.stringify(state));
  } catch {}
}
export function ReadingEngagement({
  articleSlug,
  title,
  category,
  tags,
}: {
  articleSlug: string;
  title: string;
  category: string;
  tags: string[];
}) {
  const auth = useAccount();
  const [liked, setLiked] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [progress, setProgress] = useState(0);
  const [selected, setSelected] = useState<{
    text: string;
    left: number;
    top: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState("");
  const metrics = useRef({ progress: 0, activeSeconds: 0 });
  const localKey = `${auth.user?.id || "guest"}:${articleSlug}`;
  const accept = (state: ReadingState) => {
    metrics.current.progress = Math.max(
      metrics.current.progress,
      state.progress,
    );
    metrics.current.activeSeconds = Math.max(
      metrics.current.activeSeconds,
      state.activeSeconds,
    );
    setProgress(metrics.current.progress);
    setLiked(state.liked);
    setNotes(state.notes);
  };
  async function send(input: Record<string, unknown>) {
    const response = await fetch("/api/reading-interest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: articleSlug, ...input }),
      keepalive: true,
    });
    const result = await response.json();
    if (!response.ok)
      throw Error(result.error || "Не удалось сохранить отметку.");
    return result as ReadingState;
  }
  useEffect(() => {
    if (!auth.ready) return;
    let live = true;
    const fallback = localLike(localKey);
    setLoaded(false);
    setLiked(fallback?.liked ?? false);
    setNotes([]);
    setStatus("");
    metrics.current = { progress: 0, activeSeconds: 0 };
    fetch(`/api/reading-interest?slug=${encodeURIComponent(articleSlug)}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw Error();
        return response.json() as Promise<ReadingState>;
      })
      .then(async (state) => {
        if (!live) return;
        if (fallback?.pending) {
          const response = await fetch("/api/reading-interest", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              slug: articleSlug,
              progress: state.progress,
              activeSeconds: state.activeSeconds,
              liked: fallback.liked,
            }),
          });
          if (!response.ok) throw Error();
          state = await response.json();
        }
        if (!live) return;
        accept(state);
        saveLike(localKey, state.liked, false);
      })
      .catch(() => {})
      .finally(() => {
        if (live) setLoaded(true);
      });
    return () => {
      live = false;
    };
    // Canonical state is restored once per article/account, not on scroll.
  }, [articleSlug, auth.ready, localKey]);
  useEffect(() => {
    if (!auth.ready) return;
    const body = document.querySelector<HTMLElement>(".ov-journal-body");
    if (!body) return;
    let bodyVisible = false,
      lastTick = performance.now(),
      lastSent = lastTick,
      lastActivity = lastTick;
    const updateProgress = () => {
      const rect = body.getBoundingClientRect();
      const next = Math.max(
        0,
        Math.min(1, (window.innerHeight - rect.top) / Math.max(1, rect.height)),
      );
      metrics.current.progress = Math.max(metrics.current.progress, next);
      setProgress(metrics.current.progress);
    };
    const observer = new IntersectionObserver(([entry]) => {
      bodyVisible = entry.isIntersecting;
      updateProgress();
    });
    observer.observe(body);
    const activity = () => {
      lastActivity = performance.now();
      updateProgress();
    };
    const flush = (beacon = false) => {
      const payload = JSON.stringify({
        slug: articleSlug,
        progress: metrics.current.progress,
        activeSeconds: Math.floor(metrics.current.activeSeconds),
      });
      if (
        beacon &&
        navigator.sendBeacon?.(
          "/api/reading-interest",
          new Blob([payload], { type: "application/json" }),
        )
      )
        return;
      void fetch("/api/reading-interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    };
    const interval = window.setInterval(() => {
      const now = performance.now();
      if (
        bodyVisible &&
        document.visibilityState === "visible" &&
        document.hasFocus() &&
        now - lastActivity < 90000
      )
        metrics.current.activeSeconds = Math.min(
          3600,
          metrics.current.activeSeconds + Math.min((now - lastTick) / 1000, 2),
        );
      lastTick = now;
      if (now - lastSent >= 10000 && metrics.current.activeSeconds > 0) {
        flush();
        lastSent = now;
      }
    }, 1000);
    const visibility = () => {
      lastTick = performance.now();
      if (document.visibilityState === "hidden") flush(true);
    };
    const pagehide = () => flush(true);
    window.addEventListener("scroll", activity, { passive: true });
    window.addEventListener("pointerdown", activity, { passive: true });
    window.addEventListener("keydown", activity);
    window.addEventListener("pagehide", pagehide);
    document.addEventListener("visibilitychange", visibility);
    updateProgress();
    return () => {
      flush(true);
      observer.disconnect();
      clearInterval(interval);
      window.removeEventListener("scroll", activity);
      window.removeEventListener("pointerdown", activity);
      window.removeEventListener("keydown", activity);
      window.removeEventListener("pagehide", pagehide);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [articleSlug, auth.ready, localKey]);
  useEffect(() => {
    let frame = 0;
    const inspect = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const selection = window.getSelection();
        const body = document.querySelector(".ov-journal-body");
        const text = normalize(selection?.toString() || "");
        if (
          !body ||
          !selection?.anchorNode ||
          !selection.focusNode ||
          !body.contains(selection.anchorNode) ||
          !body.contains(selection.focusNode) ||
          text.length < 20 ||
          text.length > 1000 ||
          !selection.rangeCount
        ) {
          setSelected(null);
          return;
        }
        const bounds = selection.getRangeAt(0).getBoundingClientRect();
        if (bounds.bottom < 0 || bounds.top > window.innerHeight) {
          setSelected(null);
          return;
        }
        setSelected({
          text,
          left: Math.max(12, Math.min(window.innerWidth - 230, bounds.left)),
          top: Math.max(
            12,
            Math.min(window.innerHeight - 60, bounds.bottom + 8),
          ),
        });
      });
    };
    document.addEventListener("selectionchange", inspect);
    document.addEventListener("mouseup", inspect);
    document.addEventListener("touchend", inspect);
    window.addEventListener("scroll", inspect, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("selectionchange", inspect);
      document.removeEventListener("mouseup", inspect);
      document.removeEventListener("touchend", inspect);
      window.removeEventListener("scroll", inspect);
    };
  }, [articleSlug]);
  async function toggleLike() {
    const next = !liked;
    setLiked(next);
    saveLike(localKey, next, true);
    setBusy(true);
    setStatus("");
    try {
      const state = await send({ ...metrics.current, liked: next });
      accept(state);
      saveLike(localKey, next, false);
      window.dispatchEvent(new Event("ov:reading-updated"));
    } catch {
      setStatus("Отметка сохранена на этом устройстве.");
    } finally {
      setBusy(false);
    }
  }
  async function addNote() {
    if (!selected) return;
    setBusy(true);
    setStatus("");
    try {
      accept(await send({ note: selected.text }));
      setSelected(null);
      window.getSelection()?.removeAllRanges();
      setStatus("Заметка сохранена.");
      window.dispatchEvent(new Event("ov:reading-updated"));
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function removeNote(id: string) {
    setBusy(true);
    setStatus("");
    try {
      accept(await send({ deleteNote: id }));
      window.dispatchEvent(new Event("ov:reading-updated"));
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="ov-reading"
      aria-label={`Отметки к статье «${title}»`}
      data-category={category}
      data-tags={tags.join(",")}
    >
      <div className="ov-reading-toolbar">
        <button
          className={`ov-reading-like ${liked ? "is-liked" : ""}`}
          type="button"
          aria-pressed={liked}
          disabled={busy || !loaded}
          onClick={toggleLike}
        >
          {liked ? <Check size={19} /> : <ThumbsUp size={19} />} Полезная статья
        </button>
        <span
          className="ov-reading-progress"
          aria-label={`Прочитано ${Math.round(progress * 100)} процентов`}
        >
          {Math.round(progress * 100)}%
        </span>
      </div>
      <p className="ov-reading-hint">
        Выделите понравившийся фрагмент, чтобы сохранить заметку.
      </p>
      {selected && (
        <button
          className="ov-reading-note-action"
          type="button"
          style={{ left: selected.left, top: selected.top }}
          onPointerDown={(event) => event.preventDefault()}
          disabled={busy}
          onClick={addNote}
        >
          <BookmarkSimple size={18} /> Сохранить заметку
        </button>
      )}
      {notes.length > 0 && (
        <div className="ov-reading-notes">
          <h2>Ваши заметки</h2>
          {notes.map((note) => (
            <div className="ov-reading-note" key={note.id}>
              <p>{note.text}</p>
              <button
                type="button"
                disabled={busy}
                aria-label="Удалить заметку"
                onClick={() => removeNote(note.id)}
              >
                <Trash size={18} />
              </button>
            </div>
          ))}
        </div>
      )}
      <span className="ov-reading-status" role="status">
        {status}
      </span>
    </section>
  );
}
