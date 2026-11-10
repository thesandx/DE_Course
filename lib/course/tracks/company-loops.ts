import type { Company, Lesson, Problem } from '@/types/course';

/**
 * Lessons and problems that prepare for the loops outside Uber and Google:
 * Amazon's Leadership Principles, the hiring manager round at Indian product
 * companies, the shape of loops in India, and Meta-style product sense.
 * They join the playbook and behavioral tracks.
 */

export const playbookLoopLessons: readonly Lesson[] = [
  {
    slug: 'india-senior-loops',
    title: 'Senior loops in India at 35 to 50 LPA',
    summary:
      'Know which companies pay this band, how their loops differ, and how to split your preparation time.',
    minutes: 13,
    body: `
      A package of 35 to 50 LPA in India usually means a **senior data engineer** role at a
      product company, with about 6 to 10 years of experience. At the largest global companies
      the same band is nearer mid-senior, and staff roles pay more. The work to get there is
      the same: pass a loop of four to six rounds with no weak round.

      ## Three kinds of employer

      | Kind | Examples | What the loop leans on |
      |---|---|---|
      | Global product companies | Amazon, Microsoft, Google, Uber, Atlassian | Coding with data structures, SQL, design, structured behavioral rounds |
      | Indian product companies | Flipkart, PhonePe, Swiggy, Zomato, Meesho, Razorpay | Spark and Kafka depth, hands-on coding, a deep project discussion |
      | Global capability centres | Walmart Global Tech, Target, Lowe's, large banks | Spark and SQL depth, coding at medium level, design at retail or finance scale |

      ## What differs from the Uber and Google loops

      - **A classic coding round is common.** Arrays, strings, hash maps and sometimes graphs,
        at medium level. Many strong data engineers fail here because they did not practise.
      - **Spark is tested hands-on.** You write PySpark on a shared screen, then explain what
        the cluster does underneath.
      - **The hiring manager round decides.** It is a deep dive into one project, plus your
        reasons to move. A vague project story ends a good loop.
      - **Amazon scores Leadership Principles in every round.** Prepare stories before SQL.
      - **Speed.** Loops often finish within one or two weeks. Your preparation must be done
        before the first call.

      ## Split your time

      A plan for 8 weeks at about 12 hours a week:

      | Area | Share | Where on this site |
      |---|---|---|
      | SQL at speed | 15% | SQL track, all problems timed |
      | Coding patterns | 20% | Coding rounds: DSA patterns |
      | Spark, hands-on and internals | 20% | Spark track, PySpark problems |
      | Data modeling | 10% | Data modeling track |
      | System design | 20% | System design and architecture tracks |
      | Stories and project deep dive | 15% | Behavioral track and the story bank |

      Move the shares after you read the loop guide of each target company. The readiness
      score on each guide page uses that company's weights.

      ## The offer stage

      - **Total compensation has parts:** fixed pay, a variable bonus, stock that vests over
        about four years, and sometimes a joining bonus. Compare offers on the fixed part and
        on the first-year total, and ask for the vesting schedule.
      - **Notice period matters.** Many companies want you within 30 to 60 days. Say your
        real notice period early, and ask whether a buy-out is possible.
      - **Do not name a number first if you can avoid it.** Say you want the level settled
        first, and that you expect the band for that level.
      - **A second offer is the strongest argument.** Run your loops in the same two or three
        weeks, so that the offers overlap.

      > [!senior] What a senior answer adds
      > Ask every recruiter three questions on the first call: which rounds, which level, and
      > who the hiring manager is. Then prepare for that loop, not for a general one.

      > [!trap] Preparing only your strengths
      > Loops reject on the weakest round. If you have not solved a coding problem in two
      > years, start there in week one, not in week seven.
    `,
    checks: [
      {
        question:
          'Which round do strong data engineers most often fail in Indian product company loops?',
        options: [
          'The recruiter screen',
          'The classic coding round, for lack of practice',
          'The SQL round',
          'The offer discussion',
        ],
        answer: 1,
        why: 'Daily data work does not exercise data structure problems, and the round is a filter. It needs separate, regular practice.',
      },
      {
        question: 'Why run your interview loops in the same two or three weeks?',
        options: [
          'Recruiters require it',
          'So the offers overlap and you can compare and negotiate',
          'To save on travel',
          'So you forget less SQL',
        ],
        answer: 1,
        why: 'An offer usually expires within days. Offers that overlap let you compare them and give you a real alternative in the negotiation.',
      },
    ],
  },
  {
    slug: 'product-sense',
    title: 'Product sense: metrics before tables',
    summary:
      'Choose metrics for a product, explain a metric that dropped, and connect the metric to the data model.',
    minutes: 13,
    body: `
      Meta, Swiggy and many product teams open a data round with a product question: "How
      would you measure the health of this feature?" The round tests whether you understand
      why the data exists. A data engineer who can do this is trusted with the metric layer.

      ## A frame for "which metrics?"

      1. **Goal.** What is the product for, in one sentence? "Reels helps people find short
         videos they enjoy."
      2. **Users and actions.** Who uses it, and what do they do? Viewers watch, like, share.
         Creators post.
      3. **One north-star metric.** The number that grows when the goal is met: "time spent
         watching Reels for each daily active user".
      4. **Supporting metrics.** Reach (daily active users), depth (videos watched for each
         session), retention (returning next week), supply (videos posted for each creator).
      5. **Counter-metrics.** What must not get worse: reports and hides, time on the main
         feed, creator churn.

      Say each metric with its **grain and its denominator**. "Watch time" is unclear.
      "Total seconds watched ÷ daily active viewers, for each day and country" can be built.

      ## From the metric to the model

      The metric tells you the tables.

      | Metric | Fact table and grain | Dimensions |
      |---|---|---|
      | Watch time for each user | «fact_video_view»: one row for each view | user, video, date, device |
      | Videos posted for each creator | «fact_video_post»: one row for each post | creator, date |
      | Daily active users | «fact_user_daily»: one row for each user and day | user, date, country |

      A daily user table lets you compute weekly and monthly active users without scanning
      raw events again.

      ## A metric dropped: the order of checks

      "Daily orders fell 12 percent yesterday. What do you do?" Check the data before the
      business.

      1. **Is the data complete?** Did the pipeline finish? Is a partition missing or late? Is
         one platform absent?
      2. **Did a definition change?** A new filter, a changed join, a deduplication fix, a
         time zone change.
      3. **Did logging change?** A new app version that stopped sending an event.
      4. **Slice it.** By platform, app version, city, payment method and hour. A drop in one
         slice points to a cause. An even drop points to something external.
      5. **External causes.** A holiday, weather, an outage of a payment partner, a competitor.
      6. **Then it is real.** Hand it to the product team with the slices that show where.

      ## Experiments, briefly

      - Assign **users**, not sessions, to a variant, and keep the assignment stable.
      - Log the assignment once, in its own table. Join metrics to it by user and date.
      - Check the **sample ratio**: a 50/50 test that shows 52/48 has a bug in assignment or
        logging.
      - Do not count the same user twice when they use two devices.

      > [!senior] What a senior answer adds
      > Name the metric's owner and its test: "This definition lives in one place in the
      > semantic layer. A check compares it each day with the finance ledger. Without that,
      > three teams will compute three different numbers."

      > [!trap] Jumping to the schema
      > A candidate who draws tables before agreeing on the metric often models the wrong
      > grain. Two minutes on the goal saves the round.
    `,
    checks: [
      {
        question: 'Daily orders fell 12 percent overnight. What do you check first?',
        options: [
          'Competitor prices',
          'Whether the data is complete: late or missing partitions and platforms',
          'The marketing budget',
          'The weather',
        ],
        answer: 1,
        why: 'A pipeline or logging problem is the most common cause of a sudden drop, and it is the cheapest to confirm.',
      },
      {
        question: 'What is a counter-metric?',
        options: [
          'A metric that counts rows',
          'A metric that must not get worse while the main metric improves',
          'The opposite of the north-star metric',
          'A metric used only in experiments',
        ],
        answer: 1,
        why: 'It guards against a win that harms something else, such as more watch time with more reported videos.',
      },
    ],
  },
];

