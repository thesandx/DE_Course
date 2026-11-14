# The GCP course

This folder holds the GCP Professional Data Engineer course. The course is a game: the five exam domains are five metro lines, each section of the exam guide is a station, and each line ends with a boss round.

The content comes from the owner's PDE Exam Lab module. A one-time script converted it into these TypeScript files. Edit the files here directly; the script is not part of the repository.

## Files

| File                 | What it holds                                                                       |
| -------------------- | ----------------------------------------------------------------------------------- |
| `lines/<slug>.ts`    | One line: its intro, its boss, and its stations with concepts and key points.       |
| `questions.ts`       | The question bank for boss rounds and the mock exam. Each question names a station. |
| `cards.ts`           | The flashcards. Each card names a line.                                             |
| `sprint.ts`          | The service sprint: one scenario, one correct service.                              |
| `catalog.ts`         | The study order, item ids, XP values, ranks, line progress and exam readiness.      |
| `quiz.ts`            | Answer checks, the seeded shuffle, the boss round and the mock exam draw.           |
| `summary.ts`         | The dashboard numbers: XP, rank, streak, daily goal and readiness.                  |
| `labs/<line>.ts`     | The hands-on labs of one line: one lab per station.                                 |
| `labs/index.ts`      | All labs in study order, the lab id and XP, and the setup and data steps.           |
| `diagrams/<line>.ts` | The concept diagrams of one line, keyed by station slug.                            |
| `diagrams/index.ts`  | All diagrams, and the lookup for one concept.                                       |

The types are in [`types/gcp.ts`](../../../types/gcp.ts).

## Rules for content

