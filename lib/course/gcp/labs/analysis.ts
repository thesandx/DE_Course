/**
 * Hands-on labs for line 4, "Preparing and using data for analysis".
 * One lab per station. The shape and the rules are in `../README.md`.
 */

import type { GcpLab } from '@/types/gcp';

const FAQ = `id,question
1,How do I cancel a ride after the driver has accepted it?
2,Why was I charged a cancellation fee?
3,How can I change the payment card on my account?
4,The driver took a longer route than the map showed
5,How do I report an item I left in the car?
6,Can I schedule a ride for tomorrow morning?`;

export const LABS: readonly GcpLab[] = [
  {
    station: 'visualization',
    title: 'Build a fast, safe sales dashboard',
    scenario:
      'The sales dashboard takes 20 seconds to load and reads the whole fact table on every refresh. Store managers must see only totals, never customer rows. You pre-aggregate the data, find the slow query in the job history, connect Looker Studio, and give consumers a safe view.',
    minutes: 50,
    apis: ['bigquery.googleapis.com', 'bigqueryreservation.googleapis.com'],
    creates: [
      'BigQuery dataset «lab41» with a 1-million-row fact table, a materialized view and a view',
      'A Looker Studio data source and report',
      'Optional: a 1 GB BI Engine reservation',
    ],
    cost: 'Free, unless you add the optional BI Engine reservation: about $0.04 per GB an hour, so delete it the same day. Looker Studio is free.',
    freeTier: [
      'BigQuery gives 1 TiB of queries and 10 GiB of storage each month.',
      'Looker Studio (the free version) has no charge; queries it sends to BigQuery count toward your BigQuery usage.',
    ],
    files: [],
    steps: [
      {
        title: 'Generate the sales fact table',
        body: 'One million order lines across 20 stores and 90 days, partitioned by day: the shape of a typical dashboard source.',
        concepts: [2],
        sql: `CREATE SCHEMA IF NOT EXISTS lab41 OPTIONS (location = 'us-central1');

CREATE OR REPLACE TABLE lab41.sales
PARTITION BY order_date
CLUSTER BY store_id AS
SELECT
  a * 1000 + b AS line_id,
  DATE_ADD(DATE '2026-01-01', INTERVAL MOD(a * 7 + b, 90) DAY) AS order_date,
  MOD(a + b * 3, 20) + 1 AS store_id,
  CONCAT('cust-', CAST(MOD(a * b, 50000) AS STRING)) AS customer_id,
  ROUND(2 + RAND() * 98, 2) AS amount
FROM UNNEST(GENERATE_ARRAY(1, 1000)) AS a, UNNEST(GENERATE_ARRAY(1, 1000)) AS b;`,
        check: '«lab41.sales» has 1,000,000 rows and 90 partitions.',
      },
      {
        title: 'Pre-aggregate for the dashboard',
        body: 'The dashboard shows revenue by store and day. A materialized view of that aggregate holds 1,800 rows instead of a million, refreshes itself, and reads in milliseconds.',
        concepts: [2],
        sql: `CREATE MATERIALIZED VIEW lab41.daily_store_mv
PARTITION BY order_date AS
SELECT order_date, store_id, COUNT(*) AS lines, SUM(amount) AS revenue
FROM lab41.sales
GROUP BY order_date, store_id;

SELECT store_id, SUM(revenue) AS revenue
FROM lab41.daily_store_mv
WHERE order_date >= '2026-03-01'
GROUP BY store_id
ORDER BY revenue DESC
LIMIT 5;`,
        check: 'Five stores with their March revenue. The job reads a few kilobytes.',
      },
      {
        title: 'Find and fix a slow query',
        body: 'Run a deliberately bad query, then read its plan. The **Execution details** tab shows each stage, its rows and its slot time; the job history in «INFORMATION_SCHEMA.JOBS» shows bytes and slots for every query, so you can find the worst ones.',
        concepts: [3],
        sql: `-- Slow: a join that multiplies rows, then sorts everything.
SELECT a.customer_id, COUNT(*) AS pairs
FROM lab41.sales AS a
JOIN lab41.sales AS b USING (customer_id)
WHERE a.order_date = '2026-02-01' AND b.order_date = '2026-02-01'
GROUP BY a.customer_id
ORDER BY pairs DESC;

-- The same answer without the join: count, then square.
SELECT customer_id, COUNT(*) * COUNT(*) AS pairs
FROM lab41.sales
WHERE order_date = '2026-02-01'
GROUP BY customer_id
ORDER BY pairs DESC;

SELECT job_id, total_bytes_processed, total_slot_ms,
  TIMESTAMP_DIFF(end_time, start_time, MILLISECOND) AS ms,
  LEFT(query, 60) AS query
FROM \`region-us-central1\`.INFORMATION_SCHEMA.JOBS_BY_USER
WHERE creation_time > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 HOUR)
ORDER BY total_slot_ms DESC
LIMIT 5;`,
        console:
          '1. Run the first query and open **Execution details**. Find the join stage and compare its output rows with its input rows.\n2. Run the second query and compare the slot time.\n3. Run the job history query.',
        check:
          'Both queries return the same top customers. The join stage outputs far more rows than it reads, and the first query uses many times the slot milliseconds of the second. The job history lists the self-join at the top.',
      },
      {
        title: 'Give consumers a safe view',
        body: 'Store managers need totals, not customer rows. Publish a view with no customer column, and point the dashboard at it. In Looker Studio, **owner’s credentials** means everyone sees what the owner sees; **viewer’s credentials** means each viewer’s own BigQuery access applies.',
        concepts: [4],
        sql: `CREATE OR REPLACE VIEW lab41.store_revenue AS
SELECT order_date, store_id, lines, revenue
FROM lab41.daily_store_mv;`,
        check: 'The view has four columns and no «customer_id».',
      },
      {
        title: 'Connect Looker Studio',
        body: 'A BI tool should read the small, safe view, not the fact table. Every chart refresh becomes a query, so the source decides the speed and the bill.',
        concepts: [1, 4],
        console: `1. Open lookerstudio.google.com > **Create** > **Report**. Add data > **BigQuery**.
2. Choose your project > «lab41» > «store_revenue». Click **Add**.
3. Add a time series chart: dimension «order_date», metric «revenue».
4. Add a table: dimension «store_id», metric «revenue», sorted descending.
5. Open **Resource** > **Manage added data sources** > **Edit** and look at **Data credentials**.`,
        check:
          'The chart shows 90 days of revenue and the table shows 20 stores. In BigQuery, the job history shows the small queries Looker Studio sent to the view.',
      },
      {
        title: 'Optional: accelerate with BI Engine',
        body: 'BI Engine keeps hot data in memory for sub-second dashboards. A reservation bills by the hour while it exists, so create it, test, and delete it in the cleanup.',
        concepts: [2],
        console:
          '1. Open **BigQuery** > **BI Engine** > **Create reservation**. Location «us-central1», capacity 1 GB, preferred table «lab41.store_revenue». Create.\n2. Refresh the Looker Studio report twice.\n3. In BigQuery, open a recent job from Looker Studio and read **BI Engine mode** in the job details.',
        check: 'The job shows BI Engine mode **Full** (or **Partial** with a reason).',
      },
    ],
    cleanup: [
      {
        title: 'Delete the BI Engine reservation',
        body: 'Skip this if you did not create one. This is the only part of the lab that bills by the hour.',
        concepts: [],
        console:
          '1. Open **BigQuery** > **BI Engine**, select the reservation in «us-central1» and delete it.',
      },
      {
        title: 'Delete the report and the data source',
        body: 'They cost nothing, but a forgotten data source with owner’s credentials is a way into your data.',
        concepts: [],
        console:
          '1. In Looker Studio, open **Reports**, open the report’s menu and click **Remove**.\n2. Open **Data sources** and remove the «store_revenue» source.',
      },
      {
        title: 'Delete the dataset',
        body: 'This deletes the table, the materialized view and the view.',
        concepts: [],
        console: '1. Delete the dataset «lab41» in BigQuery.',
        shell: 'bq rm -r -f -d lab41',
      },
    ],
    verify: `bq ls | grep lab41 || echo "No lab41 dataset left"
echo "Also open BigQuery > BI Engine and check that no reservation is listed"`,
  },
  {
    station: 'ai-ml',
    title: 'Train, evaluate and serve models in BigQuery ML',
    scenario:
      'The research team has a table of penguin measurements and two asks: predict body mass, and classify the species. You train both models with SQL, read their metrics like an ML engineer, and, optionally, add semantic search over support questions with embeddings.',
    minutes: 45,
    apis: [
      'bigquery.googleapis.com',
      'bigqueryconnection.googleapis.com',
      'aiplatform.googleapis.com',
    ],
    creates: [
      'BigQuery dataset «lab42» in the «US» multi-region, with two models',
      'Optional: connection «lab42_conn» and a remote embedding model',
    ],
    cost: 'Free in practice for the two models: the training table is about 344 rows. The optional embeddings step calls Vertex AI for six short texts, which costs a fraction of a cent.',
    freeTier: [
      'BigQuery ML model training on small tables stays far inside the monthly free tier.',
      'This lab uses the «US» location because the public penguins table lives there; a query cannot join data from two locations.',
    ],
    files: [
      {
        name: 'faq.csv',
        about: 'Six rider support questions, for the optional embeddings step.',
        content: FAQ,
      },
    ],
    steps: [
      {
        title: 'Look at the training data',
        body: 'Before any model: how many rows, which columns are missing values, and is any class rare? These answers decide the model and the metrics.',
        concepts: [2],
        sql: `CREATE SCHEMA IF NOT EXISTS lab42 OPTIONS (location = 'US');

SELECT species, COUNT(*) AS penguins,
  COUNTIF(body_mass_g IS NULL) AS missing_mass,
  COUNTIF(sex IS NULL) AS missing_sex
FROM \`bigquery-public-data.ml_datasets.penguins\`
GROUP BY species;`,
        check:
          'Three species: Adelie is the largest class, Chinstrap the smallest. A few rows have no body mass or sex.',
      },
      {
        title: 'Train a regression model with a TRANSFORM',
        body: 'The «TRANSFORM» clause stores feature preparation inside the model, so prediction applies exactly the same steps. That prevents training-serving skew, a classic exam topic.',
        concepts: [1, 2],
        sql: `CREATE OR REPLACE MODEL lab42.mass_model
TRANSFORM (
  ML.STANDARD_SCALER(culmen_length_mm) OVER () AS culmen_length,
  ML.STANDARD_SCALER(flipper_length_mm) OVER () AS flipper_length,
  species, island, sex,
  body_mass_g
)
OPTIONS (
  model_type = 'linear_reg',
  input_label_cols = ['body_mass_g'],
  data_split_method = 'RANDOM',
  data_split_eval_fraction = 0.2
) AS
SELECT culmen_length_mm, flipper_length_mm, species, island, sex, body_mass_g
FROM \`bigquery-public-data.ml_datasets.penguins\`
WHERE body_mass_g IS NOT NULL;`,
        check:
          'The model appears under «lab42». Its **Training** tab shows the loss falling over iterations.',
      },
      {
        title: 'Evaluate and predict',
        body: 'Read the metrics on the held-out 20%, not on the training data. Then predict for rows the model has not seen.',
        concepts: [1, 2],
        sql: `SELECT * FROM ML.EVALUATE(MODEL lab42.mass_model);

SELECT species, island, sex, flipper_length_mm,
  ROUND(predicted_body_mass_g) AS predicted_g
FROM ML.PREDICT(MODEL lab42.mass_model, (
  SELECT 'Gentoo penguin (Pygoscelis papua)' AS species, 'Biscoe' AS island, 'MALE' AS sex,
    50.0 AS culmen_length_mm, 225.0 AS flipper_length_mm
));`,
        check:
          'R² is about 0.8 or higher and the mean absolute error is a few hundred grams. The prediction for a large male Gentoo is about 5,500 to 6,000 g.',
      },
      {
        title: 'Classify the species and read the confusion matrix',
        body: 'For classes, accuracy alone hides mistakes on a small class. Read precision and recall per class, and the confusion matrix, which shows which species the model mixes up.',
        concepts: [1, 2],
        sql: `CREATE OR REPLACE MODEL lab42.species_model
OPTIONS (model_type = 'logistic_reg', input_label_cols = ['species'], auto_class_weights = TRUE) AS
SELECT species, island, culmen_length_mm, culmen_depth_mm, flipper_length_mm, body_mass_g
FROM \`bigquery-public-data.ml_datasets.penguins\`
WHERE body_mass_g IS NOT NULL;

SELECT * FROM ML.EVALUATE(MODEL lab42.species_model);
SELECT * FROM ML.CONFUSION_MATRIX(MODEL lab42.species_model);`,
        check:
          'Accuracy is above 0.95. «auto_class_weights» stops the model from ignoring the small Chinstrap class. The confusion matrix has almost every count on its diagonal.',
      },
      {
        title: 'Optional: semantic search with embeddings',
        body: 'An embedding turns text into a vector so similar meanings sit close together. That is the retrieval half of RAG. You embed six support questions, then find the nearest ones to a new question. If the model name below has been retired, pick the current text embedding model from the Vertex AI model list.',
        concepts: [3],
        console:
          '1. In BigQuery Explorer, click **Add** > **Connections to external data sources**: type **Vertex AI remote models, remote functions and BigLake (Cloud Resource)**, ID «lab42_conn», location **US**.\n2. Copy the connection’s service account, open **IAM** > **Grant access**, and give it **Vertex AI User**.\n3. Upload «faq.csv» to the table «lab42.faq» with **Auto detect**, then run the SQL.',
        sql: `CREATE OR REPLACE MODEL lab42.embedder
REMOTE WITH CONNECTION \`us.lab42_conn\`
OPTIONS (ENDPOINT = 'text-embedding-005');

CREATE OR REPLACE TABLE lab42.faq_vectors AS
SELECT id, content, ml_generate_embedding_result AS embedding
FROM ML.GENERATE_EMBEDDING(MODEL lab42.embedder,
  (SELECT id, question AS content FROM lab42.faq));

SELECT base.content AS match, ROUND(distance, 3) AS distance
FROM VECTOR_SEARCH(
  TABLE lab42.faq_vectors, 'embedding',
  (SELECT ml_generate_embedding_result AS embedding
   FROM ML.GENERATE_EMBEDDING(MODEL lab42.embedder,
     (SELECT 'I was billed after I cancelled' AS content))),
  top_k => 2);`,
        check:
          'The two nearest questions are about the cancellation fee and cancelling a ride, though neither shares many words with the query. A RAG system passes these matches to an LLM as context.',
      },
    ],
    cleanup: [
      {
        title: 'Delete the dataset',
        body: 'This deletes both models, the remote model and the tables.',
        concepts: [],
        console: '1. Delete the dataset «lab42» in BigQuery.',
        shell: 'bq rm -r -f -d lab42',
      },
      {
        title: 'Delete the connection and its role',
        body: 'Skip this if you did not do the optional step.',
        concepts: [],
        console:
          '1. In **IAM**, remove the Vertex AI User role from the connection’s service account.\n2. In BigQuery Explorer, open **Connections** > «us.lab42_conn» and delete it.',
        shell: `export CONN_SA=$(bq show --connection --format=json $PROJECT_ID.us.lab42_conn | jq -r .cloudResource.serviceAccountId)
gcloud projects remove-iam-policy-binding $PROJECT_ID \\
  --member=serviceAccount:$CONN_SA --role=roles/aiplatform.user --condition=None
bq rm --connection $PROJECT_ID.us.lab42_conn`,
      },
    ],
    verify: `bq ls | grep lab42 || echo "No lab42 dataset left"
bq ls --connection --location=US | grep lab42 || echo "No lab42 connection left"`,
  },
  {
    station: 'sharing-data',
    title: 'Publish a dataset with BigQuery sharing',
    scenario:
      'A partner wants your daily city metrics. You must not copy the data, must be able to revoke access at once, and must see who subscribed. You publish a listing on a private exchange and subscribe to it as the partner would.',
    minutes: 35,
    apis: ['bigquery.googleapis.com', 'analyticshub.googleapis.com'],
    creates: [
      'BigQuery dataset «lab43_src»',
      'Data exchange «lab43_exchange» with listing «lab43_daily»',
      'Linked dataset «lab43_linked» (made when you subscribe)',
    ],
    cost: 'Free. BigQuery sharing has no charge of its own; the subscriber pays for the queries they run.',
    freeTier: ['BigQuery gives 1 TiB of queries and 10 GiB of storage each month.'],
    files: [],
    steps: [
      {
        title: 'Prepare the dataset to share',
        body: 'Share a dataset made for consumers: aggregated, documented, and with no personal data. A listing shares a whole dataset, so keep internal tables elsewhere.',
        concepts: [1],
        sql: `CREATE SCHEMA IF NOT EXISTS lab43_src OPTIONS (
  location = 'us-central1',
  description = 'Daily city metrics for partners. One row per city and day.'
);

CREATE OR REPLACE TABLE lab43_src.daily_city AS
SELECT DATE_ADD(DATE '2026-03-01', INTERVAL d DAY) AS day, city,
  CAST(100 + RAND() * 900 AS INT64) AS trips
FROM UNNEST(GENERATE_ARRAY(0, 13)) AS d, UNNEST(['SF', 'NYC', 'LON']) AS city;`,
        check: '«lab43_src.daily_city» has 42 rows: 14 days × 3 cities.',
      },
      {
        title: 'Create a private exchange and a listing',
        body: 'An exchange is a catalogue of listings with its own access control. A listing points at one dataset. Subscribers get a read-only **linked dataset**: a pointer, not a copy, so they always see current data and you can revoke at once.',
        concepts: [1],
        console: `1. Open **BigQuery** > **Sharing (Analytics Hub)** > **Create exchange**. Location «us-central1», name «lab43_exchange», private. Create, and skip the permissions page.
2. Open the exchange > **Create listing**. Source dataset «lab43_src», name «lab43_daily», add a description and a contact email. Publish.`,
        check: 'The exchange shows one listing, «lab43_daily», in state **Active**.',
      },
      {
        title: 'Subscribe as the partner',
        body: 'You subscribe to your own listing to see the partner’s view. In real use the partner does this in their project, after you grant them Subscriber on the listing or the exchange.',
        concepts: [1],
        console:
          '1. Open the listing and click **Subscribe**.\n2. Project: your project. Linked dataset name «lab43_linked». Save.',
        sql: `SELECT city, SUM(trips) AS trips
FROM lab43_linked.daily_city
GROUP BY city
ORDER BY city;

CREATE TABLE lab43_linked.my_copy AS SELECT 1 AS x;  -- fails`,
        check:
          'The query returns three cities. The «CREATE TABLE» fails: a linked dataset is read-only. The listing page shows one subscription.',
      },
      {
        title: 'See that the share is live, not a copy',
        body: 'Add a row in the source and read it through the linked dataset. Then compare with the other ways to share.',
        concepts: [1],
        sql: `INSERT lab43_src.daily_city VALUES (DATE '2026-03-15', 'BLR', 500);

SELECT COUNT(*) AS rows_seen_by_partner FROM lab43_linked.daily_city;`,
        check:
          'The partner sees 43 rows at once. Other options: an authorized view or authorized dataset for teams in your organisation; a data clean room when partners may only run aggregate queries; an export to Cloud Storage when the partner has no BigQuery.',
      },
    ],
    cleanup: [
      {
        title: 'Delete the linked dataset',
        body: 'Deleting the linked dataset ends the subscription. It never deletes the source data.',
        concepts: [],
        console: '1. Delete the dataset «lab43_linked» in BigQuery.',
        shell: 'bq rm -r -f -d lab43_linked',
      },
      {
        title: 'Delete the listing and the exchange',
        body: 'Delete the listing first, then the exchange.',
        concepts: [],
        console:
          '1. Open **Sharing (Analytics Hub)** > «lab43_exchange». Select «lab43_daily» and delete it.\n2. Delete the exchange.',
      },
      {
        title: 'Delete the source dataset',
        body: 'Last, delete the data you shared.',
        concepts: [],
        console: '1. Delete the dataset «lab43_src».',
        shell: 'bq rm -r -f -d lab43_src',
      },
    ],
    verify: `bq ls | grep lab43 || echo "No lab43 datasets left"
curl -s -H "Authorization: Bearer $(gcloud auth print-access-token)" -H "x-goog-user-project: $PROJECT_ID" \\
  "https://analyticshub.googleapis.com/v1/projects/$PROJECT_ID/locations/us-central1/dataExchanges" | jq '.dataExchanges // "No exchanges left"'`,
  },
];
