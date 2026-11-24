import { behavioralLoopLessons, behavioralLoopProblems } from '@/lib/course/tracks/company-loops';
import type { Problem, Track } from '@/types/course';

export const track: Track = {
  slug: 'behavioral',
  title: 'Behavioral and leadership',
  summary:
    'A story bank, the STAR shape, conflict, failure and influence, and how Uber and Google judge them.',
  tone: 'grape',
  why: 'Strong technical rounds get you to the bar; the behavioral round decides the level. Senior and staff offers are lost here more often than in coding.',
  lessons: [
    {
      slug: 'star-and-story-bank',
      title: 'STAR answers and a story bank',
      summary: 'Build eight reusable stories and tell each one in about two minutes.',
      minutes: 14,
      body: `
        ## Start with the problem

        The interviewer asks: "Tell me about a time you disagreed with a teammate." You freeze. You have
        done this many times, but no example comes to mind. Then you pick one, spend three minutes on the
        background, and run out of time before you say what you did. The interviewer writes: "Unclear
        ownership. No result."

        Behavioral questions ask about the past because past behaviour predicts future behaviour.
        Interviewers score what **you** did, at what scope, and what changed because of it. A prepared story
        bank lets you answer any question with a real, specific example.

        ## Idea 1: the STAR shape, with a senior twist

        STAR is a four-part shape. The time split is the senior twist.

        - **Situation (10%):** team, system and stakes, in two sentences.
        - **Task (10%):** what you owned, and why it was hard.
        - **Action (60%):** what **you** decided and did, the options you rejected, and why.
        - **Result (20%):** numbers, then what you learned or would do differently.

        Most candidates spend half their time on the situation. Spend it on the action, because that is
        what gets scored. Like a film trailer: a few seconds of setting, then the action.

        ## Idea 2: build the bank before the loop

        Write 8 to 10 stories from the last 3 to 5 years. Each one should cover several themes:

        - A system you designed or rebuilt, with a hard trade-off.
        - A production incident you led.
        - A disagreement with a peer, a manager or another team.
        - A failure, or a wrong call you made.
        - Influencing a decision without authority.
        - Delivering under ambiguity or with changing requirements.
        - Growing someone else: mentoring, onboarding, raising the bar.
        - Cutting cost or toil in a measurable way.

        Then make a grid: stories down the side, themes across the top, a tick where a story fits. Every
        theme needs at least two stories, so you do not repeat yourself in one loop.

        ## Now say it like a senior engineer

        Answer with a specific story in STAR, spending most of the time on your own decisions and the
        options you rejected, and close with measured results and a lesson. Prepare 8 to 10 stories mapped
        to the common themes, two per theme.

        > [!tip] Write numbers down before the interview
        > "Cut the nightly job from 9 hours to 40 minutes", "reduced warehouse spend by $38,000 a
        > month", "brought pipeline incidents from 6 a month to 1". You will not remember them
        > under pressure unless you rehearse them.

        > [!trap] The "we" story
        > "We migrated to Spark and we improved latency" gives the interviewer nothing to score.
        > Say "I", and be precise about what was yours and what was the team's.

        ## In one breath

        Use STAR, but spend most of your time on what you decided and why. Write 8 to 10 real stories with
        numbers before the loop, so every common question already has two good answers.
      `,
      checks: [
        {
          question: 'Where should most of a STAR answer’s time go?',
          options: ['Situation', 'Task', 'Action', 'Result'],
          answer: 2,
          why: 'Your decisions and actions are what the interviewer scores. Keep the setup short.',
        },
        {
          question: 'Why map stories to themes in a table?',
          options: [
            'To memorize scripts word for word',
            'To make sure every common theme has at least two stories, so you never repeat one in a loop',
            'To share the table with the interviewer',
            'To find the longest story',
          ],
          answer: 1,
          why: 'Several interviewers may ask about similar themes. Coverage prevents reusing the same story.',
        },
      ],
    },
    {
      slug: 'scope-and-ownership',
      title: 'Showing senior and staff scope',
      summary: 'Tell stories whose scope matches the level you want.',
      minutes: 13,
      body: `
        ## Start with the problem

        Two engineers did the same project: they moved Airflow DAGs to a new cluster. One is levelled
        mid-level, the other senior. Same work, different telling.

        The level is judged on **scope, ambiguity and influence**, not on how hard you worked. The same
        story can sound mid-level or staff-level depending on what you emphasise.

        ## Idea 1: five signals, two tellings

        **Scope.**

        - Mid-level: "I built the pipeline I was assigned."
        - Senior or staff: "I noticed three teams rebuilding the same pipeline and proposed one shared one."

        **Ambiguity.**

        - Mid-level: "The requirements were clear."
        - Senior or staff: "Nobody agreed on what 'active driver' meant, so I ran sessions to settle a
          definition."

        **Influence.**

        - Mid-level: "My manager decided."
        - Senior or staff: "I wrote the design doc, got sign-off from two directors and changed the
          roadmap."

        **Impact.**

        - Mid-level: "It worked."
        - Senior or staff: "Freshness went from a day to 10 minutes, which let ops cut response time by 30%."

        **Multiplying.**

        - Mid-level: not mentioned.
        - Senior or staff: "I wrote the runbook and trained the on-call rotation, so incidents no longer
          needed me."

        ## Idea 2: habits that raise the level

        - **Start from the business problem**, not the technology.
        - **Name the trade-off** you chose, and the option you rejected.
        - **Show you saw around corners:** risks you raised before they happened.
        - **Show leverage:** what other people could do because of your work.

        ## Now say it like a senior engineer

        Tell the story from the business problem, show the ambiguity you resolved, the trade-off you chose,
        the people you influenced, the measured impact, and how your work multiplied others, all without
        inflating your role.

        > [!example] Same project, two tellings
        > Mid-level: "I migrated our Airflow DAGs to the new cluster." Senior: "Our nightly SLA
        > was missed twice a week. I traced it to resource contention on a shared cluster,
        > proposed isolating critical DAGs, wrote the plan, migrated the 40 critical DAGs myself
        > and gave the other teams a template. Misses dropped to one a quarter."

        > [!senior] Choose your biggest true story
        > Do not inflate. Interviewers dig with "what exactly did you do?" and "what would you do
        > differently?". A real story at the right scope beats an inflated one that collapses
        > under follow-ups.

        ## In one breath

        Your level shows in scope, ambiguity, influence, impact and how you multiplied others, not in
        effort. Start from the business problem, name the trade-off, and tell your biggest true story,
        never an inflated one.
      `,
      checks: [
        {
          question: 'Which telling signals the highest level?',
          options: [
            'I worked late every night to ship the pipeline',
            'I built the tables my manager specified',
            'I found three teams duplicating work, proposed a shared pipeline, and got two directors to fund it',
            'The team delivered on time',
          ],
          answer: 2,
          why: 'It shows scope beyond the assignment, influence across teams and a business result.',
        },
      ],
    },
    {
      slug: 'conflict-and-failure',
      title: 'Conflict, failure and feedback',
      summary: 'Answer the hardest behavioral questions honestly and well.',
      minutes: 13,
      body: `
        ## Start with the problem

        "Tell me about a failure." The candidate says: "I worked too hard on a project and burned out a
        little." The interviewer writes: "Low self-awareness." Another candidate tells a conflict story in
        which the other engineer sounds like a fool. The interviewer writes: "Blames others."

        Questions about conflict and failure test **self-awareness**. Interviewers look for candidates who
        disagree with respect, own their mistakes, and change because of them.

        ## Idea 1: a good conflict story

        A good conflict story has a real disagreement about something that mattered, with a reasonable
        person on the other side. Like a good film: the other side has a point, or there is no story.

        - Describe the other person's view fairly. If they sound foolish, the story fails.
        - Show how you found the shared goal, and used data or a small experiment to decide.
        - Show the outcome, including if you lost the argument and committed anyway.

        ## Idea 2: a good failure story

        Pick a real failure with real consequences, where your decision contributed.

        - **Own it in one sentence:** "I pushed the schema change without checking downstream readers."
        - **Explain the recovery:** what you did to fix it.
        - **Spend the most time on the change:** what you changed afterwards, in yourself and in the system.

        ## Idea 3: feedback

        "Tell me about critical feedback you received" asks whether you can hear it. Give a real example,
        what you changed, and evidence that it worked.

        ## Now say it like a senior engineer

        Conflict stories present the other side fairly, find the shared goal, decide with data, and show
        commitment even when you lost. Failure stories own the mistake in one sentence and spend most time on
        the lasting change. Feedback stories show the change and its evidence.

        > [!trap] The disguised strength
        > "My weakness is that I care too much" and "I failed because I worked too hard" signal
        > low self-awareness. Interviewers have heard them many times.

        > [!senior] Disagree and commit
        > A strong senior story often ends with: "We went with their approach. I committed fully,
        > and I set up a metric so we would know early if it wasn't working." It shows judgment
        > and team play at the same time.

        ## In one breath

        In conflict stories make the other side reasonable and decide with data; in failure stories own the
        mistake in one sentence and spend your time on what you changed. A disguised strength is the one
        answer that always fails.
      `,
      checks: [
        {
          question: 'What makes a failure story strong?',
          options: [
            'The failure was caused by someone else',
            'It was minor and had no impact',
            'You own your part, explain the recovery and show what you changed afterwards',
            'It shows that you work too hard',
          ],
          answer: 2,
          why: 'Ownership, recovery and lasting change are what interviewers look for.',
        },
      ],
    },
    {
      slug: 'uber-and-google-culture',
      title: 'What Uber and Google listen for',
      summary: 'Map your stories to how each company evaluates behaviour and leadership.',
      minutes: 14,
      body: `
        ## Start with the problem

        You have a great story about a migration. At Uber you tell it as "I followed the plan carefully".
        At Google you tell it as "I owned it alone". Both land badly, because each company listens for
        different things, and the notes the interviewer writes are matched against a rubric.

        Both companies use structured interviews with written feedback against a rubric. So every story
        should give the interviewer clear evidence to write down, in the words their rubric uses.

        ## Idea 1: Uber

        Uber publishes a short set of cultural values; read the current list on its careers site before the
        loop. Themes that come up in data engineering interviews:

        - **Act like an owner:** you fixed problems outside your remit and followed through.
        - **Customer obsession:** you know who uses your data (ops teams, drivers, riders) and built for
          them.
        - **Do the right thing:** you raised a data correctness or privacy concern when it was inconvenient.
        - **Persevere and bet boldly:** you pushed a hard migration or a new system through setbacks.
        - **Ideas over hierarchy:** you challenged a senior person's plan with evidence.

        Uber hiring managers often run a round that mixes past projects with behavioral questions. Expect
        deep follow-ups on one large project: architecture, your decisions, and what you would change.

        ## Idea 2: Google

        Google evaluates **general cognitive ability, role-related knowledge, leadership and
        "Googleyness"**. The behavioral round (often called Googleyness and Leadership) looks for:

        - Comfort with ambiguity, and a bias to action.
        - Collaboration, and helping others succeed.
        - Doing what is right for users.
        - Intellectual humility: changing your mind when the evidence says so.
        - Emergent leadership: stepping up without a title when a situation needs it.

        Interviewers write detailed notes, and the packet is reviewed beyond the interviewers themselves. For
        senior roles, a team-matching step usually follows.

        ## Now say it like a senior engineer

        Map each story to the company's rubric: Uber's values such as ownership, customer obsession and
        ideas over hierarchy, and Google's ambiguity, collaboration, user focus, humility and emergent
        leadership. Give concrete evidence that a note-taker can write down.

        > [!tip] Prepare one story per theme per company
        > Take your story bank and tag each story with an Uber value and a Googleyness attribute.
        > Then you can open with the story that fits the question best in either loop.

        > [!senior] Ask questions that show judgment
        > At the end, ask about the hardest data problem the team has, how they measure data
        > quality, or what a great first year looks like. Avoid questions you could answer with a search.

        ## In one breath

        Uber listens for ownership, customers, doing right and challenging ideas with evidence; Google
        listens for ambiguity, collaboration, users, humility and stepping up. Tag each of your stories with
        both, and give evidence a note-taker can write down.
      `,
      checks: [
        {
          question: 'Which story best shows Google’s "intellectual humility"?',
          options: [
            'You were right about a design and proved your team wrong',
            'You changed your design after a junior engineer’s benchmark showed a better approach',
            'You worked alone to finish faster',
            'You avoided a difficult conversation',
          ],
          answer: 1,
          why: 'Humility means updating your view on evidence, whoever brings it.',
        },
      ],
    },
    {
      slug: 'pitching-your-project',
      title: 'Pitching your biggest project',
      summary: 'Present one project in two minutes and survive a 30-minute deep dive.',
      minutes: 12,
      body: `
        ## Start with the problem

        "Walk me through a project you are proud of." The candidate talks for eight minutes, starting with
        the company's history. The interviewer interrupts to ask "why Flink and not Spark?", and the
        candidate says "that was decided before I joined". The project sounded big; the candidate's part
        sounded small.

        Many loops include this question. It is part behavioral and part design: the interviewer checks your
        scope, your technical depth, and whether the project was really yours.

        ## Idea 1: the two-minute version

        Think of an elevator pitch with five floors:

        - **Problem:** the business pain, with a number.
        - **Constraints:** scale, deadline, team, legacy.
        - **Your design:** the main components, and the one decision that mattered most.
        - **Result:** the measured outcome.
        - **Your role:** what you led, and who else was involved.

        ## Idea 2: survive the deep dive

        Prepare for these follow-ups before the loop:

        - Draw the architecture. Why each component? What did you consider instead?
        - What broke in production, and how did you find out?
        - How did you know the data was correct?
        - What would you change if you started again?
        - How would it work at 10 times the scale?

        ## Now say it like a senior engineer

        Open with a two-minute pitch (problem with a number, constraints, design and key decision, measured
        result, your exact role), then defend every component, the failures, the correctness checks, the
        regrets and the 10x path.

        > [!example] A strong opening
        > "Our marketplace team made pricing decisions on data that was a day old. I led a team of
        > three to build a streaming pipeline from Kafka to a real-time OLAP store, with a nightly
        > reconciliation against the lake. Freshness went from 24 hours to under 2 minutes, and the
        > pricing team ran their first intra-day experiments within a month. I owned the design and
        > the Flink jobs; another engineer owned the serving layer."

        > [!senior] Have a "what I'd change" ready
        > "I underestimated schema changes from the app team; I would put a data contract in place
        > on day one." A candid improvement shows growth and depth at once.

        ## In one breath

        Pitch your project in two minutes: the pain with a number, the constraints, your key decision, the
        result and your exact role. Then be ready to defend every box, what broke, how you knew it was
        correct, and what you would change.
      `,
      checks: [
        {
          question: 'Which element is most often missing from project pitches?',
          options: [
            'The name of the database',
            'A measured business result and a clear statement of the candidate’s own role',
            'The number of meetings held',
            'The programming language',
          ],
          answer: 1,
          why: 'Without a result and a clear role, the interviewer cannot judge impact or ownership.',
        },
      ],
    },
    {
      slug: 'build-your-story-bank',
      title: 'Build and rehearse your own story bank',
      summary:
        'Mine your last three years for 8 to 10 true stories, map them to the themes loops ask, and rehearse them under follow-up questions.',
      minutes: 16,
      body: `
        ## Start with the problem

        You have read the example answers in this track. They sound great. But in the loop, the interviewer
        asks about **your** conflict, **your** failure, **your** biggest project. Examples written by someone
        else do not help you then.

        Your loop is scored on your stories. Write them before the loop, not in it. The **Story bank** page,
        linked from this track, stores them, shows which themes are still missing, and checks each story as
        you write.

        ## Step 1: mine your history

        Go through the last three years, project by project. For each, note one line: what changed, what you
        decided, and one number. Good sources are performance reviews, launch notes, postmortems you wrote and
        design documents. Expect 15 to 25 candidates.

        Think of panning for gold: you sift a lot of sand to keep a few nuggets.

        ## Step 2: pick 8 to 10 and map the themes

        Ten themes, and the question behind each:

        - **Conflict:** a disagreement with another team.
        - **Failure:** your biggest mistake.
        - **Influence:** changing minds without authority.
        - **Ambiguity:** delivering when the goal was unclear.
        - **Trade-off:** quality against a deadline.
        - **Biggest project:** the project you are proudest of.
        - **Multiplying others:** making other engineers better.
        - **Disagree and commit:** a decision you disagreed with.
        - **Customer impact:** putting users first.
        - **Data-driven call:** deciding with incomplete data.

        One strong story often answers two to four themes. A migration you led can be the biggest project,
        an influence story and a trade-off story, told with a different emphasis each time. Aim to cover at
        least eight themes, with no story used for more than four.

        ## Step 3: write each story in STAR, at the right level

        - **Situation:** two sentences, and one number for the stakes.
        - **Task:** what you owned, and why it was hard.
        - **Action:** three to five steps with "I", including the option you rejected.
        - **Result:** numbers, and what changed for other teams.
        - **Learned:** one thing you would do differently.

        About 300 words is two minutes out loud, which is the right length.

        ## Step 4: rehearse against follow-ups

        Interviewers dig. Practise each story against these questions:

        1. "What exactly did you do, as opposed to the team?"
        2. "What did the other side say? Were they right about anything?"
        3. "What would you do differently?"
        4. "What happened six months later?"
        5. "How did you measure that result?"

        Record yourself once per story. Then prepare a 30-second version of each, for the "tell me briefly"
        moments.

        ## Now say it like a senior engineer

        Mine three years of work for candidates, choose 8 to 10 that together cover at least eight themes,
        write each in STAR at about 300 words with "I" and a rejected option, and rehearse against the five
        standard follow-ups, with a 30-second version of each.

        > [!trap] Do not borrow a story
        > A story you did not live falls apart at the second follow-up. Interviewers are
        > trained to dig until they reach your real role.

        > [!senior] Keep the bank alive
        > After each loop, note which questions came up and which story you used. Gaps show
        > up fast, and the next loop goes better.

        ## In one breath

        Sift your last three years for 8 to 10 real stories that cover the common themes, write each in STAR
        with numbers and "I", and rehearse them against the follow-ups. Your own lived stories are the only
        ones that survive the second question.
      `,
      checks: [
        {
          question: 'How many stories does a well-prepared candidate usually need?',
          options: [
            'Two, told very well',
            'Eight to ten, covering most themes, with each used for at most four',
            'One per possible question, about forty',
            'None; answers should be improvised',
          ],
          answer: 1,
          why: 'Eight to ten true stories cover almost every behavioral question when each is told with the right emphasis.',
        },
        {
          question: 'Which follow-up question most often exposes a weak story?',
          options: [
            '"What database did you use?"',
            '"What exactly did you do, as opposed to the team?"',
            '"How long was the project?"',
            '"Who was your manager?"',
          ],
          answer: 1,
          why: 'Interviewers dig for your own role. A story told with "we" throughout cannot be scored.',
        },
      ],
    },
    ...behavioralLoopLessons,
  ],
};

