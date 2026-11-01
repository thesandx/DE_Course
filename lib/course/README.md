# Course content

This folder holds the courses of the Loop Ready platform and the pure functions that pages use to read them. The reasons for this design are in [ADR-0006](../../docs/adr/0006-store-course-content-in-code-and-progress-in-one-document.md) and [ADR-0008](../../docs/adr/0008-host-several-courses-with-one-learner-document.md).

The platform has these courses:

- **DE** (`/de`): the senior data engineering course. Its tracks, lessons, problems and loop guides are in this folder.
- **GCP** (`/gcp`): GCP Professional Data Engineer exam prep, as a metro map game. Its content and rules are in [`gcp/`](./gcp/README.md).
- **K8s**: listed on the hub, not open yet.

A learner joins each course separately. Each course keeps its own tracker in `learners/{uid}`.

## Files

| File               | What it holds                                                                   |
| ------------------ | ------------------------------------------------------------------------------- |
| `tracks/<slug>.ts` | One track. It exports `track` (the lessons) and `problems`.                     |
| `catalog.ts`       | The study order, the lookups, XP per item, track progress and loop readiness.   |
| `companies.ts`     | The Uber and Google loop guides: rounds and the weight of each track.           |
| `markdown.ts`      | The parser for the prose dialect below.                                         |
| `progress.ts`      | Item ids, XP values, levels, streaks, the activity grid and the learner record. |
| `courses.ts`       | The course list: slugs, names, hues and links. Safe for client components.      |
| `rules.ts`         | The item check and the XP table of each course.                                 |
| `hub.ts`           | The numbers on each course card of the hub.                                     |
| `shell-stats.ts`   | The streak and XP that the app shell shows for the current course.              |
| `gcp/`             | The GCP course. See [`gcp/README.md`](./gcp/README.md).                         |

The types are in [`types/course.ts`](../../types/course.ts).

## Rules for content

1. Write original content only. Do not copy or reword text from a course, a book or a website. The repository is public.
2. Teach for the interview. Each lesson ends with what a senior answer says. Each problem lists the signals that separate a senior answer from a mid-level one.
3. Use real numbers and current facts. Check versions, limits and prices before you write them, and write "about" when a number changes often.
4. Give each lesson at least one quick check. The learner can finish a lesson only after they answer every check correctly.
5. Run the code you show. Extract SQL and Python snippets and run them, or parse them at least.

## Add a lesson

1. Open the track module in `tracks/`.
2. Add an object to `lessons`. Give it a unique `slug` in kebab case.
3. Write `body` in the prose dialect. Keep a lesson to 10 to 18 minutes of reading.
4. Add one to three `checks`. `answer` is the index of the correct option, from 0.
5. Run `pnpm test lib/course`. The catalogue tests check slugs, answer indexes, code fences and inline markers.

## Add a problem

1. Add an object to `problems` in the track module. Set `track` to the module's track slug.
2. Set `kind` (`sql`, `coding`, `design`, `modeling`, `concept` or `behavioral`), `difficulty` and the `companies` that ask it.
3. Order `hints` from weakest to strongest.
4. Write `answer` as a strong answer, not the only answer.
5. Write three to six `signals` and one or two `followUps`.

## Add a track

1. Create `tracks/<slug>.ts` that exports `track` and `problems`.
2. Import it in `catalog.ts` and add it to `MODULES` in study order.
3. Add a weight for it to each guide in `companies.ts`.
4. Update the track count in `catalog.test.ts`.

## The prose dialect

All prose fields (`body`, `prompt`, `answer`, `overview`, `focus`) use this dialect. It is a strict subset of Markdown with two changes, so content can live inside TypeScript template literals without escapes.

| Write                               | For                                                                    |
| ----------------------------------- | ---------------------------------------------------------------------- |
| `## Heading`, `### Heading`         | Section headings. Do not use `#`: the page has its own h1.             |
| A blank line                        | A new paragraph.                                                       |
| `- item` or `1. item`               | Lists. Indent a wrapped line under its item.                           |
| `«code»`                            | Inline code. Do not use backticks.                                     |
| `**bold**`                          | Bold text.                                                             |
| `~~~sql` … `~~~`                    | A code block. Use `~~~text` for diagrams; they show no language label. |
| `\| a \| b \|` rows                 | A table. The second row is the rule row (`\|---\|---\|`).              |
| `> [!senior] Title` then `> ` lines | A callout. The kinds are `senior`, `trap`, `tip` and `example`.        |

Do not write backticks or `${` anywhere in content: they end or break the template literal.

## Progress and XP

Item ids are `lesson:<track>:<lesson>` and `problem:<slug>`. A lesson is worth 40 XP. A problem is worth 20, 40 or 60 XP for easy, medium or hard. Do not rename a slug after release: progress records store the id, and a renamed item loses its completions.

## Add a course

1. Add the slug to `COURSE_SLUGS` and an entry to `COURSES` in `courses.ts`. Set `status: 'soon'` to list it on the hub before it opens.
2. Put its content and rules in `lib/course/<slug>/`. Make item ids that include a kind, such as `station:<slug>`.
3. Add an entry to `COURSE_RULES` in `rules.ts`. The server refuses every item id that `isKnownItem` does not accept.
4. Add a case to `hubStats` in `hub.ts` and a shell stats function in `shell-stats.ts`.
5. Add a `require<Course>Learner` function to `services/learner.service.ts`.
6. Add the pages under `app/<slug>/`. Each page passes `course="<slug>"` to `CompleteButton` or `useRecordProgress`.
7. Add the course's paths to `tabsFor` in `lib/navigation.ts` if its learn and practice links differ.
8. Run `pnpm validate` and `pnpm test:e2e`.