const PRODUCT_LOOPS: readonly Company[] = ['meta', 'swiggy', 'uber', 'amazon'];

export const playbookLoopProblems: readonly Problem[] = [
  {
    slug: 'metric-dropped-overnight',
    title: 'A key metric dropped overnight',
    track: 'playbook',
    kind: 'concept',
    difficulty: 'medium',
    companies: PRODUCT_LOOPS,
    prompt: `
      The dashboard shows that completed orders fell 15 percent yesterday against the same day
      last week. The head of product asks you in a meeting whether it is real. You own the
      pipeline. Walk through what you check, in order, and what you say in the first hour.
    `,
    hints: [
      'Rule out the data before you explain the business.',
      'Which slices would show a logging or pipeline problem?',
      'What do you tell people while you do not know yet?',
    ],
    answer: `
      **In the meeting.** "I do not know yet. I will confirm within the hour whether the data
      is complete. Please do not act on the number until then."

      **Check 1: completeness.** Did every task succeed? I compare the row count of each
      hourly partition with last week. A flat line after 18:00 means late data, not fewer
      orders. I compare the pipeline's count with the count in the order service.

      **Check 2: change.** I read yesterday's deployments: pipeline code, the metric
      definition, the app release, the event schema.

      **Check 3: slices.** By platform, app version, city and payment method.

      | Pattern | Likely cause |
      |---|---|
      | Only Android, only the newest version | The app stopped sending an event |
      | Only one payment method | A payment partner outage; real, with a known cause |
      | Only after one hour, all slices | A late or failed load |
      | Even over all slices | A definition change, or an external cause such as a holiday |

      **Check 4: upstream funnel.** If sessions and carts are normal and only "completed" fell,
      the problem is at payment or at the completion event.

      **Report.** One message with what I checked, what I found and what is still open. If
      the data was wrong, I say when the dashboard is correct again, and I add a volume check
      so the next gap raises an alert before a meeting does.
    `,
    signals: [
      'Says "I do not know yet" and gives a time for an answer',
      'Checks completeness and freshness before business causes',
      'Uses slices to separate logging, pipeline and real causes',
      'Reconciles with the source system',
      'Ends with a monitor that prevents a repeat',
    ],
    followUps: [
      'The data is complete and the drop is real. What do you hand to the product team?',
      'How would you have detected this before the meeting?',
    ],
  },
  {
    slug: 'metrics-for-quick-commerce',
    title: 'Choose metrics for 10-minute grocery delivery',
    track: 'playbook',
    kind: 'concept',
    difficulty: 'medium',
    companies: PRODUCT_LOOPS,
    prompt: `
      You join the data team of a quick-commerce product that promises grocery delivery in 10
      minutes. The product manager asks: "Which five metrics tell us whether the product is
      healthy?" Choose them, define each one exactly, and name the tables you need.
    `,
    hints: [
      'What is the promise to the customer?',
      'There are three sides: customer, store and delivery partner.',
      'Which metric would look good while the business loses money?',
    ],
    answer: `
      **Goal.** Customers get what they ordered, complete, within the promised time, at a cost
      the business can bear.

      | Metric | Exact definition | Why |
      |---|---|---|
      | **On-time rate** (north star) | Orders delivered within the promised minutes ÷ delivered orders, for each day and store | It is the promise |
      | **Fill rate** | Order lines delivered as ordered ÷ order lines placed | A fast order with missing items is a failure |
      | **Repeat rate** | Customers with a second order within 7 days ÷ first-time customers of a week | Shows that the promise creates a habit |
      | **Orders for each partner hour** | Delivered orders ÷ logged-in partner hours | Supply efficiency |
      | **Contribution for each order** | Revenue − cost of goods − delivery cost − discounts, ÷ orders | Guards against buying growth with discounts |

      **Counter-metrics.** Cancellation rate, refund rate, and partner safety incidents; a
      faster delivery must not come from unsafe riding.

      **Tables.**

      - «fact_order»: one row for each order, with promised and actual timestamps and status.
      - «fact_order_line»: one row for each line, with ordered and delivered quantity.
      - «fact_partner_shift»: one row for each partner and shift, with logged-in minutes.
      - Dimensions: customer, store, item, date and time, zone.

      I state one rule for each definition, because each one has a trap: on-time rate uses the
      promise shown to the customer at checkout, not a fixed 10 minutes, and it excludes
      cancelled orders but reports them next to it.
    `,
    signals: [
      'Starts from the customer promise, not from available data',
      'Gives a numerator and a denominator for each metric',
      'Covers customer, supply and money',
      'Names counter-metrics',
      'Derives the fact tables and their grain from the metrics',
    ],
    followUps: [
      'On-time rate improved and repeat rate fell. Give two explanations.',
      'How do you compute on-time rate when the promise changes during the order?',
    ],
  },
];

