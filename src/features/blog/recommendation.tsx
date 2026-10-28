"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useAccount } from "@/features/planner/account-provider";
import { Sparkle } from "@phosphor-icons/react";
import { BlogFeature } from "./feature";
import {
  blogDraftKey,
  blogConversationKey,
  blogInterestEvent,
  recommendBlogArticle,
} from "./articles";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(blogInterestEvent, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(blogInterestEvent, callback);
  };
}
function snapshot() {
  try {
    return JSON.stringify([
      localStorage.getItem(blogDraftKey) ?? "",
      localStorage.getItem(blogConversationKey) ?? "",
    ]);
  } catch {
    return '["",""]';
  }
}
export function BlogRecommendation() {
  const account = useAccount();
  const [readingContext, setReadingContext] = useState<unknown>(null);
  useEffect(() => {
    if (!account.ready) return;
    let active = true;
    void fetch("/api/reading-interest", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (active && data?.inferredExpectations)
          setReadingContext({ expectations: data.inferredExpectations });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [account.ready, account.user?.id]);
  const raw = useSyncExternalStore(subscribe, snapshot, () => '["",""]');
  const [draft, stored] = JSON.parse(raw) as [string, string];
  let conversation: unknown = null;
  try {
    conversation = JSON.parse(stored);
  } catch {}
  const fromRequest = recommendBlogArticle(draft, conversation);
  const { article, reason, personalized } = fromRequest.personalized
    ? fromRequest
    : recommendBlogArticle(draft, readingContext ?? conversation);
  return (
    <section
      className="ov-home-section ov-blog-recommendation"
      aria-labelledby="blog-recommendation-title"
    >
      <div className="ov-blog-section-heading">
        <h2 id="blog-recommendation-title">Идеи для вашей поездки</h2>
      </div>
      <BlogFeature
        article={article}
        label={
          <>
            {personalized && <Sparkle size={17} />} {reason}
          </>
        }
      />
    </section>
  );
}
