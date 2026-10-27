import { cookies } from "next/headers";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import {
  atomicJson,
  readJson,
  serialized,
  AppError,
} from "@/data/adapters/json-file";
interface Session {
  userId: string;
  tripIds: string[];
  createdAt: string;
}
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export async function session(create = false): Promise<Session | null> {
  const jar = await cookies();
  const token = jar.get("ostrovok_session")?.value;
  const all = await readJson<Record<string, Session>>("sessions.json", {});
  if (token && all[hash(token)]) return all[hash(token)];
  if (!create) return null;
  const raw = randomBytes(32).toString("hex");
  const s: Session = {
    userId: randomUUID(),
    tripIds: [],
    createdAt: new Date().toISOString(),
  };
  await serialized("sessions", async () => {
    const current = await readJson<Record<string, Session>>(
      "sessions.json",
      {},
    );
    current[hash(raw)] = s;
    await atomicJson("sessions.json", current);
  });
  jar.set("ostrovok_session", raw, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return s;
}
export async function requireSession() {
  const s = await session();
  if (!s)
    throw new AppError(401, "Откройте приглашение или создайте свою поездку.");
  return s;
}
export async function addSessionTrip(id: string) {
  const jar = await cookies();
  const raw = jar.get("ostrovok_session")?.value;
  if (!raw) return;
  await serialized("sessions", async () => {
    const all = await readJson<Record<string, Session>>("sessions.json", {});
    const s = all[hash(raw)];
    if (s && !s.tripIds.includes(id)) {
      s.tripIds.push(id);
      await atomicJson("sessions.json", all);
    }
  });
}
