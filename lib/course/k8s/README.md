# The Kubernetes course

This folder holds the course "Kubernetes for Data Engineers". The course is a voyage: the learner takes one image, tugboat, from a laptop to production. Each module is a port. Each port has lessons, one mission and one incident drill.

The content of ports 0 to 11 and the capstone comes from the owner's Helmsman page. A one-time script converted it into these TypeScript files. Edit the files here directly; the script is not part of the repository. The port `data` (Data Platforms) was written for this course.

## Files

| File                  | What it holds                                                                          |
| --------------------- | -------------------------------------------------------------------------------------- |
| `ports/<slug>.ts`     | One port: its story, its lessons, its mission and its cleanup commands.                |
| `incidents.ts`        | The incidents of the drills and the final exam. Each incident names a port.            |
| `cards.ts`            | The flashcards. Each card names a port.                                                |
| `sprint.ts`           | The object sprint: one situation, one object or tool that fits.                        |
| `dojo.ts`             | The kubectl dojo: a task, one answer, and the patterns a correct command must match.   |
| `dojo-check.ts`       | The check of a typed command.                                                          |
| `cheatsheet.ts`       | Docker commands beside their Kubernetes match, and the kubectl commands of the labs.   |
| `catalog.ts`          | The route order, item ids, XP values, ranks, port progress and the exam question pool. |
| `summary.ts`          | The dashboard numbers: XP, rank, streak, daily goal and progress along the route.      |
| `lab.ts`              | The command that writes a lesson file, and the tick ids of lab steps and missions.     |
| `diagrams/<group>.ts` | The lesson diagrams, keyed by `<port>/<lesson>`.                                       |
| `diagrams/index.ts`   | All diagrams, and the lookup for one lesson.                                           |

The types are in [`types/k8s.ts`](../../../types/k8s.ts).

## A lesson

A lesson page shows these parts in this order:

1. `pain` and `fix`: the production problem, then the Kubernetes object that fixes it.
2. The diagram of the lesson.
3. `body`: the explanation. `note` corrects a common wrong idea. `docker` compares Docker with Kubernetes.
4. `files`: the manifests of the lab. Each note names a line of the file and says what the line does.
5. `lab`: the steps on the learner's own kind cluster.
6. The notes of the learner, then `checks`. The lesson counts when every check is right.

A lab step can have these flags:

| Field            | Effect on the page                                                          |
| ---------------- | --------------------------------------------------------------------------- |
| `file`           | The step shows the command that writes that lesson file with a heredoc.     |
| `predict`        | The learner must guess the result first. The commands show after the guess. |
| `breakIt`        | The step breaks something on purpose. The card has a red border.            |
| `secondTerminal` | The step runs in a second terminal.                                         |
| `cloud`          | The step runs against Google Cloud and can cost money.                      |
| `windowsFile`    | The code is the content of a Windows settings file, not a command.          |

The lab files of a port go into `~/kube-quest/<dir>`. The folder names start with `module_` because the lab commands of the source use those names.

## Rules for content

1. Every lesson has at least one check. A check is `choice`, `match` or `order`, as in the GCP course.
2. In a `choice` check, a prediction or an incident, `answers` holds the indexes of the correct options, from 0. The app shuffles the options.
3. Every lab step has a `text`. A step with a `file` names a file in `files` of the same lesson.
4. A note of a file quotes text that is in the file.
5. Each `need` pattern of a dojo task is a regular expression. The `answer` of the task must match every pattern.
6. Prose fields use the dialect in [`../README.md`](../README.md#the-prose-dialect). `code` and `output` fields are plain text.
7. Do not name a lesson `mission` or `drill`. Those names are routes of the port.
8. Run `pnpm test lib/course/k8s components/k8s`. The tests check all the rules above.

## Item ids and XP

| Item           | Id                       | XP                    |
| -------------- | ------------------------ | --------------------- |
| Lesson         | `lesson:<port>:<lesson>` | 30, plus 10 per check |
| Mission        | `mission:<port>`         | 60                    |
| Incident drill | `drill:<port>`           | 100                   |
| Flashcard      | `card:<port>:<index>`    | 2                     |
| Dojo task      | `dojo:<index>`           | 5                     |
| Object sprint  | `sprint:10`, `sprint:20` | 25 and 50             |
| Final exam     | `exam:pass`              | 250                   |

Progress records store these ids. Do not rename a slug after release. Do not reorder the cards of a port. Add a new dojo task at the end of the list.

The incident drill opens when every lesson of the port is done. The learner passes it at 70%. The capstone has no incidents and no drill. The final exam draws 25 questions from the `choice` checks and the incidents of every port. The learner passes it at 80%.

A mission has no steps. The learner ticks each task and the cleanup, and then the mission counts. The ticks stay in the browser.

## Diagrams

Every lesson has one diagram. The diagrams use the same shapes and the same component as the GCP course. The rules are in [`../gcp/README.md`](../gcp/README.md#diagrams). The key of a diagram is `<port>/<lesson>`. The tests fail when a lesson has no diagram.

## Explainer videos

Every port has one explainer video of about one minute. The port page shows it under the header. The scripts are in `scripts/course-videos/k8s/`. The files and the rules are in [`../README.md`](../README.md#explainer-videos).

## Lab commands

The lab commands of the Helmsman ports come from the source page without changes. The lab commands of the `data` port were written for this course and were not run on a cluster. Run them on kind before you change them, and correct this section when you have done so.

## The simulators

The source page has eight interactive simulators, such as a rollout and a NetworkPolicy model. Each lesson that had one keeps its name in the `sim` field. The lesson page does not show them yet.
