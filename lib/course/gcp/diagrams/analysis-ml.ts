/**
 * Diagrams for stations 4.4 (ML fundamentals) and 4.5 (ML on Google Cloud).
 * Keyed by station slug; each diagram names the concept it explains. See
 * lib/course/gcp/README.md > Diagrams.
 */

import type { GcpDiagram } from '@/types/gcp';

export const DIAGRAMS: Readonly<Record<string, readonly GcpDiagram[]>> = {
  'ml-fundamentals': [
    {
      concept: 1,
      kind: 'flow',
      title: 'Three splits, three jobs',
      scenario:
        'Cymbal has 100,000 labelled customers and wants an honest answer to one question: how well will the churn model do on customers it has never seen? Each split of the data does one job.',
      steps: [
        {
          n: 1,
          icon: 'table',
          label: 'All labelled rows',
          note: 'Split by a hash of the customer id, so the split never changes.',
          tone: 'plain',
          chips: ['FARM_FINGERPRINT'],
        },
        {
          n: 2,
          icon: 'brain',
          label: 'Training set (80%)',
          note: 'The model learns its weights here.',
          tone: 'sky',
        },
        {
          n: 3,
          icon: 'chart',
          label: 'Validation set (10%)',
          note: 'Compare models and tune hyperparameters here.',
          tone: 'iris',
        },
        {
          n: 4,
          icon: 'lock',
          label: 'Test set (10%)',
          note: 'Looked at once, at the end. The honest score.',
          tone: 'brand',
        },
      ],
      edges: ['learn', 'tune', 'report'],
      walk: [
        'Hash a stable key, so every customer always lands in the same split and no customer appears in two splits.',
        'The model sees only the training rows while it learns its weights.',
        'You try settings (layers, regularisation, learning rate) and keep the one with the best validation score.',
        'You score the chosen model on the test set once. If you tune on the test set, its score stops being honest.',
      ],
      caption:
        'Tune on validation, report on test. Any feature the model will not have at prediction time is leakage: remove it, however good the test score looks.',
    },
    {
      concept: 1,
      kind: 'timeline',
      title: 'Split time series by time, never at random',
      scenario:
        'Cymbal forecasts weekly demand from three years of sales. A random split scores brilliantly in the notebook and fails in production. The timeline shows why.',
      axis: { start: '2023', end: 'today' },
      lanes: [
        {
          label: '1. Random split',
          spans: [{ start: 0, end: 100, label: 'train', tone: 'sky' }],
          dots: [
            { at: 18, tone: 'hard' },
            { at: 41, tone: 'hard' },
            { at: 63, tone: 'hard' },
            { at: 86, tone: 'hard' },
          ],
        },
        {
          label: '2. Split by time',
          spans: [
            { start: 0, end: 80, label: 'train', tone: 'sky' },
            { start: 80, end: 100, label: 'test', tone: 'easy' },
          ],
        },
      ],
      marks: [{ at: 80, label: 'cut-off date' }],
      walk: [
        'A random split scatters test days (red dots) between training days. The model trains on the days after each test day, so it has seen the future.',
        'A split by time trains on everything before a cut-off date and tests on the weeks after it. That is exactly what production will ask.',
      ],
      caption:
        'For time series, train on the past and test on the future. A random split leaks the future and gives a score you will never see in production.',
    },
    {
      concept: 2,
      kind: 'compare',
      title: 'Underfit, good fit, overfit: read the gap',
      scenario:
        'Three versions of Cymbal’s churn model give three pairs of scores. You do not need to see the code: the training score and the validation score together tell you what is wrong.',
      columns: [
        {
          n: 1,
          icon: 'warning',
          label: 'Underfit',
          note: 'Training 62%, validation 61%.',
          tone: 'medium',
          chips: ['high bias'],
          points: [
            'Too simple to learn the pattern.',
            'Add features or a more complex model.',
            'Train longer, or reduce regularisation.',
          ],
        },
        {
          n: 2,
          icon: 'chart',
          label: 'Good fit',
          note: 'Training 91%, validation 90%.',
          tone: 'easy',
          points: ['Small gap, good score.', 'Now check the test set, once.'],
        },
        {
          n: 3,
          icon: 'warning',
          label: 'Overfit',
          note: 'Training 99%, validation 71%.',
          tone: 'hard',
          chips: ['high variance'],
          points: [
            'Memorised the training rows, noise included.',
            'Add dropout or L1/L2, stop earlier.',
            'Get more data, or use a simpler model.',
          ],
        },
      ],
      walk: [
        'Both scores are low and close: the model cannot even learn the training data. It needs more power.',
        'Both scores are high and close: the model learned the rule, not the rows.',
        'The training score is far above the validation score: the model memorised. Make memorising harder.',
      ],
      caption:
        'Overfitting is a gap, underfitting is a low ceiling. More layers or more epochs fix underfitting and make overfitting worse.',
    },
    {
      concept: 2,
      kind: 'timeline',
      title: 'Learning curves show where overfitting starts',
      scenario:
        'You train a deep network on Cymbal’s churn data for 50 epochs and plot the loss on both sets after each epoch. Lower loss is better. Watch the validation line.',
      axis: { start: 'epoch 1', end: 'epoch 50' },
      marks: [{ at: 40, label: 'best epoch: stop here' }],
      lanes: [
        {
          label: '1. Training loss',
          spans: [{ start: 0, end: 100, label: 'keeps falling', tone: 'sky' }],
        },
        {
          label: '2. Validation loss',
          spans: [
            { start: 0, end: 40, label: 'falls', tone: 'easy' },
            { start: 40, end: 100, label: 'rises', tone: 'hard' },
          ],
        },
      ],
      walk: [
        'The training loss falls at every epoch, because the model gets better and better at the rows it sees.',
        'The validation loss falls until epoch 20, then rises. From that epoch the model learns noise that does not carry over to new customers.',
      ],
      caption:
        'Early stopping watches the validation loss and keeps the weights from the best epoch. Training for more epochs past that point only makes overfitting worse.',
    },
    {
      concept: 3,
      kind: 'compare',
      title: 'Four ways to stop a model from memorising',
      scenario:
        'Cymbal’s churn model overfits. Four standard fixes work in different ways. The exam names a symptom and expects the fix that matches it.',
      columns: [
        {
          n: 1,
          icon: 'brain',
          label: 'Dropout',
          note: 'Neural networks.',
          tone: 'brand',
          chips: ['DROPOUT'],
          points: [
            'In training, switches off a random 20 to 50% of neurons each step.',
            'No neuron can rely on another one.',
            'At prediction, every neuron is on.',
          ],
        },
        {
          n: 2,
          icon: 'layers',
          label: 'L1 (lasso)',
          note: 'Many features.',
          tone: 'iris',
          chips: ['L1_REG'],
          points: [
            'Adds the absolute weights to the loss.',
            'Weak features get a weight of exactly zero.',
            'A sparse model: built-in feature selection.',
          ],
        },
        {
          n: 3,
          icon: 'chart',
          label: 'L2 (ridge)',
          note: 'The default.',
          tone: 'sky',
          chips: ['L2_REG'],
          points: [
            'Adds the squared weights to the loss.',
            'All weights stay small; none become zero.',
            'Keeps every feature.',
          ],
        },
        {
          n: 4,
          icon: 'clock',
          label: 'Early stopping',
          note: 'Many epochs.',
          tone: 'teal',
          chips: ['EARLY_STOP'],
          points: [
            'Watches the validation loss.',
            'Stops when it no longer improves.',
            'Keeps the best weights.',
          ],
        },
      ],
      walk: [
        'Dropout is the answer when a large neural network fits the training data but fails on new data.',
        'L1 is the answer when you want fewer features and a smaller model.',
        'L2 is the general answer when weights grow large and you want to keep every feature.',
        'Early stopping is the answer when the validation score gets worse after a certain epoch.',
      ],
      caption:
        'Threading, serialization, GPUs and a bigger machine change speed, not accuracy. More layers and more epochs make overfitting worse.',
    },
    {
      concept: 3,
      kind: 'flow',
      title: 'Dropout, one training step at a time',
      scenario:
        'A hidden layer of Cymbal’s network has ten neurons and a dropout rate of 0.3. Each training step switches off a different random three of them. At prediction time all ten work together.',
      steps: [
        {
          n: 1,
          icon: 'brain',
          label: 'Training step 1',
          note: 'Neurons 2, 5 and 9 are off.',
          tone: 'iris',
        },
        {
          n: 2,
          icon: 'brain',
          label: 'Training step 2',
          note: 'Neurons 1, 4 and 7 are off.',
          tone: 'iris',
        },
        {
          n: 3,
          icon: 'refresh',
          label: 'Thousands of steps',
          note: 'Every neuron learns to be useful on its own.',
          tone: 'sky',
        },
        {
          n: 4,
          icon: 'chart',
          label: 'Prediction',
          note: 'Dropout is off. All ten neurons are used.',
          tone: 'brand',
        },
      ],
      edges: ['new random set', 'repeat', 'serve'],
      walk: [
        'With three neurons missing, the others must still produce a good answer, so no single neuron can memorise a training row.',
        'The next step removes a different three, so the network cannot build a fragile chain of neurons that depend on each other.',
        'After many steps the network has learned redundant, general patterns. It behaves like an average of many smaller networks.',
        'At prediction time dropout is switched off and the outputs are scaled, so the full network gives stable answers.',
      ],
      caption:
        'Dropout works only during training. Typical rates are 0.2 to 0.5. A higher rate regularises more, and too high a rate makes the model underfit.',
    },
    {
      concept: 4,
      kind: 'grid',
      title: 'The confusion matrix: two right, two wrong',
      scenario:
        'Cymbal’s fraud model scores 10,000 card payments. Every prediction lands in one of four cells. Precision and recall are just ratios of these cells.',
      columns: ['Predicted fraud', 'Predicted fine'],
      rows: ['Actually fraud', 'Actually fine'],
      read: [
        [0, 0],
        [1, 1],
      ],
      legend: { read: 'right (TP, TN)', skipped: 'wrong (FN, FP)' },
      walk: [
        'Top left: fraud caught (true positive). Bottom right: a fine payment left alone (true negative).',
        'Top right: fraud missed (false negative). Recall counts these misses. Bottom left: a good customer blocked (false positive). Precision counts these false alarms.',
      ],
      caption:
        'Precision = TP / (TP + FP): of the alarms, how many were real. Recall = TP / (TP + FN): of the real cases, how many you caught.',
    },
    {
      concept: 4,
      kind: 'decision',
      title: 'Which metric should you watch?',
      scenario:
        'Every team at Cymbal reports a different number. The right metric depends on what you predict and which mistake costs the most. Ask these questions in order.',
      questions: [
        {
          ask: 'Do you predict a number, such as a price or demand?',
          yes: {
            icon: 'chart',
            label: 'RMSE or MAE',
            note: 'RMSE punishes big errors more. MAE is easier to explain.',
            tone: 'sky',
          },
        },
        {
          ask: 'Are the positives rare, such as fraud at 0.1%?',
          yes: {
            icon: 'warning',
            label: 'PR AUC, recall, precision',
            note: 'Accuracy and ROC AUC look too good here.',
            tone: 'hard',
          },
        },
        {
          ask: 'Is a missed case the costly mistake, such as a disease?',
          yes: {
            icon: 'search',
            label: 'Recall',
            note: 'Lower the threshold to catch more.',
            tone: 'iris',
          },
        },
        {
          ask: 'Is a false alarm the costly mistake, such as blocking a good customer?',
          yes: {
            icon: 'shield',
            label: 'Precision',
            note: 'Raise the threshold to alarm less.',
            tone: 'gold',
          },
        },
      ],
      otherwise: {
        icon: 'chart',
        label: 'F1 or ROC AUC',
        note: 'Balanced classes and balanced costs.',
        tone: 'brand',
      },
      walk: [
        'Regression has its own metrics: RMSE, MAE and R squared.',
        'With rare positives, a model that always says no is 99.9% accurate. Watch PR AUC, recall and precision.',
        'When a miss is dangerous, maximise recall.',
        'When a false alarm is expensive, maximise precision.',
      ],
      caption:
        'The threshold trades precision against recall without retraining. Accuracy is the right metric only when the classes are balanced.',
    },
    {
      concept: 5,
      kind: 'pairs',
      title: 'Raw column in, useful feature out',
      scenario:
        'Cymbal’s taxi team predicts trip fares from raw columns. Each raw column needs a different transformation before a model can learn from it.',
      left: 'Raw column',
      right: 'Transformation',
      pairs: [
        ['Pickup latitude and longitude', 'Bucketise, then feature cross', 'layers'],
        ['Trip distance (0.1 to 300 km)', 'Log, then standard scaler', 'chart'],
        ['Payment type: card, cash, wallet', 'One-hot encoding', 'table'],
        ['Driver id (2 million values)', 'Embedding or hash buckets', 'users'],
        ['Tip amount, sometimes null', 'Impute, plus a missing flag', 'warning'],
        ['Pickup timestamp', 'Hour and weekday', 'clock'],
      ],
      walk: [
        'One latitude means little. The cross of a latitude bucket and a longitude bucket is a place, and fares depend on places.',
        'Distance is skewed: a log stops long trips from dominating, and scaling helps gradient descent converge.',
        'A small set of categories becomes one 0 or 1 column per value. Never number them 1, 2, 3.',
        'Two million ids would be two million columns. An embedding or hash buckets compress them.',
        'Most models cannot read nulls. Fill them, and keep a flag in case missing itself means something.',
        'A raw timestamp never repeats. The hour and the weekday do, so the model can learn rush hour.',
      ],
      caption:
        'Put these steps in the BigQuery ML TRANSFORM clause, so prediction applies them exactly as training did. That prevents training-serving skew.',
    },
  ],
  'vertex-ai': [
    {
      concept: 1,
      kind: 'decision',
      title: 'Which ML tool on Google Cloud?',
      scenario:
        'Five teams at Cymbal want ML this quarter. Ask these questions in order. The first yes is the tool with the least effort that still meets the need.',
      questions: [
        {
          ask: 'Does a pre-trained API already do the task (OCR, sentiment, speech, translation)?',
          yes: {
            icon: 'apis',
            label: 'Pre-trained API',
            note: 'No data and no training. Call it.',
            tone: 'easy',
            chips: ['Vision', 'Natural Language', 'Document AI'],
          },
        },
        {
          ask: 'Is the task to generate, summarise or extract from free text and images?',
          yes: {
            icon: 'vertex-ai',
            label: 'Gemini in Vertex AI',
            note: 'A prompt, maybe a few examples.',
            tone: 'sky',
          },
        },
        {
          ask: 'Is the data in BigQuery and the team SQL-first?',
          yes: {
            icon: 'bigquery',
            label: 'BigQuery ML',
            note: 'CREATE MODEL in SQL, no data export.',
            tone: 'iris',
          },
        },
        {
          ask: 'Are the labels your own, with no ML engineers to write models?',
          yes: {
            icon: 'automl',
            label: 'AutoML',
            note: 'Bring labelled examples, Google trains.',
            tone: 'gold',
          },
        },
      ],
      otherwise: {
        icon: 'code',
        label: 'Custom training',
        note: 'Your TensorFlow, PyTorch or XGBoost code on Vertex AI.',
        tone: 'brand',
      },
      walk: [
        'Reading invoices, detecting sentiment and transcribing calls are solved problems. Use the API.',
        'Generative tasks go to Gemini, through Vertex AI.',
        'A SQL team with data in BigQuery trains there with BigQuery ML.',
        'Cymbal’s own product categories need its own labelled photos: AutoML learns them without code.',
      ],
      caption:
        'On the exam, the least effort that meets the requirement wins. A custom model for a task an API already does is the classic wrong answer.',
    },
    {
      concept: 1,
      kind: 'pairs',
      title: 'The pre-trained APIs, by need',
      scenario:
        'Before anyone at Cymbal trains a model, check this list. Each need on the left is already solved by a Google API on the right, with no training data.',
      left: 'Need',
      right: 'API',
      pairs: [
        ['Labels, objects and text in photos', 'Cloud Vision API', 'apis'],
        ['Sentiment and entities in reviews', 'Natural Language API', 'natural-language'],
        ['Fields from invoices and receipts', 'Document AI', 'document-ai'],
        ['Translate chats, keep product names', 'Translation API + glossary', 'globe'],
        ['Transcribe support calls', 'Speech-to-Text', 'device'],
        ['A support chatbot', 'Dialogflow CX', 'users'],
      ],
      walk: [
        'Vision reads photos: labels, objects, faces, printed and handwritten text.',
        'Natural Language reads text: sentiment, entities and categories.',
        'Document AI understands the layout of forms, so it returns named fields, not just text.',
        'Translation Advanced takes a glossary, so brand and product names are never translated.',
        'Speech-to-Text turns audio into text, with speaker labels for calls.',
        'Dialogflow CX builds chat and voice agents with flows and intents.',
      ],
      caption:
        'Video Intelligence is the video twin of Vision. Retail recommendations come from Vertex AI Search for commerce, formerly Recommendations AI.',
    },
    {
      concept: 2,
      kind: 'spectrum',
      title: 'CPU, GPU or TPU for training?',
      scenario:
        'Cymbal trains three models: a small linear churn model, an image classifier with a custom layer, and a very large recommendation network that takes weeks on GPUs.',
      from: 'Small and simple',
      to: 'Huge and matrix-heavy',
      stops: [
        {
          n: 1,
          icon: 'compute-engine',
          label: 'CPU',
          note: 'Small models, linear models, data preparation.',
          tone: 'plain',
        },
        {
          n: 2,
          icon: 'server',
          label: 'GPU',
          note: 'Most deep learning, custom operations, PyTorch.',
          tone: 'sky',
        },
        {
          n: 3,
          icon: 'spark',
          label: 'TPU',
          note: 'Huge matrix multiplications, weeks of training, TensorFlow or JAX.',
          tone: 'brand',
        },
      ],
      walk: [
        'A linear model on a few million rows trains in minutes on CPUs. An accelerator adds cost and no speed.',
        'GPUs speed up most neural networks and support custom operations written for them.',
        'TPUs are built for large matrix multiplications. A model that takes weeks on GPUs can take days on TPUs.',
      ],
      caption:
        'If the accelerator sits idle, the input pipeline is the bottleneck: use TFRecord files and tf.data with parallel reads and prefetch.',
    },
    {
      concept: 2,
      kind: 'flow',
      title: 'Hyperparameter tuning on Vertex AI',
      scenario:
        'Cymbal’s churn network has a learning rate, a dropout rate and a layer count to choose. Trying every combination would take months. Vertex AI tunes them for you.',
      steps: [
        {
          n: 1,
          icon: 'file',
          label: 'Define the study',
          note: 'Metric and goal (maximise AUC), the ranges, the number of trials.',
          tone: 'plain',
        },
        {
          n: 2,
          icon: 'vertex-ai',
          label: 'Run trials',
          note: 'Each trial trains the model with one set of values.',
          tone: 'sky',
        },
        {
          n: 3,
          icon: 'brain',
          label: 'Vizier picks next',
          note: 'Bayesian optimisation learns from past trials.',
          tone: 'iris',
        },
        {
          n: 4,
          icon: 'chart',
          label: 'Best trial',
          note: 'The values with the best validation metric.',
          tone: 'brand',
        },
      ],
      edges: ['start', 'report the metric', 'after N trials'],
      walk: [
        'You name the metric to optimise, the range of each hyperparameter and how many trials to run.',
        'Each trial is a full training run that reports its validation metric.',
        'Vizier uses the results so far to pick promising values, so it needs fewer trials than a grid search.',
        'You keep the best values and train the final model with them.',
      ],
      caption:
        'More parallel trials finish sooner but each one learns less from the others. In BigQuery ML, set NUM_TRIALS and read ML.TRIAL_INFO.',
    },
    {
      concept: 3,
      kind: 'compare',
      title: 'Online endpoint or batch prediction?',
      scenario:
        'Cymbal needs a fraud score at checkout in under 100 ms, and a churn score for every customer each night. The same model registry serves both, in different ways.',
      columns: [
        {
          n: 1,
          icon: 'vertex-ai',
          label: 'Online endpoint',
          note: 'One request, milliseconds.',
          tone: 'sky',
          points: [
            'Live requests from an app.',
            'Autoscaling replicas.',
            'You pay while it is deployed.',
            'Traffic split for canary or A/B.',
          ],
        },
        {
          n: 2,
          icon: 'table',
          label: 'Batch prediction',
          note: 'Millions of rows, no rush.',
          tone: 'easy',
          points: [
            'Reads and writes BigQuery or Cloud Storage.',
            'Machines start, score and stop.',
            'No endpoint to keep running.',
          ],
        },
        {
          n: 3,
          icon: 'bigquery',
          label: 'ML.PREDICT in SQL',
          note: 'BigQuery ML models.',
          tone: 'iris',
          points: ['Scores where the data lives.', 'Runs as a scheduled query.'],
        },
      ],
      walk: [
        'The checkout calls an endpoint and gets a score in milliseconds.',
        'The nightly churn job runs a batch prediction job over the whole customer table.',
        'A BigQuery ML model scores with plain SQL, with no serving infrastructure at all.',
      ],
      caption:
        'An always-on endpoint for a nightly job is the classic waste. Use batch prediction when nobody waits for the answer.',
    },
    {
      concept: 3,
      kind: 'hub',
      title: 'Vertex AI Feature Store: one source of features',
      scenario:
        'Three Cymbal teams each computed “orders in the last 30 days” in their own way, and the fraud model saw a different number in production than in training.',
      center: {
        icon: 'database',
        label: 'Feature Store',
        note: 'Feature values stored in BigQuery, served online.',
        tone: 'brand',
      },
      spokes: [
        {
          n: 1,
          icon: 'dataflow',
          label: 'Feature pipelines',
          note: 'Compute each feature once.',
          tone: 'sky',
        },
        {
          n: 2,
          icon: 'brain',
          label: 'Training',
          note: 'Point-in-time values, no future leaks in.',
          tone: 'iris',
        },
        {
          n: 3,
          icon: 'vertex-ai',
          label: 'Online serving',
          note: 'Latest values in milliseconds.',
          tone: 'teal',
        },
        {
          n: 4,
          icon: 'users',
          label: 'Other teams',
          note: 'Find and reuse features.',
          tone: 'gold',
        },
      ],
      walk: [
        'A pipeline computes each feature once and writes it to the store.',
        'Training reads the value each feature had at the time of each label, so no future data leaks in.',
        'The live model reads the latest values with low latency.',
        'Other teams reuse the same definitions instead of writing their own.',
      ],
      caption:
        'Same features in training and serving means no training-serving skew. That is the exam reason to pick a feature store.',
    },
    {
      concept: 4,
      kind: 'flow',
      title: 'A continuous training pipeline',
      scenario:
        'Cymbal’s churn model gets worse every quarter as customers change. Vertex AI Pipelines retrains it automatically and deploys a new version only when it is better.',
      steps: [
        {
          n: 1,
          icon: 'monitoring',
          label: 'Trigger',
          note: 'A drift alert or a schedule.',
          tone: 'gold',
        },
        {
          n: 2,
          icon: 'shield',
          label: 'Validate data',
          note: 'Bad data stops the run here.',
          tone: 'plain',
        },
        {
          n: 3,
          icon: 'brain',
          label: 'Train',
          note: 'On existing and new data.',
          tone: 'sky',
        },
        {
          n: 4,
          icon: 'chart',
          label: 'Evaluate',
          note: 'Against the model in production.',
          tone: 'iris',
        },
        {
          n: 5,
          icon: 'vertex-ai',
          label: 'Deploy',
          note: 'Traffic split, then all traffic.',
          tone: 'brand',
        },
      ],
      edges: ['start run', 'clean data', 'candidate', 'only if better'],
      walk: [
        'Model Monitoring sees the inputs drift, or the weekly schedule fires.',
        'The pipeline checks the schema and the ranges of the new data first.',
        'It trains on old and new data together, so the model does not forget older patterns.',
        'The candidate must beat the current model on the same held-out data.',
        'A canary traffic split sends a small share to the new version before the full switch.',
      ],
      caption:
        'Pipelines are written with Kubeflow Pipelines or TFX and record every artefact. Retraining only on the newest data is the classic trap.',
    },
    {
      concept: 4,
      kind: 'compare',
      title: 'Skew, drift and concept drift',
      scenario:
        'Cymbal’s fraud model is slipping. Three different problems can cause it, and each one is caught in a different way.',
      columns: [
        {
          n: 1,
          icon: 'warning',
          label: 'Training-serving skew',
          note: 'Serving data differs from training data.',
          tone: 'hard',
          points: [
            'A feature computed differently in the app.',
            'Fix: TRANSFORM or a feature store.',
          ],
        },
        {
          n: 2,
          icon: 'stream',
          label: 'Data drift',
          note: 'Serving inputs change over time.',
          tone: 'medium',
          points: ['A new market, a new customer mix.', 'Fix: monitor, then retrain.'],
        },
        {
          n: 3,
          icon: 'refresh',
          label: 'Concept drift',
          note: 'The rule itself changes.',
          tone: 'iris',
          points: ['Fraudsters change tactics.', 'Fix: fresh labels, retrain often.'],
        },
      ],
      walk: [
        'Skew compares serving data with the training data. Model Monitoring and ML.VALIDATE_DATA_SKEW detect it.',
        'Drift compares serving data now with serving data earlier. Model Monitoring and ML.VALIDATE_DATA_DRIFT detect it.',
        'Concept drift shows only in falling accuracy once the true labels arrive.',
      ],
      caption:
        'Monitoring tells you when to retrain. A pipeline makes retraining safe and repeatable.',
    },
  ],
};
