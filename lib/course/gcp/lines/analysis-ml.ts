/**
 * GCP course, line 4, stations 4.4 and 4.5: the machine learning the exam
 * still asks about.
 *
 * The current exam guide names only "preparing data for AI and ML" (4.2). The
 * question banks that learners practise with are older, and they ask about
 * overfitting, dropout, metrics, feature engineering, the pre-trained APIs and
 * Vertex AI. These two stations teach that material from first principles.
 * See lib/course/gcp/README.md for the rules.
 */

import type { GcpStation } from '@/types/gcp';

export const ML_STATIONS: readonly GcpStation[] = [
  {
    slug: 'ml-fundamentals',
    code: '4.4',
    title: 'ML fundamentals: models that work on new data',
    mission:
      'Cymbal’s churn model scored 99% in the notebook and 70% in production. The data science lead is on leave, and the exam asks you exactly this kind of question. Find out why the model fails on new customers, fix it, and prove the fix with the right metric.',
    concepts: [
      {
        title: 'How a model learns: data splits, loss and training',
        body: 'A model is a function with many adjustable numbers (**weights**). Training repeats one loop: predict, measure the error with a **loss function**, and move every weight a little in the direction that lowers the loss (**gradient descent**).\n\n| Term | What it means | Exam signal |\n|---|---|---|\n| **Learning rate** | How big each weight step is | Too high: the loss jumps around or grows. Too low: training is very slow |\n| **Epoch** | One full pass over the training data | More epochs can lead to overfitting |\n| **Batch size** | Rows used for one weight update | Bigger batches use more memory and give smoother steps |\n| **Hyperparameter** | A setting you choose before training (learning rate, layers, regularisation) | Tune it on the validation set, not the test set |\n\n### Three splits, three jobs\n\n- **Training set** (often 70 to 80%): the model learns the weights from it.\n- **Validation set** (10 to 15%): you compare models and tune hyperparameters on it.\n- **Test set** (10 to 15%): you look at it **once**, at the end, for an honest score. If you tune on it, the score is no longer honest.\n- With little data, use **k-fold cross-validation**: train k times, each time holding out a different fold.\n- Split **time series by time** (train on the past, test on the future), never at random. A random split lets the model see the future.\n- Split **by entity** when rows repeat (all rows of one customer go to the same split). Hash a stable key, such as «FARM_FINGERPRINT(customer_id)», so the split never changes between runs.\n\n> [!trap] Data leakage\n> A feature that is only known after the outcome (for example «refund_issued» when you predict fraud) gives a great test score and a useless model. Remove any feature that the model will not have at prediction time.',
      },
      {
        title: 'Overfitting and underfitting: read the gap',
        body: "Compare the score on the **training** data with the score on the **validation** data. The size of the gap tells you the problem.\n\n| Training score | Validation score | Diagnosis | Also called |\n|---|---|---|---|\n| High | Much lower | **Overfitting**: the model memorised the training rows, noise included | High variance |\n| Low | Low (about the same) | **Underfitting**: the model is too simple to learn the pattern | High bias |\n| High | High, close to training | A good fit | — |\n\n- **Why overfitting happens:** the model has more capacity (layers, neurons, deep trees, many features) than the data can support. It learns facts about individual rows, not the general rule.\n- **Learning curves:** plot the training loss and the validation loss per epoch. When the validation loss stops falling and starts to rise while the training loss keeps falling, the model starts to overfit at that epoch.\n- **Fix underfitting** with more power: more or better features, a more complex model, more training, less regularisation.\n- **Fix overfitting** with the toolbox in the next concept: regularisation, dropout, early stopping, more data, fewer features or a simpler model.\n\n> [!example] The classic exam question\n> 'A TensorFlow model with many layers and neurons fits the training data well but performs poorly on new data.' This is overfitting in a large neural network. The answer is **dropout** (or regularisation). Threading and serialization are about speed and storage, not accuracy. Dimensionality reduction removes input features, but the problem here is the size of the network, not the number of inputs.",
      },
      {
        title: 'The overfitting toolbox: L1, L2, dropout and early stopping',
        body: "Every fix makes it harder for the model to memorise.\n\n| Technique | How it works | Pick it when |\n|---|---|---|\n| **L2 regularisation** (ridge, weight decay) | Adds the sum of the **squared** weights to the loss. Large weights cost more, so all weights stay small and smooth | The default for overfitting. You want to keep every feature |\n| **L1 regularisation** (lasso) | Adds the sum of the **absolute** weights to the loss. It pushes the weights of weak features to **exactly zero** | You have many features and want the model to **select** a few. The result is a sparse, smaller model |\n| **Dropout** | During **training only**, each step switches off a random share of the neurons in a layer (a rate of 0.2 to 0.5). No neuron can rely on another, so the network learns redundant, general patterns. At prediction time every neuron is on | A **neural network** with many layers and neurons overfits |\n| **Early stopping** | Watches the validation loss and stops training when it stops improving | Training for many epochs makes the validation score worse |\n| **More training data** or data augmentation | More examples make memorising harder. Augmentation makes new examples from old ones (flip or crop an image) | Data is cheap to get, or images and audio |\n| **Simpler model, fewer features** | Fewer layers, shallower trees, drop noisy features | The model is far bigger than the problem |\n\n- The **regularisation strength** (lambda) is a hyperparameter. Too much regularisation causes underfitting.\n- **Ensembles** (random forest, boosted trees with subsampling) also reduce variance.\n- **Batch normalisation** mainly speeds up and stabilises deep network training. It has only a small regularising effect, so it is rarely the best answer to an overfitting question.\n- In BigQuery ML the options are «L1_REG», «L2_REG», «DROPOUT» (for «DNN_*» models), «EARLY_STOP» and «MIN_REL_PROGRESS».\n\n### Keyword signals\n\n| When the question says | Think |\n|---|---|\n| 'deep network, many layers and neurons, poor on new data' | Dropout |\n| 'many features, keep only the important ones, smaller model' | L1 |\n| 'large weights, overfitting, keep all features' | L2 |\n| 'validation loss rises after epoch N' | Early stopping |\n| 'training and test both poor' | Underfitting: more features or a more complex model |\n\n> [!trap] Wrong fixes that look busy\n> More layers, more neurons and more epochs make overfitting worse. Threading, serialization, a bigger machine or GPUs make training faster, not more accurate.",
      },
      {
        title: 'Evaluation metrics: pick the one that matches the cost of a mistake',
        body: "A classifier makes two kinds of mistake. The **confusion matrix** counts them.\n\n| | Predicted yes | Predicted no |\n|---|---|---|\n| **Actually yes** | True positive (TP) | False negative (FN): a miss |\n| **Actually no** | False positive (FP): a false alarm | True negative (TN) |\n\n| Metric | Formula | Use it when |\n|---|---|---|\n| **Accuracy** | (TP + TN) / all | Only when the classes are balanced |\n| **Precision** | TP / (TP + FP) | A **false alarm is costly**: spam that hides a real email, blocking a good customer |\n| **Recall** (sensitivity) | TP / (TP + FN) | A **miss is costly**: cancer screening, fraud, safety defects |\n| **F1 score** | Harmonic mean of precision and recall | You need one number that balances both |\n| **ROC AUC** | Area under true-positive rate against false-positive rate, over all thresholds | Ranking quality on fairly balanced classes |\n| **PR AUC** | Area under precision against recall | **Rare positives** (fraud at 0.1%). ROC AUC looks too good there |\n| **Log loss** | Penalises confident wrong probabilities | You need well-calibrated probabilities |\n\n- The model outputs a probability. The **threshold** (0.5 by default) turns it into yes or no. **Raise** the threshold for higher precision and lower recall. **Lower** it for higher recall and lower precision. You change the threshold, not the model.\n- **Regression metrics:** **MAE** (average error, easy to explain, robust to outliers), **RMSE** (punishes big errors more), **R²** (share of the variance explained; 1 is perfect).\n- **Clustering** has no labels: use the Davies-Bouldin index (lower is better) in BigQuery ML k-means.\n- **Recommendation and ranking:** precision at k, mean average precision, NDCG.\n\n> [!trap] Accuracy on imbalanced data\n> If 99.8% of transactions are legitimate, a model that always says 'legitimate' is 99.8% accurate and catches no fraud. Use recall, precision, F1 or PR AUC.",
      },
      {
        title: 'Feature engineering: turn raw columns into signal',
        body: "Most of the accuracy comes from the features, not from the algorithm.\n\n| Raw data | Technique | Why | BigQuery ML |\n|---|---|---|---|\n| Numbers on very different scales (age, income) | **Scale**: standardise (z-score) or min-max normalise | Gradient descent converges faster and no feature dominates | «ML.STANDARD_SCALER», «ML.MIN_MAX_SCALER» |\n| A number whose effect is not linear (age) | **Bucketise** into ranges | Lets a linear model learn a different effect per range | «ML.BUCKETIZE», «ML.QUANTILE_BUCKETIZE» |\n| A category with few values (colour, country) | **One-hot encode** | A model needs numbers. Never encode categories as 1, 2, 3 (that implies an order) | «ML.ONE_HOT_ENCODER» (automatic for strings) |\n| A category with very many values (user id, URL) | **Embedding** or the **hashing trick** | One-hot would create millions of sparse columns | «ML.HASH_BUCKETIZE» |\n| Two features that matter together (latitude **and** longitude, day **and** hour) | **Feature cross** | A linear model cannot learn interactions by itself | «ML.FEATURE_CROSS» |\n| Missing values | **Impute** with the mean, median or most frequent value, and often add a 'was missing' flag | Most models cannot read nulls | «ML.IMPUTER» |\n| Skewed numbers (income, page views) | **Log transform**, clip outliers | Reduces the pull of extreme values | «LOG()» in the TRANSFORM |\n| Timestamps | Extract hour, weekday, month; cyclic encoding | Raw timestamps do not generalise | «EXTRACT()» |\n\n- **Imbalanced classes:** use class weights («AUTO_CLASS_WEIGHTS = TRUE»), downsample the majority class, or upsample the minority class. Then judge with recall and precision, not accuracy.\n- **Correlated or redundant features:** combine them or remove one. With thousands of features, use **PCA** or L1 to reduce them. Never remove a feature only because it correlates with the **label**: that is the useful kind.\n- **Training-serving skew:** the features at prediction time are computed differently from training. Put the preparation in the model (BigQuery ML «TRANSFORM», TensorFlow Transform) or serve features from one **feature store**.\n- **Wide and deep:** a 'wide' linear part memorises sparse crosses, and a 'deep' network generalises. It is the classic answer for recommendations that need both.",
      },
    ],
    keyPoints: [
      {
        point:
          'Tune on the validation set and look at the test set once. Split time series by time, and drop any feature the model will not have at prediction time.',
        check: {
          type: 'choice',
          prompt:
            'You predict next week’s demand from three years of daily sales. Your random 80/20 split gives an excellent test score, but the model is poor in production. What is the most likely cause?',
          options: [
            'The random split let the model train on days after the test days, so it saw the future',
            'The test set was too small to give a reliable score for a model of this size',
            'The learning rate was too low, so training stopped before the model converged',
            'The model needs dropout, because daily sales data always overfits',
          ],
          answers: [0],
          why: 'Time series must be split by time: train on the past, test on later dates. A random split leaks information from the future into training, so the test score is too optimistic.',
        },
      },
      {
        point:
          'High training score and low validation score is overfitting (high variance). Low on both is underfitting (high bias).',
        check: {
          type: 'match',
          prompt: 'Match each result to the diagnosis.',
          pairs: [
            ['Training 99%, validation 71%', 'Overfitting'],
            ['Training 62%, validation 61%', 'Underfitting'],
            ['Training 91%, validation 90%', 'A good fit'],
            [
              'Validation loss rises after epoch 12 while training loss keeps falling',
              'Overfitting starts at epoch 12',
            ],
          ],
          why: 'A large gap between training and validation means the model memorised. Both low means it is too simple. Learning curves show the exact epoch where the validation loss turns up.',
        },
      },
      {
        point:
          'Dropout switches off random neurons during training, so a big network cannot memorise. L1 zeroes weak features, L2 keeps all weights small, and early stopping ends training at the best epoch.',
        more: 'Dropout is only active during training. At prediction time every neuron is used. A rate between 0.2 and 0.5 is typical.',
        check: {
          type: 'match',
          prompt: 'Match each overfitting symptom to the best fix.',
          pairs: [
            ['A neural network with many layers and neurons fits training data only', 'Dropout'],
            [
              'Thousands of features; you want a small model that uses only the important ones',
              'L1 regularisation',
            ],
            ['Validation loss starts to rise after epoch 20', 'Early stopping'],
            ['A linear model with very large weights; keep every feature', 'L2 regularisation'],
          ],
          why: 'Dropout is the neural-network fix. L1 drives weak weights to zero, so it selects features. L2 shrinks all weights but keeps them. Early stopping stops at the epoch with the best validation score.',
        },
      },
      {
        point:
          'Precision when a false alarm is costly, recall when a miss is costly, PR AUC for rare positives. Move the threshold to trade one for the other.',
        check: {
          type: 'choice',
          prompt:
            'A model screens X-rays for a serious disease. Doctors review every positive, and a missed case is very dangerous. The model is trained. What should you do?',
          options: [
            'Lower the classification threshold to increase recall, accepting more false positives',
            'Raise the classification threshold to increase precision, so doctors see fewer alerts',
            'Optimise overall accuracy, because it counts both kinds of mistake',
            'Retrain the model with L1 regularisation to remove weak features',
          ],
          answers: [0],
          why: 'A miss (false negative) is the costly mistake, so maximise recall. Lowering the threshold flags more cases; the extra false alarms are cheap because a doctor reviews them.',
        },
      },
      {
        point:
          'Scale numbers, bucketise non-linear numbers, one-hot small categories, embed or hash huge ones, and cross features that matter together.',
        check: {
          type: 'match',
          prompt: 'Match each raw feature to the transformation.',
          pairs: [
            ['Latitude and longitude of a pickup', 'Feature cross (after bucketising)'],
            ['Income from 0 to 5,000,000', 'Log transform, then scale'],
            ['A user id with 40 million values', 'Embedding or hash buckets'],
            ['Payment method: card, cash or wallet', 'One-hot encoding'],
          ],
          why: 'A cross lets a linear model learn that one place matters, not one latitude. A log tames skew. One-hot suits few categories, and embeddings or hashing suit very many.',
        },
      },
    ],
  },
  {
    slug: 'vertex-ai',
    code: '4.5',
    title: 'ML on Google Cloud: pick the tool, then train, serve and monitor',
    mission:
      'Five teams at Cymbal ask for ML in the same week: read receipts, translate support chats, predict churn from BigQuery, classify product photos into Cymbal’s own categories, and run a custom recommender. Pick the right tool for each, then put one model into production and keep it healthy.',
    concepts: [
      {
        title: 'Pick the tool: pre-trained API, AutoML, BigQuery ML or custom',
        body: 'Choose the **least effort** that meets the requirement.\n\n| Level | You provide | Pick it when |\n|---|---|---|\n| **Pre-trained API** | Nothing but the input | A general task Google already solves: labels in a photo, sentiment, speech, translation |\n| **Gemini** in Vertex AI | A prompt, maybe a few examples | Generation, summaries, extraction from free text and images |\n| **AutoML** (Vertex AI) | Labelled examples, no code | Your **own** categories (Cymbal’s 300 product types), tabular, image, text or video |\n| **BigQuery ML** | SQL | The data is in BigQuery and the team knows SQL |\n| **Custom training** (Vertex AI) | Model code: TensorFlow, PyTorch, scikit-learn, XGBoost | You need full control of the model or a new architecture |\n\n### The pre-trained APIs\n\n| Need | API |\n|---|---|\n| Labels, objects, faces, text (OCR), explicit content in images | **Cloud Vision API** |\n| Labels, shot changes, objects and text in video | **Video Intelligence API** |\n| Sentiment, entities, syntax, content categories in text | **Natural Language API** |\n| Translate text, with a **glossary** for product names | **Cloud Translation API** (Advanced) |\n| Audio to text, call transcription | **Speech-to-Text** |\n| Text to natural-sounding audio | **Text-to-Speech** |\n| Structured fields from forms, invoices, receipts | **Document AI** |\n| A chatbot or a voice agent | **Dialogflow CX** (Conversational Agents) |\n| Product recommendations for a retail site | **Vertex AI Search for commerce** (formerly Recommendations AI) |\n| Find and mask PII | **Sensitive Data Protection** (DLP) — not an ML model you train |\n\n> [!trap] Exam traps\n> Building a custom model for a task a pre-trained API already does. Using a pre-trained API when the labels are specific to your business: that needs AutoML or custom training.',
      },
      {
        title: 'Training on Vertex AI: notebooks, jobs, hardware and tuning',
        body: '**Vertex AI** is the one ML platform. Old names in questions: Cloud ML Engine, then AI Platform. Both are now Vertex AI.\n\n- **Vertex AI Workbench** (managed Jupyter notebooks, or **Colab Enterprise**) to explore and prototype.\n- **Custom training jobs** run your code on managed machines. Use a **prebuilt container** (TensorFlow, PyTorch, scikit-learn, XGBoost) when your framework is supported. Use a **custom container** for anything else.\n- **Distributed training** spreads a large model or dataset over many machines (data parallelism; the reduction server; the old parameter-server pattern).\n- **Vertex AI Experiments** and **TensorBoard** compare runs and their metrics.\n\n### Hardware\n\n| Hardware | Best for |\n|---|---|\n| **CPU** | Small models, simple linear models, I/O-bound input pipelines |\n| **GPU** | Most deep learning, custom operations, PyTorch, fast iteration |\n| **TPU** | Very large models dominated by **matrix multiplications**, long training (weeks on GPUs), large batches, TensorFlow or JAX. Not for custom operations that need the CPU |\n\nA slow **input pipeline** often starves the accelerator: store training data as **TFRecord** files (or in BigQuery), read with «tf.data» using parallel reads and prefetching.\n\n### Hyperparameter tuning\n\n- **Vertex AI hyperparameter tuning** (Vizier) runs many trials and uses **Bayesian optimisation** to choose the next values, so it finds good settings in fewer trials than a grid search.\n- Name the metric to optimise and its goal (maximise AUC, minimise RMSE), the parameter ranges, the number of trials and the trials to run in parallel. More parallel trials finish sooner but learn less from each other.\n- In BigQuery ML: «NUM_TRIALS», «HPARAM_RANGE» or «HPARAM_CANDIDATES», then «ML.TRIAL_INFO».\n\n### Other places that train models\n\n- **Spark MLlib on Dataproc**: the team already has Spark ML jobs (lift and shift).\n- **BigQuery ML**: SQL in the warehouse, with remote models for Gemini.',
      },
      {
        title: 'Serving: registry, endpoints, batch prediction and Feature Store',
        body: "1. **Vertex AI Model Registry** keeps every model version, from custom training, AutoML or BigQuery ML («MODEL_REGISTRY = 'VERTEX_AI'»).\n2. Then choose how predictions are made:\n\n| Need | Choose | Notes |\n|---|---|---|\n| One answer in milliseconds for a live request (a checkout fraud score) | **Online prediction** on a Vertex AI **endpoint** | Autoscaling replicas between a minimum and a maximum. You pay while it is deployed |\n| Score millions of rows nightly, latency does not matter | **Batch prediction** | Reads from and writes to Cloud Storage or BigQuery. No endpoint to keep running |\n| Scores where the data already lives | BigQuery ML «ML.PREDICT» | Plain SQL, can run as a scheduled query |\n| Test a new model on a small share of traffic | **Traffic split** on one endpoint | Canary or A/B: 90% old model, 10% new model, then shift |\n\n### Vertex AI Feature Store\n\n- One place to define, share and **serve** features. Offline store: BigQuery tables for training. Online serving: low-latency reads of the latest values for prediction.\n- **Point-in-time correctness**: training reads the feature values as they were at each label's time, so no future data leaks in.\n- The same feature definition for training and serving removes **training-serving skew**, and other teams reuse features instead of rebuilding them.\n\n### Explainable AI\n\n- **Feature attributions** (Shapley values, integrated gradients) show which inputs drove each prediction. Use them for regulators, debugging and trust. In BigQuery ML: «ML.EXPLAIN_PREDICT» and «ML.GLOBAL_EXPLAIN».\n\n> [!trap] Exam trap\n> An always-on endpoint for a nightly scoring job. Batch prediction costs less and needs no endpoint.",
      },
      {
        title: 'MLOps: pipelines, monitoring, drift and retraining',
        body: 'A model gets worse after release because the world changes. MLOps makes training, deployment and monitoring repeatable.\n\n| Problem | What it means | Detect it with |\n|---|---|---|\n| **Training-serving skew** | Serving inputs differ from the **training** data (a feature computed differently, a new default value) | Vertex AI Model Monitoring skew detection, «ML.VALIDATE_DATA_SKEW» |\n| **Prediction drift** (data drift) | Serving inputs **change over time** (new customer mix, a new market) | Model Monitoring drift detection, «ML.VALIDATE_DATA_DRIFT» |\n| **Concept drift** | The relationship between inputs and the label changes (fraudsters change tactics) | Falling accuracy once true labels arrive |\n\n- **Vertex AI Pipelines** runs ML workflows written with the **Kubeflow Pipelines** SDK or **TFX**: validate data, transform, train, evaluate, and deploy only if the new model beats the current one. Every run is recorded with its artefacts and lineage (Vertex ML Metadata).\n- **Continuous training:** retrain on a schedule or when monitoring raises an alert. Retrain on **existing and new data** (or a sliding window). Training only on the newest data makes the model forget general patterns.\n- **Cloud Composer** or Cloud Scheduler can trigger a pipeline when the wider data platform is already orchestrated there.\n- **Evaluate before deploy:** compare the candidate with the current model on the same held-out data, check fairness across groups, and keep the old version in the registry to roll back.\n- **Responsible AI:** check for bias across groups, explain predictions, and keep personal data out of features that do not need it.\n\n> [!trap] Exam trap\n> Retraining only on the newest week of data, or deploying a retrained model without comparing it with the one in production.',
      },
    ],
    keyPoints: [
      {
        point:
          'Least effort wins: pre-trained API for general tasks, AutoML for your own labels without code, BigQuery ML for SQL teams, custom training for full control.',
        check: {
          type: 'match',
          prompt: 'Match each request to the tool.',
          pairs: [
            ['Pull totals and dates out of scanned supplier invoices', 'Document AI'],
            [
              'Sort product photos into Cymbal’s own 300 categories, no ML engineers',
              'AutoML image classification',
            ],
            ['Predict churn from BigQuery tables; the team knows only SQL', 'BigQuery ML'],
            ['Detect the sentiment of support emails', 'Natural Language API'],
          ],
          why: 'Invoices and sentiment are general tasks with pre-trained APIs. Custom categories need your labelled examples: AutoML. Data in BigQuery with a SQL team: BigQuery ML.',
        },
      },
      {
        point:
          'TPUs for huge matrix-heavy training, GPUs for most deep learning and custom ops. Vertex AI hyperparameter tuning uses Bayesian optimisation to find good values in fewer trials.',
        check: {
          type: 'choice',
          prompt:
            'A large TensorFlow model built mostly from matrix multiplications takes weeks to train on GPUs. It uses no custom operations. How do you cut the training time most?',
          options: [
            'Train it on Cloud TPUs with a Vertex AI custom training job',
            'Train it on a larger CPU-only machine with more memory',
            'Lower the number of epochs and accept a less accurate model',
            'Move the training to Spark MLlib on a Dataproc cluster',
          ],
          answers: [0],
          why: 'TPUs are built for large matrix multiplications in TensorFlow or JAX and give the biggest speed-up for long training runs. CPUs are slower; fewer epochs costs accuracy; Spark MLlib is not for deep networks.',
        },
      },
      {
        point:
          'Online endpoints for live, low-latency requests; batch prediction for large offline scoring; a feature store keeps training and serving features identical.',
        check: {
          type: 'choice',
          prompt:
            'Every night you must score 40 million customers with a Vertex AI model and write the results to BigQuery. Nobody needs results during the day. What is the most cost-effective option?',
          options: [
            'A Vertex AI batch prediction job that reads from and writes to BigQuery',
            'An online endpoint with autoscaling, called once per customer by a Dataflow job',
            'An online endpoint kept at a minimum of ten replicas all day',
            'Export the model and call it from a Cloud Run function per row',
          ],
          answers: [0],
          why: 'Batch prediction is made for large offline jobs. It starts the machines, scores, writes the output and stops, with no endpoint to pay for between runs.',
        },
      },
      {
        point:
          'Skew means serving data differs from training data. Drift means serving data changes over time. Monitor both, and retrain on old and new data through a pipeline.',
        check: {
          type: 'order',
          prompt: 'Order the steps of a continuous training pipeline on Vertex AI Pipelines.',
          steps: [
            'Model Monitoring raises a drift alert, or the schedule fires',
            'Validate the new training data',
            'Train on existing and new data',
            'Evaluate the candidate against the model in production',
            'Deploy with a traffic split if the candidate is better',
          ],
          why: 'A trigger starts the run. Bad data must fail before training. The candidate is deployed only after it beats the current model, and a traffic split limits the risk.',
        },
      },
    ],
  },
];