export const problems: Problem[] = [
  {
    slug: 'conflict-with-another-team',
    title: 'Tell me about a conflict with another team',
    track: 'behavioral',
    kind: 'behavioral',
    difficulty: 'medium',
    companies: ['uber', 'google', 'amazon', 'microsoft', 'meta', 'flipkart'],
    prompt: `
      "Tell me about a time you disagreed with another team about a technical decision. What
      happened?" Outline your answer using one of your own stories, then compare it with the
      model answer.
    `,
    hints: [
      'Describe the other team’s position fairly.',
      'What was the shared goal?',
      'What data or experiment settled it?',
    ],
    answer: `
      A model story, in STAR shape:

      **Situation.** The mobile platform team wanted to send events as free-form JSON so app
      teams could add fields without review. My team consumed those events for trip analytics,
      and malformed events had caused two dashboard incidents that quarter.

      **Task.** I owned the ingestion pipeline and needed a schema policy both teams could live with.

      **Action.** I met their lead to understand the concern: app teams shipped weekly and could
      not wait days for schema reviews. That was fair. I proposed Protobuf schemas in a registry
      with backward compatibility checked automatically in their CI, so additive changes needed
      no review at all and only breaking changes were blocked. I built a prototype on one event
      type and measured it: no extra review time, and it would have blocked both past incidents.

      **Result.** They adopted it for all trip events over a quarter. Event-related incidents
      dropped from about 3 a quarter to none in the next two. What I learned: start from the other
      team's constraint, not from my own pain.
    `,
    signals: [
      'Describes the other side’s view as reasonable',
      'Finds the shared goal or constraint',
      'Uses a prototype or data to decide',
      'Shows a measured result',
      'Ends with a lesson learned',
    ],
    followUps: [
      'What would you have done if they had said no?',
      'How did you keep the relationship good afterwards?',
    ],
  },
  {
    slug: 'biggest-mistake',
    title: 'Tell me about your biggest mistake',
    track: 'behavioral',
    kind: 'behavioral',
    difficulty: 'medium',
    companies: ['uber', 'google', 'amazon', 'microsoft', 'meta', 'flipkart'],
    prompt: `
      "Tell me about a time you made a mistake that affected others." Outline your answer, then
      compare it with the model answer.
    `,
    hints: [
      'Own your part in one sentence.',
      'Most of the answer should be about what changed afterwards.',
    ],
    answer: `
      **Situation.** I was migrating a revenue table to a new partition scheme on a Friday afternoon.

      **Mistake.** I ran the backfill with a filter bug and overwrote three days of revenue with
      partial data. Finance's Monday report was understated by about 12%. I had skipped the
      comparison step because the change looked simple.

      **Recovery.** A finance analyst flagged it on Monday morning. I told my manager and finance
      within 15 minutes, restored the three days from table history, re-ran downstream jobs and
      confirmed totals against the payments ledger before noon.

      **What changed.** I wrote the postmortem and made two changes: a write-audit-publish step
      for all finance tables, which compares totals with the ledger before publishing, and a
      team rule that backfills on money tables need a second reviewer. In the next year those
      checks blocked two similar mistakes, including one of my own.
    `,
    signals: [
      'A real mistake with real impact',
      'Clear ownership with no blaming',
      'Fast, transparent communication',
      'Systemic fixes, not just "be more careful"',
      'Evidence the fix worked',
    ],
    followUps: ['How did finance react, and how did you rebuild their trust?'],
  },
  {
    slug: 'influence-without-authority',
    title: 'Influence a decision without authority',
    track: 'behavioral',
    kind: 'behavioral',
    difficulty: 'hard',
    companies: ['uber', 'google', 'amazon', 'microsoft', 'meta', 'flipkart'],
    prompt: `
      "Tell me about a time you convinced people to change direction when you had no authority
      over them." This is a core staff-level question. Outline your answer, then compare.
    `,
    hints: [
      'Whose decision was it, and why did they hold their position?',
      'What evidence or document moved them?',
      'Who did you bring along first?',
    ],
    answer: `
      **Situation.** Four product teams each ran their own copy of a "daily active riders"
      pipeline. Each had a slightly different definition, and leadership saw four different
      numbers in four reviews.

      **Task.** Nobody owned the definition. I was a senior engineer on one of the four teams.

      **Action.**

      - I quantified the problem: the four numbers differed by up to 9%, and the pipelines cost
        about $20,000 a month together.
      - I met each team's lead separately to learn why their definition differed. Two
        differences were accidental; two were real needs.
      - I wrote a one-page proposal: one certified metric with a documented definition, plus
        named variants for the two real needs, all from one pipeline.
      - I asked the analytics director, who felt the pain in reviews, to sponsor it.
      - I offered to build the shared pipeline and migrate the first team myself.

      **Result.** All four teams moved within two quarters. Leadership reviews used one number,
      and the duplicated pipelines were turned off, saving most of that cost. The approach became
      the template for certifying other core metrics.
    `,
    signals: [
      'Quantifies the problem to create urgency',
      'Listens to each party before proposing',
      'Writes the proposal down',
      'Finds a sponsor and lowers the cost of saying yes',
      'Impact beyond the original problem',
    ],
    followUps: ['One team still refused. What would you do?'],
  },
  {
    slug: 'ambiguous-project',
    title: 'Deliver when the goal is unclear',
    track: 'behavioral',
    kind: 'behavioral',
    difficulty: 'medium',
    companies: ['google', 'amazon', 'microsoft', 'meta', 'flipkart'],
    prompt: `
      "Tell me about a project where the requirements were vague or kept changing. How did you
      make progress?" Outline your answer, then compare.
    `,
    hints: ['How did you narrow the problem?', 'What did you ship first, and why that?'],
    answer: `
      **Situation.** Leadership asked for "better data on driver churn". There was no definition
      of churn, no owner and no deadline.

      **Action.**

      - I interviewed the three groups who cared: driver operations, pricing and finance. Each
        meant something different by churn.
      - I wrote down three candidate definitions with example numbers and got the groups to agree
        on one primary definition and one secondary.
      - I shipped a simple daily table and a dashboard in two weeks rather than a complete model in
        three months, and asked each group which decisions it changed.
      - Their feedback set the next steps: city-level breakdowns and a weekly cohort view.

      **Result.** Driver operations used the dashboard to target a retention campaign in two
      cities, which cut 30-day churn there by about 4 points. What I learned: in ambiguity, a
      small shipped thing gets better requirements than any meeting.
    `,
    signals: [
      'Turns ambiguity into explicit options',
      'Gets stakeholders to agree on a definition',
      'Ships something small quickly to learn',
      'Ties the outcome to a decision someone made',
    ],
    followUps: ['How did you decide what not to build?'],
  },
  {
    slug: 'deadline-tradeoff',
    title: 'Trade quality against a hard deadline',
    track: 'behavioral',
    kind: 'behavioral',
    difficulty: 'medium',
    companies: ['uber', 'amazon', 'microsoft', 'meta', 'flipkart'],
    prompt: `
      "Tell me about a time you had to cut scope or accept a risk to hit a deadline." Outline
      your answer, then compare.
    `,
    hints: ['What did you refuse to cut?', 'How did you make the risk visible?'],
    answer: `
      **Situation.** A new city launch needed trip and earnings reporting on day one. Three weeks
      before launch, a dependency slipped and we had half the time we planned.

      **Action.**

      - I split the work into must-have and can-wait. Must-have: earnings correctness (drivers
        get paid from it) and the core ops dashboard. Can-wait: historical backfill, extra
        breakdowns, automated anomaly alerts.
      - I refused to cut the reconciliation of earnings against payments, because a payout
        error would hurt drivers and trust.
      - I wrote down the risks we accepted (manual monitoring for the first month) and got the
        launch lead to sign off in writing, with dates for the deferred items.

      **Result.** We launched on time with correct earnings. The deferred items shipped within
      five weeks as planned. One manual check caught a currency rounding bug in week two,
      which justified keeping reconciliation in scope.
    `,
    signals: [
      'Separates must-have from can-wait clearly',
      'Protects correctness where people are harmed by errors',
      'Makes accepted risk explicit and agreed',
      'Follows through on the deferred work',
    ],
    followUps: ['What would you do if leadership insisted on cutting the reconciliation?'],
  },
  {
    slug: 'why-this-company',
    title: 'Why Uber? Why Google?',
    track: 'behavioral',
    kind: 'behavioral',
    difficulty: 'easy',
    companies: ['uber', 'google', 'amazon', 'microsoft', 'meta', 'flipkart'],
    prompt: `
      "Why do you want to work here, and why this role?" Write a 60-second answer for the
      company you are targeting, then compare with the model answers.
    `,
    hints: [
      'Connect a specific data problem at the company to your experience.',
      'Avoid answers that fit any company.',
    ],
    answer: `
      A strong answer joins three things: a specific problem at the company, your relevant
      experience, and what you want to learn.

      **Uber example.** "I've spent three years making batch pipelines incremental, and Uber is
      where that problem is hardest: a marketplace that changes every second, with pricing and
      ops teams who act on data in minutes. Uber built Hudi and runs Pinot at huge scale; I want
      to work on data where freshness and correctness of money both matter, and learn from
      people who built those systems."

      **Google example.** "I care about data systems that many teams build on. Google's scale
      means a small improvement in a shared pipeline or a metric definition affects products
      used by billions of people. My recent work on a metrics layer for experiments is the kind
      of problem I'd like to go deeper on, with engineers who wrote much of the research I learned from."

      Avoid: perks, the brand name alone, or "I use the product every day" with nothing else.
    `,
    signals: [
      'Names a specific data problem at the company',
      'Connects it to your own experience',
      'Says what you want to learn',
      'Under about 60 seconds',
    ],
    followUps: ['What would you want to work on in your first six months?'],
  },
  ...behavioralLoopProblems,
];
