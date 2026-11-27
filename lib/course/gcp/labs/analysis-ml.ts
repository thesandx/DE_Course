/**
 * Hands-on labs for stations 4.4 (ML fundamentals) and 4.5 (ML on Google
 * Cloud). One lab per station. The shape and the rules are in `../README.md`.
 */

import type { GcpLab } from '@/types/gcp';

/** The census features every lab 4.4 model reads, with the label last. */
const CENSUS_COLUMNS = `age, workclass, education, marital_status, occupation, relationship, race, sex,
  capital_gain, capital_loss, hours_per_week, native_country`;

const VALIDATION = `(SELECT * EXCEPT (bucket) FROM lab44.census WHERE bucket BETWEEN 800 AND 899)`;
const SMALL_TRAIN = `(SELECT * EXCEPT (bucket) FROM lab44.census WHERE bucket < 40)`;

const PENGUINS = '`bigquery-public-data.ml_datasets.penguins`';

/** The test request for the optional endpoint in lab 4.5. */
const REQUEST = `{
  "instances": [
    {
      "species": "Gentoo penguin (Pygoscelis papua)",
      "island": "Biscoe",
      "sex": "MALE",
      "culmen_length_mm": 50.0,
      "culmen_depth_mm": 15.5,
      "flipper_length_mm": 225.0
    }
  ]
}`;

