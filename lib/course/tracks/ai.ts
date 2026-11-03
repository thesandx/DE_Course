import type { Problem, Track } from '@/types/course';

export const track: Track = {
  slug: 'ai',
  title: 'AI for data engineering',
  summary:
    'Embeddings, vector search, RAG pipelines, feature stores, LLMOps and AI in the daily SQL and pipeline work, plus AI system design.',
  tone: 'grape',
  why: 'Every AI product sits on a data platform, and loops now ask data engineers to design the data side of RAG, recommendations and fraud models. A senior answer treats documents, embeddings and features as data with freshness, lineage, access control, evaluation and cost.',
  lessons: [
    {
      slug: 'the-data-engineer-in-ai',
      title: 'The data engineer in an AI system',
      summary:
        'Place the data engineer in an AI system, and use AI assistants in your own work without shipping their mistakes.',
      minutes: 12,
      body: `
        A model is only as good as the data it learns from and the context it reads at answer
        time. Most of an AI system is data work: collect it, clean it, keep it fresh, control who
        sees it, and measure whether it helped. That work belongs to data engineers.

        ## Three kinds of AI system

        | System | What the model needs | What the data engineer builds |
        |---|---|---|
        | **Predictive ML** (fraud, ETA, ranking) | Features for training and for each live request | Feature pipelines, a feature store, training sets, label joins |
        | **Retrieval and RAG** (assistants, search) | The right passages of text at question time | Document ingestion, chunking, embeddings, a vector index, access control |
        | **LLM in the pipeline** (classify, extract, summarize) | Clean input and a place to write output | Batch inference jobs, prompt versions, evaluation tables, cost controls |

        The same skills apply to all three: idempotent loads, incremental processing, backfills,
        data contracts, lineage and monitoring. The new parts are embeddings, vector indexes,
        evaluation of model output, and the cost of model calls.

        ## What is new for a data engineer

        - **Unstructured data is a first-class source.** PDFs, tickets, chat logs and images now
          flow through pipelines with the same SLAs as tables.
        - **Quality has a second meaning.** A row can be valid and still make the model wrong.
          You test retrieval and answers, not only schemas.
        - **Freshness is visible to users.** A stale index makes an assistant answer with last
          month's policy, in a confident voice.
        - **Cost moves to inference.** A careless backfill that calls a model per row can cost more
          than a year of warehouse compute.

        ## Using AI assistants in your own work

        Assistants write SQL, PySpark, dbt models and DAGs quickly. They also invent column names,
        miss edge cases and write code that runs but is wrong. Treat the output like a pull request
        from a fast new hire.

        1. **Give context.** Paste the schema, the grain, a few sample rows and the engine. A prompt
           without the grain gets a query with a fan-out join.
        2. **Ask for tests first.** Edge cases (nulls, duplicates, late rows, time zones) as test
           data, then the code.
        3. **Verify.** Run it on a sample, compare row counts and totals with a known answer, and
           read the query plan for full scans.
        4. **Own it.** You sign the merge. "The assistant wrote it" is not an answer in a review or
           an incident.

        > [!trap] Data that must not leave
        > Pasting production rows with emails or card numbers into an outside chat tool can break
        > policy and law. Use synthetic rows or an approved tool whose data terms your company
        > has checked.

        > [!senior] What the interviewer listens for
        > A senior answer names where AI speeds up the work and where a human check stays. For
        > example: "I let the assistant draft dbt tests and docs, and I review every generated
        > metric definition against finance, because a wrong revenue number is worse than a slow
        > one."
      `,
      checks: [
        {
          question: 'In a RAG assistant, which part is mainly data engineering work?',
          options: [
            'Training the language model',
            'Ingesting, chunking, embedding and access-controlling the documents',
            'Writing the chat user interface',
            'Choosing the model temperature',
          ],
          answer: 1,
          why: 'The quality of a RAG answer depends on what is retrieved, and that is a document pipeline the data engineer owns.',
        },
        {
          question: 'An assistant wrote a SQL model. What is the strongest check before you merge?',
          options: [
            'It compiles without errors',
            'The assistant said it is correct',
            'It matches a known total on sample data, including edge-case rows',
            'It is shorter than the old query',
          ],
          answer: 2,
          why: 'Code that runs can still be wrong. Compare against a known answer, with nulls, duplicates and late rows in the test data.',
        },
      ],
    },
    {
      slug: 'embeddings-and-vector-indexes',
      title: 'Embeddings and vector indexes',
      summary:
        'Explain what an embedding is, size a vector index, and choose between HNSW, IVF and quantization.',
      minutes: 15,
      body: `
        An **embedding** is a list of numbers, often 384 to 3,072 of them, that a model computes
        for a piece of text, an image or a user. Items with similar meaning get vectors that point
        in similar directions. Search then becomes geometry: find the stored vectors closest to
        the query vector.

        ## Distance metrics

        | Metric | What it measures | Note |
        |---|---|---|
        | Cosine similarity | The angle between two vectors | The usual choice for text |
        | Dot product | Angle and length together | Same ranking as cosine when vectors are normalized |
        | Euclidean (L2) | Straight-line distance | Same ranking as cosine on normalized vectors |

        Use the metric the embedding model was trained with. Many models return normalized
        vectors, so the three give the same order and dot product is the cheapest.

        ## Why exact search does not scale

        Exact search compares the query with every vector. For 100 million vectors of 768
        dimensions, that is 76.8 billion multiplications per query. An **approximate nearest
        neighbour** (ANN) index trades a little recall for a large speed-up.

        | Index | How it works | Strengths | Costs |
        |---|---|---|---|
        | **HNSW** | A layered graph; search walks from far hops to near neighbours | High recall, fast, updates in place | Memory-heavy; slow to build |
        | **IVF** | Clusters vectors; searches only the nearest clusters | Smaller, fast to build | Recall drops if clusters drift; retrain needed |
        | **PQ** (product quantization) | Compresses each vector into a few bytes | 10x to 60x less memory | Lower precision; rerank with full vectors |
        | **DiskANN-style** | Graph on SSD, compressed vectors in RAM | Billions of vectors per node | More complex to run |

        The tuning knobs to name: for HNSW, «M» (links per node) and «ef_search» (how wide a
        query searches); for IVF, «nlist» (clusters) and «nprobe» (clusters searched). Higher
        values raise recall and latency together.

        ## Size it before you choose

        ~~~text
        100M vectors x 768 dims x 4 bytes (float32) = 307 GB of raw vectors
        + HNSW graph links                          = roughly 10% more
        half precision (float16)                    = about 154 GB
        PQ to 96 bytes per vector                   = about 9.6 GB
        ~~~

        That arithmetic decides the design: 307 GB means sharding across nodes or compressing;
        9.6 GB fits one machine.

        ## Where vectors live

        | Option | Fits when |
        |---|---|
        | **pgvector** in Postgres | Up to tens of millions of vectors, and you want SQL joins and transactions |
        | A dedicated vector database (Milvus, Qdrant, Weaviate, Pinecone) | Hundreds of millions or more, heavy filtering, many tenants |
        | Warehouse vector search (BigQuery «VECTOR_SEARCH», Snowflake, Databricks) | Batch and analytical similarity next to the data |
        | Elasticsearch or OpenSearch | You already run them and need keyword and vector search together |

        ~~~sql
        -- pgvector: store, index and query
        create extension if not exists vector;
        create table chunks (
            chunk_id bigserial primary key,
            doc_id text not null,
            tenant_id text not null,
            body text not null,
            embedding vector(768) not null
        );
        create index on chunks using hnsw (embedding vector_cosine_ops);

        select chunk_id, body
        from chunks
        where tenant_id = 'acme'
        order by embedding <=> '[0.01, -0.20, 0.33]'::vector  -- query vector, shortened here
        limit 10;
        ~~~

        «<=>» is cosine distance in pgvector. An HNSW index on the «vector» type takes up to 2,000
        dimensions; the «halfvec» type goes higher.

        > [!trap] Filters after the index
        > An ANN index returns the 10 nearest vectors, then the «tenant_id» filter removes 9 of
        > them. The query returns 1 row, or none. Use an engine that filters during the search,
        > raise the candidate count, or partition the index by tenant.

        > [!senior] Recall is a number you measure
        > Say you will build a ground-truth set with exact search on a sample, then tune
        > «ef_search» or «nprobe» until recall at 10 is, for example, above 0.95 within the
        > latency budget.
      `,
      checks: [
        {
          question:
            'Your vectors are normalized. Which metric gives the same ranking as cosine and is cheapest?',
          options: ['Euclidean distance', 'Dot product', 'Manhattan distance', 'Jaccard'],
          answer: 1,
          why: 'For unit-length vectors the dot product equals the cosine similarity, and it skips the division.',
        },
        {
          question:
            'How much memory do 50M float32 vectors of 1,024 dimensions take before any index?',
          options: ['About 20 GB', 'About 51 GB', 'About 205 GB', 'About 2 TB'],
          answer: 2,
          why: '50,000,000 x 1,024 x 4 bytes = 204.8 GB.',
        },
        {
          question:
            'A filtered vector query returns 2 rows when you asked for 10. What is the likely cause?',
          options: [
            'The embedding model is wrong',
            'The filter ran after the ANN search removed most candidates',
            'The vectors are not normalized',
            'HNSW cannot return more than 2 rows',
          ],
          answer: 1,
          why: 'Post-filtering an approximate top 10 can leave few or no rows. Filter during the search or fetch more candidates.',
        },
      ],
    },
    {
      slug: 'embedding-pipelines-and-hybrid-search',
      title: 'Embedding pipelines and hybrid search',
      summary:
        'Build an embedding pipeline that is incremental, versioned and safe to rerun, and combine vector and keyword search.',
      minutes: 15,
      body: `
        An embedding pipeline is an ordinary incremental pipeline with an expensive transform in
        the middle. The same rules apply: process only what changed, make reruns safe, and keep
        the output traceable to its input.

        ~~~text
        source change (CDC, file drop) -> parse and clean -> chunk -> hash
            -> skip if (hash, model_version) already embedded
            -> embed in batches -> upsert vectors + metadata -> delete stale chunks
        ~~~

        ## The rules that make it production-grade

        - **Content hash per chunk.** Store «sha256(model_version + chunk_text)». A rerun skips
          chunks it has already embedded, so a retry costs nothing.
        - **Deterministic chunk ids.** Derive the id from the document id and the chunk position
          or hash, so an upsert replaces the old row instead of adding a duplicate.
        - **Model version on every vector.** Vectors from two models are not comparable. Never
          mix them in one index.
        - **Deletes propagate.** When a document is deleted or a user loses access, its chunks
          leave the index within the SLA. A stale vector of a deleted HR file is a data leak.
        - **Batch the model calls.** Send hundreds of chunks per request, run several requests at
          once within the rate limit, and retry with backoff on 429 responses.
        - **Metadata travels with the vector.** Source, owner, tenant, ACL groups, language,
          updated time. Retrieval filters on it.

        ## Changing the embedding model

        A new model means every vector must be recomputed. Treat it like a schema migration:

        1. Build a second index with the new model, filled by a backfill job.
        2. Dual-write new and changed documents to both indexes during the backfill.
        3. Compare retrieval quality on your evaluation set.
        4. Switch the read alias to the new index. Keep the old one for rollback, then drop it.

        Estimate the cost first: 200M chunks of 300 tokens is 60 billion tokens. At a price of
        a few cents per million tokens, that is a few thousand dollars, but self-hosted GPUs may
        be cheaper and faster at that size.

        ## Hybrid search

        Vector search finds meaning: "car is making noise" matches "vehicle rattle". It misses
        exact tokens: error codes, SKUs, names, «ORA-01555». Keyword search (BM25) finds exact
        tokens and misses paraphrases. **Hybrid search** runs both and merges the results.

        **Reciprocal rank fusion** (RRF) merges two ranked lists without comparing their raw
        scores, which have different scales:

        ~~~text
        rrf_score(doc) = sum over lists of 1 / (k + rank_in_list), with k = 60 by convention
        ~~~

        A document ranked 1st by keywords and 3rd by vectors scores 1/61 + 1/63. A document that
        only one list returns still gets its single term. After fusion, a **cross-encoder
        reranker** scores the top 50 to 100 pairs of query and passage more precisely, and the
        best 5 to 10 go to the model.

        > [!example] Retrieval stack for a support assistant
        > BM25 top 50 plus vector top 50, fused with RRF, reranked to 8 passages, filtered by the
        > customer's product and the user's permissions before ranking.

        > [!trap] Re-embedding everything on each run
        > A nightly job that embeds the full corpus works in the demo and costs a fortune at
        > scale. Hash, skip unchanged chunks, and process only changes.

        > [!senior] Scale talking points
        > Shard by tenant or by hash, replicate for read throughput, keep the index build off the
        > serving path, and alert on index freshness lag the same way you alert on a late table.
      `,
      checks: [
        {
          question: 'Why store the model version on every vector?',
          options: [
            'For billing',
            'Vectors from different models are not comparable, so they must not mix in one index',
            'The vector database requires it',
            'To compress the vectors',
          ],
          answer: 1,
          why: 'Each model defines its own vector space. A query vector from model B compared with stored vectors from model A gives meaningless distances.',
        },
        {
          question:
            'A user searches for the error code «E1047». Which retrieval finds it most reliably?',
          options: [
            'Vector search alone',
            'Keyword (BM25) search, for example inside a hybrid setup',
            'A larger embedding model',
            'A higher HNSW ef_search',
          ],
          answer: 1,
          why: 'Exact rare tokens are a keyword-search strength. Hybrid search keeps that strength and adds semantic matches.',
        },
        {
          question: 'With RRF and k = 60, which document scores higher?',
          options: [
            'Rank 1 in one list only',
            'Rank 2 in both lists',
            'They score the same',
            'It depends on the raw scores',
          ],
          answer: 1,
          why: '1/61 is about 0.0164. 1/62 + 1/62 is about 0.0323. Agreement between lists wins, and raw scores are not used.',
        },
      ],
    },
    {
      slug: 'rag-pipelines',
      title: 'RAG pipelines from document to answer',
      summary:
        'Design the ingestion, chunking, retrieval and generation path of a production RAG system.',
      minutes: 16,
      body: `
        **Retrieval-augmented generation** (RAG) answers a question with a language model that
        reads passages retrieved from your own data. It keeps answers current without retraining,
        lets you cite sources, and lets you enforce access control at retrieval time.

        ~~~text
        OFFLINE (ingestion)                         ONLINE (per question)
        sources -> parse -> clean -> chunk          question -> rewrite -> retrieve (hybrid)
          -> enrich metadata -> embed -> index        -> ACL filter -> rerank -> build prompt
                                                      -> LLM -> answer + citations -> log
        ~~~

        ## Parsing unstructured data

        Parsing decides more of the answer quality than the model does. A PDF table read as one
        line of text gives wrong numbers in every answer that uses it.

        - Keep **structure**: headings, lists, tables as rows, page numbers for citations.
        - Use layout-aware parsers or OCR for scans and slides. Cloud services (Document AI,
          Textract, Azure Document Intelligence) and open-source tools (Unstructured, Docling,
          Apache Tika) cover different formats; test them on your worst documents.
        - Remove boilerplate: headers, footers, navigation, signatures, repeated disclaimers.
        - At scale, run parsing as a distributed batch job (Spark or Ray) with a dead-letter
          table for files that fail, and record the parser version per document.

        ## Chunking

        | Strategy | How | Use when |
        |---|---|---|
        | Fixed size with overlap | 300 to 800 tokens, 10 to 20% overlap | A simple, robust start |
        | Structure-aware | Split on headings, sections, list items | Docs, wikis, policies |
        | Parent and child | Retrieve small chunks, send their larger parent section | Precise match, full context |
        | Semantic | Split where the meaning shifts between sentences | Long prose without structure |

        Prepend context to each chunk before embedding, such as the document title and section
        path ("Travel policy > Hotels > Limits"). A chunk that says "the limit is 200" means
        nothing alone.

        ## Retrieval and generation

        1. **Rewrite the question** if it depends on the chat history ("and for Paris?").
        2. **Retrieve** with hybrid search, 20 to 100 candidates.
        3. **Filter by permission** inside the search, with the user's groups as a filter.
        4. **Rerank** and keep the best 5 to 10 passages.
        5. **Prompt**: instructions, the passages with ids, the question, and a rule to cite ids
           and to say "not found" when the passages do not answer it.
        6. **Log** the question, passage ids, prompt version, model, answer, latency and tokens.
           This log is your evaluation and debugging data.

        ## Frameworks

        LangChain, LlamaIndex and Haystack give loaders, splitters and retrieval chains. They are
        fast for a prototype. In production, many teams keep the ingestion in their normal data
        stack (Spark, Airflow, dbt) and use a thin library on the serving side, because the hard
        parts are data freshness and access control, which frameworks do not solve for you.

        > [!trap] Access control after generation
        > Filtering the answer is too late: the model has already read the secret passage and
        > can repeat it. Enforce ACLs at retrieval time, and sync permission changes as quickly
        > as content changes.

        > [!trap] Prompt injection in documents
        > A retrieved page can contain "ignore your instructions and ...". Treat retrieved text as
        > data, keep tool access narrow, and never let retrieved text trigger writes on its own.

        > [!senior] Fine-tuning or RAG?
        > RAG adds knowledge that changes and must be cited. Fine-tuning changes behaviour: tone,
        > format, a narrow task. A senior answer often uses RAG for facts and, only if needed, a
        > small fine-tune for format.
      `,
      checks: [
        {
          question: 'Where must document permissions be enforced in a RAG system?',
          options: [
            'In the chat user interface',
            'By filtering the generated answer',
            'At retrieval time, before passages reach the model',
            'In the prompt, by asking the model to respect them',
          ],
          answer: 2,
          why: 'Anything the model reads it can repeat. Only passages the user may see should be retrieved.',
        },
        {
          question: 'A chunk reads "The limit is 200 per night." What improves its retrieval most?',
          options: [
            'A larger chunk overlap',
            'Prepending the document title and section path before embedding',
            'A bigger language model',
            'Lowering the temperature',
          ],
          answer: 1,
          why: 'The chunk alone has no subject. Adding "Travel policy > Hotels" gives the embedding the context it needs to match the question.',
        },
      ],
    },
    {
      slug: 'rag-evaluation',
      title: 'Evaluate retrieval and answers',
      summary:
        'Measure a RAG system with retrieval metrics, answer metrics and a golden set, and find which stage fails.',
      minutes: 14,
      body: `
        "It looks good in the demo" is not a quality bar. A RAG system has two stages that fail in
        different ways, so measure them separately.

        ## Measure retrieval

        Build a **golden set**: 100 to 500 real questions, each with the passages that answer it,
        labelled by domain experts. Then score the retriever alone:

        | Metric | Question it answers |
        |---|---|
        | **Recall at k** | Did the right passage appear in the top k at all? |
        | **MRR** (mean reciprocal rank) | How high was the first right passage? |
        | **nDCG at k** | Were the most useful passages ranked highest? |
        | Context precision | How much of what we sent the model was relevant? |

        If recall at 10 is low, no prompt or model fixes the answer. Fix parsing, chunking,
        metadata or search first.

        ## Measure answers

        | Metric | Question it answers |
        |---|---|
        | **Faithfulness** (groundedness) | Is every claim supported by the retrieved passages? |
        | Answer relevance | Does it answer the question that was asked? |
        | Correctness | Does it match the expert's reference answer? |
        | Citation accuracy | Do the cited passages support the sentence they are attached to? |
        | Refusal rate | How often does it say "not found", and is it right to? |

        **LLM as judge**: a strong model grades answers against a rubric. It scales, but it has
        biases (it likes long answers, and its own style). Calibrate it against a few hundred
        human labels, and track agreement. Libraries such as Ragas compute these metrics for you.

        ## Find the failing stage

        ~~~text
        wrong answer
          |- right passage not retrieved?      -> retrieval: parsing, chunking, search, filters
          |- retrieved but ranked low or cut?  -> reranking, top k, context budget
          |- in context but ignored or wrong?  -> prompt, model, conflicting passages
          |- right answer, stale fact?         -> freshness: ingestion lag, deletes
        ~~~

        ## Evaluate continuously

        - Run the golden set in **CI** on every change to chunking, embedding model, prompt or
          model version. Block the merge on a regression.
        - **Online**: thumbs up and down, copy rate, follow-up questions that rephrase the same
          ask, escalation to a human. Sample live traffic for weekly human review.
        - Add every bad answer from production to the golden set, like a regression test.

        > [!trap] One number for everything
        > An average score hides that HR questions fail while IT questions pass. Slice metrics by
        > source, topic and question type.

        > [!senior] Evaluation is a data product
        > The golden set, the judge prompts and the scores live in versioned tables with an
        > owner. A senior engineer budgets time for them in the design, not after launch.
      `,
      checks: [
        {
          question: 'Recall at 10 on your golden set is 0.55. What should you improve first?',
          options: [
            'The prompt template',
            'The language model',
            'Parsing, chunking and search, so the right passages are retrieved',
            'The temperature',
          ],
          answer: 2,
          why: 'Almost half the questions never get the right passage. Generation cannot use what retrieval did not return.',
        },
        {
          question: 'What does faithfulness measure?',
          options: [
            'Whether the answer matches the user intent',
            'Whether every claim in the answer is supported by the retrieved context',
            'How fast the answer is generated',
            'How often users click the citation',
          ],
          answer: 1,
          why: 'Faithfulness, or groundedness, checks the answer against the passages it was given, which catches hallucination.',
        },
      ],
    },
    {
      slug: 'llmops',
      title: 'LLMOps: running model calls in production',
      summary:
        'Version prompts, route and cache model calls, control cost, trace requests and guard inputs and outputs.',
      minutes: 14,
      body: `
        **LLMOps** is the practice of running language model features in production. It shares
        the MLOps ideas of versioning, evaluation and monitoring, but most teams do not train the
        model. They operate prompts, retrieval and calls to a hosted or self-hosted model.

        | | MLOps | LLMOps |
        |---|---|---|
        | Main artefact | A trained model | A prompt, retrieval config and model choice |
        | Quality check | Accuracy on a labelled test set | Golden sets, LLM judges, human review |
        | Main cost | Training compute | Tokens per request |
        | Main drift | Input data distribution | Provider model updates, content changes, new user behaviour |

        ## The parts of the platform

        - **Prompt registry.** Prompts live in version control with an id and a version. Every
          logged request records which version produced it.
        - **Gateway.** One service between apps and model providers: keys, routing, retries,
          fallbacks to a second provider, rate limits and spend per team.
        - **Evaluation in CI.** A prompt or model change runs the golden set before release, like
          a unit test suite.
        - **Tracing.** Each request becomes a trace: retrieval, rerank, model call, tool calls,
          with tokens, latency and cost per span. Tools such as Langfuse, LangSmith or an
          OpenTelemetry backend show it.
        - **Guardrails.** Input checks (PII, prompt injection, topic limits) and output checks
          (schema validation, banned content, citation present).

        ## Cost and latency

        ~~~text
        cost per request = input tokens x input price + output tokens x output price
        1M requests/day x (3,000 in + 300 out tokens) = 3B input + 0.3B output tokens per day
        ~~~

        Levers, in the order to try them:

        1. **Send less context.** Rerank and keep fewer, better passages.
        2. **Route by difficulty.** A small, cheap model handles easy requests; the large model
           handles the rest.
        3. **Cache.** Exact-match caching of repeated requests, provider prompt caching for a long
           shared prefix, and semantic caching only where a near-duplicate answer is safe.
        4. **Batch offline work.** Batch APIs cost less than live calls for non-urgent jobs such
           as nightly classification.
        5. **Cap output.** Set max tokens and ask for structured, short output.

        ## LLM calls inside data pipelines

        Classifying 50 million support tickets with a model is a batch job. Treat it like one:
        partition the input, checkpoint progress, make each call idempotent by storing the
        result keyed by «(record_id, prompt_version, model)», validate the output against a
        schema, and send failures to a dead-letter table. Warehouses now offer SQL functions that
        call a model per row (for example BigQuery «AI.GENERATE», Snowflake «AI_COMPLETE»,
        Databricks «ai_query»). They are convenient, and a full-table call is a full-table bill.

        > [!trap] The silent model update
        > A provider alias such as "latest" can change behaviour overnight. Pin model versions in
        > production, and upgrade through the same evaluation gate as a code change.

        > [!senior] Name the budget
        > State a cost per request and a p95 latency target early, for example "under 1 cent and
        > under 2 seconds", then design retrieval depth, model routing and caching against them.
      `,
      checks: [
        {
          question:
            'Each request sends 4,000 tokens of retrieved context. What is usually the first lever to cut cost?',
          options: [
            'Switch providers',
            'Rerank and send fewer, better passages',
            'Raise the temperature',
            'Add a semantic cache for every request',
          ],
          answer: 1,
          why: 'Input tokens dominate the bill in RAG. Better ranking lets you send less context and often improves answers too.',
        },
        {
          question:
            'A nightly job classifies 50M rows with a model. What makes a retry safe and cheap?',
          options: [
            'Running it on a bigger cluster',
            'Storing results keyed by record id, prompt version and model, and skipping done rows',
            'Calling the model twice and comparing',
            'Using streaming instead of batch',
          ],
          answer: 1,
          why: 'An idempotent key lets the retry skip work already paid for, and a new prompt version recomputes cleanly.',
        },
      ],
    },
    {
      slug: 'feature-stores',
      title: 'Feature stores and point-in-time correctness',
      summary:
        'Explain offline and online feature stores, build a point-in-time correct training set, and prevent training-serving skew.',
      minutes: 16,
      body: `
        A **feature** is an input to a model: a driver's trips in the last hour, a user's average
        basket, a merchant's chargeback rate. A **feature store** keeps one definition of each
        feature and serves it two ways: history for training, and the latest value for live
        predictions.

        ~~~text
        sources -> feature pipelines (batch, streaming) -> OFFLINE store (lake / warehouse)
                                                         |    full history, for training
                                                         -> ONLINE store (key-value)
                                                              latest value, read in ms
        ~~~

        | | Offline store | Online store |
        |---|---|---|
        | Holds | Every value with its timestamp | The latest value per entity key |
        | Read by | Training jobs, batch scoring | The model server, per request |
        | Latency | Seconds to minutes | Single-digit milliseconds at p99 |
        | Typical tech | BigQuery, Delta or Iceberg tables | Redis, Bigtable, DynamoDB, Cassandra |

        Options to name: **Feast** (open source, plugs into your own stores), **Tecton**,
        **Vertex AI Feature Store**, **Databricks Feature Engineering** in Unity Catalog and
        **SageMaker Feature Store**. Many large companies build their own on the same pattern.

        ## Point-in-time correctness

        A training row for an event at time T may only use feature values that were **known
        before T**. Joining the latest value instead leaks the future into training. The model
        looks great offline and fails in production.

        ~~~sql
        -- one row per labelled order, with the user's features as they were at order time
        select
            l.order_id,
            l.user_id,
            l.ordered_at,
            f.orders_7d,
            f.avg_basket_usd,
            l.is_fraud
        from labels as l
        left join user_features as f
            on f.user_id = l.user_id
           and f.feature_ts < l.ordered_at
           and f.feature_ts >= l.ordered_at - interval 30 day
        qualify row_number() over (
            partition by l.order_id
            order by f.feature_ts desc
        ) = 1
        ~~~

        The 30-day bound is a **time to live**: a value older than that counts as missing, the
        same rule the online store applies. Some engines have an «ASOF JOIN» that does this
        directly.

        ## Training-serving skew

        Skew is when the model sees different values for the "same" feature in training and in
        production. Common causes:

        - Two code paths: SQL for training, Java in the service. They drift apart.
        - Different windows: training uses calendar days, serving uses the last 24 hours.
        - Freshness: training assumes values are current; online values lag 15 minutes.
        - Defaults: nulls become 0 in one path and the mean in the other.

        Fixes: one feature definition that generates both paths, logging the exact feature values
        the model used at serving time and training on those logs, and a daily job that compares
        offline and online values for a sample of keys.

        ## Streaming features

        "Trips in the last 10 minutes" needs a streaming pipeline (Flink, Spark Structured
        Streaming) that updates the online store within seconds and also writes the history to
        the offline store, so training sees the same values. Backfilling a new streaming feature
        means replaying history through the same logic, or the batch version must provably match.

        > [!trap] Event time vs availability time
        > A feature computed for 09:00 that lands at 09:20 was not available at 09:05. Join on when
        > the value became available to the model server, not only on the time it describes.

        > [!senior] When you do not need a feature store
        > Two models sharing three batch features need a well-modelled table, not a platform.
        > Argue for a feature store when many teams reuse features, online serving is needed, or
        > skew incidents keep happening.
      `,
      checks: [
        {
          question: 'Why must a training set use point-in-time joins?',
          options: [
            'They are faster than normal joins',
            'Using values known only after the event leaks the future, so offline scores lie',
            'Online stores require it',
            'They remove duplicate labels',
          ],
          answer: 1,
          why: 'Label leakage makes the model look accurate in training, then fail in production where the future is not known.',
        },
        {
          question: 'Which design best prevents training-serving skew?',
          options: [
            'Separate SQL and Java implementations reviewed by the same person',
            'One feature definition for both paths, plus training on logged serving values',
            'A larger model',
            'Refreshing the online store hourly',
          ],
          answer: 1,
          why: 'Skew comes from two implementations and different timing. One definition and logged features remove both.',
        },
      ],
    },
    {
      slug: 'training-data-and-ml-observability',
      title: 'Training data pipelines and ML observability',
      summary:
        'Version training data, reproduce a model, and monitor drift, freshness and model quality after launch.',
      minutes: 13,
      body: `
        A model is a function of its code, its data and its configuration. To reproduce or debug
        it, you must be able to rebuild the exact training set months later.

        ## Version the training data

        | Approach | How it works |
        |---|---|
        | Table time travel (Delta, Iceberg, BigQuery) | Record the snapshot id or timestamp used for training |
        | Immutable snapshots | Write each training set to a new dated path and never change it |
        | lakeFS or DVC | Git-like commits and branches over files in object storage |

        Record with the model, in the model registry (MLflow, Vertex AI, SageMaker): the data
        snapshot ids, the feature definitions and their versions, the label query, the code
        commit and the split method.

        ## Build training sets like any important pipeline

        - **Labels arrive late.** Fraud chargebacks come weeks after the payment. Train only on
          events old enough for their label to be final, or model the delay.
        - **Split by time**, not at random, for anything that predicts the future. A random split
          puts tomorrow's rows in training and today's in test.
        - **Check for leakage**: no feature computed from the label, no ids that encode the
          outcome.
        - **Sample on purpose**, keep the sampling rate, and weight it back in evaluation.

        ## What to monitor after launch

        | Signal | Example check |
        |---|---|
        | Data freshness | Online features older than their SLA |
        | Input drift | Population stability index (PSI) of each top feature vs training |
        | Data quality | Null rate, out-of-range values, new categories |
        | Prediction drift | Share of "fraud" predictions moves from 2% to 9% |
        | Model quality | Precision and recall once labels arrive, by segment |
        | Business metric | Chargeback cost, conversion, time saved |

        A common reading of PSI: below 0.1 stable, 0.1 to 0.25 worth a look, above 0.25 a real
        shift. Treat these as starting points and tune them for each feature.

        Most model incidents are data incidents: a renamed upstream column turns a feature to
        null, the model quietly falls back to defaults, and predictions degrade for days. Data
        contracts and quality tests on feature pipelines catch this before the model does.

        > [!trap] Alerting on every drift
        > Drift is normal; seasons change. Alert when drift meets a quality drop or a top feature
        > breaks, or the team learns to ignore the pager.

        > [!senior] Close the loop
        > Log features, predictions and model version per request, join them to outcomes when
        > labels arrive, and you have both monitoring and the next training set from one table.
      `,
      checks: [
        {
          question: "How should you split data for a model that predicts next week's churn?",
          options: [
            'A random 80/20 split',
            'By time: train on older periods, test on the most recent',
            'By user id hash',
            'No split; use cross-validation only',
          ],
          answer: 1,
          why: 'A random split lets the model learn from the future it will be tested on. A time split matches how it is used.',
        },
        {
          question: 'A top feature has PSI 0.4 against training. What does it suggest?',
          options: [
            'The model is perfect',
            "A significant shift in that feature's distribution worth investigating",
            'The feature has no nulls',
            'Labels are late',
          ],
          answer: 1,
          why: 'PSI above about 0.25 is commonly read as a large shift. Check for an upstream break before you retrain.',
        },
      ],
    },
    {
      slug: 'ai-for-sql-and-pipelines',
      title: 'AI for SQL, pipelines and operations',
      summary:
        'Judge text-to-SQL, use AI in dbt, Spark and Airflow work, and design agents that help with incidents safely.',
      minutes: 15,
      body: `
        AI tools now write queries for analysts, draft pipeline code for engineers, and read logs
        during incidents. A senior engineer knows where each one is reliable and where it needs a
        fence.

        ## Text-to-SQL: what works and what does not

        On a clean demo schema, models write correct SQL most of the time. On a real warehouse
        accuracy drops sharply. Benchmarks with enterprise schemas, such as Spider 2.0 and BIRD,
        show the gap. The reasons are data problems, not model problems:

        - Thousands of tables with similar names («orders», «orders_v2», «orders_clean»).
        - Business definitions that live in people's heads: what counts as an "active user".
        - Joins that fan out, time zones, soft deletes, test accounts.

        What makes it work:

        1. A **semantic layer** (dbt Semantic Layer, LookML, Cube, Snowflake Cortex Analyst's
           semantic model) that defines metrics, dimensions and joins once. The model picks
           metrics and filters; the layer writes the SQL.
        2. **Curated context**: a small set of certified tables, column descriptions and verified
           example queries, retrieved per question.
        3. **Guardrails**: read-only roles, row and column security, a cost limit per query, and
           a dry run that checks bytes scanned before execution.
        4. **Show the work**: the SQL and the metric definition next to the answer, so a user can
           check it.

        ## AI in pipeline work

        | Task | Good use | Check you keep |
        |---|---|---|
        | dbt | Draft staging models, tests and YAML docs from a source schema | Review grain and keys; run the tests |
        | Spark | Explain a slow plan, suggest broadcast or repartition | Measure before and after on real data |
        | Airflow | Scaffold a DAG, convert operators, explain a failure log | Idempotency, retries and backfill logic |
        | Testing | Generate edge-case rows and test cases | You choose what "correct" means |
        | Catalogs | Draft table and column descriptions, tag PII | An owner approves before publish |
        | Data quality | Anomaly detection on volumes and distributions | Thresholds tuned per table, with owners |

        ## Agents and self-healing pipelines

        An **agent** is a model that calls tools in a loop: read the failed task log, query the
        source, look at the last commit, propose a fix. Protocols such as MCP give agents a
        standard way to reach tools like the warehouse, the orchestrator and the catalog.

        Safe design, from least to most autonomy:

        1. **Triage only.** The agent summarises the failure, links the likely cause and the owner.
        2. **Suggest.** It opens a pull request or a runbook step; a human approves.
        3. **Act on a whitelist.** It may retry a task, clear a stuck sensor or rerun a partition,
           because those actions are idempotent and reversible.
        4. **Never alone**: delete data, change production schemas, grant access or skip a
           failing quality check.

        Log every action the agent takes, give it its own service account with the narrowest
        permissions, and measure it: time to resolve, wrong suggestions, actions undone.

        ## AI services on the platforms

        | Platform | Examples |
        |---|---|
        | Google Cloud | Vertex AI, BigQuery ML and AI functions, BigQuery vector search |
        | AWS | Bedrock, Bedrock Knowledge Bases, SageMaker |
        | Azure | Azure OpenAI in Azure AI Foundry, Azure AI Search |
        | Snowflake | Cortex AI functions, Cortex Search, Cortex Analyst |
        | Databricks | Mosaic AI Vector Search, model serving, «ai_query», Unity Catalog for models |

        Product names change often; in an interview, name the capability first and the product
        second.

        > [!trap] An agent with the pipeline's own credentials
        > If the agent runs as the pipeline's service account, a bad suggestion can drop a
        > production table. Give it a separate identity with read access plus a short list of
        > safe actions.

        > [!senior] The text-to-SQL answer interviewers want
        > "Accuracy comes from the semantic layer and curated context, not a bigger model. We
        > start with certified metrics for one domain, show the SQL with every answer, and
        > measure accuracy on a test set of real questions before we widen it."
      `,
      checks: [
        {
          question: 'What raises text-to-SQL accuracy most on a large warehouse?',
          options: [
            'A larger model',
            'A semantic layer and curated context: certified tables, metric definitions, verified examples',
            'Giving the model write access',
            'Including every table schema in each prompt',
          ],
          answer: 1,
          why: 'Most errors come from ambiguous tables and missing business definitions. A semantic layer and curated context remove that ambiguity.',
        },
        {
          question: 'Which action is safe for a pipeline agent to take without human approval?',
          options: [
            'Dropping a corrupted table',
            'Granting itself more permissions',
            'Retrying an idempotent task or rerunning one partition',
            'Disabling a failing quality check',
          ],
          answer: 2,
          why: 'Idempotent, reversible actions are safe to automate. Deletes, grants and skipped checks need a human.',
        },
      ],
    },
    {
      slug: 'ai-system-design-framework',
      title: 'A framework for AI system design rounds',
      summary:
        'Run an AI-flavoured design interview: requirements, data, the offline and online paths, evaluation and cost.',
      minutes: 13,
      body: `
        AI design prompts sound different ("design a recommendation system", "design an
        assistant over company documents") but a data engineering loop scores the same things:
        data flow, freshness, correctness, scale, failure handling and cost. Add three AI-specific
        parts: the offline and online split, evaluation, and the feedback loop.

        ## The steps

        | Step | Minutes | What you produce |
        |---|---|---|
        | 1. Clarify | 5 | Users, the decision or answer, latency, freshness, scale, risk of a wrong answer |
        | 2. Estimate | 3 | Requests per second, items, vectors, feature keys, tokens per day |
        | 3. Data | 7 | Sources, entities, labels or documents, and access rules |
        | 4. Offline path | 8 | Feature or embedding pipelines, training or indexing, backfill |
        | 5. Online path | 8 | Request flow with a latency budget per step |
        | 6. Evaluate and loop | 6 | Offline metrics, online metrics, logging, retraining or re-indexing |
        | 7. Operate | 5 | Monitoring, fallbacks, cost, privacy, what changes at 10x |

        ## Questions that change the design

        - **What happens on a wrong answer?** A bad song suggestion costs nothing; a wrong fraud
          block loses a customer; a wrong HR answer is a legal risk. Risk sets the human review.
        - **How fresh?** Features from seconds ago need streaming; documents from yesterday do
          not.
        - **What is the latency budget?** Split it: 10 ms features, 20 ms retrieval, 30 ms
          ranking, or 1.5 s for a generated answer.
        - **Who may see what?** Tenants, roles and document ACLs shape every index.

        ## The shape most answers share

        ~~~text
        events / documents -> stream + batch pipelines -> offline store (history, training, eval)
                                                       -> online store / vector index (serving)
        request -> fetch features or retrieve -> model -> decision or answer -> log everything
        logs + outcomes -> labels and golden sets -> retrain / re-index -> gated release
        ~~~

        ## Deep-dive topics to offer

        - Point-in-time correct training data and skew prevention.
        - Index freshness, deletes and ACL sync for a vector store.
        - Backfilling a new feature or re-embedding with a new model.
        - Fallbacks: a rules engine when the model is down, a popular-items list when features
          are missing, "I could not find that" when retrieval is empty.
        - Cost: tokens or GPU hours per day, and how caching and routing cut them.

        > [!trap] Spending the interview on the model
        > In a data engineering loop, five minutes on transformer layers and none on freshness or
        > backfill is a weak answer. Name a reasonable model and spend the time on its data.

        > [!senior] Lead with the feedback loop
        > Saying early "every prediction is logged with its features and model version, and joined
        > to the outcome later" shows you plan for improvement and debugging, not only launch.
      `,
      checks: [
        {
          question: 'In a data engineering AI design round, where should most of the time go?',
          options: [
            'The neural network architecture',
            'Data flow, freshness, evaluation, serving latency and cost',
            'Choosing between two model vendors',
            'The user interface',
          ],
          answer: 1,
          why: 'The loop measures data engineering judgment. A reasonable model choice plus a strong data design wins.',
        },
        {
          question: 'Why log features, prediction and model version for every request?',
          options: [
            'To satisfy the cloud provider',
            'It gives monitoring, debugging and the next training set from one source',
            'It makes inference faster',
            'Logs replace the feature store',
          ],
          answer: 1,
          why: 'Joined with outcomes later, the log becomes labelled, skew-free training data and the basis for monitoring.',
        },
      ],
    },
  ],
};

