/**
 * Bank questions for stations 4.4 (ML fundamentals) and 4.5 (ML on Google
 * Cloud), in the style of the practice exams. `questions.ts` appends them to
 * the bank. See lib/course/gcp/README.md for the rules.
 */

import type { BankQuestion } from '@/types/gcp';

export const ML_QUESTIONS: readonly BankQuestion[] = [
  {
    station: 'ml-fundamentals',
    prompt:
      'Your company built a TensorFlow neural network with a large number of neurons and layers. It fits the training data well, but it performs poorly on new data. What method can you use to address this?',
    options: ['Dropout methods', 'Threading', 'Serialization', 'Dimensionality reduction'],
    answers: [0],
    why: 'The model overfits because it has too much capacity. Dropout switches off random neurons during training so the network cannot memorise. Threading and serialization change speed and storage, not accuracy. Dimensionality reduction shrinks the inputs, but the problem is the size of the network.',
  },
  {
    station: 'ml-fundamentals',
    prompt:
      'A linear model trained on 4,000 features overfits. The team wants a smaller, easier-to-explain model that keeps only the features that matter. Which technique fits best?',
    options: [
      'L1 regularisation, which drives the weights of weak features to zero',
      'L2 regularisation, which keeps every feature with a smaller weight',
      'Dropout on the input layer, with a rate of 0.5 during training',
      'Train for more epochs so the model learns which features matter',
    ],
    answers: [0],
    why: 'L1 adds the absolute weights to the loss, so weak features get a weight of exactly zero: a sparse model with built-in feature selection. L2 shrinks weights but keeps all of them. Dropout is a neural-network technique, and more epochs make overfitting worse.',
  },
  {
    station: 'ml-fundamentals',
    prompt:
      'While training a network, the validation loss falls until epoch 15 and then rises, while the training loss keeps falling until epoch 60. What is the simplest way to get the best model?',
    options: [
      'Use early stopping on the validation loss',
      'Increase the number of epochs to 120',
      'Add more layers to the network',
      'Raise the learning rate after epoch 15',
    ],
    answers: [0],
    why: 'The model starts to overfit at epoch 15. Early stopping watches the validation loss, stops when it stops improving and keeps the best weights. More epochs and more layers make overfitting worse.',
  },
  {
    station: 'ml-fundamentals',
    prompt:
      'A model scores 61% accuracy on the training data and 60% on the validation data. The business needs at least 85%. Which TWO actions are most likely to help? (Choose two.)',
    options: [
      'Add more informative features',
      'Use a more complex model',
      'Add dropout to the model',
      'Increase the L2 regularisation strength',
    ],
    answers: [0, 1],
    why: 'Low scores on both sets mean underfitting (high bias): the model is too simple for the pattern. Give it more signal and more capacity. Dropout and stronger regularisation reduce capacity, which makes underfitting worse.',
  },
  {
    station: 'ml-fundamentals',
    prompt:
      'During training, the loss jumps up and down by large amounts from one step to the next and never settles. The data and the labels are correct. What should you change first?',
    options: [
      'Lower the learning rate',
      'Raise the learning rate',
      'Add more hidden layers',
      'Remove the validation set',
    ],
    answers: [0],
    why: 'A learning rate that is too high makes each weight update overshoot the minimum, so the loss oscillates or diverges. A smaller step lets gradient descent converge.',
  },
  {
    station: 'ml-fundamentals',
    prompt:
      'A spam filter must almost never send a real customer email to the spam folder. Missing some spam is acceptable. Which metric should you optimise?',
    options: [
      'Precision for the spam class',
      'Recall for the spam class',
      'Overall accuracy',
      'Root mean squared error',
    ],
    answers: [0],
    why: 'Here the costly mistake is a false positive: a real email marked as spam. Precision measures how many emails flagged as spam really are spam. Recall would push the filter to catch more spam at the cost of more false alarms.',
  },
  {
    station: 'ml-fundamentals',
    prompt:
      'A model inspects parts on a production line. A defective part that ships can injure a customer; a good part that is flagged is just checked again by hand. The model is trained. What should you do?',
    options: [
      'Lower the decision threshold so the model flags more parts, increasing recall',
      'Raise the decision threshold so the model flags fewer parts, increasing precision',
      'Optimise overall accuracy, because defects are rare and accuracy counts every part',
      'Replace the classifier with a regression model that predicts a defect score',
    ],
    answers: [0],
    why: 'A miss (false negative) is the dangerous mistake, so maximise recall. Lowering the threshold catches more defects; the extra false alarms are cheap. Accuracy is misleading with rare defects.',
  },
  {
    station: 'ml-fundamentals',
    prompt:
      'Fraud is 0.1% of transactions. Two fraud models have ROC AUC values of 0.97 and 0.98, but very different results in production. Which metric better compares models on this data?',
    options: [
      'Area under the precision-recall curve (PR AUC)',
      'Overall accuracy at a 0.5 threshold',
      'ROC AUC computed on more data',
      'Mean absolute error of the scores',
    ],
    answers: [0],
    why: 'With very rare positives, ROC AUC is inflated by the huge number of true negatives. PR AUC focuses on the positive class: how many alerts are real and how many frauds are caught.',
  },
  {
    station: 'ml-fundamentals',
    prompt:
      'A churn model scores 0.99 ROC AUC on the test set but is useless in production. One feature is «account_closed_date», which is filled in when a customer leaves. What is the problem?',
    options: [
      'Data leakage: the feature is only known after the outcome, so remove it',
      'Overfitting: the model needs dropout and L2 regularisation',
      'Class imbalance: the churners need a higher class weight',
      'Training-serving skew: the feature needs a TRANSFORM clause',
    ],
    answers: [0],
    why: 'The feature reveals the label. It is never available when you must predict churn, so the model learned a shortcut. Remove every feature that is not known at prediction time.',
  },
  {
    station: 'ml-fundamentals',
    prompt:
      'You forecast daily store sales from three years of history. How should you split the data to estimate production accuracy honestly?',
    options: [
      'Train on the older dates and validate and test on the most recent dates',
      'Randomly assign 80% of the days to training and 20% to testing',
      'Use k-fold cross-validation with randomly shuffled days',
      'Train and test on all the data, then compare the two scores',
    ],
    answers: [0],
    why: 'Production predicts the future from the past, so the split must too. Random splits and shuffled folds put later days into training, which leaks the future and inflates the score.',
  },
  {
    station: 'ml-fundamentals',
    prompt:
      'A linear model predicts taxi fares from pickup latitude and longitude as two numeric features. Fares depend on specific neighbourhoods, and accuracy is poor. What should you do?',
    options: [
      'Bucketise latitude and longitude, then create a feature cross of the buckets',
      'Normalise latitude and longitude to the range 0 to 1',
      'Remove latitude and longitude because they are correlated',
      'Add L2 regularisation to the latitude and longitude weights',
    ],
    answers: [0],
    why: 'A linear model cannot learn that one combination of latitude and longitude (a place) matters. Bucketising and crossing the two features turns each grid cell into its own feature. Scaling and regularisation do not create the interaction.',
  },
  {
    station: 'ml-fundamentals',
    prompt:
      'A neural network must use a «product_id» feature with 2 million distinct values. One-hot encoding makes the model huge and slow to train. What should you use instead?',
    options: [
      'An embedding layer that maps each product to a small dense vector',
      'An integer code from 1 to 2,000,000 used as a numeric input',
      'Drop the feature, because it has too many values to be useful',
      'One-hot encoding with L1 regularisation to remove rare products',
    ],
    answers: [0],
    why: 'An embedding learns a short dense vector per product, so similar products get similar vectors and the model stays small. An integer code implies a false order and size. The hashing trick is another valid option.',
  },
  {
    station: 'ml-fundamentals',
    prompt:
      'A model uses age (18 to 90) and annual income (0 to 5,000,000) as inputs. Gradient descent converges very slowly and the income weight dominates. What should you do first?',
    options: [
      'Scale the numeric features, for example with standardisation',
      'Increase the batch size to the whole training set',
      'Replace gradient descent with a decision tree',
      'Add dropout to the first hidden layer',
    ],
    answers: [0],
    why: 'Features on very different scales make the loss surface long and narrow, so gradient descent zig-zags. Standardising (or min-max scaling, plus a log for skewed income) puts the features on a similar scale.',
  },
  {
    station: 'ml-fundamentals',
    prompt:
      'A feature «colour» was stored as red = 1, green = 2, blue = 3 and fed to a linear model as a number. Why is this a problem, and what is the fix?',
    options: [
      'It implies blue is three times red; use one-hot encoding',
      'It uses too much memory; store colour as a string',
      'It leaks the label; remove the feature from training',
      'It causes skew; compute it in a feature store instead',
    ],
    answers: [0],
    why: 'Numeric codes give categories a false order and distance. One-hot encoding creates one 0 or 1 column per value, so each colour gets its own weight.',
  },
  {
    station: 'ml-fundamentals',
    prompt:
      'Only 1% of your training examples are positive. The trained classifier predicts negative for every example. Which TWO actions address this? (Choose two.)',
    options: [
      'Give the positive class a higher weight in the loss',
      'Downsample the negative class in the training data',
      'Evaluate the model with overall accuracy instead',
      'Add more hidden layers to the network',
    ],
    answers: [0, 1],
    why: 'Class weights or resampling stop the majority class from dominating the loss. Accuracy hides the problem (99% by predicting no), and more layers do not change the imbalance.',
  },
  {
    station: 'ml-fundamentals',
    prompt:
      'A pricing model must avoid large errors much more than small ones: one 500-dollar miss is worse than ten 50-dollar misses. Which metric should you use to compare models?',
    options: [
      'Root mean squared error (RMSE)',
      'Mean absolute error (MAE)',
      'Precision at the top 10',
      'Area under the ROC curve',
    ],
    answers: [0],
    why: 'RMSE squares each error before averaging, so large errors count much more. MAE weighs every unit of error the same. Precision and ROC AUC are classification metrics.',
  },
  {
    station: 'ml-fundamentals',
    prompt:
      'A data scientist tried 40 hyperparameter settings and kept the one with the best score on the test set. In production the model is clearly worse than that score. What went wrong?',
    options: [
      'The test set was used to tune, so its score is optimistic; tune on a validation set',
      'Forty settings are too few; a grid search of 400 settings would generalise better',
      'The model needs dropout, because tuning always causes the model to overfit',
      'The test set should be larger than the training set for a reliable score',
    ],
    answers: [0],
    why: 'Choosing among many models by their test score fits the choice to the test set. Tune on a validation set (or with cross-validation), and use the test set once, at the end.',
  },
  {
    station: 'ml-fundamentals',
    prompt:
      'A recommender must memorise specific frequent item pairs (users who buy A buy B) and also generalise to new combinations. Which model architecture is designed for this?',
    options: [
      'A wide and deep model',
      'A k-means clustering model',
      'A single linear regression',
      'An ARIMA_PLUS time series model',
    ],
    answers: [0],
    why: 'The wide part (a linear model over sparse feature crosses) memorises frequent pairs, and the deep part (a network over embeddings) generalises to unseen combinations.',
  },
  {
    station: 'ml-fundamentals',
    prompt:
      'A network was trained with a dropout rate of 0.3. What happens to dropout when the deployed model serves predictions?',
    options: [
      'Dropout is turned off and every neuron is used',
      'Thirty percent of neurons are still dropped at random',
      'The same thirty percent of neurons stay dropped forever',
      'The model must be retrained without dropout before serving',
    ],
    answers: [0],
    why: 'Dropout is a training-time regulariser. At prediction time every neuron is active (the activations are scaled accordingly), so predictions are stable and repeatable.',
  },
  {
    station: 'vertex-ai',
    prompt:
      'Cymbal receives thousands of supplier invoices as PDFs and must extract the supplier, date and total into BigQuery. It has no labelled data and no ML team. What should it use?',
    options: [
      'Document AI with the invoice parser',
      'AutoML trained on labelled invoices',
      'A custom TensorFlow model on Vertex AI',
      'BigQuery ML with a logistic regression',
    ],
    answers: [0],
    why: 'Invoice parsing is a solved, general task. Document AI returns named fields with no training data. AutoML and custom training need labelled data and effort that the requirement does not justify.',
  },
  {
    station: 'vertex-ai',
    prompt:
      'A retailer wants to sort product photos into its own 300 categories. It has 50,000 labelled photos and no data scientists. What is the best approach?',
    options: [
      'Train an AutoML image classification model on Vertex AI',
      'Use the Cloud Vision API label detection as it is',
      'Write a custom convolutional network in TensorFlow',
      'Use the Natural Language API on the product titles',
    ],
    answers: [0],
    why: 'The labels are specific to the business, so a pre-trained API cannot return them. AutoML learns them from the labelled photos without code. A custom network needs ML engineers.',
  },
  {
    station: 'vertex-ai',
    prompt:
      'Marketing wants to know whether thousands of product reviews are positive or negative, by tomorrow, with no ML expertise. What should you use?',
    options: [
      'The Natural Language API sentiment analysis',
      'An AutoML text classification model',
      'A BigQuery ML k-means model on the reviews',
      'A custom sentiment model on Vertex AI',
    ],
    answers: [0],
    why: 'Sentiment is a general task with a pre-trained API: no labels, no training, results today. AutoML would need labelled reviews, and k-means does not predict sentiment.',
  },
  {
    station: 'vertex-ai',
    prompt:
      'Support chats must be translated into eight languages. Product names such as «Cymbal Flex» must never be translated. What is the least-effort solution?',
    options: [
      'Cloud Translation Advanced with a glossary of product names',
      'Cloud Translation Basic, then fix product names by hand',
      'A custom translation model trained on Vertex AI',
      'The Natural Language API with entity analysis',
    ],
    answers: [0],
    why: 'A glossary tells the Translation API exactly how to handle specific terms. Custom models and manual fixes cost far more, and the Natural Language API does not translate.',
  },
  {
    station: 'vertex-ai',
    prompt:
      'A call centre wants searchable text from 10,000 hours of recorded calls, with each speaker labelled. What should it use?',
    options: [
      'Speech-to-Text with speaker diarization',
      'Text-to-Speech with custom voices',
      'Video Intelligence speech transcription',
      'Dialogflow CX with a phone gateway',
    ],
    answers: [0],
    why: 'Speech-to-Text transcribes audio, and diarization labels who spoke when. Text-to-Speech goes the other way, and Dialogflow builds live agents, not batch transcripts.',
  },
  {
    station: 'vertex-ai',
    prompt:
      'A bank wants a chat agent on its website that handles balance questions and card blocking through multi-turn conversations. What should it build on?',
    options: [
      'Dialogflow CX',
      'The Natural Language API',
      'AutoML text classification',
      'Vertex AI batch prediction',
    ],
    answers: [0],
    why: 'Dialogflow CX (Conversational Agents) is built for chat and voice agents with flows, intents and integrations. The other tools classify or score text but do not manage a conversation.',
  },
  {
    station: 'vertex-ai',
    prompt:
      'Your TensorFlow model uses several custom operations written in C++ that run on the CPU. Training is too slow. Which accelerator should you choose?',
    options: [
      'GPUs, because TPUs do not support custom CPU operations',
      'TPUs, because they are always the fastest option for TensorFlow',
      'More CPU cores only, because accelerators cannot run TensorFlow',
      'TPU Pods, because custom operations need many TPU chips',
    ],
    answers: [0],
    why: 'TPUs suit large matrix-heavy models without custom operations that must run on the CPU. GPUs support custom operations and still accelerate the network.',
  },
  {
    station: 'vertex-ai',
    prompt:
      'Training on Vertex AI is slow, and monitoring shows the GPUs are idle most of the time. The training data is millions of small CSV files in Cloud Storage. What should you do first?',
    options: [
      'Convert the data to TFRecord files and read it with tf.data using parallel reads and prefetch',
      'Add more GPUs to the training job so each one has less work to do',
      'Switch the training job from GPUs to TPUs for more raw computing power',
      'Increase the learning rate so the model needs fewer training steps',
    ],
    answers: [0],
    why: 'Idle accelerators mean the input pipeline cannot feed them. Large sequential files and a parallel, prefetching input pipeline fix the bottleneck. More or faster accelerators would sit idle too.',
  },
  {
    station: 'vertex-ai',
    prompt:
      'You must find good values for the learning rate, the number of layers and the dropout rate of a model on Vertex AI, with as few training runs as possible. What should you use?',
    options: [
      'Vertex AI hyperparameter tuning, which uses Bayesian optimisation',
      'A grid search over every combination of the three values',
      'Manual trials, changing one value at a time in a notebook',
      'The default values, then retrain with more training data',
    ],
    answers: [0],
    why: 'Vertex AI hyperparameter tuning (Vizier) uses the results of earlier trials to pick the next values, so it needs far fewer trials than a grid search. You set the metric, the ranges and the trial count.',
  },
  {
    station: 'vertex-ai',
    prompt:
      'A mobile app must show product recommendations within 100 ms of a user opening a page, using a model trained on Vertex AI. How should you serve the model?',
    options: [
      'Deploy it to a Vertex AI endpoint for online prediction',
      'Run a Vertex AI batch prediction job for every page view',
      'Run ML.PREDICT in BigQuery for every page view',
      'Export predictions to Cloud Storage once a week',
    ],
    answers: [0],
    why: 'Live requests that need an answer in milliseconds need online prediction from an endpoint with autoscaling replicas. Batch jobs and queries take far too long to start for each request.',
  },
  {
    station: 'vertex-ai',
    prompt:
      'A fraud model performs well in testing but poorly in production. You find that the app computes «orders_last_30_days» with a different time zone than the training pipeline. What prevents this class of problem?',
    options: [
      'Serve the same feature definitions for training and prediction from Vertex AI Feature Store',
      'Retrain the model every day on the newest production data only',
      'Add dropout and L2 regularisation so the model tolerates noisy inputs',
      'Increase the minimum number of replicas on the prediction endpoint',
    ],
    answers: [0],
    why: 'This is training-serving skew: one feature computed two ways. A feature store (or preprocessing stored in the model, such as a TRANSFORM) gives training and serving the same values.',
  },
  {
    station: 'vertex-ai',
    prompt:
      'A churn model was accurate at launch, but its accuracy falls each quarter as customer behaviour changes. What is the best long-term solution?',
    options: [
      'Monitor for drift and retrain through a pipeline on existing and new data',
      'Retrain each quarter using only the data from the most recent quarter',
      'Freeze the launch model, because retraining may introduce new bugs',
      'Add more layers so the model can learn the changing behaviour',
    ],
    answers: [0],
    why: 'Vertex AI Model Monitoring detects drift, and a pipeline retrains, evaluates and deploys safely. Training only on the newest data forgets stable long-term patterns.',
  },
  {
    station: 'vertex-ai',
    prompt:
      'You retrained a model and want to expose it to real traffic with limited risk, with an easy rollback. The current model is on a Vertex AI endpoint. What should you do?',
    options: [
      'Deploy the new version to the same endpoint with a 10% traffic split',
      'Undeploy the old model and deploy the new one at 100% traffic',
      'Create a new endpoint and change every client to call it',
      'Run the new model as a batch prediction job beside the endpoint',
    ],
    answers: [0],
    why: 'A traffic split on one endpoint sends a small share of requests to the new version (a canary). You compare the results and shift traffic, or roll back by setting the split to 0%.',
  },
  {
    station: 'vertex-ai',
    prompt:
      'Your team wants a repeatable ML workflow: validate data, train, evaluate and deploy only if the new model is better, with every artefact and its lineage recorded. What should you use?',
    options: [
      'Vertex AI Pipelines with the Kubeflow Pipelines SDK or TFX',
      'A cron job on a Compute Engine VM that runs a notebook',
      'A Cloud Run function that trains the model on each upload',
      'BigQuery scheduled queries that run CREATE MODEL nightly',
    ],
    answers: [0],
    why: 'Vertex AI Pipelines runs each step as a component and records the artefacts, parameters and lineage in Vertex ML Metadata. The other options have no evaluation gate or lineage.',
  },
  {
    station: 'vertex-ai',
    prompt:
      'A lender must tell regulators which inputs drove each loan decision made by a model on Vertex AI. What should you use?',
    options: [
      'Vertex Explainable AI feature attributions',
      'Vertex AI Model Monitoring drift alerts',
      'Cloud Audit Logs on the prediction endpoint',
      'A higher dropout rate for a simpler model',
    ],
    answers: [0],
    why: 'Explainable AI returns feature attributions (such as Shapley values) for each prediction. Monitoring watches inputs over time, and audit logs show who called the endpoint, not why the model decided.',
  },
  {
    station: 'vertex-ai',
    prompt:
      'An on-premises Hadoop cluster runs Spark MLlib training jobs. You must move them to Google Cloud quickly with the fewest code changes. Where should they run?',
    options: ['Dataproc', 'AutoML Tables', 'BigQuery ML', 'Cloud Run'],
    answers: [0],
    why: 'Dataproc runs Spark, including MLlib, as a managed service, so the jobs move with little change. Rewriting for BigQuery ML or AutoML is a re-platform, not a lift and shift.',
  },
  {
    station: 'vertex-ai',
    prompt:
      'Your training code needs a library and a system package that no Vertex AI prebuilt training container includes. How should you run the training job?',
    options: [
      'Build a custom container with the dependencies and use it in a custom training job',
      'Install the packages by hand on the prebuilt container while the job is running',
      'Run the training in a Workbench notebook kernel instead of a training job',
      'Rewrite the model in BigQuery ML so no container is needed at all',
    ],
    answers: [0],
    why: 'Custom containers let you package any framework and dependency, and Vertex AI runs them as managed training jobs. Prebuilt containers are for the supported frameworks as they are.',
  },
  {
    station: 'vertex-ai',
    prompt:
      'An exam question says "Cloud ML Engine" or "AI Platform Prediction". What should you read it as today?',
    options: [
      'Vertex AI training and prediction',
      'BigQuery ML in a scheduled query',
      'Dataproc with Spark MLlib',
      'Cloud Run with a TensorFlow image',
    ],
    answers: [0],
    why: 'Cloud ML Engine became AI Platform, which became Vertex AI. Older questions use the old names for managed training and online or batch prediction.',
  },
];
