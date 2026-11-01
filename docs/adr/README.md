# Architecture Decision Records

An ADR captures **one** significant decision: the context that forced it, what was chosen, and what it costs. Months later, when someone asks "why is it done this way?", the ADR answers instead of git blame.

## When to write one

Write an ADR when a decision:

- is expensive to reverse (a database, a framework, an auth model)
- affects how the whole team works (folder structure, a testing strategy)
- rejects an obvious alternative (and someone will later ask why)
- will outlive the people who made it

Do **not** write one for a routine choice with an obvious answer. An ADR per pull request devalues the ones that matter.

## How

1. Copy [`0000-template.md`](./0000-template.md).
2. Number it sequentially: `0005-use-cloud-sql-for-persistence.md`.
3. Write it in the PR that makes the change, not afterwards.
4. Never edit an accepted ADR to change its decision. Write a new one that supersedes it and link both ways. The record of the earlier decision is the valuable part.

## Status values

| Status                 | Meaning                                |
| ---------------------- | -------------------------------------- |
| Proposed               | Under discussion; not yet acted on     |
| Accepted               | Decided and in effect                  |
| Deprecated             | No longer applies, nothing replaced it |
| Superseded by ADR-NNNN | Replaced by a later decision           |

## Index

| ADR                                                                         | Title                                                                           | Status   |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | -------- |
| [0001](./0001-use-cloud-run-for-hosting.md)                                 | Use Cloud Run for hosting                                                       | Accepted |
| [0002](./0002-use-workload-identity-federation.md)                          | Use Workload Identity Federation instead of service account keys                | Accepted |
| [0003](./0003-scope-workload-identity-to-the-github-owner.md)               | Scope the WIF provider to the GitHub owner                                      | Accepted |
| [0004](./0004-use-firestore-and-cloud-storage.md)                           | Use Firestore and Cloud Storage for data and files                              | Accepted |
| [0005](./0005-use-firebase-auth-for-sign-in.md)                             | Use Firebase Auth for sign-in, with server-side session cookies                 | Accepted |
| [0006](./0006-store-course-content-in-code-and-progress-in-one-document.md) | Store course content in code and progress in one document per learner           | Accepted |
| [0007](./0007-adopt-the-loop-ready-visual-language.md)                      | Adopt the Loop Ready visual language in place of Mochi                          | Accepted |
| [0008](./0008-host-several-courses-with-one-learner-document.md)            | Host several courses, with one learner document that holds a tracker per course | Accepted |
