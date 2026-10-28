import Link from "next/link";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";

export function BlogTripBanner({ embedded = false }: { embedded?: boolean }) {
  return (
    <section
      className={`ov-final-cta ov-blog-final-cta${embedded ? " is-on-scene" : ""}`}
      aria-labelledby="blog-closer-to-holiday"
    >
      {!embedded && (
        <div className="ov-final-cta-backdrop" aria-hidden="true" />
      )}
      <div className="ov-final-cta-content">
        <p>Где начнётся ваша следующая история?</p>
        <h2 id="blog-closer-to-holiday">
          Давайте ближе
          <br />к отпуску.
        </h2>
        <Link className="ov-button" href="/#trip-request-heading">
          Начать мою поездку <ArrowUpRight size={23} />
        </Link>
      </div>
    </section>
  );
}
