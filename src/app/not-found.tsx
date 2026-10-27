import Link from "next/link";
export default function NotFound() {
  return (
    <div className="page-width empty-state">
      <h1>Такой страницы нет</h1>
      <p>Вернитесь к своим поездкам или начните новую.</p>
      <Link className="button primary" href="/">
        На главную
      </Link>
    </div>
  );
}
