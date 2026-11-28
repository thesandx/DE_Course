import { qualityDepthProblems } from '@/lib/course/tracks/quality-depth';
import type { Problem, Track } from '@/types/course';

export const track: Track = {
  slug: 'quality',
  title: 'Data quality, contracts and governance',
  summary:
    'Contracts, tests, observability, SLOs, privacy deletion and incident response for data that people trust.',
  tone: 'soda',
  why: 'At senior level, "the numbers are wrong" is your problem even when another team caused it. Both loops probe how you prevent, detect and recover from bad data, and how you handle personal data.',
  lessons: [
    {
      slug: 'data-contracts',
      title: 'Data contracts and schema evolution',
      summary: 'Agree what producers promise, and change schemas without breaking consumers.',
      minutes: 15,
      body: `
        ## Start with the problem

        On Tuesday the app team ships a small change. They rename «fare» to «fare_amount», and to "keep
        it consistent" they send it in cents instead of dollars. Their tests pass. Their release is fine.

        Your pipeline breaks in two ways. The rename makes the revenue column null. And in the one place
        that already used the new field, revenue is now 100 times too high. Nobody told you, because
        nobody thought it was your business.

        Most bad data starts upstream like this: an app team renames a field, changes a unit, or stops
        sending an event. A **data contract** is an explicit agreement between a producer and its
        consumers about what the data looks like and how it may change.

        ## Idea 1: a contract is a rental agreement for data

        A rental agreement says what you get, what it costs, who to call when the boiler breaks, and how
        much notice the landlord gives before changing the rules. A data contract says five things:

        - **Schema:** fields, types, nullability, allowed values and units («fare_usd», not «fare»).
        - **Semantics:** what one record means ("one row per trip state change").
        - **Service levels:** freshness, completeness, and how late data may arrive.
        - **Ownership:** who to page, and how changes are announced.
        - **Change policy:** which changes are allowed without notice, and which need a new version.

        ## Idea 2: compatible and breaking changes

        Not every change hurts. Sort them:

        - **Add an optional field with a default:** safe for old and new readers.
        - **Remove an optional field:** safe for new readers; old readers get the default.
        - **Rename a field:** breaking. It is a remove plus an add.
        - **Change a type (string to int):** breaking, unless it is a safe widening.
        - **Change meaning or unit, same name:** breaking, and invisible to schema checks.

        The Tuesday change was two of these at once: a rename, and a unit change.

        ## Idea 3: a schema registry checks at the door

        A **schema registry** (for Avro or Protobuf on Kafka) enforces a compatibility mode **at publish
        time**. A producer that tries a breaking change is refused before any bad record is written.

        - **Backward** compatibility (the usual default): consumers on the new schema can read data
          written with the old one, so you upgrade consumers first.
        - **Forward:** old consumers can read new data.
        - **Full:** both.

        ## Now say it like a senior engineer

        A contract states schema, semantics and units, service levels, ownership and change policy.
        Additive optional fields are safe; renames, type changes and meaning changes are breaking. A
        registry enforces compatibility at publish time, and semantic checks catch what schemas cannot.

        > [!trap] The worst change passes every check
        > Sending cents in a field documented as dollars keeps the schema valid. Only semantic
        > checks (value ranges, distribution monitors) or a human review catch it. This is why
        > contracts include meaning and units, not only types.

        > [!senior] Enforce in CI, not in a wiki
        > Put the contract next to the producer's code and fail their build on a breaking change.
        > A contract that nobody's pipeline checks is a document, not a contract.

        ## In one breath

        A data contract is a rental agreement between producer and consumers: schema, meaning, units,
        service levels, owner and how changes happen. Enforce it in the producer's CI and a schema
        registry, and remember that a unit change passes every schema check.
      `,
      checks: [
        {
          question: 'Which change can slip past a schema registry and still break consumers?',
          options: [
            'Renaming a field',
            'Changing a field from string to int',
            'Switching a field from dollars to cents without renaming it',
            'Removing a required field',
          ],
          answer: 2,
          why: 'The type and name are unchanged, so schema checks pass. Only semantic checks catch a unit change.',
        },
        {
          question: 'Under backward compatibility, which side do you upgrade first?',
          options: [
            'Producers, then consumers',
            'Consumers, then producers',
            'Both at the same moment',
            'Neither; compatibility means no upgrade is needed',
          ],
          answer: 1,
          why: 'Backward compatibility guarantees new readers handle old data, so consumers move to the new schema first.',
        },
      ],
    },
    {
      slug: 'testing-pipelines',
      title: 'Testing pipelines and data',
      summary:
        'Combine code tests, data tests and write-audit-publish so bad data never reaches users.',
      minutes: 16,
      body: `
        ## Start with the problem

        Two bad mornings:

        - A developer changes the trip deduplication logic. It looks fine. In production, trips that
          span midnight are now counted twice.
        - The code is unchanged, but the source system sends half a day of data. The pipeline runs
          "successfully" and publishes half the revenue.

        Pipelines fail in two ways: **the code is wrong**, or **the input is wrong**. You need tests for
        both, and they run at different times.

        ## Idea 1: code tests, before deploy

        Code tests check your logic, like a recipe tested in your own kitchen before it goes on the menu.

        Unit test transformations on small, hand-made inputs. Include the ugly cases:

        - nulls;
        - duplicates;
        - late events;
        - empty partitions;
        - time zones and daylight saving.

        For SQL, test models against fixture tables in CI. The midnight bug is caught by one hand-made
        trip from 23:50 to 00:10.

        ## Idea 2: data tests, on every run

        Data tests check today's input, like tasting each delivery before it reaches the kitchen.

        - **Not null:** «trip_id» is never null.
        - **Unique:** one row per «trip_id» in «fct_trips».
        - **Accepted values:** «status» in ('completed', 'cancelled', 'no_show').
        - **Referential integrity:** every «driver_id» exists in «dim_driver».
        - **Volume:** row count within 30% of the same weekday last week.
        - **Freshness:** the latest «event_ts» is less than 2 hours old.
        - **Reconciliation:** the sum of fares matches the payments system within 0.1%.

        The half-day morning is caught by the volume test. Tools such as dbt tests, Great Expectations and
        Soda express these as configuration.

        ## Idea 3: write-audit-publish

        Do not let consumers see data before it passes its tests. Like a newspaper: the story is written,
        an editor checks it, and only then is it printed.

        - **Write** the new data to a staging location: a branch, a staging table or an unpublished
          snapshot.
        - **Audit** it with the data tests.
        - **Publish** atomically, only if the audit passes: swap the partition, merge the branch or
          commit the snapshot.

        Table formats make this cheap. Iceberg branches and the write-audit-publish flow let you write to
        a branch and fast-forward main after checks.

        ## Now say it like a senior engineer

        Code tests cover logic before deploy, with edge-case fixtures. Data tests run on every load for
        keys, values, references, volume, freshness and reconciliation. Write-audit-publish keeps
        unchecked data invisible, and tests carry a severity so only real problems block.

        > [!tip] Severity levels
        > Not every failed test should stop the pipeline. Mark tests as **block** (stop publish:
        > duplicate keys, empty partition) or **warn** (alert the owner: a 15% volume dip on a holiday).

        > [!senior] Test the contract, not every column
        > Hundreds of shallow tests create alert fatigue. Put strict tests on keys, money and the
        > columns that dashboards and models depend on, and monitor the rest.

        ## In one breath

        Test the code with ugly hand-made inputs before deploy, and test the data on every run for keys,
        volume, freshness and money. Write to a staging place, audit, and publish only what passes.
      `,
      checks: [
        {
          question: 'What is the point of write-audit-publish?',
          options: [
            'To make writes faster',
            'To keep consumers from ever reading data that has not passed its checks',
            'To compress data before publishing',
            'To replace unit tests',
          ],
          answer: 1,
          why: 'Data is written out of sight, checked, then published atomically, so a failed check never reaches a dashboard.',
        },
        {
          question: 'A volume check fails by 18% on Christmas Day. What is the best setup?',
          options: [
            'Every failed test blocks publishing',
            'Volume checks warn the owner, while key and money checks block',
            'Disable volume checks in December',
            'Never test volume',
          ],
          answer: 1,
          why: 'Volume anomalies often have real causes. Warn on them, and block on checks that prove the data is broken.',
        },
      ],
    },
    {
      slug: 'observability-and-slos',
      title: 'Observability, lineage and SLOs',
      summary: 'Define what "healthy data" means, measure it, and alert on what users feel.',
      minutes: 15,
      body: `
        ## Start with the problem

        Your pipeline has 200 tests, and all of them pass. Then the pricing team calls: the
        «surge_zone» column has been 40% null since yesterday. No test checked that column. A new app
        release started sending a blank zone for some riders.

        Tests catch the failures you predicted. **Observability** catches the rest, by watching the data
        and the pipelines continuously.

        ## Idea 1: five signals, like a car's dashboard

        A driver does not test the engine every minute. They glance at the speed, fuel, temperature and
        warning lights. Watch five signals on your data:

        - **Freshness:** how old is the newest data?
        - **Volume:** did the expected number of rows arrive?
        - **Schema:** did columns appear, disappear or change type?
        - **Distribution:** did null rates, averages or category mixes shift? (The «surge_zone» story.)
        - **Lineage:** which upstream tables feed this one, and which dashboards read it?

        ## Idea 2: SLI, SLO, SLA, three words that build on each other

        - An **SLI** is a measurement: "minutes between 00:00 UTC and the daily trips table being
          published".
        - An **SLO** is a target for it: "published by 06:00 UTC on 99% of days in a quarter".
        - An **SLA** is a promise with consequences, usually to another team or a customer.

        Think of a pizza shop. The SLI is delivery time. The SLO is "30 minutes on 99% of orders". The
        SLA is "late pizza is free".

        Set SLOs from what consumers need. Finance closing the books needs completeness and correctness;
        a pricing model needs freshness. One table can have several SLOs.

        ## Idea 3: lineage, the family tree of a table

        Column-level lineage answers two incident questions fast:

        - "What broke this?" Walk **upstream**.
        - "Who is affected?" Walk **downstream**.

        OpenLineage is an open standard that many orchestrators and engines emit.

        ## Now say it like a senior engineer

        Monitor freshness, volume, schema and distribution, with lineage to trace causes and impact. Define
        SLIs and SLOs per consumer need, page only when an SLO is at risk, and use error budgets to decide
        when to slow down risky changes.

        > [!trap] Alert on symptoms, not on every cause
        > Paging on each task retry trains people to ignore pages. Page when an SLO is at risk
        > ("the daily table will miss 06:00"), and send the rest to a dashboard or a ticket.

        > [!senior] Error budgets for data
        > If the SLO allows 1 late day per quarter and you have used it, pause risky migrations on
        > that pipeline. Using the language of error budgets shows you run data like a product.

        ## In one breath

        Tests catch what you predicted; observability watches freshness, volume, schema and distribution
        for everything else. Measure what consumers care about, set a target, and page only when that
        target is at risk.
      `,
      checks: [
        {
          question: 'Which is an SLO rather than an SLI?',
          options: [
            'Minutes from midnight until the table is published',
            'Published by 06:00 UTC on 99% of days this quarter',
            'Row count of yesterday’s partition',
            'Null rate of the fare column',
          ],
          answer: 1,
          why: 'An SLI is the measurement. An SLO is the target set on it.',
        },
        {
          question: 'An incident starts in a source table. How does lineage help most?',
          options: [
            'It fixes the data automatically',
            'It shows every downstream table and dashboard affected, so you can warn owners and plan backfills',
            'It speeds up queries',
            'It replaces data tests',
          ],
          answer: 1,
          why: 'Downstream lineage gives you the blast radius, which drives communication and recovery.',
        },
      ],
    },
    {
      slug: 'privacy-and-deletion',
      title: 'Personal data, access and deletion',
      summary: 'Design pipelines that can classify, protect and delete personal data on request.',
      minutes: 16,
      body: `
        ## Start with the problem

        A rider writes: "Delete all my data." The app team deletes the row from the users database. Done?

        No. The rider's name, phone and trips are also in the lake's raw files, in three warehouse
        tables, in a feature store, in last month's backup, and in the old snapshots of every lakehouse
        table. Under GDPR and similar laws, a deletion request must be honoured within a deadline (one
        month under GDPR, extendable in some cases), across every copy, including the lake.

        Riders, drivers and viewers have legal rights over their data. This lesson is how to make that
        possible at lake scale.

        ## Idea 1: classify first

        You cannot protect what you have not labelled. Tag columns by sensitivity:

        - **Direct identifiers:** name, phone, email.
        - **Quasi-identifiers:** precise location, device id. Not a name, but enough to find a person.
        - **Non-personal data.**

        Tags then drive access policies, masking and retention automatically, instead of relying on
        people remembering. Like coloured labels on medicine bottles: the label decides who may open it.

        ## Idea 2: protect, four habits

        - **Minimize:** do not copy personal fields into tables that do not need them.
        - **Pseudonymize:** replace identifiers with a token or a keyed hash, and keep the mapping in one
          controlled place.
        - **Control access:** column-level security and masking (BigQuery policy tags, row access
          policies).
        - **Retain less:** expire raw data that holds identifiers after a fixed period.

        ## Idea 3: delete at lake scale

        Deleting one user from petabytes of immutable files is expensive. Three common designs:

        - **Row deletes in a table format.** Batch the requests, then delete with merge-on-read and
          compact. Correct and simple, but you must also expire snapshots, so the old files go.
        - **Crypto-shredding.** Encrypt each user's personal fields with a per-user key, and delete the
          key. Deletion is instant everywhere, but key management is harder. Like burning the only key to
          a locked box: the box still exists, but nobody can ever open it.
        - **Tokenized identities.** Facts hold only a token; the token-to-person map lives in one table.
          Delete one mapping row, and the facts stay useful for aggregates.

        ## Now say it like a senior engineer

        Classify columns and let tags drive masking, access and retention. Minimize and pseudonymize
        personal data. Delete with batched table-format deletes plus snapshot expiry, crypto-shredding or
        a single token map, and run deletion as a verified pipeline across every system that lineage
        finds.

        > [!trap] Time travel keeps deleted rows
        > A delete in Iceberg or Delta creates a new snapshot. The old files, with the person's
        > data, stay until snapshot expiry and file cleanup run. The deletion is not complete
        > until they do, and backups need the same treatment.

        > [!senior] Make deletion a pipeline
        > Treat deletion requests as a stream: collect them, fan out to every system that holds the
        > user (found through lineage and tags), apply in batches, verify, and record proof.

        ## In one breath

        Label personal data, copy less of it, and keep identities in one place. To delete a person, batch
        table-format deletes and expire old snapshots, or delete their key or their token row, and run it
        as a pipeline that proves it reached every copy.
      `,
      checks: [
        {
          question:
            'You delete a user from an Iceberg table. Why might their data still be on disk?',
          options: [
            'Iceberg ignores deletes',
            'Older snapshots still reference the original files until snapshots expire and files are removed',
            'Deletes only apply to new partitions',
            'Parquet cannot delete rows',
          ],
          answer: 1,
          why: 'Snapshots keep old files reachable for time travel. Expiry and cleanup are part of the deletion.',
        },
        {
          question: 'What makes crypto-shredding attractive for deletion requests?',
          options: [
            'It needs no key management',
            'Deleting one per-user key makes that user’s encrypted fields unreadable in every copy at once',
            'It makes queries faster',
            'It removes the need for access control',
          ],
          answer: 1,
          why: 'The data can stay in place; without the key, it cannot be read anywhere, including backups.',
        },
      ],
    },
    {
      slug: 'data-incidents',
      title: 'Running a data incident',
      summary: 'Contain, fix, backfill and learn from a data incident like a senior owner.',
      minutes: 14,
      body: `
        ## Start with the problem

        At 10:00 a finance analyst messages: "Revenue on the exec dashboard looks low for the last three
        days." A junior engineer finds a bug, fixes it, reruns one day, and replies "fixed". At 14:00 the
        CFO presents the other two wrong days to the board. Meanwhile a pricing model trained on the bad
        data all morning.

        A **data incident** is any time people may be acting on wrong, late or missing data. The
        technical fix is often the easy part. Seniors are judged on **containment and communication**.

        ## Idea 1: the sequence, like a kitchen fire

        When a pan catches fire, you do not start by asking why. You cover it, get people out of the way,
        check what else is burning, put it out, clean up, and only then ask how to stop it happening
        again. A data incident has the same order.

        1. **Detect and declare.** Name an owner and a channel. Say what you know and what you do not.
        2. **Contain.** Pause the broken pipeline and stop downstream jobs from consuming bad data. Mark
           affected dashboards as stale.
        3. **Assess the blast radius.** Use lineage to list affected tables, dashboards, models and
           external exports, and the date range.
        4. **Fix forward or roll back.** Roll back to a good snapshot when you can; fix the code when you
           must.
        5. **Backfill.** Re-run affected dates in dependency order. This is only safe if jobs are
           idempotent.
        6. **Verify.** Reconcile against a trusted source before you announce recovery.
        7. **Learn.** Write a blameless postmortem with a timeline, and actions that prevent the class of
           failure.

        In the story, steps 2 and 3 were skipped. A stale banner on the dashboard and a lineage check
        would have stopped the board slide and the model training.

        ## Idea 2: communicating

        Update affected teams on a **fixed rhythm**, even when nothing changed. Silence feels like
        nothing is happening.

        Lead with impact, then the next update time. For example: "Revenue in the exec dashboard is
        understated by about 8% for 3 to 5 November. Next update at 12:00."

        ## Now say it like a senior engineer

        Declare an owner, contain by pausing pipelines and marking consumers stale, size the blast radius
        with lineage, roll back or fix, backfill idempotently, verify against a trusted source, and write
        a blameless postmortem whose actions prevent the whole class of failure.

        > [!example] A postmortem action that matters
        > "Be more careful with schema changes" changes nothing. "Add a CI check that blocks
        > breaking changes to the trips contract, owned by the platform team, due 30 November" does.

        > [!senior] Fix the class, not the instance
        > Interviewers listen for whether you prevent the next incident of the same kind: a
        > contract check, a write-audit-publish gate, or an SLO alert that would have fired earlier.

        ## In one breath

        In a data incident, contain first: stop the bad data spreading and tell people, then find
        everything it touched, fix, backfill and verify. Finish with a postmortem action that makes this
        kind of failure impossible next time.
      `,
      checks: [
        {
          question: 'What should happen before you announce that an incident is resolved?',
          options: [
            'The fix is merged',
            'The pipeline runs once successfully',
            'The backfilled data is reconciled against a trusted source',
            'The postmortem is written',
          ],
          answer: 2,
          why: 'A green run proves the code works, not that the data is right. Reconcile first.',
        },
        {
          question: 'Which postmortem action is strongest?',
          options: [
            'Remind engineers to test more carefully',
            'Add a blocking CI check for breaking contract changes, with an owner and a date',
            'Hold a meeting about data quality',
            'Add more logging everywhere',
          ],
          answer: 1,
          why: 'It is specific, owned, dated and prevents the whole class of failure.',
        },
      ],
    },
    {
      slug: 'anomaly-detection',
      title: 'Anomaly detection for data pipelines',
      summary:
        'Catch silent data problems with seasonal baselines and robust statistics, and tune alerts so on-call trusts them.',
      minutes: 17,
      body: `
        ## Start with the problem

        Rule-based tests catch what you predicted: nulls, duplicates, broken keys. The worst incidents are
        the ones nobody predicted: a mobile release that halves events from Android, or a currency field
        that silently switches from dollars to cents. Every test passes, and the numbers are wrong.

        **Anomaly detection** watches metrics about the data and flags values that do not fit their
        history. It is how you catch the problem you did not know to write a test for.

        ## Idea 1: what to watch

        Think of a doctor's routine check: weight, pulse, blood pressure, temperature. None names a
        disease, but a strange value says "look closer".

        - **Volume:** rows per load, per day, per segment. Catches lost partitions, a dead source,
          duplicate loads.
        - **Freshness:** time since the latest event. Catches stalled pipelines.
        - **Distribution:** null rate, distinct count, mean and percentiles of key columns. Catches unit
          changes, broken mappings, default values.
        - **Schema:** columns added, removed, retyped. Catches upstream changes.
        - **Business KPIs:** orders, revenue, conversion. Catches problems that pass every technical
          check.

        **Segment the metric.** Total orders can look normal while one city drops to zero, because
        another city grew.

        ## Idea 2: compare like with like

        Most data has **weekly seasonality**: Saturday is not Tuesday. A restaurant does not panic
        because Monday is quieter than Saturday. It compares this Monday with past Mondays.

        So compare a day with the same weekday over the last several weeks, not with yesterday. Mark
        holidays and known events, or the detector learns them as normal one week and alerts the next.

        ## Idea 3: robust scores, so one bad day does not blind you

        A plain z-score uses the mean and the standard deviation, and one past outage inflates both.
        After that, real problems look small.

        The **median** and the **median absolute deviation (MAD)** ignore a few bad points.

        «robust_z = (value - median) / (1.4826 × MAD)»

        The constant makes MAD comparable to a standard deviation for normal data. A threshold of about
        3.5 to 4 is a common start.

        Tiny example. Past Mondays had 1,000, 1,020, 980, 1,010 and 100 orders (the last was an outage).
        The median is 1,000 and the MAD is 20, so the outage barely moves them. Today's Monday has 600
        orders: (600 - 1,000) / (1.4826 × 20) is about -13.5. That is far past 4, so it alerts.

        ~~~sql
        WITH daily AS (
          SELECT city, CAST(created_at AS DATE) AS d, count(*) AS orders
          FROM orders
          GROUP BY city, CAST(created_at AS DATE)
        ),
        history AS (
          SELECT cur.city, cur.d, cur.orders, prev.orders AS prev_orders
          FROM daily AS cur
          JOIN daily AS prev
            ON prev.city = cur.city
           AND prev.d < cur.d
           AND prev.d >= cur.d - INTERVAL 56 DAY
           AND dayofweek(prev.d) = dayofweek(cur.d)
        ),
        baseline AS (
          SELECT city, d, orders, median(prev_orders) AS base, count(*) AS weeks
          FROM history
          GROUP BY city, d, orders
        ),
        spread AS (
          SELECT b.city, b.d, b.orders, b.base, b.weeks,
                 median(abs(h.prev_orders - b.base)) AS mad
          FROM baseline AS b
          JOIN history AS h ON h.city = b.city AND h.d = b.d
          GROUP BY b.city, b.d, b.orders, b.base, b.weeks
        )
        SELECT city, d, orders, base,
               round((orders - base) / greatest(1.4826 * mad, 0.02 * base), 1) AS robust_z
        FROM spread
        WHERE weeks >= 4
          AND abs(orders - base) / greatest(1.4826 * mad, 0.02 * base) > 4
        ORDER BY d, city;
        ~~~

        Two guards in that query:

        - The «greatest(..., 0.02 * base)» floor stops a very stable series (MAD near zero) from alerting
          on a tiny change.
        - «weeks >= 4» skips series without enough history.

        ## Idea 4: beyond simple statistics

        - **Seasonal decomposition (STL)** or forecasting models (Prophet-style, ARIMA) for series with
          trend and several seasons.
        - **Tools:** Elementary and dbt packages for tests in the warehouse; Monte Carlo, Anomalo, Bigeye
          and the native monitors in Databricks and BigQuery for managed detection.

        The method matters less than the next part.

        ## Idea 5: make alerts trustworthy

        A smoke alarm that goes off every time you make toast gets its battery removed.

        - **Route by owner and severity.** A gold revenue table pages; a sandbox table posts a message.
        - **Alert on the cause once,** not on 40 downstream tables. Use lineage to group them.
        - **Track precision.** Ask on-call to label each alert useful or noise, and tune thresholds per
          metric. Under about 50 percent useful, people stop reading alerts.
        - **Block or warn.** Stop publishing a gold table on a severe anomaly (a circuit breaker), and let
          warnings through with a note on the dashboard.

        ## Now say it like a senior engineer

        Monitor volume, freshness, distribution, schema and business KPIs per key segment, against
        same-weekday baselines with robust median and MAD scores. Route alerts by owner and severity,
        group them by lineage, measure their precision, and let severe anomalies hold the gold publish.

        > [!trap] Detecting on the totals only
        > A total hides a segment that went to zero. Monitor key segments (platform, country,
        > source) where the business acts on them, and cap the number of series to keep cost sane.

        > [!senior] Anomalies complement contracts
        > "Contracts and tests stop what we can name. Seasonal, segmented anomaly checks catch what we
        > did not foresee. Severe ones hold the gold publish; the rest alert the owner with lineage
        > context." That puts detection in a system, not a tool list.

        ## In one breath

        Anomaly detection catches the problems you did not predict, by comparing each segment with the
        same weekday in past weeks using a median-based score. It is only useful if alerts are rare,
        routed to an owner, and trusted.
      `,
      checks: [
        {
          question: 'Why use the median and MAD instead of the mean and standard deviation?',
          options: [
            'They are faster to compute',
            'A few past outliers barely move them, so one old outage does not hide new anomalies',
            'They work only on weekends',
            'They need no history',
          ],
          answer: 1,
          why: 'The mean and standard deviation are pulled by extreme values. Robust statistics keep the baseline stable.',
        },
        {
          question: 'Orders on a Saturday are 40 percent above Friday. Is that an anomaly?',
          options: [
            'Yes, always',
            'Not necessarily; compare with previous Saturdays, because order volume has weekly seasonality',
            'Only if it is a holiday',
            'Only for one city',
          ],
          answer: 1,
          why: 'The right baseline is the same weekday in past weeks. Comparing with yesterday flags normal weekly patterns.',
        },
      ],
    },
  ],
};

