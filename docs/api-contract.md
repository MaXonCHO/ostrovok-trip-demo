# Контракт приложения и будущего агента

API в src/app/api/[...path]/route.ts. JSON, серверный Node runtime. Ответы поездки no-store. Cookie `ostrovok_session`: HttpOnly, SameSite=Lax, Secure при COOKIE_SECURE=true. Все изменяющие запросы проверяют Origin. Текст ошибки в `{ "error": "..." }`.

## Создать и вступить

`POST /api/trips`:

```json
{"name":"Артём","cityId":"sochi","group":true,"expectedParticipants":2,"nights":4,"rooms":1,"prompt":"Хочу море и прогулки"}
```

Ответ 201 `{ "id": "UUID" }`. Неизвестное направление: cityId null. Даты необязательные start/end в ISO YYYY-MM-DD.

`GET /api/trips` отдаёт только поездки своей сессии, кратко без чужих личных данных. `GET /api/trips/:id` отдаёт TripView с me.messages только для текущего пользователя. У остальных участников поля messages нет.

`GET /api/join/:token` отдаёт публичное краткое приглашение. `POST /api/join/:token { "name": "Саша" }` выдаёт собственную сессию и возвращает id поездки. 410 для отозванного приглашения. Прямое чтение/изменение поездки без членства: 401/403.

## Команды

`POST /api/trips/:id`:

```json
{"version":4,"commandId":"00000000-0000-4000-8000-000000000001","command":{"type":"vote","entityType":"hotel","entityId":"h1","decision":"liked"}}
```

Сервер берёт автора из сессии. Передача чужого participantId не меняет автора. Повтор commandId идемпотентен. Устаревшая version: 409, клиент перечитывает TripView и повторяет тот же commandId. Конфликт не теряет уже записанный голос. Файл командных Zod-схем: src/data/contracts/commands.ts.

Поддержанные команды: message, context, preference, generateScenarios, vote, confirmScenarios, openHotels, finishHotels, propose, confirmFinal, reopen, revokeInvite, removeParticipant, leave, material, savePlace, customPlace. Важные различия: finishHotels сохраняет unseen; propose не является confirmFinal; reopen доступен только организатору; личное preference редактирует только автор.

`GET /api/trips/:id/route?hotelId=h1&placeId=p1` отдаёт Route с isSynthetic и source. При реальном GeoProvider DTO сохраняется, изменяется происхождение. Текущая геометрия локальная демонстрация.

## Отельер

`POST /api/host` с action ask: hotelId, tripId, question. Проверяется членство в поездке.

Далее action answer: id вопроса, answer. Ответ содержит suggestion и status extracted при распознавании. action confirm: id сохраняет новую evidence; старые записи остаются. `GET /api/host` показывает только вопросы текущей сессии. Это имитация отдельного кабинета, промышленной авторизации отельеров нет.

## Демонстрационные сцены

`POST /api/demo { "kind": "solo|group|conflict|geo" }` создаёт личную сцену, не сбрасывает другие данные. Специальный заголовок x-demo-persona разрешён только владельцу своей isDemo-поездки и только для существующего её участника. В реальных поездках заголовок отклоняется.

## Будущий HTTP AgentProvider

`POST <AGENT_BASE_URL>/v1/agent/reply`, заголовок Authorization с серверным секретом. Пример минимизированного тела:

```json
{
  "trip":{"id":"uuid","cityId":"sochi","nights":4,"rooms":1,"selectionRevision":2},
  "participantId":"uuid",
  "text":"Хочу тихий номер, море необязательно",
  "messages":[{"role":"user","text":"Мой личный предыдущий запрос"}],
  "sharedPreferences":[]
}
```

Ожидаемый ответ:

```json
{"text":"Записал пожелание о тишине. Сколько минут готовы идти пешком?","updates":[{"key":"interest:quiet","value":true,"importance":"preferred","priority":0.7}]}
```

Этот внешний endpoint документирован как точка интеграции, сервер приложения его пока не вызывает. Контракт валидировать на границе адаптера. Агент не получает доступ к cookie, чужим личным сообщениям или произвольному выполнению команд.
