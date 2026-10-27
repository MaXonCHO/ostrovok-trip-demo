import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
const dir = await mkdtemp(join(tmpdir(), "ostrovok-restart-"));
const address = "http://127.0.0.1:8181";
let child;
async function start() {
  child = spawn(process.execPath, [resolve(".next/standalone/server.js")], {
    env: {
      ...process.env,
      PORT: "8181",
      HOSTNAME: "127.0.0.1",
      TRIP_DATA_DIR: dir,
      NODE_ENV: "production",
    },
    stdio: "ignore",
  });
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(address + "/health");
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("Server did not become healthy");
}
async function stop() {
  if (!child || child.exitCode !== null) return;
  const closed = new Promise((r) => child.once("exit", r));
  child.kill("SIGTERM");
  await closed;
}
try {
  await start();
  const created = await fetch(address + "/api/trips", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Проверка перезапуска",
      cityId: "sochi",
      group: false,
      expectedParticipants: 1,
      nights: 4,
      rooms: 1,
    }),
  });
  const cookie = created.headers.get("set-cookie").split(";")[0];
  const { id } = await created.json();
  async function view() {
    return await (
      await fetch(address + "/api/trips/" + id, { headers: { cookie } })
    ).json();
  }
  let v = await view();
  async function command(command) {
    const r = await fetch(address + "/api/trips/" + id, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({
        version: v.version,
        commandId: crypto.randomUUID(),
        command,
      }),
    });
    if (!r.ok) throw new Error(await r.text());
    v = await r.json();
  }
  await command({ type: "generateScenarios" });
  await command({
    type: "vote",
    entityType: "scenario",
    entityId: v.scenarios[0].id,
    decision: "liked",
  });
  const meId = v.me.id,
    version = v.version;
  await stop();
  await start();
  const after = await view();
  if (
    after.me.id !== meId ||
    after.version !== version ||
    after.votes[0].decision !== "liked"
  )
    throw new Error("State did not survive restart");
  const result = {
    date: "2026-10-27",
    passed: true,
    mode: "Node standalone, isolated JSON directory",
    assertions: [
      "same HttpOnly session after restart",
      "same trip version",
      "same recorded vote",
    ],
    docker: false,
  };
  await writeFile(
    "docs/verification/persistence-results.json",
    JSON.stringify(result, null, 2),
  );
  console.log(result);
} finally {
  await stop();
  await rm(dir, { recursive: true, force: true });
}
