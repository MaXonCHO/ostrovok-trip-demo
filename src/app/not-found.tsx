import Link from "next/link";
export default function NotFound() {
  return (
    <div className="ov-container ov-route-message">
      <h1>Такой страницы нет</h1>
      <p>Вернитесь на главную и найдите отель для следующей поездки.</p>
      <Link className="ov-button" href="/">
        На главную
      </Link>
    </div>
  );
}
