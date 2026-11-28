import type { Problem } from '@/types/course';

/**
 * More data quality problems: write-audit-publish, a contract check in CI,
 * thresholds that differ by segment, and an incident timeline. They join the
 * quality track in `quality.ts`.
 */

export const qualityDepthProblems: readonly Problem[] = [
  {
    slug: 'write-audit-publish',
    title: 'Publish a table only after it passes checks',
    track: 'quality',
    kind: 'design',
    difficulty: 'medium',
    companies: ['uber', 'google', 'amazon', 'microsoft', 'walmart'],
    prompt: `
      Twice this quarter the nightly «fct_orders» load wrote bad rows, and dashboards and an ML job
      read them before anyone noticed. Design the load so that readers never see a partition that
      failed its checks. The table is an Iceberg table read by Trino and Spark.
    `,
    hints: [
      'Readers must not see the data before the checks run.',
      'Iceberg has branches and snapshots. Hive tables have partitions and views.',
      'What happens to the failed data, and who is told?',
    ],
    answer: `
      Use **write-audit-publish** (WAP).

      1. **Write** to a place readers do not read. On Iceberg, write to a branch: set
         «spark.wap.branch = audit_2024_06_01» for the job, so the commit lands on that branch and
         «main» does not change. On a Hive-style table, write to a staging table or a hidden
         partition.
      2. **Audit** the branch: row count against the source and against last week, uniqueness of
         «order_id», no orphan keys, totals against the payment system within 0.1 percent,
         freshness of the newest row. Run the checks with the same engine readers use.
      3. **Publish** with one atomic step: «CALL system.fast_forward('fct_orders', 'main',
         'audit_2024_06_01')». Readers see the old snapshot or the new one, never half.

      **On failure.** Do not publish. Keep the branch for debugging, page the owner, and mark the
      partition stale in the catalog so dashboards show "data delayed" instead of old numbers
      that look current. A blocking check stops the publish; a warning check publishes and opens a
      ticket. Decide which is which with the consumers.

      **Why not check after publishing?** Because the ML job already trained on it. WAP moves the
      check before the first reader, which is the only place it protects anyone.
    `,
    signals: [
      'Separates write, audit and publish',
      'Uses an atomic publish (branch fast-forward, snapshot swap or view switch)',
      'Names concrete checks, including a reconciliation with the source',
      'Separates blocking checks from warnings',
      'Says what readers see when the publish is held',
    ],
    followUps: [
      'The checks take 40 minutes and the SLA is tight. What do you do?',
      'A late correction arrives after the publish. Does it go through WAP again?',
    ],
  },
  {
    slug: 'contract-break-in-ci',
    title: 'Catch a breaking schema change in CI',
    track: 'quality',
    kind: 'design',
    difficulty: 'medium',
    companies: ['uber', 'google', 'meta', 'microsoft', 'phonepe'],
    prompt: `
      A backend team renamed «fare_amount» to «fare» in the trip event and shipped it on a Friday.
      The pipeline wrote NULL fares all weekend. Design a check that stops this change in the
      producer's pull request, before it ships.
    `,
    hints: [
      'The check must run in the producer repository, not in yours.',
      'You need a machine-readable contract and a compatibility rule.',
      'Some changes are safe. Which ones?',
    ],
    answer: `
      **The contract.** The event schema lives in a schema registry (Avro or Protobuf), and a
      contract file next to it names the owner, the consumers, the fields they depend on and the
      compatibility mode. It is versioned with the producer's code.

      **The CI check.** In the producer's pull request, a job compares the new schema with the
      latest registered one:

      - Compatibility mode **BACKWARD_TRANSITIVE**: a new schema must read all old data. Removing or
        renaming a field without a default fails.
      - A field listed as used by a consumer cannot be removed, renamed or narrowed, even when the
        registry would allow it.
      - Adding an optional field with a default is safe and passes.

      The job fails the pull request with a message that names the consumers and links the
      process for a breaking change.

      **The breaking-change process.** Add «fare» next to «fare_amount», write both, tell the
      consumers, move them, then remove the old field in a later version. Each step is a normal
      pull request.

      **Defence in depth.** On the consumer side, a check on the landing table fails the load when
      the NULL rate of a required field jumps, so a change that slipped through stops on the first
      batch, not after a weekend.
    `,
    signals: [
      'Puts the check in the producer pull request',
      'Uses a registry with an explicit compatibility mode',
      'Protects the fields consumers use, not only the registry rules',
      'Describes an expand-and-contract process for real breaking changes',
      'Adds a consumer-side check as a second line',
    ],
    followUps: [
      'The producer team says the check slows them down. How do you answer?',
      'How do you find out which consumers use which fields?',
    ],
  },
  {
    slug: 'anomaly-thresholds-by-segment',
    title: 'Set alert thresholds that differ by segment',
    track: 'quality',
    kind: 'concept',
    difficulty: 'hard',
    companies: ['uber', 'swiggy', 'amazon', 'google'],
    prompt: `
      A volume check on «fct_orders» uses one rule: alert when daily orders fall more than 20
      percent against last week. It fires every weekend for small cities and missed a real 15
      percent drop in the largest city. Design better thresholds.
    `,
    hints: [
      'Small segments are noisy. Large ones are stable.',
      'Compare each segment with its own history, with the same weekday.',
      'A drop in a large city can matter more than its percentage.',
    ],
    answer: `
      **Per segment, per weekday.** Compare each city with its own last 8 same weekdays. Use the
      median as the baseline and the **median absolute deviation** (MAD) as the spread, because
      one holiday must not move the threshold.

      ~~~sql
      WITH history AS (
        SELECT city_id, EXTRACT(ISODOW FROM order_date) AS dow, orders
        FROM daily_city_orders
        WHERE order_date BETWEEN CURRENT_DATE - 57 AND CURRENT_DATE - 2
      ),
      base AS (
        SELECT city_id, dow, PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY orders) AS median
        FROM history
        GROUP BY 1, 2
      ),
      spread AS (
        SELECT h.city_id, h.dow, b.median,
               PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ABS(h.orders - b.median)) AS mad
        FROM history h
        JOIN base b ON b.city_id = h.city_id AND b.dow = h.dow
        GROUP BY 1, 2, 3
      )
      SELECT y.city_id, y.orders, s.median, s.mad
      FROM daily_city_orders y
      JOIN spread s ON s.city_id = y.city_id AND s.dow = EXTRACT(ISODOW FROM y.order_date)
      WHERE y.order_date = CURRENT_DATE - 1;
      ~~~

      The history window ends the day before the day under test, so a bad day never lowers its own
      threshold.

      **The rule.** Alert when «orders < base − k × 1.4826 × MAD», with k = 4 for paging and k = 3
      for a ticket, and a floor of 2 percent of the base so a very stable city does not page for
      noise.

      **Impact, not only percentage.** Also alert when the absolute drop is larger than a fixed
      number of orders (for example 5,000). That catches a 15 percent drop in the largest city that
      a pure z-score in a quiet week might call normal.

      **Small segments.** Below 200 orders a day, roll cities up to their region for the check, or
      use a Poisson bound, which is honest about small counts.

      **Measure the alert.** Track how many alerts were real for a month. A rule nobody trusts is
      muted, which is worse than no rule.
    `,
    signals: [
      'Uses a baseline per segment and weekday',
      'Uses robust statistics (median and MAD) and says why',
      'Adds an absolute impact rule for large segments',
      'Handles small segments with roll-up or a count model',
      'Measures the precision of the alerts',
    ],
    followUps: [
      'A festival week makes every city spike. How do you avoid false alerts?',
      'How would you set k without guessing?',
    ],
  },
  {
    slug: 'incident-timeline',
    title: 'Run and write up a data incident',
    track: 'quality',
    kind: 'concept',
    difficulty: 'medium',
    companies: ['uber', 'google', 'amazon', 'meta', 'microsoft', 'phonepe'],
    prompt: `
      At 09:10 finance says yesterday's revenue is 40 percent low. You find that a deploy at 23:00
      changed a join and dropped all card payments. Two downstream tables and an exec dashboard read
      the bad data. Walk through the first two hours, minute by minute, then write the key parts of
      the postmortem.
    `,
    hints: [
      'Who must know in the first 15 minutes?',
      'Stop the damage before you fix the cause.',
      'A postmortem without action items with owners is a story.',
    ],
    answer: `
      **Timeline.**

      - **09:10** Acknowledge in the incident channel. Name an incident lead (you) and a
        communicator. Severity 2: wrong numbers in front of executives.
      - **09:20** Stop the damage: mark the three tables stale in the catalog, put a banner on the
        dashboard, pause the downstream jobs that would copy the bad data further.
      - **09:30** Status message: what is wrong, what is not affected, next update at 10:00.
      - **09:45** Find the cause: the deploy at 23:00. Roll back the change rather than fix
        forward under pressure.
      - **10:00** Backfill yesterday from the raw payments, through the normal job, into a branch.
        Audit totals against the payment system.
      - **10:40** Publish, rerun the downstream jobs, remove the banner. Status message with the
        corrected numbers and who should re-pull reports.
      - **11:00** Close the incident. Schedule the postmortem within two working days.

      **Postmortem.** Blameless. Impact: which tables, which readers, for how long, and which
      decisions used the bad number. Root cause: the join changed from LEFT to INNER on a table
      where card payments had a NULL key. Why it was not caught: no test for that case, and no
      volume check by payment method. Action items, each with an owner and a date:

      - A volume check by payment method, blocking the publish.
      - A unit test with a NULL key on that join.
      - Write-audit-publish on the revenue table.
      - Alert finance automatically when the revenue table is held.
    `,
    signals: [
      'Names roles and severity in the first minutes',
      'Contains the damage before fixing the cause',
      'Prefers rollback to a fix under pressure',
      'Communicates on a schedule with what is and is not affected',
      'Writes a blameless postmortem with owned, dated action items',
    ],
    followUps: [
      'The VP already sent the wrong number to the board. What do you do?',
      'How do you know the action items were done three months later?',
    ],
  },
];