export const LABS: readonly GcpLab[] = [
  {
    station: 'ml-fundamentals',
    verifyConsole: `1. **BigQuery** > **Studio**: the Explorer lists no «lab44».
2. **Billing** > **Reports**, the next day: the BigQuery and Vertex AI lines for today are a few cents.`,
    title: 'Make a model overfit, then fix it',
    scenario:
      'You get the classic census table: predict whether a person earns more than 50,000 dollars a year. You split the data properly, train a deep network that memorises on purpose, fix it with dropout and early stopping, see L1 switch features off, move the threshold to trade precision for recall, and engineer features in a TRANSFORM. Everything is SQL in BigQuery ML.',
    minutes: 60,
    apis: ['bigquery.googleapis.com'],
    creates: [
      'BigQuery dataset «lab44» in the «US» multi-region, with the table «census»',
      'Five BigQuery ML models in «lab44»: two deep networks and three logistic regressions',
    ],
    cost: 'The logistic regressions read a few megabytes and stay inside the free tier. BigQuery ML trains the two deep networks (DNN_CLASSIFIER) on managed training machines, which can be billed separately from the query; on 1,300 rows each run takes a few minutes and costs cents, not dollars. Delete the dataset at the end.',
    freeTier: [
      'BigQuery gives 1 TiB of queries and 10 GiB of storage each month. The census table is about 4 MB.',
      'This lab uses the «US» location because the public census table lives there.',
      'If cost matters most, skip the two deep networks and read their steps: the logistic regression steps show L1, metrics and feature engineering on their own.',
    ],
    files: [],
    steps: [
      {
        title: 'Split the data once, by a stable hash',
        see: `The Explorer shows «lab44» > «census». Its **Details** tab shows about 32,500 rows, and the results panel shows the three splits.`,
        console: `1. Open **BigQuery** > **Studio** and click **+** (Compose a new query).
2. Paste the SQL below and click **Run**.`,
        body: 'Every row gets a number from 0 to 999 from a hash of the row itself. Rows 0 to 799 are training, 800 to 899 validation and 900 to 999 test. A hash, unlike «RAND()», gives the same split every time you run it, so no row moves from test into training between experiments. You also keep a deliberately small training sample (buckets 0 to 39, about 1,300 rows): small data makes overfitting easy to see.',
        concepts: [1],
        sql: `CREATE SCHEMA IF NOT EXISTS lab44 OPTIONS (location = 'US');

CREATE OR REPLACE TABLE lab44.census AS
SELECT
  ${CENSUS_COLUMNS},
  TRIM(income_bracket) AS label,
  MOD(ABS(FARM_FINGERPRINT(TO_JSON_STRING(t))), 1000) AS bucket
FROM \`bigquery-public-data.ml_datasets.census_adult_income\` AS t;

SELECT
  CASE WHEN bucket < 800 THEN '1 train' WHEN bucket < 900 THEN '2 validate' ELSE '3 test' END AS split,
  COUNT(*) AS people,
  ROUND(AVG(IF(label = '>50K', 1, 0)), 3) AS share_over_50k
FROM lab44.census
GROUP BY split
ORDER BY split;`,
        check:
          'About 80% of the rows are in training and 10% each in validation and test. The share over 50K is about 0.24 in every split, so the splits look alike. The table has no «functional_weight» or «education_num»: one is a sampling weight, and the other repeats «education».',
      },
      {
        title: 'Train a deep network that memorises',
        see: `«lab44» > **Models** > «overfit_dnn». Its **Training** tab shows the loss per iteration falling almost to zero.`,
        console: `1. Open **BigQuery** > **Studio** and click **+** (Compose a new query).
2. Paste the first statement and click **Run**. Training takes about 5 to 15 minutes.
3. When it finishes, run the evaluation query below it.`,
        body: 'Three layers of 256 neurons, 200 passes over 1,300 rows, no dropout and no early stopping. That is far more capacity than the data supports, which is the setup of the exam question: many layers and neurons, great on training data. You then score the same model on the rows it trained on and on the validation rows.',
        concepts: [2],
        sql: `CREATE OR REPLACE MODEL lab44.overfit_dnn
OPTIONS (
  model_type = 'DNN_CLASSIFIER',
  input_label_cols = ['label'],
  hidden_units = [256, 256, 256],
  dropout = 0.0,
  max_iterations = 200,
  early_stop = FALSE,
  data_split_method = 'NO_SPLIT'
) AS
SELECT * FROM ${SMALL_TRAIN};

SELECT 'training rows' AS scored_on, accuracy, precision, recall, roc_auc
FROM ML.EVALUATE(MODEL lab44.overfit_dnn, ${SMALL_TRAIN})
UNION ALL
SELECT 'validation rows', accuracy, precision, recall, roc_auc
FROM ML.EVALUATE(MODEL lab44.overfit_dnn, ${VALIDATION});`,
        check:
          'The training rows score far better than the validation rows: accuracy close to 1.0 against about 0.8. That gap is overfitting. The model learned the 1,300 people, not the rule.',
      },
      {
        title: 'Fix it with dropout and early stopping',
        see: `«lab44» > **Models** > «dropout_dnn» > **Training** shows two loss lines, training and evaluation, and fewer iterations than 200 because early stopping ended the run.`,
        console: `1. Open **BigQuery** > **Studio** and click **+** (Compose a new query).
2. Paste the SQL below and click **Run**. Training takes about 5 to 15 minutes.
3. Open the model’s **Training** tab and compare it with «overfit_dnn».`,
        body: 'Same network, same 1,300 training rows. Now «dropout = 0.4» switches off a random 40% of the neurons at each training step, and «early_stop» watches the loss on the validation rows (marked by «is_eval») and stops when it no longer improves. The «is_eval» column only marks the split; it is not a feature.',
        concepts: [3],
        sql: `CREATE OR REPLACE MODEL lab44.dropout_dnn
OPTIONS (
  model_type = 'DNN_CLASSIFIER',
  input_label_cols = ['label'],
  hidden_units = [256, 256, 256],
  dropout = 0.4,
  max_iterations = 200,
  early_stop = TRUE,
  min_rel_progress = 0.005,
  data_split_method = 'CUSTOM',
  data_split_col = 'is_eval'
) AS
SELECT * EXCEPT (bucket), bucket >= 800 AS is_eval
FROM lab44.census
WHERE bucket < 40 OR bucket BETWEEN 800 AND 899;

SELECT 'training rows' AS scored_on, accuracy, roc_auc
FROM ML.EVALUATE(MODEL lab44.dropout_dnn, ${SMALL_TRAIN})
UNION ALL
SELECT 'validation rows', accuracy, roc_auc
FROM ML.EVALUATE(MODEL lab44.dropout_dnn, ${VALIDATION});`,
        check:
          'The gap between training and validation is much smaller than in the last step, and the validation score is the same or better. Training stopped well before 200 iterations.',
      },
      {
        title: 'Watch L1 switch weak features off',
        see: `«lab44» > **Models** shows «plain_logreg» and «l1_logreg». The results panel shows how many weights each one really uses.`,
        console: `1. Open **BigQuery** > **Studio** and click **+** (Compose a new query).
2. Paste the SQL below and click **Run**. Both models train in about a minute.`,
        body: 'Two logistic regressions on the full training split: one with no regularisation, one with a strong L1 penalty. L1 adds the absolute size of every weight to the loss, so the cheapest way to lower the loss is to set the weights of weak features to zero. You count the weights that still matter (bigger than 0.001) in each model.',
        concepts: [3],
        sql: `CREATE OR REPLACE MODEL lab44.plain_logreg
OPTIONS (model_type = 'LOGISTIC_REG', input_label_cols = ['label'],
  data_split_method = 'NO_SPLIT') AS
SELECT * EXCEPT (bucket) FROM lab44.census WHERE bucket < 800;

CREATE OR REPLACE MODEL lab44.l1_logreg
OPTIONS (model_type = 'LOGISTIC_REG', input_label_cols = ['label'],
  l1_reg = 5, data_split_method = 'NO_SPLIT') AS
SELECT * EXCEPT (bucket) FROM lab44.census WHERE bucket < 800;

SELECT 'no regularisation' AS model, COUNTIF(ABS(c.weight) > 0.001) AS weights_in_use
FROM ML.WEIGHTS(MODEL lab44.plain_logreg), UNNEST(category_weights) AS c
UNION ALL
SELECT 'L1 = 5', COUNTIF(ABS(c.weight) > 0.001)
FROM ML.WEIGHTS(MODEL lab44.l1_logreg), UNNEST(category_weights) AS c;`,
        check:
          'The L1 model uses clearly fewer category weights: many rare countries and occupations drop to zero. That is feature selection built into training, and a smaller model.',
      },
      {
        title: 'Read precision, recall and the threshold',
        see: `«plain_logreg» > **Evaluation** has a threshold slider. Move it and watch precision, recall and the confusion matrix change, exactly as in the queries.`,
        console: `1. Open **BigQuery** > **Studio** and click **+** (Compose a new query).
2. Paste the SQL below. Select each statement and click **Run**.
3. Open «plain_logreg» > **Evaluation** and move the threshold slider.`,
        body: 'The model gives a probability. The threshold turns it into a yes or a no. You score the validation rows at a low and a high threshold, then look at the four cells of the confusion matrix. Nothing is retrained: only the cut-off moves.',
        concepts: [4],
        sql: `SELECT 0.3 AS threshold, precision, recall, f1_score, accuracy
FROM ML.EVALUATE(MODEL lab44.plain_logreg, ${VALIDATION}, STRUCT(0.3 AS threshold))
UNION ALL
SELECT 0.7, precision, recall, f1_score, accuracy
FROM ML.EVALUATE(MODEL lab44.plain_logreg, ${VALIDATION}, STRUCT(0.7 AS threshold));

SELECT * FROM ML.CONFUSION_MATRIX(MODEL lab44.plain_logreg, ${VALIDATION}, STRUCT(0.5 AS threshold));

SELECT ROUND(threshold, 2) AS threshold, ROUND(recall, 3) AS recall,
  ROUND(false_positive_rate, 3) AS false_positive_rate
FROM ML.ROC_CURVE(MODEL lab44.plain_logreg, ${VALIDATION})
ORDER BY threshold;`,
        check:
          'At 0.3 recall is higher and precision lower than at 0.7. The confusion matrix shows where the mistakes are. Along the ROC curve, recall and the false positive rate rise together as the threshold falls.',
      },
      {
        title: 'Engineer features in a TRANSFORM, then test once',
        see: `«fe_logreg» > **Details** shows the TRANSFORM clause with the bucketised age, the feature cross and the scaled hours. **Evaluation** shows its ROC AUC.`,
        console: `1. Open **BigQuery** > **Studio** and click **+** (Compose a new query).
2. Paste the SQL below. Select each statement and click **Run**.`,
        body: 'Age has a non-linear effect, so you bucketise it into five quantiles. Education matters differently per occupation, so you cross them. Hours are scaled, and capital gain is log-transformed because it is very skewed. The TRANSFORM keeps these steps inside the model. The last query scores the final model on the **test** rows: the first and only time you look at them.',
        concepts: [5, 1],
        sql: `CREATE OR REPLACE MODEL lab44.fe_logreg
TRANSFORM (
  ML.QUANTILE_BUCKETIZE(age, 5) OVER () AS age_bucket,
  ML.FEATURE_CROSS(STRUCT(education, occupation)) AS education_x_occupation,
  ML.STANDARD_SCALER(hours_per_week) OVER () AS hours_scaled,
  LOG(1 + capital_gain) AS log_capital_gain,
  workclass, marital_status, relationship, sex,
  label
)
OPTIONS (model_type = 'LOGISTIC_REG', input_label_cols = ['label'],
  auto_class_weights = TRUE, data_split_method = 'NO_SPLIT') AS
SELECT * EXCEPT (bucket) FROM lab44.census WHERE bucket < 800;

SELECT 'plain features' AS model, roc_auc
FROM ML.EVALUATE(MODEL lab44.plain_logreg, ${VALIDATION})
UNION ALL
SELECT 'engineered features', roc_auc
FROM ML.EVALUATE(MODEL lab44.fe_logreg, ${VALIDATION});

SELECT 'test rows, once' AS scored_on, precision, recall, roc_auc
FROM ML.EVALUATE(MODEL lab44.fe_logreg,
  (SELECT * EXCEPT (bucket) FROM lab44.census WHERE bucket >= 900));`,
        check:
          'Both models score a ROC AUC of roughly 0.85 to 0.9 on validation. They are close, although the engineered model reads fewer raw columns: crosses and buckets carry the signal. The test score is close to the validation score, so the validation result was honest.',
      },
    ],
    cleanup: [
      {
        title: 'Delete the dataset',
        see: `The Explorer no longer lists «lab44».`,
        body: 'This deletes the table and all five models.',
        concepts: [],
        console:
          '1. In BigQuery Explorer, open the menu of «lab44» and click **Delete**. Type «delete» to confirm.',
        shell: 'bq rm -r -f -d lab44',
      },
    ],
    verify: `bq ls | grep lab44 || echo "No lab44 dataset left"`,
  },
  {
    station: 'vertex-ai',
    verifyConsole: `1. **BigQuery** > **Studio**: the Explorer lists no «lab45».
2. **Vertex AI** > **Model Registry**, region us-central1: no «lab45_mass».
3. **Vertex AI** > **Online prediction** > **Endpoints**: no «lab45_endpoint».`,
    title: 'Call an API, tune a model, register it and watch for skew',
    scenario:
      'Cymbal’s support team wants sentiment on rider messages, and the research team wants a penguin body-mass model in production. You use a pre-trained API for the first, then tune, register, serve and monitor the second, the way the exam expects.',
    minutes: 50,
    apis: ['bigquery.googleapis.com', 'language.googleapis.com', 'aiplatform.googleapis.com'],
    creates: [
      'BigQuery dataset «lab45» in the «US» multi-region, with two models and one table',
      'Vertex AI Model Registry entry «lab45_mass» in us-central1',
      'Optional: Vertex AI endpoint «lab45_endpoint» with one deployed model',
    ],
    cost: 'The Natural Language calls and the BigQuery ML models are free in practice: a few API units and a 344-row table. The optional endpoint is billed per hour while a model is deployed, about US$0.10 to 0.20 an hour for the smallest machine. Undeploy it as soon as you have tested it.',
    freeTier: [
      'The Natural Language API includes 5,000 free units each month for sentiment and entity analysis.',
      'BigQuery ML training on small tables stays far inside the monthly free tier.',
      'Skip the optional endpoint step to keep the lab at zero cost.',
    ],
    files: [
      {
        name: 'lab45-request.json',
        about: 'One penguin to send to the optional online endpoint.',
        content: REQUEST,
      },
    ],
    steps: [
      {
        title: 'Use a pre-trained API: no data, no training',
        see: `**APIs & Services** > **Enabled APIs & services** > **Cloud Natural Language API** > **Metrics** shows your requests a few minutes later.`,
        console: `1. The console has no page that sends text to the Natural Language API, so use Cloud Shell.
2. Click **Activate Cloud Shell** (the terminal icon at the top right).
3. Paste the commands from the **Cloud Shell** tab.`,
        body: 'Sentiment and entities are general tasks that Google already solves. Before anyone trains a model, an API call answers the question in a second. This is the first rung of the ladder: pre-trained API, then AutoML, then BigQuery ML or custom training.',
        concepts: [1],
        shell: `gcloud ml language analyze-sentiment \\
  --content="The driver was late and rude. The app refunded me in minutes, which was great."

gcloud ml language analyze-entities \\
  --content="Cymbal opened a new store in Berlin, next to the Brandenburg Gate."`,
        check:
          'The sentiment result scores each sentence: the first is negative, the second positive. The entities result finds Cymbal (an organisation), Berlin and the Brandenburg Gate (locations), each with a link to its Wikipedia page.',
      },
      {
        title: 'Tune hyperparameters with ten trials',
        see: `«lab45» > **Models** > «tuned_species» > **Training** lists the ten trials with their hyperparameters and scores, and marks the best one.`,
        console: `1. Open **BigQuery** > **Studio** and click **+** (Compose a new query).
2. Paste the SQL below and click **Run**. Ten trials take about 5 to 10 minutes.
3. Run the ML.TRIAL_INFO query.`,
        body: 'You do not guess the regularisation strength: you search for it. «NUM_TRIALS» runs ten trainings with different L1 and L2 values, and the tuner uses the results of earlier trials to choose the next values. Vertex AI hyperparameter tuning (Vizier) does the same for custom training jobs.',
        concepts: [2],
        sql: `CREATE SCHEMA IF NOT EXISTS lab45 OPTIONS (location = 'US');

CREATE OR REPLACE MODEL lab45.tuned_species
OPTIONS (
  model_type = 'LOGISTIC_REG',
  input_label_cols = ['species'],
  num_trials = 10,
  max_parallel_trials = 2,
  l1_reg = HPARAM_RANGE(0, 10),
  l2_reg = HPARAM_RANGE(0, 10),
  hparam_tuning_objectives = ['roc_auc']
) AS
SELECT species, island, culmen_length_mm, culmen_depth_mm, flipper_length_mm, body_mass_g
FROM ${PENGUINS}
WHERE body_mass_g IS NOT NULL;

SELECT trial_id, hyperparameters, hparam_tuning_evaluation_metrics, is_optimal
FROM ML.TRIAL_INFO(MODEL lab45.tuned_species)
ORDER BY trial_id;`,
        check:
          'Ten rows, one per trial, each with its own L1 and L2 values. One row has «is_optimal = true»: the model uses that trial by default for evaluation and prediction.',
      },
      {
        title: 'Register a model in Vertex AI and score in batch',
        see: `**Vertex AI** > **Model Registry**, region **us-central1**, lists «lab45_mass» with source **BigQuery**. «lab45.mass_scores» > **Preview** shows a prediction per penguin.`,
        console: `1. Open **BigQuery** > **Studio** and click **+** (Compose a new query).
2. Paste the SQL below. Select each statement and click **Run**.
3. Open **Vertex AI** > **Model Registry** and pick the region **us-central1**.`,
        body: '«MODEL_REGISTRY» puts the BigQuery ML model into the Vertex AI Model Registry, next to AutoML and custom models, with its versions. Nobody waits for these scores, so you score every penguin in one batch with «ML.PREDICT» into a table: no endpoint needed. «ML.EXPLAIN_PREDICT» adds the features that drove each prediction.',
        concepts: [3],
        sql: `CREATE OR REPLACE MODEL lab45.mass_model
OPTIONS (
  model_type = 'LINEAR_REG',
  input_label_cols = ['body_mass_g'],
  model_registry = 'VERTEX_AI',
  vertex_ai_model_id = 'lab45_mass'
) AS
SELECT species, island, sex, culmen_length_mm, culmen_depth_mm, flipper_length_mm, body_mass_g
FROM ${PENGUINS}
WHERE body_mass_g IS NOT NULL;

CREATE OR REPLACE TABLE lab45.mass_scores AS
SELECT species, island, sex, flipper_length_mm, ROUND(predicted_body_mass_g) AS predicted_g
FROM ML.PREDICT(MODEL lab45.mass_model,
  (SELECT * FROM ${PENGUINS} WHERE body_mass_g IS NOT NULL));

SELECT species, flipper_length_mm, ROUND(predicted_body_mass_g) AS predicted_g, top_feature_attributions
FROM ML.EXPLAIN_PREDICT(MODEL lab45.mass_model,
  (SELECT * FROM ${PENGUINS} WHERE body_mass_g IS NOT NULL LIMIT 5),
  STRUCT(3 AS top_k_features));`,
        check:
          '«lab45_mass» is in the Model Registry. «mass_scores» has about 340 rows. Each explained prediction lists its top three features, usually species and flipper length.',
      },
      {
        title: 'Optional: serve it online from an endpoint',
        see: `**Vertex AI** > **Online prediction** > **Endpoints** lists «lab45_endpoint» with one deployed model and a green status.`,
        console: `1. Open **Vertex AI** > **Model Registry** > «lab45_mass» > the latest version > **Deploy & test** > **Deploy to endpoint**.
2. **Create new endpoint**, name «lab45_endpoint», region **us-central1**. Traffic split 100%, minimum compute nodes 1, machine type the smallest offered (such as «n1-standard-2»). Click **Deploy**. It takes 5 to 15 minutes.
3. On the same **Deploy & test** tab, under **Test your model**, paste the content of the file «lab45-request.json» (in the lab’s files) and click **Predict**.
4. Then go straight to the cleanup: the endpoint costs money every hour it is deployed.`,
        body: 'An endpoint answers one request in milliseconds, for an app that waits for the answer. It keeps machines running between requests, which is why a nightly job uses batch prediction instead. In production you would deploy a new version beside the old one and split traffic, such as 90 and 10.',
        concepts: [3],
        shell: `ENDPOINT_ID=$(gcloud ai endpoints list --region=us-central1 \\
  --filter="display_name=lab45_endpoint" --format="value(name)")
gcloud ai endpoints predict $ENDPOINT_ID --region=us-central1 \\
  --json-request=lab45-request.json`,
        check:
          'The endpoint returns a predicted body mass of roughly 5,500 to 6,000 grams within a second.',
      },
      {
        title: 'Detect training-serving skew and drift',
        see: `The results panel shows one row per feature with its distance from the training data and an «is_anomaly» column.`,
        console: `1. Open **BigQuery** > **Studio** and click **+** (Compose a new query).
2. Paste the SQL below. Select each statement and click **Run**.`,
        body: 'You simulate a bug in a serving app: flipper length now arrives 30% too large. «ML.VALIDATE_DATA_SKEW» compares the serving data with the statistics the model saved from its training data. «ML.VALIDATE_DATA_DRIFT» compares two serving datasets with each other. Vertex AI Model Monitoring does both automatically for an endpoint.',
        concepts: [4],
        sql: `CREATE OR REPLACE TABLE lab45.serving_week AS
SELECT species, island, sex, culmen_length_mm, culmen_depth_mm,
  flipper_length_mm * 1.3 AS flipper_length_mm
FROM ${PENGUINS}
WHERE body_mass_g IS NOT NULL;

SELECT input, metric, threshold, ROUND(value, 3) AS value, is_anomaly
FROM ML.VALIDATE_DATA_SKEW(MODEL lab45.mass_model, TABLE lab45.serving_week);

SELECT input, metric, threshold, ROUND(value, 3) AS value, is_anomaly
FROM ML.VALIDATE_DATA_DRIFT(
  (SELECT species, island, sex, culmen_length_mm, culmen_depth_mm, flipper_length_mm
   FROM ${PENGUINS} WHERE body_mass_g IS NOT NULL),
  TABLE lab45.serving_week);`,
        check:
          'Only «flipper_length_mm» has «is_anomaly = true». In production, this alert would start the retraining pipeline, or, as here, send you to fix the app that computes the feature.',
      },
    ],
    cleanup: [
      {
        title: 'Undeploy the model and delete the endpoint',
        see: `**Vertex AI** > **Online prediction** > **Endpoints** lists no «lab45_endpoint».`,
        body: 'Skip this if you did not do the optional endpoint step. An endpoint with a deployed model is billed every hour, even with no traffic.',
        concepts: [],
        console:
          '1. Open **Vertex AI** > **Online prediction** > **Endpoints**, region **us-central1**, and click «lab45_endpoint».\n2. On the deployed model row, open the menu and click **Undeploy model from endpoint**.\n3. Go back to the endpoint list, open the menu of «lab45_endpoint» and click **Delete endpoint**.',
        shell: `ENDPOINT_ID=$(gcloud ai endpoints list --region=us-central1 \\
  --filter="display_name=lab45_endpoint" --format="value(name)")
DEPLOYED_ID=$(gcloud ai endpoints describe $ENDPOINT_ID --region=us-central1 \\
  --format="value(deployedModels[0].id)")
gcloud ai endpoints undeploy-model $ENDPOINT_ID --region=us-central1 --deployed-model-id=$DEPLOYED_ID
gcloud ai endpoints delete $ENDPOINT_ID --region=us-central1 --quiet`,
      },
      {
        title: 'Delete the dataset and the registry entry',
        see: `The Explorer no longer lists «lab45», and **Vertex AI** > **Model Registry** shows no «lab45_mass».`,
        body: 'Deleting the dataset deletes both BigQuery ML models and the tables. Then remove the registry entry if it is still listed.',
        concepts: [],
        console:
          '1. In BigQuery Explorer, open the menu of «lab45» and click **Delete**. Type «delete» to confirm.\n2. Open **Vertex AI** > **Model Registry**, region **us-central1**. If «lab45_mass» is still listed, open its menu and click **Delete model**.',
        shell: `bq rm -r -f -d lab45
MODEL_ID=$(gcloud ai models list --region=us-central1 \\
  --filter="display_name=lab45_mass" --format="value(name)")
if [ -n "$MODEL_ID" ]; then gcloud ai models delete $MODEL_ID --region=us-central1 --quiet; fi`,
      },
    ],
    verify: `bq ls | grep lab45 || echo "No lab45 dataset left"
gcloud ai models list --region=us-central1 --filter="display_name=lab45_mass" --format="value(name)" | grep . || echo "No lab45 model left"
gcloud ai endpoints list --region=us-central1 --filter="display_name=lab45_endpoint" --format="value(name)" | grep . || echo "No lab45 endpoint left"`,
  },
];
