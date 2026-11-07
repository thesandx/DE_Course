/**
 * Hands-on labs for line 1, "Designing data processing systems".
 * One lab per station. The shape and the rules are in `../README.md`.
 */

import type { GcpLab } from '@/types/gcp';

const EMPLOYEES = `employee_id,full_name,email,phone,country,department,salary
1001,Asha Rao,asha.rao@example.com,+44 20 7946 0101,GB,Finance,82000
1002,Lukas Becker,lukas.becker@example.com,+49 30 5550 1002,DE,Engineering,91000
1003,Chloé Martin,chloe.martin@example.com,+33 1 5550 1003,FR,Sales,64000
1004,Priya Nair,priya.nair@example.com,+91 80 5550 1004,IN,Engineering,58000
1005,Sam Carter,sam.carter@example.com,+1 415 555 0105,US,Sales,77000
1006,Mia Schmidt,mia.schmidt@example.com,+49 89 5550 1006,DE,Finance,69000
1007,Noah Dubois,noah.dubois@example.com,+33 4 5550 1007,FR,Engineering,88000
1008,Ravi Kumar,ravi.kumar@example.com,+91 22 5550 1008,IN,Sales,51000
1009,Olivia Brown,olivia.brown@example.com,+1 212 555 0109,US,Finance,95000
1010,Emma Wilson,emma.wilson@example.com,+44 161 496 0110,GB,Engineering,86000
1011,Felix Wagner,felix.wagner@example.com,+49 40 5550 1011,DE,Sales,62000
1012,Léa Bernard,lea.bernard@example.com,+33 5 5550 1012,FR,Finance,71000`;

const ORDERS = `order_id,customer_id,order_ts,amount,status
A-1001,C-01,2026-03-01 09:12:00,42.50,paid
A-1002,C-02,2026-03-01 09:40:00,18.00,paid
A-1003,C-03,2026-03-01 10:05:00,99.90,paid
A-1003,C-03,2026-03-01 10:05:00,99.90,paid
A-1004,,2026-03-01 11:20:00,12.00,paid
A-1005,C-05,2026-03-01 11:45:00,-5.00,paid
A-1006,C-06,not-a-date,30.00,paid
A-1007,C-07,2026-03-01 13:02:00,abc,paid
A-1008,C-08,2026-03-01 13:30:00,64.10,paid
A-1009,C-09,2026-03-01 14:15:00,21.75,cancelled
A-1010,C-10,2026-03-01 15:00:00,55.00,paid
A-1010,C-10,2026-03-01 15:05:00,57.00,paid`;

const TRIPS = `trip_id,city,pickup_date,distance_km,fare
1,SF,2026-02-01,3.2,14.50
2,SF,2026-02-01,8.9,31.20
3,SF,2026-02-02,1.4,8.10
4,SF,2026-02-02,12.6,44.00
5,NYC,2026-02-01,2.1,12.75
6,NYC,2026-02-01,5.5,22.40
7,NYC,2026-02-02,9.8,38.90
8,NYC,2026-02-02,0.9,7.20
9,NYC,2026-02-03,15.2,52.10
10,LON,2026-02-01,4.4,18.60
11,LON,2026-02-02,6.7,25.30
12,LON,2026-02-02,2.2,11.00
13,LON,2026-02-03,11.1,40.80
14,SF,2026-02-03,7.3,27.90
15,NYC,2026-02-03,3.6,15.10
16,LON,2026-02-03,1.8,9.40`;

