/** Keep the landscape in place while the request becomes the first chat message. */
export function navigateToTrip(url: string, navigate: (url: string) => void) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    navigate(url);
    return;
  }
  if (!document.startViewTransition) {
    document.querySelector(".ov-hero")?.classList.add("is-entering-trip");
    window.setTimeout(() => navigate(url), 240);
    return;
  }
  let resolveReady: () => void;
  const ready = new Promise<void>((resolve) => {
    resolveReady = resolve;
  });
  const onReady = () => resolveReady();
  window.addEventListener("ov:trip-ready", onReady, { once: true });
  const timer = window.setTimeout(onReady, 2500);
  const transition = document.startViewTransition(async () => {
    navigate(url);
    await ready;
  });
  void transition.finished
    .catch(() => {})
    .finally(() => {
      clearTimeout(timer);
      window.removeEventListener("ov:trip-ready", onReady);
    });
}
