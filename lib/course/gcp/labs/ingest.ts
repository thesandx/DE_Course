/**
 * Hands-on labs for line 2, "Ingesting and processing the data".
 * One lab per station. The shape and the rules are in `../README.md`.
 */

import type { GcpLab } from '@/types/gcp';

const EVENTS = `{"event_id":"e01","ride_id":"r101","city":"SF","event_time":"2026-03-01T08:00:12Z","fare":14.5,"comment":"Smooth ride, friendly driver"}
{"event_id":"e02","ride_id":"r102","city":"NYC","event_time":"2026-03-01T08:00:40Z","fare":22.0,"comment":"Driver was late and rude"}
{"event_id":"e03","ride_id":"r103","city":"SF","event_time":"2026-03-01T08:00:55Z","fare":9.75,"comment":"Clean car"}
{"event_id":"e03","ride_id":"r103","city":"SF","event_time":"2026-03-01T08:00:55Z","fare":9.75,"comment":"Clean car"}
{"event_id":"e04","ride_id":"r104","city":"NYC","event_time":"2026-03-01T08:01:05Z","fare":31.2,"comment":"Took a long detour"}
{"event_id":"e05","ride_id":"r105","city":"LON","event_time":"2026-03-01T08:01:20Z","fare":18.0,"comment":"Great music, quick trip"}
{"event_id":"e06","ride_id":"r106","city":"SF","event_time":"2026-03-01T08:01:48Z","fare":27.4,"comment":"Okay"}
{"event_id":"e07","ride_id":"r107","city":"LON","event_time":"2026-03-01T08:02:10Z","fare":-3.0,"comment":"App charged me twice"}
{"event_id":"e08","ride_id":"r108","city":"NYC","event_time":"2026-03-01T08:02:30Z","fare":12.6,"comment":"Fine"}
{"event_id":"e09","ride_id":"r109","city":"SF","event_time":"2026-03-01T08:00:30Z","fare":11.1,"comment":"Arrived late in the log but early in time"}
{"event_id":"e10","ride_id":"r110","city":"LON","event_time":"2026-03-01T08:02:45Z","fare":25.3,"comment":"Lovely"}
{"event_id":"e10","ride_id":"r110","city":"LON","event_time":"2026-03-01T08:02:45Z","fare":25.3,"comment":"Lovely"}`;

const BEAM = `"""Count rides per city in one-minute event-time windows, after removing duplicates.

Run it locally: python beam_windows.py
"""

import json
from datetime import datetime

import apache_beam as beam
from apache_beam.transforms.window import FixedWindows, TimestampedValue


def with_event_time(line):
    event = json.loads(line)
    stamp = datetime.fromisoformat(event["event_time"].replace("Z", "+00:00"))
    return TimestampedValue(event, stamp.timestamp())


class Describe(beam.DoFn):
    def process(self, element, window=beam.DoFn.WindowParam):
        city, rides = element
        start = window.start.to_utc_datetime().strftime("%H:%M")
        end = window.end.to_utc_datetime().strftime("%H:%M")
        yield f"{start}-{end}  {city:<4} {rides} rides"


with beam.Pipeline() as pipeline:
    (
        pipeline
        | "Read" >> beam.io.ReadFromText("events.jsonl")
        | "Event time" >> beam.Map(with_event_time)
        | "Valid fares" >> beam.Filter(lambda event: event["fare"] > 0)
        | "One-minute windows" >> beam.WindowInto(FixedWindows(60))
        | "Key by event" >> beam.Map(lambda event: (event["event_id"], event))
        | "Group duplicates" >> beam.GroupByKey()
        | "Keep one" >> beam.Map(lambda pair: next(iter(pair[1])))
        | "Key by city" >> beam.Map(lambda event: (event["city"], 1))
        | "Count" >> beam.CombinePerKey(sum)
        | "Describe" >> beam.ParDo(Describe())
        | "Print" >> beam.Map(print)
    )`;

const WORKFLOW = `main:
  steps:
    - init:
        assign:
          - project: \${sys.get_env("GOOGLE_CLOUD_PROJECT_ID")}
    - build_daily:
        call: googleapis.bigquery.v2.jobs.query
        args:
          projectId: \${project}
          body:
            useLegacySql: false
            location: us-central1
            query: >-
              MERGE lab23.daily_city AS d
              USING (SELECT DATE(pickup_ts) AS day, city, COUNT(*) AS trips, SUM(fare) AS revenue
                     FROM lab23.trips GROUP BY day, city) AS s
              ON d.day = s.day AND d.city = s.city
              WHEN MATCHED THEN UPDATE SET trips = s.trips, revenue = s.revenue
              WHEN NOT MATCHED THEN INSERT (day, city, trips, revenue)
              VALUES (s.day, s.city, s.trips, s.revenue)
    - count_rows:
        call: googleapis.bigquery.v2.jobs.query
        args:
          projectId: \${project}
          body:
            useLegacySql: false
            location: us-central1
            query: "SELECT COUNT(*) AS n FROM lab23.daily_city"
        result: counted
    - log_it:
        call: sys.log
        args:
          text: \${"daily_city rows = " + counted.rows[0].f[0].v}
          severity: INFO
    - finish:
        return: \${counted.rows[0].f[0].v}`;

