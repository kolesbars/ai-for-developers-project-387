# Календарь звонков (продолжение)


[![hexlet-check](https://github.com/kolesbars/ai-for-developers-project-387/actions/workflows/hexlet-check.yml/badge.svg)](https://github.com/kolesbars/ai-for-developers-project-387/actions)

Интегрируйте работу агентов в GitHub проект

## Открыть приложение

**https://calendar-a7mo.onrender.com** — Гость: `/`, Владелец: `/admin`.

Это развёртывание из первого проекта
[ai-for-developers-project-386](https://github.com/kolesbars/ai-for-developers-project-386), откуда
приложение перенесено сюда без изменений (спецификация, решения и история — в
[`docs/origin.md`](docs/origin.md)). Бесплатный инстанс засыпает: первый запрос после простоя
отвечает около минуты. Если адрес недоступен, запустите приложение локально:

```bash
mise trust && mise install && mise run install
mise run dev          # frontend http://localhost:5173, backend http://localhost:8080
```

или одним контейнером:

```bash
docker build -t calendar .
docker run --rm -e PORT=8080 -p 8080:8080 calendar   # http://localhost:8080
```

## Задача первого проекта

Учебный проект Хекслета: https://ru.hexlet.io/programs/ai-for-developers
Как это должно работать: https://files.hexlet.app/a/2ipc5m

Окно записи занимает 14 календарных дней и сдвигается с течением времени. Начало с сегодняшнего или завтрашнего дня, часы работы владельца и часовой пояс вы выбираете и записываете в спецификации. Длительность слота совпадает с длительностью типа встречи, шаг доступных стартов тоже фиксируется в спецификации. Пересечение интервалов запрещено, включая частичное наложение разных типов. Следующая встреча может начинаться в момент окончания предыдущей. Правила действуют и для двух запросов, пришедших одновременно.

## Стек

| Часть | Технологии |
|---|---|
| Контракт API | [TypeSpec](https://typespec.io) → OpenAPI 3.0.0 (`api/openapi/openapi.yaml`) |
| Backend | Kotlin, Ktor, JDK 21, Gradle wrapper, JUnit 5, ktlint |
| БД | PostgreSQL, миграции Flyway; без `DATABASE_URL` — embedded PostgreSQL (zonky) |
| Frontend | TypeScript, React, Vite, Mantine, Vitest, ESLint |
| API- и e2e-тесты | Playwright (`request` и установленный Google Chrome) |
| SDK для frontend | генерируется из OpenAPI: `openapi-typescript` + `openapi-fetch` |
| Инструменты и задачи | [mise](https://mise.jdx.dev) (`mise.toml`) |
| CI | GitHub Actions → `mise run check` на каждый push |

Версии JDK и Node зафиксированы в `mise.toml`, Gradle — в `backend/gradle/wrapper`,
npm-пакеты — в `package-lock.json`.

## Структура

```
api/        TypeSpec-контракт и сгенерированный openapi.yaml
backend/    Ktor-приложение (Gradle)
frontend/   Vite + React; src/api/schema.d.ts генерируется из OpenAPI
e2e/        Playwright: tests/api — HTTP-запросы к backend, tests/e2e — браузер
mise.toml   версии инструментов, переменные окружения и задачи
```

## Установка

Нужен только [mise](https://mise.jdx.dev/getting-started.html), остальное он поставит сам.

```bash
git clone https://github.com/kolesbars/ai-for-developers-project-387.git
cd ai-for-developers-project-387
mise trust
mise install
mise run install
```

## Использование

```bash
mise run dev
```

Backend — http://localhost:8080 (`GET /api/health`), frontend — http://localhost:5173
(запросы `/api` проксируются на backend). Без `DATABASE_URL` backend поднимает embedded
PostgreSQL во временном каталоге — данные живут до остановки backend. Внешняя БД:
`DATABASE_URL=postgres://user:pass@host:5432/db` (или `jdbc:postgresql://…`).
Профиль Владельца (`GET /api/owner`) — из `OWNER_NAME`, `OWNER_BIO` и `OWNER_TIME_ZONE`
(по умолчанию `Asia/Almaty`); незаданные берутся по умолчанию.

| Команда | Что делает |
|---|---|
| `mise run check` | все проверки: контракт, линтеры, тесты, сборка (то же, что в CI) |
| `mise run lint` | ktlint + ESLint + проверка типов |
| `mise run test` | JUnit + Vitest + Playwright (API и e2e) |
| `mise run test:api` / `test:e2e` | только API- или только браузерные тесты Playwright |
| `mise run format` | автоисправление стиля |
| `mise run build` | fat jar backend и статика frontend |
| `mise run api:sdk` | TypeSpec → OpenAPI → `frontend/src/api/schema.d.ts` |
| `mise tasks` | список всех задач |

После изменения `api/*.tsp` запустите `mise run api:sdk` и закоммитьте сгенерированные
файлы — CI проверяет, что они актуальны.

## Запуск в контейнере

Один образ из корневого `Dockerfile`: Ktor отдаёт API под `/api` и собранный frontend (остальные
пути — `index.html`, чтобы работал клиентский роутинг). Многоэтапная сборка: frontend (Node) и fat
jar (JDK 21), в итоговом образе — только JRE, `app.jar` и статика; процесс работает не от root.

```bash
docker build -t calendar .
docker run --rm -e PORT=8080 -p 8080:8080 calendar
```

Приложение стартует само и слушает порт из `PORT` — http://localhost:8080. Без `DATABASE_URL`
внутри контейнера поднимается embedded PostgreSQL.

С отдельным PostgreSQL 17 (том `db-data`, данные переживают перезапуск):

```bash
docker compose up --build
```

| Переменная | Значение |
|---|---|
| `PORT` | порт HTTP-сервера; в образе по умолчанию `8080`, хостинг задаёт свой |
| `BACKEND_PORT` | запасной вариант без `PORT` (локальная разработка, e2e) |
| `DATABASE_URL` | PostgreSQL (`postgres://user:pass@host:port/db` или `jdbc:…`); не задан — embedded |
| `STATIC_DIR` | каталог со статикой frontend, в образе `/app/public` |
| `OWNER_NAME`, `OWNER_BIO`, `OWNER_TIME_ZONE` | профиль Владельца; берутся из окружения или `.env` |
| `APP_PORT` | порт на хосте для `docker compose`, по умолчанию `8080` |

Остановить compose и удалить данные: `docker compose down --volumes`. CI (job `docker`) поднимает
compose и отдельно запускает образ с `PORT=3000` без БД, проверяя `GET /api/health` и `/`.

## Деплой

Публичная ссылка: **https://calendar-a7mo.onrender.com** (Гость — `/`, Владелец — `/admin`).

Сервис развёрнут на [Render](https://render.com) (Free Web Service) по Blueprint `render.yaml`:
Render собирает корневой `Dockerfile` и задаёт `PORT` сам. Blueprint подключён по публичному URL
репозитория, поэтому авто-деплоя нет: новую версию выкатывает Manual Deploy в Render Dashboard
(или подключение GitHub к Render). Своя копия: Render Dashboard → New → Blueprint → репозиторий.

Сценарий Гостя и Владельца (включая отказ повторного бронирования) проверяется по публичной ссылке
тем же набором Playwright, что и локально — без подъёма локальных серверов:

```bash
E2E_BASE_URL=https://calendar-a7mo.onrender.com npm run test --workspace e2e
```

**Данные сбрасываются.** На хостинге не задан `DATABASE_URL`, поэтому используется embedded
PostgreSQL внутри контейнера: Типы встреч и бронирования пропадают при каждом перезапуске —
после деплоя, рестарта и пробуждения (бесплатный инстанс засыпает после ~15 минут без запросов,
первый запрос после этого идёт ~1 минуту). Чтобы данные сохранялись, задайте `DATABASE_URL`
внешнего PostgreSQL в Environment сервиса.

## Агент в GitHub

Воркфлоу [`.github/workflows/claude.yml`](.github/workflows/claude.yml) запускает
[Claude Code GitHub Action](https://github.com/anthropics/claude-code-action) — тот же агент,
что работал с проектом локально, но на раннере GitHub Actions.

| | |
|---|---|
| Событие | `issue_comment` (обсуждение issue или PR) и `pull_request_review_comment` (комментарий к строке diff), только `types: [created]` — правка комментария агента не запускает |
| Команда | `@claude` (`trigger_phrase`, значение по умолчанию). Пример: `@claude запусти скилл to-spec по обсуждению этого issue` |
| Кто может вызвать | автор комментария — `OWNER`, `MEMBER` или `COLLABORATOR`; комментарии ботов (и самого `claude[bot]`) игнорируются |
| Модель | `claude-sonnet-5-5` (`claude_args: --model`), не больше 60 шагов за вызов |
| Назначение | обсуждение и уточнение задач, скиллы `to-spec` / `to-tickets` / `implement-spec`, ответы на ревью и правки PR |
| Результат | ответ — комментарием от `claude[bot]` в том же issue или PR (правки — в ветке `claude/…` или в PR); ход работы — во вкладке [Actions](https://github.com/kolesbars/ai-for-developers-project-387/actions/workflows/claude.yml) |

**Скиллы и настройки на раннере.** Раннер стартует с чистого окружения, поэтому всё нужное
агенту хранится в репозитории и приходит с checkout: скиллы первого проекта —
`.agents/skills` (подключены в `.claude/skills`), правила — `AGENTS.md` (через `CLAUDE.md`),
трекер и метки — `docs/agents/`. Глобально установленные скиллы не используются. mise ставит те же
JDK и Node, что в CI, — агент может прогнать `mise run check`. С issues агент работает через `gh`
с токеном задания: читает, создаёт спецификацию и тикеты (`to-spec`, `to-tickets`), комментирует,
ставит метки и связи; недостающие метки из `docs/agents/triage-labels.md` создаёт сам.
Тикеты, созданные этим токеном, не запускают другие воркфлоу — так GitHub защищает от циклов.

Скиллы, помеченные `disable-model-invocation` (`to-spec`, `to-tickets`, `implement-spec` и др.),
вызываются только слэш-командой человека, а в комментарии GitHub слэш-команд нет. Поэтому, как и в
OpenCode, название скилла передаётся текстом команды: `@claude запусти скилл to-spec по обсуждению
этого issue`. Агент читает `.agents/skills/<имя>/SKILL.md` и выполняет его (инструкция — в
`--append-system-prompt` воркфлоу); локально скиллы работают по-прежнему.

**Авторизация и права.** Стандартный режим GitHub App: установлено приложение
[Claude](https://github.com/apps/claude), action получает его токен по OIDC (`id-token: write`)
и пишет правами приложения (комментарий-ответ, ветки, коммиты). Токен задания — `contents`,
`pull-requests`, `actions` только на чтение и `issues: write` для операций трекера (`gh issue`,
`gh label`; список разрешённых команд — `--allowedTools`); у `actions/checkout` —
`persist-credentials: false`.
Ключ модели — секрет `CLAUDE_CODE_OAUTH_TOKEN` (подписка Claude, токен из `claude setup-token`)
в Settings → Secrets and variables → Actions; в репозитории ключей нет.
`pull_request_target` не используется, а комментарий из чужого fork не проходит проверку автора —
недоверенный код секрет не получает.

**Остановка.** У задания `timeout-minutes: 30`; `concurrency` — один прогон на issue/PR.
Текущий прогон останавливает Cancel workflow, будущие — Disable workflow в Actions; в крайнем
случае токен отзывается в настройках Claude.

**Автотриаж.** Воркфлоу [`.github/workflows/triage.yml`](.github/workflows/triage.yml) разбирает
новые обращения без команды `@claude`.

| | |
|---|---|
| Событие | `issues`, `types: [opened]` |
| Фильтры | автор не бот; `author_association` — `OWNER`, `MEMBER` или `COLLABORATOR`; у issue нет меток `ready-for-agent`, `ready-for-human`, `needs-info` (подготовленные скиллами тикеты не разбираются повторно) |
| Права | `contents: read`, `issues: write`, `id-token: write`; `actions/checkout` — `persist-credentials: false`; `--allowedTools` — чтение кода и `gh issue view/list/comment/edit`, `gh label list` |
| Ограничения | `timeout-minutes: 10`, `concurrency` по номеру issue |
| Результат | агент разбирает обращение по скиллу [`triage`](.agents/skills/triage), ставит категорию (`bug` / `enhancement`) и состояние `needs-triage` или `needs-info`, оставляет комментарий. `ready-for-agent` не ставит — это решение человека; код не меняет |

**Отличия от OpenCode (вариант из урока).**

- `mentions` (`/opencode`, `/oc`) → `trigger_phrase: '@claude'`, команда одна.
- `share` → нет аналога: Claude Code Action не публикует сессии по ссылке. Решение — сессии не
  публикуются; видны только комментарий агента и лог Actions. В открытом репозитории лог виден
  всем, поэтому `show_full_output` выключен (по умолчанию).
- `model: <провайдер>/<модель>` → `--model` в `claude_args`; провайдер один — Anthropic, оплата
  по подписке, без отдельного бюджета.

## MCP для агента

В `.mcp.json` — проектная конфигурация MCP для Claude Code (секретов в файле нет):

- `render` — [Render MCP](https://render.com/docs/mcp-server): статус деплоев, логи, переменные
  сервиса. Ключ берётся из переменной окружения: создайте API key в Render (Account Settings →
  API Keys) и перед запуском `claude` выполните `export RENDER_API_KEY=…`. Ключ не коммитьте.
- `playwright` — [Playwright MCP](https://github.com/microsoft/playwright-mcp): агент проходит
  сценарий Гостя и Владельца в браузере по публичной ссылке. Ключей не нужно.

При первом запуске Claude Code спросит, доверять ли серверам из `.mcp.json`.

## Коммиты

[Conventional Commits](https://www.conventionalcommits.org/ru/): `feat`, `fix`, `docs`, `chore`,
`ci`, `test`, `refactor`, `!` для breaking changes; необязательная область — `api`, `backend`,
`frontend`, `e2e`. Например: `feat(frontend): страница записи`.

---

<details>
<summary>Автоматические тесты Хекслета</summary>

Тесты запускаются на каждый коммит. За запуск отвечает файл `.github/workflows/hexlet-check.yml` — не удаляйте и не переименовывайте ни его, ни репозиторий.

</details>

## О Хекслете

[Хекслет](https://ru.hexlet.io/) — школа программирования: авторские программы обучения с практикой, поддержкой наставников и реальными проектами, которые остаются в резюме. Этот репозиторий — один из таких проектов.

### Авторевью, лимит запусков и e2e-артефакт

> Воркфлоу из этого раздела лежат черновиками в
> [`docs/agents/workflow-drafts/`](docs/agents/workflow-drafts): приложение Claude не может
> менять `.github/workflows`. Перенос — вручную, см. «Подключение» ниже.

**Авторевью — `review.yml`.** Запускается на `pull_request`
(`opened`, `synchronize`, `reopened`, `ready_for_review`), не на `pull_request_target`.
Условия: ветка этого репозитория (`head.repo.full_name == github.repository`), автор —
`OWNER`/`MEMBER`/`COLLABORATOR` или `claude[bot]`, не черновик, ветка не `release-please--*`.
`concurrency: review-<номер PR>` с `cancel-in-progress: true`, `timeout-minutes: 20`.

- Job `review` (права `contents`, `issues`, `pull-requests`, `actions`, `checks`, `statuses` —
  только чтение). Шаг без модели собирает в `ctx/` описание PR, diff, статусы CI и тексты тикетов
  по ссылкам из описания. Затем обычный CLI `claude -p` (версия закреплена, токен —
  `CLAUDE_CODE_OAUTH_TOKEN`) с `--allowedTools "Read,Grep,Glob"` и `gh pr view/diff/checks`,
  `gh issue view`, `gh run view/list`; Bash целиком и `gh api` не разрешены. Промпт включает
  [`REVIEW.md`](REVIEW.md) и требует сверить PR со спецификацией и согласованием.
  Результат — `review.md`, передаётся артефактом.
- Job `publish` (без модели, `needs: review`, `pull-requests: write`) публикует его через
  `gh pr comment --body-file`, указывая SHA, к которому относится ревью.
- Нет секрета — шаг падает с причиной `infra` до вызова модели.

**Шаблон PR** — [`.github/pull_request_template.md`](.github/pull_request_template.md): исходное
обращение, спецификация, тикеты, согласование; проверки (команды, ссылки на прогоны, SHA,
чекбоксы); риск; откат.

**Лимит запусков — `claude.yml`.** В `run-name` — номер issue/PR. Первый шаг `Limit`, до
установки инструментов и вызова action, по API Actions считает прогоны `claude.yml` с этим
номером, у которых job `claude` не `skipped`, по всем `run_attempt` (повтор, отмена и таймаут
тратят попытку; текущий прогон входит в счёт). Лимит — 3 на PR за всё время; для обычных issue не
применяется. Шаг агента имеет свой `timeout-minutes: 25` (у job — 30).

Job `report` (без модели, `needs: claude`, `if: always()`, не на успех) читает шаги прогона и
публикует в тот же issue/PR причину, head SHA, ссылку на лог и статус «нужен человек»:

| Причина | Когда |
|---|---|
| `limit_exhausted` | шаг `Limit` упал |
| `infra` | упал шаг до агента (checkout, mise, install, нет секрета) |
| `timeout` | шаг `Agent` отменён по своему таймауту |
| `agent_failed` | шаг `Agent` завершился `failure` |
| иначе | «причина не определена, смотрите лог» |

**e2e для PR — job `e2e-pr` в `ci.yml`** (в дополнение к `check`, только `pull_request`):
checkout `ref: ${{ github.event.pull_request.head.sha }}`, `git rev-parse HEAD > sha.txt`, сборка,
Playwright с `PW_TRACE=on` (в `playwright.config.ts` `trace: 'on'`; без переменной остаётся
`retain-on-failure`). Артефакт `e2e-<sha>` (всегда, `if: always()`): `sha.txt`, `e2e-result.txt`
(`passed`/`failed`), trace и HTML-отчёт. SHA в имени артефакта должен совпадать с head PR.

**Подключение.** Из корня репозитория, с правами на workflows:

```bash
cp docs/agents/workflow-drafts/review.yml .github/workflows/review.yml
cp docs/agents/workflow-drafts/claude.yml .github/workflows/claude.yml
# содержимое ci.e2e-pr.yml (без первой строки-комментария) — в jobs: файла ci.yml
```
После этого черновики можно удалить.
