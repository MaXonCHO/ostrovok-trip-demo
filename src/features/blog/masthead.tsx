"use client";
import Link from "next/link";
import { blogSections } from "./articles";

export function BlogRubrics({
  section = "all",
  onSection,
}: {
  section?: string;
  onSection?: (id: string) => void;
}) {
  return (
    <nav className="ov-blog-rubrics" aria-label="Рубрики О!Блога">
      {blogSections.map((item) =>
        onSection ? (
          <button
            key={item.id}
            aria-pressed={section === item.id}
            onClick={() => onSection(section === item.id ? "all" : item.id)}
          >
            {item.label}
          </button>
        ) : (
          <Link key={item.id} href={`/blog?topic=${item.id}`}>
            {item.label}
          </Link>
        ),
      )}
    </nav>
  );
}