export const LABS: readonly GcpLab[] = [
  {
    station: 'pipeline-planning',
    title: 'Private networking and customer-managed keys',
    scenario:
      'Security wants pipeline workers with no public IP, still able to reach Google APIs, and data encrypted with a key the company controls and can switch off. You build the network, prove what a private VM can and cannot reach, and crypto-lock a bucket.',
    minutes: 50,
    apis: [
      'compute.googleapis.com',
      'iap.googleapis.com',
      'cloudkms.googleapis.com',
      'storage.googleapis.com',
    ],
    vars: { ZONE: 'us-central1-a', BUCKET: '$PROJECT_ID-lab21' },
    creates: [
      'VPC network «lab21-vpc», subnet «lab21-subnet» and firewall rule «lab21-allow-iap»',
      'VM «lab21-vm» (e2-micro, no external IP)',
      'Cloud KMS key ring «lab21-ring» and key «lab21-key»',
      'Cloud Storage bucket «PROJECT_ID-lab21»',
    ],
    cost: 'About 5 cents. The e2-micro VM is in the free tier in «us-central1». A Cloud KMS key version costs about $0.06 a month while it is active; you destroy it at the end. Key rings and keys cannot be deleted, and an empty key with no active versions costs nothing.',
    freeTier: [
      'One e2-micro VM in «us-central1», «us-west1» or «us-east1» and 30 GB of standard disk are free each month.',
      'IAP TCP forwarding for SSH is free.',
      'Stay in «us-central1» for every resource in this lab.',
    ],
    files: [],
    steps: [
      {
        title: 'Sort the sources into patterns',
        body: 'Before any network, decide the pattern. For each source, name the ingestion pattern and the first GCP service: (a) a partner drops CSV files every night; (b) a mobile app emits 50,000 events a second; (c) an on-premises Postgres must replicate changes within a minute; (d) a SaaS tool has a REST API with daily exports.',
        concepts: [1],
        check:
          '(a) batch file drop: Cloud Storage, then a load job. (b) streaming: Pub/Sub, then Dataflow or a BigQuery subscription. (c) change data capture: Datastream, then BigQuery. (d) scheduled pull: Cloud Run job or a BigQuery Data Transfer connector, run by Cloud Scheduler or Composer.',
      },
      {
        title: 'Build a private network',
        body: 'A custom-mode VPC has no subnets until you create them. You turn on **Private Google Access** on the subnet, so VMs without a public IP can still call Google APIs. The firewall rule lets in only the IAP range, so SSH works without a public IP.',
        concepts: [2],
        console: `1. Open **VPC network** > **VPC networks** > **Create VPC network**. Name «lab21-vpc», subnet creation mode **Custom**.
2. Add a subnet: name «lab21-subnet», region «us-central1», range «10.21.0.0/24», **Private Google Access: On**. Create.
3. Open **Firewall** > **Create firewall rule**. Name «lab21-allow-iap», network «lab21-vpc», ingress, targets **All instances**, source range «35.235.240.0/20», TCP port «22». Create.`,
        shell: `gcloud compute networks create lab21-vpc --subnet-mode=custom
gcloud compute networks subnets create lab21-subnet --network=lab21-vpc \\
  --region=us-central1 --range=10.21.0.0/24 --enable-private-ip-google-access
gcloud compute firewall-rules create lab21-allow-iap --network=lab21-vpc \\
  --direction=INGRESS --allow=tcp:22 --source-ranges=35.235.240.0/20`,
        check:
          'The subnet shows **Private Google Access: On**. The only firewall rule on the network allows port 22 from «35.235.240.0/20».',
      },
      {
        title: 'Start a VM with no public IP',
        body: 'This is how Dataflow and Dataproc workers should run in a locked-down project: internal IPs only.',
        concepts: [2],
        console:
          '1. Open **Compute Engine** > **VM instances** > **Create instance**. Name «lab21-vm», region «us-central1», zone «us-central1-a», machine type «e2-micro».\n2. Boot disk: Debian 12, **Standard persistent disk**, 10 GB.\n3. Networking: network «lab21-vpc», subnet «lab21-subnet», **External IPv4 address: None**. Create.',
        shell: `gcloud compute instances create lab21-vm --zone=$ZONE --machine-type=e2-micro \\
  --subnet=lab21-subnet --no-address \\
  --image-family=debian-12 --image-project=debian-cloud \\
  --boot-disk-type=pd-standard --boot-disk-size=10GB`,
        check:
          'The VM list shows «lab21-vm» with an internal IP in «10.21.0.0/24» and no external IP.',
      },
      {
        title: 'Prove what a private VM can reach',
        body: 'SSH in through IAP, then try two calls: one to a Google API, one to the public internet. Private Google Access opens the first. Nothing opens the second, because there is no public IP and no Cloud NAT.',
        concepts: [2],
        shell: `gcloud compute ssh lab21-vm --zone=$ZONE --tunnel-through-iap
# Now on the VM:
curl -s -o /dev/null -w "Google API: %{http_code}\\n" https://storage.googleapis.com/dataflow-samples/shakespeare/kinglear.txt
curl -s -m 8 -o /dev/null -w "Internet: %{http_code}\\n" https://example.com || echo "Internet: no route"
exit`,
        check:
          'The Google API call prints 200. The internet call prints «no route» after a few seconds. To reach the internet without a public IP you would add Cloud Router and Cloud NAT, which cost money per hour.',
      },
      {
        title: 'Turn Private Google Access off and try again',
        body: 'Seeing the failure is how you learn to diagnose it. Dataflow jobs with internal IPs fail in the same way when the subnet lacks Private Google Access.',
        concepts: [2],
        shell: `gcloud compute networks subnets update lab21-subnet --region=us-central1 \\
  --no-enable-private-ip-google-access
gcloud compute ssh lab21-vm --zone=$ZONE --tunnel-through-iap \\
  --command='curl -s -m 8 -o /dev/null -w "%{http_code}\\n" https://storage.googleapis.com/dataflow-samples/shakespeare/kinglear.txt || echo "no route"'
gcloud compute networks subnets update lab21-subnet --region=us-central1 \\
  --enable-private-ip-google-access`,
        check:
          'With Private Google Access off, the Google API call fails too. Turning it back on fixes it.',
      },
      {
        title: 'Create a customer-managed key and a CMEK bucket',
        body: 'With CMEK, Cloud Storage encrypts each object with a key in Cloud KMS that you control. The Cloud Storage service agent needs permission to use the key, and the key must be in the same location as the bucket.',
        concepts: [3],
        console: `1. Open **Security** > **Key Management** > **Create key ring**. Name «lab21-ring», location «us-central1».
2. Create a key «lab21-key»: software protection, symmetric encrypt and decrypt.
3. Create the bucket «PROJECT_ID-lab21» in «us-central1». Under **Data encryption**, choose **Cloud KMS key** and pick «lab21-key». Grant the service agent access when the console asks.
4. Upload any small file, then open it and read **Encryption**.`,
        shell: `gcloud kms keyrings create lab21-ring --location=us-central1
gcloud kms keys create lab21-key --keyring=lab21-ring --location=us-central1 --purpose=encryption
export KEY=projects/$PROJECT_ID/locations/us-central1/keyRings/lab21-ring/cryptoKeys/lab21-key
gcloud storage service-agent --authorize-cmek=$KEY
gcloud storage buckets create gs://$BUCKET --location=us-central1 \\
  --uniform-bucket-level-access --default-encryption-key=$KEY
echo "pipeline secret" > secret.txt
gcloud storage cp secret.txt gs://$BUCKET/
gcloud storage objects describe gs://$BUCKET/secret.txt --format="value(kms_key)"`,
        check:
          'The object’s encryption shows «lab21-key» with a version suffix such as «/cryptoKeyVersions/1».',
      },
      {
        title: 'Switch the key off and watch the data lock',
        body: 'Disabling the key version makes every object encrypted with it unreadable, at once and everywhere. That control is why regulated companies ask for CMEK. The change usually applies within a few minutes.',
        concepts: [3],
        shell: `gcloud kms keys versions disable 1 --key=lab21-key --keyring=lab21-ring --location=us-central1
sleep 60
gcloud storage cat gs://$BUCKET/secret.txt
gcloud kms keys versions enable 1 --key=lab21-key --keyring=lab21-ring --location=us-central1`,
        check:
          'While the version is disabled, the read fails with a KMS permission or key state error. After you enable it again, the read prints «pipeline secret». If the read still works after a minute, wait another minute and retry.',
      },
    ],
    cleanup: [
      {
        title: 'Delete the VM, the firewall rule and the network',
        body: 'Delete in this order: the VM, then the rule, then the subnet, then the network. The boot disk is deleted with the VM.',
        concepts: [],
        console:
          '1. Delete the VM «lab21-vm».\n2. Delete the firewall rule «lab21-allow-iap».\n3. Open «lab21-vpc», delete the subnet «lab21-subnet», then delete the network.',
        shell: `gcloud compute instances delete lab21-vm --zone=$ZONE --quiet
gcloud compute firewall-rules delete lab21-allow-iap --quiet
gcloud compute networks subnets delete lab21-subnet --region=us-central1 --quiet
gcloud compute networks delete lab21-vpc --quiet`,
      },
      {
        title: 'Delete the bucket, then destroy the key version',
        body: 'Delete the data first: once the key version is destroyed, nobody can ever read objects encrypted with it. Destruction runs after a waiting period (30 days by default) and the version stops costing money.',
        concepts: [],
        console:
          '1. Delete the bucket «PROJECT_ID-lab21».\n2. In **Key Management**, open «lab21-ring» > «lab21-key», select version 1 and click **Destroy**.',
        shell: `gcloud storage rm --recursive gs://$BUCKET
gcloud kms keys versions destroy 1 --key=lab21-key --keyring=lab21-ring --location=us-central1
rm -f secret.txt`,
      },
    ],
    verify: `gcloud compute instances list --filter="name~lab21" --format="value(name)" | grep . || echo "No lab21 VM left"
gcloud compute networks list --filter="name~lab21" --format="value(name)" | grep . || echo "No lab21 network left"
gcloud storage ls | grep lab21 || echo "No lab21 bucket left"
gcloud kms keys versions list --key=lab21-key --keyring=lab21-ring --location=us-central1 --format="value(name, state)"`,
  },
  {
    station: 'building-pipelines',
    title: 'Stream, window, clean and enrich ride events',
    scenario:
      'Ride events arrive out of order and with duplicates. You publish them to Pub/Sub, stream them into BigQuery with no code, count them in event-time windows with Beam, run a managed Dataflow job, try serverless Spark, and score rider comments with an AI API.',
    minutes: 75,
    apis: [
      'pubsub.googleapis.com',
      'bigquery.googleapis.com',
      'storage.googleapis.com',
      'dataflow.googleapis.com',
      'dataproc.googleapis.com',
      'language.googleapis.com',
      'compute.googleapis.com',
    ],
    vars: { BUCKET: '$PROJECT_ID-lab22' },
    creates: [
      'Pub/Sub topic «lab22-rides» with subscriptions «lab22-pull» and «lab22-to-bq»',
      'BigQuery dataset «lab22»',
      'Cloud Storage bucket «PROJECT_ID-lab22»',
      'Dataflow job «lab22-wordcount» (batch, ends by itself)',
      'Optional: a Dataproc Serverless batch (ends by itself)',
      'A Python virtual environment «~/lab22-venv» in Cloud Shell',
    ],
    cost: 'About 10 to 25 cents. The Dataflow word count runs for a few minutes on one or two small workers. The optional Spark batch costs a few cents. Everything else stays in the free tier.',
    freeTier: [
      'Pub/Sub gives 10 GiB of messages each month.',
      'The Natural Language API gives 5,000 units of sentiment analysis each month.',
      'Beam on your Cloud Shell runs for free: the local runner uses no cloud workers.',
    ],
    files: [
      {
        name: 'events.jsonl',
        about: '12 ride events: two duplicates, one bad fare and one late arrival.',
        content: EVENTS,
      },
      {
        name: 'beam_windows.py',
        about: 'A Beam pipeline: event time, one-minute windows, dedupe, count per city.',
        content: BEAM,
      },
    ],
    steps: [
      {
        title: 'Publish events and pull them back',
        body: 'Pub/Sub decouples producers from consumers. A pull subscriber asks for messages and acknowledges each one; an unacknowledged message comes back after the ack deadline. That is at-least-once delivery, and it is why the dedupe step later matters.',
        concepts: [1],
        console:
          '1. Open **Pub/Sub** > **Topics** > **Create topic**. ID «lab22-rides». Untick **Add a default subscription**. Create.\n2. Open the topic > **Subscriptions** > **Create subscription**. ID «lab22-pull», delivery **Pull**, ack deadline 20 seconds. Create.\n3. On the topic, open **Messages** > **Publish message** and publish one line of «events.jsonl».\n4. On the subscription, open **Messages** > **Pull**, tick **Enable ack messages**, and pull.',
        shell: `gcloud pubsub topics create lab22-rides
gcloud pubsub subscriptions create lab22-pull --topic=lab22-rides --ack-deadline=20
while read -r line; do
  gcloud pubsub topics publish lab22-rides --message="$line" --attribute=source=lab
done < events.jsonl
gcloud pubsub subscriptions pull lab22-pull --limit=5 --auto-ack`,
        check:
          'The pull returns up to 5 messages with their data, message IDs and the attribute «source=lab».',
      },
      {
        title: 'Stream into BigQuery with a BigQuery subscription',
        body: 'For "land the stream as-is", you need no pipeline: a BigQuery subscription writes each message to a table. The Pub/Sub service agent needs BigQuery Data Editor on the table. A subscription only gets messages published after it exists, so you publish again.',
        concepts: [1, 6],
        shell: `export PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
bq mk --dataset --location=us-central1 lab22
bq mk --table lab22.rides_raw data:STRING
bq add-iam-policy-binding \\
  --member=serviceAccount:service-$PROJECT_NUMBER@gcp-sa-pubsub.iam.gserviceaccount.com \\
  --role=roles/bigquery.dataEditor $PROJECT_ID:lab22.rides_raw
gcloud pubsub subscriptions create lab22-to-bq --topic=lab22-rides \\
  --bigquery-table=$PROJECT_ID:lab22.rides_raw
while read -r line; do
  gcloud pubsub topics publish lab22-rides --message="$line"
done < events.jsonl`,
        sql: `SELECT
  JSON_VALUE(data, '$.event_id') AS event_id,
  JSON_VALUE(data, '$.city') AS city,
  CAST(JSON_VALUE(data, '$.fare') AS NUMERIC) AS fare
FROM lab22.rides_raw
ORDER BY event_id;`,
        check:
          'After a few seconds the query returns 12 rows, duplicates included: Pub/Sub delivered what was published.',
      },
      {
        title: 'Load the same file as a batch',
        body: 'A load job is the cheapest way into BigQuery: load jobs are free, while streaming writes are billed per byte. Use streaming only when the business needs the data in seconds.',
        concepts: [6],
        console:
          '1. In BigQuery, open «lab22» > **Create table**. Source **Upload**, file «events.jsonl», format **JSONL**, table «rides_batch», schema **Auto detect**. Create.',
        shell:
          'bq load --source_format=NEWLINE_DELIMITED_JSON --autodetect lab22.rides_batch events.jsonl',
        check:
          '«lab22.rides_batch» has 12 rows with typed columns: «fare» is a FLOAT and «event_time» a TIMESTAMP.',
      },
      {
        title: 'Clean and deduplicate in SQL',
        body: 'Keep one row per «event_id», drop invalid fares, and keep the rejects visible. In a stream, the same rule runs in Dataflow with a state store or a «QUALIFY» over a short lookback window.',
        concepts: [8],
        sql: `CREATE OR REPLACE TABLE lab22.rides AS
SELECT * EXCEPT (rn)
FROM (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY event_id ORDER BY event_time) AS rn
  FROM lab22.rides_batch
  WHERE fare > 0
)
WHERE rn = 1;

SELECT city, COUNT(*) AS rides FROM lab22.rides GROUP BY city ORDER BY city;`,
        check:
          'LON 2, NYC 3, SF 4: 9 rides from 12 events, after 2 duplicates and 1 negative fare.',
      },
      {
        title: 'Window by event time with Apache Beam',
        body: 'Beam separates what you compute (count per city) from where in event time (one-minute fixed windows). Event «e09» arrives late in the file but happened at 08:00:30, so Beam puts it in the 08:00 window. In a stream, the **watermark** decides when a window is complete, and **allowed lateness** with **triggers** decides what happens to data that arrives after that.',
        concepts: [2, 3],
        shell: `python3 -m venv ~/lab22-venv
~/lab22-venv/bin/pip install --quiet apache-beam
~/lab22-venv/bin/python beam_windows.py 2>/dev/null | sort`,
        check:
          'Seven lines. «08:00-08:01 SF 3 rides» includes the late event e09 and counts e03 once. «08:02-08:03 LON 1 rides»: e07 was dropped for its negative fare and e10 was counted once.',
      },
      {
        title: 'Run a managed Dataflow job',
        body: 'Dataflow runs Beam pipelines on managed workers: it scales them, rebalances work, and shows the job graph and logs. Google’s templates run with no code. Workers use the project’s default network and the Compute Engine default service account; if the job fails at start, the job log names the missing network or role.',
        concepts: [4],
        console:
          '1. Open **Dataflow** > **Create job from template**. Name «lab22-wordcount», region «us-central1», template **Word Count**.\n2. Input file «gs://dataflow-samples/shakespeare/kinglear.txt». Output «gs://PROJECT_ID-lab22/wordcount/out». Temporary location «gs://PROJECT_ID-lab22/temp».\n3. Run the job. Open it and watch the job graph, the worker count and the logs.',
        shell: `gcloud storage buckets create gs://$BUCKET --location=us-central1 --uniform-bucket-level-access
gcloud dataflow jobs run lab22-wordcount --region=us-central1 \\
  --gcs-location=gs://dataflow-templates-us-central1/latest/Word_Count \\
  --staging-location=gs://$BUCKET/temp \\
  --parameters=inputFile=gs://dataflow-samples/shakespeare/kinglear.txt,output=gs://$BUCKET/wordcount/out
gcloud dataflow jobs list --region=us-central1 --limit=1
# When the job state is Done:
gcloud storage cat "gs://$BUCKET/wordcount/out*" | sort -t: -k2 -nr | head -5`,
        check:
          'The job reaches **Succeeded** in about 4 to 6 minutes. The top words are short ones such as «the», «I» and «and», with counts in the hundreds.',
      },
      {
        title: 'Optional: run Spark without a cluster',
        body: 'Dataproc Serverless runs a Spark batch with no cluster to size or delete. It needs Private Google Access on the subnet it uses, so the first command turns it on for the default subnet; leaving it on is free. This step costs a few cents.',
        concepts: [5],
        shell: `gcloud compute networks subnets update default --region=us-central1 --enable-private-ip-google-access
gcloud dataproc batches submit spark --region=us-central1 \\
  --class=org.apache.spark.examples.SparkPi \\
  --jars=file:///usr/lib/spark/examples/jars/spark-examples.jar -- 1000`,
        check:
          'The output ends with «Pi is roughly 3.14…». For a recurring Spark job that needs custom tuning, an ephemeral Dataproc cluster per job is the other common answer.',
      },
      {
        title: 'Choose between Kafka, Pub/Sub and Spark streaming',
        body: 'No resources here: answer the design question. A team runs Kafka with Kafka Streams apps and Spark Structured Streaming jobs on premises, and wants to move to Google Cloud with the least rewrite. Then a second team starts a new event pipeline from scratch. What does each team use?',
        concepts: [7],
        check:
          'Team one: Google Cloud Managed Service for Apache Kafka keeps the Kafka API and the Streams apps; Spark jobs move to Dataproc. Team two: Pub/Sub and Dataflow, which are serverless and need no partitions or brokers to size. Pick Kafka when you need its API, log compaction or replay by offset across many consumers.',
      },
      {
        title: 'Enrich comments with an AI API',
        body: 'Enrichment adds a field the source did not have. Here the Natural Language API scores the sentiment of a rider comment; in a pipeline, a Dataflow step or a BigQuery remote function makes the same call per row, with batching and retries.',
        concepts: [9],
        shell: `for text in "Smooth ride, friendly driver" "Driver was late and rude"; do
  curl -s -X POST -H "Authorization: Bearer $(gcloud auth print-access-token)" \\
    -H "x-goog-user-project: $PROJECT_ID" -H "Content-Type: application/json" \\
    "https://language.googleapis.com/v2/documents:analyzeSentiment" \\
    -d "$(jq -n --arg t "$text" '{document: {type: "PLAIN_TEXT", content: $t}}')" \\
    | jq --arg t "$text" '{comment: $t, score: .documentSentiment.score}'
done`,
        check: 'The first comment scores above 0, the second below 0. Scores run from −1 to 1.',
      },
    ],
    cleanup: [
      {
        title: 'Delete the subscriptions and the topic',
        body: 'Delete subscriptions before the topic. A subscription with no topic keeps its backlog until it expires.',
        concepts: [],
        console:
          '1. In **Pub/Sub** > **Subscriptions**, delete «lab22-pull» and «lab22-to-bq».\n2. In **Topics**, delete «lab22-rides».',
        shell: `gcloud pubsub subscriptions delete lab22-pull lab22-to-bq --quiet
gcloud pubsub topics delete lab22-rides --quiet`,
      },
      {
        title: 'Confirm no job is still running',
        body: 'Both jobs are batches and end on their own. A streaming Dataflow job would run, and bill, until you drain or cancel it. Always check.',
        concepts: [],
        console:
          '1. Open **Dataflow** > **Jobs**: no job is **Running**.\n2. Open **Dataproc** > **Batches**: no batch is **Running**.',
        shell: `gcloud dataflow jobs list --region=us-central1 --status=active
gcloud dataproc batches list --region=us-central1 --filter="state=RUNNING"`,
      },
      {
        title: 'Delete the dataset, the bucket and the local files',
        body: 'Dataflow staging and temporary files are in the bucket, so deleting it removes them too.',
        concepts: [],
        console: '1. Delete the dataset «lab22».\n2. Delete the bucket «PROJECT_ID-lab22».',
        shell: `bq rm -r -f -d lab22
gcloud storage rm --recursive gs://$BUCKET
rm -rf ~/lab22-venv events.jsonl beam_windows.py`,
      },
    ],
    verify: `gcloud pubsub topics list --format="value(name)" | grep lab22 || echo "No lab22 topic left"
gcloud pubsub subscriptions list --format="value(name)" | grep lab22 || echo "No lab22 subscription left"
bq ls | grep lab22 || echo "No lab22 dataset left"
gcloud storage ls | grep lab22 || echo "No lab22 bucket left"`,
  },
  {
    station: 'operationalizing-pipelines',
    title: 'Orchestrate a daily job with Workflows and Cloud Scheduler',
    scenario:
      'A daily summary table must rebuild every hour from raw trips, safely re-run after a failure, and change only through a reviewed, versioned deploy. Composer would cost hundreds of dollars a month for this one job, so you build it serverless.',
    minutes: 45,
    apis: [
      'workflows.googleapis.com',
      'cloudscheduler.googleapis.com',
      'bigquery.googleapis.com',
      'iam.googleapis.com',
    ],
    vars: { SA: 'lab23-runner@$PROJECT_ID.iam.gserviceaccount.com' },
    creates: [
      'BigQuery dataset «lab23» with tables «trips» and «daily_city»',
      'Service account «lab23-runner» and its project roles',
      'Workflow «lab23-daily»',
      'Cloud Scheduler job «lab23-hourly»',
    ],
    cost: 'Free in practice. Workflows gives 5,000 internal steps a month, and Cloud Scheduler gives 3 jobs per billing account.',
    freeTier: [
      'Do not create a Cloud Composer environment for practice: an environment bills every hour it exists, often more than $300 a month.',
      'Pause or delete the scheduler job at the end, so it does not run every hour.',
    ],
    files: [
      {
        name: 'workflow.yaml',
        about: 'A workflow that MERGEs the daily summary, then logs and returns its row count.',
        content: WORKFLOW,
      },
    ],
    steps: [
      {
        title: 'Create the source and the target tables',
        body: 'The raw table gets new trips; the summary table is rebuilt from it. A MERGE makes the rebuild **idempotent**: running it twice gives the same result as running it once, which is what makes retries safe.',
        concepts: [1],
        sql: `CREATE SCHEMA IF NOT EXISTS lab23 OPTIONS (location = 'us-central1');

CREATE OR REPLACE TABLE lab23.trips AS
SELECT * FROM UNNEST([
  STRUCT(1 AS trip_id, 'SF' AS city, TIMESTAMP '2026-03-01 08:10:00' AS pickup_ts, 14.5 AS fare),
  (2, 'SF', TIMESTAMP '2026-03-01 09:30:00', 22.0),
  (3, 'NYC', TIMESTAMP '2026-03-01 10:00:00', 31.2),
  (4, 'NYC', TIMESTAMP '2026-03-02 08:45:00', 12.6),
  (5, 'LON', TIMESTAMP '2026-03-02 11:20:00', 18.0)
]);

CREATE OR REPLACE TABLE lab23.daily_city (
  day DATE, city STRING, trips INT64, revenue FLOAT64
);`,
        check: '«lab23.trips» has 5 rows and «lab23.daily_city» is empty.',
      },
      {
        title: 'Create a runner identity with only what it needs',
        body: 'The workflow runs as its own service account: it may run BigQuery jobs, edit one dataset, and write logs. The scheduler uses the same account to start the workflow.',
        concepts: [1, 2],
        shell: `gcloud iam service-accounts create lab23-runner --display-name="Lab 2.3 runner"
for role in roles/bigquery.jobUser roles/logging.logWriter roles/workflows.invoker; do
  gcloud projects add-iam-policy-binding $PROJECT_ID \\
    --member=serviceAccount:$SA --role=$role --condition=None --quiet > /dev/null
done
bq query --use_legacy_sql=false \\
  "GRANT \\\`roles/bigquery.dataEditor\\\` ON SCHEMA lab23 TO 'serviceAccount:$SA'"`,
        check:
          'In **IAM**, «lab23-runner» has BigQuery Job User, Logs Writer and Workflows Invoker. The dataset «lab23» lists it as a Data Editor.',
      },
      {
        title: 'Deploy and run the workflow',
        body: 'Workflows calls the BigQuery API through a connector, which waits for the job to finish and retries on transient errors. Run it twice and compare: the row count must not change.',
        concepts: [1],
        console:
          '1. Open **Workflows** > **Create**. Name «lab23-daily», region «us-central1», service account «lab23-runner». Next.\n2. Paste the contents of «workflow.yaml» and click **Deploy**.\n3. Click **Execute** twice. Open each execution and read its output and logs.',
        shell: `gcloud workflows deploy lab23-daily --source=workflow.yaml --location=us-central1 \\
  --service-account=$SA
gcloud workflows run lab23-daily --location=us-central1 --format="value(result)"
gcloud workflows run lab23-daily --location=us-central1 --format="value(result)"`,
        check: 'Both runs return «"4"»: four day-and-city rows, the same after the second run.',
      },
      {
        title: 'Schedule it with Cloud Scheduler',
        body: 'Cloud Scheduler is cron as a service. It calls the Workflows executions API with an OAuth token for the runner account. Use the scheduler for "run this at a time"; use Workflows for "run these steps in order, with retries".',
        concepts: [1],
        console:
          '1. Open the workflow > **Triggers** > **Add new trigger** > **Cloud Scheduler**.\n2. Name «lab23-hourly», frequency «0 * * * *», time zone UTC, service account «lab23-runner». Create.\n3. Open **Cloud Scheduler**, select «lab23-hourly» and click **Force run**.',
        shell: `gcloud scheduler jobs create http lab23-hourly --location=us-central1 \\
  --schedule="0 * * * *" --time-zone=UTC --http-method=POST \\
  --uri="https://workflowexecutions.googleapis.com/v1/projects/$PROJECT_ID/locations/us-central1/workflows/lab23-daily/executions" \\
  --oauth-service-account-email=$SA
gcloud scheduler jobs run lab23-hourly --location=us-central1
sleep 20
gcloud workflows executions list lab23-daily --location=us-central1 --limit=3`,
        check: 'A third execution appears, started by the scheduler, with state **SUCCEEDED**.',
      },
      {
        title: 'Change the pipeline the CI/CD way',
        body: 'Treat the workflow and its SQL as code. A CI job checks the SQL with a free dry run, then deploys; every deploy makes a new revision you can trace. Here you add a new trip, check the SQL, and redeploy.',
        concepts: [2],
        shell: `bq query --use_legacy_sql=false --dry_run \\
  'SELECT DATE(pickup_ts) AS day, city, COUNT(*) AS trips FROM lab23.trips GROUP BY day, city'
bq query --use_legacy_sql=false \\
  "INSERT lab23.trips VALUES (6, 'LON', TIMESTAMP '2026-03-03 07:00:00', 9.9)"
gcloud workflows deploy lab23-daily --source=workflow.yaml --location=us-central1 \\
  --service-account=$SA
gcloud workflows describe lab23-daily --location=us-central1 --format="value(revisionId)"
gcloud workflows run lab23-daily --location=us-central1 --format="value(result)"`,
        check:
          'The dry run prints the bytes it would read and runs nothing. The revision ID ends in a higher number than before, and the run now returns «"5"».',
      },
      {
        title: 'Pick the orchestrator',
        body: 'Answer before you read the check: (a) 40 dependent tasks across BigQuery, Dataproc and an SFTP server, with backfills; (b) three API calls in order, twice a day; (c) one SQL statement every night; (d) start a job when a file lands in a bucket.',
        concepts: [1],
        check:
          '(a) Cloud Composer (managed Airflow): rich dependencies, operators and backfills. (b) Workflows. (c) a BigQuery scheduled query, or Cloud Scheduler. (d) Eventarc, or a Cloud Storage trigger, starting Workflows or a Cloud Run function.',
      },
    ],
    cleanup: [
      {
        title: 'Delete the scheduler job and the workflow',
        body: 'Delete the scheduler job first, so it does not start a workflow that is being deleted.',
        concepts: [],
        console:
          '1. In **Cloud Scheduler**, delete «lab23-hourly».\n2. In **Workflows**, delete «lab23-daily».',
        shell: `gcloud scheduler jobs delete lab23-hourly --location=us-central1 --quiet
gcloud workflows delete lab23-daily --location=us-central1 --quiet`,
      },
      {
        title: 'Delete the dataset, the roles and the service account',
        body: 'Remove each project role before you delete the account.',
        concepts: [],
        console:
          '1. Delete the dataset «lab23».\n2. In **IAM**, remove the row for «lab23-runner».\n3. In **Service accounts**, delete «lab23-runner».',
        shell: `bq rm -r -f -d lab23
for role in roles/bigquery.jobUser roles/logging.logWriter roles/workflows.invoker; do
  gcloud projects remove-iam-policy-binding $PROJECT_ID \\
    --member=serviceAccount:$SA --role=$role --condition=None --quiet > /dev/null
done
gcloud iam service-accounts delete $SA --quiet
rm -f workflow.yaml`,
      },
    ],
    verify: `gcloud scheduler jobs list --location=us-central1 --format="value(name)" | grep lab23 || echo "No lab23 scheduler job left"
gcloud workflows list --location=us-central1 --format="value(name)" | grep lab23 || echo "No lab23 workflow left"
bq ls | grep lab23 || echo "No lab23 dataset left"
gcloud iam service-accounts list --filter="email~lab23" --format="value(email)" | grep . || echo "No lab23 service account left"`,
  },
];
