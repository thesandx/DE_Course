/**
 * GCP course, line 4: Preparing and using data for analysis.
 *
 * Generated from Sandeep's PDE Exam Lab module and kept as data. Edit the
 * text here; see lib/course/gcp/README.md for the rules.
 */

import type { GcpLine } from '@/types/gcp';

export const line: GcpLine = {
  slug: 'analysis',
  number: 4,
  title: 'Preparing and using data for analysis',
  short: 'Analysis & ML',
  weight: 15,
  hue: 7,
  intro:
    'BI connections and query performance, masking and DLP for consumers, ML feature preparation in BigQuery ML, embeddings/RAG data prep, and sharing data with Analytics Hub. Older questions also test general ML concepts (overfitting, supervised vs unsupervised).',
  boss: {
    title: 'The Dashboard Rush',
    story:
      'Monday 9 a.m.: five hundred people open the same dashboard and the ML team wants features.',
  },
  stations: [
    {
      slug: 'visualization',
      code: '4.1',
      title: 'Preparing data for visualization',
      mission:
        "The CEO's sales dashboard takes 40 seconds to load and shows yesterday's numbers. Fix the speed, the freshness, and who can see what.",
      concepts: [
        {
          title: 'Connecting BI tools',
          body: "- **Looker Studio** (formerly Data Studio): free dashboards; BigQuery connector. Uses a **data freshness / cache** setting (default ~12 h for BigQuery) — if recent data is missing, change the data freshness or refresh the cache in the report.\n- **Looker**: enterprise BI with a **LookML semantic layer** — one governed definition of metrics; persistent derived tables (PDTs) precompute heavy logic.\n- **Connected Sheets**: analyse billions of BigQuery rows from Google Sheets with pivot tables, without exporting.\n- Tableau, Power BI, etc. via ODBC/JDBC drivers (Storage Read API for speed).\n- **BI Engine**: in-memory acceleration reservation for BigQuery; sub-second dashboard queries from any tool.\n\n> [!trap] Exam traps\n> Clearing browser history to see fresh Looker Studio data.\n\n### Keyword signals\n\n| When the question says | Think |\n|---|---|\n| 'dashboard not showing data from the last hour' | Adjust Looker Studio data freshness / disable cache |\n| 'one consistent definition of revenue across all dashboards' | Looker semantic layer (LookML) |\n| 'business users in spreadsheets on billions of rows' | Connected Sheets |",
        },
        {
          title: 'Precalculating and accelerating',
          body: "- **Materialized views** for repeated aggregations (incremental refresh).\n- **Scheduled queries** / Dataform to build summary tables (daily rollups).\n- **BI Engine** reservation for interactive dashboards.\n- **Query cache**: identical deterministic queries return cached results free for ~24 h (not with «CURRENT_TIMESTAMP()», streaming-buffer tables, or when the table changed).\n- **Search indexes** for needle-in-haystack text lookups; primary/foreign key constraints (unenforced) help the optimiser with joins.\n\n### Keyword signals\n\n| When the question says | Think |\n|---|---|\n| 'many users run the same dashboard queries; speed and cost' | BI Engine + materialized views |",
        },
        {
          title: 'Troubleshooting poor-performing queries',
          body: "1. Open the **execution details / query plan**: stages, slot time, bytes shuffled, wait vs read vs compute vs write, and **skew** (max vs average worker time).\n2. Use «INFORMATION_SCHEMA.JOBS» to find the most expensive or slowest queries and who ran them.\n\n### Fixes\n\n- Select only needed columns (never «SELECT *»; «LIMIT» doesn't reduce bytes scanned).\n- Filter on partition and cluster columns as early as possible; reduce data before joins.\n- Replace self-joins with **window functions**; use «APPROX_COUNT_DISTINCT» when exactness isn't needed.\n- Avoid JavaScript UDFs on large data; prefer SQL UDFs.\n- Fix skew: filter or pre-aggregate hot keys; avoid joining on keys with huge duplicate counts.\n- «ORDER BY» only at the outermost level, with «LIMIT».\n- Use **dry run** to see bytes before running; set «maximum_bytes_billed» as a guardrail.\n\n> [!trap] Exam traps\n> Adding LIMIT to cut cost on an on-demand query (bytes scanned unchanged).\n\n### Keyword signals\n\n| When the question says | Think |\n|---|---|\n| 'one stage takes much longer on some workers' | Data skew on a join/group key |\n| 'estimate cost before running' | Dry run (bytes processed) |",
        },
        {
          title: 'Security for consumers: masking, IAM, DLP',
          body: "- Give analysts access to **authorized views** or curated datasets rather than raw tables.\n- **Row access policies** and **policy tags with dynamic data masking** for in-table protection.\n- Run **Sensitive Data Protection** profiling to find PII, then apply policy tags or de-identify before publishing.\n- Share only via groups; audit with Data Access logs.\n\n### Keyword signals\n\n| When the question says | Think |\n|---|---|\n| 'analysts see masked emails; compliance team sees full values' | Policy tag + masking rule; Fine-Grained Reader for compliance group |",
        },
      ],
      keyPoints: [
        {
          point:
            'Looker Studio for quick dashboards, Looker for governed metrics, Connected Sheets for spreadsheet people, BI Engine for speed.',
          check: {
            type: 'match',
            prompt: 'Match each BI need to the tool.',
            pairs: [
              ['One governed definition of revenue across all dashboards', 'Looker (LookML)'],
              ['Pivot billions of rows from a spreadsheet', 'Connected Sheets'],
              ['Free, quick dashboards on BigQuery', 'Looker Studio'],
              ['In-memory acceleration for any BI tool', 'BI Engine'],
            ],
            why: 'LookML is a semantic layer. Connected Sheets pushes Sheets operations down to BigQuery. Looker Studio is free and fast to build with. BI Engine accelerates the queries themselves.',
          },
        },
        {
          point:
            'Compute once, read many times: materialized views, summary tables, BI Engine, and the free query cache.',
          check: {
            type: 'choice',
            prompt:
              'A dashboard runs «SUM(revenue) GROUP BY store, day» on a 30 TB table every few minutes, while new rows keep arriving. You want faster, cheaper queries that stay current, with no pipeline to maintain.',
            options: [
              'A materialized view with that aggregation',
              'An hourly scheduled query into a summary table',
              'An authorized view',
              'Export the table to Cloud SQL',
            ],
            answers: [0],
            why: 'Materialized views refresh incrementally and BigQuery rewrites matching queries to use them, so results stay fresh with no pipeline. A scheduled summary is stale between runs and needs maintaining; an authorized view is for access control and precomputes nothing.',
          },
        },
        {
          point:
            "Read the query plan: bytes, slot time and skew. Most fixes are 'scan less' and 'shuffle less'.",
          check: {
            type: 'choice',
            prompt: 'Which change lowers the bytes billed for an on-demand query?',
            options: [
              'Selecting 3 columns instead of SELECT *',
              'Adding LIMIT 10 to the end of the query',
              'Adding ORDER BY on the date column',
              'Running it with batch priority overnight',
            ],
            answers: [0],
            why: "On-demand billing counts bytes read from the columns referenced, after partition pruning. LIMIT and ORDER BY don't reduce the bytes read, and batch priority only changes when the query runs.",
          },
        },
        {
          point: 'Give consumers views and masked columns, not raw tables.',
          check: {
            type: 'choice',
            prompt:
              'Most analysts should see card numbers as «XXXXXXXXXXXX1234», while the fraud team sees the full value. Which feature fits best?',
            options: [
              "A policy tag with a 'last four characters' data masking rule",
              'An authorized view that shows SUBSTR of each card number to analysts',
              'A row access policy that hides cards from most analysts',
              'A customer-managed encryption key (CMEK) on the table',
            ],
            answers: [0],
            why: 'Dynamic masking on a policy tag shows masked values to Masked Readers and clear values to Fine-Grained Readers, on one table. A SUBSTR view works but means extra objects to keep in sync; row policies filter rows, and CMEK is about keys, not visibility.',
          },
        },
      ],
    },
    {
      slug: 'ai-ml',
      code: '4.2',
      title: 'Preparing data for AI and ML',
      mission:
        'Merchandising wants demand forecasts, and the product team wants a shopping assistant that answers from the catalog. Get the data ready for both.',
      concepts: [
        {
          title: 'BigQuery ML',
          body: "Train and run models with SQL where the data lives: «CREATE MODEL … OPTIONS(model_type=…) AS SELECT …», then «ML.EVALUATE», «ML.PREDICT», «ML.EXPLAIN_PREDICT».\n\n| Problem | model_type |\n|---|---|\n| Predict a number (price, demand) | «LINEAR_REG», «BOOSTED_TREE_REGRESSOR», «DNN_REGRESSOR» |\n| Predict a class (churn yes/no) | «LOGISTIC_REG», «BOOSTED_TREE_CLASSIFIER», «RANDOM_FOREST» |\n| Segment customers (no labels) | «KMEANS» |\n| Forecast time series | «ARIMA_PLUS» (+ «ML.FORECAST»), or the TimesFM-based «AI.FORECAST» |\n| Recommendations | «MATRIX_FACTORIZATION» |\n| Anomaly detection | «ML.DETECT_ANOMALIES» on ARIMA_PLUS, KMEANS, autoencoder |\n| Dimensionality reduction | «PCA» |\n| Use Gemini / hosted models | Remote model over a connection |\n\n### Feature engineering\n\n- The **«TRANSFORM» clause** applies preprocessing («ML.STANDARD_SCALER», «ML.BUCKETIZE», «ML.QUANTILE_BUCKETIZE», «ML.FEATURE_CROSS», one-hot) during training **and automatically at prediction**, preventing training/serving skew.\n- Split data correctly (random or by time for time series); avoid **leakage** (features that wouldn't be known at prediction time).\n- For serving features online, use a feature store (BigQuery as the offline store, Bigtable-backed online serving in the Agent Platform feature store).\n\n> [!trap] Exam traps\n> Exporting data to train a simple model elsewhere when the team is SQL-only and BigQuery ML fits.\n>\n> Logistic regression to predict a continuous price.\n\n### Keyword signals\n\n| When the question says | Think |\n|---|---|\n| 'SQL analysts, predict churn from BigQuery data' | BigQuery ML LOGISTIC_REG / BOOSTED_TREE_CLASSIFIER |\n| 'same preprocessing at training and prediction' | TRANSFORM clause |",
        },
        {
          title: 'ML fundamentals the exam still asks',
          body: "- **Supervised** (labelled data: classification, regression), **unsupervised** (no labels: clustering, anomaly detection), **reinforcement** (agent + reward; rarely the answer for tabular data).\n- **Overfitting** (great on training, poor on new data): add **regularisation** (L1/L2), **dropout** for neural nets, more data, early stopping, simpler model, fewer features. **Underfitting**: more features, more complex model, less regularisation.\n- **Feature selection**: drop irrelevant or redundant features; combine highly co-dependent features into one. Never remove features because they correlate strongly with the label (those are the useful ones).\n- **Anomaly detection unsupervised** fits when anomalies are rare and future anomalies may look different from past ones.\n- **Imbalanced classes**: accuracy is misleading — use precision/recall/F1, PR-AUC; resample or weight classes.\n- Metrics: regression → RMSE/MAE; classification → precision (few false positives), recall (few false negatives), ROC-AUC.\n- **Changing behaviour over time** (drift): retrain continuously on **existing + new data** (or a sliding window), monitor for drift.\n- Resource-constrained environment → simple models like **linear regression**.\n- Build vs buy: pre-trained API → AutoML → custom training, in order of effort.\n\n> [!trap] Exam traps\n> Retraining only on new data (forgets general patterns).\n>\n> Choosing reinforcement learning to predict a value from historical data.\n\n### Keyword signals\n\n| When the question says | Think |\n|---|---|\n| 'fits training data, poor on new data, deep net' | Dropout / regularisation |\n| 'thousands of features, faster training, minimal accuracy loss' | Combine co-dependent features (or PCA) |",
        },
        {
          title: 'Unstructured data, embeddings and RAG',
          body: "1. **Ingest** documents into Cloud Storage; expose them to BigQuery as **object tables**.\n2. **Parse and chunk**: Document AI (layout parser) or «ML.PROCESS_DOCUMENT»; split into passages sized for the embedding model, keep metadata (source, page, ACL).\n3. **Embed**: «ML.GENERATE_EMBEDDING» with a text-embedding model (or multimodal for images).\n4. **Store and index vectors**: BigQuery «CREATE VECTOR INDEX» + «VECTOR_SEARCH»; AlloyDB/Cloud SQL with pgvector; Spanner vector search; or Vector Search in the Agent Platform for very low latency at scale.\n5. **Retrieve and generate**: fetch top-k chunks, pass them with the question to Gemini (or use the managed RAG Engine).\n\nData engineering concerns: refresh embeddings when sources change (incremental pipelines), deduplicate, strip PII before embedding, and keep the same embedding model for indexing and querying.\n\n> [!trap] Exam traps\n> Embedding queries with a different model than the documents.\n\n### Keyword signals\n\n| When the question says | Think |\n|---|---|\n| 'semantic search over PDFs with SQL tools' | Object table → ML.GENERATE_EMBEDDING → VECTOR_SEARCH in BigQuery |",
        },
      ],
      keyPoints: [
        {
          point:
            'CREATE MODEL in SQL, train where the data lives, and put preprocessing in the TRANSFORM clause.',
          check: {
            type: 'match',
            prompt: 'Match each problem to a BigQuery ML model type.',
            pairs: [
              ['Predict a number (basket value)', 'LINEAR_REG / BOOSTED_TREE_REGRESSOR'],
              ['Predict yes or no (will churn)', 'LOGISTIC_REG / BOOSTED_TREE_CLASSIFIER'],
              ['Group customers without labels', 'KMEANS'],
              ['Forecast daily sales', 'ARIMA_PLUS'],
            ],
            why: 'Regression predicts numbers, classification predicts classes, k-means finds segments without labels, and ARIMA_PLUS forecasts time series.',
          },
        },
        {
          point:
            'Overfitting means great on training data, poor on new data. Fix it with regularization, dropout, a simpler model, or more data.',
          check: {
            type: 'choice',
            prompt:
              "Fraud is 0.2% of transactions. A model that always says 'not fraud' scores 99.8% accuracy. Which metric should you watch instead?",
            options: [
              'Precision and recall (or PR-AUC)',
              'Overall accuracy on a test set',
              'RMSE on the validation set',
              'Training loss after each epoch',
            ],
            answers: [0],
            why: 'With rare positives, accuracy rewards doing nothing. Precision (how many flags are real) and recall (how many frauds you caught) measure what matters. RMSE is for regression.',
          },
        },
        {
          point:
            'Chunk, embed, index, retrieve, generate. And embed questions with the same model you used for the documents.',
          check: {
            type: 'order',
            prompt:
              'Order the steps to prepare documents for retrieval-augmented generation in BigQuery.',
            steps: [
              'Store files in Cloud Storage and expose them as an object table',
              'Parse and chunk the documents',
              'Generate an embedding for each chunk',
              'Build a vector index',
              'Retrieve the top matches and pass them to Gemini',
            ],
            why: 'Retrieval only works on chunks that have been embedded and indexed. Generation comes last, grounded in the retrieved chunks.',
          },
        },
      ],
    },
    {
      slug: 'sharing-data',
      code: '4.3',
      title: 'Sharing data',
      mission:
        "Suppliers want sell-through numbers, and a partner wants joint insights without seeing Cymbal's customer rows. Share the data live, safely, and without copies.",
      concepts: [
        {
          title: 'Analytics Hub (BigQuery sharing) and other sharing options',
          body: "- **Analytics Hub**, now presented as **BigQuery sharing**: publishers create **exchanges** and **listings**; subscribers get a read-only **linked dataset** in their own project. **No data copies**, always current, subscriber pays for their queries. Usage metrics for publishers; can also share Pub/Sub topics.\n- **Data clean rooms**: share for joint analysis with analysis rules (aggregation thresholds, list overlap) so neither party sees the other's raw rows.\n- **Egress controls** on listings can block copying/exporting shared data.\n- Within an org: dataset IAM, authorized views/datasets. Public data: BigQuery public datasets.\n- Reports: share Looker Studio/Looker dashboards with groups; file deliveries via GCS signed URLs.\n\n> [!trap] Exam traps\n> Scheduling exports/copies to partners when a live listing avoids copies and staleness.\n\n### Keyword signals\n\n| When the question says | Think |\n|---|---|\n| 'share live datasets with partners without copying, track usage' | Analytics Hub listing |\n| 'two companies analyse overlapping customers without exposing raw data' | Data clean room |",
        },
      ],
      keyPoints: [
        {
          point:
            "Share live, don't copy. Analytics Hub listings give zero-copy linked datasets, and clean rooms allow joint analysis without exposing rows.",
          check: {
            type: 'choice',
            prompt:
              'Ten business units need self-service read access to the sales warehouse, with the least maintenance and no copies.',
            options: [
              'Publish it as a listing in a private Analytics Hub exchange',
              "Copy the dataset into each unit's own project nightly with DTS",
              'Grant Data Viewer on the whole project to every unit',
              'Email each unit a CSV export after every data load',
            ],
            answers: [0],
            why: "Subscribers get a linked dataset that's always current, the publisher keeps control and sees usage, and nothing is copied. Copies go stale and cost storage; project-wide roles expose too much.",
          },
        },
      ],
    },
  ],
};
