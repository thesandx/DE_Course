import type { Problem } from '@/types/course';

/**
 * Twelve more behavioral questions. Each model answer ends with the follow-up
 * questions a bar raiser asks to test the story, and what a strong reply to
 * each one contains: a story that survives three "why?" questions is the
 * real bar. They join the behavioral track in `behavioral.ts`.
 */

const ALL: Problem['companies'] = ['uber', 'google', 'amazon', 'microsoft', 'meta', 'flipkart'];

export const behavioralDepthProblems: readonly Problem[] = [
  {
    slug: 'competing-stakeholders',
    title: 'Five teams want your team this quarter',
    track: 'behavioral',
    kind: 'behavioral',
    difficulty: 'medium',
    companies: ALL,
    prompt: `
      "Tell me about a time several teams needed your team's work at once and you could not do it
      all. How did you decide?" Outline your own story, then compare it with the model answer and
      the follow-ups.
    `,
    hints: [
      'What rule did you use to rank the asks? Say it in one sentence.',
      'Who did you tell no, and how?',
      'What happened to the work you did not do?',
    ],
    answer: `
      **Situation.** Five teams asked my data platform team for work in the same quarter: a new
      fraud feature table, a finance close speed-up, two new sources and a dashboard rebuild. We
      had capacity for about two.

      **Task.** I was the tech lead and owned the plan.

      **Action.** I asked each team for the decision their ask would change and its value in
      their own numbers. I ranked by value divided by our effort, with one override: anything with
      a regulatory date goes first. The finance close had an audit date, and fraud estimated 1.2
      million USD a quarter in losses we could stop. I wrote a one-page plan with the ranking and
      the reasons, and reviewed it with the five leads together, so nobody heard the outcome
      second-hand. For the two sources, I gave the teams a self-service ingestion template and an
      hour of pairing each.

      **Result.** Both top projects shipped on time. One source team onboarded themselves with
      the template. The dashboard rebuild moved to the next quarter, and its lead agreed because
      the reason was in writing.

      **How the interviewer digs.**

      - *"Who was unhappy, and what did you do about it?"* Name the person, what they lost, and
        what you offered instead. "Everyone agreed" is not believable.
      - *"How did you check the fraud estimate?"* Say how you tested the number, for example by
        looking at last quarter's chargebacks yourself.
      - *"What would you do differently?"* A real change, such as a quarterly intake process so the
        ranking happens before the asks collide.
    `,
    signals: [
      'States the ranking rule and the data behind it',
      'Says no in the open, with the reasons in writing',
      'Offers an alternative to the teams that lose',
      'Survives "who was unhappy?" with a specific person',
      'Names a process change, not only a one-off decision',
    ],
    followUps: [
      'Who was unhappy with the plan, and what did you do?',
      'How did you check the value estimates the teams gave you?',
      'Your manager wanted a different order. What then?',
    ],
  },
  {
    slug: 'mentor-struggling-engineer',
    title: 'Help an engineer who is struggling',
    track: 'behavioral',
    kind: 'behavioral',
    difficulty: 'medium',
    companies: ALL,
    prompt: `
      "Tell me about a time you helped someone on your team improve." Outline your own story, then
      compare it with the model answer and the follow-ups.
    `,
    hints: [
      'What exactly was the gap? Be specific.',
      'What did you do each week, not only once?',
      'How did you know it worked?',
    ],
    answer: `
      **Situation.** A new engineer on my team had three pull requests reverted in his first two
      months. Reviewers were losing patience, and he had stopped asking questions.

      **Task.** I was not his manager, but I was the senior on the team, and his manager asked me
      to help.

      **Action.** I first asked him what was hard, and listened. The real gap was not skill: he did
      not know how to test a pipeline change on real data before review, so he tested on toy
      data. I paired with him for an hour twice a week for a month. In each session he drove and I
      only asked questions. I wrote down the steps we used, a test on a sample of yesterday's
      partition and a row count diff, and he turned them into a team checklist. I also asked
      reviewers to leave one comment that said what was good, not only what was wrong.

      **Result.** In the next two months he had no reverts. The checklist became part of the team's
      pull request template, and the next new hire used it in their first week.

      **How the interviewer digs.**

      - *"How did you find the real gap?"* Say what you asked and what you watched. Avoid "I
        could see he lacked confidence".
      - *"What if it had not worked?"* Say when you would have gone back to his manager, and with
        what evidence.
      - *"What did you learn about mentoring?"* For example: ask, then let them drive.
    `,
    signals: [
      'Diagnoses a specific gap before giving advice',
      'Gives a steady, repeated practice, not one talk',
      'Lets the other person own the fix',
      'Measures the result',
      'Turns the help into something the team keeps',
    ],
    followUps: [
      'How did you find what the real problem was?',
      'What would you have done if he had not improved?',
      'How do you mentor someone more senior than you?',
    ],
  },
  {
    slug: 'push-back-on-leadership',
    title: 'Push back on a request from leadership',
    track: 'behavioral',
    kind: 'behavioral',
    difficulty: 'hard',
    companies: ALL,
    prompt: `
      "Tell me about a time you pushed back on a request from someone senior to you." Outline your
      own story, then compare it with the model answer and the follow-ups.
    `,
    hints: [
      'What was the risk if you just did it?',
      'Did you offer another way to reach their goal?',
      'Who decided in the end?',
    ],
    answer: `
      **Situation.** A director asked my team to give the marketing team a table of riders with
      their phone numbers and trip history, by Friday, for a campaign.

      **Task.** I owned the warehouse access. The request broke our privacy policy: phone numbers
      were restricted data, and riders had not agreed to that use.

      **Action.** I did not refuse in an email. I asked the director for 15 minutes the same day
      and started with the goal: more trips from lapsed riders. I explained the risk in her terms:
      a privacy breach would stop the campaign and could bring a regulator fine. Then I offered a
      way to reach the goal: we could build the audience in the warehouse and send it to the
      messaging service as rider ids, so marketing never sees a phone number. I brought the
      privacy lead into the conversation so it was not my opinion against hers.

      **Result.** She agreed. The campaign went out one day later than planned, on rider ids. The
      privacy lead turned the pattern into the standard way to build campaign audiences.

      **How the interviewer digs.**

      - *"What if she had said 'do it anyway'?"* Say the escalation path: the privacy lead and your
        manager, in writing, and that you would not run it yourself.
      - *"How did you keep the relationship?"* For example, you delivered the alternative fast.
      - *"Have you ever pushed back and been wrong?"* Have a second, shorter story ready.
    `,
    signals: [
      'Pushes back early and in person, starting from their goal',
      'Explains the risk in the other person’s terms',
      'Offers an alternative that reaches the goal',
      'Brings in the right owner instead of making it personal',
      'Knows the escalation line they would not cross',
    ],
    followUps: [
      'What if she had told you to do it anyway?',
      'Tell me about a time you pushed back and were wrong.',
      'How did the relationship look a month later?',
    ],
  },
  {
    slug: 'deliver-bad-news',
    title: 'Tell stakeholders the project will be late',
    track: 'behavioral',
    kind: 'behavioral',
    difficulty: 'medium',
    companies: ALL,
    prompt: `
      "Tell me about a time a project you led was going to miss its date. What did you do?" Outline
      your own story, then compare it with the model answer and the follow-ups.
    `,
    hints: [
      'When did you know, and when did you tell people?',
      'What options did you give them?',
      'What did you change so it does not happen again?',
    ],
    answer: `
      **Situation.** We were moving 300 Airflow DAGs to a new cluster, with a date set by the end of
      the old data center lease. Six weeks before the date, we had moved 120.

      **Task.** I led the migration and owned the date.

      **Action.** I measured our real rate over the last three weeks: 18 DAGs a week, so 180 more
      would need ten weeks, not six. I told my manager and the infrastructure lead that day, not at
      the next status meeting. I brought three options with costs: extend the lease one month (40
      thousand USD), borrow two engineers from another team, or move only the 150 DAGs that run
      daily and switch the others off for a month. I recommended the last option, because 90 of the
      remaining DAGs had not run in a quarter.

      **Result.** Leadership chose it. We moved the active DAGs by the date, turned off 70 unused
      DAGs for good, and moved the last 40 the following month. The lease was not extended.

      **How the interviewer digs.**

      - *"Why did you not see it earlier?"* Be honest: for example, you tracked tasks done, not the
        rate, and you now track the rate from week one.
      - *"How did people react?"* Name the hardest reaction and how you handled it.
      - *"What did the options cost you personally?"* Show that you chose the right option, not the
        one that looked best for you.
    `,
    signals: [
      'Measures the real rate instead of hoping',
      'Tells people as soon as they know, not at the next meeting',
      'Brings options with costs and a recommendation',
      'Takes honest ownership of why it was late',
      'Changes how they track the next project',
    ],
    followUps: [
      'Why did you not see the slip earlier?',
      'Who reacted worst, and what did you say?',
      'What do you track now from the first week of a project?',
    ],
  },
  {
    slug: 'inherit-failing-project',
    title: 'Take over a project that is failing',
    track: 'behavioral',
    kind: 'behavioral',
    difficulty: 'hard',
    companies: ALL,
    prompt: `
      "Tell me about a time you took over something that was in trouble." Outline your own story,
      then compare it with the model answer and the follow-ups.
    `,
    hints: [
      'What did you do in the first two weeks, before you changed anything?',
      'What did you stop?',
      'How did you treat the people who built it?',
    ],
    answer: `
      **Situation.** I took over a real-time inventory pipeline after its lead left. It missed its
      freshness target most days, the on-call rota had paged 60 times in a month, and the store
      operations team no longer trusted it.

      **Task.** My manager asked me to make it reliable within a quarter.

      **Action.** For two weeks I changed nothing. I read every page from the last month and sorted
      them by cause: 70 percent came from one source that resent whole files. I met the store
      operations lead and asked which numbers they used. Then I made three changes, in order:
      deduplicate the resent files at ingestion, cut the alerts from 14 to 4 that meant a person
      had to act, and publish a freshness status on the dashboard so operations could see when to
      trust it. I stopped a planned rewrite to a new engine, because the engine was not the
      problem. I kept the original engineers on the work and gave them the credit for the fixes.

      **Result.** In six weeks pages fell from 60 to 5 a month and freshness met its target on 29
      of 30 days. Operations put the dashboard back into their morning meeting.

      **How the interviewer digs.**

      - *"Why not the rewrite?"* Show that the data said the cause was the source, not the engine.
      - *"What did the team think of you?"* Show respect for people who built it under pressure.
      - *"What was still broken when you left it?"* Name it. Nothing is ever fully fixed.
    `,
    signals: [
      'Diagnoses with data before changing anything',
      'Fixes the biggest cause first and stops a costly distraction',
      'Rebuilds the users’ trust with visible status',
      'Treats the original team with respect',
      'Is honest about what was still not fixed',
    ],
    followUps: [
      'Why did you stop the rewrite?',
      'How did the original engineers feel about you taking over?',
      'What was still broken when you moved on?',
    ],
  },
  {
    slug: 'cut-platform-cost',
    title: 'Lead a cost cut on the data platform',
    track: 'behavioral',
    kind: 'behavioral',
    difficulty: 'medium',
    companies: ['amazon', 'google', 'microsoft', 'uber', 'flipkart', 'walmart'],
    prompt: `
      "Tell me about a time you saved money for your company." Outline your own story, then compare
      it with the model answer and the follow-ups.
    `,
    hints: [
      'Where did the money actually go? How did you find out?',
      'What did you have to convince other teams to change?',
      'How did you make sure the saving lasted?',
    ],
    answer: `
      **Situation.** Our warehouse bill grew 40 percent in two quarters, to 180 thousand USD a
      month, and finance asked for a plan.

      **Task.** I volunteered to lead it, across six teams that owned the queries.

      **Action.** I tagged every query with its team and job, and built a cost table by owner. Three
      findings: 35 percent of spend was dashboards refreshing every 15 minutes that people opened
      once a day, 20 percent was full-table scans on tables without partition filters, and a
      forgotten test job ran every hour. I sent each team its own top five queries with a
      suggested fix and the money it saves. I did not ask them to change everything; I asked for
      the top five. We added a partition-filter requirement on the largest tables and a weekly cost
      report by team.

      **Result.** The bill fell to 115 thousand USD a month in two months, and stayed there for the
      next two quarters because each team saw its own number every week.

      **How the interviewer digs.**

      - *"Which team resisted, and why?"* For example, the team whose dashboard was in a CEO
        review. Say how you found a refresh time that worked for them.
      - *"Did any saving hurt anyone?"* Name a trade-off and how you checked it.
      - *"How did you prove the saving?"* Compare with the trend, not only with last month.
    `,
    signals: [
      'Finds where the money goes with attribution, not guesses',
      'Gives each owner a short list with the saving',
      'Adds a guardrail so the cost does not come back',
      'Measures the saving against the trend',
      'Handles the team that resisted',
    ],
    followUps: [
      'Which team resisted, and how did you handle it?',
      'Did any of the savings make something worse?',
      'How did you show the saving was real and lasting?',
    ],
  },
  {
    slug: 'simplify-by-removing',
    title: 'Make something simpler by removing it',
    track: 'behavioral',
    kind: 'behavioral',
    difficulty: 'medium',
    companies: ['amazon', 'google', 'meta', 'microsoft'],
    prompt: `
      "Tell me about a time you made something simpler." Amazon calls this Invent and Simplify.
      Outline your own story, then compare it with the model answer and the follow-ups.
    `,
    hints: [
      'Removing is often simpler than building.',
      'Who depended on the thing you removed?',
      'How did you make sure nothing broke?',
    ],
    answer: `
      **Situation.** We had three pipelines that computed "active users" for three teams, with three
      definitions. Every quarterly review started with an argument about which number was right.

      **Task.** I owned one of the three and offered to fix the problem for all of them.

      **Action.** I wrote the three definitions side by side and showed that two differed only in
      time zone and the third counted test accounts. I agreed one definition with the three
      analytics leads in one meeting, with the product director deciding the last open point. I
      built it once as a dbt model with tests, ran it next to the old ones for four weeks and
      published the difference each week. Then I removed the two other pipelines and their 11
      dashboards, after I moved their users.

      **Result.** One number in every review. Two pipelines and about 600 lines of SQL fewer, and the
      on-call rota lost one source of pages. The next quarterly review had no argument about the
      number.

      **How the interviewer digs.**

      - *"Who lost something?"* For example, a team lost their own definition. Say how you handled
        it.
      - *"How did you find all the users of the old pipelines?"* Query logs, not memory.
      - *"What would you not simplify?"* Show judgement: some differences are real.
    `,
    signals: [
      'Simplifies by removing, not only by building',
      'Gets one agreed definition with a named decider',
      'Runs old and new side by side before removing',
      'Finds the users from logs before switching off',
      'Measures the simplification',
    ],
    followUps: [
      'Who lost something in this change, and how did they take it?',
      'How did you make sure nobody still used the old pipelines?',
      'Give an example of a complexity you decided to keep.',
    ],
  },
  {
    slug: 'changed-my-mind',
    title: 'A time you were wrong and changed your mind',
    track: 'behavioral',
    kind: 'behavioral',
    difficulty: 'medium',
    companies: ALL,
    prompt: `
      "Tell me about a time you were sure of a technical opinion and changed your mind." Outline
      your own story, then compare it with the model answer and the follow-ups.
    `,
    hints: [
      'What exactly did you believe, and why?',
      'What evidence changed it?',
      'What did you do after you changed your mind?',
    ],
    answer: `
      **Situation.** A colleague proposed moving our event ingestion from hourly batches to a
      streaming job. I argued against it in the design review: streaming would cost more and our
      users only read daily reports.

      **Task.** As the reviewer, I had to give a clear yes or no.

      **Action.** She asked me to look at one thing before deciding: the late-data rate. I ran the
      numbers myself. 8 percent of events arrived after the hourly batch closed, and our backfill
      job that fixed them caused half of our weekend pages. A streaming job with event-time windows
      would handle the late events in one place. I had compared cost only, not the cost of the
      backfills and the pages. I said in the review thread that I was wrong and why, and I
      supported the proposal with two conditions: a cost limit and a staged rollout.

      **Result.** The streaming job went live in a month, the backfill job was deleted, and weekend
      pages fell by half. Total cost rose 10 percent, inside the limit.

      **How the interviewer digs.**

      - *"Why were you sure at first?"* Show your reasoning was sensible, just incomplete.
      - *"How did you say you were wrong?"* In the same place you argued, in writing.
      - *"What do you check now before you argue?"* A real change in habit.
    `,
    signals: [
      'Describes the original view as reasonable, not silly',
      'Changes the mind because of evidence they checked themselves',
      'Admits it publicly, where they argued',
      'Adds conditions that keep the risk in check',
      'Names a change in how they review',
    ],
    followUps: [
      'Why were you so sure at the start?',
      'How did your colleague react when you changed your view?',
      'What do you check now before arguing in a review?',
    ],
  },
  {
    slug: 'worst-on-call-night',
    title: 'Your hardest on-call night',
    track: 'behavioral',
    kind: 'behavioral',
    difficulty: 'medium',
    companies: ALL,
    prompt: `
      "Tell me about the hardest production problem you handled on call." Outline your own story,
      then compare it with the model answer and the follow-ups.
    `,
    hints: [
      'What was the impact on customers, in numbers?',
      'What did you do first: fix, or stop the damage?',
      'What changed afterwards?',
    ],
    answer: `
      **Situation.** At 02:00 I was paged: the surge pricing feature store had not updated for 40
      minutes, and surge multipliers in three cities were frozen at peak values.

      **Task.** I was on call for the feature pipelines.

      **Action.** First I stopped the damage: I asked the pricing on-call to switch those cities to
      the fallback multiplier, which took five minutes. Then I looked for the cause. The streaming
      job was healthy but writing nothing; a Kafka partition had a poison message that failed
      deserialization, and the job retried it forever. I moved the message to a dead-letter topic,
      the job caught up in ten minutes, and pricing switched back. I posted updates in the incident
      channel every 15 minutes, even when the update was "still looking".

      **Result.** Riders saw wrong prices for 45 minutes in three cities. In the postmortem I
      proposed a dead-letter queue for every consumer and an alert on "no writes for 5 minutes",
      not only on errors. Both shipped in two weeks.

      **How the interviewer digs.**

      - *"Why did the existing alerts not catch it?"* The job was healthy; nothing measured output.
      - *"What would you do differently that night?"* For example, page the pricing on-call sooner.
      - *"How did you feel?"* A calm, honest answer is fine. Show the process that kept you calm.
    `,
    signals: [
      'Stops the customer impact before finding the cause',
      'Explains the root cause clearly',
      'Communicates on a schedule during the incident',
      'Quantifies the impact honestly',
      'Turns it into a fix for the whole class of failure',
    ],
    followUps: [
      'Why did the existing alerts not catch it?',
      'What would you do differently that night?',
      'How do you stay calm in an incident like that?',
    ],
  },
  {
    slug: 'raise-quality-bar',
    title: 'Raise the quality bar on your team',
    track: 'behavioral',
    kind: 'behavioral',
    difficulty: 'hard',
    companies: ['amazon', 'google', 'meta', 'microsoft', 'uber'],
    prompt: `
      "Tell me about a time you raised the standard of your team's work." Amazon calls this Insist on
      the Highest Standards. Outline your own story, then compare it with the model answer and the
      follow-ups.
    `,
    hints: [
      'What was the standard before, in numbers?',
      'How did you get people to want the change?',
      'What did it cost in speed?',
    ],
    answer: `
      **Situation.** Our dbt project had 400 models and tests on 30 of them. Analysts found about two
      data bugs a week in production dashboards.

      **Task.** I was a senior engineer on the team. Nobody asked me to fix it.

      **Action.** I did not write a rule first. I took the last 20 bugs and showed in a team meeting
      that 16 would have been caught by four kinds of test: unique keys, not-null keys, accepted
      values and row-count change. I added those tests to the 50 most-used models myself in two
      weeks, so the team saw the value before being asked for work. Then we agreed a rule together:
      a new or changed model needs the four tests, checked in CI. I made it easy: a macro that adds
      the four tests from one line.

      **Result.** Production data bugs fell from about 8 a month to 2 in the next quarter. Pull
      requests took about 10 percent longer to review in the first month and then went back to
      normal.

      **How the interviewer digs.**

      - *"Who disagreed?"* Somebody always says it slows them down. Say how you answered with data.
      - *"How did you choose the four tests?"* From the bugs, not from a blog post.
      - *"Where did you lower the bar on purpose?"* Show judgement, for example no tests on
        throwaway exploration models.
    `,
    signals: [
      'Starts from evidence of the current cost',
      'Does the first part of the work themselves',
      'Agrees the rule with the team and automates it',
      'Measures both the gain and the cost in speed',
      'Shows where they chose not to raise the bar',
    ],
    followUps: [
      'Who disagreed, and how did you answer them?',
      'How did you choose which tests to require?',
      'Where did you decide a lower bar was fine?',
    ],
  },
  {
    slug: 'learn-fast',
    title: 'Learn a new technology under time pressure',
    track: 'behavioral',
    kind: 'behavioral',
    difficulty: 'easy',
    companies: ALL,
    prompt: `
      "Tell me about a time you had to learn something new quickly to deliver." Outline your own
      story, then compare it with the model answer and the follow-ups.
    `,
    hints: [
      'What did you need to know, and what could you skip?',
      'How did you check your understanding?',
      'What did you share with others afterwards?',
    ],
    answer: `
      **Situation.** Our team had to deliver a change data capture feed from a PostgreSQL database
      into the lake in three weeks. Nobody on the team had used Debezium or Kafka Connect.

      **Task.** I took the task.

      **Action.** I listed what I had to know to ship, and what could wait. I had to know how
      Debezium reads the write-ahead log, what happens to a replication slot when the connector
      stops, and how snapshots work. I could skip most of the Kafka Connect configuration. I built
      a test setup on my laptop with Docker in a day, then broke it on purpose: stopped the
      connector for an hour, changed a column type, restarted the database. Each break taught me
      a failure we would see in production. I asked a database engineer to review my notes on the
      replication slot, because a slot that grows can fill the database disk.

      **Result.** The feed shipped in two and a half weeks, with an alert on replication slot lag
      from day one. I ran a one-hour session for the team with the break-it exercises.

      **How the interviewer digs.**

      - *"What did you get wrong at first?"* A specific misunderstanding and how you found it.
      - *"How did you know you knew enough?"* The failure tests passed.
      - *"How do you keep learning normally?"* A habit, not a list of courses.
    `,
    signals: [
      'Separates what must be learned now from what can wait',
      'Learns by breaking things on purpose',
      'Asks an expert to check the risky part',
      'Ships with the failure modes covered',
      'Shares what they learned',
    ],
    followUps: [
      'What did you misunderstand at first?',
      'How did you know you knew enough to ship?',
      'How do you keep learning when there is no deadline?',
    ],
  },
  {
    slug: 'say-no-to-scope',
    title: 'Cut scope to hit a date',
    track: 'behavioral',
    kind: 'behavioral',
    difficulty: 'medium',
    companies: ALL,
    prompt: `
      "Tell me about a time you delivered by cutting scope." Outline your own story, then compare it
      with the model answer and the follow-ups.
    `,
    hints: [
      'What was the one thing the users really needed?',
      'Who agreed to the cut?',
      'Did the cut part ever ship?',
    ],
    answer: `
      **Situation.** We were building a seller analytics portal for a marketplace launch in eight
      weeks. The spec had 14 reports, row-level security, CSV export and alerts.

      **Task.** I was the tech lead, and by week three it was clear we would deliver about half.

      **Action.** I interviewed five sellers in the pilot group and asked what they would open on
      the first Monday. All five named the same three reports: sales, returns and payouts. I
      proposed to the product manager that we ship those three with row-level security, which was
      not optional, and drop export and alerts until after launch. I wrote the cut list in the
      launch document with the reason for each item, and the product manager and the launch lead
      signed it.

      **Result.** The portal launched on the date with three reports. 70 percent of pilot sellers
      used it in the first week. Export shipped four weeks later. Alerts never shipped, because no
      seller asked for them, which saved about three weeks of work.

      **How the interviewer digs.**

      - *"How did you decide what was not optional?"* Security and correctness are never cut.
      - *"Who was unhappy?"* For example, the product manager who had promised alerts to a large
        seller. Say how you helped.
      - *"Would you cut the same things again?"* Yes, and the alerts data is the proof.
    `,
    signals: [
      'Finds the core need from users, not from the spec',
      'Never cuts security or correctness',
      'Gets the cut agreed and written down by the owners',
      'Ships on the date with the core',
      'Checks afterwards whether the cut items mattered',
    ],
    followUps: [
      'How did you decide which parts could not be cut?',
      'Who was unhappy about the cut, and what did you do?',
      'Did you ever regret a scope cut?',
    ],
  },
];