export const problems: Problem[] = [
  {
    slug: 'quality-checks-in-sql',
    title: 'Write data quality checks in SQL',
    track: 'quality',
    kind: 'sql',
    difficulty: 'easy',
    companies: ['uber', 'google', 'amazon', 'meta', 'phonepe'],
    prompt: `
      Before publishing «fct_trips(trip_id, driver_id, city_id, status, fare_usd, trip_date)» for
      a given «trip_date», write one query that returns a row for each failed check:

      - duplicate «trip_id» values
      - «driver_id» values missing from «dim_driver»
      - negative fares on completed trips
      - a row count below 70% of the same weekday one week earlier
    `,
    hints: [
      'Each check can be a SELECT that returns rows only when it fails.',
      'UNION ALL the checks together with a check name.',
      'Use a LEFT JOIN to find orphans.',
    ],
    answer: `
      ~~~bigquery
      WITH today AS (
        SELECT * FROM fct_trips WHERE trip_date = @run_date
      ),
      dupes AS (
        SELECT 'duplicate_trip_id' AS check_name, COUNT(*) AS failures
        FROM (SELECT trip_id FROM today GROUP BY trip_id HAVING COUNT(*) > 1)
      ),
      orphans AS (
        SELECT 'unknown_driver' AS check_name, COUNT(*) AS failures
        FROM today AS t
        LEFT JOIN dim_driver AS d ON d.driver_id = t.driver_id
        WHERE d.driver_id IS NULL
      ),
      negative_fares AS (
        SELECT 'negative_fare' AS check_name, COUNT(*) AS failures
        FROM today
        WHERE status = 'completed' AND fare_usd < 0
      ),
      volume AS (
        SELECT 'low_volume' AS check_name,
          IF(
            (SELECT COUNT(*) FROM today)
              < 0.7 * (SELECT COUNT(*) FROM fct_trips WHERE trip_date = DATE_SUB(@run_date, INTERVAL 7 DAY)),
            1, 0
          ) AS failures
      )
      SELECT check_name, failures
      FROM (
        SELECT * FROM dupes
        UNION ALL SELECT * FROM orphans
        UNION ALL SELECT * FROM negative_fares
        UNION ALL SELECT * FROM volume
      )
      WHERE failures > 0;
      ~~~

      An empty result means the partition may publish. The orchestrator runs this after the write
      and before the publish step, and fails the run on any row.

      This is BigQuery, with the run date as the query parameter «@run_date». The editor runs
      PostgreSQL, which has no «IF()»: write «CASE WHEN … THEN 1 ELSE 0 END», and subtract days
      with «DATE '2024-10-08' - 7».
    `,
    signals: [
      'Returns rows only on failure, so the gate is a simple "empty or not"',
      'Uses an anti-join for orphans',
      'Compares volume with the same weekday, not yesterday',
      'Places the query in a write-audit-publish flow',
    ],
    followUps: [
      'The week-ago day was a holiday. How do you make the volume check robust?',
      'Which of these checks should warn instead of block?',
    ],
  },
  {
    slug: 'schema-change-broke-pipeline',
    title: 'An upstream rename broke your pipeline',
    track: 'quality',
    kind: 'concept',
    difficulty: 'medium',
    companies: ['uber', 'amazon', 'meta', 'phonepe'],
    prompt: `
      The rider app team renamed «pickup_ts» to «pickup_time» in their trip events. Your Spark
      job did not fail: it wrote nulls for pickup time for 3 days, and the ETA accuracy dashboard
      showed garbage. How do you handle the incident, and what do you change so it cannot happen again?
    `,
    hints: [
      'Why did the job not fail?',
      'Think about the fix on both sides: producer and consumer.',
      'What would have caught it in hours instead of days?',
    ],
    answer: `
      **Now:** pause the job, mark the dashboard stale, and tell its users. Map the new field in
      the job (accept both names during a transition), backfill the 3 days from raw events, and
      verify pickup time null rates against the week before.

      **Why it was silent:** the reader treated a missing column as null. Schema-on-read with
      permissive parsing turns a breaking change into bad data instead of a failure.

      **Prevent it:**

      - A **data contract** for trip events in a schema registry with backward compatibility, so
        a rename fails the producer's build.
      - In the consumer, read with an explicit schema and **fail on missing required fields**.
      - A **not-null test** on pickup time for completed trips, blocking publish.
      - A **null-rate monitor**, which would have alerted within the first run.
      - A change process: renames ship as add-new, dual-write, migrate consumers, then remove old.
    `,
    signals: [
      'Contains and communicates before fixing',
      'Explains why the failure was silent',
      'Fixes on both the producer and consumer side',
      'Describes the safe rename sequence',
    ],
    followUps: ['The app team says contracts slow them down. How do you get them to agree?'],
  },
  {
    slug: 'exec-dashboard-drop',
    title: 'Revenue dropped 30% on the exec dashboard',
    track: 'quality',
    kind: 'concept',
    difficulty: 'medium',
    companies: ['google', 'uber', 'amazon', 'meta', 'phonepe'],
    prompt: `
      A VP messages you at 09:15: "Yesterday's revenue is down 30% on the exec dashboard. Is this
      real?" You own the pipeline behind it. Walk through what you do in the first hour.
    `,
    hints: [
      'Answer the VP quickly, even before you know.',
      'Is the data incomplete, wrong, or right?',
      'Compare against an independent source.',
    ],
    answer: `
      **First 5 minutes:** reply with what you will do and when you will update: "Looking now;
      update by 09:45." Do not guess.

      **Triage, from cheapest to most expensive check:**

      - **Freshness and completeness.** Did every upstream partition land? Is yesterday's row
        count normal for that weekday? A partial load is the most common cause.
      - **Recent changes.** Deploys to the pipeline, schema changes upstream, a new filter in
        the dashboard.
      - **Slice it.** Break revenue down by region, platform and payment method. A drop in one
        slice (all of Android, one country) points to a cause; a uniform drop points to a unit
        or join problem.
      - **Independent source.** Compare with the payments system or finance's ledger.

      **Then:** if the data is wrong, mark the dashboard, fix and backfill, and give the VP the
      corrected number and the cause. If the drop is real (an outage, a holiday, a pricing
      change), say so with the evidence and hand it to the business owner.

      **Afterwards:** add the check that would have caught it before the VP did.
    `,
    signals: [
      'Communicates quickly with a time for the next update',
      'Checks completeness before deeper debugging',
      'Slices the metric to localize the cause',
      'Uses an independent source to decide real versus broken',
      'Adds a prevention step',
    ],
    followUps: ['It turns out the drop is real. What is your role now?'],
  },
  {
    slug: 'gdpr-delete-lake',
    title: 'Design user deletion for a petabyte lake',
    track: 'quality',
    kind: 'design',
    difficulty: 'hard',
    companies: ['uber', 'google', 'amazon', 'meta', 'phonepe'],
    prompt: `
      Your lake holds 4 PB across 3,000 tables, plus Kafka topics with 7-day retention and
      nightly backups. The company receives about 50,000 deletion requests a month and must
      complete each within 30 days. Design the deletion system.
    `,
    hints: [
      'How do you know which tables hold a given user?',
      'Deleting one row at a time from petabytes is too expensive. What do you batch?',
      'What about copies you cannot rewrite, like backups?',
      'How do you prove deletion happened?',
    ],
    answer: `
      **Find the data.** Tag personal columns in the catalog (user id, phone, email, location).
      Lineage plus tags give the list of tables that hold user-linked data. New tables must be
      tagged before they can be published.

      **Reduce the surface.** Most analytic tables do not need the real identity. Store a
      pseudonymous token in facts and keep the token-to-user map in one identity table. Deleting
      the mapping row and the personal fields in a few tables covers most of the lake.

      **Batch the deletes.** Collect requests into a deletion table. Run a weekly job per tagged
      table: a merge-on-read delete joined on the deletion table, then compaction, then snapshot
      expiry and orphan file cleanup so old files are really gone. Weekly runs leave room inside 30 days.

      **Copies you cannot rewrite.**

      - Kafka: 7-day retention expires data inside the deadline.
      - Backups: encrypt personal fields with per-user keys (crypto-shredding), or keep backup
        retention under the deadline and re-apply pending deletions on any restore.
      - ML training sets and exports: list them in the catalog as consumers and include them in the fan-out.

      **Prove it.** Record each request's status per system with timestamps. Run a verification
      query after each batch and keep the evidence for audits.

      **Scale check.** 50,000 requests a month is a small join key set. The cost is rewriting
      files, which compaction amortizes when deletes are batched by partition.
    `,
    signals: [
      'Uses classification and lineage to find data, not a manual list',
      'Reduces scope with pseudonymous tokens',
      'Batches deletes and remembers snapshot expiry',
      'Handles backups and streams explicitly',
      'Builds auditable proof of deletion',
    ],
    followUps: [
      'A legal hold says some users must not be deleted. Where does that fit?',
      'How do you handle aggregates that were computed from a deleted user?',
    ],
  },
  {
    slug: 'define-data-slos',
    title: 'Define SLOs for a critical table',
    track: 'quality',
    kind: 'concept',
    difficulty: 'easy',
    companies: ['google', 'amazon', 'meta', 'phonepe'],
    prompt: `
      The daily «fct_ad_revenue» table feeds finance's revenue report (due at 08:00 UTC) and an
      hourly-refreshed advertiser dashboard. Propose SLIs and SLOs, and say what happens when
      one is breached.
    `,
    hints: ['The two consumers need different things.', 'Freshness is not the only dimension.'],
    answer: `
      | Consumer | SLI | SLO |
      |---|---|---|
      | Finance | Time the daily partition is published | Before 07:00 UTC on 99% of days per quarter |
      | Finance | Revenue difference with the billing ledger | Under 0.1% on 99.9% of days |
      | Advertiser dashboard | Age of the newest hour | Under 2 hours, 99% of the time |
      | Both | Share of rows passing blocking checks | 100%, or the partition does not publish |

      The 07:00 target leaves an hour of buffer before the 08:00 report.

      **When breached:** page the on-call when the publish SLO is at risk (for example, the job
      has not started by 05:30), not after it is missed. Notify finance automatically with an
      expected time. Track breaches against an error budget; if the quarter's budget is spent,
      freeze risky changes to this pipeline until reliability work lands.
    `,
    signals: [
      'Derives SLOs from each consumer’s need',
      'Includes correctness, not only freshness',
      'Builds in buffer before the business deadline',
      'Alerts on risk before breach and uses an error budget',
    ],
    followUps: ['How do you measure the ledger difference without slowing the pipeline?'],
  },
  {
    slug: 'quality-noisy-anomaly-alerts',
    title: 'Volume alerts page on-call 30 times a week',
    track: 'quality',
    kind: 'concept',
    difficulty: 'medium',
    companies: ['google', 'uber', 'amazon', 'meta', 'phonepe'],
    prompt: `
      A team added a volume monitor on 400 tables: alert when today's row count differs from
      yesterday's by more than 20%. It now pages on-call about 30 times a week, nearly all false.
      Last month it still missed a real problem: iOS events from one country fell to zero for
      two days. Redesign the monitoring.
    `,
    hints: [
      'What is the wrong baseline?',
      'Why did the real problem not move the total?',
      'Does every table deserve a page?',
    ],
    answer: `
      Three design faults: the baseline ignores seasonality, the threshold ignores each series'
      normal spread, and the metric is a total that hides segments.

      1. **Seasonal baseline:** compare with the same weekday over the last 6 to 8 weeks, and mark
         holidays and launches.
      2. **Robust, per-series threshold:** a robust z-score from the median and MAD, with a floor,
         instead of a flat 20%. Stable tables get tight bands; noisy ones get wide bands.
      3. **Segments where it matters:** for the event tables, monitor rows per platform and
         country (the top segments by volume, a few hundred series), not just the total.
      4. **Tiering and routing:** page only for tier-1 tables (those behind revenue, finance or
         ML features). Tier 2 posts to the owner's channel. Tier 3 goes to a weekly digest.
      5. **Group by lineage:** one upstream drop alerts once, at the source, with the affected
         downstream tables listed.
      6. **Measure it:** label every alert useful or noise for a month, tune per series, and set a
         target such as "at least 70% of pages are actionable".

      For the critical event tables, a severe anomaly blocks the gold publish, so dashboards do
      not show the bad numbers while someone investigates.
    `,
    signals: [
      'Replaces day-over-day with a weekly seasonal baseline',
      'Uses robust per-series thresholds',
      'Monitors key segments, not only totals',
      'Tiers tables and routes alerts by severity',
      'Deduplicates alerts with lineage',
      'Measures alert precision',
    ],
    followUps: ['How do you stop a planned marketing launch from paging everyone?'],
  },
  ...qualityDepthProblems,
];
