import { NextResponse } from "next/server";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function checkOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host"))
    throw new HttpError(403, "Запрос с другого сайта запрещён.");
}
export async function jsonBody(req: Request) {
  checkOrigin(req);
  if (!req.headers.get("content-type")?.includes("application/json"))
    throw new HttpError(415, "Нужен формат JSON.");
  const reader = req.body?.getReader();
  if (!reader) throw new HttpError(400, "Пустой запрос.");
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > 64000) {
      await reader.cancel();
      throw new HttpError(413, "Сообщение слишком большое.");
    }
    chunks.push(value);
  }
  const s = Buffer.concat(chunks).toString("utf8");
  try {
    const value = JSON.parse(s);
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw Error("Invalid body");
    return value as Record<string, unknown>;
  } catch {
    throw new HttpError(400, "Некорректный JSON.");
  }
}
export function failure(e: unknown) {
  if (e instanceof HttpError)
    return NextResponse.json(
      { error: e.message },
      { status: e.status, headers: { "Cache-Control": "no-store" } },
    );
  console.error(
    "Planner operation failed",
    e instanceof Error ? e.name : "Unknown",
  );
  return NextResponse.json(
    { error: "Не удалось сохранить изменения. Попробуйте ещё раз." },
    { status: 500 },
  );
}
export const hashToken = (token: string) => {
  return import("node:crypto").then(({ createHash }) =>
    createHash("sha256").update(token).digest("hex"),
  );
};
export function textValue(value: unknown, label: string, max = 1000) {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw new HttpError(400, `Проверьте поле «${label}».`);
  return value.trim();
}
