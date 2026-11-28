import type { Problem } from '@/types/course';

/**
 * Integrated product-sense cases in the shape of a Meta data engineering
 * round: one product, and in 45 minutes the metric, the model, the SQL and a
 * small Python task. They join the playbook track in `playbook.ts`.
 */

export const productSenseProblems: readonly Problem[] = [
  {
    slug: 'case-groups-health',
    title: 'Case: is a community product healthy?',
    track: 'playbook',
    kind: 'concept',
    difficulty: 'hard',
    companies: ['meta', 'google', 'microsoft'],
    prompt: `
      A social app has Groups: users join groups, post and comment. The product lead asks four
      things in one round. (1) Which metrics say Groups are healthy? (2) Design the tables. (3) Write
      the SQL for the share of daily active group members who posted or commented. (4) In Python,
      given a stream of «(user_id, group_id, action)» events, return the top three groups by
      distinct active users.
    `,
    hints: [
      'Healthy for whom: members, admins, or the company?',
      'Joining is not engagement. What counts as an active member?',
      'The SQL denominator is members active in groups, not all users.',
      'The Python part is a dictionary of sets and a sort.',
    ],
    answer: `
      **1. Metrics.** The goal is groups where members get value and come back.

      | Metric | Definition |
      |---|---|
      | **Contributing member rate** (north star) | Members who posted or commented in a group on a day ÷ members active in groups that day |
      | Groups with a healthy core | Groups with at least 5 members who contribute in a week ÷ groups with any activity |
      | 28-day member retention | Members active in a group in week 1 who are active in it in week 4 |
      | Counter-metric | Reports and admin removals per 1,000 posts |

      **2. Model.**

      - «fct_group_activity»: one row per event: user, group, action (view, post, comment, react),
        time. Partition by date.
      - «fct_group_member_daily»: one row per member, group and day with counts per action. Most
        metrics read this table.
      - «dim_group» (privacy, size band, category, SCD 2 on privacy) and «dim_user».
      - «fct_group_membership»: one row per join and leave, for retention and churn.

      **3. SQL.**

      ~~~sql
      SELECT activity_date,
             COUNT(DISTINCT user_id) FILTER (WHERE posts + comments > 0) * 1.0
               / COUNT(DISTINCT user_id) AS contributing_member_rate
      FROM fct_group_member_daily
      WHERE activity_date >= CURRENT_DATE - 28
      GROUP BY activity_date;
      ~~~

      **4. Python.**

      ~~~python
      from collections import defaultdict

      def top_groups(events, k=3):
          users = defaultdict(set)
          for user_id, group_id, action in events:
              users[group_id].add(user_id)
          return sorted(users, key=lambda g: (-len(users[g]), g))[:k]
      ~~~

      For a stream that does not fit in memory, say you would keep a HyperLogLog per group
      instead of a set, and a heap of size k instead of a full sort.
    `,
    signals: [
      'Defines a north star with a numerator and a denominator',
      'Adds a counter-metric for harm',
      'Builds a member-group-day table that the metrics read',
      'Uses the right denominator in the SQL',
      'Breaks ties in the Python and names a scale plan (sketch, heap)',
    ],
    followUps: [
      'The contributing rate went up but retention went down. What could cause both?',
      'How would you count distinct active users per group per month cheaply?',
    ],
  },
  {
    slug: 'case-short-video-watch-time',
    title: 'Case: short video watch time is up, is that good?',
    track: 'playbook',
    kind: 'concept',
    difficulty: 'hard',
    companies: ['meta', 'google', 'amazon'],
    prompt: `
      Short videos autoplay in a feed. Watch time per user rose 8 percent after a ranking change.
      (1) Is it good? Which metrics decide? (2) Model the viewing data. (3) Write SQL for the share
      of views watched to at least 75 percent, per day. (4) In Python, merge overlapping watch
      intervals of one view into total seconds watched.
    `,
    hints: [
      'Autoplay inflates watch time. What shows intent?',
      'A view has a length and a video has a length.',
      'Overlapping intervals come from seeking back.',
    ],
    answer: `
      **1. Metrics.** Watch time alone can rise because videos got longer or loop. Decide with:

      - **Completion rate**: views watched to 75 percent ÷ views longer than 3 seconds.
      - **Active signals**: shares, follows, comments per 1,000 views.
      - **Return rate**: users who come back the next day.
      - **Counter-metric**: "not interested" taps and session abandonment within 10 seconds.

      If watch time is up, completion is flat and return rate is down, the change bought minutes,
      not value.

      **2. Model.** «fct_video_view»: one row per view, with user, video, start time, seconds
      watched (from merged intervals), video length at view time, max position, autoplay flag and
      surface. «dim_video» with creator and length. «fct_user_daily» for retention.

      **3. SQL.**

      ~~~sql
      SELECT CAST(started_at AS DATE) AS day,
             AVG(CASE WHEN max_position_s >= 0.75 * video_length_s THEN 1.0 ELSE 0 END) AS completion_75
      FROM fct_video_view
      WHERE seconds_watched >= 3
      GROUP BY 1;
      ~~~

      **4. Python.**

      ~~~python
      def seconds_watched(intervals):
          total, end = 0, None
          for start, stop in sorted(intervals):
              if end is None or start > end:
                  total += stop - start
                  end = stop
              elif stop > end:
                  total += stop - end
                  end = stop
          return total
      ~~~

      Say that the result counts each second of the video once, so a rewatch is a separate
      measure if product wants it.
    `,
    signals: [
      'Questions watch time as a goal and explains autoplay inflation',
      'Pairs it with completion, active signals and a counter-metric',
      'Stores video length at view time on the fact',
      'Excludes very short views with a stated threshold',
      'Merges intervals correctly after sorting',
    ],
    followUps: [
      'How would you run the experiment so creators are not double counted across groups?',
      'Videos get longer every month. How do you compare completion over a year?',
    ],
  },
  {
    slug: 'case-marketplace-trust',
    title: 'Case: listings grow, sales do not',
    track: 'playbook',
    kind: 'concept',
    difficulty: 'hard',
    companies: ['meta', 'amazon', 'flipkart'],
    prompt: `
      A peer-to-peer marketplace: sellers list items, buyers message sellers, some deals close
      offline. Listings grew 30 percent this quarter, messages only 5 percent. (1) What do you
      measure? (2) Model it. (3) Write SQL for the share of listings that get a first message within
      24 hours, by category. (4) In Python, flag sellers who post more than 20 listings in an hour.
    `,
    hints: [
      'A deal closes offline. What is the best proxy for success?',
      'Fake and duplicate listings grow listings without value.',
      'The SQL needs the first message per listing.',
      'The Python is a sliding window per seller.',
    ],
    answer: `
      **1. Metrics.** Sales are not logged, so use the steps you can see.

      - **Listing reply rate**: listings with a buyer message within 24 hours ÷ new listings.
      - **Conversation depth**: conversations with a seller reply ÷ conversations.
      - **Marked sold** rate, as a weaker signal.
      - **Trust**: scam reports per 1,000 conversations, and removed listings.

      A jump in listings with flat messages often means spam or duplicates. Slice the growth by
      seller age and listings per seller.

      **2. Model.** «fct_listing» (accumulating snapshot: created, first message, first reply,
      marked sold, removed), «fct_message» (one row per message), «dim_seller», «dim_category».

      **3. SQL.**

      ~~~sql
      SELECT c.category,
             AVG(CASE WHEN l.first_message_at < l.created_at + INTERVAL '24 hours' THEN 1.0 ELSE 0 END)
               AS reply_rate_24h
      FROM fct_listing l
      JOIN dim_category c ON c.category_id = l.category_id
      WHERE l.created_at < CURRENT_DATE - 1
      GROUP BY c.category;
      ~~~

      The filter leaves out listings younger than 24 hours, which cannot have a full window yet.

      **4. Python.**

      ~~~python
      from collections import defaultdict, deque

      def bursty_sellers(listings, limit=20, window_s=3600):
          recent = defaultdict(deque)
          flagged = set()
          for seller_id, ts in sorted(listings, key=lambda x: x[1]):
              q = recent[seller_id]
              q.append(ts)
              while q[0] <= ts - window_s:
                  q.popleft()
              if len(q) > limit:
                  flagged.add(seller_id)
          return flagged
      ~~~
    `,
    signals: [
      'Chooses visible proxies when the outcome is offline',
      'Suspects spam and slices growth by seller',
      'Models the listing as an accumulating snapshot',
      'Excludes listings whose window is not complete',
      'Writes a correct sliding window per seller',
    ],
    followUps: [
      'Sellers delete and repost listings to stay on top. How does that change the metrics?',
      'How would the burst rule run in a stream with late events?',
    ],
  },
  {
    slug: 'case-call-quality',
    title: 'Case: are voice calls getting worse?',
    track: 'playbook',
    kind: 'concept',
    difficulty: 'hard',
    companies: ['meta', 'google', 'microsoft'],
    prompt: `
      A messaging app has voice calls. Users complain about bad calls in one country. (1) Which
      metrics measure call quality? (2) Model the data, given that the client sends a quality
      sample every 5 seconds. (3) Write SQL for the share of calls with a drop or a poor rating, per
      country and network type. (4) In Python, compute the 95th percentile of jitter per call from
      the samples.
    `,
    hints: [
      'Objective signals and user ratings tell different stories.',
      'A call has two sides, and each side sends samples.',
      'Only some calls are rated. Is the rated share biased?',
    ],
    answer: `
      **1. Metrics.**

      - **Bad call rate** (north star): calls that dropped, or had a poor rating, or spent more than
        10 percent of samples above a jitter or packet loss threshold ÷ connected calls.
      - Connect rate: connected ÷ attempted.
      - Median and p95 setup time.
      - Counter-metric: battery and data use per call minute.

      Ratings are sampled and biased towards bad calls, so never use rating alone.

      **2. Model.** «fct_call» (one row per call: caller, callee, start, end, end reason, countries,
      network types, app versions), «fct_call_leg_sample» (one row per side per 5-second sample:
      jitter, loss, round-trip time), «fct_call_quality» (one row per call and side with p50/p95 of
      each measure, built from samples) and «fct_call_rating».

      **3. SQL.**

      ~~~sql
      SELECT c.caller_country, c.caller_network,
             AVG(CASE WHEN c.end_reason = 'dropped' OR r.stars <= 2 THEN 1.0 ELSE 0 END) AS bad_call_rate
      FROM fct_call c
      LEFT JOIN fct_call_rating r ON r.call_id = c.call_id
      WHERE c.connected
      GROUP BY 1, 2;
      ~~~

      **4. Python.**

      ~~~python
      import math
      from collections import defaultdict

      def p95_jitter(samples):
          by_call = defaultdict(list)
          for call_id, jitter_ms in samples:
              by_call[call_id].append(jitter_ms)
          out = {}
          for call_id, values in by_call.items():
              values.sort()
              out[call_id] = values[max(0, math.ceil(0.95 * len(values)) - 1)]
          return out
      ~~~

      Name the percentile method (nearest rank here), because analysts will compare it with a
      warehouse function that interpolates.
    `,
    signals: [
      'Combines objective signals and ratings, and names rating bias',
      'Models calls, legs and samples at separate grains',
      'Slices by network and app version to find the cause',
      'States the percentile method',
      'Adds a counter-metric',
    ],
    followUps: [
      'The bad call rate rose only on one app version. What do you check next?',
      'Samples are 40 billion rows a day. Where do you compute the percentiles?',
    ],
  },
  {
    slug: 'case-stories-creation-drop',
    title: 'Case: fewer people post stories',
    track: 'playbook',
    kind: 'concept',
    difficulty: 'hard',
    companies: ['meta', 'google'],
    prompt: `
      The share of daily users who post a story fell from 12 to 10 percent over a month. Viewing
      is flat. (1) How do you find the cause? (2) Which tables make that fast? (3) Write SQL for the
      creation rate by app version and day. (4) In Python, given each user's daily post counts,
      find users who posted on at least 5 of the last 7 days last month and none this week.
    `,
    hints: [
      'First prove the data is right, then decompose the rate.',
      'A rate can fall because the numerator fell or the denominator grew.',
      'Mix shift: new users post less.',
    ],
    answer: `
      **1. Diagnosis, in order.**

      1. **Data**: did logging change? Compare the client event count with the server count of
         stories created. Check app releases.
      2. **Denominator**: did daily users grow with users who never post (a new market, a
         notification campaign)? Recompute the rate on a fixed cohort.
      3. **Funnel**: camera opened → story composed → posted. Find the step that fell.
      4. **Slices**: app version, platform, country, user age. A drop on one version points at a
         product bug.
      5. **Habit**: are former daily posters posting less? That is the expensive case.

      **2. Model.** «fct_story_funnel_daily» (one row per user and day: camera opens, drafts,
      posts), «dim_user» with signup cohort, and «dim_app_version» with release dates.

      **3. SQL.**

      ~~~sql
      SELECT activity_date, app_version,
             AVG(CASE WHEN posts > 0 THEN 1.0 ELSE 0 END) AS creation_rate,
             COUNT(*) AS daily_users
      FROM fct_story_funnel_daily
      GROUP BY 1, 2;
      ~~~

      Show «daily_users» next to the rate, so a small version with a strange rate is not mistaken
      for the cause.

      **4. Python.**

      ~~~python
      def lapsed_posters(daily_posts, last_month_week, this_week):
          lapsed = []
          for user_id, counts in daily_posts.items():
              active_before = sum(1 for d in last_month_week if counts.get(d, 0) > 0)
              active_now = any(counts.get(d, 0) > 0 for d in this_week)
              if active_before >= 5 and not active_now:
                  lapsed.append(user_id)
          return sorted(lapsed)
      ~~~
    `,
    signals: [
      'Checks logging and releases before product causes',
      'Separates numerator change from denominator and mix shift',
      'Uses a funnel to find the failing step',
      'Shows volume next to rates in slices',
      'Defines lapsed users precisely in the Python',
    ],
    followUps: [
      'The drop is only in users who joined this month. What does that tell you?',
      'How would you size the impact in posts lost per day?',
    ],
  },
  {
    slug: 'case-advertiser-retention',
    title: 'Case: small advertisers stop spending',
    track: 'playbook',
    kind: 'concept',
    difficulty: 'hard',
    companies: ['meta', 'google', 'amazon'],
    prompt: `
      Small advertisers (under 1,000 USD a month) churn faster this year. (1) Define churn and the
      metrics around it. (2) Model the data. (3) Write SQL for monthly churn of small advertisers,
      where churn means spend in a month and none in the next. (4) In Python, bucket advertisers
      into spend bands from their last three months and count moves between bands.
    `,
    hints: [
      'Advertisers pause campaigns. When is a pause churn?',
      'Small advertisers churn for different reasons than large ones: results, billing, policy.',
      'The SQL compares each month with the next: LEAD or a self join.',
    ],
    answer: `
      **1. Metrics.** Churn: an advertiser with spend in month M and none in M+1, excluding
      accounts that paused with a scheduled restart. Around it: return on ad spend reported to the
      advertiser, rejected ads per advertiser, payment failures and time to first result for new
      advertisers.

      **2. Model.** «fct_ad_spend_daily» (advertiser, campaign, day, spend, impressions,
      conversions), «fct_advertiser_month» (one row per advertiser and month with spend, band and
      status), «fct_ad_review» (approvals and rejections), «fct_billing_event», «dim_advertiser»
      (vertical, country, SCD 2 on band).

      **3. SQL.**

      ~~~sql
      WITH monthly AS (
        SELECT advertiser_id, DATE_TRUNC('month', day) AS month, SUM(spend) AS spend
        FROM fct_ad_spend_daily
        GROUP BY 1, 2
      ),
      flagged AS (
        SELECT advertiser_id, month, spend,
               LEAD(month) OVER (PARTITION BY advertiser_id ORDER BY month) AS next_month
        FROM monthly
      )
      SELECT month,
             AVG(CASE WHEN next_month IS DISTINCT FROM month + INTERVAL '1 month' THEN 1.0 ELSE 0 END)
               AS churn_rate
      FROM flagged
      WHERE spend < 1000
        AND month < DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month'
      GROUP BY month;
      ~~~

      The last filter drops the latest full month, whose next month is not over yet.

      **4. Python.**

      ~~~python
      from collections import Counter

      BANDS = [(0, 'tiny'), (100, 'small'), (1000, 'mid'), (10000, 'large')]

      def band(spend):
          name = BANDS[0][1]
          for floor, label in BANDS:
              if spend >= floor:
                  name = label
          return name

      def band_moves(before, after):
          return Counter((band(before.get(a, 0)), band(after.get(a, 0))) for a in before.keys() | after.keys())
      ~~~
    `,
    signals: [
      'Defines churn precisely, including pauses',
      'Names the likely causes for small advertisers and the data for each',
      'Builds an advertiser-month table',
      'Excludes the month whose outcome is not known yet',
      'Counts band moves for advertisers on both sides',
    ],
    followUps: [
      'Churn fell after a policy change, but spend fell too. How do you explain it to the VP?',
      'How would you predict churn a month ahead, and which features leak the label?',
    ],
  },
];
