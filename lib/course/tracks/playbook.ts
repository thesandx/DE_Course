import type { Problem, Track } from '@/types/course';

export const track: Track = {
  slug: 'playbook',
  title: 'The senior loop playbook',
  summary:
    'How senior loops are scored, what "senior signal" means, how to run a round out loud, and the numbers to estimate with.',
  tone: 'butter',
  why: 'Candidates fail senior loops with correct answers because the interviewer could not write down evidence of seniority. This track teaches you to make that evidence obvious in every round.',
  lessons: [
    {
      slug: 'how-loops-work',
      title: 'How a senior loop is scored',
      summary: 'Know who decides, what they write down, and why each round needs clear evidence.',
      minutes: 10,
      body: `
        A senior data engineering loop is not one test. It is five or six separate samples of your
        work, each scored by a different person against a written rubric. Somebody who was not in
        the room makes the decision from those notes. At Google that is a hiring committee. At Uber
        it is a debrief led by the hiring manager. Either way, **what gets written down is what
        counts.**

        ## The usual shape

        | Stage | Typical length | What it filters for |
        |---|---|---|
        | Recruiter screen | 30 min | Level, scope, motivation, logistics |
        | Technical screen | 45 to 60 min | SQL and coding fluency under time pressure |
        | Onsite (often virtual) | 4 to 6 rounds | Coding, SQL and modeling, system design, behavioral |
        | Debrief or committee | after the loop | Consistent evidence for one level |
        | Team match and offer | days to weeks | Fit with a specific team |

        ## What an interviewer writes

        Most rubrics ask the interviewer for the same four things, in different words:

        - **Problem solving:** did you understand the problem, choose a reasonable approach and adapt
          when new information arrived?
        - **Technical depth:** was the solution correct, and did you know why it works and when it
          breaks?
        - **Communication:** could they follow your reasoning without pulling it out of you?
        - **Level signal:** did you behave like the level you applied for? For senior, that means
          you led the conversation, made trade-offs explicit and thought about operating the system.

        > [!senior] Make the note easy to write
        > End each part of an answer with one sentence the interviewer can copy into their notes:
        > "So the trade-off is freshness against cost, and I chose a 15-minute micro-batch because
        > the consumers are dashboards." That sentence is evidence.

        ## Why "mostly good" can fail

        A committee looks for **consistent** evidence at your level. One weak round with clear notes
        ("needed hints to write a window function") can outweigh three rounds of polite, vague notes
        ("did fine"). That is why this course drills the fundamentals until they are automatic, so
        you have room to show seniority on top of them.

        > [!tip] Ask the recruiter three questions
        > Which job family and level is this? Which rounds will I have, and in which language can I
        > code? Is there a data modeling round separate from system design? The answers change how
        > you split your study time.
      `,
      checks: [
        {
          question:
            'Who usually makes the final hiring decision in a structured loop like Google’s?',
          options: [
            'The last interviewer of the day',
            'A committee or debrief that reads the written feedback',
            'The recruiter',
            'The candidate’s future teammates by vote',
          ],
          answer: 1,
          why: 'Decisions come from the written notes of every interviewer. That is why each round must produce evidence somebody can write down.',
        },
      ],
    },
    {
      slug: 'senior-signals',
      title: 'What senior signal sounds like',
      summary:
        'Recognise the behaviours that separate a senior answer from a correct mid-level one.',
      minutes: 12,
      body: `
        A mid-level engineer answers the question they were asked. A senior engineer answers the
        question the business needs answered, and says what they are trading away. Interviewers
        listen for specific behaviours, not for seniority as a feeling.

        ## Mid-level versus senior, side by side

        | Situation | Mid-level answer | Senior answer |
        |---|---|---|
        | Vague prompt | Starts drawing boxes | Asks about consumers, freshness, scale and correctness first |
        | Choosing a tool | "We use Kafka" | "Kafka, because we need replay and many consumers; Pub/Sub would also work if..." |
        | Pipeline design | Happy path only | Late data, retries, backfills, schema change, on-call |
        | SQL | Correct result on the sample | Correct on duplicates, NULLs and time zones; mentions cost |
        | Behavioral | "We did X" | "I noticed X, I proposed Y, I convinced Z, and here is the measured result" |

        ## The five behaviours to show on purpose

        1. **Clarify before you build.** Two or three sharp questions, then state your assumptions.
        2. **Quantify.** Rows per day, bytes per row, peak versus average. A rough number beats none.
        3. **Name trade-offs.** Every choice costs something: latency, money, complexity, correctness.
        4. **Design for operations.** Monitoring, alerting, idempotent reruns, backfills, ownership.
        5. **Own outcomes.** In stories, the result is measured, and you were the person who moved it.

        > [!trap] Seniority is not vocabulary
        > Listing every tool you know reads as noise. One tool, chosen for a stated reason, with the
        > alternative you rejected, reads as judgement.

        ## Staff signal, briefly

        If you are interviewing above senior, the bar shifts from "built it well" to "changed how
        many teams build". Expect questions about platforms, standards, migrations across teams,
        and decisions you made with incomplete information that turned out right or wrong.

        > [!senior] Say what you would not build
        > "I would not add streaming here; a daily batch meets the SLA at a tenth of the cost" is one
        > of the strongest sentences in a design round. Restraint is a senior skill.
      `,
      checks: [
        {
          question:
            'Which answer shows the most senior signal when asked "which queue would you use"?',
          options: [
            'Kafka, it is the industry standard',
            'Kafka, Pulsar, Kinesis or Pub/Sub, they all work',
            'Kafka, because we need replay and many independent consumers; I would accept Pub/Sub if we are all-in on GCP',
            'Whatever the team already uses',
          ],
          answer: 2,
          why: 'It names the requirement that drives the choice and the alternative that would also be acceptable. That is a trade-off, not a preference.',
        },
      ],
    },
    {
      slug: 'running-the-round',
      title: 'Running a round out loud',
      summary:
        'A repeatable structure for coding, SQL and design rounds that keeps you in control.',
      minutes: 11,
      body: `
        Silence is the most expensive thing in an interview. The interviewer cannot score what they
        cannot hear. Use the same four-step rhythm in every technical round so your thinking is
        always visible.

        ## The four steps

        1. **Restate and clarify (2 to 5 min).** Say the problem back in your words. Ask about input
           size, edge cases and what "correct" means. Write the assumptions down where both of you
           can see them.
        2. **Plan out loud (3 to 5 min).** Describe the approach before you code or draw. Give the
           complexity or the cost. Ask: "Does this direction make sense before I write it?"
        3. **Build and narrate.** Talk about decisions, not keystrokes. "I am using a dictionary here
           so lookups are constant time."
        4. **Test and summarise.** Walk one normal example and one edge case through your solution.
           Then summarise the trade-offs and what you would do with more time.

        ## When you get stuck

        - Say what you know and what is blocking you. "I can get the sessions; I am unsure how to
          merge overlapping ones."
        - Solve a smaller version first, for example one user instead of all users.
        - Take a hint gracefully and use it fully. Needing one hint is normal. Ignoring it is not.

        > [!trap] Do not optimise in silence
        > Spending ten quiet minutes polishing an approach the interviewer would have accepted in
        > its simple form loses time and signal. Ship the simple version, then improve it out loud.

        ## Time boxes for a 45-minute round

        | Phase | Coding or SQL | System design |
        |---|---|---|
        | Clarify | 3 min | 5 to 8 min |
        | Plan | 5 min | 5 min (high-level diagram) |
        | Build | 25 min | 20 min (deep dives) |
        | Test and wrap up | 7 min | 7 min (failure modes, trade-offs) |
        | Your questions | 5 min | 5 min |

        > [!senior] Steer the deep dive
        > In a design round, offer the deep dive yourself: "The interesting part is late data and
        > deduplication. Shall I go deep there?" Choosing what matters is the skill being tested.
      `,
      checks: [
        {
          question: 'You are ten minutes into a coding round and stuck. What should you do first?',
          options: [
            'Stay silent and keep thinking',
            'Say what you have, what blocks you, and try a smaller version',
            'Ask for the full solution',
            'Switch to a different language',
          ],
          answer: 1,
          why: 'Narrating the block keeps the interviewer able to help and to score your reasoning. A smaller version often reveals the general approach.',
        },
      ],
    },
    {
      slug: 'estimation-numbers',
      title: 'Numbers to estimate with',
      summary: 'Size a pipeline in two minutes with a handful of round numbers you know by heart.',
      minutes: 13,
      body: `
        Estimation is not about the exact answer. It shows that you reason from requirements to
        capacity, and it decides your architecture: 10 GB a day and 10 TB a day are different systems.

        ## Round numbers worth memorising

        | Quantity | Round value |
        |---|---|
        | Seconds in a day | about 86,400, use 100,000 for quick maths |
        | Seconds in a month | about 2.6 million |
        | One event as JSON | 0.5 to 2 KB |
        | Same event in Parquet with compression | often 5 to 10 times smaller |
        | Sequential disk or object store read per worker | hundreds of MB per second |
        | Kafka partition throughput | often quoted around 10 MB/s per partition, plan conservatively |
        | Network inside a cloud region | about 1 ms round trip |

        These are rules of thumb. Say "roughly" and keep going. Interviewers care that your numbers
        are the right order of magnitude and that you use them to decide something.

        ## A worked example

        "Uber-like: 20 million trips a day, each trip emits about 200 events (GPS pings, state
        changes), each event is 1 KB."

        ~~~text
        events/day   = 20M × 200          = 4 billion
        bytes/day    = 4B × 1 KB          = 4 TB raw JSON
        per second   = 4B / 100k s        ≈ 40,000 events/s average
        peak         ≈ 3 × average        ≈ 120,000 events/s
        stored       ≈ 4 TB / 7 (Parquet) ≈ 600 GB/day, ≈ 200 TB/year
        partitions   ≈ 120 MB/s peak / 10 MB/s ≈ 12, round up to 32 or 64 for headroom
        ~~~

        Now the numbers drive choices: 120,000 events a second rules out a single database insert
        path, 200 TB a year means you need partitioning and a retention policy, and the partition
        count tells you how many consumers can work in parallel.

        > [!senior] Peak, not average
        > Systems fail at peak. Friday night in a big city, New Year's Eve, a cricket final. Always
        > state a peak multiplier and design the hot path for it.

        > [!trap] Do not spend ten minutes on arithmetic
        > Two minutes, round numbers, then move on. If a number turns out to matter, you can refine
        > it during the deep dive.
      `,
      checks: [
        {
          question:
            '1 billion events a day at 1 KB each. Roughly what is the average ingest rate per second?',
          options: ['About 1 MB/s', 'About 10 MB/s', 'About 100 MB/s', 'About 1 GB/s'],
          answer: 1,
          why: '1 billion KB is about 1 TB a day. Divided by about 100,000 seconds, that is about 10 MB per second on average, before any peak multiplier.',
        },
      ],
    },
  ],
};

