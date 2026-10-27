import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "@/data/adapters/json-file";
export function originCheck(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host"))
    throw new AppError(403, "Запрос с другого сайта запрещён.");
}
export const baseUrl = (req: NextRequest) =>
  process.env.APP_BASE_URL?.replace(/\/$/, "") || new URL(req.url).origin;
export function errorResponse(error: unknown) {
  if (error instanceof AppError)
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  if (error instanceof ZodError)
    return NextResponse.json(
      {
        error: "Проверьте введённые значения.",
        details: error.issues.map((i) => i.path.join(".") + ": " + i.message),
      },
      { status: 400 },
    );
  console.error(error);
  return NextResponse.json(
    {
      error:
        "Не удалось сохранить данные. Попробуйте ещё раз, ваш ввод сохранён.",
    },
    { status: 500 },
  );
}
