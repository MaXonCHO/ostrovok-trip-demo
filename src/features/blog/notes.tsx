"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, BookmarkSimple, Trash } from "@phosphor-icons/react";
import { useAccount } from "@/features/planner/account-provider";

interface SavedNote {
  id: string;
  text: string;
  createdAt: string;
  article: { slug: string; title: string };
}
interface ReadingSummary {
  interests: {
    article: { slug: string; title: string };
    notes: { id: string; text: string; createdAt: string }[];
  }[];
}

export function BlogNotes() {
  const auth = useAccount();
  const [notes, setNotes] = useState<SavedNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const request = useRef(0);
  const refresh = useCallback(async () => {
    if (!auth.ready) return;
    const current = ++request.current;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/reading-interest", {
        cache: "no-store",
      });
      if (!response.ok) throw Error("Не удалось загрузить заметки.");
      const data = (await response.json()) as ReadingSummary;
      if (current !== request.current) return;
      const next = data.interests.flatMap((interest) =>
        interest.notes.map((note) => ({ ...note, article: interest.article })),
      );
      setNotes(next.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    } catch {
      if (current === request.current)
        setError("Не удалось загрузить заметки.");
    } finally {
      if (current === request.current) setLoading(false);
    }
  }, [auth.ready]);
  useEffect(() => {
    setNotes([]);
    void refresh();
    const invalidateRequests = () => {
      request.current++;
    };
    const update = () => {
      void refresh();
    };
    const visible = () => {
      if (document.visibilityState === "visible") update();
    };
    window.addEventListener("ov:reading-updated", update);
    window.addEventListener("focus", update);
    window.addEventListener("pageshow", update);
    document.addEventListener("visibilitychange", visible);
    return () => {
      invalidateRequests();
      window.removeEventListener("ov:reading-updated", update);
      window.removeEventListener("focus", update);
      window.removeEventListener("pageshow", update);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [refresh, auth.user?.id]);
  async function remove(note: SavedNote) {
    setDeleting(note.id);
    setError("");
    try {
      const response = await fetch("/api/reading-interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: note.article.slug, deleteNote: note.id }),
      });
      if (!response.ok) throw Error();
      setNotes((current) => current.filter((item) => item.id !== note.id));
      window.dispatchEvent(new Event("ov:reading-updated"));
    } catch {
      setError("Не удалось удалить заметку. Попробуйте ещё раз.");
    } finally {
      setDeleting(null);
    }
  }
  return (
    <section
      className="ov-blog-notes ov-container"
      aria-labelledby="blog-notes-title"
    >
      <header className="ov-blog-notes-heading">
        <h2 id="blog-notes-title">Заметки</h2>
        {notes.length > 0 && <span>{notes.length}</span>}
      </header>
      {loading && notes.length === 0 && (
        <p className="ov-blog-notes-status" role="status">
          Загружаем заметки…
        </p>
      )}
      {error && (
        <div className="ov-blog-notes-error" role="status">
          <p>{error}</p>
          <button type="button" onClick={() => void refresh()}>
            Повторить
          </button>
        </div>
      )}
      {!loading && !error && notes.length === 0 && (
        <p className="ov-blog-notes-empty">
          <BookmarkSimple size={21} aria-hidden="true" />
          <span>
            Выделяйте фрагменты в статьях — сохранённые заметки появятся здесь.
          </span>
        </p>
      )}
      {notes.length > 0 && (
        <div className="ov-blog-notes-grid">
          {notes.map((note) => (
            <article className="ov-blog-note-card" key={note.id}>
              <blockquote>
                <p>{note.text}</p>
              </blockquote>
              <div className="ov-blog-note-bottom">
                <Link href={`/blog/${note.article.slug}`}>
                  {note.article.title}
                  <ArrowRight size={18} aria-hidden="true" />
                </Link>
                <button
                  type="button"
                  aria-label={`Удалить заметку из статьи «${note.article.title}»`}
                  disabled={deleting === note.id}
                  onClick={() => void remove(note)}
                >
                  <Trash size={19} aria-hidden="true" />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
