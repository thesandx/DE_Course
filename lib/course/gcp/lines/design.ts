/**
 * GCP course, line 1: Designing data processing systems.
 *
 * Generated from Sandeep's PDE Exam Lab module and kept as data. Edit the
 * text here; see lib/course/gcp/README.md for the rules.
 */

import type { GcpLine } from '@/types/gcp';

export const line: GcpLine = {
  slug: 'design',
  number: 1,
  title: 'Designing data processing systems',
  short: 'Design',
  weight: 22,
  hue: 3,
  intro:
    'How you lay out projects, access, encryption, reliability and migrations before a single pipeline runs. Questions here are long scenarios where two answers work and one fits the constraints (least privilege, lowest ops, data must stay in-region).',
  boss: {
    title: 'Security Review Board',
    story:
      'Six reviewers, ten questions. Convince them your design is safe, reliable and portable.',
  },
  stations: [
    {
      slug: 'security-compliance',
      code: '1.1',
      title: 'Designing for security and compliance',
      mission:
        'Day one at Cymbal Retail. The CISO slides a list across the desk: analysts can see every table, card numbers sit in plain columns, and an auditor wants to know who could copy data out. Lock it down without slowing anyone down.',
      concepts: [
        {
          title: 'IAM model and least privilege',
          body: "IAM answers **who** (principal: user, group, service account, domain) can do **what** (role = bundle of permissions) on **which resource**. Policies are set on the resource hierarchy «Organization → Folder → Project → Resource» and are **inherited downward**. The effective policy is the union of all grants; a broad grant high up cannot be undone by a narrower grant lower down (only IAM deny policies subtract).\n\n### Role types\n\n- **Basic** (Owner / Editor / Viewer): project-wide and far too broad. On the exam they are almost always the wrong answer.\n- **Predefined**: per-service roles maintained by Google. The default correct choice.\n- **Custom**: your own permission set, when no predefined role is narrow enough.\n\n### BigQuery roles you must know\n\n| Role | Lets the principal… |\n|---|---|\n| «bigquery.dataViewer» | Read table data and metadata (on dataset/table) |\n| «bigquery.dataEditor» | Read + modify table data, create tables |\n| «bigquery.dataOwner» | Full control of the dataset incl. sharing |\n| «bigquery.jobUser» | Run jobs (queries, loads) in a project — no data access by itself |\n| «bigquery.user» | Run jobs + create datasets + list datasets |\n| «bigquery.admin» | Everything |\n\nThe classic analyst pattern: **jobUser on the billing project + dataViewer on the specific dataset**. Grant roles to **groups**, not individuals, so access follows team membership.\n\n### Service accounts\n\nIdentity for workloads (Dataflow workers, Composer, Cloud Run). Give each pipeline its own SA with only the roles it needs. Prefer attached SAs or impersonation over downloaded JSON keys; Workload Identity Federation lets external workloads (AWS, GitHub Actions) authenticate without keys.\n\n### Organization policies\n\nGuardrails that restrict configuration regardless of IAM: «gcp.resourceLocations» (where resources may live), «gcp.restrictNonCmekServices» (force CMEK), domain-restricted sharing (only your org's identities), disable SA key creation.\n\n> [!trap] Exam traps\n> Giving the consultant/analyst Project Viewer or Editor when a dataset-level role suffices.\n>\n> Thinking a lower-level grant can remove access granted at the folder or org.\n>\n> Using a shared service account key so an external person can 'log in with it'.\n\n### Keyword signals\n\n| When the question says | Think |\n|---|---|\n| 'minimum access needed to do their job' | Predefined role at the narrowest resource, granted to a group |\n| 'run queries but only see dataset X' | jobUser on project + dataViewer on dataset X |\n| 'prevent anyone creating resources outside the EU' | Org policy gcp.resourceLocations |",
        },
        {
          title: 'Fine-grained BigQuery access: views, rows, columns, masking',
          body: "BigQuery offers access control at five levels. Pick the coarsest that meets the requirement.\n\n1. **Dataset** IAM — the usual unit of access. Put each client/tenant in its own dataset to isolate them.\n2. **Table / view** IAM — grant on a single table.\n3. **Authorized view** — a view in dataset B is authorized to read dataset A. Users get access to B only, so they see the view's output but never the source tables. Also **authorized datasets** (every view in a dataset is authorized) and **authorized routines** (UDFs/table functions).\n4. **Row-level security** — «CREATE ROW ACCESS POLICY … GRANT TO (...) FILTER USING (region = 'APAC')». One table, each group sees only its rows.\n5. **Column-level security** — tag columns with **policy tags** from a taxonomy; only principals with Fine-Grained Reader on the tag can read them. Add **dynamic data masking** so others see a masked value (nullify, SHA-256 hash, default value, email mask, first/last 4 chars) instead of an error.\n\nFor encryption of individual values inside a column, BigQuery has **AEAD functions** («AEAD.ENCRYPT», «DETERMINISTIC_ENCRYPT»); deleting a per-user keyset makes that user's values unreadable (crypto-deletion).\n\n> [!trap] Exam traps\n> Copying data into many filtered tables to restrict access — use row policies or authorized views instead.\n>\n> Expecting policy tags to work without granting Fine-Grained Reader to the readers who should see the column.\n\n### Keyword signals\n\n| When the question says | Think |\n|---|---|\n| 'share query results without exposing source tables' | Authorized view |\n| 'sales reps only see their own region's rows' | Row access policy |\n| 'analysts can query the table but SSN must be hidden' | Policy tag + dynamic data masking |",
        },
        {
          title: 'Encryption and key management',
          body: "All data at rest in Google Cloud is encrypted by default with Google-managed keys; all data in transit between Google services uses TLS. The exam asks **who controls the key**.\n\n| Option | Who holds the key | Use when |\n|---|---|---|\n| Google default | Google | No requirement stated |\n| **CMEK** (Cloud KMS) | You, in Cloud KMS; you control rotation, IAM, disable/destroy | \"Customer-managed keys\", rotation control, crypto-shredding, audit of key use |\n| CMEK + **Cloud HSM** | You, in FIPS 140-2 Level 3 hardware | Regulation requires HSM-backed keys |\n| **Cloud EKM** | External key manager outside Google | Keys must never reside in Google Cloud |\n| **CSEK** | You supply raw key per request | Only Cloud Storage and Compute Engine; rare |\n\n**Envelope encryption**: data is encrypted with a data encryption key (DEK); the DEK is wrapped by a key encryption key (KEK) held in KMS. Rotating the KEK doesn't re-encrypt data; old key versions stay available to decrypt. **Cloud KMS Autokey** provisions CMEKs automatically at resource creation.\n\nBigQuery, Cloud Storage, Pub/Sub, Dataflow, Dataproc, Spanner, Bigtable, Cloud SQL and Composer all support CMEK. The key must be in a location compatible with the resource (a dataset in «EU» needs a key in «europe»/EU).\n\n> [!trap] Exam traps\n> Choosing client-side encryption in the app when the requirement is just 'we must control rotation' — CMEK is enough.\n>\n> CSEK for BigQuery (not supported).\n\n### Keyword signals\n\n| When the question says | Think |\n|---|---|\n| 'company must manage and rotate its own keys' | CMEK in Cloud KMS |\n| 'keys must stay in our own on-prem HSM' | Cloud EKM |\n| 'destroy a customer's data instantly on offboarding' | Destroy their CMEK / AEAD keyset (crypto-shredding) |",
        },
        {
          title: 'PII and Sensitive Data Protection (Cloud DLP)',
          body: "Sensitive Data Protection (still called **Cloud DLP** in many questions) **discovers**, **classifies** and **de-identifies** sensitive data. It detects 150+ built-in infoTypes (EMAIL_ADDRESS, CREDIT_CARD_NUMBER, IN_AADHAAR…) plus custom dictionaries/regex.\n\n### Ways to use it\n\n- **Discovery / data profiling** across BigQuery, Cloud SQL and Cloud Storage — finds where PII lives org-wide.\n- **Inspection jobs** on a table or bucket.\n- **Inline content API** called from Dataflow to de-identify records in flight before they land.\n\n### De-identification transforms\n\n| Transform | Reversible? | Keeps joins? | Typical use |\n|---|---|---|---|\n| Redaction / masking («***») | No | No | Display-only data |\n| Cryptographic hash (HMAC) | No | Yes (same input → same token) | Join on IDs without revealing them |\n| Deterministic encryption | Yes, with key | Yes | Analysts join; authorised team can re-identify |\n| Format-preserving encryption (FPE-FFX) | Yes | Yes | Output must keep original format/length (e.g. 16-digit card) |\n| Bucketing / generalisation | No | No | Ages → ranges, ZIP → prefix |\n| Date shifting | Yes (consistent) | Intervals kept | Medical timelines |\n\n**Risk analysis** (k-anonymity, l-diversity) measures re-identification risk of quasi-identifiers. For working with an outside party, the safest pattern is an **anonymised or de-identified sample in a separate project**.\n\n> [!trap] Exam traps\n> Using hashing when the business later needs the original value back — choose deterministic encryption/FPE.\n>\n> Granting an external consultant access to production PII instead of a de-identified copy.\n\n### Keyword signals\n\n| When the question says | Think |\n|---|---|\n| 'find all PII across 2,000 BigQuery tables' | Sensitive Data Protection discovery/profiling |\n| 'mask card numbers but keep the format' | FPE-FFX |\n| 'analysts must join on customer ID without seeing it' | Deterministic encryption or crypto hash tokenization |",
        },
        {
          title: 'Perimeters, network isolation and data sovereignty',
          body: "**VPC Service Controls** draws a service perimeter around projects so Google APIs (BigQuery, GCS, Pub/Sub…) cannot be called to move data out of the perimeter, even by a user with valid IAM. It stops exfiltration (e.g. copying a table to a personal project). Access levels (IP, device) allow controlled entry; perimeter bridges connect two perimeters.\n\n**Private Google Access** lets VMs without external IPs (e.g. Dataflow workers launched with «--no_use_public_ips») reach Google APIs. **Private Service Connect** exposes Google APIs or managed services on a private IP in your VPC.\n\n### Sovereignty and residency\n\n- A BigQuery dataset's **location is set at creation and cannot change**; to move it, copy the dataset (BigQuery DTS dataset copy) or export/reload.\n- Queries run in the location of the data; you cannot join tables in different locations.\n- Enforce with org policy «gcp.resourceLocations»; **Assured Workloads** packages controls for regimes like FedRAMP, ITAR, EU sovereign controls. **Key Access Justifications** with EKM logs and approves each key access reason.\n\n> [!trap] Exam traps\n> Relying on IAM alone to prevent data copying to another project — that's what VPC-SC is for.\n>\n> Trying to 'change the region' of an existing dataset.\n\n### Keyword signals\n\n| When the question says | Think |\n|---|---|\n| 'prevent data exfiltration even by authorised users' | VPC Service Controls perimeter |\n| 'workers must not have public IPs' | Private Google Access on the subnet + no_use_public_ips |\n| 'data must never leave Germany' | Regional resources + gcp.resourceLocations org policy (+ CMEK in-region) |",
        },
        {
          title: 'Project, dataset and environment architecture',
          body: "- **Separate projects per environment** (dev / test / prod) — independent IAM, quotas, billing and blast radius. Promote code, not data, through environments.\n- **Datasets are the security boundary** in BigQuery: group tables by who needs access, not by topic alone. One dataset per client in multi-tenant setups.\n- Common enterprise split: a **storage project** holding data and **compute/consumer projects** that run queries (each team's slot usage and cost lands in its own project).\n- Use **labels** on datasets, jobs and resources for cost attribution; **Shared VPC** for central network control.\n- **Cloud Audit Logs**: Admin Activity (always on), Data Access (off by default for most services, on for BigQuery), System Event, Policy Denied. To learn \"who is doing what\" before locking down a warehouse, review Data Access audit logs first.\n\n> [!trap] Exam traps\n> Using one project for dev and prod 'to save cost'.\n>\n> Separating tenants with partitions or tables when they need dataset-level isolation and IAM.\n\n### Keyword signals\n\n| When the question says | Think |\n|---|---|\n| 'first step: find out how everyone uses BigQuery today' | Review Cloud Audit Logs (data access) |\n| 'clients must not see each other's data' | One dataset per client + IAM groups per client |",
        },
      ],
      keyPoints: [
        {
          point:
            'Grant the narrowest predefined role, on the smallest resource, to a group. Never to one person, and never a basic role.',
          check: {
            type: 'choice',
            prompt:
              'A data engineer must create and drop tables only in the dataset «staging». Which grant follows least privilege?',
            options: [
              'BigQuery Data Editor on the staging dataset',
              'BigQuery Admin on the project, for convenience',
              'Editor (the basic role) on the whole project',
              'BigQuery Data Owner on every dataset in the project',
            ],
            answers: [0],
            why: 'Data Editor on one dataset allows creating, changing and deleting tables there and nowhere else. Every project-level option reaches all datasets, and the basic Editor role reaches every service in the project.',
          },
          more: "**Shared tables plus private sandboxes:** grant Data Viewer on the shared dataset (read-only), then create one dataset per analyst and grant Data Editor on that dataset only. Data Editor at project level would let every analyst change everyone's sandbox and the shared tables.",
        },
        {
          point:
            'Use the coarsest control that works: dataset, then table, then authorized view, then row policy, then column policy tag.',
          check: {
            type: 'match',
            prompt: 'Match each requirement to the BigQuery control that fits it.',
            pairs: [
              ["Share a query's output but hide the source tables", 'Authorized view'],
              ["Each region's managers see only their region's rows", 'Row access policy'],
              ['Salary column masked for most readers', 'Policy tag with data masking'],
              ["Clients must never see each other's data at all", 'A separate dataset per client'],
            ],
            why: 'Authorized views expose results, not sources. Row access policies filter rows inside one table. Policy tags control columns and can mask them. Datasets are the isolation unit for tenants.',
          },
        },
        {
          point:
            'Encryption at rest is always on. The exam asks who controls the key: Google, you in Cloud KMS (CMEK), you in HSM hardware, or you outside Google (EKM).',
          check: {
            type: 'choice',
            prompt:
              'You rotate a CMEK key in Cloud KMS. What happens to data that was encrypted with the previous key version?',
            options: [
              'It stays encrypted with the old version, which remains available to decrypt it',
              'It is automatically re-encrypted with the new key version within about 24 hours',
              'It becomes unreadable until you re-encrypt it with the new version',
              'The old version is destroyed immediately, together with its data',
            ],
            answers: [0],
            why: 'Rotation only changes which version encrypts new data. Old versions stay enabled for decryption. To get data off a compromised key you must re-encrypt it, for example by copying it into a bucket whose default key is a new key, and then destroy the old one.',
          },
          more: '**Compromised key playbook (Cloud Storage):** create a new key, create a new bucket with that key as its default CMEK, copy the objects across without naming a key so they inherit the default, verify, then disable and destroy the old key. The bucket default also protects future uploads that forget to name a key. Rotating to a new key version does not re-encrypt existing objects.\n\n**"Key material generated and kept only on our own HSM"** means **Cloud EKM**. Importing the key into Cloud KMS or Cloud HSM puts a copy inside Google, which breaks that requirement.',
        },
        {
          point:
            "First find the PII (discovery), then transform it (de-identify) before it reaches people who don't need it.",
          check: {
            type: 'choice',
            prompt:
              'Analysts must join two tables on customer email but must never see real emails, and nobody will ever need the originals back. Which transformation fits best?',
            options: [
              'Keyed cryptographic hash (tokenization)',
              'Redaction with an infoType placeholder',
              'Format-preserving encryption (FPE-FFX)',
              'Bucketing emails into groups by domain name',
            ],
            answers: [0],
            why: "A keyed hash gives the same token for the same email, so joins still work, and it can't be reversed. FPE would also join, but it is reversible: that adds a key you must protect for a re-identification nobody needs. Redaction and bucketing destroy the join key.",
          },
          more: '**Preparing customer data for org-wide analysis:** run Dataflow with Sensitive Data Protection to mask or tokenize sensitive fields in flight, then write to BigQuery. Encrypting fields and handing out the key spreads the secret around, and deleting the fields throws away the analytic value.',
        },
        {
          point:
            "IAM decides who can act. VPC Service Controls decides where data may flow. A dataset's location is fixed when you create it.",
          check: {
            type: 'choice',
            prompt:
              'Finance data in BigQuery must not be readable from any project outside three finance projects, even by people who hold IAM access. What do you configure?',
            options: [
              'A VPC Service Controls perimeter around the three finance projects',
              'Firewall rules on the finance VPC network that block egress',
              "IAM conditions on the datasets that check the caller's project",
              'A VPC Service Controls perimeter around the finance VPC network',
            ],
            answers: [0],
            why: "Perimeters protect Google API calls at the project level, so a copy to an outside project is blocked. Firewalls filter VM network traffic, not BigQuery API calls. Perimeters contain projects, not VPC networks. IAM conditions can't stop an authorized user moving data elsewhere.",
          },
        },
        {
          point:
            'Projects separate environments, quotas and billing. Datasets separate who can see what.',
          check: {
            type: 'choice',
            prompt:
              'Development pipelines sometimes overwrite production tables because dev and prod share one project. What prevents this most reliably?',
            options: [
              'Separate dev and prod projects, each with its own service accounts',
              'Separate datasets in one project, with developers holding Data Editor at project level',
              'Labels such as env=dev on dev tables',
              'Taking a table snapshot before every dev run',
            ],
            answers: [0],
            why: "Separate projects give separate IAM, quotas and billing, so a dev identity simply has no rights in prod. Project-level Data Editor still reaches prod datasets, labels don't enforce anything, and snapshots only help you recover afterwards.",
          },
        },
      ],
    },
    {
      slug: 'reliability-fidelity',
      code: '1.2',
      title: 'Designing for reliability and fidelity',
      mission:
        "The festive sale is six weeks away. Cymbal's order pipeline must ride out a zone outage, keep payments ACID, and stop bad supplier files from poisoning the morning reports.",
      concepts: [
        {
          title: 'Preparing and cleaning data: which tool',
          body: "| Tool | Style | Pick it when |\n|---|---|---|\n| **Dataflow** (Apache Beam) | Code (Java/Python/Go), batch + streaming | Streaming, complex logic, large scale, exactly-once, custom validation with dead-letter outputs |\n| **Dataform** | SQLX in BigQuery, Git-based | ELT inside BigQuery; dependency graph, assertions (tests), documentation, scheduling |\n| **Cloud Data Fusion** | Visual, drag-and-drop (CDAP); runs on ephemeral Dataproc | Code-free ETL, 150+ connectors, enterprise integration, lineage |\n| **Dataprep** (Trifacta/Alteryx) | Visual wrangling, recipes | Business users exploring and cleaning ad-hoc data (older questions) |\n| **Dataproc / Spark** | Spark/Hadoop code | Existing Spark jobs, open-source ecosystem |\n| **Gemini in BigQuery** | LLM-assisted | Generate/explain SQL from natural language, data preparation suggestions, data canvas |\n\n**Prompting LLMs for query generation** (new in the guide): give the model the schema, column descriptions and sample values; ask for one query; validate it with a dry run before execution; never let generated SQL run with broad write permissions. BigQuery also exposes Gemini through SQL («AI.GENERATE», «ML.GENERATE_TEXT») for cleaning free-text fields at scale.\n\n> [!trap] Exam traps\n> Choosing Data Fusion or Dataprep for a high-volume, low-latency streaming requirement.\n>\n> Choosing Dataflow when the team is SQL-only and the data is already in BigQuery (Dataform fits).\n\n### Keyword signals\n\n| When the question says | Think |\n|---|---|\n| 'analysts know SQL, transform data already in BigQuery, version control' | Dataform |\n| 'no-code, graphical pipelines, many connectors' | Cloud Data Fusion |\n| 'stream, exactly-once, custom code' | Dataflow |",
        },
        {
          title: 'Disaster recovery and fault tolerance by service',
          body: "Define **RPO** (how much data you can lose) and **RTO** (how long you can be down), then pick the cheapest design that meets both.\n\n| Service | Built-in protection | DR lever |\n|---|---|---|\n| Cloud Storage | 11 nines durability; dual/multi-region copies | Dual-region + **turbo replication** (RPO 15 min); object versioning; soft delete |\n| BigQuery | Regional with zone redundancy; **time travel** (2–7 days, default 7) + 7-day fail-safe | Table snapshots, cross-region dataset replication, managed disaster recovery (Enterprise Plus) |\n| Cloud SQL | HA config = primary + standby in another zone, synchronous | Cross-region read replica, promote on regional failure; PITR backups |\n| Spanner | Synchronous replication; 99.99% regional, 99.999% multi-region | Multi-region instance config |\n| Bigtable | Replication across clusters (eventual consistency) | App profile with multi-cluster routing = automatic failover |\n| Dataflow | Regional; automatic worker retry; checkpointing | Snapshots of streaming jobs; relaunch in another region; Pub/Sub retains the data |\n| Pub/Sub | Global, synchronous multi-zone storage | Message retention + seek/snapshots to replay |\n\n> [!trap] Exam traps\n> Paying for Spanner multi-region when the stated RPO/RTO is hours.\n>\n> Assuming a Cloud SQL read replica gives automatic failover — HA (standby) does; replicas must be promoted.\n\n### Keyword signals\n\n| When the question says | Think |\n|---|---|\n| 'GCS objects replicated across regions within 15 minutes' | Dual-region bucket + turbo replication |\n| 'restore a BigQuery table as it was yesterday' | Time travel FOR SYSTEM_TIME AS OF |\n| 'survive a zonal failure, Cloud SQL' | HA (regional) configuration |",
        },
        {
          title: 'ACID, consistency and availability trade-offs',
          body: "- **Spanner**: full ACID across rows, tables and regions; external consistency (strongest). Read-write transactions use locking + two-phase commit; read-only transactions take no locks and can read at a past timestamp (stale reads are faster).\n- **Cloud SQL / AlloyDB**: ACID within one primary; scale writes vertically.\n- **Firestore**: ACID transactions, strongly consistent queries, serverless.\n- **Bigtable**: atomic only **per row**; no multi-row transactions; replicated clusters are eventually consistent (single-cluster routing gives read-your-writes).\n- **BigQuery**: multi-statement transactions exist, and DML is atomic, but it is an analytics engine — not for high-rate single-row updates.\n\nRule of thumb: the stronger the consistency and the wider the geography, the more you pay in latency and money. Choose the weakest guarantee the requirement allows.\n\n> [!trap] Exam traps\n> Choosing Bigtable for a requirement that needs multi-row transactions (e.g. moving money between accounts).\n\n### Keyword signals\n\n| When the question says | Think |\n|---|---|\n| 'globally distributed, strongly consistent, relational, horizontal scale' | Spanner |\n| 'financial transactions, regional, < few TB' | Cloud SQL or AlloyDB |",
        },
        {
          title: 'Data validation',
          body: "- **Dataplex data quality scans** (AutoDQ): declare rules (non-null, range, regex, uniqueness, SQL row/aggregate rules) on BigQuery tables; results publish to the catalog and can alert.\n- **Dataplex data profiling**: statistics per column (nulls, distinct, ranges, top values) to discover what \"valid\" looks like.\n- **Dataform assertions**: SQL tests that fail the workflow («uniqueKey», «nonNull», custom).\n- **Data Validation Tool (DVT)**: open-source CLI comparing source vs target after migrations — row counts, column aggregates, row-hash comparisons.\n- In pipelines: validate in a «DoFn» and route failures to a **dead-letter** sink instead of failing the job or silently dropping rows.\n\n> [!trap] Exam traps\n> Setting max_bad_records high and silently losing rows when the requirement says 'analyse the bad records'.\n\n### Keyword signals\n\n| When the question says | Think |\n|---|---|\n| 'verify migrated tables match the source' | Data Validation Tool (counts, checksums) |\n| 'continuous data quality rules on BigQuery' | Dataplex data quality scans |",
        },
      ],
      keyPoints: [
        {
          point:
            "Pick the tool for the people who'll run it: SQL team gets Dataform, no-code team gets Data Fusion or Dataprep, engineers with streams get Dataflow.",
          check: {
            type: 'match',
            prompt: 'Match each team need to the preparation tool.',
            pairs: [
              ['SQL transformations in BigQuery with tests and Git', 'Dataform'],
              ['Drag-and-drop pipelines with 150+ connectors', 'Cloud Data Fusion'],
              ['Streaming with exactly-once and custom code', 'Dataflow'],
              ['Business users wrangling a file visually', 'Dataprep'],
            ],
            why: 'Dataform is ELT in SQL. Data Fusion is visual, connector-rich ETL that runs on ephemeral Dataproc. Dataflow is code-first Beam for batch and streaming. Dataprep is visual wrangling for less technical users.',
          },
          more: '**Business users who clean data visually and then analyse it in a spreadsheet:** Dataprep, then BigQuery, then Connected Sheets. **A GUI pipeline for many file formats into Cloud Storage with your own key on the sink:** Cloud Data Fusion, which supports CMEK.',
        },
        {
          point: 'Write down RPO and RTO first, then buy the cheapest replication that meets both.',
          check: {
            type: 'choice',
            prompt:
              'A pipeline in europe-west1 reads raw files from Cloud Storage. It must survive a regional outage, losing at most 15 minutes of files, with no application changes. Which setup?',
            options: [
              'Dual-region bucket (europe-west1 + europe-west4) with turbo replication',
              'EU multi-region bucket with default replication',
              'Two regional buckets, with an hourly Storage Transfer Service copy job between them',
              'A regional bucket with object versioning',
            ],
            answers: [0],
            why: "Turbo replication is the only option with a 15-minute RPO guarantee, and a dual-region bucket keeps one bucket name, so the app doesn't change. Default replication has no 15-minute guarantee, hourly copies mean up to an hour of loss, and versioning doesn't protect against losing the region.",
          },
        },
        {
          point:
            'The stronger and wider the consistency, the more you pay in latency and money. Choose the weakest guarantee the requirement allows.',
          check: {
            type: 'choice',
            prompt: 'Which database guarantees atomicity only within a single row?',
            options: ['Bigtable', 'Spanner', 'Cloud SQL', 'Firestore'],
            answers: [0],
            why: 'Bigtable writes are atomic per row; there are no multi-row transactions. Spanner, Cloud SQL and Firestore all support multi-row ACID transactions.',
          },
        },
        {
          point:
            'Validate where the data changes: assertions in Dataform, rules in Dataplex, dead letters in Dataflow, DVT after migrations.',
          check: {
            type: 'choice',
            prompt:
              "Your Dataform workflow builds «orders_final». The run must fail if «order_id» has duplicates or NULLs. What's the most direct way?",
            options: [
              "Add uniqueKey and nonNull assertions to the table's config block",
              'Schedule a weekly Dataplex profiling scan on orders_final',
              'Write a JavaScript UDF that throws an error on duplicate IDs',
              'Run a Spark stored procedure after the workflow to check the table',
            ],
            answers: [0],
            why: 'Dataform assertions are SQL checks that run with the workflow and fail it when rows violate them. Profiling only describes data; UDFs and Spark procedures are extra machinery outside the pipeline.',
          },
        },
      ],
    },
    {
      slug: 'flexibility-portability',
      code: '1.3',
      title: 'Designing for flexibility and portability',
      mission:
        'Cymbal just bought a fashion brand that runs on AWS. Leadership wants one view of all the data, but EU customer data has to stay in the EU.',
      concepts: [
        {
          title: 'Portability, open formats and multi-cloud',
          body: "- **Apache Beam** pipelines are portable across runners (Dataflow, Flink, Spark).\n- **Dataproc** runs unmodified open-source Spark, Hadoop, Hive, Presto/Trino, Flink — the lift-and-shift choice.\n- **Open table formats**: Apache Iceberg, Delta Lake, Hudi on Cloud Storage. **BigLake** tables give BigQuery-level fine-grained security over files in GCS, S3 or Azure Blob; **BigLake Iceberg tables in BigQuery** are fully managed Iceberg you can also read from Spark.\n- **BigQuery Omni** queries data in AWS/Azure in place, so it never leaves that cloud (residency).\n- **Containers** (GKE, Cloud Run) keep application logic portable.\n\nMap requirements to architecture: today's volume and latency, expected growth, who consumes data, and which constraints are fixed (region, compliance). Prefer managed, serverless services unless a requirement forces otherwise.\n\n> [!trap] Exam traps\n> Copying S3 data into GCS when the requirement says data must stay in AWS — BigQuery Omni / BigLake.\n\n### Keyword signals\n\n| When the question says | Think |\n|---|---|\n| 'query data in S3 without moving it' | BigQuery Omni with BigLake tables |\n| 'reuse existing Spark jobs with minimal changes' | Dataproc |",
        },
        {
          title: 'Catalog, profiling and discovery (governance)',
          body: "**Dataplex** organises distributed data without moving it:\n\n- **Lake** = a data domain (e.g. Sales). **Zone** = sub-area: raw (any format) or curated (cleaned, columnar: Parquet/Avro/ORC or BigQuery). **Asset** = a GCS bucket or BigQuery dataset, possibly in another project. **Entity** = discovered table/fileset metadata.\n- Discovery auto-registers files as tables queryable from BigQuery and Spark; data quality and profiling scans; central security policies.\n\n**Knowledge Catalog** (formerly Dataplex Universal Catalog, which replaced **Data Catalog**; Data Catalog is discontinued in 2026) is the metadata layer: automatic cataloging of BigQuery, Pub/Sub, Spanner, Bigtable, Vertex/Agent Platform assets; search; business metadata via **aspects** (older questions say \"tags\" and \"tag templates\"); **data lineage**; business glossary; data products. **Policy tags** for BigQuery column security are managed in taxonomies alongside it.\n\n> [!trap] Exam traps\n> Building a custom metadata database when a managed catalog with automatic harvesting exists.\n\n### Keyword signals\n\n| When the question says | Think |\n|---|---|\n| 'users can't find trusted datasets; need search + business context' | Knowledge Catalog / Dataplex catalog with aspects (tags) and glossary |\n| 'organise lakes by domain across many projects without moving data' | Dataplex lakes/zones/assets |",
        },
      ],
      keyPoints: [
        {
          point:
            "Keep compute portable (Beam, Spark, containers) and data open (Iceberg, Parquet). When data can't move, query it where it is.",
          check: {
            type: 'choice',
            prompt:
              "A subsidiary's data lives in Azure Blob Storage and must not leave Azure. Analysts want to query it from BigQuery.",
            options: [
              'BigQuery Omni with BigLake tables over the Azure data',
              'Storage Transfer Service into an EU bucket',
              'Nightly CSV exports loaded into BigQuery',
              'A Dataflow job that copies the Azure data into BigQuery nightly',
            ],
            answers: [0],
            why: 'BigQuery Omni runs the query in Azure and returns results, so the data stays put. Every other option copies the data out of Azure.',
          },
        },
        {
          point:
            'Data nobody can find might as well not exist. Catalog it automatically, add business context, and track lineage.',
          check: {
            type: 'choice',
            prompt:
              'Before changing a column, you need to see which tables and jobs downstream are built from this table. Which capability shows that?',
            options: [
              'Data lineage in Knowledge Catalog (Dataplex)',
              'Cloud Audit Logs for the table, on their own',
              'BigQuery table snapshots from before each run',
              "Policy tags attached to the table's columns",
            ],
            answers: [0],
            why: 'Lineage is recorded automatically for BigQuery, Dataflow, Dataproc and Composer jobs and shows upstream and downstream dependencies. Audit logs list individual calls, not a dependency graph.',
          },
        },
      ],
    },
    {
      slug: 'data-migrations',
      code: '1.4',
      title: 'Designing data migrations',
      mission:
        'The on-prem data centre lease ends in March. 400 TB of history, MySQL, SQL Server and a Hadoop cluster all have to move, and not one row can go missing.',
      concepts: [
        {
          title: 'Moving bytes: transfer options',
          body: "Pick by **data size**, **bandwidth**, and whether it's one-time or recurring. Rough math: **1 TB over 100 Mbps ≈ 1 day**; 1 TB over 1 Gbps ≈ 2.5 hours. If the network transfer would take more than about a week, ship a device.\n\n| Tool | Best for |\n|---|---|\n| «gcloud storage» / gsutil | Small, one-off transfers (< ~1 TB) from a machine |\n| **Storage Transfer Service** | Large/recurring: S3, Azure Blob, HTTP lists, other buckets, on-prem file systems and HDFS via agents. Scheduling, filtering, bandwidth limits |\n| **Transfer Appliance** | Tens of TB to PB with limited bandwidth — physical device shipped to Google |\n| **BigQuery Data Transfer Service** | Scheduled loads into BigQuery from SaaS (Google Ads, YouTube, GA4 export), S3, Azure, Redshift, Teradata; scheduled queries; dataset copies |\n| **Database Migration Service** | Database → Cloud SQL / AlloyDB (MySQL, PostgreSQL, SQL Server, Oracle→Postgres) with continuous replication and minimal downtime |\n| **Datastream** | Serverless CDC from Oracle, MySQL, PostgreSQL, SQL Server, AlloyDB into BigQuery or GCS |\n| **BigQuery Migration Service** | Assessment + batch/interactive **SQL translation** (Teradata, Redshift, Snowflake, Oracle… → GoogleSQL) |\n\n### Networking for migrations\n\n**Cloud VPN** (IPsec over internet, ~3 Gbps per tunnel) for modest needs; **Dedicated Interconnect** (10/100 Gbps physical) or **Partner Interconnect** for sustained high throughput and private connectivity.\n\n> [!trap] Exam traps\n> Uploading 500 TB over a 100 Mbps link (would take over a year).\n>\n> Using Storage Transfer Service to load into BigQuery tables — it moves objects into GCS; use BigQuery DTS or load jobs for tables.\n\n### Keyword signals\n\n| When the question says | Think |\n|---|---|\n| '2 PB on-prem, slow network' | Transfer Appliance |\n| 'daily sync of an S3 bucket to GCS' | Storage Transfer Service |\n| 'replicate MySQL changes to BigQuery continuously' | Datastream |\n| 'move MySQL to Cloud SQL with minimal downtime' | Database Migration Service |",
        },
        {
          title: 'Migration plan and Hadoop moves',
          body: "1. **Assess**: stakeholders, current jobs, SLAs, dependencies, data sizes, who consumes what.\n2. **Plan**: target services, network, security model, cut-over strategy.\n3. **Migrate** in waves; run old and new in parallel.\n4. **Validate** (DVT, reconcile counts and aggregates) before switching consumers.\n5. **Optimise** once stable (partitioning, slots, autoscaling).\n\n### Hadoop → Google Cloud mapping\n\n| On-prem | Target |\n|---|---|\n| HDFS storage | **Cloud Storage** via the GCS connector («gs://» instead of «hdfs://») — decouples storage from compute so clusters can be deleted |\n| Spark / MapReduce / Hive jobs | Dataproc (lift and shift), later Dataproc Serverless or BigQuery |\n| Hive warehouse | BigQuery (or Dataproc Metastore + Hive) |\n| HBase | Bigtable (HBase API compatible) |\n| Kafka | Pub/Sub or Managed Service for Apache Kafka |\n| Oozie / cron | Cloud Composer |\n\nDataproc is now branded **Managed Service for Apache Spark**; APIs, CLI («gcloud dataproc») and exam questions still say Dataproc.\n\n> [!trap] Exam traps\n> Keeping data on persistent-disk HDFS in Dataproc — expensive, and the data dies with the cluster.\n>\n> Migrating everything at once with no validation phase.\n\n### Keyword signals\n\n| When the question says | Think |\n|---|---|\n| 'reuse Hadoop jobs, minimise cluster management, data must outlive the cluster' | Dataproc + Cloud Storage connector |\n| 'CIO worried about cost of 50 TB persistent disk per node' | Put the data in Cloud Storage |",
        },
      ],
      keyPoints: [
        {
          point:
            'Do the maths first: 1 TB over 100 Mbps takes about a day. If the network needs weeks, ship a Transfer Appliance.',
          check: {
            type: 'choice',
            prompt:
              'You must copy 80 TB from an on-prem NAS to Cloud Storage over a 10 Gbps Interconnect, then keep syncing new files every day.',
            options: [
              'Storage Transfer Service with on-premises agents',
              'Transfer Appliance, then a nightly gcloud sync',
              'BigQuery Data Transfer Service from the NAS',
              'gcloud storage cp from an admin laptop each night',
            ],
            answers: [0],
            why: "80 TB at about 8 Gbps effective takes roughly 22 hours, so an online transfer is fine, and Storage Transfer Service agents handle the daily incremental syncs. An appliance means weeks of shipping, BigQuery DTS loads tables rather than files, and a laptop won't sustain it.",
          },
          more: "**Datastream into a private VPC:** for a source database with no public IP (Oracle on a VM, say), create a private connectivity configuration to the VPC, a source connection profile and a BigQuery destination profile. It's serverless, so there are no Kafka or Debezium connectors to run.",
        },
        {
          point:
            'Assess, plan, migrate in waves, validate, then optimize. For Hadoop: Dataproc for compute, Cloud Storage instead of HDFS, Composer for Airflow.',
          check: {
            type: 'order',
            prompt: 'Put the phases of a migration in order.',
            steps: [
              'Assess current jobs, users and SLAs',
              'Plan the target architecture and cut-over',
              'Migrate in waves, running old and new side by side',
              'Validate results against the source',
              'Optimize cost and performance',
            ],
            why: "You can't plan without knowing what exists. Running in parallel makes validation possible, and optimizing only makes sense once the new system is correct.",
          },
          more: '**Already on Airflow?** Cloud Composer is managed Airflow, so hundreds of existing DAGs move with minimal change. Converting them to Dataflow or Data Fusion would be a rewrite.',
        },
      ],
    },
  ],
};