export const problems: readonly Problem[] = [
  {
    slug: 'ai-vector-index-sizing',
    title: 'Size a vector index for product search',
    track: 'ai',
    kind: 'concept',
    difficulty: 'easy',
    companies: ['google', 'uber'],
    prompt: `
      A marketplace wants semantic search over 80 million product listings. Each listing gets
      one embedding of 1,024 dimensions. Search must return in under 50 ms at p95, and 5% of
      listings change each day. Estimate the memory, and choose an index type.
    `,
    hints: [
      'Multiply vectors x dimensions x bytes per number.',
      'What does that number mean for one machine?',
      'Which index handles daily updates in place?',
    ],
    answer: `
      ~~~text
      80M x 1,024 x 4 bytes (float32) = 327.7 GB raw
      + HNSW links                    = roughly 10% more, about 360 GB
      float16 or int8 quantization    = about 164 GB or 82 GB
      PQ at 128 bytes per vector      = about 10 GB
      ~~~

      360 GB in RAM is several large nodes, so either **shard** the index (for example 4 shards
      by hash, each replicated for read load) or **compress**. A good default: HNSW over
      int8-quantized vectors in memory, with the full-precision vectors on disk to **rerank**
      the top 100. That keeps recall close to full precision with a quarter of the memory.

      HNSW accepts inserts and updates in place, which suits 4 million changes a day. IVF would
      need its clusters retrained as the catalog shifts.

      Before choosing settings, measure recall at 10 against exact search on a sample of
      queries, and tune «ef_search» to the 50 ms budget.
    `,
    signals: [
      'Does the arithmetic before naming a product',
      'Chooses between sharding and compression from the number',
      'Reranks compressed results with full vectors',
      'Matches the index type to the update rate',
      'Plans to measure recall against exact search',
    ],
    followUps: ['Most queries filter by country. How does that change the index layout?'],
  },
  {
    slug: 'ai-hybrid-search-rrf',
    title: 'Fuse keyword and vector results with RRF',
    track: 'ai',
    kind: 'sql',
    difficulty: 'medium',
    companies: ['google'],
    prompt: `
      A search service writes two candidate lists per query into the warehouse for offline
      evaluation:

      - «keyword_hits(query_id, chunk_id, score)»: BM25, higher is better.
      - «vector_hits(query_id, chunk_id, distance)»: cosine distance, lower is better.

      Write SQL that merges them with reciprocal rank fusion (k = 60) and returns the top 10
      chunks per query with their fused score and the number of lists that found them.
    `,
    hints: [
      'The raw scores have different scales. Do not add them.',
      'Rank inside each list first, with row_number.',
      'Sum 1 / (60 + rank) per (query_id, chunk_id).',
    ],
    answer: `
      ~~~sql
      with ranked as (
          select
              query_id,
              chunk_id,
              row_number() over (partition by query_id order by score desc, chunk_id) as rnk
          from keyword_hits
          union all
          select
              query_id,
              chunk_id,
              row_number() over (partition by query_id order by distance asc, chunk_id) as rnk
          from vector_hits
      ),

      fused as (
          select
              query_id,
              chunk_id,
              sum(1.0 / (60 + rnk)) as rrf_score,
              count(*) as lists_found_in
          from ranked
          group by query_id, chunk_id
      )

      select
          query_id,
          chunk_id,
          rrf_score,
          lists_found_in
      from fused
      qualify row_number() over (
          partition by query_id
          order by rrf_score desc, chunk_id
      ) <= 10
      order by query_id, rrf_score desc
      ~~~

      Ranking inside each list makes the two scales irrelevant. «union all» keeps one row per
      list, so a chunk found by both lists sums two terms. The «chunk_id» tie-breaker makes the
      result deterministic, which matters when you compare runs in evaluation. Use «1.0» so the
      division is not integer division. On an engine without «qualify», wrap it in a subquery
      and filter on the row number.
    `,
    signals: [
      'Ranks within each list instead of mixing raw scores',
      'Sorts the vector list by ascending distance',
      'Uses union all so both terms are summed',
      'Adds a deterministic tie-breaker',
      'Avoids integer division',
    ],
    followUps: [
      'How would you weight the vector list twice as much?',
      'How do you check that fusion beats either list alone?',
    ],
  },
  {
    slug: 'ai-point-in-time-training-set',
    title: 'Build a leak-free training set for a fraud model',
    track: 'ai',
    kind: 'sql',
    difficulty: 'medium',
    companies: ['uber'],
    prompt: `
      Two tables:

      - «labels(order_id, user_id, ordered_at TIMESTAMP, is_fraud BOOLEAN)»
      - «user_features(user_id, feature_ts TIMESTAMP, orders_7d, avg_basket_usd,
        _loaded_at TIMESTAMP)», one row each time the feature job recomputes a user's
        features. «feature_ts» is the time the values describe; «_loaded_at» is when they
        reached the online store.

      Write the query that gives one row per order with the features the model **could have
      seen** at order time. Values older than 30 days count as missing.
    `,
    hints: [
      'Which timestamp says what the model server could see?',
      'Keep the latest feature row before the order, per order.',
      'Orders with no feature row must stay in the result.',
    ],
    answer: `
      ~~~sql
      select
          l.order_id,
          l.user_id,
          l.ordered_at,
          f.orders_7d,
          f.avg_basket_usd,
          l.is_fraud
      from labels as l
      left join user_features as f
          on f.user_id = l.user_id
         and f._loaded_at < l.ordered_at
         and f._loaded_at >= l.ordered_at - interval 30 day
      qualify row_number() over (
          partition by l.order_id
          order by f._loaded_at desc
      ) = 1
      ~~~

      - Join on **«_loaded_at»**, the availability time. A row that describes 09:00 but landed
        at 09:20 was not visible to an order at 09:05. Joining on «feature_ts» would leak 15
        minutes of future.
      - **Strictly less than**: a value that lands in the same instant as the order is a race,
        so exclude it.
      - The **left join** keeps orders without features, as in production, where the model
        sees defaults for new users.
      - The 30-day bound matches the online store's time to live.

      Then check it: the share of rows with missing features should match the share the
      serving logs show, and a model trained on it should score about the same offline as it
      does on live traffic.
    `,
    signals: [
      'Joins on availability time, not on the time the value describes',
      'Takes the latest row strictly before the event',
      'Keeps unmatched events with a left join',
      'Applies the same TTL as the online store',
      'Validates against serving logs',
    ],
    followUps: ['How would you do this for 5 billion labelled events efficiently in Spark?'],
  },
  {
    slug: 'ai-incremental-chunking',
    title: 'Chunk documents so re-ingestion is cheap',
    track: 'ai',
    kind: 'coding',
    difficulty: 'medium',
    companies: ['google', 'uber'],
    prompt: `
      Write Python for the ingestion step of a RAG pipeline:

      1. «chunk_document(doc_id, text, model_version)» splits text into chunks of at most 200
         words with a 40-word overlap and gives each chunk a stable id and a content hash.
      2. «plan_upserts(doc_id, text, model_version, stored)» takes «stored», a dict of
         «chunk_id -> content_hash» already in the index, and returns the chunks to embed and
         the chunk ids to delete.

      Reruns must not re-embed unchanged chunks. A changed model version must re-embed all.
    `,
    hints: [
      'Step by max_words - overlap.',
      'Put the model version inside the hash.',
      'A chunk id that is in stored but not in the new chunks must be deleted.',
    ],
    answer: `
      ~~~python
      import hashlib
      from collections.abc import Iterator
      from dataclasses import dataclass


      @dataclass(frozen=True)
      class Chunk:
          chunk_id: str
          doc_id: str
          position: int
          text: str
          content_hash: str


      def chunk_document(
          doc_id: str,
          text: str,
          model_version: str,
          max_words: int = 200,
          overlap: int = 40,
      ) -> Iterator[Chunk]:
          if not 0 <= overlap < max_words:
              raise ValueError("overlap must be >= 0 and < max_words")
          words = text.split()
          step = max_words - overlap
          position = 0
          for start in range(0, max(len(words) - overlap, 1), step):
              piece = " ".join(words[start : start + max_words])
              if not piece:
                  break
              digest = hashlib.sha256(f"{model_version}\n{piece}".encode()).hexdigest()
              yield Chunk(
                  chunk_id=f"{doc_id}:{position}",
                  doc_id=doc_id,
                  position=position,
                  text=piece,
                  content_hash=digest,
              )
              position += 1


      def plan_upserts(
          doc_id: str,
          text: str,
          model_version: str,
          stored: dict[str, str],
      ) -> tuple[list[Chunk], list[str]]:
          chunks = list(chunk_document(doc_id, text, model_version))
          to_embed = [c for c in chunks if stored.get(c.chunk_id) != c.content_hash]
          current = {c.chunk_id for c in chunks}
          to_delete = sorted(set(stored) - current)
          return to_embed, to_delete
      ~~~

      - The range stops at «len(words) - overlap», so the last window is not only overlap. A
        200-word document gives 1 chunk, not 2.
      - The hash includes the model version, so a new model makes every hash differ and every
        chunk re-embeds. The same text with the same model is skipped.
      - Ids are «doc_id:position», so an upsert replaces the old chunk. A shorter document
        leaves stale ids in «stored», and they are deleted.
      - It is a generator, so a huge document does not build every chunk in memory twice.

      In production, split on tokens from the embedding model's tokenizer, not words, and on
      headings first. One weakness to name: an insertion near the start shifts every later
      window, so all later chunks re-embed. Structure-aware chunking with ids from section
      paths limits that.
    `,
    signals: [
      'Avoids a trailing chunk that is only overlap',
      'Includes the model version in the hash',
      'Uses deterministic ids so upserts replace, not duplicate',
      'Deletes chunks that no longer exist',
      'Names the shifting-window weakness and a fix',
    ],
    followUps: ['How would you run this over 30 million documents a day with a rate-limited API?'],
  },
  {
    slug: 'ai-rag-wrong-answers',
    title: 'The assistant answers with an old policy',
    track: 'ai',
    kind: 'concept',
    difficulty: 'medium',
    companies: ['google', 'uber'],
    prompt: `
      An internal assistant answers HR questions from the policy wiki. Since a new parental
      leave policy was published two weeks ago, about a third of answers still quote the old
      policy. Users have lost trust. How do you find the cause and fix it?
    `,
    hints: [
      'Is the new page in the index at all?',
      'If both versions are retrieved, which one wins and why?',
      'How will you prove the fix and stop it happening again?',
    ],
    answer: `
      **Find the stage that fails**, using the request logs (question, passage ids, prompt and
      model versions):

      1. **Ingestion.** Is the new page indexed, with the right updated time? Check the
         pipeline's freshness lag and dead-letter table.
      2. **Deletes and versions.** Is the old page still in the index? Wikis often keep the old
         page, rename it or move it to an archive, and the pipeline never removes its chunks.
      3. **Ranking.** If both are retrieved, the old page may rank higher because it has more
         chunks, more links or more matching words.
      4. **Generation.** If only the new page is in context and the answer is still old, look
         at the prompt and model.

      The likely cause here is step 2 plus 3: two live versions, and nothing tells the
      retriever which one is current.

      **Fix:**

      - Propagate deletes and archive moves within an SLA, for example an hour, and reconcile
        the index against the source daily.
      - Add «effective_date», «status» and «superseded_by» metadata. Filter out superseded
        pages, and boost recent ones for policy content.
      - Tell the model to prefer the latest effective date when passages conflict, and to cite.

      **Prove it:** add the leave questions to the golden set with the new answer, run it in
      CI, and alert on index freshness lag like any late table.
    `,
    signals: [
      'Debugs stage by stage from logs instead of changing the prompt first',
      'Checks deletes and duplicate versions, not only new content',
      'Adds version and effective-date metadata to retrieval',
      'Adds the failure to the golden set as a regression test',
      'Monitors index freshness with an SLA',
    ],
    followUps: ['How would you find other topics with the same problem before users do?'],
  },
  {
    slug: 'ai-reembed-200m',
    title: 'Switch the embedding model for 200 million chunks',
    track: 'ai',
    kind: 'design',
    difficulty: 'medium',
    companies: ['google'],
    prompt: `
      Your search index holds 200 million chunks embedded with an older model. A newer model
      improves recall at 10 by 8 points on your golden set. Plan the switch with no downtime,
      no drop in quality during the move, and a known cost.
    `,
    hints: [
      'Can old and new vectors live in one index?',
      'What happens to documents that change during the backfill?',
      'How do you roll back?',
    ],
    answer: `
      Vectors from two models are not comparable, so this is a **blue-green migration**, not
      an in-place update.

      1. **Estimate.** 200M chunks x about 300 tokens = 60B tokens. Compare the API price for
         that volume with self-hosted GPUs, and the time each takes under rate limits. Check
         memory: a 1,024-dimension model needs a third more than a 768-dimension one.
      2. **Build the green index** with a backfill job: read chunks from the chunk table (not
         the source systems), embed in large batches, checkpoint by partition, store the model
         version per row. Run it at low priority so live ingestion keeps its quota.
      3. **Dual-write.** From the start of the backfill, new and changed chunks go to both
         indexes. At the end, a reconciliation compares chunk ids and hashes between the two.
      4. **Validate.** Run the golden set and replay a sample of real queries against both
         indexes. Check latency and memory under load.
      5. **Cut over** by switching the query service to the new model and index together,
         behind a flag, first for 5% of traffic. Watch click-through and answer ratings.
      6. **Keep blue** for a week for rollback, then stop dual-writing and delete it.

      The query side must change at the same moment as the index: a query embedded with the
      new model against the old index gives nonsense.
    `,
    signals: [
      'States that mixed model vectors cannot share an index',
      'Estimates tokens, cost, time and memory first',
      'Dual-writes during the backfill and reconciles at the end',
      'Switches query model and index together behind a flag',
      'Keeps a rollback path',
    ],
    followUps: ['The new model is 3x slower per query. Where does that cost show up?'],
  },
  {
    slug: 'ai-text-to-sql-guardrails',
    title: 'Let ops managers ask the warehouse questions',
    track: 'ai',
    kind: 'design',
    difficulty: 'medium',
    companies: ['uber', 'google'],
    prompt: `
      City operations managers want to ask questions in plain English, such as "How many trips
      were cancelled by drivers in Lisbon last week compared to the week before?", and get a
      number they can trust. The warehouse has 4,000 tables. Design it.
    `,
    hints: [
      'Should the model see 4,000 tables?',
      'Who defines "cancelled by driver"?',
      "What stops a query from scanning 50 TB or reading another city's data?",
    ],
    answer: `
      **Scope first.** Start with one domain (trips) and the 20 to 30 questions managers ask
      most, collected from the analytics team's tickets.

      **Semantic layer.** Define metrics («trips», «driver_cancellations», «cancel_rate»),
      dimensions (city, day, product) and joins once, owned by analytics. The model chooses a
      metric, filters and a time range; the layer generates the SQL. That removes most wrong
      joins and wrong definitions.

      **Context retrieval.** For a question, retrieve the relevant metric definitions, certified
      tables and a few verified example queries, not the full catalog.

      **Guardrails:**

      - Run as the user, with row-level security by city and column masking on PII.
      - Read-only role, a dry run to check bytes scanned, and a hard cap per query.
      - Time zones resolved from the city, and "last week" defined once.

      **Trust:** show the answer with the SQL, the metric definition and the time range used.
      When the question is ambiguous, ask a clarifying question instead of guessing.

      **Measure:** a test set of 200 real questions with verified answers, run on every change.
      Track the answer rate, accuracy and how often users open the SQL. Widen to new domains
      only when accuracy holds.
    `,
    signals: [
      'Puts a semantic layer between the model and raw tables',
      'Retrieves curated context instead of the whole schema',
      'Enforces security and cost limits in the warehouse, not the prompt',
      'Shows the SQL and definitions with the answer',
      'Measures accuracy on real questions before widening scope',
    ],
    followUps: ['A manager says the number differs from the dashboard. What is your process?'],
  },
  {
    slug: 'ai-enterprise-rag',
    title: 'Design an assistant over company documents',
    track: 'ai',
    kind: 'design',
    difficulty: 'hard',
    companies: ['google', 'uber'],
    prompt: `
      Design an assistant that answers employees' questions from internal documents: wikis,
      shared drives, tickets and chat. 80,000 employees, 50 million documents, about 2 million
      edits a day. Users must never see content they cannot open in the source system. Answers
      must cite sources and arrive within 5 seconds.
    `,
    hints: [
      'Estimate chunks, vectors and daily embedding volume.',
      'How do permissions reach the index, and how fast do they change?',
      'How do you know the answers are good?',
    ],
    answer: `
      **Estimate.** 50M documents x about 10 chunks = 500M chunks. At 768 dimensions in
      float32 that is about 1.5 TB of raw vectors, so the index is sharded and compressed. 2M
      edits a day touch perhaps 5M chunks to re-embed: about 1.5B tokens a day.

      ~~~text
      connectors (wiki, drive, tickets, chat) -> change feed per source -> raw docs (lake)
        -> parse (layout-aware, OCR) -> clean -> chunk with section paths -> hash
        -> embed changed chunks -> vector + keyword index (sharded, ACL metadata)
      permissions feed -> ACL table -> index metadata updates (minutes)

      question -> rewrite -> hybrid retrieve with user's groups as filter -> rerank top 8
        -> prompt with ids -> LLM -> answer + citations -> log
      ~~~

      **Ingestion.** One connector per source, reading change feeds or webhooks rather than
      full crawls, with a daily reconciliation to catch missed events. Parsing runs as a
      distributed batch job with a dead-letter table. Chunk ids are deterministic and hashed,
      so only changed chunks are embedded.

      **Access control.** Each chunk carries the source ACL as group ids. Retrieval filters on
      the user's groups, resolved at query time from the identity provider. Permission changes
      flow through their own fast path, because a revoked share must disappear in minutes,
      not at the next content change. Deletes propagate the same way. For the most sensitive
      sources, re-check access with the source system before showing the citation.

      **Retrieval.** Hybrid search (BM25 for names, codes and acronyms; vectors for meaning),
      fused with RRF, reranked with a cross-encoder. Metadata boosts: recency, source
      authority, the user's team.

      **Generation.** A prompt that requires citations by passage id and allows "I could not
      find that". Budget: 300 ms retrieval, 200 ms rerank, 2 to 3 s generation, streamed.

      **Evaluation.** A golden set per department, retrieval recall and answer faithfulness in
      CI, thumbs and escalation rates online, and every bad answer added to the golden set.

      **Operate.** Freshness lag per source, ACL sync lag, cost per answer, and prompt
      injection checks on retrieved text. No write tools until read-only quality is proven.
    `,
    signals: [
      'Estimates chunks, vector memory and daily embedding volume',
      'Enforces ACLs at retrieval with a fast permission sync path',
      'Ingests incrementally from change feeds with reconciliation',
      'Uses hybrid retrieval and reranking',
      'Builds evaluation per department and in CI',
      'Treats retrieved text as untrusted input',
    ],
    followUps: [
      'A team wants answers over a database, not documents. How does the design change?',
      'How would you support 30 languages?',
    ],
  },
  {
    slug: 'ai-realtime-recommendations',
    title: 'Serve real-time recommendations for a delivery app',
    track: 'ai',
    kind: 'design',
    difficulty: 'hard',
    companies: ['uber'],
    prompt: `
      Design the system that ranks restaurants on a food delivery app's home screen. 40 million
      daily users, a peak of 60,000 home-screen loads per second, and a 150 ms budget for the
      whole recommendation call. Rankings must react within a minute when a restaurant gets
      busy or a user's session shows new intent.
    `,
    hints: [
      'Split the call into candidate generation and ranking.',
      'Which features are batch, and which must be streaming?',
      'What happens when a feature lookup is slow?',
    ],
    answer: `
      ~~~text
      app -> rec service
              1. candidates (20 ms): restaurants open + deliverable to the user's geo cell
                                      + ANN on user embedding + popular in cell   -> ~500
              2. features   (15 ms): batch get from online store (user, restaurant, cell)
              3. rank       (40 ms): gradient-boosted or small neural model on CPU/GPU
              4. rules      (10 ms): diversity, sponsored slots, hard filters
           -> log impression with features + model version
      ~~~

      **Candidates.** Deliverability is a hard filter: an index from geo cell (for example H3)
      to restaurants that deliver there, refreshed as zones change. Add personal candidates
      from an ANN index of restaurant embeddings queried with the user's embedding, and popular
      items per cell as a fallback for new users.

      **Features.**

      | Feature | Path | Freshness |
      |---|---|---|
      | User cuisine affinity, order history embedding | Batch, daily | Hours |
      | Restaurant rating, price level | Batch | Hours |
      | Restaurant prep time now, open orders | Streaming (Flink) | Seconds |
      | Courier supply and ETA in cell | Streaming | Seconds |
      | Session clicks and searches | Streaming, keyed by session | Seconds |

      Streaming jobs read order and courier events from Kafka, update the online store
      (Redis or a similar key-value store), and write history to the offline store with
      availability time.

      **Serving.** One batched online-store read per request for all candidates. Strict
      timeouts: if a feature misses its deadline, use its default and log that it did. Cache
      restaurant-level features in the service for a few seconds.

      **Training loop.** Log impressions with the exact features used. Join clicks and orders
      as labels. Train on those logs, which removes skew by design. Release behind an A/B test
      on orders per session and delivery time, not only click-through.

      **Scale.** 60,000 requests x 500 candidates = 30M feature reads a second, which is why
      restaurant features are cached and requests are batched. Run per region.
    `,
    signals: [
      'Splits into candidates, ranking and rules with a latency budget each',
      'Applies deliverability as a hard filter before ranking',
      'Separates batch and streaming features by required freshness',
      'Handles slow feature reads with timeouts and logged defaults',
      'Trains on logged serving features to avoid skew',
      'Does the feature-read arithmetic and adds caching',
    ],
    followUps: [
      'How do you rank a restaurant that opened today?',
      'How would you backfill a new streaming feature for training?',
    ],
  },
  {
    slug: 'ai-realtime-fraud',
    title: 'Design real-time payment fraud detection',
    track: 'ai',
    kind: 'design',
    difficulty: 'hard',
    companies: ['uber', 'google'],
    prompt: `
      Design fraud scoring for card payments: 20,000 payments per second at peak, a decision
      (approve, review, decline) within 100 ms at p99, and chargeback labels that arrive up to
      90 days later. Fraud patterns change weekly.
    `,
    hints: [
      'Which velocity features need streaming?',
      'What happens if the model service is down?',
      'How do you train on labels that arrive 90 days late?',
    ],
    answer: `
      ~~~text
      payment API -> fraud service (100 ms p99)
         -> features: online store (user, card, device, merchant, IP)  ~10 ms
         -> model score                                                 ~15 ms
         -> rules + thresholds by segment -> approve / review / decline
         -> event to Kafka: payment, features used, score, decision, model version
      Kafka -> Flink: velocity features (count and amount per card/device/IP in 1m, 1h, 24h)
            -> online store (seconds) + offline history (with availability time)
      chargebacks, manual reviews -> labels table -> training sets (time split)
      ~~~

      **Features.** Velocity features are the core: payments per card in the last minute,
      distinct cards per device in an hour, amount versus the user's normal. Flink keeps them
      in keyed state with event-time windows and writes them to the online store. Graph
      features (shared devices, cards and addresses between accounts) are computed in batch
      and refreshed hourly.

      **Decision.** Model score plus rules. Rules give an instant response to a new attack
      while a model retrains, and they encode hard policy. Thresholds per segment are tuned on
      cost: a missed fraud costs the amount plus fees; a false decline costs the customer.

      **Reliability.** If the model or feature store misses its deadline, fall back to a rules
      score, never to "approve all". The fraud service is idempotent on payment id, so a
      retried payment gets the same decision.

      **Labels and training.** Chargebacks arrive late, so train on payments older than the
      label window, and use manual review outcomes and early signals (disputes, refunds) for
      the recent period. Split by time. Weight or sample the rare fraud class and record how.
      Point-in-time joins on availability time, or train directly on the logged features.

      **Monitoring.** Score and decision-rate drift by segment, feature freshness, review queue
      size, and precision and recall as labels mature. A sudden rise in decline rate pages the
      on-call, because it may be a broken feature rather than an attack.
    `,
    signals: [
      'Builds velocity features in a streaming job with event-time windows',
      'Combines model and rules, with a safe fallback when the model is slow',
      'Handles delayed labels with a label window and early proxies',
      'Sets thresholds from the cost of each error type',
      'Logs features and decisions for training and audit',
      'Treats a decline-rate spike as a possible data incident',
    ],
    followUps: [
      'An attacker spreads payments across many cards. Which feature catches it?',
      'How do you test a new model without blocking real customers?',
    ],
  },
  {
    slug: 'ai-ml-feature-platform',
    title: 'Design a feature platform for 30 model teams',
    track: 'ai',
    kind: 'design',
    difficulty: 'hard',
    companies: ['uber', 'google'],
    prompt: `
      30 ML teams each built their own feature pipelines. The same "trips in the last 7 days"
      exists in 12 versions, two incidents came from training-serving skew, and online
      serving costs are rising. Design a shared feature platform for model teams: definitions,
      training, online serving and embeddings as features.
    `,
    hints: [
      'What does a team declare, and what does the platform generate?',
      'How do embeddings differ from scalar features?',
      'How do you get 30 teams to adopt it?',
    ],
    answer: `
      **Declare once, generate both paths.** A team writes a feature view in code: entity key,
      source, transformation (SQL or a streaming aggregation), freshness target, TTL, owner.
      The platform generates the batch backfill, the streaming job if needed, the offline
      table and the online materialization from that one definition.

      ~~~text
      feature repo (code review) -> registry (definitions, owners, versions, lineage)
        -> batch engine (Spark / warehouse) -> offline store (Iceberg/Delta, history)
        -> stream engine (Flink)           -> online store (key-value, per region)
      training: get_training_set(entities_with_timestamps, feature_list) -> point-in-time join
      serving:  get_online_features(keys, feature_list) -> p99 under 10 ms
      ~~~

      **Training API.** Teams pass a table of entity keys and event timestamps; the platform
      performs the point-in-time join on availability time and records the snapshot ids in
      the model registry.

      **Online serving.** Batched reads, per-feature TTL, defaults on miss, and per-team
      quotas. Materialize to the online store only the features a deployed model reads;
      everything else stays offline. That is the main cost lever.

      **Embeddings as features.** User and item embeddings are features with a model version.
      Store them in the online store for direct lookup, and push item embeddings to a vector
      index for retrieval. A new embedding model version is a new feature, never an overwrite,
      so old models keep working.

      **Skew control.** Log served features per request, and run a daily job that compares
      online and offline values for a sample of keys. Alert on mismatch rate.

      **Adoption.** Start with the 20 most duplicated features, certify them with owners, and
      migrate two teams with the most skew pain. Make discovery easy (search by entity, usage,
      freshness), and track reuse and online cost per team.
    `,
    signals: [
      'One definition generates batch, streaming, offline and online paths',
      'Point-in-time training API that records snapshots',
      'Materializes online only what deployed models read',
      'Versions embeddings as features instead of overwriting',
      'Detects skew by comparing logged online values with offline',
      'Plans adoption with certified shared features and early teams',
    ],
    followUps: ['A team needs a feature with 1-second freshness. What changes, and who pays?'],
  },
  {
    slug: 'ai-multimodal-platform',
    title: 'Design a multi-modal data platform',
    track: 'ai',
    kind: 'design',
    difficulty: 'hard',
    companies: ['google'],
    prompt: `
      A company collects text reviews, photos, short videos and voice notes from users: about
      20 TB of new media a day. Teams want to search it by meaning ("photos of damaged
      packaging"), build training sets for vision and audio models, and remove a user's data
      within 30 days of a deletion request. Design the data platform.
    `,
    hints: [
      'Where do the bytes live, and where does the metadata live?',
      'Which processing runs once per file, and which runs per model version?',
      'How do you delete a user from files, embeddings and training sets?',
    ],
    answer: `
      **Split bytes from metadata.** Media goes to object storage, immutable, at paths keyed by
      a content hash. A metadata table (Iceberg or Delta, or the warehouse) holds one row per
      asset: id, user id, type, size, capture time, consent flags, storage path, and the
      outputs of each enrichment.

      ~~~text
      upload -> object storage (raw) -> event -> enrichment workers (GPU pool, Ray or Beam)
         -> thumbnails / transcodes, speech-to-text, OCR, safety labels
         -> embeddings per model version (image, text, audio)
         -> metadata table (asset_id, model_version, outputs)
         -> vector index (per modality or a shared multi-modal space)
      ~~~

      **Enrichment.** Run once per asset per processor version, keyed so reruns are skipped.
      GPU batch jobs read from a queue with autoscaling; a backlog metric shows lag. A new
      model version runs as a backfill, newest data first.

      **Search.** A multi-modal embedding model maps text and images into one space, so a text
      query finds photos. Store vectors with metadata for filters (date, region, safety label).
      Transcripts and OCR text also go to keyword search.

      **Training sets.** A training set is a query over the metadata table plus a manifest of
      asset ids and storage paths, saved with a version. Training reads the manifest, never a
      live folder. Licensing and consent flags filter at build time.

      **Deletion.** A deletion request marks the user's assets, then a job removes the raw
      files, derived files, metadata rows and vectors, and records proof. Training manifests
      reference ids, so the next build excludes them, and a policy decides when models trained
      on them must be retrained. Object storage lifecycle rules remove old versions.

      **Cost.** 20 TB a day is about 7 PB a year. Tier cold media to cheaper storage classes,
      keep thumbnails hot, and budget GPU hours per enrichment step.
    `,
    signals: [
      'Separates immutable media in object storage from a queryable metadata table',
      'Runs enrichment idempotently per asset and processor version',
      'Uses a shared embedding space for cross-modal search',
      'Builds training sets as versioned manifests',
      'Designs deletion across files, vectors and training data',
      'Estimates yearly storage and plans tiering',
    ],
    followUps: ['How do you find near-duplicate images across 2 billion assets?'],
  },
];