1. Every key point has one check. A check is `choice`, `match` or `order`.
2. In a `choice` check or a bank question, `answers` holds the indexes of the correct options, from 0. The app shuffles the options, so the position in the file does not matter.
3. In a `match` check, each pair is in the correct order. The app scrambles the right column.
4. In an `order` check, the steps are in the correct order. The app scrambles them.
5. Prose fields use the dialect in [`../README.md`](../README.md#the-prose-dialect).
6. Run `pnpm test lib/course/gcp`. The tests check slugs, answer indexes and the question count of each line.

## Item ids and XP

| Item          | Id                       | XP                        |
| ------------- | ------------------------ | ------------------------- |
| Station       | `station:<station>`      | 30, plus 10 per key point |
| Boss round    | `boss:<line>`            | 100                       |
| Flashcard     | `card:<line>:<index>`    | 2                         |
| Sprint target | `sprint:10`, `sprint:20` | 25, 50                    |
| Mock exam     | `mock:pass`              | 250                       |
| Hands-on lab  | `lab:<station>`          | 50                        |

Do not rename a slug after release, and do not reorder `cards.ts`. A card id is its position in its line's deck.

## Game rules

- A boss round opens when every station on its line is done. It has 10 questions and passes at 70%.
- The mock exam draws 50 questions, split by the exam weight of each line. It passes at 70%.
- The sprint gives 60 seconds. The targets are 10 and 20 correct answers.
- The daily goal is 100 XP. The streak counts days with at least one finished item.
- Exam readiness is the progress of each line, weighted by the exam weight of its domain.
- The ranks go from Trainee (0 XP) to Exam-ready (2,000 XP). The course has about 2,100 XP without the labs. The 19 labs add 950 XP as a bonus.
- A lab opens when its station is done. Labs do not count toward exam readiness.

## Hands-on labs

Each station has one lab at `/gcp/labs/<station>`. The learner does the station's concepts in their own Google Cloud project, in the console or in Cloud Shell. The list of all labs is at `/gcp/labs`.

The page builds two steps for every lab. The first step selects the project, exports the variables in `vars` and enables the APIs in `apis`. The second step writes the sample files with a quoted heredoc, so the learner needs no download. The page also offers each file at `/api/lab-files/<station>/<file>`.

Every step can be done in the console (UI). A step card shows the **Console (UI)** tab first, the **Cloud Shell** tab second, and then the SQL. Under the check, a "See it in the console" box tells the learner which console page shows the result. The "Prove nothing is left" section has the same two tabs: `verifyConsole` and `verify`.

The learner ticks each step. The ticks stay in the browser (`localStorage`) because they are a convenience. The lab is saved to the learner's tracker only when the learner finishes it, and the finish button stays locked until every cleanup step is ticked.

### Rules for a lab

1. Practise every concept of the station. Put the concept numbers in `concepts` on each step. The tests fail when a concept has no step.
2. Make the lab self-contained. Put sample data in `files`, or make it in SQL. Do not depend on data outside the lab, except public datasets and public Google sample buckets.
3. Start every resource name with the lab prefix, such as `lab11` for station 1.1. The cleanup and `verify` use the prefix to find what is left.
4. Delete every resource in `cleanup`. List each one in `creates`. Say in `cost` what the lab costs, and give free tier hints in `freeTier`.
5. Use `us-central1` for every resource, unless a public dataset needs the `US` location.
6. Give each step a `check`: what the learner sees when the step worked.
7. Set every shell variable before a step reads it: in `vars`, or with `export` in an earlier step. The tests check this.
8. Give every step that has `shell` or `sql` a `console` path too, and give every cleanup step a `console` path. Name the menu, the page, the button and the value for each field. When the console cannot do a step, such as a local emulator run, say so in `console` and say how to open Cloud Shell. The tests check this.
9. Give every step that has `console` a `see`: the console page and tab that show the result. Give every lab a `verifyConsole`: the console pages that prove nothing is left.
10. Write `console` steps as a numbered list. Write `shell` and `sql` as plain text. In a template literal, write `\\` for a line continuation and `\${` for a literal `${`.

## Diagrams

Every concept on a station opens with at least one diagram. The station page shows it above the concept text. The diagrams are data in `diagrams/<line>.ts`. The component [`components/gcp/ConceptDiagram.tsx`](../../../components/gcp/ConceptDiagram.tsx) draws them in HTML with the design tokens. So a diagram follows light and dark mode, stays readable on a phone, and reaches a screen reader.

A diagram has a `kind`. Each kind reads top to bottom on a phone and spreads out from `md` up.

| Kind       | Use it for                                                                   |
| ---------- | ---------------------------------------------------------------------------- |
| `flow`     | Steps in order, with labels on the arrows and an optional fan-out at the end |
| `decision` | Questions in order. The first "yes" gives the answer                         |
| `layers`   | A stack or a hierarchy. `nested` indents each band inside the one above      |
| `spectrum` | Options on one axis, such as cheap to costly                                 |
| `compare`  | Two to four options side by side, with points                                |
| `hub`      | One thing in the centre and the things around it                             |
| `timeline` | Lanes on one time axis, with spans, dots and marks (positions in percent)    |
| `grid`     | Storage blocks, and the blocks a query reads                                 |
| `boundary` | A perimeter, and which calls from outside it are blocked or allowed          |
| `pairs`    | One thing on the left becomes one thing on the right                         |

### Rules for a diagram

1. Give every concept at least one diagram. Set `concept` to the concept number, from 1. The tests fail when a concept has none.
2. Show the mechanism or the decision, not a copy of the text. Keep labels short: a phone is 320px wide.
3. Write a `caption` of one or two sentences: what the picture shows and the exam trap to remember.
4. Use a `tone` for meaning: `hard` for wrong or costly, `easy` for right or safe, `brand` for the answer to remember. Use the other tones to tell boxes apart.
5. Text fields use the inline markers only («code», **bold**). Do not write backticks or `${`.
6. Run `pnpm test lib/course/gcp components/gcp`. The tests check concepts, positions, grid cells and unique labels, and render every diagram.

## Explainer videos

Every station has one explainer video of two to three minutes. The station page shows it under the header, before the concepts. The DE course uses the same player and the same build, so the files and the rules are in [`lib/course/README.md`](../README.md#explainer-videos).

A station video starts with the mission of the station. It ends with a recap and a pointer to the checkpoint.
