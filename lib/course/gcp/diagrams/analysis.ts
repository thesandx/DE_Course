/**
 * Diagrams for line 4: Preparing and using data for analysis. Keyed by station
 * slug; each diagram names the concept it explains. See
 * lib/course/gcp/README.md > Diagrams.
 */

import type { GcpDiagram } from '@/types/gcp';

export const DIAGRAMS: Readonly<Record<string, readonly GcpDiagram[]>> = {
  visualization: [
    {
      concept: 1,
      kind: 'flow',
      title: 'How dashboards reach the data in BigQuery',
      scenario:
        'Managers at Cymbal open dashboards all day. Each chart is a query on BigQuery. The tools differ in who they are for, and one layer in the middle makes them all fast.',
      steps: [
        {
          n: 1,
          icon: 'bigquery',
          label: 'BigQuery',
          note: 'The governed tables that every tool reads.',
          tone: 'sky',
        },
        {
          n: 2,
          icon: 'spark',
          label: 'BI Engine',
          note: 'Keeps hot data in memory, so a chart answers in under a second.',
          tone: 'gold',
        },
      ],
      edges: ['speeds up'],
      fork: {
        label: 'step 3: the BI tool that people open',
        boxes: [
          {
            icon: 'looker-studio',
            label: 'Looker Studio',
            note: 'Free dashboards. It caches BigQuery results for about 12 hours.',
            tone: 'brand',
          },
          {
            icon: 'looker',
            label: 'Looker',
            note: 'Enterprise BI. LookML defines each metric once for everyone.',
            tone: 'iris',
          },
          {
            icon: 'table',
            label: 'Connected Sheets',
            note: 'Pivot billions of BigQuery rows from Google Sheets.',
            tone: 'easy',
          },
          {
            icon: 'chart',
            label: 'Tableau, Power BI',
            note: 'Connect with JDBC or ODBC drivers.',
            tone: 'plain',
          },
        ],
      },
      walk: [
        'All tools read the same tables in BigQuery, so the numbers agree.',
        'BI Engine is a memory reservation inside BigQuery. Any tool gets faster with it.',
        'Choose the tool by the audience: free and simple, governed and enterprise, or a spreadsheet.',
      ],
      caption:
        'If a Looker Studio report misses recent data, the cause is its data freshness setting. Change the setting or refresh the report data. Clearing the browser cache does nothing.',
    },
    {
      concept: 2,
      kind: 'spectrum',
      title: 'Four ways to avoid computing the same thing twice',
      scenario:
        'A sales dashboard at Cymbal runs the same heavy aggregation every time someone opens it. It is slow and it costs money each time. Compute once and reuse.',
      from: 'Automatic and free',
      to: 'You build it and pay for it',
      stops: [
        {
          n: 1,
          icon: 'refresh',
          label: 'Query cache',
          note: 'The same query on an unchanged table returns the saved result, free, for about 24 hours.',
          tone: 'easy',
        },
        {
          n: 2,
          icon: 'bigquery',
          label: 'Materialized view',
          note: 'BigQuery stores an aggregation and keeps it fresh as rows arrive.',
          tone: 'sky',
        },
        {
          n: 3,
          icon: 'table',
          label: 'Summary table',
          note: 'A scheduled query or Dataform builds a daily rollup table.',
          tone: 'iris',
        },
        {
          n: 4,
          icon: 'spark',
          label: 'BI Engine',
          note: 'A paid memory reservation for interactive dashboards.',
          tone: 'gold',
        },
      ],
      walk: [
        'The cache needs nothing from you, but only an identical query on unchanged data hits it.',
        'A materialized view fits an aggregation that many queries repeat.',
        'A summary table fits heavier logic that a materialized view cannot express.',
        'BI Engine fits dashboards where people click and wait.',
      ],
      caption:
        'The cache is not used when the query calls «CURRENT_TIMESTAMP()», or when the table changed or has a streaming buffer.',
    },
    {
      concept: 3,
      kind: 'flow',
      title: 'How to fix a slow or expensive query',
      scenario:
        'The BigQuery bill at Cymbal doubled last month and one report takes ten minutes. Work through four steps, in this order.',
      steps: [
        {
          n: 1,
          icon: 'search',
          label: 'Find the query',
          note: 'List the slowest and most expensive jobs, and who ran them.',
          tone: 'sky',
          chips: ['INFORMATION_SCHEMA.JOBS'],
        },
        {
          n: 2,
          icon: 'chart',
          label: 'Read the query plan',
          note: 'See which stage takes the time, how much data is shuffled, and whether one worker does far more than the rest (skew).',
          tone: 'iris',
        },
        {
          n: 3,
          icon: 'bigquery',
          label: 'Fix the SQL',
          note: 'Select fewer columns. Filter on the partition column. Reduce rows before a join.',
          tone: 'brand',
        },
        {
          n: 4,
          icon: 'shield',
          label: 'Add a guard',
          note: 'Do a dry run to see the bytes first. Set a limit so a costly query fails before it runs.',
          tone: 'easy',
          chips: ['maximum_bytes_billed'],
        },
      ],
      walk: [
        'Start with data, not guesses: INFORMATION_SCHEMA.JOBS shows which queries cost the most.',
        'Open the execution details of that query. The plan shows where the time goes.',
        'Change the query. Most wins come from scanning less: fewer columns and fewer partitions.',
        'Protect yourself for next time with a byte limit.',
      ],
      caption:
        '«LIMIT» does not reduce the bytes scanned, so it does not reduce the on-demand cost. «SELECT *» is the usual culprit.',
    },
    {
      concept: 4,
      kind: 'layers',
      title: 'What stands between an analyst and the raw data',
      scenario:
        'An analyst at Cymbal builds a dashboard on customer data. The raw table holds every region and personal details. Four controls decide what reaches the dashboard.',
      rail: 'A query passes each control on its way down',
      layers: [
        {
          n: 1,
          icon: 'users',
          label: 'The analysts group',
          note: 'Access is granted to the group. Audit logs record each read.',
          tone: 'plain',
        },
        {
          n: 2,
          icon: 'search',
          label: 'Authorized view',
          note: 'The group may query this view only. It exposes chosen columns.',
          tone: 'sky',
        },
        {
          n: 3,
          icon: 'table',
          label: 'Row access policy',
          note: 'The view returns only rows of the analyst’s own region.',
          tone: 'gold',
        },
        {
          n: 4,
          icon: 'lock',
          label: 'Policy tag with masking',
          note: 'The email column shows as a hash.',
          tone: 'brand',
        },
        {
          n: 5,
          icon: 'bigquery',
          label: 'Raw customers table',
          note: 'Sensitive Data Protection scanned it and found the PII columns.',
          tone: 'hard',
        },
      ],
      walk: [
        'The analyst is a member of a group. Nobody gets personal grants.',
        'The group can see a view, not the table behind it.',
        'A row policy filters the rows to the analyst’s region.',
        'A policy tag masks personal columns.',
        'The raw table is never reached directly.',
      ],
      caption:
        'Protection belongs in the data layer. A dashboard filter is not security, because the user can query the table without the dashboard.',
    },
  ],
  'ai-ml': [
    {
      concept: 1,
      kind: 'decision',
      title: 'Which BigQuery ML model type?',
      scenario:
        'A SQL team at Cymbal wants to build a model without leaving BigQuery. The model type follows from one question: what do you want to predict?',
      questions: [
        {
          ask: 'A number, such as next month’s demand or a price?',
          yes: {
            icon: 'chart',
            label: 'Regression',
            note: 'Predicts a continuous value.',
            tone: 'sky',
            chips: ['LINEAR_REG', 'BOOSTED_TREE_REGRESSOR'],
          },
        },
        {
          ask: 'A category, such as "will this customer leave: yes or no"?',
          yes: {
            icon: 'chart',
            label: 'Classification',
            note: 'Predicts a label.',
            tone: 'iris',
            chips: ['LOGISTIC_REG', 'BOOSTED_TREE_CLASSIFIER'],
          },
        },
        {
          ask: 'Groups of similar customers, with no labels to learn from?',
          yes: {
            icon: 'users',
            label: 'Clustering',
            note: 'Finds groups by itself.',
            tone: 'gold',
            chips: ['KMEANS'],
          },
        },
        {
          ask: 'Future values of a series over time?',
          yes: {
            icon: 'clock',
            label: 'Forecasting',
            note: 'Learns trend and season.',
            tone: 'teal',
            chips: ['ARIMA_PLUS'],
          },
        },
        {
          ask: 'Which products a user will like?',
          yes: {
            icon: 'box',
            label: 'Recommendation',
            note: 'Learns from past user and item pairs.',
            tone: 'easy',
            chips: ['MATRIX_FACTORIZATION'],
          },
        },
      ],
      otherwise: {
        icon: 'vertex-ai',
        label: 'A remote model',
        note: 'Call Gemini or another hosted model from SQL, for text and embeddings.',
        tone: 'brand',
      },
      walk: [
        'A number means regression.',
        'A yes/no or a category means classification. Logistic regression is a classifier, despite its name.',
        'No labels and you want segments: clustering with k-means.',
        'Time series: ARIMA_PLUS.',
        'User and item preferences: matrix factorization.',
      ],
      caption:
        'Logistic regression never predicts a continuous price. If the team knows only SQL and the data is in BigQuery, do not export the data to train elsewhere.',
    },
    {
      concept: 1,
      kind: 'flow',
      title: 'The life of a BigQuery ML model, in four SQL statements',
      scenario:
        'Cymbal predicts which customers will leave. The whole job is SQL in BigQuery: no servers and no data export.',
      steps: [
        {
          n: 1,
          icon: 'bigquery',
          label: 'CREATE MODEL',
          note: 'Trains on a SELECT. The TRANSFORM clause holds the feature preparation.',
          tone: 'brand',
          chips: ['TRANSFORM'],
        },
        {
          n: 2,
          icon: 'chart',
          label: 'ML.EVALUATE',
          note: 'Scores the model on rows it did not see in training.',
          tone: 'iris',
        },
        {
          n: 3,
          icon: 'table',
          label: 'ML.PREDICT',
          note: 'Applies the model to new customers.',
          tone: 'sky',
        },
        {
          n: 4,
          icon: 'search',
          label: 'ML.EXPLAIN_PREDICT',
          note: 'Shows which features pushed each prediction.',
          tone: 'teal',
        },
      ],
      walk: [
        'CREATE MODEL trains the model from a query result.',
        'ML.EVALUATE tells you how good it is, on held-out data.',
        'ML.PREDICT returns a prediction per row.',
        'ML.EXPLAIN_PREDICT says why.',
      ],
      caption:
        'Put feature preparation in the TRANSFORM clause. BigQuery then applies exactly the same steps at prediction time, so training and serving cannot drift apart (no training/serving skew).',
    },
    {
      concept: 2,
      kind: 'compare',
      title: 'Overfitting and underfitting: the symptom and the fix',
      scenario:
        'A model at Cymbal scores 99% on the training data and 70% on new customers. Another scores 60% on both. These are two opposite problems with opposite fixes.',
      columns: [
        {
          n: 1,
          icon: 'warning',
          label: 'Overfitting',
          note: 'Great on training data, poor on new data. The model memorised.',
          tone: 'hard',
          points: [
            'Add regularisation (L1 or L2).',
            'Add dropout, for a neural network.',
            'Get more training data.',
            'Stop training earlier, or use a simpler model with fewer features.',
          ],
        },
        {
          n: 2,
          icon: 'warning',
          label: 'Underfitting',
          note: 'Poor on training data and on new data. The model is too simple.',
          tone: 'medium',
          points: ['Add more features.', 'Use a more complex model.', 'Reduce the regularisation.'],
        },
      ],
      walk: [
        'Overfitting: the model learned the noise of the training set. Make it simpler or give it more data.',
        'Underfitting: the model cannot capture the pattern. Give it more power.',
      ],
      caption:
        'With rare positives (fraud is 1 in 1,000), accuracy lies: use precision, recall or PR-AUC. When behaviour changes over time, retrain on old + new data, never only the new data.',
    },
    {
      concept: 2,
      kind: 'spectrum',
      title: 'Build or buy: three levels of ML effort',
      scenario:
        'Cymbal wants to read text from invoices. Before anyone trains a model, check whether Google has already done it.',
      from: 'Least effort',
      to: 'Most effort',
      stops: [
        {
          n: 1,
          icon: 'document-ai',
          label: 'Pre-trained API',
          note: 'Google trained it. You call it. Vision, Speech, Natural Language, Document AI.',
          tone: 'easy',
        },
        {
          n: 2,
          icon: 'automl',
          label: 'AutoML',
          note: 'You bring labelled examples. Google picks and trains the model.',
          tone: 'sky',
        },
        {
          n: 3,
          icon: 'vertex-ai',
          label: 'Custom training',
          note: 'You write the model code and train it yourself.',
          tone: 'brand',
        },
      ],
      walk: [
        'If a pre-trained API covers the task, use it. No data and no training are needed.',
        'If your categories are special to your business, AutoML learns them from your examples.',
        'Write custom code only when you need full control of the model.',
      ],
      caption: 'On the exam, the smallest effort that meets the requirement is the answer.',
    },
    {
      concept: 3,
      kind: 'flow',
      title: 'RAG: how a chatbot answers from your own documents',
      scenario:
        'Cymbal wants an assistant that answers staff questions from 20,000 policy PDFs. Gemini has never seen those files. Retrieval-augmented generation (RAG) finds the right passages and hands them to the model with the question.',
      steps: [
        {
          n: 1,
          icon: 'cloud-storage',
          label: 'Ingest',
          note: 'The PDFs go into Cloud Storage. BigQuery sees them as an object table.',
          tone: 'plain',
        },
        {
          n: 2,
          icon: 'document-ai',
          label: 'Parse and chunk',
          note: 'Document AI reads the text. Split it into passages and keep the source and page.',
          tone: 'gold',
        },
        {
          n: 3,
          icon: 'vertex-ai',
          label: 'Embed',
          note: 'An embedding model turns each passage into a vector: numbers that capture its meaning.',
          tone: 'iris',
          chips: ['ML.GENERATE_EMBEDDING'],
        },
        {
          n: 4,
          icon: 'bigquery',
          label: 'Store and index',
          note: 'Save the vectors with a vector index, so similar ones are found fast.',
          tone: 'sky',
          chips: ['VECTOR_SEARCH'],
        },
        {
          n: 5,
          icon: 'spark',
          label: 'Retrieve and generate',
          note: 'Embed the question, fetch the closest passages, and give both to Gemini.',
          tone: 'brand',
        },
      ],
      walk: [
        'Collect the documents in one place.',
        'Extract the text and cut it into passages small enough for the embedding model.',
        'Turn each passage into a vector.',
        'Store the vectors in a database with a vector index (BigQuery, AlloyDB or Spanner).',
        'At question time, turn the question into a vector, find the nearest passages, and let Gemini write the answer from them.',
      ],
      caption:
        'Embed the question with the same model that embedded the documents, or the search finds nothing useful. Refresh the embeddings when documents change, and remove PII before embedding.',
    },
  ],
  'sharing-data': [
    {
      concept: 1,
      kind: 'flow',
      title: 'Analytics Hub: share a dataset without copying it',
      scenario:
        'Cymbal wants to give a supplier live access to stock data. Today a nightly export is sent, so the supplier always works with old data and Cymbal pays for copies.',
      steps: [
        {
          n: 1,
          icon: 'bigquery',
          label: 'Your dataset',
          note: 'The publisher’s data. It stays in Cymbal’s project.',
          tone: 'sky',
        },
        {
          n: 2,
          icon: 'analytics-hub',
          label: 'Exchange',
          note: 'A catalog you control. You decide who may browse it.',
          tone: 'iris',
        },
        {
          n: 3,
          icon: 'file',
          label: 'Listing',
          note: 'One shared dataset in the exchange. It can block copy and export.',
          tone: 'gold',
        },
        {
          n: 4,
          icon: 'project',
          label: 'Linked dataset',
          note: 'Appears in the supplier’s project. Read-only, always current. The supplier pays for its own queries.',
          tone: 'brand',
        },
      ],
      edges: ['publish', 'list', 'subscribe'],
      walk: [
        'The data never leaves your project.',
        'You create an exchange and choose its members.',
        'You add a listing that points at your dataset.',
        'The supplier subscribes. A linked dataset shows up on their side: a live pointer, not a copy.',
      ],
      caption:
        'Do not schedule exports or copies for a partner when a listing gives live data with no copy. When neither side may see the other’s raw rows, use a data clean room.',
    },
  ],
};