export const behavioralLoopLessons: readonly Lesson[] = [
  {
    slug: 'amazon-leadership-principles',
    title: 'Amazon Leadership Principles for data engineers',
    summary:
      'Map your stories to the principles Amazon asks engineers about, and survive three levels of follow-up.',
    minutes: 16,
    body: `
      Amazon has 16 Leadership Principles. Every interviewer is assigned two or three and
      must return written evidence for each one. So about half of your loop is story
      questions, and the **Bar Raiser** round is nearly all stories. You cannot improvise
      this. You prepare it.

      ## The principles asked most of engineers

      | Principle | The question behind it | A data engineering story that fits |
      |---|---|---|
      | **Customer Obsession** | Do you start from the customer and work backwards? | You found that analysts could not trust a table, and rebuilt it around their questions |
      | **Ownership** | Do you act beyond your own task? | You fixed an upstream data quality problem that was not yours |
      | **Dive Deep** | Do you know the details and check the numbers? | You traced a 2 percent revenue gap to a time zone bug |
      | **Deliver Results** | Do you finish in spite of setbacks? | A migration that lost a team member and still met the date |
      | **Have Backbone; Disagree and Commit** | Do you disagree openly, then support the decision? | You argued against a tool, lost, and made it work |
      | **Earn Trust** | Do you admit mistakes and treat people well? | You caused an incident and wrote the honest review |
      | **Bias for Action** | Do you decide with incomplete data when the step can be undone? | You paused a pipeline that was writing bad data, before you had the full cause |
      | **Invent and Simplify** | Do you remove complexity? | You replaced five jobs with one parameterised job |
      | **Insist on the Highest Standards** | Do you raise the bar? | You added data contracts and tests to a team that had none |
      | **Frugality** | Do you do more with less? | You cut a cluster bill by 40 percent |
      | **Learn and Be Curious** | Do you learn fast? | You learned streaming to deliver a project |
      | **Are Right, A Lot** | Is your judgement good, and do you change your mind? | A design choice that held, and one you reversed |

      The other four are **Hire and Develop the Best**, **Think Big**, **Strive to be Earth's
      Best Employer** and **Success and Scale Bring Broad Responsibility**. They are asked
      more of managers and of the most senior engineers.

      ## Build the grid

      Prepare **8 to 10 stories**, each from the last three or four years. Tag every story with
      two or three principles. Every principle in the table needs two stories, because an
      interviewer may say "give me another example".

      Use the story bank on this site: write each story once in STAR, and add the numbers.

      ## The shape Amazon wants

      - **Situation and task: 20 percent.** Two or three sentences. Scale and stakes.
      - **Action: 60 percent.** What **you** did, step by step. Say "I".
      - **Result: 20 percent.** A number, then what you learned.

      ## The follow-ups

      Amazon interviewers dig. Expect three levels:

      1. "What exactly did you do?" They separate you from the team.
      2. "Why that option? What else did you consider?" They test judgement.
      3. "What was the number before and after? How did you measure it?" They test Dive Deep.

      If you do not remember a number, say how you would find it. Do not invent one.

      > [!senior] What a senior answer adds
      > Scope and mechanism. A senior story changes how a team works, not only one pipeline:
      > "I added the check, and then I made it a required step in the deployment template, so
      > every new pipeline gets it."

      > [!trap] One story for everything
      > Each interviewer writes notes, and they compare them in the debrief. The same story in
      > three rounds reads as "has only one example". Track which story you told to whom.

      > [!tip] Two failure stories
      > Earn Trust and Ownership questions often ask for a mistake. Prepare one technical
      > failure and one failure of judgement or communication.
    `,
    checks: [
      {
        question: 'How much of an Amazon story should be the Action part?',
        options: [
          'About 10 percent',
          'About 60 percent',
          'About 90 percent',
          'None; results matter only',
        ],
        answer: 1,
        why: 'The interviewer needs evidence of what you did and why. Keep the situation short and spend most of the time on your actions.',
      },
      {
        question: 'Why prepare two stories for each principle?',
        options: [
          'Interviewers ask for a second example, and they compare notes after the loop',
          'Amazon requires exactly two',
          'One is for the recruiter',
          'To fill the hour',
        ],
        answer: 0,
        why: 'A follow-up of "give me another example" is common, and a story repeated in several rounds weakens the debrief.',
      },
    ],
  },
  {
    slug: 'hiring-manager-round',
    title: 'The hiring manager round and the project deep dive',
    summary:
      'Tell one project at three depths, answer "why are you leaving?" well, and ask questions that show seniority.',
    minutes: 13,
    body: `
      At Flipkart, Walmart, PhonePe, Swiggy and most Indian product companies, the last
      technical voice is the **hiring manager**. The round has three parts: a deep dive into
      one project, questions about how you work, and your reasons to move. The manager asks
      one question the whole time: "Do I want this person to own a system on my team?"

      ## The project deep dive

      Choose **one** project where you made the main decisions. Prepare it at three depths.

      | Depth | Length | Content |
      |---|---|---|
      | Pitch | 2 minutes | Problem, scale, your role, the result with a number |
      | Walkthrough | 10 minutes | The architecture, in order of data flow, with the reason for each choice |
      | Whiteboard | 45 minutes | Any box in detail: schema, partitioning, failure handling, cost |

      Know these numbers without looking: events or rows a day, data size, number of jobs,
      latency, cluster size, monthly cost, team size, and the before and after of the result.

      ## The "why" ladder

      The manager picks a box and asks why, several times.

      - "Why Kafka and not a queue service?"
      - "Why 64 partitions?"
      - "What happens when a consumer falls behind for an hour?"
      - "What would you change if you built it again?"

      Two answers fail: "It was already there" and "The architect decided". If you inherited
      a choice, say what it costs, what you would choose today, and why you did not migrate.

      Always prepare the last question. A real weakness of your own design, and how you
      would fix it, is strong evidence of seniority.

      ## How you work

      Expect short story questions: a production incident, a disagreement with your manager,
      a deadline you missed, a junior engineer you helped. Use STAR and keep each answer under
      three minutes.

      ## "Why are you leaving?"

      - **Talk about what you move towards.** Larger scale, a harder problem, ownership of a
        platform, a stronger team.
      - **Do not criticise your employer.** The manager hears how you would talk about them.
      - **Be consistent.** The recruiter, the manager and the last interviewer compare notes.
      - **Have a reason for this company.** Name a system or a problem of theirs that you want
        to work on.

      ## Your questions

      Ask two or three. Good ones:

      - "What is the hardest data problem your team has this year?"
      - "What does on-call look like, and what woke the team last month?"
      - "What would make you say, six months from now, that this hire was a success?"

      > [!senior] What a senior answer adds
      > Speak about trade-offs, people and money: what you chose not to build, how you got
      > another team to adopt it, and what it cost to run.

      > [!trap] "We"
      > "We migrated the warehouse" hides you. Say "I designed the cutover plan; two engineers
      > moved the jobs; I ran the validation." The manager is hiring you, not the team.
    `,
    checks: [
      {
        question:
          'The manager asks why your pipeline uses a tool that you did not choose. What is the best answer?',
        options: [
          '"It was already there."',
          '"The architect decided."',
          'What the choice costs, what you would pick today, and why you did not migrate',
          '"It is the industry standard."',
        ],
        answer: 2,
        why: 'It shows that you understand the trade-off and made a decision about it, even though you inherited the tool.',
      },
      {
        question: 'How should you answer "why are you leaving?"',
        options: [
          'List the problems of your current employer',
          'Say what you want to move towards, and name a reason for this company',
          'Say you want more money',
          'Avoid the question',
        ],
        answer: 1,
        why: 'A forward-looking reason that fits the role is honest and positive. Criticism of an employer makes the manager doubt how you would speak of them.',
      },
    ],
  },
];

