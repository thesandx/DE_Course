/**
 * The second set of worked design questions for the system design track.
 * They live in their own module to keep `system-design.ts` readable; the
 * track module appends them to its `problems`.
 */

import type { Problem } from '@/types/course';

export const designQuestions: Problem[] = [
  {
    slug: 'design-log-aggregation',
    title: 'Design a log aggregation and search platform',
    track: 'system-design',
    kind: 'design',
    difficulty: 'hard',
    companies: [
      'google',
      'uber',
      'amazon',
      'microsoft',
      'flipkart',
      'walmart',
      'phonepe',
      'swiggy',
    ],
    prompt: `
      Design a platform that collects application logs from 200,000 hosts. Engineers search the
      last 14 days by service, level and free text within seconds, and security keeps one year
      for audits. Peak volume is 3 million log lines per second, about 500 bytes each. A noisy
      service must not take the platform down for everyone else.
    `,
    hints: [
      'Estimate bytes per day before you choose storage.',
      'Do 14-day search and 1-year retention need the same store?',
      'Where do you protect the platform from one noisy service?',
      'What happens when the indexing tier falls behind?',
    ],
    answer: `
      **Estimates.** 3M lines/s × 500 B = 1.5 GB/s at peak, roughly 60 to 80 TB a day raw at an
      average of half of peak. Compressed about 8x, that is near 10 TB a day, 140 TB for 14 days
      of hot data and about 3.5 PB a year of cold data.

      **Collection.** An agent on each host (Fluent Bit or the OpenTelemetry Collector) tails
      files, adds host and service tags, batches and compresses, and buffers to local disk when
      the next hop is slow. It sends to Kafka, keyed by service, with 2 to 3 days of retention as
      the shock absorber.

      **Two stores for two jobs.**

      - **Hot search (14 days):** an index tier such as OpenSearch, or a log-optimised store such
        as Loki or ClickHouse. Index only labels (service, level, host, trace id) and use
        full-text or bloom filters on the message, which keeps index size small. Partition by day
        and service, and drop whole daily indexes for retention.
      - **Cold archive (1 year):** consumers write compressed Parquet to object storage,
        partitioned by date and service. Security queries it with Trino or BigQuery external
        tables, in minutes, not seconds.

      **Isolation.** Quotas per service at ingestion (lines per second and bytes). Over-quota
      traffic is sampled (keep all errors, sample debug and info) and the service owner is told.
      Large tenants get their own Kafka partitions and index shards.

      **Backpressure.** If indexing lags, Kafka absorbs it. Alert on consumer lag in minutes, and
      surface "search is X minutes behind" in the UI instead of silently missing logs.

      **Cost levers.** Drop or sample debug logs at the agent, shorten hot retention for
      high-volume, low-value services, and move search to the archive past 14 days.

      **Capacity.**

      | Item | Number | How |
      |---|---|---|
      | Kafka disk for 3 days | about 75 TB | compress at the agent: about 25 TB × 3 replicas |
      | Hot index | about 280 TB | 10 TB a day × 14 days × 2 replicas |
      | Archive | about 3.5 PB | one year in Parquet |

      Compressing at the agent matters: without it the Kafka tier needs about 8 times the disk.

      **Options I rejected.**

      | Option | Why not |
      |---|---|
      | Full-text index on every field | The index can be as large as the raw data; most searches filter by labels first |
      | One store for 14 days and 1 year | A year in the hot tier costs many times more than object storage |
      | Agents write straight to the index | No buffer, so any indexing slowdown drops logs |
      | A cluster per service | Hundreds of clusters to operate and upgrade |

      **Failure walkthrough: a service logs in a tight loop at 10x its quota.** The agent
      enforces the quota first, so the extra lines never reach the network. Over-quota lines are
      sampled: errors are kept and info is sampled at 1%. The service owner gets an alert with
      the top log templates. Other services see no change. Without quotas, that one service would
      fill Kafka partitions and delay search for everyone.
    `,
    signals: [
      'Names the options rejected and why, then walks through one failure end to end',
      'Estimates throughput and storage per tier',
      'Separates hot search from cheap cold retention',
      'Indexes labels, not every token, to control index size',
      'Enforces per-service quotas and sampling',
      'Uses Kafka as a buffer and shows search lag to users',
    ],
    followUps: [
      'Security needs any log containing a leaked credential deleted everywhere. How?',
      'How would you link a log line to a distributed trace?',
    ],
  },
  {
    slug: 'design-url-shortener-analytics',
    title: 'Design click analytics for a URL shortener',
    track: 'system-design',
    kind: 'design',
    difficulty: 'medium',
    companies: ['google', 'amazon', 'microsoft', 'flipkart', 'walmart', 'phonepe', 'swiggy'],
    prompt: `
      A URL shortener serves 2 billion redirects a day. Link owners see total clicks in near
      real time and a dashboard of clicks by day, country, referrer and device for the life of
      the link. The redirect itself must stay under 50 ms and must never wait on analytics. Bots
      should not count.
    `,
    hints: [
      'How does a click event leave the redirect path without slowing it?',
      'What does the dashboard query, and at which grain should you pre-aggregate?',
      'Some links go viral. What does that do to your aggregation?',
    ],
    answer: `
      **Estimates.** 2B a day is about 23,000 clicks per second on average, maybe 100,000 at
      peak. At about 300 bytes per event, around 600 GB a day raw.

      **Off the hot path.** The redirect server answers from its cache, then writes the click
      event to a local buffer that ships to Kafka asynchronously. If Kafka is down, events spill
      to local disk; the redirect never blocks.

      **Enrich and filter.** A stream job adds country (IP lookup), device (user agent parse) and
      referrer domain, and marks likely bots: known bot user agents, data-centre IP ranges, and
      too many clicks from one IP per link per minute. Bot events are kept but flagged.

      **Serve.**

      - **Live total:** the stream job pre-aggregates per link per 10 seconds and increments a
        counter in a KV store (Redis or Bigtable). For viral links, keep the per-link counter
        sharded and sum on read.
      - **Dashboard:** a real-time OLAP store (Pinot, Druid or ClickHouse) ingests the enriched
        events, rolled up per link, hour, country, referrer and device. Queries filter on one link
        id, so it is the primary sort or partition key.
      - **History:** raw events in the lake, partitioned by date, for reprocessing and for
        changing bot rules.

      **Correctness.** Dedupe on a click id for retries from the shipper. Late events update the
      hourly rollups. A nightly batch recomputes daily totals from the lake with the latest bot
      rules and overwrites the dashboard's daily numbers.

      **Capacity.**

      | Item | Number | How |
      |---|---|---|
      | Raw events | about 600 GB a day | 2B × 300 B |
      | Hourly rollups | far fewer rows | one row per link, hour, country, referrer and device |
      | Spill buffer per server | about 270 MB per 30 min | 30 MB/s fleet-wide over 200 servers |

      **Options I rejected.**

      | Option | Why not |
      |---|---|
      | Write the click to a database during the redirect | Adds latency and couples redirects to analytics |
      | Query the raw events for each dashboard | Seconds per query, and cost grows with the life of the link |
      | Batch only | Owners expect live totals |
      | Hourly rows forever | Roll hourly rows up to daily after 90 days; nobody reads year-old data by the hour |

      **Failure walkthrough: Kafka is unavailable for 30 minutes.** Redirects keep working
      because they never wait on Kafka. Each server spills events to local disk, about 270 MB in
      30 minutes, well within a small disk. Live totals freeze and show "as of". When Kafka
      returns, the shippers drain the spill. The click id makes any resent batch harmless.
    `,
    signals: [
      'Names the options rejected and why, then walks through one failure end to end',
      'Keeps analytics fully off the redirect path',
      'Enriches and flags bots in the stream, re-scores in batch',
      'Uses a counter store for the live total and OLAP for slices',
      'Keys storage by link id, the access pattern',
      'Handles viral links with sharded counters',
    ],
    followUps: [
      'A customer wants unique visitors, not clicks. How do you count them cheaply?',
      'How long do you keep per-hour rollups versus raw events?',
    ],
  },
  {
    slug: 'design-real-time-ops-dashboard',
    title: 'Design a real-time operations dashboard',
    track: 'system-design',
    kind: 'design',
    difficulty: 'medium',
    companies: ['uber', 'amazon', 'microsoft', 'flipkart', 'walmart', 'phonepe', 'swiggy'],
    prompt: `
      City operations teams need a dashboard of trips requested, completed and cancelled, and
      median pickup time, per city and per 1-minute bucket, with less than 1 minute of delay.
      They slice by product (economy, premium) and by neighbourhood, and look back 30 days.
      There are 600 cities and about 30,000 trip events per second at peak. 2,000 people keep
      the dashboard open, refreshing every 10 seconds.
    `,
    hints: [
      'What is the query load from 2,000 open dashboards?',
      'Can a warehouse serve sub-second queries at that rate?',
      'How do you compute a median in a stream?',
    ],
    answer: `
      **Query load.** 2,000 viewers refreshing every 10 s with about 8 panels is 1,600 queries
      per second. That rules out a warehouse, which is built for fewer, bigger queries.

      **Pipeline.**

      - Trip service events (requested, accepted, completed, cancelled) go to Kafka, keyed by trip id.
      - A Flink job joins each trip's events in keyed state to compute pickup time, assigns
        city, product and neighbourhood (H3 cell to neighbourhood lookup, broadcast state), and
        emits enriched rows.
      - A real-time OLAP store (Apache Pinot or Druid) ingests from Kafka directly, with a
        pre-aggregated table per city, product, neighbourhood and minute. Data is queryable
        seconds after it arrives.

      **Medians.** Exact medians need all values. Store a quantile sketch per bucket (t-digest or
      KLL), which merges across neighbourhoods and minutes with small error. Say that error out loud.

      **Serve.** A thin API in front of the store caches each panel result for 5 to 10 seconds, so
      1,600 queries per second become a few hundred distinct ones. The store keeps 30 days; older
      data lives in the lake.

      **Late and wrong data.** Events arriving minutes late update their original minute bucket
      in Pinot via upsert or are accepted into the next segment. Each panel shows "data as of"
      time; a stalled pipeline shows a banner instead of a flat line that looks like zero trips.

      **Capacity.**

      | Item | Number | How |
      |---|---|---|
      | Rows per minute | about 50,000 | active city × product × neighbourhood combinations |
      | Rows for 30 days | about 2.2 billion | 50,000 × 1,440 × 30 |
      | Distinct queries | a few hundred a second | after 5 to 10 s caching of 1,600 queries a second |
      | Flink state | small | open trips only, with a 3-hour TTL |

      **Options I rejected.**

      | Option | Why not |
      |---|---|
      | The warehouse | Built for fewer, bigger queries, not 1,600 a second |
      | Precompute each panel into Redis | Fast, but every new slice needs new code |
      | Exact medians | Needs every value; a sketch merges with about 1% error |
      | Join trip events in the OLAP store | Pinot and Druid are poor at joins; join once in the stream |

      **Failure walkthrough: the Flink job falls 5 minutes behind.** Every panel shows its
      "data as of" time, and a banner appears once lag passes 2 minutes. That stops an ops manager
      from reading a flat line as zero trips and sending drivers away. When the job catches up,
      late minutes fill in via upsert. Trips still open after 3 hours expire from state and are
      counted as incomplete in the lake, not the dashboard.
    `,
    signals: [
      'Names the options rejected and why, then walks through one failure end to end',
      'Computes the query rate and rules out a plain warehouse',
      'Chooses a real-time OLAP store with Kafka ingestion',
      'Uses sketches for medians and states the error',
      'Caches identical panel queries in an API layer',
      'Shows data freshness so a stalled pipeline is not read as zero',
    ],
    followUps: [
      'Ops wants an alert when cancellations in a city double in 5 minutes. Where does it run?',
      'A new dimension (payment method) is added. What has to change?',
    ],
  },
  {
    slug: 'design-iot-sensor-pipeline',
    title: 'Design an IoT sensor data pipeline',
    track: 'system-design',
    kind: 'design',
    difficulty: 'hard',
    companies: [
      'google',
      'uber',
      'amazon',
      'microsoft',
      'flipkart',
      'walmart',
      'phonepe',
      'swiggy',
    ],
    prompt: `
      10 million connected devices (scooters, meters, vehicles) each send a reading every 10
      seconds: location, battery, temperature and status. Devices go offline for hours and then
      upload a backlog. Operations needs alerts within 30 seconds when a device overheats.
      Analysts need per-device history for 2 years, and data science needs daily aggregates.
    `,
    hints: [
      'Estimate events per second and bytes per day.',
      'An offline device uploads hours of old readings at once. Which time do you use?',
      'What is the access pattern for per-device history?',
      'How do you store 2 years cheaply?',
    ],
    answer: `
      **Estimates.** 10M devices / 10 s = 1M readings per second. At 100 bytes, about 100 MB/s or
      8.6 TB a day raw, and roughly 6 PB over 2 years before compression.

      **Ingest.** Devices connect over MQTT to a managed broker or gateway fleet, which
      authenticates each device and forwards to Kafka or Pub/Sub, keyed by device id so each
      device's readings stay in order. Each reading carries a device timestamp and a sequence
      number.

      **Alerts (30 s).** A Flink job keyed by device id checks rules per reading (temperature
      over threshold for three consecutive readings) and publishes alerts. It uses processing
      time for alerting freshness, but drops backlog readings older than a few minutes from the
      alert path, so a reconnect does not page ops for an incident that ended yesterday.

      **History.** Two stores for two patterns:

      - **Per-device recent lookups:** a wide-column store such as Bigtable or Cassandra, row key
        «device_id#reversed_timestamp», so "last 24 hours of device X" is one range scan. TTL 90 days.
      - **Two-year history and analytics:** Parquet or Iceberg in object storage, partitioned by
        event date and clustered by device id. Backlog uploads land in their event-time partition.

      **Daily aggregates.** A batch job per event date, re-run when late backlog arrives for that
      date (track late arrivals per partition and trigger a recompute when they exceed a threshold).

      **Data quality.** Clock drift on devices is real. Reject or flag readings with timestamps in
      the future or before the device's last reading, and keep the server receive time too.

      **Cost.** Downsample old data: keep raw for 90 days, then 1-minute summaries per device.

      **Capacity.**

      | Item | Number | How |
      |---|---|---|
      | Readings | 1M/s | 10M devices / 10 s |
      | Bigtable, one row per reading | about 70 to 100 nodes | at 10,000 to 14,000 writes a second per node |
      | Bigtable, one row per device-minute | about 15 to 20 nodes | 6 readings per row, about 170,000 writes a second |
      | Lake | about 2 PB over 2 years | 6 PB raw, about 3x columnar compression |

      Grouping readings per device-minute cuts the online store cost by about 5x. The trade-off
      is that the newest reading lands up to a minute later; the alert path does not use this store.

      **Options I rejected.**

      | Option | Why not |
      |---|---|
      | A time-series database for everything | 10M series is a cardinality problem for most of them |
      | Partition history by arrival time | A backlog upload would land in the wrong day |
      | One store for lookups and analytics | Point lookups and full scans need different layouts |

      **Failure walkthrough: a regional outage, then 1M devices reconnect.** Each device uploads
      6 hours of backlog, about 2 billion readings in total. Gateways rate-limit backlog
      upload per device, and Kafka absorbs the rest. The alert path drops readings older than a
      few minutes, so ops is not paged for old heat. The daily aggregate for that date is
      recomputed once the late-arrival count for its partition passes the threshold.
    `,
    signals: [
      'Names the options rejected and why, then walks through one failure end to end',
      'Estimates the event rate and multi-year storage',
      'Keys by device id to keep per-device order',
      'Separates alert freshness from event-time analytics',
      'Designs a row key for per-device range scans',
      'Handles backlog uploads and device clock drift',
      'Downsamples older data for cost',
    ],
    followUps: [
      'A firmware bug sent temperatures in Fahrenheit for a week. How do you fix history?',
      'How do you push a new alert rule to the stream job without downtime?',
    ],
  },
  {
    slug: 'design-listening-analytics',
    title: 'Design Spotify-style listening analytics and royalties',
    track: 'system-design',
    kind: 'design',
    difficulty: 'hard',
    companies: ['google', 'amazon', 'microsoft', 'flipkart', 'walmart', 'phonepe', 'swiggy'],
    prompt: `
      A music streaming app has 600 million users and records every play: track, user, start
      time, seconds played, device and whether it was offline. Artists see daily stream counts.
      Royalties are paid monthly per stream, where a stream counts only after 30 seconds of play.
      Each December, every user gets a personal year-in-review. Offline plays sync days later.
    `,
    hints: [
      'Which consumer needs exact numbers, and when?',
      'Offline plays arrive late. How does that affect monthly royalties?',
      'The year-in-review is one huge batch job. How do you make it cheap and on time?',
    ],
    answer: `
      **Estimates.** About 3 billion plays a day is roughly 35,000 per second on average, peaks
      near 100,000. At 200 bytes, about 600 GB a day.

      **Event design.** The client sends a play event with a client-generated play id when play
      ends or crosses 30 seconds, plus heartbeats for long plays. Offline plays are queued on the
      device and synced with their original timestamps.

      **Paths.**

      - **Raw:** events to Kafka, then to the lake, partitioned by event date, deduped on play id.
      - **Artist stats (daily):** a batch job per event date counts qualifying streams (30 s or
        more, not flagged as fraud) by track, country and day. Late offline plays re-trigger the
        dates they belong to for 14 days, then are counted in the day they arrive.
      - **Royalties (monthly):** run after a fixed close, for example 10 days after month end, so
        nearly all offline plays are in. Plays arriving after close go into the next statement as
        adjustments, never by rewriting a paid statement. Every statement is versioned and
        reproducible from the lake.
      - **Fraud:** stream farms (many accounts looping one track) are filtered in batch with
        account and device signals before royalties.

      **Year in review.** Do not scan a year of raw events in December. Keep a per-user monthly
      summary table (top tracks, artists, minutes, genres), built incrementally each month. In
      December, the job reads 12 small summaries per user, ranks, and writes results to a KV store
      that the app reads by user id. Run it early and freeze, then patch the last weeks.

      **Privacy.** Listening history is personal: apply retention limits and honour deletion in
      the lake and the summaries.

      **Capacity.**

      | Item | Number | How |
      |---|---|---|
      | Raw plays | about 600 GB a day | 3B × 200 B |
      | Monthly summaries | about 7 billion rows a year | 600M users × 12 |
      | Year-in-review output | 600M small documents | written to a KV store by user id |

      **Options I rejected.**

      | Option | Why not |
      |---|---|
      | Count royalties in real time | Offline plays and fraud signals arrive days later |
      | Scan a year of raw plays in December | About 220 TB per run, at the worst time of year to debug |
      | Close the month on day 1 | Offline plays that sync later would miss the statement |
      | Rewrite paid statements | Breaks audits; late plays become adjustments |

      **Failure walkthrough: one app version double-sends plays.** If retries reuse the play id,
      dedupe removes them. If the bug creates a new id each time, the plays-per-user rate for that
      app version jumps, and an anomaly monitor fires. Before the month closes, the team filters
      the version's duplicates and recomputes. After close, the correction becomes an adjustment
      in the next statement.
    `,
    signals: [
      'Names the options rejected and why, then walks through one failure end to end',
      'Dedupes on a client play id and keeps event time for offline plays',
      'Applies the 30-second rule and fraud filtering before royalties',
      'Closes the royalty month and books late plays as adjustments',
      'Builds year-in-review from incremental monthly summaries',
      'Serves per-user results from a KV store',
    ],
    followUps: [
      'A label disputes last quarter’s numbers. How do you reproduce them exactly?',
      'How would you show an artist live streams for a new release on launch day?',
    ],
  },
  {
    slug: 'design-recommendation-data',
    title: 'Design the data pipeline behind Netflix-style recommendations',
    track: 'system-design',
    kind: 'design',
    difficulty: 'hard',
    companies: ['google', 'amazon', 'microsoft', 'flipkart', 'walmart', 'phonepe', 'swiggy'],
    prompt: `
      A video streaming service shows each of its 250 million members personalised rows on the
      home page. The ML team trains ranking models daily and wants to try new features each
      week. Design the data side: what you log, how training data is built, how candidate rows
      reach the home page, and how you measure whether a new model is better. Online model
      serving itself is out of scope.
    `,
    hints: [
      'What did the member see, not only what did they play?',
      'How do you join features as they were at the time of the impression?',
      'Most members get the same rows between visits. What can be precomputed?',
    ],
    answer: `
      **Logging is the foundation.**

      - **Impressions:** every title shown, with row, position, page id, model version and request id.
      - **Engagement:** plays, play duration, completion, add to list, thumbs, keyed by the same request id.
      - **Serve-time features:** the feature values the model used, logged with the request id.
        This lets training use exactly what serving saw and prevents train/serve skew.

      Impressions are large: 250M members × a few visits × about 100 titles shown. Store them in
      the lake partitioned by date, and sample negatives for training.

      **Training data.** A daily job joins impressions to engagement within an attribution window
      (for example, a play within 24 hours of the impression counts as a positive). Features come
      from the serve-time log, or from a feature store with a point-in-time join on the impression
      timestamp, never from today's values. New features are backfilled with the same
      point-in-time logic.

      **Candidates and rows.** Most of the home page is precomputed: a nightly batch generates
      candidates per member (similar titles, continue watching, trending in country) and stores
      them in a KV store by member id. Online ranking only reorders them using fresh context.
      Continue watching is updated by a stream job within seconds of a play.

      **Measurement.** Offline metrics (ranking quality on held-out days) choose what to test.
      Online A/B tests decide, on long-term metrics such as hours watched and retention, using
      the experiment assignment logged with each request.

      **Scale and privacy.** Partition everything by date, keep raw impressions for a set window,
      and apply deletion requests to logs and derived training sets.

      **Capacity.**

      | Item | Number | How |
      |---|---|---|
      | Impressions | about 50B a day | 250M members × 2 visits × 100 titles |
      | Impression storage | about 5 TB a day | about 100 B each, compressed |
      | Training rows | about 5B a day | all positives plus about 10% of negatives |
      | Candidate store | about 1 TB | 250M members × 500 candidates × 8 B ids |

      **Options I rejected.**

      | Option | Why not |
      |---|---|
      | Build features from today's tables | Leaks the future into training; offline scores look better than reality |
      | Generate every candidate online | Too slow and costly for 250M home pages |
      | Train on every impression | Most are negatives that add cost, not signal |
      | Choose models by offline metrics alone | Offline gains often do not survive an A/B test |

      **Failure walkthrough: the TV app stops logging serve-time features for 2 days.** The
      monitor on the share of requests with missing features fires. The training job's input
      gate refuses those partitions, so tomorrow's model is not trained on broken rows. The team
      backfills those days through the point-in-time join, or drops them and records the gap.
    `,
    signals: [
      'Names the options rejected and why, then walks through one failure end to end',
      'Logs impressions and serve-time features, not only plays',
      'Builds labels with an attribution window',
      'Uses point-in-time correct features to avoid leakage',
      'Precomputes candidates in batch, ranks online',
      'Measures with A/B tests on long-term metrics',
    ],
    followUps: [
      'A new feature needs two years of history. How do you backfill it without leakage?',
      'How do you detect that the serving features drifted from the training features?',
    ],
  },
  {
    slug: 'design-timeline-analytics',
    title: 'Design Twitter-style timeline and post analytics',
    track: 'system-design',
    kind: 'design',
    difficulty: 'hard',
    companies: ['google', 'amazon', 'microsoft', 'flipkart', 'walmart', 'phonepe', 'swiggy'],
    prompt: `
      A social network has 250 million daily users. Authors see impressions, likes, reposts and
      replies on each post in near real time, and an analytics page with 90 days of history. A
      trending module shows the top topics per country, updated every minute. Some posts from
      celebrities get 50 million impressions in an hour.
    `,
    hints: [
      'Impressions dwarf every other event. Estimate them.',
      'What is a hot key here, and how do you aggregate it?',
      'How do you find trending topics without counting every word forever?',
    ],
    answer: `
      **Estimates.** If each daily user sees about 200 posts, that is 50 billion impressions a
      day, about 600,000 per second on average. Engagement events are around 1% of that.

      **Impressions.** Clients batch impression events (post id, viewer, timestamp, surface) and
      send every few seconds. Dedupe on (viewer, post, session) so a scroll back does not count twice.

      **Per-post counters.**

      - A stream job pre-aggregates per post per 10 seconds. For hot posts, it first aggregates
        per post and a random shard, then combines shards, so one celebrity post does not
        overload one worker.
      - Totals go to a counter store keyed by post id, which the post page reads.
      - Hourly and daily rollups per post, plus dimensions (country, surface, follower or not),
        go to an OLAP store for the 90-day analytics page.

      **Trending.**

      - Extract topics (hashtags, entities) from new posts and engagement in a stream job.
      - Count per topic per country in sliding windows (for example 15 minutes, every minute),
        and compare to a baseline from the same hour last week. Trending means growth, not volume.
      - Use a count-min sketch plus a top-k heap per country to keep memory bounded.
      - Filter spam and coordinated activity (many new accounts) before ranking.

      **Correctness.** Public counters are approximate and corrected by a daily batch from the
      lake. Author analytics use the batch numbers once a day closes.

      **Capacity.**

      | Item | Number | How |
      |---|---|---|
      | Impressions | about 600,000/s average, about 1.5M/s peak | 50B a day |
      | Raw storage | about 5 TB a day | about 100 B per impression |
      | Hot post | about 14,000/s | 50M impressions in an hour |
      | Per shard with 64 salt shards | about 220/s | 14,000 / 64 |

      **Options I rejected.**

      | Option | Why not |
      |---|---|
      | Increment a counter per impression | One celebrity post overloads one key |
      | Exact distinct viewers | HyperLogLog is enough for a public number, at a tiny fraction of the memory |
      | Trending by raw volume | Always shows the same big topics; trending means unusual growth |
      | One job for counters and trending | Different keys and windows; one failure would take down both |

      **Failure walkthrough: a celebrity post goes viral and one shard falls behind.** Salting
      spreads the load, so only one of 64 shards is slow, and the counter is a few seconds stale.
      If a whole job falls behind, the post page shows the last value and keeps it monotonic. The
      daily batch from the lake sets the true numbers for the analytics page.
    `,
    signals: [
      'Names the options rejected and why, then walks through one failure end to end',
      'Estimates impressions as the dominant volume',
      'Dedupes impressions on viewer, post and session',
      'Shards hot posts before aggregating',
      'Defines trending as growth against a baseline',
      'Uses sketches and top-k to bound memory',
    ],
    followUps: [
      'Advertisers need exact impression counts for billing. What changes?',
      'How do you stop a bot network from making a topic trend?',
    ],
  },
  {
    slug: 'design-feed-ranking-data',
    title: 'Design LinkedIn-style feed events and ranking data',
    track: 'system-design',
    kind: 'design',
    difficulty: 'hard',
    companies: ['google', 'amazon', 'microsoft', 'flipkart', 'walmart', 'phonepe', 'swiggy'],
    prompt: `
      A professional network ranks each member's feed. Design the data platform behind it:
      tracking of feed views and actions, near-real-time features such as "this post got 200
      comments in the last hour", daily training data, and reporting for creators. Assume 300
      million monthly members and 10 billion feed impressions a week.
    `,
    hints: [
      'Which features must be fresh within minutes, and which can be daily?',
      'How do you keep training features identical to serving features?',
      'A member scrolls past a post in 0.2 seconds. Is that an impression?',
    ],
    answer: `
      **Tracking.** A tracking schema owned in a registry, with versioned events: feed impression
      (post, position, dwell time, request id), and actions (like, comment, share, click, hide).
      Define an impression precisely, for example at least 50% visible for 300 ms, and enforce it
      on the client. Events go to Kafka.

      **Features by freshness.**

      | Freshness | Examples | Built by |
      |---|---|---|
      | Seconds to minutes | Post engagement velocity, viewer session actions | Stream job writing to an online store |
      | Hourly to daily | Author quality, member interests, connection strength | Batch jobs over the lake |

      Both write to a feature store: an online KV store for serving and an offline table with
      timestamps for training.

      **Training data.** Join impressions to later actions within a window to build labels.
      Attach features as logged at serve time, or through a point-in-time join on the offline
      store. Dwell-time thresholds turn passive views into weak positives or negatives.

      **Creator reporting.** Hourly rollups per post and per creator in an OLAP store, with
      demographics aggregated to a minimum group size so no viewer is identifiable.

      **Guardrails.** Monitor feature freshness (an online feature older than its SLO falls back
      to a default), track the share of requests with missing features, and compare online and
      offline feature distributions daily to catch skew.

      **Capacity.**

      | Item | Number | How |
      |---|---|---|
      | Impressions | about 16,500/s average, about 50,000/s peak | 10B a week |
      | Online feature reads | many per feed request | batch reads by entity keys, p99 under 10 ms |
      | Offline feature history | grows with time | partition by date, keep a fixed window |

      **Options I rejected.**

      | Option | Why not |
      |---|---|
      | Hourly batch for velocity features | "200 comments in the last hour" is stale by the time it lands |
      | Separate code for online and offline features | The main cause of train/serve skew |
      | Creator reports from raw events | Slow, and risks exposing individual viewers |
      | A loose impression definition | Changes the click-through rate denominator without anyone noticing |

      **Failure walkthrough: the streaming feature job lags 30 minutes.** Online velocity
      features pass their freshness SLO. The serving path uses defaults for them and logs that
      it did. Ranking quality drops a little, but feeds still load. The freshness alert pages the
      feature owner, and the training job excludes the window from training labels that depend
      on those features.
    `,
    signals: [
      'Names the options rejected and why, then walks through one failure end to end',
      'Defines an impression precisely and enforces it in tracking',
      'Splits features by freshness into stream and batch',
      'Uses an online and offline feature store with timestamps',
      'Builds labels from later actions with a window',
      'Monitors freshness and online/offline skew',
      'Protects viewer privacy in creator reporting',
    ],
    followUps: [
      'A tracking bug double-counted impressions on Android for a week. What do you fix, and how?',
      'How do you add a new real-time feature end to end?',
    ],
  },
  {
    slug: 'design-multi-tenant-platform',
    title: 'Design a multi-tenant analytics platform',
    track: 'system-design',
    kind: 'design',
    difficulty: 'hard',
    companies: [
      'google',
      'uber',
      'amazon',
      'microsoft',
      'flipkart',
      'walmart',
      'phonepe',
      'swiggy',
    ],
    prompt: `
      You run a SaaS product with 5,000 business customers. Each customer gets an analytics
      dashboard and an export of their own data. The largest 20 customers produce 60% of the
      data. Customers must never see each other's data, one heavy customer must not slow down
      the rest, and finance wants the cost of each customer. Design the data platform.
    `,
    hints: [
      'Shared tables, a schema per tenant, or a database per tenant: what does each cost?',
      'Where is tenant isolation enforced, and how do you test it?',
      'How do you stop a noisy neighbour?',
    ],
    answer: `
      **Isolation model: a hybrid.**

      | Model | Good for | Cost |
      |---|---|---|
      | Shared tables with «tenant_id» | Thousands of small tenants | Isolation depends on every query |
      | Schema or dataset per tenant | Mid-size tenants, per-tenant retention | Thousands of objects to migrate |
      | Dedicated storage and compute | The largest or regulated tenants | Higher cost, more operations |

      Put the long tail in shared tables, partitioned or clustered by «tenant_id», and give the top
      tenants dedicated datasets and compute. Hide the choice behind one tenant routing service.

      **Enforce isolation in the platform, not in each query.** Use row-level security or
      authorised views bound to the caller's tenant, issued by the API layer from the
      authenticated tenant, never from a request parameter. Add an automated test that runs every
      dashboard query as tenant A and asserts no row from tenant B appears. Encrypt regulated
      tenants with their own keys.

      **Noisy neighbours.**

      - Per-tenant query quotas and concurrency limits at the API.
      - Workload isolation: separate compute pools or reservations for the large tenants.
      - Pre-aggregated tables per tenant for the dashboard, so the common path is cheap.
      - Exports run as queued batch jobs, not ad hoc queries.

      **Cost attribution.** Tag every job and query with «tenant_id». Storage per tenant comes
      from partition sizes; compute from query logs (bytes or slot time). Shared overhead is split
      by usage. Finance gets a daily cost table per tenant.

      **Lifecycle.** Onboarding creates the tenant's objects from a template. Offboarding deletes
      or exports the tenant's data within the contract window, with proof of deletion.

      **Capacity.**

      | Item | Number | How |
      |---|---|---|
      | Tenants | 5,000 | 20 large ones own 60% of the data |
      | Dedicated datasets | about 20 | the top tenants |
      | Shared tables | for about 4,980 tenants | clustered by «tenant_id» |

      **Options I rejected.**

      | Option | Why not |
      |---|---|
      | A database per tenant for all 5,000 | 5,000 schemas to migrate on every change |
      | Shared everything, including the top 20 | One big export slows the long tail |
      | Filter by «tenant_id» in each query | One missed filter is a data leak; enforce it in the platform |
      | Cost split by row count | Large tenants cost more per row because their queries scan more |

      **Failure walkthrough: a new dashboard query forgets the tenant filter.** Row-level
      security still binds the session to one tenant, so no other tenant's row appears. The
      cross-tenant test in CI also catches it before release, because it runs every query as
      tenant A and checks for tenant B's rows. Two independent controls mean one mistake is not
      an incident.
    `,
    signals: [
      'Names the options rejected and why, then walks through one failure end to end',
      'Compares isolation models and chooses a hybrid by tenant size',
      'Enforces tenant scope from authentication, not the request',
      'Tests cross-tenant leakage automatically',
      'Protects the platform with quotas and workload isolation',
      'Attributes cost per tenant from tags and query logs',
    ],
    followUps: [
      'A customer moves from the shared tier to dedicated. How do you migrate without downtime?',
      'A customer asks for their data to live only in the EU. What changes?',
    ],
  },
  {
    slug: 'design-data-mesh-platform',
    title: 'Design a self-serve data mesh platform',
    track: 'system-design',
    kind: 'design',
    difficulty: 'hard',
    companies: [
      'google',
      'uber',
      'amazon',
      'microsoft',
      'flipkart',
      'walmart',
      'phonepe',
      'swiggy',
    ],
    prompt: `
      Leadership has agreed to move to a data mesh. 30 domain teams will publish data products.
      You lead the platform team of 8 engineers. Design the platform: how a domain creates and
      publishes a product, how consumers find and trust it, how governance is enforced, and how
      you know the platform works.
    `,
    hints: [
      'What does "create a data product" look like as a single command or pull request?',
      'Which rules are checked automatically, and where?',
      'What do consumers need before they depend on someone else’s data?',
    ],
    answer: `
      **The product as code.** A domain creates a product from a template: one repository folder
      with a product spec (name, owner, output ports, schema contract, SLOs, classification),
      transformation code, tests and CI. Merging it provisions storage, permissions, the
      orchestration job and the catalog entry. Target: a new product in a day, with no ticket.

      **Output ports.** Products publish tables in a shared lakehouse format (Iceberg or Delta)
      or topics on Kafka, under a namespace per domain. A breaking schema change requires a new
      major version that runs beside the old one for a deprecation window.

      **Governance as code.**

      - CI checks: the contract matches the output, every column is classified (PII or not),
        naming and retention follow policy, tests exist for keys and freshness.
      - Access: policies by classification and purpose, enforced by the query engines (row and
        column level), with approvals recorded.
      - Policies are written by a federated group of domain and platform members, not by the
        platform team alone.

      **Discovery and trust.** A catalog shows each product's owner, contract, SLOs and live
      status (freshness, test results, incidents), lineage across products, and usage. Consumers
      subscribe to products and get notified of deprecations and incidents.

      **Operations.** Each product has an on-call owner in its domain. The platform runs the
      shared engines and gets paged only for platform faults.

      **Measure the platform.** Time to create a product, products meeting their SLOs, consumers
      per product, incidents caused by breaking changes, and cost per domain. Report them each quarter.

      **Capacity.**

      | Item | Number | How |
      |---|---|---|
      | Domains | 30 | about 2 to 3 products each |
      | Products | 60 to 100 | within a year |
      | Platform engineers | 8 | about 1 for every 4 domains |

      With 8 engineers for 30 domains, anything that needs a ticket fails. Self-service is not a
      nice-to-have; it is the only design that fits the headcount.

      **Options I rejected.**

      | Option | Why not |
      |---|---|
      | A central team builds every product | Becomes the bottleneck that mesh exists to remove |
      | No platform: each domain picks a stack | 30 stacks, 30 security models and no shared catalog |
      | Governance reviewed by people | Does not scale; checks in CI do |
      | Big-bang adoption | Start with 2 or 3 willing domains, then grow from their results |

      **Failure walkthrough: a domain renames a column used by 12 consumers.** The contract
      check in CI fails the merge, because the change is breaking. The domain publishes a new
      major version beside the old one. The catalog notifies all 12 consumers with a deprecation
      date. If a domain bypasses CI, the output check after publish fails, and the platform
      holds the new version back.
    `,
    signals: [
      'Names the options rejected and why, then walks through one failure end to end',
      'Makes a product a declarative spec with provisioning on merge',
      'Versions output ports and runs old and new side by side',
      'Enforces classification and contracts in CI',
      'Shows live trust signals in the catalog',
      'Keeps on-call with the domain, platform faults with the platform',
      'Defines success metrics for the platform itself',
    ],
    followUps: [
      'Two domains publish conflicting definitions of "customer". What does the platform do?',
      'How do you charge each domain for its compute and storage?',
    ],
  },
  {
    slug: 'design-data-quality-monitoring',
    title: 'Design a data quality monitoring platform',
    track: 'system-design',
    kind: 'design',
    difficulty: 'hard',
    companies: [
      'uber',
      'google',
      'amazon',
      'microsoft',
      'flipkart',
      'walmart',
      'phonepe',
      'swiggy',
    ],
    prompt: `
      The company has 20,000 tables in the lake and warehouse, built by 400 pipelines. Bad data
      reaches executives' dashboards about twice a month, usually found by a person. Design a
      platform that detects quality problems early, routes them to the right owner, and stops bad
      data from spreading. Avoid alert fatigue.
    `,
    hints: [
      'Not every table deserves the same checks. How do you choose?',
      'Which checks are rules, and which are learned from history?',
      'When a check fails, what happens to the tables downstream?',
    ],
    answer: `
      **Tier the tables.** Use lineage and query logs to find the tables behind executive
      dashboards, finance and ML. Call them tier 1 (perhaps 500 tables). Tier 1 gets full
      checks and blocking; the rest gets automatic baseline monitors only.

      **Check types.**

      - **Rule checks** declared by owners: not null, unique keys, referential integrity, accepted
        values, reconciliation against a source total.
      - **Automatic monitors** on every table: freshness (time since last update), volume (row
        count per partition), schema changes, and null rates and distributions per column. They
        learn a baseline with seasonality (day of week) and flag anomalies.

      **Where checks run.** Rule checks run inside pipelines after each write, before publish.
      Use write-audit-publish: write to a staging branch or partition, run checks, then publish
      (an Iceberg branch, a partition swap). Monitors run from metadata and cheap aggregate queries
      after publish, so cost stays bounded.

      **Stop the spread.** A failed blocking check keeps the bad partition unpublished, and the
      orchestrator holds downstream jobs. Lineage marks downstream tables as suspect, and
      dashboards show a warning.

      **Routing and fatigue.** Every table has an owner from the catalog. Alerts go to the
      owner's channel with the failing check, sample rows and upstream changes. Group alerts by
      root cause through lineage: one failed source should produce one incident, not 300 alerts.
      Track alert precision; tune or remove monitors that fire without action.

      **Measure.** Incidents found by the platform versus by people, time to detect, and time to
      resolve, per tier.

      **Capacity.**

      | Item | Number | How |
      |---|---|---|
      | Automatic monitors | about 80,000 a day | 20,000 tables × 4 monitors, from metadata |
      | Tier 1 rule checks | about 5,000 per load cycle | 500 tables × about 10 checks |
      | Alert budget | under 2 a week per team | above that, people ignore alerts |

      **Options I rejected.**

      | Option | Why not |
      |---|---|
      | Owner-written rules on all 20,000 tables | Nobody writes them for low-value tables, so coverage stays low |
      | Anomaly detection only | Cannot block a publish; tier 1 needs hard rules |
      | Full-scan profiling of every table daily | The cost grows with the lake; use metadata and sampling |
      | Alert each check failure separately | One bad source becomes 300 alerts |

      **Failure walkthrough: a source sends a column full of nulls.** The tier 1 not-null check
      fails after the write, so the partition stays unpublished. The orchestrator holds 40
      downstream jobs. Lineage marks 300 tables as suspect, but the router groups them into one
      incident for the source owner. Executive dashboards show yesterday's data with a warning,
      not wrong data.
    `,
    signals: [
      'Names the options rejected and why, then walks through one failure end to end',
      'Tiers tables using lineage and usage',
      'Combines owner rules with learned anomaly monitors',
      'Blocks publication with write-audit-publish',
      'Uses lineage to stop spread and group alerts by root cause',
      'Measures alert precision and detection time',
    ],
    followUps: [
      'A monitor flags a real holiday spike as an anomaly every year. How do you fix it?',
      'How would you check quality on a streaming table?',
    ],
  },
  {
    slug: 'design-feature-store',
    title: 'Design a feature store',
    track: 'system-design',
    kind: 'design',
    difficulty: 'hard',
    companies: [
      'uber',
      'google',
      'amazon',
      'microsoft',
      'flipkart',
      'walmart',
      'phonepe',
      'swiggy',
    ],
    prompt: `
      Data scientists at a ride-hailing company build models for ETA, fraud and pricing. Each
      team recomputes the same features in its own notebooks, and models do worse in production
      than in training. Design a feature store: how features are defined, computed, stored,
      served online in under 10 ms, and used for training without leakage.
    `,
    hints: [
      'Why do models do worse in production? Name the two main causes.',
      'Training and serving need different stores. Why?',
      'What is a point-in-time join?',
    ],
    answer: `
      **The causes.** Train/serve skew (features computed by different code online and offline)
      and leakage (training rows that use feature values from after the label time).

      **Define once.** A feature is declared in a registry: entity (driver, rider, cell), source,
      transformation, freshness and owner. The same definition generates both the batch and the
      streaming computation, which removes most skew.

      **Compute.**

      - Batch features (driver 30-day rating) run daily over the lake.
      - Streaming features (driver trips in the last 15 minutes) run in Flink from Kafka.
      - On-demand features (distance from rider to driver) are computed at request time from
        request data.

      **Store.**

      - **Offline store:** every feature value with its entity key and event timestamp, in the
        lake (Iceberg, BigQuery). Full history.
      - **Online store:** only the latest value per entity, in a low-latency KV store (Redis,
        Bigtable, DynamoDB or Cassandra), for p99 reads under 10 ms. Both are written by the same
        job, so they agree.

      **Point-in-time join.** To build training data, for each label row (entity, timestamp),
      take the latest feature value with a timestamp at or before the label time. This is an
      as-of join, done by the store's SDK so nobody writes it by hand.

      **Serve.** The model service asks the store for a feature vector by entity keys. Batch
      reads for many entities, timeouts, and defaults for missing or stale features.

      **Operate.** Monitor freshness per feature, the share of defaults served, and online versus
      offline distributions. Log served feature values with each prediction, so future training
      can use exactly what was served.

      **Capacity.**

      | Item | Number | How |
      |---|---|---|
      | Entities | about 105M | 5M drivers, 100M riders |
      | Online store size | about 40 GB plus overhead | 105M × 50 features × 8 B |
      | Online reads | about 300,000/s | 100,000 predictions/s × 3 entities |

      40 GB fits in memory in a small Redis cluster, but at 300,000 reads a second the choice
      is driven by p99 latency and operations, not size.

      **Options I rejected.**

      | Option | Why not |
      |---|---|
      | Keep features in team notebooks | The cause of the problem: duplicated work and skew |
      | Compute every feature at request time | Aggregates over 30 days cannot be computed in 10 ms |
      | Train from online store snapshots | The online store keeps only the latest value; no history |
      | Buy a managed store without the as-of join | The point-in-time join is the main value; do not give it up |

      **Failure walkthrough: the streaming feature job stalls.** Values in the online store age.
      Each feature has a TTL equal to its freshness SLO, so stale values are treated as missing
      and replaced by defaults. The served-defaults metric jumps and pages the feature owner.
      Model quality drops a little, but no model sees wrong data presented as fresh.
    `,
    signals: [
      'Names the options rejected and why, then walks through one failure end to end',
      'Names train/serve skew and leakage as the root causes',
      'Uses one definition for batch and streaming computation',
      'Separates the offline history store from the online latest-value store',
      'Explains the point-in-time (as-of) join',
      'Handles stale and missing features at serving time',
      'Logs served features for future training',
    ],
    followUps: [
      'A feature definition changes. How do you version it without breaking live models?',
      'How do you backfill a new streaming feature for two years of training data?',
    ],
  },
];
