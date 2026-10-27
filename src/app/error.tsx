"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="ov-container ov-route-message">
      <h1>Не получилось открыть страницу</h1>
      <p>Попробуйте открыть страницу ещё раз или вернитесь к поиску отелей.</p>
      <button className="ov-button" onClick={reset}>
        Повторить
      </button>
    </div>
  );
}