export const LABS: readonly GcpLab[] = [
  {
    station: 'security-compliance',
    title: 'Lock down a table of personal data',
    scenario:
      'HR has loaded a table of employees with emails, phone numbers and salaries. Analysts need a directory, the EU team may see only EU rows, and salaries must be unreadable for anyone who leaves. You build every control yourself and prove that each one works.',
    minutes: 50,
    apis: ['bigquery.googleapis.com', 'dlp.googleapis.com', 'iam.googleapis.com'],
    vars: { SA: 'lab11-analyst@$PROJECT_ID.iam.gserviceaccount.com' },
    creates: [
      'BigQuery datasets «lab11_raw», «lab11_share» and «lab11_eu»',
      'Service account «lab11-analyst» and its role on the project',
      'A row access policy on «lab11_raw.employees» (dropped in the lab)',
    ],
    cost: 'Free in practice. The tables hold a few kilobytes, every query reads under 1 MB, and the Sensitive Data Protection calls inspect a few hundred bytes, which costs a fraction of a cent.',
    freeTier: [
      'BigQuery gives 1 TiB of queries and 10 GiB of storage each month at no cost.',
      'Service accounts and IAM roles are free.',
    ],
    files: [
      {
        name: 'employees.csv',
        about: '12 made-up employees with emails, phones, countries and salaries.',
        content: EMPLOYEES,
      },
    ],
    steps: [
      {
        title: 'Load the raw table into its own dataset',
        body: 'Put raw personal data in a dataset of its own, and put what you share in another. Access in BigQuery is easiest to reason about at the dataset level, so the dataset is your first security boundary. Labels record the zone and the environment for later audits.',
        concepts: [6],
        console: `1. Open **BigQuery** > **Studio**. In the Explorer, open the menu of your project and click **Create dataset**.
2. Dataset ID «lab11_raw», location type **Region**, region «us-central1». Click **Create dataset**.
3. Create a second dataset «lab11_share» in the same region.
4. Open «lab11_raw», click **Create table**, source **Upload**, choose «employees.csv», table name «employees», tick **Auto detect** for the schema, and click **Create table**.`,
        shell: `bq mk --dataset --location=us-central1 --label=env:lab --label=zone:raw \\
  --description="Raw HR data. Restricted." lab11_raw
bq mk --dataset --location=us-central1 --label=env:lab --label=zone:share lab11_share
bq load --source_format=CSV --skip_leading_rows=1 --autodetect \\
  lab11_raw.employees employees.csv
bq head -n 3 lab11_raw.employees`,
        check:
          'The table shows 12 rows and 7 columns. «bq show lab11_raw» lists the labels «env:lab» and «zone:raw».',
      },
      {
        title: 'Give an analyst identity the least privilege',
        body: 'An analyst needs two things: permission to run jobs in the project, and permission to read the shared dataset. Nothing else. You create a service account to play the analyst, and allow yourself to act as it, so you can test what it can and cannot read.',
        concepts: [1],
        console: `1. Open **IAM & Admin** > **Service accounts** > **Create service account**. Name it «lab11-analyst» and click **Done**. Grant no project roles on this page.
2. Open **IAM & Admin** > **IAM** > **Grant access**. Principal: the new service account. Role: **BigQuery Job User**. Save.
3. In BigQuery, open «lab11_share» > **Sharing** > **Permissions** > **Add principal**. Principal: the service account. Role: **BigQuery Data Viewer**. Save.
4. Open the service account > **Principals with access** > **Grant access**. Add your own account with the role **Service Account Token Creator**.`,
        shell: `gcloud iam service-accounts create lab11-analyst --display-name="Lab 1.1 analyst"
gcloud projects add-iam-policy-binding $PROJECT_ID \\
  --member=serviceAccount:$SA --role=roles/bigquery.jobUser --condition=None
bq query --use_legacy_sql=false \\
  "GRANT \\\`roles/bigquery.dataViewer\\\` ON SCHEMA lab11_share TO 'serviceAccount:$SA'"
gcloud iam service-accounts add-iam-policy-binding $SA \\
  --member=user:$(gcloud config get-value account) \\
  --role=roles/iam.serviceAccountTokenCreator`,
        check:
          'The IAM page shows «lab11-analyst» with **BigQuery Job User** only. The dataset «lab11_share» lists it as a Data Viewer. «lab11_raw» does not.',
      },
      {
        title: 'Prove the analyst cannot read the raw table',
        body: 'Now act as the analyst. The function below asks BigQuery a question with a short-lived token for the service account. No key file is made: you act as the account through your Token Creator role. IAM changes can take a minute or two to apply, so retry if the first call says the token is not allowed.',
        concepts: [1],
        shell: `asbq() {
  curl -s -X POST \\
    -H "Authorization: Bearer $(gcloud auth print-access-token --impersonate-service-account=$SA)" \\
    -H "Content-Type: application/json" \\
    "https://bigquery.googleapis.com/bigquery/v2/projects/$PROJECT_ID/queries" \\
    -d "$(jq -n --arg q "$1" '{query: $q, useLegacySql: false, location: "us-central1"}')" \\
    | jq '.rows // .error.message'
}
asbq "SELECT COUNT(*) AS n FROM lab11_raw.employees"`,
        check:
          'The answer is an **Access Denied** message for «lab11_raw.employees». The analyst can run jobs, but cannot read the raw data.',
      },
      {
        title: 'Share a directory through an authorized view',
        body: 'An authorized view lets readers of «lab11_share» see the result of a query over «lab11_raw», without any access to «lab11_raw» itself. The view leaves out phone and salary, and masks the local part of each email.',
        concepts: [2],
        sql: `CREATE OR REPLACE VIEW lab11_share.employee_directory AS
SELECT
  employee_id,
  full_name,
  REGEXP_REPLACE(email, r'^[^@]+', '***') AS email_masked,
  country,
  department
FROM lab11_raw.employees;`,
        console: `1. Run the SQL below in the BigQuery editor first.
2. Open the dataset «lab11_raw» > **Sharing** > **Authorize views**.
3. Choose the view «lab11_share.employee_directory» and click **Add authorization**, then **Close**.
4. Back in Cloud Shell, ask as the analyst again (next tab).`,
        shell: `asbq "SELECT full_name, email_masked, country FROM lab11_share.employee_directory LIMIT 3"
asbq "SELECT COUNT(*) AS n FROM lab11_raw.employees"`,
        check:
          'The first call returns three rows with emails such as «***@example.com». The second call is still denied. That is the whole point of an authorized view.',
      },
      {
        title: 'Restrict rows with a row access policy',
        body: 'A row access policy filters one table for each group, with no copies of the data. Once a table has any policy, a reader who matches no policy sees no rows at all, even through the authorized view. Replace the email below with the result of «SELECT SESSION_USER()».',
        concepts: [2],
        sql: `SELECT SESSION_USER() AS me;

CREATE OR REPLACE ROW ACCESS POLICY lab11_eu_only
ON lab11_raw.employees
GRANT TO ("user:you@example.com")
FILTER USING (country IN ("DE", "FR"));

SELECT country, COUNT(*) AS people
FROM lab11_raw.employees
GROUP BY country;`,
        shell: `asbq "SELECT COUNT(*) AS n FROM lab11_share.employee_directory"`,
        check:
          'Your query shows only DE and FR, 6 people in all. The analyst now gets 0 rows from the view, because no policy grants the analyst any rows. Run «DROP ALL ROW ACCESS POLICIES ON lab11_raw.employees;» to remove the policy before the next step.',
      },
      {
        title: 'Encrypt salaries and crypto-delete one person',
        body: 'AEAD functions encrypt a value with a keyset you store per person. Delete that person’s keyset and their salary can never be decrypted again, even where copies of the encrypted value remain. This is crypto-deletion, the usual answer to "erase one user from years of backups".',
        concepts: [3],
        sql: `CREATE OR REPLACE TABLE lab11_raw.keysets AS
SELECT employee_id, KEYS.NEW_KEYSET('AEAD_AES_GCM_256') AS keyset
FROM lab11_raw.employees;

CREATE OR REPLACE TABLE lab11_raw.salary_encrypted AS
SELECT e.employee_id,
  AEAD.ENCRYPT(k.keyset, CAST(e.salary AS STRING), CAST(e.employee_id AS STRING)) AS salary_ct
FROM lab11_raw.employees AS e
JOIN lab11_raw.keysets AS k USING (employee_id);

DELETE FROM lab11_raw.keysets WHERE employee_id = 1001;

SELECT s.employee_id,
  AEAD.DECRYPT_STRING(k.keyset, s.salary_ct, CAST(s.employee_id AS STRING)) AS salary
FROM lab11_raw.salary_encrypted AS s
LEFT JOIN lab11_raw.keysets AS k USING (employee_id)
ORDER BY s.employee_id;`,
        check:
          'Employee 1001 shows a NULL salary and every other employee shows a number. A senior answer adds one caveat: time travel keeps the deleted keyset for up to 7 days, so the erasure is final only after the time travel window.',
      },
      {
        title: 'Find and mask personal data with Sensitive Data Protection',
        body: 'Sensitive Data Protection (Cloud DLP) finds info types such as emails and phone numbers in free text, and can mask them before the text lands anywhere. You call the API directly so you see the exact request a pipeline would send.',
        concepts: [4],
        shell: `TEXT="Call Asha on +44 20 7946 0101 or write to asha.rao@example.com"
curl -s -X POST \\
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \\
  -H "x-goog-user-project: $PROJECT_ID" -H "Content-Type: application/json" \\
  "https://dlp.googleapis.com/v2/projects/$PROJECT_ID/locations/global/content:inspect" \\
  -d "$(jq -n --arg t "$TEXT" '{item: {value: $t}, inspectConfig: {infoTypes: [{name: "EMAIL_ADDRESS"}, {name: "PHONE_NUMBER"}], includeQuote: true}}')" \\
  | jq '.result.findings[] | {type: .infoType.name, quote, likelihood}'

curl -s -X POST \\
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \\
  -H "x-goog-user-project: $PROJECT_ID" -H "Content-Type: application/json" \\
  "https://dlp.googleapis.com/v2/projects/$PROJECT_ID/locations/global/content:deidentify" \\
  -d "$(jq -n --arg t "$TEXT" '{item: {value: $t}, inspectConfig: {infoTypes: [{name: "EMAIL_ADDRESS"}, {name: "PHONE_NUMBER"}]}, deidentifyConfig: {infoTypeTransformations: {transformations: [{primitiveTransformation: {replaceWithInfoTypeConfig: {}}}]}}}')" \\
  | jq -r '.item.value'`,
        check:
          'The first call lists one EMAIL_ADDRESS and one PHONE_NUMBER finding with their quotes. The second prints «Call Asha on [PHONE_NUMBER] or write to [EMAIL_ADDRESS]».',
      },
      {
        title: 'See data location as a hard boundary',
        body: 'A dataset’s location is fixed when you create it, and BigQuery will not join tables across locations. That is how a residency rule ("EU data stays in the EU") becomes a fact of the platform. In an organisation you would add the resource-location org policy and a VPC Service Controls perimeter; both need an organisation, so this lab stops at location.',
        concepts: [5, 6],
        shell: `bq mk --dataset --location=EU --label=env:lab lab11_eu
bq query --use_legacy_sql=false 'CREATE TABLE lab11_eu.countries AS SELECT "DE" AS country, "Germany" AS name'
bq query --use_legacy_sql=false 'SELECT e.full_name, c.name FROM lab11_raw.employees AS e JOIN lab11_eu.countries AS c USING (country)'`,
        check:
          'The join fails with an error that the dataset was not found in location us-central1. Then answer for yourself: where would dev and prod go? (Separate projects per environment, datasets per zone inside each, and a perimeter around prod.)',
      },
    ],
    cleanup: [
      {
        title: 'Delete the three datasets',
        body: 'Deleting a dataset with «-r» deletes every table, view and policy inside it.',
        concepts: [],
        console:
          '1. In BigQuery, open the menu of «lab11_raw» > **Delete**, type «delete» and confirm.\n2. Do the same for «lab11_share» and «lab11_eu».',
        shell: `bq rm -r -f -d lab11_raw
bq rm -r -f -d lab11_share
bq rm -r -f -d lab11_eu`,
      },
      {
        title: 'Delete the service account and its project role',
        body: 'Remove the project role first, so no binding points at a deleted account.',
        concepts: [],
        console:
          '1. **IAM & Admin** > **IAM**: remove the row for «lab11-analyst».\n2. **IAM & Admin** > **Service accounts**: delete «lab11-analyst».',
        shell: `gcloud projects remove-iam-policy-binding $PROJECT_ID \\
  --member=serviceAccount:$SA --role=roles/bigquery.jobUser --condition=None
gcloud iam service-accounts delete $SA --quiet
rm -f employees.csv`,
      },
    ],
    verify: `bq ls | grep lab11 || echo "No lab11 datasets left"
gcloud iam service-accounts list --filter="email~lab11" --format="value(email)" | grep . || echo "No lab11 service account left"`,
  },
  {
    station: 'reliability-fidelity',
    title: 'Validate, clean and recover an order feed',
    scenario:
      'A partner drops a daily order file. Today it holds duplicates, a missing customer, a negative amount, a bad date and a text amount, and later someone deletes the clean table by mistake. You catch every bad row, keep the good ones, and bring the data back.',
    minutes: 45,
    apis: ['bigquery.googleapis.com', 'storage.googleapis.com'],
    vars: { BUCKET: '$PROJECT_ID-lab12' },
    creates: [
      'Cloud Storage bucket «PROJECT_ID-lab12» with versioning on',
      'BigQuery dataset «lab12» with its tables and a table snapshot',
    ],
    cost: 'Free in practice: a few kilobytes in storage and queries that read under 1 MB.',
    freeTier: [
      'Cloud Storage gives 5 GB-months of Standard storage in «us-central1», «us-east1» and «us-west1».',
      'BigQuery gives 1 TiB of queries each month.',
    ],
    files: [
      {
        name: 'orders.csv',
        about: '12 order rows with planted defects: duplicates, nulls, bad types.',
        content: ORDERS,
      },
    ],
    steps: [
      {
        title: 'Land the file in a versioned bucket',
        body: 'Object versioning keeps the old copy when someone overwrites a file. That turns "the partner sent a broken file over the good one" into a restore, not an incident.',
        concepts: [2],
        console: `1. Open **Cloud Storage** > **Buckets** > **Create**. Name it «PROJECT_ID-lab12», location type **Region**, «us-central1», class **Standard**. Under data protection, turn on **Object versioning**. Create it.
2. Create the folder «landing» and upload «orders.csv» into it.
3. Upload the file a second time to the same folder, to overwrite it.
4. Open the object and look at **Version history**.`,
        shell: `gcloud storage buckets create gs://$BUCKET --location=us-central1 --uniform-bucket-level-access
gcloud storage buckets update gs://$BUCKET --versioning
gcloud storage cp orders.csv gs://$BUCKET/landing/orders.csv
gcloud storage cp orders.csv gs://$BUCKET/landing/orders.csv
gcloud storage ls -a gs://$BUCKET/landing/`,
        check:
          'The listing shows two entries for «orders.csv», each with its own «#generation» number. To restore an old one, copy «gs://…/orders.csv#GENERATION» over the live object.',
      },
      {
        title: 'Load everything as text into a staging table',
        body: 'Load a feed you do not trust as strings. A typed load fails on the first bad value and tells you about one row; a string load keeps every row, so you can measure every defect.',
        concepts: [1],
        console:
          '1. In BigQuery, create the dataset «lab12» in «us-central1».\n2. Create a table from **Google Cloud Storage**, file «PROJECT_ID-lab12/landing/orders.csv», table «orders_raw», header rows to skip «1». Enter the schema as text: «order_id:STRING,customer_id:STRING,order_ts:STRING,amount:STRING,status:STRING».',
        shell: `bq mk --dataset --location=us-central1 lab12
bq load --source_format=CSV --skip_leading_rows=1 lab12.orders_raw \\
  gs://$BUCKET/landing/orders.csv \\
  order_id:STRING,customer_id:STRING,order_ts:STRING,amount:STRING,status:STRING`,
        check: '«lab12.orders_raw» holds 12 rows.',
      },
      {
        title: 'Profile the feed and stop on bad data',
        body: 'Validation is a query that counts what is wrong, plus a gate that stops the pipeline when the count is not zero. «ASSERT» is that gate in BigQuery: it fails the script with your message.',
        concepts: [4],
        sql: `SELECT
  COUNT(*) AS row_count,
  COUNT(DISTINCT order_id) AS distinct_orders,
  COUNTIF(customer_id IS NULL) AS missing_customer,
  COUNTIF(SAFE_CAST(order_ts AS TIMESTAMP) IS NULL) AS bad_timestamp,
  COUNTIF(SAFE_CAST(amount AS NUMERIC) IS NULL) AS bad_amount,
  COUNTIF(SAFE_CAST(amount AS NUMERIC) < 0) AS negative_amount
FROM lab12.orders_raw;

ASSERT (
  SELECT COUNTIF(SAFE_CAST(amount AS NUMERIC) IS NULL) FROM lab12.orders_raw
) = 0 AS 'Every amount must be a number';`,
        check:
          'The profile shows 12 rows, 10 distinct orders, 1 missing customer, 1 bad timestamp, 1 bad amount and 1 negative amount. The script then stops with «Every amount must be a number».',
      },
      {
        title: 'Clean, quarantine and deduplicate',
        body: 'Good rows go to the clean table, bad rows go to a quarantine table with a reason, and nothing is silently dropped. «QUALIFY» keeps the latest version of each order. This is SQL in BigQuery; at a larger scale or in a stream the same rules move into Dataflow, or into Dataform or dbt models.',
        concepts: [1, 4],
        sql: `CREATE OR REPLACE TABLE lab12.orders_rejected AS
SELECT *,
  CASE
    WHEN customer_id IS NULL THEN 'missing customer'
    WHEN SAFE_CAST(order_ts AS TIMESTAMP) IS NULL THEN 'bad timestamp'
    WHEN SAFE_CAST(amount AS NUMERIC) IS NULL THEN 'bad amount'
    ELSE 'negative amount'
  END AS reason
FROM lab12.orders_raw
WHERE customer_id IS NULL
  OR SAFE_CAST(order_ts AS TIMESTAMP) IS NULL
  OR SAFE_CAST(amount AS NUMERIC) IS NULL
  OR SAFE_CAST(amount AS NUMERIC) < 0;

CREATE OR REPLACE TABLE lab12.orders AS
SELECT order_id, customer_id,
  CAST(order_ts AS TIMESTAMP) AS order_ts,
  CAST(amount AS NUMERIC) AS amount,
  status
FROM lab12.orders_raw
WHERE customer_id IS NOT NULL
  AND SAFE_CAST(order_ts AS TIMESTAMP) IS NOT NULL
  AND SAFE_CAST(amount AS NUMERIC) >= 0
QUALIFY ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY order_ts DESC) = 1;

SELECT (SELECT COUNT(*) FROM lab12.orders) AS clean_rows,
  (SELECT COUNT(*) FROM lab12.orders_rejected) AS rejected_rows;`,
        check:
          '6 clean rows and 4 rejected rows. A-1003 appears once, and A-1010 keeps the 15:05 version with amount 57.00. 6 clean + 4 rejected + 2 duplicates = 12, so every input row is accounted for.',
      },
      {
        title: 'Change two tables atomically',
        body: 'A multi-statement transaction makes a refund all-or-nothing: the order status and the refund row change together, or not at all. The second script fails on purpose, and nothing it did survives.',
        concepts: [3],
        sql: `CREATE TABLE IF NOT EXISTS lab12.refunds (order_id STRING, amount NUMERIC, refunded_at TIMESTAMP);

BEGIN TRANSACTION;
UPDATE lab12.orders SET status = 'refunded' WHERE order_id = 'A-1003';
INSERT INTO lab12.refunds
SELECT order_id, amount, CURRENT_TIMESTAMP() FROM lab12.orders WHERE order_id = 'A-1003';
COMMIT TRANSACTION;

-- Run this second script on its own. It fails half-way.
BEGIN TRANSACTION;
UPDATE lab12.orders SET status = 'refunded' WHERE order_id = 'A-1008';
SELECT ERROR('simulated crash before the refund row');
COMMIT TRANSACTION;`,
        check:
          'After the first script, A-1003 is «refunded» and «lab12.refunds» has 1 row. After the failed script, A-1008 is still «paid». BigQuery rolled the transaction back.',
      },
      {
        title: 'Recover from an accidental delete',
        body: 'BigQuery keeps every table’s history for the time travel window (7 days by default), and a table snapshot keeps a point in time for as long as you choose. Take the snapshot, delete everything, then restore both ways. Run the script in three parts: up to the «before_delete» timestamp, then the «DELETE», then the restore with your timestamp pasted in.',
        concepts: [2],
        sql: `CREATE SNAPSHOT TABLE lab12.orders_snap
CLONE lab12.orders
OPTIONS (expiration_timestamp = TIMESTAMP_ADD(CURRENT_TIMESTAMP(), INTERVAL 1 DAY));

SELECT CURRENT_TIMESTAMP() AS before_delete;  -- copy this value

DELETE FROM lab12.orders WHERE TRUE;

-- Paste the value you copied in place of the timestamp below.
CREATE OR REPLACE TABLE lab12.orders_restored AS
SELECT * FROM lab12.orders
FOR SYSTEM_TIME AS OF TIMESTAMP '2026-03-01 12:00:00+00';

SELECT (SELECT COUNT(*) FROM lab12.orders) AS live,
  (SELECT COUNT(*) FROM lab12.orders_restored) AS from_time_travel,
  (SELECT COUNT(*) FROM lab12.orders_snap) AS from_snapshot;`,
        check:
          'live = 0, from_time_travel = 6 and from_snapshot = 6. Time travel needs no setup but expires; a snapshot costs only the bytes that change after it, and lasts until its expiry.',
      },
    ],
    cleanup: [
      {
        title: 'Delete the dataset',
        body: 'This deletes every table and the snapshot.',
        concepts: [],
        console: '1. In BigQuery, delete the dataset «lab12» (type «delete» to confirm).',
        shell: 'bq rm -r -f -d lab12',
      },
      {
        title: 'Delete the bucket and every object version',
        body: 'A versioned bucket keeps old versions after you delete the live object, so delete all versions.',
        concepts: [],
        console:
          '1. Open **Cloud Storage** > **Buckets**, tick «PROJECT_ID-lab12» and click **Delete**. Type «DELETE» to confirm. This deletes every version.',
        shell: `gcloud storage rm --recursive --all-versions gs://$BUCKET
rm -f orders.csv`,
      },
    ],
    verify: `bq ls | grep lab12 || echo "No lab12 dataset left"
gcloud storage ls | grep lab12 || echo "No lab12 bucket left"`,
  },
  {
    station: 'flexibility-portability',
    title: 'Keep data portable and findable',
    scenario:
      'Your company may run a second engine next year. Leadership wants the trip data in an open format any engine can read, laid out so engines can skip what they do not need, and easy to find in the catalog.',
    minutes: 40,
    apis: ['bigquery.googleapis.com', 'storage.googleapis.com', 'dataplex.googleapis.com'],
    vars: { BUCKET: '$PROJECT_ID-lab13' },
    creates: [
      'Cloud Storage bucket «PROJECT_ID-lab13» with Parquet files',
      'BigQuery dataset «lab13» with a native and an external table',
      'Optional: a Dataplex data profile scan on «lab13.trips»',
    ],
    cost: 'Free in practice, except the optional profile scan, which uses Dataplex processing and costs about one cent on a table this small.',
    freeTier: [
      'Exports to Cloud Storage from BigQuery are free; you pay only for the storage.',
      'Catalog search is free.',
    ],
    files: [
      {
        name: 'trips.csv',
        about: '16 taxi trips in three cities over three days.',
        content: TRIPS,
      },
    ],
    steps: [
      {
        title: 'Load the trips',
        body: 'Start with a native BigQuery table. Every later step makes the same data open and portable.',
        concepts: [1],
        console:
          '1. Create the bucket «PROJECT_ID-lab13» in «us-central1».\n2. Create the dataset «lab13» in «us-central1».\n3. Create the table «lab13.trips» by uploading «trips.csv», with **Auto detect** on.',
        shell: `gcloud storage buckets create gs://$BUCKET --location=us-central1 --uniform-bucket-level-access
bq mk --dataset --location=us-central1 lab13
bq load --source_format=CSV --skip_leading_rows=1 --autodetect lab13.trips trips.csv`,
        check: '«lab13.trips» has 16 rows.',
      },
      {
        title: 'Export to Parquet in a Hive-style layout',
        body: 'Parquet is columnar, typed and open: Spark, Trino, DuckDB and BigQuery all read it. A Hive-style layout («city=SF/») lets every engine skip folders it does not need.',
        concepts: [1],
        console:
          "1. In the editor, run an «EXPORT DATA» statement for each city. Replace «YOUR_BUCKET» with your bucket name:\n   «EXPORT DATA OPTIONS (uri = 'gs://YOUR_BUCKET/lake/city=SF/part-*.parquet', format = 'PARQUET', overwrite = true) AS SELECT * EXCEPT (city) FROM lab13.trips WHERE city = 'SF'»\n2. Repeat for «NYC» and «LON».\n3. Open the bucket and look at the three folders.",
        shell: `for c in SF NYC LON; do
  bq query --use_legacy_sql=false "EXPORT DATA OPTIONS (
    uri = 'gs://$BUCKET/lake/city=$c/part-*.parquet', format = 'PARQUET', overwrite = true)
    AS SELECT * EXCEPT (city) FROM lab13.trips WHERE city = '$c'"
done
gcloud storage ls -r gs://$BUCKET/lake/`,
        check: 'Three folders, «city=SF», «city=NYC» and «city=LON», each with a Parquet file.',
      },
      {
        title: 'Read the files with another engine',
        body: 'Portability is real only if another engine reads the files. Cloud Shell has Python; «pyarrow» reads the Parquet file with no BigQuery involved.',
        concepts: [1],
        shell: `gcloud storage cp "gs://$BUCKET/lake/city=SF/*.parquet" ./sf/
python3 -m venv ~/lab13-venv && ~/lab13-venv/bin/pip install --quiet pyarrow
~/lab13-venv/bin/python -c "import glob, pyarrow.parquet as pq; t = pq.read_table(glob.glob('sf/*.parquet')[0]); print(t.schema); print(t.num_rows, 'rows')"`,
        check:
          'Python prints the schema (trip_id, pickup_date, distance_km, fare) and «5 rows». The «city» column is not in the file: it lives in the folder name.',
      },
      {
        title: 'Query the lake in place from BigQuery',
        body: 'An external table reads the files where they are. BigQuery turns «city=…» into a column and prunes folders when you filter on it.',
        concepts: [1],
        sql: `-- Replace YOUR_BUCKET twice.
CREATE OR REPLACE EXTERNAL TABLE lab13.trips_lake
WITH PARTITION COLUMNS (city STRING)
OPTIONS (
  format = 'PARQUET',
  uris = ['gs://YOUR_BUCKET/lake/*'],
  hive_partition_uri_prefix = 'gs://YOUR_BUCKET/lake'
);

SELECT city, COUNT(*) AS trips, ROUND(SUM(fare), 2) AS revenue
FROM lab13.trips_lake
GROUP BY city
ORDER BY city;`,
        check: 'LON 5 trips, NYC 6 trips, SF 5 trips: the same totals as the native table.',
      },
      {
        title: 'Describe and label the table, then find it',
        body: 'Data that no one can find is not reused. Descriptions and labels flow into Dataplex Universal Catalog, which indexes BigQuery and Cloud Storage assets for search.',
        concepts: [2],
        console: `1. Open «lab13.trips» > **Details** > **Edit details**. Add the description «Taxi trips, one row per trip. Owner: mobility team.» and the label «domain: mobility».
2. Open **Schema** > **Edit schema** and add a description to «fare»: «Fare in USD before tips.»
3. Open **Dataplex Universal Catalog** > **Search** and search for «lab13». Open the result and read the metadata.`,
        shell: `bq update --description "Taxi trips, one row per trip. Owner: mobility team." \\
  --set_label domain:mobility lab13.trips
bq show --format=prettyjson lab13.trips | jq '{description, labels}'`,
        check:
          'Search finds «trips» with its description and the label «domain: mobility». Search may take a few minutes to index a new table.',
      },
      {
        title: 'Optional: profile the table',
        body: 'A data profile scan computes null ratios, distinct counts, ranges and top values per column. It is the quick health check before anyone builds on a table. This step costs about one cent.',
        concepts: [2],
        console:
          '1. Open «lab13.trips» > **Data profile** > **Create data profile scan**.\n2. Keep the defaults, choose **Run now** and **On demand**, and create it.\n3. When the job finishes, open the results and compare the «fare» range with what you expect.',
        check:
          'The profile shows 0% nulls in every column, 3 distinct cities, and a fare range of 7.20 to 52.10.',
      },
    ],
    cleanup: [
      {
        title: 'Delete the profile scan',
        body: 'Skip this if you did not create one.',
        concepts: [],
        console:
          '1. Open **Dataplex Universal Catalog** > **Profile** (or **Data profiling & quality**). Select the scan on «lab13.trips» and delete it.',
        shell: `gcloud dataplex datascans list --location=us-central1 --format="value(name)"
# Delete each lab13 scan listed above:
# gcloud dataplex datascans delete SCAN_ID --location=us-central1 --quiet`,
      },
      {
        title: 'Delete the dataset, the bucket and the local files',
        body: 'The external table is only metadata; the bucket holds the bytes, so delete both.',
        concepts: [],
        console:
          '1. Delete the dataset «lab13» in BigQuery.\n2. Delete the bucket «PROJECT_ID-lab13» in Cloud Storage.',
        shell: `bq rm -r -f -d lab13
gcloud storage rm --recursive gs://$BUCKET
rm -rf sf trips.csv ~/lab13-venv`,
      },
    ],
    verify: `bq ls | grep lab13 || echo "No lab13 dataset left"
gcloud storage ls | grep lab13 || echo "No lab13 bucket left"`,
  },
  {
    station: 'data-migrations',
    title: 'Move files and prove nothing was lost',
    scenario:
      'An on-premises export has landed in a source bucket. You must copy it to the new platform two ways, load it, and prove to an auditor that the target holds exactly the same rows. Then you plan the Hadoop part of the move.',
    minutes: 45,
    apis: ['storage.googleapis.com', 'storagetransfer.googleapis.com', 'bigquery.googleapis.com'],
    vars: { SRC: '$PROJECT_ID-lab14-src', DST: '$PROJECT_ID-lab14-dst' },
    creates: [
      'Cloud Storage buckets «PROJECT_ID-lab14-src» and «PROJECT_ID-lab14-dst»',
      'A Storage Transfer Service job',
      'BigQuery dataset «lab14»',
    ],
    cost: 'Free in practice. Storage Transfer Service has no charge for a transfer between Cloud Storage buckets, and the 50 files hold under 1 MB.',
    freeTier: [
      'Copies between buckets in the same region have no network charge.',
      'BigQuery load jobs are free; you pay only for storage.',
    ],
    files: [],
    steps: [
      {
        title: 'Make an "on-premises export" in the source bucket',
        body: 'Cloud Shell writes 50 CSV files of 1,000 rows each, then uploads them. This stands in for a nightly export from a legacy system.',
        concepts: [1],
        shell: `gcloud storage buckets create gs://$SRC --location=us-central1 --uniform-bucket-level-access
gcloud storage buckets create gs://$DST --location=us-central1 --uniform-bucket-level-access
mkdir -p export
for i in $(seq -w 1 50); do
  seq 1 1000 | awk -v p="$i" '{ print p "," $1 "," $1 * 3 }' > export/part-$i.csv
done
gcloud storage cp export/*.csv gs://$SRC/export/
gcloud storage ls gs://$SRC/export/ | wc -l`,
        check: 'The count is 50.',
      },
      {
        title: 'Copy small data with rsync',
        body: 'For gigabytes from a machine you control, «gcloud storage rsync» is enough: it copies only what changed, so a second run is cheap and safe to repeat.',
        concepts: [1],
        shell: `gcloud storage rsync --recursive gs://$SRC/export gs://$DST/rsync
gcloud storage rsync --recursive gs://$SRC/export gs://$DST/rsync`,
        check: 'The first run copies 50 files. The second run copies nothing.',
      },
      {
        title: 'Copy with Storage Transfer Service',
        body: 'For terabytes, for a schedule, or from another cloud, use Storage Transfer Service. It runs in Google’s infrastructure, retries, checks integrity and logs every object. Over about 20 TB from a data centre with a slow link, the answer is Transfer Appliance.',
        concepts: [1],
        console: `1. Open **Storage Transfer Service** > **Create transfer job**.
2. Source **Google Cloud Storage**, destination **Google Cloud Storage**. Next.
3. Source: «PROJECT_ID-lab14-src/export». Destination: «PROJECT_ID-lab14-dst», folder «sts/».
4. Run **once**, start now. Keep the defaults and create the job.
5. Open the job and watch the run until it says **Succeeded**.`,
        shell: `gcloud transfer authorize --add-missing
gcloud transfer jobs create gs://$SRC/export/ gs://$DST/sts/
gcloud transfer jobs list --format="table(name, status)"
# Copy the job name (transferJobs/…) from the list, then watch it:
# gcloud transfer jobs monitor JOB_NAME`,
        check: '«gcloud storage ls gs://$DST/sts/ | wc -l» prints 50.',
      },
      {
        title: 'Load both copies and prove they match',
        body: 'Matching row counts are not enough: a migration can keep the count and corrupt values. Compare a fingerprint of every row as well. This is what the Data Validation Tool automates at scale.',
        concepts: [2],
        shell: `bq mk --dataset --location=us-central1 lab14
bq load --source_format=CSV lab14.from_src "gs://$SRC/export/*.csv" part:STRING,n:INT64,v:INT64
bq load --source_format=CSV lab14.from_sts "gs://$DST/sts/*.csv" part:STRING,n:INT64,v:INT64`,
        sql: `SELECT 'source' AS side, COUNT(*) AS row_count,
  BIT_XOR(FARM_FINGERPRINT(TO_JSON_STRING(t))) AS fingerprint
FROM lab14.from_src AS t
UNION ALL
SELECT 'target', COUNT(*), BIT_XOR(FARM_FINGERPRINT(TO_JSON_STRING(t)))
FROM lab14.from_sts AS t;`,
        check:
          'Both rows show 50000 and the same fingerprint. Change one value («UPDATE lab14.from_sts SET v = 0 WHERE n = 1 AND part = "01"») and run the check again: the counts still match, the fingerprints do not.',
      },
      {
        title: 'Translate a Hive query and plan the Hadoop move',
        body: 'Most Hadoop moves go in two stages: first lift the jobs to Dataproc with the data in Cloud Storage («gs://» instead of «hdfs://»), then modernise the SQL to BigQuery. The BigQuery translation service converts dialects such as HiveQL, and costs nothing to try.',
        concepts: [2],
        console: `1. In BigQuery Studio, open a new query tab. Click **More** > **Enable SQL translation**.
2. Choose the source dialect **HiveQL**.
3. Paste: «SELECT part, COUNT(*) AS c FROM lab14.from_src WHERE n BETWEEN 1 AND 10 GROUP BY part DISTRIBUTE BY part SORT BY c DESC LIMIT 5» and click **Translate**.
4. Read the GoogleSQL output, then write a three-line plan for a 200 TB HDFS cluster: how the bytes move, where the jobs run first, and how you validate.`,
        check:
          'A strong plan: DistCp or Storage Transfer to Cloud Storage (Transfer Appliance if the link is slow), Hive and Spark jobs on ephemeral Dataproc clusters first, then BigQuery for the SQL, with row count and fingerprint checks per table before cut-over.',
      },
    ],
    cleanup: [
      {
        title: 'Delete the transfer job',
        body: 'A finished one-time job costs nothing, but a forgotten job can run again if someone edits its schedule.',
        concepts: [],
        console: '1. Open **Storage Transfer Service**, select the lab job and click **Delete**.',
        shell: `gcloud transfer jobs list --format="value(name)"
# Delete the lab job listed above:
# gcloud transfer jobs delete JOB_NAME --quiet`,
      },
      {
        title: 'Delete the dataset, the buckets and the local files',
        body: 'Delete both buckets and everything in them.',
        concepts: [],
        console:
          '1. Delete the dataset «lab14».\n2. Delete the buckets «PROJECT_ID-lab14-src» and «PROJECT_ID-lab14-dst».',
        shell: `bq rm -r -f -d lab14
gcloud storage rm --recursive gs://$SRC gs://$DST
rm -rf export`,
      },
    ],
    verify: `bq ls | grep lab14 || echo "No lab14 dataset left"
gcloud storage ls | grep lab14 || echo "No lab14 buckets left"`,
  },
];