const STORY_LOOPS: readonly Company[] = [
  'amazon',
  'microsoft',
  'meta',
  'flipkart',
  'walmart',
  'phonepe',
  'swiggy',
];

export const behavioralLoopProblems: readonly Problem[] = [
  {
    slug: 'lp-customer-obsession',
    title: 'A time you worked backwards from the customer',
    track: 'behavioral',
    kind: 'behavioral',
    difficulty: 'medium',
    companies: ['amazon', 'meta', 'swiggy'],
    prompt: `
      "Tell me about a time you went beyond what was asked to solve a problem for a customer."
      For a data engineer the customer is often an analyst, a data scientist or another team.
      Outline your own story, then compare it with the model answer.
    `,
    hints: [
      'Who used your data, and what could they not do?',
      'What did you learn by watching or asking them, not by reading the ticket?',
      'How did you measure that their problem went away?',
    ],
    answer: `
      A model story for **Customer Obsession**:

      **Situation.** The finance analysts closed the books with our revenue table. The ticket
      said: "The table is late; please make the job faster."

      **Task.** I owned the job. I could have tuned it and closed the ticket.

      **Action.** First I sat with two analysts during a month-end close. The job was late on
      only 2 days of 30. The real pain was different: on those days they did not know *whether*
      the data was complete, so they waited and re-ran their reports three times. I did three
      things. I published a freshness and completeness status for each partition that their
      reports read before they run. I split the job so that the 95 percent of rows that never
      change after day 1 land at 06:00, and late adjustments land separately. I agreed a
      written service level with the finance lead: complete by 08:00 on business days, and a
      message by 07:30 if not.

      **Result.** The close went from three working days to two. Re-runs of the reports went
      from about 40 a close to 3. The job itself got only 20 percent faster, which was not the
      point.

      **Lesson.** The ticket described a solution. I now start with how the customer uses
      the output.
    `,
    signals: [
      'Names a specific customer and their real workflow',
      'Finds the need behind the request by observing, not guessing',
      'Does more than the ticket asked, for a stated reason',
      'Measures the result from the customer side',
      'Says "I" for the actions',
    ],
    followUps: [
      'How did you know the analysts were right about what they needed?',
      'Tell me about a time you had to say no to a customer.',
    ],
  },
  {
    slug: 'lp-dive-deep',
    title: 'A time the numbers did not add up',
    track: 'behavioral',
    kind: 'behavioral',
    difficulty: 'medium',
    companies: ['amazon', 'phonepe', 'walmart'],
    prompt: `
      "Tell me about a time you found the root cause of a problem that others had missed." The
      interviewer will ask for the exact numbers and for each step. Outline your own story,
      then compare it with the model answer.
    `,
    hints: [
      'What first made you doubt the number?',
      'How did you narrow the search? Name each cut.',
      'What was the cause, in one precise sentence?',
    ],
    answer: `
      A model story for **Dive Deep**:

      **Situation.** Our daily revenue table was 1.8 percent below the payments ledger. The
      gap had been accepted for months as "rounding and timing".

      **Task.** Nobody had asked me to look. I owned the table, and a constant gap of that
      size did not look like rounding to me.

      **Action.** I compared the two sources by day: the gap was not constant. It was near 0
      on most days and 6 to 8 percent on a few. I compared by hour on a bad day: all missing
      transactions fell between 18:30 and 19:30 UTC. That is midnight in India. Our job cut
      the day in UTC, and the ledger cut it in local time, so each day lost and gained an
      edge. On days with an evening sale, the edges were unequal. Then I found a second cause
      inside the first: a join to the currency table dropped transactions whose rate arrived
      late, about 0.3 percent. I fixed the day boundary, changed the join to a left join with
      a quarantine table for missing rates, and added a daily reconciliation check with a
      0.1 percent threshold.

      **Result.** The gap went from 1.8 percent to under 0.05 percent. Finance stopped a
      manual adjustment that took one analyst two days each month.

      **Lesson.** A gap that everyone has a name for has usually not been measured. I now
      plot a difference by day before I accept an explanation.
    `,
    signals: [
      'Questions an accepted explanation with data',
      'Narrows the cause in clear steps: by day, by hour, by key',
      'Gives exact numbers before and after',
      'Finds the second cause, not only the first',
      'Adds a check that prevents a repeat',
    ],
    followUps: [
      'How did you prove that the fix was complete?',
      'Why had nobody found it before you?',
    ],
  },
  {
    slug: 'lp-disagree-and-commit',
    title: 'A time you disagreed, lost and committed',
    track: 'behavioral',
    kind: 'behavioral',
    difficulty: 'hard',
    companies: ['amazon', 'microsoft', 'flipkart'],
    prompt: `
      "Tell me about a time you strongly disagreed with your manager or a senior engineer, and
      the decision went against you." Outline your own story, then compare it with the model
      answer.
    `,
    hints: [
      'Was the disagreement about something that mattered?',
      'How did you make your case: with data, a document, a prototype?',
      'What did you do after the decision that shows real commitment?',
    ],
    answer: `
      A model story for **Have Backbone; Disagree and Commit**:

      **Situation.** My director decided to move our streaming jobs from Flink to a managed
      service in one quarter, to cut operations work. I led the team that ran the jobs.

      **Task.** I believed the timeline would break three jobs that used custom state, and
      that the cost estimate was low by half.

      **Action.** I wrote a two-page document with the three risky jobs, a cost model from our
      real throughput, and an alternative: move the 20 simple jobs now and the 3 hard ones
      next quarter. I asked for 30 minutes and presented it. The director heard me, agreed
      with the cost model, and still chose the single quarter, because a contract renewal made
      the date fixed. That was information I did not have. I said in the meeting: "I disagree
      with the risk, and I will make it work." Then I acted on that. I put my two strongest
      engineers on the three hard jobs in week one, not last. I set up dual running with an
      automated comparison of outputs. I reported progress each week against the risks I had
      named, so no one was surprised.

      **Result.** We moved 22 of 23 jobs in the quarter. The last one moved three weeks late,
      with the director's agreement, and without an incident. The real cost was 30 percent
      above the first estimate, in line with my model, and the budget had been raised in
      advance because of the document.

      **Lesson.** I state my disagreement once, in writing, with numbers. After the decision
      I do not reopen it, and I use my knowledge of the risks to reduce them.
    `,
    signals: [
      'Disagrees openly, with data, to the person who decides',
      'Describes the other view as reasonable',
      'Commits visibly and does not undermine the decision',
      'Uses the named risks to make the chosen plan succeed',
      'Reports an honest result, including what went late',
    ],
    followUps: [
      'What would you have done if the migration had failed?',
      'When is it right not to commit?',
    ],
  },
  {
    slug: 'lp-bias-for-action',
    title: 'A decision made with incomplete data',
    track: 'behavioral',
    kind: 'behavioral',
    difficulty: 'medium',
    companies: ['amazon', 'phonepe', 'swiggy'],
    prompt: `
      "Tell me about a time you had to decide quickly without all the information." Outline
      your own story, then compare it with the model answer.
    `,
    hints: [
      'What did waiting cost, for each hour?',
      'Could the decision be undone? How did you know?',
      'What did you do to limit the damage if you were wrong?',
    ],
    answer: `
      A model story for **Bias for Action**:

      **Situation.** At 21:00 on a sale day, an alert showed that our order events topic had
      doubled in volume in ten minutes. A dashboard that the operations team used for
      staffing had started to show order counts that were too high.

      **Task.** I was on call. I did not know the cause. The team that produced the events
      did not answer for 20 minutes.

      **Action.** I weighed two costs. If I waited, wrong counts would keep flowing into the
      staffing dashboard and into three downstream tables that are expensive to repair. If I
      paused the consumer, the dashboard would go stale, but Kafka would keep the events, so
      nothing would be lost. The pause could be undone; the bad writes could not. I paused the
      consumer, put a banner on the dashboard that said "data paused at 21:05, investigating",
      and told the operations lead by phone. Then I sampled the topic and found that every
      event appeared twice, with the same event id: a producer retry bug after their deploy.
      I added deduplication on the event id in the consumer, which we had planned for the
      next sprint, tested it on the captured sample, and resumed from the paused offset.

      **Result.** The dashboard was stale for 38 minutes and correct afterwards. No
      downstream table needed a repair. The producer team fixed the retry bug the next day.

      **Lesson.** I ask one question under pressure: which option can I undo? I take that one
      fast, and I say out loud what I do not know yet.
    `,
    signals: [
      'Compares the cost of waiting with the cost of acting',
      'Separates decisions that can be undone from ones that cannot',
      'Communicates the action and the uncertainty at once',
      'Limits the damage, then finds the cause',
      'Gives times and a measured result',
    ],
    followUps: [
      'Tell me about a fast decision that was wrong.',
      'How do you decide when to wait for more data?',
    ],
  },
  {
    slug: 'lp-ownership-outside-scope',
    title: 'A problem that was not yours',
    track: 'behavioral',
    kind: 'behavioral',
    difficulty: 'medium',
    companies: ['amazon', 'microsoft', 'walmart'],
    prompt: `
      "Tell me about a time you took on something outside your area of responsibility."
      Outline your own story, then compare it with the model answer.
    `,
    hints: [
      'Why did nobody own it?',
      'How did you act without stepping on the other team?',
      'Did you fix it once, or make it stay fixed?',
    ],
    answer: `
      A model story for **Ownership**:

      **Situation.** Four data teams each lost about a day a month to the same failure: a
      shared ingestion library retried forever on a bad credential and filled the logs until
      the cluster disk was full. The library had no owner; its author had left.

      **Task.** It was not my team's code. Each team restarted its jobs and moved on.

      **Action.** I counted the cost first: 9 incidents in 6 months in the incident tracker,
      about 30 engineer-days. I took that to my manager and asked for one week. I did not
      patch the library quietly. I wrote a short proposal, sent it to the four team leads,
      and asked for one reviewer from each team. I fixed the retry policy with a limit and a
      clear error, added tests, and set up a release process. Then I asked the platform lead
      to add the library to their team's charter, with the incident data as the argument, and
      I offered to stay as the second maintainer for two quarters.

      **Result.** No incident from that cause in the next 8 months. The library has an owner,
      a test suite and a changelog. Two other fixes came from the reviewers I had brought in.

      **Lesson.** Ownership is not doing everything myself. I make the cost visible, fix the
      urgent part, and make sure someone owns it after me.
    `,
    signals: [
      'Quantifies a cost that everyone had accepted',
      'Acts beyond their own team without bypassing the other teams',
      'Fixes the cause and the ownership gap',
      'Shows a lasting result',
    ],
    followUps: [
      'What did you stop doing to make time for this?',
      'What if the platform lead had refused to own it?',
    ],
  },
  {
    slug: 'hm-project-deep-dive',
    title: 'Walk me through your most complex pipeline',
    track: 'behavioral',
    kind: 'behavioral',
    difficulty: 'hard',
    companies: ['flipkart', 'walmart', 'phonepe', 'swiggy', 'microsoft'],
    prompt: `
      The hiring manager says: "Pick the most complex data system you have built. You have ten
      minutes, then I will ask questions." Write the outline of your ten minutes for your own
      project, and list the five questions you expect. Then compare with the model.
    `,
    hints: [
      'Open with the problem and the scale, not with the tools.',
      'Follow the data from source to consumer.',
      'Which box is your weakest? The manager will find it.',
    ],
    answer: `
      A model outline, with the time for each part:

      **1. Problem and stakes, 1 minute.** "Merchants saw their settlement report 24 hours
      late, and support got 2,000 tickets a month about it. I led the rebuild to bring it
      under 15 minutes."

      **2. Scale, 30 seconds.** "40 million transactions a day, a peak of 3,000 a second, 600
      GB a day, four engineers, about 9 lakh rupees a month to run."

      **3. Architecture in data-flow order, 4 minutes.** Source databases, change capture into
      Kafka, a streaming job that joins transactions to fees, an upsert into a lakehouse
      table, a serving store for the merchant dashboard, and a nightly batch that reconciles
      with the bank file. For each step: one sentence on what it does and one on why this
      choice.

      **4. The two hardest problems, 3 minutes.** "First, out-of-order events: a refund can
      arrive before its payment. I held the refund in state with a 6 hour timeout and a dead
      letter path. Second, correctness: the stream and the bank file had to agree to the
      paisa. I made the batch reconciliation the source of truth and had it correct the
      stream's table."

      **5. Result and what I would change, 1.5 minutes.** "Report delay fell from 24 hours to
      a median of 4 minutes. Tickets fell by 70 percent. If I built it again, I would not
      write my own state store for the refunds; the engine's state with a time to live would
      have been enough."

      **Questions to expect:** Why change capture and not dual writes? What happens when the
      streaming job is down for two hours? How do you reprocess a bad day? How do you know the
      numbers are right? What did it cost, and where does the money go?
    `,
    signals: [
      'Opens with the business problem and a number',
      'Gives scale, team size and cost without being asked',
      'Explains the reason for each component',
      'Chooses the hard problems, not the easy parts',
      'Names a real weakness of their own design',
      'Says "I" for decisions',
    ],
    followUps: [
      'Which part of this system did you not build, and how well do you know it?',
      'What would break first at ten times the volume?',
    ],
  },
  {
    slug: 'hm-why-leaving',
    title: 'Why are you leaving, and what do you expect?',
    track: 'behavioral',
    kind: 'behavioral',
    difficulty: 'easy',
    companies: STORY_LOOPS,
    prompt: `
      The hiring manager asks three questions in a row: "Why do you want to leave your
      current company? Why us? And what compensation do you expect?" Write your own answers,
      then compare them with the model.
    `,
    hints: [
      'Move towards something. Do not run from something.',
      'What do you know about this team that a stranger does not?',
      'Do you have to give a number now?',
    ],
    answer: `
      **Why leave.** "I have spent four years on the batch platform, and I am proud of it: we
      took the daily load from 9 hours to 2. The next problems I want are real-time and at a
      larger scale, and my company's roadmap does not have them for the next two years."

      It is honest, it names an achievement, and it does not criticise anyone.

      **Why us.** "Your team runs fraud signals on live payment events. I read your
      engineering post on exactly-once processing and the reconciliation design. That
      mix of streaming and strict correctness is the work I want. I would like to hear how you
      handle late events there."

      It names a real system and ends with a question, which starts a conversation.

      **Compensation.** "I would like to settle the level first, because the band follows the
      level. For a senior role I expect to be within your band for it, and I am comparing a
      few options at the moment. Can you share the range for this level?"

      If the recruiter needs a number, give a range whose lower end you would accept, state
      it as total compensation with the fixed part named, and say that it depends on the level
      and the stock.

      **Do not:** give your current pay as the anchor when you can avoid it, promise a joining
      date that your notice period does not allow, or give different reasons to different
      interviewers.
    `,
    signals: [
      'Gives a forward-looking reason with an achievement in it',
      'Shows specific knowledge of the team or its systems',
      'Ties compensation to the level and asks for the range',
      'Stays consistent and honest about notice period and other offers',
    ],
    followUps: [
      'Your current company makes a counter-offer. What do you do?',
      'The level offered is one below what you expected. How do you respond?',
    ],
  },
  {
    slug: 'growth-mindset-feedback',
    title: 'Feedback that was hard to hear',
    track: 'behavioral',
    kind: 'behavioral',
    difficulty: 'medium',
    companies: ['microsoft', 'meta', 'amazon'],
    prompt: `
      "Tell me about a time you received critical feedback. What did you do with it?" Microsoft
      asks this to test growth mindset, Meta to test how you work with partners. Outline your
      own story, then compare it with the model answer.
    `,
    hints: [
      'Choose feedback that was true and that hurt a little.',
      'What did you change, in behaviour that others could see?',
      'What is the evidence that the change worked?',
    ],
    answer: `
      A model story:

      **Situation.** In a review cycle, two product analysts wrote that I was "hard to work
      with on requirements". My manager shared it with me. I had thought I was protecting
      the platform from bad requests.

      **Task.** I needed to understand what they experienced, not to defend myself.

      **Action.** I asked each analyst for 20 minutes and asked one question: "Tell me about
      the last time it was hard." Both described the same thing. When they asked for a new
      column, I answered with reasons why it was difficult, and they left without a path
      forward. I changed three things. I answer a request with options and a cost for each
      one: "I can give you this today from the raw table, slow; or in the model next week."
      I started a weekly 30 minute office hour for the analysts. And I asked one of them to
      tell me, right away, whenever I slipped back.

      **Result.** In the next cycle the same analysts wrote that requests were "clear and
      fast to settle". Requests that came through the office hour took a median of 2 days to
      close, against 6 before. One of the analysts later asked me to review their team's
      metric definitions, which they would not have done before.

      **Lesson.** I was right about the platform and wrong about the conversation. Being
      correct was not enough; the other person needs a way forward.
    `,
    signals: [
      'Chooses real, uncomfortable feedback',
      'Seeks more detail without defending',
      'Changes a visible behaviour',
      'Shows evidence that the change worked',
      'Admits what they had wrong',
    ],
    followUps: [
      'What feedback have you received that you did not agree with?',
      'How do you give critical feedback to a peer?',
    ],
  },
];
