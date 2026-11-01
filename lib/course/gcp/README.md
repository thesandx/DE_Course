# The GCP course

This folder holds the GCP Professional Data Engineer course. The course is a game: the five exam domains are five metro lines, each section of the exam guide is a station, and each line ends with a boss round.

The content comes from the owner's PDE Exam Lab module. A one-time script converted it into these TypeScript files. Edit the files here directly; the script is not part of the repository.

## Files

| File              | What it holds                                                                       |
| ----------------- | ----------------------------------------------------------------------------------- |
| `lines/<slug>.ts` | One line: its intro, its boss, and its stations with concepts and key points.       |
| `questions.ts`    | The question bank for boss rounds and the mock exam. Each question names a station. |
| `cards.ts`        | The flashcards. Each card names a line.                                             |
| `sprint.ts`       | The service sprint: one scenario, one correct service.                              |
| `catalog.ts`      | The study order, item ids, XP values, ranks, line progress and exam readiness.      |
| `quiz.ts`         | Answer checks, the seeded shuffle, the boss round and the mock exam draw.           |
| `summary.ts`      | The dashboard numbers: XP, rank, streak, daily goal and readiness.                  |

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

Do not rename a slug after release, and do not reorder `cards.ts`. A card id is its position in its line's deck.

## Game rules

- A boss round opens when every station on its line is done. It has 10 questions and passes at 70%.
- The mock exam draws 50 questions, split by the exam weight of each line. It passes at 70%.
- The sprint gives 60 seconds. The targets are 10 and 20 correct answers.
- The daily goal is 100 XP. The streak counts days with at least one finished item.
- Exam readiness is the progress of each line, weighted by the exam weight of its domain.
- The ranks go from Trainee (0 XP) to Exam-ready (2,000 XP). The course has about 2,100 XP in all.
