import type { Problem, Track } from '@/types/course';

/**
 * The staff layer: judgement, strategy and influence. It sits last in the
 * study order because it builds on every technical track before it.
 */
export const track: Track = {
  slug: 'staff',
  title: 'Staff-level judgement',
  summary:
    'Ambiguity, technical strategy, design reviews, influence and cost, practised the way staff loops probe them.',
  tone: 'grape',
  why: 'At staff level, Uber and Google assume the technical depth and score what you do with it: how you frame an unclear problem, choose a direction for several teams, and bring people with you. Most staff rejections happen here, not in the SQL round.',
  lessons: [
    {
      slug: 'what-staff-means',
      title: 'What the staff bar actually is',
      summary:
        'Name the four things a staff loop scores, and hear the difference between a senior and a staff answer.',
      minutes: 14,
      body: `
        A senior engineer owns a hard problem and solves it well. A staff engineer owns a
        **problem space**: they find the problems worth solving, set a direction several teams
        follow, and leave the organization better at solving the next one. Staff loops at Uber
        and Google test this in every round, not only in behavioral.

        ## The four things that are scored

        | Dimension | Senior answer | Staff answer |
        |---|---|---|
        | **Scope** | One system, one team | Several teams, a platform, or a company metric |
        | **Ambiguity** | Clarifies the requirements given | Decides what the problem is, and what not to solve |
        | **Influence** | Convinces the team | Aligns teams and leaders who do not report to them |
        | **Time horizon** | This quarter | One to three years, with a migration path from today |

        A fifth signal runs through all four: **judgement**. You make a call with incomplete
        data, say what would change your mind, and own the result.

        ## Where each round probes it

        - **System design:** "What would you not build?", "How do you migrate 300 jobs to
          this?", "What does this cost and who pays?"
        - **Data modeling:** "Who else will use this model, and how do you stop it forking?"
        - **Behavioral:** "Tell me about a decision that affected several teams."
        - **Coding and SQL:** rarely staff-specific. Pass them cleanly so they do not lower
          your level.

        ## The three ways strong engineers miss the bar

        1. **The deep-but-narrow answer.** A brilliant design for one pipeline, with no word on
           who else needs it, how it is adopted, or how the old system dies.
        2. **"We" everywhere.** The interviewer cannot tell what you decided. Say "I proposed",
           "I chose", "I convinced".
        3. **No trade-off named.** A staff engineer always says what they gave up. "We chose
           Iceberg; the cost was a 3-month migration of the Hive catalog, which I planned."

        > [!senior] The one-sentence test
        > After each answer, ask yourself: "Did I say what changed for other teams because of
        > me?" If not, the answer sounds senior, not staff.

        ## Calibrate honestly

        If your real experience is senior scope, interview for senior with one or two staff
        stories, not for staff with inflated ones. Down-levelling happens when follow-up
        questions show the scope was smaller than claimed.
      `,
      checks: [
        {
          question:
            'An interviewer asks how you would roll out your new ingestion design. Which answer shows staff scope?',
          options: [
            'Deploy it behind a feature flag and monitor errors',
            'Run it beside the old path for two teams, compare outputs, give the other 12 teams a template and a date the old path turns off',
            'Ask the platform team to deploy it',
            'Write thorough unit tests first',
          ],
          answer: 1,
          why: 'Staff answers cover adoption across teams and the end of the old system, not only the deploy of one service.',
        },
        {
          question: 'Which phrase most weakens a staff-level behavioral answer?',
          options: [
            '"I proposed we split the work by domain."',
            '"We decided to move to the lakehouse."',
            '"I chose to delay the launch by two weeks."',
            '"The cost of that choice was a slower backfill."',
          ],
          answer: 1,
          why: '"We decided" hides your own role. The interviewer cannot score a decision they cannot attribute to you.',
        },
      ],
    },
    {
      slug: 'framing-ambiguity',
      title: 'Turning an ambiguous ask into a plan',
      summary:
        'Take a vague request like "make our data trustworthy", find the real problem, and commit to a first step.',
      minutes: 16,
      body: `
        Staff loops often start with a deliberately vague prompt: "Our data is a mess. What do
        you do?" There is no design to draw yet. The test is whether you can turn fog into a
        plan without either freezing or jumping to a tool.

        ## The five-step frame

        1. **Find who hurts and how.** "Who noticed the mess? What decision went wrong?" A
           wrong revenue number in a board deck is a different problem from slow dashboards.
        2. **Quantify it.** "How often? What did it cost?" Two incidents a month that each
           cost an executive decision is enough to justify a quarter of work.
        3. **Split it into problems you can own.** Trust usually breaks into ownership (no one
           owns the table), detection (people find errors before machines do), and definition
           (two teams compute "active rider" differently).
        4. **Choose the first problem by leverage.** Pick the one that unblocks the others or
           hurts the most. Say what you are deliberately not doing yet.
        5. **Define done and a checkpoint.** "In one quarter, the 50 tier 1 tables have owners,
           tests and freshness SLOs. Then we decide on the next 500."

        ## Questions that move the conversation

        | You want to learn | Ask |
        |---|---|
        | The real goal | "What decision will this help someone make?" |
        | The constraint | "What is fixed: date, headcount or budget?" |
        | The appetite | "Is this a quarter of one team, or a year of three?" |
        | The politics | "Who has tried this before, and what happened?" |

        ## Reversible and irreversible decisions

        Sort each decision by how hard it is to undo. A **reversible** one (which monitor to
        try first) should be made fast by the team. An **irreversible** one (the storage
        format for a petabyte lake, a public data contract) deserves a written proposal and
        review. Saying this out loud is itself a staff signal: you spend care where it pays.

        > [!trap] Do not solve the vague ask with a tool
        > "We should buy a data observability product" in minute two shows you skipped the
        > diagnosis. A tool may be the answer in minute twenty, after you know which problem it
        > solves.

        > [!example] A strong opening
        > "Before I propose anything, I want to know which wrong number hurt most recently, and
        > who found it. My guess is that most problems come from a few critical tables with
        > no owner. If that is true, I would start with ownership and tests on those, not a
        > platform for all 20,000 tables."
      `,
      checks: [
        {
          question:
            'A VP says "our data is not trustworthy". What is the best first move in the interview?',
          options: [
            'Propose a data observability vendor',
            'Ask which wrong number caused a bad decision recently, and who found it',
            'Design a data quality platform for every table',
            'Suggest rewriting the pipelines in dbt',
          ],
          answer: 1,
          why: 'Diagnosis first: the concrete failure tells you which of ownership, detection or definition to fix first.',
        },
        {
          question: 'Which decision deserves a written proposal and review?',
          options: [
            'The order in which the team tries two anomaly monitors',
            'The table format for the company lake',
            'The name of a temporary staging table',
            'Which dashboard to fix first this week',
          ],
          answer: 1,
          why: 'A storage format is expensive to reverse. Reversible choices should be made quickly by the team.',
        },
      ],
    },
    {
      slug: 'technical-strategy',
      title: 'Technical strategy and roadmaps',
      summary:
        'Write a two-year direction for a data platform: where you are, where you go, and the order of steps.',
      minutes: 17,
      body: `
        A strategy is not a list of projects. It is a **diagnosis**, a **direction** and a
        **sequence of steps** that each pay off on their own. Staff candidates are asked to
        produce one in an interview: "Where should our data platform be in two years?"

        ## The shape of a strategy

        1. **Diagnosis.** The two or three facts that matter. "Batch freshness is 24 hours,
           and three product teams built their own streaming stacks to escape it."
        2. **Guiding policy.** The direction that follows. "One streaming path, owned by the
           platform, that product teams use instead of building their own."
        3. **Coherent steps.** Each step delivers value, so the plan survives a budget cut.
           "Quarter 1: shared Kafka and schema registry. Quarter 2: migrate the payments
           stream. Quarter 3: the self-serve template."

        ## Sequence by value and dependency

        | Step type | Example | Why first or later |
        |---|---|---|
        | Foundations others need | Catalog, schema registry, table format | First, but keep them thin |
        | A visible win | Move the most painful pipeline | Early, to earn trust and budget |
        | Scale-out | Self-serve templates | After two teams have proved the path |
        | Decommission | Turn off the old stack | Planned from day one, with a date |

        ## Build, buy or adopt open source

        | Question | Build leans | Buy leans |
        |---|---|---|
        | Is it core to how the company wins? | Yes | No |
        | Does our scale or need differ from the market? | Very much | Not really |
        | Can we staff it for years? | Yes, a team | No |
        | What does lock-in cost us? | High | Acceptable |

        Most data platforms should buy or adopt for commodity layers (storage, warehouse,
        orchestration) and build the thin layer that is specific to the business (metric
        definitions, domain contracts).

        ## Make it survive contact with reality

        - **Name the bets.** "We bet that Iceberg support in our engines keeps improving. If
          not by quarter 3, we fall back to Delta for the lake tables."
        - **Name the non-goals.** "We will not build a feature store this year."
        - **Name the metrics.** Freshness of tier 1 tables, cost per TB processed, the number
          of teams on the paved road, incidents caused by schema changes.

        > [!senior] Every step pays for itself
        > If the budget is cut after step two, the company should still be better off than
        > today. A plan whose value arrives only at the end is a big-bang plan in disguise.
      `,
      checks: [
        {
          question: 'Which plan is most likely to survive a budget cut halfway through?',
          options: [
            'Build the full new platform, then migrate everyone in the last quarter',
            'Ship the shared foundation, migrate one painful pipeline, then scale out, with value at each step',
            'Wait until every team agrees on requirements',
            'Migrate all teams at once to save time',
          ],
          answer: 1,
          why: 'Steps that each deliver value keep the company better off whenever the plan stops.',
        },
        {
          question: 'For which layer is building in-house usually the right call?',
          options: [
            'Object storage',
            'A workflow orchestrator',
            'The company-specific metric definitions and contracts',
            'A columnar file format',
          ],
          answer: 2,
          why: 'Commodity layers are bought or adopted. The thin layer specific to the business is where building pays.',
        },
      ],
    },
    {
      slug: 'reviewing-design-docs',
      title: 'Reviewing a design document',
      summary:
        'Find the important flaws in someone else’s design, and give feedback that changes the design without breaking trust.',
      minutes: 15,
      body: `
        Some staff loops hand you a short design and ask you to review it. Others ask, "Tell
        me about a design you pushed back on." Both test the same skill: seeing what matters
        in a design you did not write.

        ## Read in this order

        1. **The problem and the requirements.** Is the stated problem the real one? Are the
           numbers there? A design without a freshness or scale target cannot be judged.
        2. **The alternatives.** A doc with one option has not been thought through. Ask what
           else was considered and why it lost.
        3. **The failure modes.** What happens when the source is late, the job runs twice,
           or a dependency is down? Look for idempotency and backfill.
        4. **The operations.** Who is paged? What is the SLO? How is it rolled back?
        5. **The cost.** Is there an estimate, and who pays?
        6. **The migration.** How do current users move, and when does the old thing die?

        ## Rank your findings

        | Level | Example | What you do |
        |---|---|---|
        | **Blocking** | Billing reads from a non-replayable stream | Must change before approval |
        | **Important** | No backfill plan | Should change, can be a follow-up with an owner |
        | **Optional** | A naming preference | Mention once, then let it go |

        Ten comments at the same level hide the one that matters. Lead with the blocking
        finding and say why it blocks.

        ## Feedback that lands

        - Ask before you assert: "What happens if this job runs twice for the same day?"
          lets the author find the bug, which they will defend less.
        - Offer an alternative, not only a problem.
        - Approve with conditions when you can. Blocking every doc makes you the bottleneck,
          which is the opposite of staff impact.

        > [!senior] Review the decision, not the author
        > The staff signal is that the design got better and the author would ask you to
        > review the next one.
      `,
      checks: [
        {
          question: 'A design doc has 12 issues. How should you present them?',
          options: [
            'In the order you found them',
            'Grouped by severity, leading with the blocking issue and why it blocks',
            'Only the naming and style issues, to stay friendly',
            'All as blocking, to be safe',
          ],
          answer: 1,
          why: 'Ranking makes the important finding visible. Ten equal comments hide the one that matters.',
        },
      ],
    },
    {
      slug: 'influence-and-alignment',
      title: 'Influence, alignment and disagreement',
      summary:
        'Move several teams and leaders to one decision when nobody reports to you, and disagree without damage.',
      minutes: 15,
      body: `
        Staff engineers rarely have authority over the people who must change. Influence is
        the skill that replaces it, and it can be learned as a process.

        ## The alignment process

        1. **Map the people.** Who decides, who is affected, who can block? A director who
           owns the budget matters more than the loudest voice in the meeting.
        2. **Talk one to one before the meeting.** Learn each person's real concern. A
           proposal that already answers those concerns passes in the meeting; one that
           surprises people stalls.
        3. **Write it down.** A short proposal with the problem, the options, the
           recommendation and the cost. Writing forces clarity and travels without you.
        4. **Lower the cost of yes.** Offer to build the first part, migrate the first team,
           or run a two-week trial.
        5. **Find a sponsor.** A leader who feels the pain gives the decision weight.

        ## When you disagree

        | Situation | Good move |
        |---|---|
        | You think the decision is wrong but reversible | Say so once, with data, then commit fully |
        | You think it is wrong and expensive to reverse | Escalate with a written view of both sides, agreed with the other party |
        | You were overruled | Commit, and set a checkpoint: "If lag still exceeds 10 minutes in March, we revisit" |
        | New data proves you wrong | Say so publicly; it builds trust for the next time |

        **Escalation is not failure.** Two teams with a real conflict of goals need a leader
        to choose. The staff move is to escalate together, with a shared document that states
        both positions fairly.

        > [!trap] Winning the argument is not the goal
        > An interviewer listens for whether the relationship survived. "They agreed in the
        > end, and we still work well together" is the result that scores.
      `,
      checks: [
        {
          question:
            'Two teams disagree on an expensive, hard-to-reverse platform choice. What is the staff move?',
          options: [
            'Let the louder team win to save time',
            'Write a shared document with both positions, agreed by both teams, and take it to the leader who owns the decision',
            'Build both options',
            'Wait until one team gives up',
          ],
          answer: 1,
          why: 'An escalation done together, with both sides stated fairly, gets a fast and respected decision.',
        },
        {
          question: 'You were overruled on a reversible decision. What do you do?',
          options: [
            'Keep raising it in every meeting',
            'Commit fully and set a checkpoint with a measurable condition to revisit',
            'Quietly build your option anyway',
            'Ask to move to another team',
          ],
          answer: 1,
          why: 'Disagree and commit, with a checkpoint, keeps trust and still lets the data decide later.',
        },
      ],
    },
    {
      slug: 'cost-and-risk',
      title: 'Cost, risk and the business case',
      summary:
        'Put a price on a platform decision, including people, and present it to leadership in their terms.',
      minutes: 14,
      body: `
        Leaders approve money and headcount, not architectures. A staff engineer translates a
        technical choice into **cost, risk and time to value**.

        ## Total cost of ownership

        | Cost | What to count | Often forgotten |
        |---|---|---|
        | Compute and storage | The cloud bill at expected scale | Growth over 2 years, egress |
        | People | Engineers to build and run it | On-call, upgrades, security patches |
        | Migration | Dual running and engineer time | The weeks both systems run |
        | Opportunity | What the team does not build instead | Usually the largest |

        A rough rule for a business case: one engineer costs a company about $250,000 to
        $400,000 a year fully loaded in a US tech hub. A "free" open source system that needs
        two engineers to run costs more than most managed services.

        ## A one-page business case

        1. **The problem in money or risk.** "Late data costs ops about $2M a year in
           mis-priced surge."
        2. **Options with cost and benefit.** Always include "do nothing" with its cost.
        3. **The recommendation and the ask.** "Three engineers for two quarters."
        4. **The risks and how you limit them.** A pilot, a checkpoint, a fallback.
        5. **How you will measure success.** One or two numbers leaders already care about.

        ## Risk in a design

        Name the top two or three risks, with a plan for each: **avoid** (choose another
        option), **reduce** (a pilot, a feature flag), or **accept** (with a reason). A design
        with "no risks" was not examined.

        > [!senior] Speak the listener's language
        > To a finance leader: cost and payback period. To a product leader: what customers
        > get and when. To engineers: the design and the trade-offs. Same decision, three
        > framings.
      `,
      checks: [
        {
          question: 'Which option must every business case include?',
          options: [
            'The most expensive option',
            'A vendor comparison',
            'Doing nothing, with its cost',
            'A five-year roadmap',
          ],
          answer: 2,
          why: 'Doing nothing is always an option. Its cost is the baseline every other option is judged against.',
        },
      ],
    },
  ],
};

