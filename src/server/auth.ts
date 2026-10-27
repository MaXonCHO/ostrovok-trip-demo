import { randomBytes, randomUUID, createHash } from "node:crypto";
import { cookies } from "next/headers";
import { database, transaction } from "./database";
import { HttpError } from "./http";
import type { Account } from "@/features/planner/types";
const cookie = "ostrovok_account";
const digest = (s: string) => createHash("sha256").update(s).digest("hex");
const now = () => new Date().toISOString();
export function normalizePhone(value: unknown) {
  if (typeof value !== "string" || !/^[+\d\s()\-]+$/.test(value))
    throw new HttpError(
      400,
      "Введите телефон в международном формате, например +7 900 123-45-67.",
    );
  let digits = value.replace(/\D/g, "");
  if (digits.length === 11 && digits[0] === "8") digits = "7" + digits.slice(1);
  if (digits.length < 10 || digits.length > 15 || digits[0] === "0")
    throw new HttpError(400, "В номере должно быть от 10 до 15 цифр.");
  return "+" + digits;
}
export async function account(createGuest = false): Promise<Account | null> {
  const jar = await cookies();
  const token = jar.get(cookie)?.value;
  const db = database();
  if (token && /^[a-f0-9]{64}$/.test(token)) {
    const row = db
      .prepare(
        "SELECT users.* FROM sessions JOIN users ON users.id=sessions.user_id WHERE token_hash=? AND expires_at>?",
      )
      .get(digest(token), Date.now()) as
      | { id: string; name: string; phone: string | null }
      | undefined;
    if (row) return { ...row, authenticated: !!row.phone };
  }
  if (!createGuest) return null;
  const id = randomUUID();
  db.prepare("INSERT INTO users VALUES(?,?,?,?)").run(id, null, "Гость", now());
  await issueSession(id);
  return { id, name: "Гость", phone: null, authenticated: false };
}
async function issueSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  database()
    .prepare("INSERT INTO sessions VALUES(?,?,?)")
    .run(digest(token), userId, Date.now() + 30 * 86400000);
  (await cookies()).set(cookie, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    maxAge: 30 * 86400,
  });
}
export async function requireAccount() {
  const a = await account();
  if (!a?.authenticated)
    throw new HttpError(401, "Войдите по телефону и демо-коду 0000.");
  return a;
}
export function requestCode(phone: unknown) {
  const normalized = normalizePhone(phone);
  const db = database();
  const count = db
    .prepare(
      "SELECT count(*) AS n FROM login_challenges WHERE phone=? AND created_at>?",
    )
    .get(normalized, Date.now() - 15 * 60000) as { n: number };
  if (count.n >= 10)
    throw new HttpError(
      429,
      "Слишком много попыток. Повторите через 15 минут.",
    );
  const id = randomBytes(24).toString("hex");
  db.prepare(
    "INSERT INTO login_challenges(id,phone,expires_at,created_at) VALUES(?,?,?,?)",
  ).run(id, normalized, Date.now() + 5 * 60000, Date.now());
  return { challengeId: id, phone: normalized, expiresIn: 300, demo: true };
}
export async function verifyCode(
  challengeId: unknown,
  code: unknown,
  name: unknown,
) {
  if (typeof challengeId !== "string" || typeof code !== "string")
    throw new HttpError(400, "Проверьте код.");
  const db = database();
  const challenge = db
    .prepare("SELECT * FROM login_challenges WHERE id=?")
    .get(challengeId) as
    | { phone: string; expires_at: number; attempts: number; used: number }
    | undefined;
  if (
    !challenge ||
    challenge.used ||
    challenge.expires_at < Date.now() ||
    challenge.attempts >= 5
  )
    throw new HttpError(400, "Код истёк. Запросите новый.");
  db.prepare("UPDATE login_challenges SET attempts=attempts+1 WHERE id=?").run(
    challengeId,
  );
  if (code !== "0000")
    throw new HttpError(400, "Неверный код. В демо используется 0000.");
  const previous = await account();
  let user = db
    .prepare("SELECT id,name,phone FROM users WHERE phone=?")
    .get(challenge.phone) as
    | { id: string; name: string; phone: string }
    | undefined;
  transaction(() => {
    const used = db
      .prepare(
        "UPDATE login_challenges SET used=1 WHERE id=? AND used=0 AND attempts<=5",
      )
      .run(challengeId);
    if (!used.changes) throw new HttpError(409, "Этот код уже использован.");
    if (!user) {
      user = {
        id: randomUUID(),
        phone: challenge.phone,
        name:
          typeof name === "string" && name.trim()
            ? name.trim().slice(0, 50)
            : "Путешественник",
      };
      db.prepare("INSERT INTO users VALUES(?,?,?,?)").run(
        user.id,
        user.phone,
        user.name,
        now(),
      );
    }
    if (previous && !previous.authenticated) {
      const trips = db
        .prepare("SELECT id FROM trips WHERE owner_id=?")
        .all(previous.id) as { id: string }[];
      for (const t of trips) {
        db.prepare("UPDATE trips SET owner_id=? WHERE id=?").run(
          user!.id,
          t.id,
        );
        db.prepare(
          "DELETE FROM trip_members WHERE trip_id=? AND user_id=?",
        ).run(t.id, previous.id);
        db.prepare("INSERT OR IGNORE INTO trip_members VALUES(?,?,?,?)").run(
          t.id,
          user!.id,
          "owner",
          now(),
        );
      }
      db.prepare("UPDATE trip_messages SET user_id=? WHERE user_id=?").run(
        user!.id,
        previous.id,
      );
      db.prepare("UPDATE chat_requests SET user_id=? WHERE user_id=?").run(
        user!.id,
        previous.id,
      );
      db.prepare("DELETE FROM sessions WHERE user_id=?").run(previous.id);
    }
  });
  const jar = await cookies();
  const old = jar.get(cookie)?.value;
  if (old)
    db.prepare("DELETE FROM sessions WHERE token_hash=?").run(digest(old));
  await issueSession(user!.id);
  return { ...user!, authenticated: true };
}
export async function logout() {
  const jar = await cookies();
  const token = jar.get(cookie)?.value;
  if (token)
    database()
      .prepare("DELETE FROM sessions WHERE token_hash=?")
      .run(digest(token));
  jar.delete(cookie);
}
