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
      title: 'From BigQuery to every BI tool',
      steps: [
        { label: 'BigQuery', note: 'The governed tables.', tone: 'sky' },
        { label: 'BI Engine', note: 'In-memory reservation. Sub-second.', tone: 'gold' },
      ],
      edges: ['accelerated by'],
      fork: {
        label: 'serves',
        boxes: [
          { label: 'Looker Studio', note: 'Free. Cache about 12 h: refresh it.', tone: 'brand' },
          { label: 'Looker', note: 'LookML: one definition per metric.', tone: 'iris' },
          { label: 'Connected Sheets', note: 'Billions of rows in a sheet.', tone: 'easy' },
          { label: 'Tableau, Power BI', note: 'JDBC/ODBC, Storage Read API.', tone: 'plain' },
        ],
      },
      caption:
        'Missing recent data in Looker Studio is the data freshness setting, not the browser cache. Change the freshness or refresh the report.',
    },
    {
      concept: 2,
      kind: 'spectrum',
      title: 'Ways to make dashboards fast',
      from: 'Free, automatic',
      to: 'You build and pay for it',
      stops: [
        {
          label: 'Query cache',
          note: 'Same query, unchanged table: free for about 24 h.',
          tone: 'easy',
        },
        { label: 'Materialized view', note: 'Incremental refresh of an aggregate.', tone: 'sky' },
        { label: 'Summary table', note: 'Scheduled query or Dataform rollup.', tone: 'iris' },
        { label: 'BI Engine', note: 'An in-memory reservation.', tone: 'gold' },
      ],
      caption:
        'The cache does not apply with «CURRENT_TIMESTAMP()», streaming-buffer tables, or a changed table. Search indexes help needle-in-a-haystack lookups.',
    },
    {
      concept: 3,
      kind: 'flow',
      title: 'Fix a slow or costly query',
      steps: [
        {
          label: 'Find it',
          note: 'The slowest and most costly jobs, and who ran them.',
          tone: 'sky',
          chips: ['INFORMATION_SCHEMA.JOBS'],
        },
        {
          label: 'Read the plan',
          note: 'Stages, slot time, bytes shuffled, max vs average (skew).',
          tone: 'iris',
        },
        {
          label: 'Fix it',
          note: 'Fewer columns, filter early, windows not self-joins, approximate counts.',
          tone: 'brand',
        },
        {
          label: 'Guard it',
          note: 'Dry run first; cap the bytes.',
          tone: 'easy',
          chips: ['maximum_bytes_billed'],
        },
      ],
      caption:
        '«LIMIT» does not cut the bytes scanned on an on-demand query. Select only the columns you need, and filter on partition and cluster columns.',
    },
    {
      concept: 4,
      kind: 'layers',
      title: 'What an analyst actually reaches',
      rail: 'Each layer narrows what they see',
      layers: [
        {
          label: 'Analyst group',
          note: 'Access by group; Data Access logs record every read.',
          tone: 'plain',
        },
        { label: 'Authorized view or curated dataset', note: 'Never the raw tables.', tone: 'sky' },
        { label: 'Row access policy', note: 'Only their region or tenant.', tone: 'gold' },
        {
          label: 'Policy tags + dynamic masking',
          note: 'PII columns hidden or hashed.',
          tone: 'brand',
        },
        {
          label: 'Raw table',
          note: 'Sensitive Data Protection profiling found the PII first.',
          tone: 'hard',
        },
      ],
      caption:
        'Find the PII, tag it, then publish curated views. Security is in the data, not the dashboard.',
    },
  ],
  'ai-ml': [
    {
      concept: 1,
      kind: 'decision',
      title: 'Which BigQuery ML model type',
      questions: [
        {
          ask: 'Predict a number, such as price or demand?',
          yes: {
            label: 'Regression',
            tone: 'sky',
            chips: ['LINEAR_REG', 'BOOSTED_TREE_REGRESSOR'],
          },
        },
        {
          ask: 'Predict a class, such as churn yes or no?',
          yes: {
            label: 'Classification',
            tone: 'iris',
            chips: ['LOGISTIC_REG', 'BOOSTED_TREE_CLASSIFIER'],
          },
        },
        {
          ask: 'Group customers with no labels?',
          yes: { label: 'Clustering', tone: 'gold', chips: ['KMEANS'] },
        },
        {
          ask: 'Forecast a time series?',
          yes: { label: 'Forecasting', tone: 'teal', chips: ['ARIMA_PLUS', 'AI.FORECAST'] },
        },
        {
          ask: 'Recommend items to users?',
          yes: { label: 'Recommendation', tone: 'easy', chips: ['MATRIX_FACTORIZATION'] },
        },
      ],
      otherwise: {
        label: 'A remote model',
        note: 'Gemini or a hosted model over a connection.',
        tone: 'brand',
      },
      caption:
        'Logistic regression never predicts a continuous price. For a SQL-only team, train where the data lives.',
    },
    {
      concept: 1,
      kind: 'flow',
      title: 'The BigQuery ML loop',
      steps: [
        {
          label: 'CREATE MODEL',
          note: 'TRANSFORM clause holds the preprocessing.',
          tone: 'brand',
          chips: ['TRANSFORM'],
        },
        { label: 'ML.EVALUATE', note: 'On held-out data.', tone: 'iris' },
        { label: 'ML.PREDICT', note: 'TRANSFORM runs again here.', tone: 'sky' },
        { label: 'ML.EXPLAIN_PREDICT', note: 'Why this prediction.', tone: 'teal' },
      ],
      caption:
        'Because TRANSFORM runs at training and at prediction, the two can never drift apart (no training/serving skew).',
    },
    {
      concept: 2,
      kind: 'compare',
      title: 'Overfitting and underfitting',
      columns: [
        {
          label: 'Overfitting',
          note: 'Great on training data, poor on new data.',
          tone: 'hard',
          points: [
            'Add regularisation (L1, L2).',
            'Add dropout to a neural net.',
            'More data, early stopping, fewer features.',
          ],
        },
        {
          label: 'Underfitting',
          note: 'Poor on training data too.',
          tone: 'medium',
          points: ['Add features.', 'Use a more complex model.', 'Reduce regularisation.'],
        },
      ],
      caption:
        'With imbalanced classes, accuracy lies: use precision, recall, F1 or PR-AUC. For drift, retrain on existing + new data, never only the new data.',
    },
    {
      concept: 2,
      kind: 'spectrum',
      title: 'Build or buy',
      from: 'Least effort',
      to: 'Most effort',
      stops: [
        { label: 'Pre-trained API', note: 'Vision, speech, language.', tone: 'easy' },
        { label: 'AutoML', note: 'Your labelled data, no model code.', tone: 'sky' },
        { label: 'Custom training', note: 'Your model, your code.', tone: 'brand' },
      ],
      caption: 'Start at the left and move right only when the requirement forces you.',
    },
    {
      concept: 3,
      kind: 'flow',
      title: 'A RAG pipeline on Google Cloud',
      steps: [
        { label: 'Ingest', note: 'Documents in Cloud Storage, as object tables.', tone: 'plain' },
        {
          label: 'Parse + chunk',
          note: 'Keep source, page and ACL.',
          tone: 'gold',
          chips: ['Document AI'],
        },
        {
          label: 'Embed',
          note: 'One embedding model for all.',
          tone: 'iris',
          chips: ['ML.GENERATE_EMBEDDING'],
        },
        {
          label: 'Index',
          note: 'Vectors with an index.',
          tone: 'sky',
          chips: ['VECTOR_SEARCH', 'pgvector'],
        },
        { label: 'Retrieve + generate', note: 'Top-k chunks to Gemini.', tone: 'brand' },
      ],
      caption:
        'Embed queries with the same model as the documents. Refresh embeddings when sources change, deduplicate, and strip PII before embedding.',
    },
  ],
  'sharing-data': [
    {
      concept: 1,
      kind: 'flow',
      title: 'Share with Analytics Hub: no copies',
      steps: [
        { label: 'Publisher dataset', note: 'Stays in your project.', tone: 'sky' },
        { label: 'Exchange', note: 'Who may browse.', tone: 'iris' },
        { label: 'Listing', note: 'Egress controls can block export.', tone: 'gold' },
        {
          label: 'Linked dataset',
          note: 'Read-only, always current. The subscriber pays for queries.',
          tone: 'brand',
        },
      ],
      edges: ['publish', 'list', 'subscribe'],
      caption:
        'Do not schedule copies to partners when a live listing avoids copies and staleness. For joint analysis without seeing raw rows, use a data clean room.',
    },
  ],
};