export const problems: Problem[] = [
  {
    slug: 'staff-two-year-direction',
    title: 'Set a two-year direction for the data platform',
    track: 'staff',
    kind: 'design',
    difficulty: 'hard',
    companies: ['uber', 'google', 'amazon', 'microsoft'],
    prompt: `
      You join as the first staff engineer in a 60-person data org. Today: a nightly Hive and
      Airflow batch stack with 24-hour freshness, three product teams running their own Kafka
      and Flink clusters, a warehouse bill growing 60% a year, and no shared metric
      definitions. The VP asks: "Where should we be in two years, and how do we get there?"
      Present your direction.
    `,
    hints: [
      'Start with a diagnosis: which two or three facts matter most?',
      'What is the guiding policy that follows from the diagnosis?',
      'Order the steps so each one pays off on its own.',
      'What will you deliberately not do, and how will you measure progress?',
    ],
    answer: `
      **Clarify first.** I would ask what hurts the business most today (late data, cost or
      wrong numbers), what headcount the platform has, and whether the three streaming teams
      are happy with their stacks or only escaped batch because they had to.

      **Diagnosis.**

      - Freshness of 24 hours pushed product teams to build three streaming stacks. That is
        three on-call rotations and three security models.
      - Cost grows 60% a year with no owner per workload, so nobody can say what to cut.
      - No shared definitions, so leaders see different numbers for the same metric.

      **Guiding policy.** One paved road for batch and streaming on open table formats,
      owned by the platform; cost visible per team; a small set of certified metrics.

      **Steps, each paying off alone.**

      | Quarter | Step | Value on its own |
      |---|---|---|
      | 1 | Cost tags per team and a weekly cost report | Owners appear; the obvious waste goes |
      | 1 to 2 | Certify the 10 metrics in exec reviews | One number in every leadership review |
      | 2 to 3 | One shared Kafka and schema registry; migrate the most willing team | Two fewer clusters to run |
      | 3 to 5 | Iceberg tables with hourly or streaming ingestion for tier 1 sources | Freshness from 24 hours to under 1 hour |
      | 5 to 8 | Self-serve templates; migrate the remaining teams; turn off the old stacks | Lower cost per job, one security model |

      **Non-goals for year one.** No feature store, no data mesh reorganization, no rewrite
      of working batch jobs that nobody needs fresher.

      **Bets and fallbacks.** Iceberg support in our engines keeps improving; if not, Delta
      for lake tables. If the streaming teams refuse to move, we keep their clusters but
      require the shared schema registry first.

      **Measures.** Tier 1 freshness, cost per TB processed, number of streaming stacks,
      and the count of metric disputes in leadership reviews. Reported each quarter.

      **People.** I would recruit one tech lead from a streaming team as co-owner of the
      streaming path, so the plan is theirs, not imposed.
    `,
    signals: [
      'Asks about the business pain before proposing technology',
      'States a diagnosis and a guiding policy, not a project list',
      'Orders steps so each one delivers value on its own',
      'Names non-goals and fallbacks for the main bets',
      'Defines measures leaders care about',
      'Plans how other teams come to own the plan',
    ],
    followUps: [
      'The VP cuts your headcount in half after quarter 2. What changes?',
      'One streaming team refuses to migrate. What do you do?',
    ],
  },
  {
    slug: 'staff-review-design-doc',
    title: 'Review a flawed design document',
    track: 'staff',
    kind: 'concept',
    difficulty: 'hard',
    companies: ['google', 'uber', 'amazon', 'microsoft'],
    prompt: `
      A senior engineer asks you to review this design summary before it goes to the
      architecture review:

      "We will compute driver payouts in real time. A Flink job reads trip-completed events
      from Kafka, multiplies the fare by the commission rate it reads from the rates database
      on each event, and adds the result to a running total per driver in Redis. At midnight
      a script copies the Redis totals into the payouts table, which finance pays from. This
      replaces the nightly Spark job, which takes 3 hours. The new system is simpler and
      faster."

      List your findings in priority order and say how you would give the feedback.
    `,
    hints: [
      'Which part touches money? What must be true of it?',
      'What happens on replay, duplicate events or a Flink restart?',
      'Is Redis a system of record?',
      'Was the real problem stated, and were other options considered?',
    ],
    answer: `
      **Blocking findings.**

      1. **Payouts are not reproducible.** The totals live only in Redis and are built from
         rate lookups at processing time. If a bug is found, nobody can recompute last
         Tuesday. Money must come from a replayable, auditable path: events in the lake,
         rates versioned by effective date, and a batch computation.
      2. **Duplicates and replays double-pay.** A Flink restart replays events from the last
         checkpoint, and an increment in Redis is not idempotent. Without deduplication by
         trip id and an idempotent sink, drivers get paid twice.
      3. **Redis is not a system of record.** An eviction, failover or flush loses money
         data. The midnight copy also has no defined behaviour for trips completed at
         23:59:59 that arrive after midnight.

      **Important findings.**

      4. **Rates by processing time.** A rate change at noon is applied to late events from
         the morning. Join on the rate effective at trip time.
      5. **The problem is not stated.** "3 hours" is not a requirement. Who needs payouts
         faster, and how fast? If drivers want to see earnings live, that is a display
         feature, not a payout path.
      6. **No alternatives.** A likely better design: keep the batch job as the source of
         truth (optimise it, it should not take 3 hours), and add a streaming estimate for
         the driver app, clearly labelled as an estimate and reconciled daily.

      **Optional.** Monitoring, the backfill plan and the rollout plan are missing; they
      can follow once the design changes.

      **How I give the feedback.** One to one first, not in the review meeting. I lead with
      a question: "What happens to a driver's total if Flink restarts from a checkpoint?"
      so the author finds the double-payment themselves. I offer the split design as an
      option, and I offer to pair on the batch job's 3-hour runtime. In the doc I mark
      findings 1 to 3 as blocking and the rest as follow-ups with owners.
    `,
    signals: [
      'Finds that money must come from a reproducible, replayable path',
      'Finds the double-count on replay and the non-idempotent sink',
      'Rejects Redis as the system of record for payouts',
      'Questions the requirement behind "faster"',
      'Ranks findings and proposes an alternative design',
      'Gives feedback privately first and lets the author discover the issue',
    ],
    followUps: [
      'The author pushes back: "Flink has exactly-once." How do you answer?',
      'The author’s manager wants it shipped this quarter anyway. What now?',
    ],
  },
  {
    slug: 'staff-trustworthy-data',
    title: '"Make our data trustworthy"',
    track: 'staff',
    kind: 'concept',
    difficulty: 'hard',
    companies: ['uber', 'google', 'amazon', 'microsoft'],
    prompt: `
      The VP of Data tells you: "Executives no longer trust our dashboards. Fix it." There is
      no more detail. You have one quarter and two engineers to start. Walk through how you
      approach it.
    `,
    hints: [
      'What questions would you ask before proposing anything?',
      'Split "trust" into problems you can own.',
      'What is the first step that pays off within the quarter?',
      'How will the VP know it worked?',
    ],
    answer: `
      **Diagnose.** I would ask for the last three times an executive lost trust: which
      number, who found the problem, and what it cost. I would talk to two executives and
      two analysts. Typical findings: one revenue number differs between finance and product
      dashboards, and twice a month a dashboard shows stale data without warning.

      **Split the problem.**

      | Cause | Symptom | Fix |
      |---|---|---|
      | Definition | Two numbers for one metric | Certify a definition with an owner |
      | Detection | People find errors first | Tests and freshness checks on critical tables |
      | Communication | Stale data looks fresh | "Data as of" and warnings on dashboards |
      | Ownership | Nobody fixes it | A named owner for each critical table |

      **Choose the first scope.** With two engineers, I cover the **20 dashboards executives
      open** and the tables behind them, found through lineage and query logs. Perhaps 150
      tables. I deliberately do not start a platform for all tables.

      **Quarter plan.**

      - Weeks 1 to 3: lineage of the 20 dashboards, owners named for each table.
      - Weeks 3 to 8: tests and freshness SLOs on those tables, failures block publish.
        "Data as of" plus a warning banner on each dashboard.
      - Weeks 4 to 10: certify the 5 most disputed metrics with finance and product.
      - Weeks 10 to 13: report the results and propose the next scope.

      **Measure.** Incidents found by checks versus by people, incidents reaching executives,
      and a short monthly trust survey of the executives.

      **Influence.** Owners are in other teams, so I get the VP to announce table ownership,
      and I make it cheap: we write the first tests for each owner.
    `,
    signals: [
      'Diagnoses from concrete incidents before proposing',
      'Splits trust into definition, detection, communication and ownership',
      'Limits scope to what executives use',
      'Plans a quarter where every phase delivers something',
      'Measures trust in a way the VP sees',
    ],
    followUps: [
      'Finance and product refuse to agree on the revenue definition. What do you do?',
      'After the quarter, the VP wants the same for all 20,000 tables. How do you scale it?',
    ],
  },
  {
    slug: 'staff-build-or-buy',
    title: 'Keep the in-house scheduler or move to a managed service?',
    track: 'staff',
    kind: 'concept',
    difficulty: 'medium',
    companies: ['uber', 'google', 'amazon', 'microsoft'],
    prompt: `
      Your company built its own job scheduler eight years ago. It runs 6,000 jobs. Two of
      its original authors left, and a team of four maintains it. Leadership asks whether to
      move to a managed Airflow service. Make a recommendation.
    `,
    hints: [
      'What does the in-house system cost, including people?',
      'Is scheduling core to how this company wins?',
      'What does migration cost, and what is the risk?',
      'Is there an option between "keep" and "move everything now"?',
    ],
    answer: `
      **Frame it as total cost.**

      | | Keep | Managed Airflow |
      |---|---|---|
      | People | 4 engineers, about $1.2M a year | About 1 engineer for the platform layer |
      | Service cost | Servers only | Managed fee, perhaps $100,000 to $300,000 a year at this size |
      | Migration | None | 6,000 jobs; the largest cost and risk |
      | Hiring | Nobody knows the system | Airflow skills are common |
      | Features | Only what we build | Community features, integrations |

      **Is it core?** Scheduling is not how the company wins. That leans to buy.

      **Migration is the real decision.** 6,000 jobs cannot move by hand. I would check
      how much can be generated automatically from the old scheduler's metadata, and how
      many jobs are dead (often 20% to 40%).

      **Recommendation.** Move, in phases: freeze new features on the old scheduler; new
      jobs start on managed Airflow from next quarter; build a converter and migrate by
      domain over about 18 months; turn the old system off on a fixed date. Two of the four
      maintainers move to the migration and platform work, which keeps their knowledge.

      **When I would say keep.** If the scheduler has features the business depends on that
      Airflow cannot match, such as strict cross-region guarantees, or if a conversion pilot
      on 100 jobs shows most jobs need a manual rewrite.

      **The checkpoint.** A 6-week pilot on 100 jobs measures conversion rate and effort per
      job. The full migration is approved only after the pilot.
    `,
    signals: [
      'Counts people cost, not only service cost',
      'Asks whether the capability is core to the business',
      'Treats migration as the main cost and risk',
      'Proposes a phased path with a pilot as a checkpoint',
      'States what evidence would change the recommendation',
    ],
    followUps: ['The four maintainers feel their work is being thrown away. How do you handle it?'],
  },
  {
    slug: 'staff-decommission-legacy',
    title: 'Turn off a legacy system that 40 teams still use',
    track: 'staff',
    kind: 'design',
    difficulty: 'hard',
    companies: ['uber', 'google', 'amazon', 'microsoft'],
    prompt: `
      The old warehouse was meant to be turned off a year ago. The new lakehouse is live, but
      40 teams still read from the old warehouse, which costs $3M a year and is a security
      risk. Previous attempts to set a deadline were ignored. Plan the decommission.
    `,
    hints: [
      'Why did the previous deadlines fail?',
      'Who reads what? Can you measure it?',
      'How do you make moving cheaper than staying?',
      'What is the escalation path for the last few teams?',
    ],
    answer: `
      **Learn why it failed.** Usually: teams did not know what they used, moving had a
      cost and no benefit for them, and the deadline had no sponsor.

      **Measure.** Query logs give every reader of every table over 90 days. Group by team.
      Expect a long tail: a few teams with hundreds of queries, many with a handful.

      **Make moving cheap.**

      - A mapping from every old table to its new equivalent, published in the catalog.
      - An automatic SQL rewriter for the common patterns.
      - Office hours, and the platform team migrates the top 5 readers itself.
      - Tables with no new equivalent are built before the deadline, not left to teams.

      **Make staying visible.** A weekly report per team of old-warehouse queries, shared
      with their director. Cost charged back to the teams still reading after a date.

      **The plan.**

      | Phase | Action |
      |---|---|
      | Month 1 | Measure readers, get a VP sponsor, publish the date |
      | Months 1 to 4 | Tooling, mappings, migrate the top readers |
      | Month 5 | Old warehouse becomes read-only for new tables |
      | Month 6 | Brownouts: the old warehouse is off for 1 hour, then 1 day, announced |
      | Month 7 | Off; data kept in cold storage for 90 days for emergencies |

      Brownouts find the readers nobody knew about, while the switch is still reversible.

      **The last teams.** For each, a named owner and a written exception with an end date,
      approved by their director. No silent exceptions.
    `,
    signals: [
      'Diagnoses why previous deadlines failed',
      'Measures actual readers from query logs',
      'Lowers the cost of moving with tooling and hands-on help',
      'Uses a sponsor, visibility and chargeback',
      'Uses brownouts to find unknown readers safely',
      'Handles exceptions in writing with end dates',
    ],
    followUps: ['A critical finance report fails during a brownout. What do you do?'],
  },
  {
    slug: 'staff-conflicting-teams',
    title: 'Two teams need opposite things from your platform',
    track: 'staff',
    kind: 'behavioral',
    difficulty: 'hard',
    companies: ['uber', 'google', 'amazon', 'microsoft'],
    prompt: `
      "Tell me about a time two teams needed conflicting things from a system you owned."
      Example situation: the ML team wants raw, unfiltered events kept for a year; the
      privacy team wants personal events deleted after 30 days. Outline your answer.
    `,
    hints: [
      'What does each team actually need underneath its request?',
      'Is there an option that satisfies both underlying needs?',
      'Who decides if there is no such option?',
      'What changed afterwards, beyond this one conflict?',
    ],
    answer: `
      **Situation.** Our event platform kept raw events for 90 days. ML asked for a year of
      raw events to train models; the privacy team, after a new regulation, asked for
      personal data to be deleted after 30 days. Both escalated to me as the platform's
      tech lead.

      **Task.** Find a policy both could accept, or get the right leader to decide.

      **Action.**

      - I met each team separately. ML needed long history of **behaviour**, not identity.
        Privacy needed personal identifiers gone, not every event.
      - I proposed a split: raw events with identifiers kept 30 days; a pseudonymised copy
        with a rotating key and no direct identifiers kept for a year. I wrote the trade-off
        down: ML loses the ability to join to new user attributes after 30 days.
      - Legal reviewed the pseudonymisation. I asked privacy to own the policy and ML to own
        the impact assessment on two models.
      - One question stayed open: a fraud model needed identifiers for 90 days. I wrote a
        one-page document with both positions, agreed by both leads, and took it to the
        director who owned both budgets. She approved a 90-day exception for that model only.

      **Result.** The policy shipped in six weeks. Model quality dropped less than 1% on the
      two models tested. The split became the default pattern for new event types, and the
      document template was reused for two later conflicts.
    `,
    signals: [
      'Finds the need under each request',
      'Proposes an option that serves both needs and states its cost',
      'Escalates together, with a fair written document, when needed',
      'Measures the impact of the compromise',
      'Leaves a reusable pattern behind',
    ],
    followUps: ['What would you have done if legal rejected the pseudonymised copy?'],
  },
  {
    slug: 'staff-design-rejected',
    title: 'Your design was rejected by a director',
    track: 'staff',
    kind: 'behavioral',
    difficulty: 'medium',
    companies: ['uber', 'google', 'amazon', 'microsoft'],
    prompt: `
      "Tell me about a time your technical proposal was rejected. What did you do next?"
      This tests disagreement, humility and follow-through. Outline your answer.
    `,
    hints: [
      'Why was it rejected? Was the reason fair?',
      'Did you disagree and commit, or escalate?',
      'What did you learn about how to propose?',
      'What happened later? Did the data settle it?',
    ],
    answer: `
      **Situation.** I proposed moving our nightly batch to streaming ingestion for the
      orders domain. The director rejected it: the team was already behind on a migration,
      and she did not see the business need.

      **Task.** Decide whether to push harder, wait, or change the proposal.

      **Action.**

      - I asked for 15 minutes to understand her reasons, not to argue. Her real concern
        was capacity, not the idea.
      - I accepted the decision and committed to the migration first. I asked for one
        checkpoint: if late-order complaints from operations stayed above 20 a week after
        the migration, we would revisit.
      - Meanwhile I rewrote the proposal around the business: operations lost about 4 hours
        a day of visibility, and I attached two incidents where it cost money.
      - I also cut its scope to one pipeline, run by one engineer for six weeks.

      **Result.** After the migration, complaints were still at 25 a week. The director
      approved the smaller version, which cut ops latency from 24 hours to 10 minutes; the
      rest followed the next half. I learned to lead with the business problem and the
      smallest first step, and I now ask about capacity before I propose.
    `,
    signals: [
      'Seeks to understand the reason before reacting',
      'Commits fully while setting a measurable checkpoint',
      'Reframes the proposal in business terms and smaller scope',
      'Shows what they learned about proposing',
    ],
    followUps: ['What if the checkpoint had shown the director was right?'],
  },
  {
    slug: 'staff-lakehouse-business-case',
    title: 'Make the business case for a lakehouse migration',
    track: 'staff',
    kind: 'concept',
    difficulty: 'hard',
    companies: ['uber', 'google', 'amazon', 'microsoft'],
    prompt: `
      Your warehouse bill is $6M a year and grows 50% a year. You believe moving cold and
      heavy workloads to an Iceberg lakehouse with Spark and Trino could save money. The CFO
      gives you 10 minutes. Build the case, including the cost of doing nothing.
    `,
    hints: [
      'Project the cost of doing nothing over two to three years.',
      'Which workloads move, and which stay?',
      'What does the migration cost, including people and dual running?',
      'When does it pay back, and what are the risks?',
    ],
    answer: `
      **Doing nothing.** At 50% growth, $6M becomes $9M next year and $13.5M the year after:
      about $28.5M over three years.

      **What moves.** Query logs show where money goes. Typically about 60% of the cost is
      large scheduled transformations and scans of cold history; those move. Interactive BI
      and ad hoc analysis stay in the warehouse, which does them well.

      **Estimate.**

      | Item | Year 1 | Year 2 | Year 3 |
      |---|---|---|---|
      | Warehouse (after moving 60% of the load) | $7M | $5.4M | $5.4M |
      | Lake compute and storage | $1M | $1.5M | $2M |
      | Team: 6 engineers | $2M | $2M | $1.5M |
      | Total | $10M | $8.9M | $8.9M |
      | Do nothing | $9M | $13.5M | $20M |

      Year 1 costs more because of dual running. From year 2 the saving is about $4.5M a
      year, rising as growth continues. Payback is during year 2.

      **Risks and limits.**

      - Savings depend on the workload split; a 6-week pilot on the two largest jobs
        confirms the cost per job before full approval.
      - The team must run new engines. Managed Spark and Trino lower that risk.
      - Analysts must not notice: the gold tables stay in the warehouse, fed from the lake.

      **The ask.** Approve a 6-week pilot with two engineers. Full funding is decided on the
      pilot's measured cost per job.

      **For the CFO.** Three numbers: three-year cost of doing nothing, three-year cost of
      the plan, payback period. The architecture stays in the appendix.
    `,
    signals: [
      'Projects the cost of doing nothing',
      'Moves only the workloads that save money',
      'Includes people and dual-running costs',
      'Gives a payback period and a pilot as a checkpoint',
      'Frames the case in the CFO’s terms',
    ],
    followUps: ['The pilot shows savings of 30%, not 60%. Do you continue?'],
  },
  {
    slug: 'staff-systemic-incident-fix',
    title: 'Turn a repeated incident into an org-wide fix',
    track: 'staff',
    kind: 'concept',
    difficulty: 'medium',
    companies: ['uber', 'google', 'amazon', 'microsoft'],
    prompt: `
      For the third time this year, an upstream team renamed a column and broke revenue
      reporting for a day. Each postmortem ended with "communicate schema changes better".
      You are asked to make sure it does not happen again across 12 producer teams.
    `,
    hints: [
      'Why did "communicate better" not work?',
      'Where in the producer’s workflow can a check run?',
      'How do you get 12 teams to adopt it?',
      'How do you measure that it worked?',
    ],
    answer: `
      **Why the action item failed.** It asked people to remember. A fix must work when
      people forget.

      **Systemic fix: contracts checked in CI.**

      - Each table or topic used by another team gets a contract: columns, types, meaning
        and owner, stored beside the producer's code.
      - The producer's CI compares the change with the contract and the list of consumers
        from lineage. A breaking change fails the build, with a message naming the
        consumers to talk to.
      - A breaking change ships as a new version beside the old one, with a deprecation
        window.

      **Adoption across 12 teams.**

      - Start with the 3 teams whose tables feed revenue, where the pain is clear.
      - The platform team writes the first contracts for them, generated from current
        schemas, so the cost to the producer is a review, not a project.
      - A director-level sponsor makes contracts the standard for tier 1 data.

      **Measure.** Incidents caused by schema changes per quarter, the share of tier 1 tables
      under contract, and builds blocked by the check (which shows it is working).

      **Postmortem culture.** I would also ask that future postmortems avoid
      "communicate better" as an action item without a mechanism behind it.
    `,
    signals: [
      'Explains why "communicate better" fails',
      'Puts a check in the producer’s workflow, not a process document',
      'Starts adoption where the pain is highest',
      'Lowers the cost of adoption for producers',
      'Measures the result and improves postmortem practice',
    ],
    followUps: ['A producer team says the CI check slows them down. How do you respond?'],
  },
  {
    slug: 'staff-platform-success-metrics',
    title: 'How do you know the data platform is succeeding?',
    track: 'staff',
    kind: 'concept',
    difficulty: 'medium',
    companies: ['google', 'uber', 'amazon', 'microsoft'],
    prompt: `
      You lead a data platform used by 30 teams. Your director asks you to define how the
      platform's success is measured for next year's goals. Uptime alone is not enough.
      Propose the metrics.
    `,
    hints: [
      'Who are the platform’s customers, and what do they want?',
      'Separate adoption, reliability, efficiency and developer experience.',
      'Which metric could be gamed, and how do you balance it?',
    ],
    answer: `
      **Customers.** Pipeline builders (product and analytics engineers) and data consumers
      (analysts, ML, executives). Each needs different things.

      **A balanced set.**

      | Area | Metric | Why |
      |---|---|---|
      | Adoption | Share of new pipelines on the paved road | Shows the road is chosen, not forced |
      | Speed | Time from idea to first production pipeline | Developer experience in one number |
      | Reliability | Tier 1 tables meeting freshness SLO | What consumers feel |
      | Quality | Incidents reaching consumers, per quarter | Trust |
      | Efficiency | Cost per TB processed | Scale without the bill growing as fast |
      | Satisfaction | Quarterly survey score of builders | Catches problems numbers miss |

      **Guard against gaming.** Adoption alone can be forced by a mandate; pair it with
      satisfaction. Cost alone can be cut by dropping tests; pair it with incidents.

      **Targets.** Set a baseline in the first month, then targets per half, such as tier 1
      SLO from 92% to 99%, time to first pipeline from 3 weeks to 3 days.

      **Report.** One page each quarter, with the trend and one sentence per metric on why
      it moved.
    `,
    signals: [
      'Identifies the platform’s customers',
      'Covers adoption, reliability, efficiency and experience',
      'Pairs metrics so none can be gamed alone',
      'Sets baselines before targets',
    ],
    followUps: ['Adoption is 30% after a year. What do you investigate first?'],
  },
  {
    slug: 'staff-multiply-quality',
    title: 'Raise the engineering bar across 30 engineers',
    track: 'staff',
    kind: 'behavioral',
    difficulty: 'medium',
    companies: ['google', 'uber', 'amazon', 'microsoft'],
    prompt: `
      "Tell me about a time you made other engineers more effective, beyond your own team."
      Staff loops call this multiplying. Outline your answer.
    `,
    hints: [
      'What problem did many engineers share?',
      'What did you create that worked without you?',
      'How did you measure the change?',
    ],
    answer: `
      **Situation.** Across our data org of 30 engineers, about half of on-call pages came
      from pipelines that were not idempotent: a retry or backfill duplicated or lost data.
      Each team fixed its own cases, one at a time.

      **Task.** I was a senior engineer on one team. I wanted the pattern fixed everywhere,
      not only in my pipelines.

      **Action.**

      - I wrote a short guide with three patterns: overwrite by partition, MERGE on a
        natural key, and write-audit-publish. Each had a worked example from our own code.
      - I added a template to the pipeline generator, so new pipelines were idempotent by
        default.
      - I ran two one-hour sessions and offered pairing to any team. I paired with four.
      - I proposed a review checklist item: "What happens if this runs twice?" The
        engineering managers agreed to add it.

      **Result.** Within two quarters, pages from duplicate or missing data fell by about
      60%. Nine teams adopted the template. Two engineers I paired with later ran the
      sessions for new hires, so it continued without me.
    `,
    signals: [
      'Picks a problem shared by many engineers',
      'Creates leverage that works without them: guide, template, checklist',
      'Measures the change across teams',
      'Shows others carrying it forward',
    ],
    followUps: ['Which team did not adopt it, and why?'],
  },
  {
    slug: 'staff-pressure-test-design',
    title: 'The interviewer changes the constraints mid-design',
    track: 'staff',
    kind: 'design',
    difficulty: 'hard',
    companies: ['uber', 'google', 'amazon', 'microsoft'],
    prompt: `
      You have just designed a pipeline that lands trip events in an Iceberg lake every
      5 minutes and builds daily revenue tables. The interviewer now asks, one by one:
      "Traffic grows 10x. What breaks first?", "Your budget is cut by half. What do you
      remove?", and "Finance now needs revenue within 1 minute. What changes?" Answer each.
    `,
    hints: [
      'For 10x, find the component whose cost or limit grows fastest.',
      'For half the budget, rank features by value and cost.',
      'For 1 minute, ask what the number is used for before redesigning.',
    ],
    answer: `
      **10x traffic: what breaks first.**

      - **Small files and metadata.** Ten times the commits every 5 minutes means many
        more files and snapshots. Compaction and snapshot expiry must scale first.
      - **Kafka partitions and consumers.** Throughput per partition limits the ingest
        job; add partitions ahead of time, since adding them later remaps keys.
      - **The daily revenue job.** It reads 10x the data; switch to incremental
        processing on new partitions instead of a full day scan.
      - What does not break: object storage, which scales without design changes.

      **Half the budget: what goes.** I rank by value and cost:

      | Cut | Saving | Cost to users |
      |---|---|---|
      | Ingest every 15 minutes instead of 5 | Fewer commits and compactions | Nobody reads it more often than hourly |
      | Shorter raw retention: 90 days, then summaries | Storage | Older raw data rarely read |
      | Fewer dashboard refreshes | Warehouse compute | Small |
      | Keep: data quality checks | — | Removing them costs trust |

      I would show the query logs that justify each cut, and the cuts I refuse.

      **Revenue in 1 minute.** First I ask what the number is used for. If it is a live
      operations view, I add a streaming aggregate (Flink to a KV store or a real-time OLAP
      table), labelled as an estimate, beside the daily table that finance closes on.
      Finance's book of record stays batch and reproducible. If finance truly needs a
      1-minute figure for decisions, the streaming path needs deduplication by trip id,
      idempotent upserts and a daily reconciliation with the batch number.

      **The staff pattern.** For each change: ask what it is for, name what breaks or what
      it costs, and keep the system of record simple.
    `,
    signals: [
      'Finds the component that breaks first instead of scaling everything',
      'Ranks cuts by value and cost, and names what not to cut',
      'Asks what the 1-minute number is used for',
      'Keeps the system of record reproducible beside a fast estimate',
      'Answers each change with a consistent method',
    ],
    followUps: ['Now the company enters the EU and data must stay in-region. What changes?'],
  },
];