export const problems: Problem[] = [
  {
    slug: 'clarify-before-designing',
    title: 'The first five minutes of a design round',
    track: 'playbook',
    kind: 'concept',
    difficulty: 'easy',
    companies: ['uber', 'google'],
    prompt: `
      The interviewer says: "Design a pipeline that tracks driver earnings." Nothing more.

      What do you say in the first five minutes, before you draw anything?
    `,
    hints: [
      'Who uses the output, and how fresh does it need to be?',
      'Money has special correctness needs.',
      'Get one or two scale numbers.',
    ],
    answer: `
      Restate, then ask a few questions that change the design:

      - **Consumers:** Is this for drivers in the app, for finance, or for analysts? Each implies a
        different freshness and correctness bar.
      - **Freshness:** Do drivers need to see earnings within seconds of a trip, or is a daily
        statement enough?
      - **Correctness:** Is this the source of truth for payouts? If yes, we need exactly-once
        effects, reconciliation and an audit trail.
      - **Scale:** How many drivers and trips a day, and how many countries and currencies?
      - **Inputs:** Where do fares, tips, incentives and adjustments come from, and can they change
        after the trip?

      Then state assumptions out loud: "I will assume drivers need near-real-time estimates and
      finance needs a daily reconciled ledger. I will design both paths and keep the ledger as the
      source of truth." That sentence shows you understood that one prompt hides two systems.
    `,
    signals: [
      'Asks who consumes the data before choosing technology',
      'Separates an estimate path from a source-of-truth path for money',
      'Asks about late adjustments such as tips and refunds',
      'States assumptions explicitly and moves on',
    ],
    followUps: ['A tip arrives three days after the trip. How does your design handle it?'],
  },
  {
    slug: 'estimate-event-volume',
    title: 'Size an event pipeline',
    track: 'playbook',
    kind: 'concept',
    difficulty: 'medium',
    companies: ['uber', 'google'],
    prompt: `
      A video app has 500 million daily active users. Each user generates about 100 events a day,
      and each event is about 800 bytes as JSON.

      Estimate the average and peak ingest rate, daily raw volume, and one year of compressed
      storage. Say one design decision your numbers force.
    `,
    hints: [
      'Multiply users by events, then by size.',
      'Use 100,000 seconds a day for quick division.',
      'Assume a peak multiplier and a compression ratio, and say them.',
    ],
    answer: `
      ~~~text
      events/day  = 500M × 100           = 50 billion
      raw/day     = 50B × 800 B          = 40 TB
      average     = 50B / 100k s         = 500,000 events/s ≈ 400 MB/s
      peak (×3)   ≈ 1.5M events/s        ≈ 1.2 GB/s
      compressed  ≈ 40 TB / 8            = 5 TB/day ≈ 1.8 PB/year
      ~~~

      Decisions the numbers force:

      - Ingestion must be horizontally partitioned. At around 10 MB/s per partition, peak needs on
        the order of a hundred-plus partitions, so plan for hundreds.
      - Storing 1.8 PB a year of raw events needs a retention policy: keep raw for a few months,
        keep aggregates and sampled raw longer.
      - Queries must prune by date and probably by event type, so partition by date and cluster
        by event name.
    `,
    signals: [
      'States assumptions (peak multiplier, compression) before using them',
      'Keeps arithmetic fast with round numbers',
      'Turns numbers into concrete design decisions',
      'Mentions retention and cost, not just capacity',
    ],
    followUps: ['How would sampling change the cost and which metrics would it break?'],
  },
  {
    slug: 'stuck-in-coding-round',
    title: 'Recover when you are stuck',
    track: 'playbook',
    kind: 'concept',
    difficulty: 'easy',
    companies: ['google'],
    prompt: `
      Fifteen minutes into a 45-minute coding round, your approach does not handle overlapping
      intervals and you are not sure how to fix it. The interviewer is quiet.

      What exactly do you do and say in the next two minutes?
    `,
    hints: ['Make your state visible.', 'Shrink the problem.'],
    answer: `
      1. **Say where you are.** "My loop handles disjoint intervals. Overlaps break it because I
         emit an interval before I know whether the next one extends it."
      2. **Propose a smaller step.** "Let me sort by start time and look at just two intervals:
         when does the second one merge into the first?"
      3. **Work the small case on an example**, out loud, and generalise: keep a current interval
         and extend its end while the next start is not after it.
      4. **Check in.** "I think sorting plus a single pass works, O(n log n). Shall I code it?"

      This keeps the interviewer able to help, shows structured problem solving, and usually
      unlocks the solution. Taking a hint and using it well is a neutral or positive signal.
    `,
    signals: [
      'Narrates the exact failure instead of going silent',
      'Reduces to a smaller case and an example',
      'Checks in before writing a lot of code',
    ],
    followUps: ['How would you test your merged intervals function?'],
  },
  {
    slug: 'senior-versus-staff-scope',
    title: 'Senior or staff: calibrate your scope',
    track: 'playbook',
    kind: 'concept',
    difficulty: 'medium',
    companies: ['uber', 'google'],
    prompt: `
      The recruiter asks: "Do you see yourself as senior or staff?" You led a migration of your
      team's pipelines from cron to Airflow and mentored two engineers.

      How do you answer, and what evidence would move you to the staff bar?
    `,
    hints: [
      'Scope is about how many teams your work changed.',
      'Do not argue for a title; describe impact.',
    ],
    answer: `
      Answer with scope, not a title: "My strongest work is senior scope: I owned my team's
      pipeline platform end to end and raised two engineers' level. I would like to be assessed at
      senior, and I am happy to talk about cross-team work if that is useful for calibration."

      Evidence that reads as staff:

      - Work that changed **several teams**: a shared standard, platform or migration others
        adopted.
      - Decisions made under ambiguity with long-term consequences, including ones you reversed.
      - Influence without authority: you aligned teams that did not report to you.
      - A multiplier effect: others shipped faster because of what you built or defined.

      Being down-levelled after a strong senior loop is better than failing a staff loop. Pick the
      level your stories can support with specifics.
    `,
    signals: [
      'Answers with scope and impact rather than claiming a title',
      'Knows the difference between team scope and multi-team scope',
      'Shows self-awareness about the evidence they have',
    ],
    followUps: ['Tell me about a decision that affected teams outside your own.'],
  },
];
