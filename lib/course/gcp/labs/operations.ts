/**
 * Hands-on labs for line 5, "Maintaining and automating data workloads".
 * One lab per station. The shape and the rules are in `../README.md`.
 */

import type { GcpLab } from '@/types/gcp';

export const LABS: readonly GcpLab[] = [
  {
    station: 'resource-optimization',
    title: 'Put guardrails on BigQuery spend',
    scenario:
      'Last month an analyst ran «SELECT *» on a 30 TB table, twice. Finance wants it never to happen again, and an email before any surprise. You estimate costs for free, cap a query, set a budget alert, and pick the cheaper storage model.',
    minutes: 35,
    apis: ['bigquery.googleapis.com', 'billingbudgets.googleapis.com'],
    creates: [
      'BigQuery dataset «lab51» with a default table expiration',
      'A billing budget «lab51-guardrail» (you may keep it)',
    ],
    cost: 'Free. Dry runs cost nothing, the capped query fails before it bills, and budgets are free.',
    freeTier: [
      'A budget does not stop spending; it sends alerts. Keep one on every project you learn in.',
      'Dry runs and failed queries that hit «maximum_bytes_billed» are not billed.',
    ],
    files: [],
    steps: [
      {
        title: 'Estimate a query for free',
        body: 'On-demand BigQuery bills the bytes a query reads, about $6.25 per TiB after the free 1 TiB each month. A dry run returns those bytes without running anything. Columns matter; a «LIMIT» does not reduce the bytes.',
        concepts: [1],
        shell: `bq query --use_legacy_sql=false --dry_run \\
  'SELECT * FROM \`bigquery-public-data.samples.wikipedia\`'
bq query --use_legacy_sql=false --dry_run \\
  'SELECT title FROM \`bigquery-public-data.samples.wikipedia\`'
bq query --use_legacy_sql=false --dry_run \\
  'SELECT * FROM \`bigquery-public-data.samples.wikipedia\` LIMIT 10'`,
        console:
          '1. Paste each query into the BigQuery editor without running it. Read **This query will process …** in the top right.',
        check:
          '«SELECT *» reads tens of GB. One column reads a fraction of that. «LIMIT 10» reads the same as «SELECT *».',
      },
      {
        title: 'Cap a query before it bills',
        body: '«maximum_bytes_billed» makes BigQuery refuse a query that would read more than the cap, before it starts. Set it in scripts, in the console query settings, or in your tools’ defaults.',
        concepts: [1],
        shell: `bq query --use_legacy_sql=false --maximum_bytes_billed=100000000 \\
  'SELECT title, COUNT(*) AS edits FROM \`bigquery-public-data.samples.wikipedia\` GROUP BY title ORDER BY edits DESC LIMIT 5'`,
        console:
          '1. In the editor, open **More** > **Query settings** > **Advanced options**, and set **Maximum bytes billed** to «100000000» (100 MB).\n2. Paste the query from the Cloud Shell tab into the editor and run it.',
        check:
          'The query fails at once with «Query exceeded limit for bytes billed: 100000000», and the job shows 0 bytes billed.',
      },
      {
        title: 'Set a quota and a budget alert',
        body: 'A custom quota is a hard daily cap per project or per user. A budget alert is the early warning. Use both: the quota stops the accident, the budget catches everything else.',
        concepts: [1, 3],
        console: `1. Open **IAM & Admin** > **Quotas & System Limits**. Filter for «Query usage per day». Select the row for your project, click **Edit**, and set it to 1 TiB (or less). Submit.
2. Open **Billing** > **Budgets & alerts** > **Create budget**. Name «lab51-guardrail», scope this project, amount $5, alerts at 50%, 90% and 100%. Finish.`,
        check:
          'The quota page shows your custom limit, and the budget list shows «lab51-guardrail» at $5. A query that would pass the daily quota now fails with a quota error, not a bill.',
      },
      {
        title: 'Make tables expire and choose the storage model',
        body: 'A default expiration on a scratch dataset deletes forgotten tables for you. The storage billing model is per dataset: **logical** bytes (uncompressed) or **physical** bytes (compressed, plus time travel). Compressible data is often far cheaper on physical; check before you switch.',
        concepts: [1, 2],
        shell: `bq mk --dataset --location=us-central1 --default_table_expiration=86400 lab51
bq query --use_legacy_sql=false \\
  'CREATE TABLE lab51.scratch AS SELECT x, REPEAT("same text ", 20) AS note FROM UNNEST(GENERATE_ARRAY(1, 200000)) AS x'
bq show --format=prettyjson lab51.scratch | jq '{expirationTime, numBytes}'`,
        sql: `SELECT table_name,
  ROUND(total_logical_bytes / POW(1024, 2), 1) AS logical_mb,
  ROUND(total_physical_bytes / POW(1024, 2), 1) AS physical_mb
FROM \`region-us-central1\`.INFORMATION_SCHEMA.TABLE_STORAGE
WHERE table_schema = 'lab51';`,
        check:
          'The table has an expiration time 24 hours ahead. Physical bytes are much smaller than logical bytes, because repeated text compresses well. The storage view can take a few minutes to show a new table.',
      },
      {
        title: 'Cut compute cost outside BigQuery',
        body: 'No resources here: answer, then check. (a) A nightly Dataflow batch job with a flexible start time. (b) A Dataproc cluster that runs Spark for 2 hours a day. (c) A critical BigQuery report that must always get capacity at month-end.',
        concepts: [2, 3],
        check:
          '(a) Dataflow FlexRS, which uses discounted capacity with a delayed start. (b) An ephemeral cluster per job (or Dataproc Serverless), with Spot secondary workers and autoscaling; keep the data in Cloud Storage, not HDFS. (c) A reservation with baseline slots, assigned to that project, so other work cannot starve it.',
      },
    ],
    cleanup: [
      {
        title: 'Delete the dataset',
        body: 'The expiration would delete the table tomorrow; delete the dataset now.',
        concepts: [],
        console: '1. Delete the dataset «lab51».',
        shell: 'bq rm -r -f -d lab51',
      },
      {
        title: 'Decide on the budget and the quota',
        body: 'Both cost nothing. Keeping the budget is good practice. If you set the quota low and it gets in your way, reset it.',
        concepts: [],
        console:
          '1. Keep «lab51-guardrail», or delete it in **Billing** > **Budgets & alerts**.\n2. In **Quotas & System Limits**, set «Query usage per day» back to unlimited if you want.',
      },
    ],
    verify: 'bq ls | grep lab51 || echo "No lab51 dataset left"',
  },
  {
    station: 'automation',
    title: 'Schedule an idempotent daily job and backfill it',
    scenario:
      'A daily summary must run every morning for yesterday, and the business wants the last five days rebuilt after a logic fix. Each run must be safe to repeat. You build it with a BigQuery scheduled query, the lightest way to schedule SQL.',
    minutes: 35,
    apis: ['bigquery.googleapis.com', 'bigquerydatatransfer.googleapis.com'],
    creates: ['BigQuery dataset «lab52»', 'Scheduled query «lab52-daily»'],
    cost: 'Free in practice: each run reads a few kilobytes.',
    freeTier: ['Scheduled queries are billed only as the queries they run.'],
    files: [],
    steps: [
      {
        title: 'Create a week of raw trips',
        body: 'The raw table has trips for 1 to 7 January. The summary table is empty.',
        concepts: [1],
        sql: `CREATE SCHEMA IF NOT EXISTS lab52 OPTIONS (location = 'us-central1');

CREATE OR REPLACE TABLE lab52.trips AS
SELECT n AS trip_id,
  ['SF', 'NYC', 'LON'][OFFSET(MOD(n, 3))] AS city,
  TIMESTAMP_ADD(TIMESTAMP '2026-01-01', INTERVAL MOD(n * 37, 7 * 24 * 60) MINUTE) AS pickup_ts,
  ROUND(5 + MOD(n * 13, 40), 2) AS fare
FROM UNNEST(GENERATE_ARRAY(1, 2100)) AS n;

CREATE OR REPLACE TABLE lab52.daily_city (day DATE, city STRING, trips INT64, revenue FLOAT64)
PARTITION BY day;`,
        check: '«lab52.trips» has 2,100 trips over 7 days. «lab52.daily_city» is empty.',
      },
      {
        title: 'Write the job so a re-run is safe',
        body: 'The script replaces one day: delete that day, then insert it. Run it twice for the same day and you get the same rows, never doubles. «@run_date» is the date the scheduler passes to each run.',
        concepts: [1],
        sql: `DECLARE d DATE DEFAULT DATE '2026-01-03';  -- the scheduled version uses @run_date

DELETE FROM lab52.daily_city WHERE day = d;
INSERT INTO lab52.daily_city
SELECT d, city, COUNT(*), SUM(fare)
FROM lab52.trips
WHERE DATE(pickup_ts) = d
GROUP BY city;

SELECT * FROM lab52.daily_city ORDER BY day, city;`,
        check: 'Run the script twice. Both times «daily_city» holds exactly 3 rows for 3 January.',
      },
      {
        title: 'Schedule it',
        body: 'A scheduled query is a BigQuery Data Transfer Service config: it runs your SQL on a schedule, with the run time as a parameter. The console may ask you to authorise the transfer service the first time.',
        concepts: [1],
        console: `1. Open a new editor tab and paste:
   «DELETE FROM lab52.daily_city WHERE day = @run_date; INSERT INTO lab52.daily_city SELECT @run_date, city, COUNT(*), SUM(fare) FROM lab52.trips WHERE DATE(pickup_ts) = @run_date GROUP BY city;»
2. Click **Schedule** > **Create new scheduled query**. Name «lab52-daily», repeats **Daily**, start now, location «us-central1». Leave the destination empty (the script writes its own table). Save.
3. Open **Scheduled queries** > «lab52-daily» and read the run history.`,
        check:
          'The scheduled query appears with state **Enabled**. Its first run is for today’s date, so it adds no rows: the raw data ends on 7 January.',
      },
      {
        title: 'Backfill five days',
        body: 'A backfill starts one run per day in a past range, each with its own «@run_date». Because the job is idempotent, you can backfill a range twice and get the same table.',
        concepts: [1],
        console:
          '1. Open «lab52-daily» > **Schedule backfill**. Choose **Run for a date range**, from 1 January 2026 to 5 January 2026. OK.\n2. Wait for five runs to succeed, then run the check query below.\n3. Schedule the same backfill again and rerun the check.',
        sql: `SELECT day, COUNT(*) AS cities, SUM(trips) AS trips
FROM lab52.daily_city
GROUP BY day
ORDER BY day;`,
        check:
          'Five days, 1 to 5 January, each with 3 cities, and the same totals after the second backfill. That is the property an Airflow DAG with «catchup» needs too: each task rebuilds one partition and nothing else.',
      },
    ],
    cleanup: [
      {
        title: 'Delete the scheduled query',
        body: 'An enabled schedule runs every day until you delete it.',
        concepts: [],
        console: '1. Open **Scheduled queries**, select «lab52-daily», and click **Delete**.',
        shell: `bq ls --transfer_config --transfer_location=us-central1
# Copy the name (projects/…/transferConfigs/…) of lab52-daily, then:
# bq rm -f --transfer_config TRANSFER_CONFIG_NAME`,
      },
      {
        title: 'Delete the dataset',
        body: 'This deletes the raw and the summary tables.',
        concepts: [],
        console: '1. Delete the dataset «lab52».',
        shell: 'bq rm -r -f -d lab52',
      },
    ],
    verify: `bq ls | grep lab52 || echo "No lab52 dataset left"
bq ls --transfer_config --transfer_location=us-central1 | grep lab52 || echo "No lab52 scheduled query left"`,
  },
  {
    station: 'workload-organization',
    title: 'Prioritise, label and charge back BigQuery work',
    scenario:
      'Finance’s month-end report keeps waiting behind ad hoc queries, and no one knows which team spends what. You run work at interactive and batch priority, label every job by team, build a chargeback query, and optionally isolate a workload on its own slots.',
    minutes: 35,
    apis: ['bigquery.googleapis.com', 'bigqueryreservation.googleapis.com'],
    creates: [
      'BigQuery dataset «lab53»',
      'Optional: reservation «lab53_res» and its assignment to your project',
    ],
    cost: 'Free, unless you do the optional reservation: Standard edition autoscaling bills about $0.04 per slot-hour in steps of 50 slots and at least one minute, so a test costs a few cents. Delete it in the cleanup, or every query in the project keeps using it.',
    freeTier: [
      'Labels and batch priority cost nothing.',
      'A reservation with a baseline of 0 slots bills only while autoscaled slots are in use.',
    ],
    files: [],
    steps: [
      {
        title: 'Make a table to query',
        body: 'Half a million rows is enough to see the job statistics.',
        concepts: [1],
        sql: `CREATE SCHEMA IF NOT EXISTS lab53 OPTIONS (location = 'us-central1');

CREATE OR REPLACE TABLE lab53.events AS
SELECT n AS event_id, MOD(n, 97) AS customer_id, RAND() * 100 AS amount
FROM UNNEST(GENERATE_ARRAY(1, 500000)) AS n;`,
        check: '«lab53.events» has 500,000 rows.',
      },
      {
        title: 'Run labelled jobs at two priorities',
        body: 'Interactive queries start at once. Batch queries queue until slots are free, and start within 24 hours at most; they suit work with no one waiting. Labels on each job name the team, so cost can be grouped.',
        concepts: [1],
        shell: `bq query --use_legacy_sql=false --label=team:finance \\
  'SELECT customer_id, SUM(amount) AS total FROM lab53.events GROUP BY customer_id ORDER BY total DESC LIMIT 3'
bq query --use_legacy_sql=false --batch --label=team:growth \\
  'SELECT COUNT(DISTINCT customer_id) AS customers FROM lab53.events'
bq query --use_legacy_sql=false --label=team:growth \\
  'SELECT APPROX_QUANTILES(amount, 4) AS quartiles FROM lab53.events'`,
        console:
          '1. In the editor, open **More** > **Query settings**. Set **Job priority** to **Batch** and add the label «team: growth». Run a query.\n2. Open **Job history** and look at the priority and labels of each job.',
        check:
          'All three jobs succeed. The batch job may show **Pending** for a moment before it runs.',
      },
      {
        title: 'Build a chargeback report',
        body: 'The jobs view records bytes and slot time for every job, with its labels. Group by the «team» label for a cost split per team.',
        concepts: [1],
        sql: `SELECT
  (SELECT value FROM UNNEST(labels) WHERE key = 'team') AS team,
  priority,
  COUNT(*) AS jobs,
  SUM(total_bytes_billed) AS bytes_billed,
  SUM(total_slot_ms) AS slot_ms
FROM \`region-us-central1\`.INFORMATION_SCHEMA.JOBS_BY_PROJECT
WHERE creation_time > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 HOUR)
  AND job_type = 'QUERY'
GROUP BY team, priority
ORDER BY team;`,
        check:
          'Rows for «finance» (INTERACTIVE, 1 job) and «growth» (one BATCH and one INTERACTIVE job). Jobs with no label show a NULL team: that is your untracked spend.',
      },
      {
        title: 'Optional: give one project its own slots',
        body: 'A reservation is a pool of slots; an assignment sends a project’s queries to it. With a baseline of 0 and autoscaling to 50, you pay only while queries run. Be quick: until you delete the assignment, every query in the project runs on this reservation.',
        concepts: [1],
        console:
          '1. Open **BigQuery** > **Capacity management** > **Create reservation**. Name «lab53_res», location «us-central1», edition **Standard**, max reservation size 50, baseline 0. Save.\n2. On the reservation, click **Create assignment**: your project, job type **QUERY**. Create.\n3. Run any query on «lab53.events», then the check query below.',
        shell: `bq mk --reservation --location=us-central1 --edition=STANDARD \\
  --slots=0 --autoscale_max_slots=50 lab53_res
bq mk --reservation_assignment --reservation_id=$PROJECT_ID:us-central1.lab53_res \\
  --job_type=QUERY --assignee_type=PROJECT --assignee_id=$PROJECT_ID
sleep 60
bq query --use_legacy_sql=false 'SELECT COUNT(*) FROM lab53.events'`,
        sql: `SELECT job_id, reservation_id, total_slot_ms
FROM \`region-us-central1\`.INFORMATION_SCHEMA.JOBS_BY_PROJECT
WHERE creation_time > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 10 MINUTE)
ORDER BY creation_time DESC
LIMIT 3;`,
        check:
          'The newest job shows «reservation_id» ending in «lab53_res». Older jobs show none: they used on-demand capacity.',
      },
    ],
    cleanup: [
      {
        title: 'Delete the assignment, then the reservation',
        body: 'Skip this if you did not do the optional step. An assignment must go before its reservation.',
        concepts: [],
        console:
          '1. Open **Capacity management** > «lab53_res» > **Assignments**, and delete the assignment.\n2. Delete the reservation «lab53_res».',
        shell: `bq ls --reservation_assignment --location=us-central1
# Copy the assignment name (…/assignments/ID) for lab53_res, then:
# bq rm --reservation_assignment $PROJECT_ID:us-central1.lab53_res.ASSIGNMENT_ID
bq rm --reservation --location=us-central1 lab53_res`,
      },
      {
        title: 'Delete the dataset',
        body: 'This deletes the events table.',
        concepts: [],
        console: '1. Delete the dataset «lab53».',
        shell: 'bq rm -r -f -d lab53',
      },
    ],
    verify: `bq ls | grep lab53 || echo "No lab53 dataset left"
bq ls --reservation --location=us-central1 | grep lab53 || echo "No lab53 reservation left"`,
  },
  {
    station: 'monitoring',
    title: 'Get paged when a pipeline query fails',
    scenario:
      'A nightly query failed for three days before anyone noticed. You find failed jobs in the audit logs, turn them into a metric, alert on it by email, and read the quota and billing pages that explain the most common failures.',
    minutes: 40,
    apis: ['bigquery.googleapis.com', 'logging.googleapis.com', 'monitoring.googleapis.com'],
    creates: [
      'BigQuery dataset «lab54»',
      'Log-based metric «lab54-failed-queries»',
      'An email notification channel and an alerting policy «lab54-failed-queries»',
    ],
    cost: 'Free in practice. Logs-based metrics and BigQuery audit logs stay inside the free allotments. Alerting policies can carry a small monthly charge per condition, so delete the policy in the cleanup.',
    freeTier: [
      'Cloud Logging gives 50 GiB of log ingestion per project each month.',
      'BigQuery audit logs for jobs are on by default.',
    ],
    files: [],
    steps: [
      {
        title: 'Make one job succeed and one fail',
        body: 'You need a failure to look for. The second query names a table that does not exist.',
        concepts: [2],
        shell: `bq mk --dataset --location=us-central1 lab54
bq query --use_legacy_sql=false 'CREATE TABLE lab54.ok AS SELECT 1 AS x'
bq query --use_legacy_sql=false 'SELECT * FROM lab54.does_not_exist'`,
        check: 'The second command fails with «Not found: Table …lab54.does_not_exist».',
      },
      {
        title: 'Find the failure in the jobs view and the logs',
        body: 'Two places hold job history. «INFORMATION_SCHEMA.JOBS» is easiest for SQL. Cloud Logging holds the audit entries that metrics and alerts are built from.',
        concepts: [1, 2],
        sql: `SELECT creation_time, job_id, error_result.reason, error_result.message
FROM \`region-us-central1\`.INFORMATION_SCHEMA.JOBS_BY_USER
WHERE error_result IS NOT NULL
  AND creation_time > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 HOUR)
ORDER BY creation_time DESC;`,
        console:
          '1. Open **Logging** > **Logs Explorer**. Paste the query «resource.type="bigquery_project" severity=ERROR» and run it for the last hour.\n2. Open the entry and find the error message and the principal under «protoPayload».',
        shell: `gcloud logging read 'resource.type="bigquery_project" AND severity=ERROR' \\
  --freshness=1h --limit=3 --format="value(timestamp, protoPayload.status.message)"`,
        check:
          'The jobs view shows reason «notFound». Logs Explorer shows an ERROR entry with the same message. If your entry has a different severity or resource type, build the filter from the fields of the entry you see: that is how real filters are written.',
      },
      {
        title: 'Turn failures into a metric',
        body: 'A log-based counter metric counts matching entries over time. A chart or an alert can then use it, like any Cloud Monitoring metric.',
        concepts: [1],
        console:
          '1. In Logs Explorer, with the filter above, click **Actions** > **Create metric**.\n2. Type **Counter**, name «lab54-failed-queries». Create.',
        shell: `gcloud logging metrics create lab54-failed-queries \\
  --description="Failed BigQuery jobs" \\
  --log-filter='resource.type="bigquery_project" AND severity=ERROR'`,
        check: '**Logging** > **Log-based metrics** lists «lab54-failed-queries».',
      },
      {
        title: 'Alert on it by email',
        body: 'An alert needs a condition and a notification channel. Alert on symptoms the business cares about (a failed load, stale data), not on every CPU spike.',
        concepts: [1],
        console: `1. Open **Monitoring** > **Alerting** > **Edit notification channels**. Add an **Email** channel with your address.
2. Back in **Alerting**, click **Create policy**. Metric: **Logging** > «logging/user/lab54-failed-queries». Rolling window 5 minutes, function **sum**.
3. Condition: threshold, **above 0**. Notification channel: your email. Name «lab54-failed-queries». Create.
4. In Cloud Shell, run the failing query again: «bq query --use_legacy_sql=false 'SELECT * FROM lab54.does_not_exist'».`,
        check:
          'Within a few minutes an incident opens in **Alerting** and an email arrives. A new metric can take a few minutes to receive its first points, so give it up to 10 minutes.',
      },
      {
        title: 'Read the pages behind most failures',
        body: 'Many pipeline failures are not bugs: a quota was reached, or a billing account stopped. Know where to look.',
        concepts: [2],
        console:
          '1. Open **IAM & Admin** > **Quotas & System Limits** and filter for «BigQuery API». Find **Query usage per day** and **Concurrent queries**.\n2. Open **Billing** > **Reports**, group by **Service**, and find BigQuery.\n3. Open **Monitoring** > **Metrics explorer**, and chart «BigQuery» > «Query count» for the last hour.',
        check:
          'You can name, for a failed job, the three places to check: the job error (jobs view or logs), quotas, and billing.',
      },
    ],
    cleanup: [
      {
        title: 'Delete the alerting policy and the channel',
        body: 'Delete the policy first; a channel used by a policy cannot be deleted.',
        concepts: [],
        console:
          '1. Open **Monitoring** > **Alerting**, select «lab54-failed-queries» and delete it.\n2. Open **Edit notification channels** and delete the email channel you added.',
      },
      {
        title: 'Delete the metric and the dataset',
        body: 'The metric stops counting at once.',
        concepts: [],
        console:
          '1. Open **Logging** > **Log-based metrics**, and delete «lab54-failed-queries».\n2. Delete the dataset «lab54».',
        shell: `gcloud logging metrics delete lab54-failed-queries --quiet
bq rm -r -f -d lab54`,
      },
    ],
    verify: `bq ls | grep lab54 || echo "No lab54 dataset left"
gcloud logging metrics list --format="value(name)" | grep lab54 || echo "No lab54 metric left"
echo "Also check Monitoring > Alerting: no lab54 policy listed"`,
  },
  {
    station: 'failure-mitigation',
    title: 'Survive poison messages, bad deploys and corrupted tables',
    scenario:
      'Three things go wrong in one week: a malformed message blocks a subscriber, a buggy consumer acknowledges a batch it never processed, and an UPDATE corrupts a production table. You set up the controls that make each one recoverable, then use them.',
    minutes: 45,
    apis: ['pubsub.googleapis.com', 'bigquery.googleapis.com', 'storage.googleapis.com'],
    vars: { BUCKET: '$PROJECT_ID-lab55' },
    creates: [
      'Pub/Sub topics «lab55-orders» and «lab55-dead», subscriptions «lab55-work», «lab55-dead-sub» and «lab55-replay», snapshot «lab55-snap»',
      'BigQuery dataset «lab55» with a table and a snapshot',
      'Dual-region Cloud Storage bucket «PROJECT_ID-lab55»',
    ],
    cost: 'Free in practice. Pub/Sub snapshots are billed as retained message storage, here a few bytes. A dual-region bucket costs more per GB than a regional one, but this one holds a few bytes.',
    freeTier: [
      'Pub/Sub gives 10 GiB of messages each month.',
      'Turbo replication costs extra per GB; this lab does not turn it on.',
    ],
    files: [],
    steps: [
      {
        title: 'Route poison messages to a dead-letter topic',
        body: 'A message that always fails is redelivered forever and holds up its subscriber. A dead-letter topic takes it after a set number of attempts. The Pub/Sub service agent needs permission to publish to the dead-letter topic and to acknowledge on the source subscription.',
        concepts: [1],
        shell: `export PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
export PUBSUB_SA=service-$PROJECT_NUMBER@gcp-sa-pubsub.iam.gserviceaccount.com
gcloud pubsub topics create lab55-orders
gcloud pubsub topics create lab55-dead
gcloud pubsub subscriptions create lab55-dead-sub --topic=lab55-dead
gcloud pubsub subscriptions create lab55-work --topic=lab55-orders --ack-deadline=10 \\
  --dead-letter-topic=lab55-dead --max-delivery-attempts=5
gcloud pubsub topics add-iam-policy-binding lab55-dead \\
  --member=serviceAccount:$PUBSUB_SA --role=roles/pubsub.publisher
gcloud pubsub subscriptions add-iam-policy-binding lab55-work \\
  --member=serviceAccount:$PUBSUB_SA --role=roles/pubsub.subscriber`,
        console:
          '1. Create the topics «lab55-orders» and «lab55-dead», and a pull subscription «lab55-dead-sub» on «lab55-dead».\n2. Create the pull subscription «lab55-work» on «lab55-orders», ack deadline 10 seconds. Turn on **Dead lettering**, topic «lab55-dead», maximum delivery attempts 5. Grant the permissions the console offers.',
        check: '«lab55-work» shows dead lettering to «lab55-dead» after 5 attempts.',
      },
      {
        title: 'Fail a message five times',
        body: 'Pull without acknowledging, as a crashing consumer would. Each pull is one delivery attempt; after the ack deadline the message comes back. After the fifth attempt it moves to the dead-letter topic.',
        concepts: [1],
        shell: `gcloud pubsub topics publish lab55-orders --message='{"order_id": "X-1", "amount": "oops"}'
for i in 1 2 3 4 5 6; do
  gcloud pubsub subscriptions pull lab55-work --limit=1
  sleep 15
done
gcloud pubsub subscriptions pull lab55-dead-sub --auto-ack --limit=1`,
        check:
          'The work pulls show the delivery attempt rising from 1 to 5, then nothing. The dead-letter pull returns the poison message; if it is empty, wait 30 seconds and pull again. A real consumer would also acknowledge each message only after it has processed it.',
      },
      {
        title: 'Replay messages a buggy consumer acknowledged',
        body: 'A snapshot keeps the unacknowledged backlog of a subscription. Seeking to it marks those messages unacknowledged again, so a fixed consumer can process them a second time. Your consumer must therefore be idempotent.',
        concepts: [1, 3],
        shell: `gcloud pubsub subscriptions create lab55-replay --topic=lab55-orders
for n in 1 2 3; do gcloud pubsub topics publish lab55-orders --message="order-$n"; done
gcloud pubsub snapshots create lab55-snap --subscription=lab55-replay
gcloud pubsub subscriptions pull lab55-replay --auto-ack --limit=10
gcloud pubsub subscriptions pull lab55-replay --auto-ack --limit=10
gcloud pubsub subscriptions seek lab55-replay --snapshot=lab55-snap
gcloud pubsub subscriptions pull lab55-replay --auto-ack --limit=10`,
        check:
          'The first pull takes the three orders (it may take two pulls). The next pull is empty. After the seek, the three orders come back.',
      },
      {
        title: 'Undo a corrupting UPDATE with a snapshot',
        body: 'Before a risky change, take a table snapshot: it costs only the bytes that later change. If the change goes wrong, restore with a clone. Time travel would also work for 7 days; a snapshot lasts as long as you set.',
        concepts: [3],
        sql: `CREATE SCHEMA IF NOT EXISTS lab55 OPTIONS (location = 'us-central1');

CREATE OR REPLACE TABLE lab55.orders AS
SELECT n AS order_id, ROUND(10 + n * 1.5, 2) AS amount
FROM UNNEST(GENERATE_ARRAY(1, 100)) AS n;

CREATE SNAPSHOT TABLE lab55.orders_before_fix CLONE lab55.orders;

UPDATE lab55.orders SET amount = 0 WHERE TRUE;  -- the bad deploy

CREATE OR REPLACE TABLE lab55.orders CLONE lab55.orders_before_fix;

SELECT COUNT(*) AS orders, SUM(amount) AS total FROM lab55.orders;`,
        check: '100 orders with a total of 8,575, as before the bad UPDATE.',
      },
      {
        title: 'Store data in two regions',
        body: 'A dual-region bucket keeps every object in two regions, so a regional outage does not stop reads or writes. For a zone outage, regional services such as Dataflow and Dataproc restart work in another zone; for a region outage, you need the data in a second region first.',
        concepts: [2],
        console:
          '1. Create a bucket «PROJECT_ID-lab55». Location type **Dual-region**: continent **North America**, regions «us-central1» and «us-east1». Leave turbo replication off. Create.\n2. Upload a small file and open the bucket’s **Configuration**.',
        shell: `gcloud storage buckets create gs://$BUCKET --location=US --placement=us-central1,us-east1 \\
  --uniform-bucket-level-access
echo "replicated" > dr.txt
gcloud storage cp dr.txt gs://$BUCKET/
gcloud storage buckets describe gs://$BUCKET --format="json(location, location_type, data_locations, rpo)"`,
        check:
          'The bucket shows location type «dual-region», data locations «US-CENTRAL1» and «US-EAST1», and the default RPO. Turbo replication would target 15 minutes for every new object.',
      },
    ],
    cleanup: [
      {
        title: 'Delete the snapshot, subscriptions and topics',
        body: 'Delete the snapshot and subscriptions before their topics.',
        concepts: [],
        console:
          '1. In **Pub/Sub** > **Snapshots**, delete «lab55-snap».\n2. Delete the subscriptions «lab55-work», «lab55-dead-sub» and «lab55-replay».\n3. Delete the topics «lab55-orders» and «lab55-dead».',
        shell: `gcloud pubsub snapshots delete lab55-snap --quiet
gcloud pubsub subscriptions delete lab55-work lab55-dead-sub lab55-replay --quiet
gcloud pubsub topics delete lab55-orders lab55-dead --quiet`,
      },
      {
        title: 'Delete the dataset and the bucket',
        body: 'This deletes the table and its snapshot, and both regions’ copies of the file.',
        concepts: [],
        console: '1. Delete the dataset «lab55».\n2. Delete the bucket «PROJECT_ID-lab55».',
        shell: `bq rm -r -f -d lab55
gcloud storage rm --recursive gs://$BUCKET
rm -f dr.txt`,
      },
    ],
    verify: `gcloud pubsub topics list --format="value(name)" | grep lab55 || echo "No lab55 topic left"
gcloud pubsub subscriptions list --format="value(name)" | grep lab55 || echo "No lab55 subscription left"
gcloud pubsub snapshots list --format="value(name)" | grep lab55 || echo "No lab55 snapshot left"
bq ls | grep lab55 || echo "No lab55 dataset left"
gcloud storage ls | grep lab55 || echo "No lab55 bucket left"`,
  },
];
