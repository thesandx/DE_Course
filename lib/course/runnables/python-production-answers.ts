import type { SpecAnswers } from '@/lib/course/runnables/test-answers';

/**
 * Other correct answers and the usual mistakes for the production Python
 * problems, for `python-specs.test.ts`.
 */

/** The reference extractor with one line changed, for the mistakes below. */
const EXTRACTOR = `import random
from datetime import datetime, timedelta

MIN_INTERVAL = 60 / 90
OVERLAP = timedelta(minutes=5)


def get_page(fetch, params, sleep):
    for attempt in range(8):
        try:
            response = fetch(params)
        except (ConnectionError, TimeoutError):
            sleep(random.uniform(0, 2 ** attempt))
            continue
        if response.status_code == 429:
            sleep(float(response.headers.get("Retry-After", "60")))
            continue
        if response.status_code >= 500:
            sleep(random.uniform(0, 2 ** attempt))
            continue
        if response.status_code >= 400:
            raise RuntimeError(f"HTTP {response.status_code}")
        return response.json()
    raise RuntimeError("the API still fails after 8 attempts")


def extract(fetch, store, run_id, now, sleep, clock):
    state = store.load_state()
    if state.get("cursor"):
        params = {"cursor": state["cursor"]}
        page_no = state["page_no"]
        started = state["started"]
    else:
        since = datetime.fromisoformat(state["watermark"]) - OVERLAP
        started = now().isoformat()
        params = {"updated_since": since.isoformat()}
        page_no = 0
    while True:
        began = clock()
        body = get_page(fetch, params, sleep)
        store.write_page(run_id, page_no, body["data"])
        page_no += 1
        cursor = body.get("next_cursor")
        if not cursor:
            store.save_state({"watermark": started, "cursor": None, "page_no": 0, "started": None})
            return
        store.save_state({"watermark": state["watermark"], "cursor": cursor,
                          "page_no": page_no, "started": started})
        params = {"cursor": cursor}
        sleep(max(0.0, MIN_INTERVAL - (clock() - began)))
`;

function changed(from: string, to: string): string {
  if (!EXTRACTOR.includes(from)) throw new Error(`The extractor has no "${from}".`);
  return EXTRACTOR.replace(from, to);
}

export const PYTHON_PRODUCTION_ANSWERS: Record<string, SpecAnswers> = {
  'idempotent-retry-writer': {
    pass: [
      `import random
import time
import uuid


def pay_with_retries(send, payment, attempts=5, sleep=time.sleep):
    request = dict(payment)
    request.setdefault("idempotency_key", str(uuid.uuid4()))
    attempt = 0
    while True:
        attempt += 1
        try:
            return send(request)
        except TimeoutError:
            if attempt >= attempts:
                raise
            sleep(random.random() * min(10.0, 0.25 * 2 ** attempt))
`,
      `import random
import time
import uuid


def pay_with_retries(send, payment, attempts=5, sleep=time.sleep):
    payment = {**payment, "idempotency_key": payment.get("idempotency_key") or uuid.uuid4().hex}
    last_error = None
    for attempt in range(attempts):
        if attempt:
            sleep(min(10, random.uniform(0.1, 0.3) * 2 ** attempt))
        try:
            return send(payment)
        except TimeoutError as error:
            last_error = error
    raise last_error
`,
    ],
    fail: [
      // A new key for every attempt.
      `import random
import time
import uuid


def pay_with_retries(send, payment, attempts=5, sleep=time.sleep):
    for attempt in range(attempts):
        try:
            return send({**payment, "idempotency_key": str(uuid.uuid4())})
        except TimeoutError:
            if attempt == attempts - 1:
                raise
            sleep(random.uniform(0, min(10, 0.5 * 2 ** attempt)))
`,
      // Retries a declined card too.
      `import random
import time
import uuid


def pay_with_retries(send, payment, attempts=5, sleep=time.sleep):
    payment = {**payment, "idempotency_key": payment.get("idempotency_key") or str(uuid.uuid4())}
    for attempt in range(attempts):
        try:
            return send(payment)
        except Exception:
            if attempt == attempts - 1:
                raise
            sleep(random.uniform(0, min(10, 0.5 * 2 ** attempt)))
`,
      // Gives up silently.
      `import random
import time
import uuid


def pay_with_retries(send, payment, attempts=5, sleep=time.sleep):
    payment = {**payment, "idempotency_key": payment.get("idempotency_key") or str(uuid.uuid4())}
    for attempt in range(attempts):
        try:
            return send(payment)
        except TimeoutError:
            if attempt < attempts - 1:
                sleep(random.uniform(0, min(10, 0.5 * 2 ** attempt)))
    return None
`,
      // Replaces the key the payment already has.
      `import random
import time
import uuid


def pay_with_retries(send, payment, attempts=5, sleep=time.sleep):
    payment = {**payment, "idempotency_key": str(uuid.uuid4())}
    for attempt in range(attempts):
        try:
            return send(payment)
        except TimeoutError:
            if attempt == attempts - 1:
                raise
            sleep(random.uniform(0, min(10, 0.5 * 2 ** attempt)))
`,
      // Sleeps after the last attempt too.
      `import random
import time
import uuid


def pay_with_retries(send, payment, attempts=5, sleep=time.sleep):
    payment = {**payment, "idempotency_key": payment.get("idempotency_key") or str(uuid.uuid4())}
    for attempt in range(attempts):
        try:
            return send(payment)
        except TimeoutError:
            sleep(random.uniform(0, min(10, 0.5 * 2 ** attempt)))
    raise TimeoutError("payment still timing out")
`,
      // No jitter: every client retries at the same moments.
      `import time
import uuid


def pay_with_retries(send, payment, attempts=5, sleep=time.sleep):
    payment = {**payment, "idempotency_key": payment.get("idempotency_key") or str(uuid.uuid4())}
    for attempt in range(attempts):
        try:
            return send(payment)
        except TimeoutError:
            if attempt == attempts - 1:
                raise
            sleep(min(10, 0.5 * 2 ** attempt))
`,
      // Waits for real.
      `import random
import time
import uuid


def pay_with_retries(send, payment, attempts=5, sleep=time.sleep):
    payment = {**payment, "idempotency_key": payment.get("idempotency_key") or str(uuid.uuid4())}
    for attempt in range(attempts):
        try:
            return send(payment)
        except TimeoutError:
            if attempt == attempts - 1:
                raise
            time.sleep(random.uniform(0, min(10, 0.5 * 2 ** attempt)))
`,
    ],
  },

  'retry-decorator-with-budget': {
    pass: [
      `import functools
import random
import time


class RetryBudgetExceeded(Exception):
    pass


def retry(*, retry_on, attempts=5, base_s=0.2, cap_s=10.0, budget_s=60.0,
          sleep=time.sleep, clock=time.monotonic):
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            started = clock()
            attempt = 0
            while True:
                attempt += 1
                try:
                    return func(*args, **kwargs)
                except retry_on as error:
                    if attempt >= attempts:
                        raise
                    delay = random.random() * min(cap_s, base_s * 2 ** (attempt - 1))
                    if delay > budget_s - (clock() - started):
                        raise RetryBudgetExceeded(f"{func.__name__} ran out of its {budget_s} s budget") from error
                    sleep(delay)
        return wrapper
    return decorator
`,
      `import functools
import random
import time


class RetryBudgetExceeded(Exception):
    pass


def retry(*, retry_on, attempts=5, base_s=0.2, cap_s=10.0, budget_s=60.0,
          sleep=time.sleep, clock=time.monotonic):
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            deadline = clock() + budget_s
            for attempt in range(1, attempts + 1):
                try:
                    return func(*args, **kwargs)
                except retry_on as error:
                    if attempt == attempts:
                        raise
                    bound = min(cap_s, base_s * 2 ** (attempt - 1))
                    delay = bound / 2 + random.uniform(0, bound / 2)
                    if clock() + delay > deadline:
                        raise RetryBudgetExceeded("budget spent") from error
                    sleep(delay)
        return wrapper
    return decorator
`,
    ],
    fail: [
      // The budget starts when the function is decorated, not when it is called.
      `import functools
import random
import time


class RetryBudgetExceeded(Exception):
    pass


def retry(*, retry_on, attempts=5, base_s=0.2, cap_s=10.0, budget_s=60.0,
          sleep=time.sleep, clock=time.monotonic):
    def decorator(func):
        deadline = clock() + budget_s

        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(1, attempts + 1):
                try:
                    return func(*args, **kwargs)
                except retry_on as error:
                    if attempt == attempts:
                        raise
                    delay = random.uniform(0, min(cap_s, base_s * 2 ** (attempt - 1)))
                    if clock() + delay > deadline:
                        raise RetryBudgetExceeded("budget spent") from error
                    sleep(delay)
        return wrapper
    return decorator
`,
      // Checks the budget after sleeping.
      `import functools
import random
import time


class RetryBudgetExceeded(Exception):
    pass


def retry(*, retry_on, attempts=5, base_s=0.2, cap_s=10.0, budget_s=60.0,
          sleep=time.sleep, clock=time.monotonic):
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            deadline = clock() + budget_s
            for attempt in range(1, attempts + 1):
                try:
                    return func(*args, **kwargs)
                except retry_on as error:
                    if attempt == attempts:
                        raise
                    sleep(random.uniform(0, min(cap_s, base_s * 2 ** (attempt - 1))))
                    if clock() > deadline:
                        raise RetryBudgetExceeded("budget spent") from error
        return wrapper
    return decorator
`,
      // No jitter.
      `import functools
import time


class RetryBudgetExceeded(Exception):
    pass


def retry(*, retry_on, attempts=5, base_s=0.2, cap_s=10.0, budget_s=60.0,
          sleep=time.sleep, clock=time.monotonic):
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            deadline = clock() + budget_s
            for attempt in range(1, attempts + 1):
                try:
                    return func(*args, **kwargs)
                except retry_on as error:
                    if attempt == attempts:
                        raise
                    delay = min(cap_s, base_s * 2 ** (attempt - 1))
                    if clock() + delay > deadline:
                        raise RetryBudgetExceeded("budget spent") from error
                    sleep(delay)
        return wrapper
    return decorator
`,
      // The backoff starts one step too high.
      `import functools
import random
import time


class RetryBudgetExceeded(Exception):
    pass


def retry(*, retry_on, attempts=5, base_s=0.2, cap_s=10.0, budget_s=60.0,
          sleep=time.sleep, clock=time.monotonic):
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            deadline = clock() + budget_s
            for attempt in range(1, attempts + 1):
                try:
                    return func(*args, **kwargs)
                except retry_on as error:
                    if attempt == attempts:
                        raise
                    delay = random.uniform(0, min(cap_s, base_s * 2 ** attempt))
                    if clock() + delay > deadline:
                        raise RetryBudgetExceeded("budget spent") from error
                    sleep(delay)
        return wrapper
    return decorator
`,
      // Retries every exception.
      `import functools
import random
import time


class RetryBudgetExceeded(Exception):
    pass


def retry(*, retry_on, attempts=5, base_s=0.2, cap_s=10.0, budget_s=60.0,
          sleep=time.sleep, clock=time.monotonic):
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            deadline = clock() + budget_s
            for attempt in range(1, attempts + 1):
                try:
                    return func(*args, **kwargs)
                except Exception as error:
                    if attempt == attempts:
                        raise
                    delay = random.uniform(0, min(cap_s, base_s * 2 ** (attempt - 1)))
                    if clock() + delay > deadline:
                        raise RetryBudgetExceeded("budget spent") from error
                    sleep(delay)
        return wrapper
    return decorator
`,
      // Loses the original error.
      `import functools
import random
import time


class RetryBudgetExceeded(Exception):
    pass


def retry(*, retry_on, attempts=5, base_s=0.2, cap_s=10.0, budget_s=60.0,
          sleep=time.sleep, clock=time.monotonic):
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            deadline = clock() + budget_s
            for attempt in range(1, attempts + 1):
                try:
                    return func(*args, **kwargs)
                except retry_on:
                    if attempt == attempts:
                        raise
                    delay = random.uniform(0, min(cap_s, base_s * 2 ** (attempt - 1)))
                    if clock() + delay > deadline:
                        raise RetryBudgetExceeded("budget spent")
                    sleep(delay)
        return wrapper
    return decorator
`,
      // Without functools.wraps.
      `import random
import time


class RetryBudgetExceeded(Exception):
    pass


def retry(*, retry_on, attempts=5, base_s=0.2, cap_s=10.0, budget_s=60.0,
          sleep=time.sleep, clock=time.monotonic):
    def decorator(func):
        def wrapper(*args, **kwargs):
            deadline = clock() + budget_s
            for attempt in range(1, attempts + 1):
                try:
                    return func(*args, **kwargs)
                except retry_on as error:
                    if attempt == attempts:
                        raise
                    delay = random.uniform(0, min(cap_s, base_s * 2 ** (attempt - 1)))
                    if clock() + delay > deadline:
                        raise RetryBudgetExceeded("budget spent") from error
                    sleep(delay)
        return wrapper
    return decorator
`,
      // Hides the last real error behind RetryBudgetExceeded.
      `import functools
import random
import time


class RetryBudgetExceeded(Exception):
    pass


def retry(*, retry_on, attempts=5, base_s=0.2, cap_s=10.0, budget_s=60.0,
          sleep=time.sleep, clock=time.monotonic):
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            deadline = clock() + budget_s
            for attempt in range(1, attempts + 1):
                try:
                    return func(*args, **kwargs)
                except retry_on as error:
                    delay = random.uniform(0, min(cap_s, base_s * 2 ** (attempt - 1)))
                    if attempt == attempts or clock() + delay > deadline:
                        raise RetryBudgetExceeded("giving up") from error
                    sleep(delay)
        return wrapper
    return decorator
`,
    ],
  },

  'test-latest-per-trip': {
    pass: [
      `from dedup import latest_per_trip


def ev(trip, ts, seq, status="s"):
    return {"trip_id": trip, "event_ts": ts, "seq": seq, "status": status}


def test_empty():
    assert latest_per_trip([]) == {}


def test_newer_event_arriving_late_wins():
    assert latest_per_trip([ev("t", 5, 1, "old"), ev("t", 9, 2, "new")])["t"]["status"] == "new"


def test_older_event_arriving_late_loses():
    assert latest_per_trip([ev("t", 9, 1, "new"), ev("t", 5, 2, "old")])["t"]["status"] == "new"


def test_tie_on_time_higher_seq_wins_in_either_order():
    events = [ev("t", 7, 1, "a"), ev("t", 7, 2, "b")]
    assert latest_per_trip(events)["t"]["status"] == "b"
    assert latest_per_trip(events[::-1])["t"]["status"] == "b"


def test_duplicate_delivery():
    event = ev("t", 1, 1)
    assert latest_per_trip([event, dict(event)]) == {"t": event}
`,
      `import pytest


def ev(trip, ts, seq, status):
    return {"trip_id": trip, "event_ts": ts, "seq": seq, "status": status}


CASES = [
    ([], {}),
    ([ev("t1", 10, 1, "a"), ev("t1", 20, 2, "b")], {"t1": "b"}),
    ([ev("t1", 20, 1, "b"), ev("t1", 10, 2, "a")], {"t1": "b"}),
    ([ev("t1", 10, 1, "a"), ev("t1", 10, 2, "b")], {"t1": "b"}),
    ([ev("t1", 10, 2, "b"), ev("t1", 10, 1, "a")], {"t1": "b"}),
    ([ev("t1", 10, 1, "a"), ev("t1", 10, 1, "a")], {"t1": "a"}),
    ([ev("t1", 1, 1, "a"), ev("t2", 1, 1, "b")], {"t1": "a", "t2": "b"}),
]


@pytest.mark.parametrize("events, expected", CASES, ids=[f"case{n}" for n in range(len(CASES))])
def test_latest_status(events, expected):
    result = latest_per_trip(events)
    assert {trip: event["status"] for trip, event in result.items()} == expected
`,
      `import pytest


@pytest.fixture
def make():
    def build(trip, ts, seq, status="x"):
        return {"trip_id": trip, "event_ts": ts, "seq": seq, "status": status}
    return build


class TestLatestPerTrip:
    def test_empty(self):
        assert latest_per_trip([]) == {}

    def test_order_does_not_matter(self, make):
        events = [make("t", ts, seq, f"{ts}-{seq}") for ts in (1, 2, 3) for seq in (1, 2)]
        expected = latest_per_trip(events)
        assert expected["t"]["status"] == "3-2"
        assert latest_per_trip(events[::-1]) == expected

    def test_newer_time_beats_higher_seq(self, make):
        assert latest_per_trip([make("t", 2, 1, "new"), make("t", 1, 9, "old")])["t"]["status"] == "new"

    def test_duplicates(self, make):
        event = make("t", 1, 1)
        assert latest_per_trip([event, event]) == {"t": event}

    def test_missing_seq_is_an_error(self):
        with pytest.raises(KeyError):
            latest_per_trip([{"trip_id": "t", "event_ts": 1}])
`,
    ],
    fail: [
      // Only the happy path.
      `def test_one_event():
    event = {"trip_id": "t1", "event_ts": 1, "seq": 1, "status": "a"}
    assert latest_per_trip([event]) == {"t1": event}
`,
      // Expects the last arrival to win, which the function rightly does not do.
      `def ev(trip, ts, seq, status):
    return {"trip_id": trip, "event_ts": ts, "seq": seq, "status": status}


def test_empty():
    assert latest_per_trip([]) == {}


def test_last_event_wins():
    events = [ev("t1", 20, 1, "completed"), ev("t1", 10, 2, "accepted")]
    assert latest_per_trip(events)["t1"]["status"] == "accepted"
`,
      // No tests at all.
      `import pytest


def ev(trip, ts, seq, status):
    return {"trip_id": trip, "event_ts": ts, "seq": seq, "status": status}
`,
      // The tie test has the higher seq first, so ignoring seq still passes.
      `def ev(trip, ts, seq, status):
    return {"trip_id": trip, "event_ts": ts, "seq": seq, "status": status}


def test_empty():
    assert latest_per_trip([]) == {}


def test_late_newer_event_wins():
    assert latest_per_trip([ev("t", 5, 1, "old"), ev("t", 9, 2, "new")])["t"]["status"] == "new"


def test_late_older_event_loses():
    assert latest_per_trip([ev("t", 9, 1, "new"), ev("t", 5, 2, "old")])["t"]["status"] == "new"


def test_tie_higher_seq_wins():
    assert latest_per_trip([ev("t", 7, 2, "b"), ev("t", 7, 1, "a")])["t"]["status"] == "b"


def test_duplicate_delivery():
    event = ev("t", 1, 1, "a")
    assert latest_per_trip([event, dict(event)]) == {"t": event}
`,
      // Never delivers the same event twice.
      `def ev(trip, ts, seq, status):
    return {"trip_id": trip, "event_ts": ts, "seq": seq, "status": status}


def test_empty():
    assert latest_per_trip([]) == {}


def test_latest_by_time():
    assert latest_per_trip([ev("t", 9, 1, "new"), ev("t", 5, 2, "old")])["t"]["status"] == "new"
    assert latest_per_trip([ev("t", 5, 1, "old"), ev("t", 9, 2, "new")])["t"]["status"] == "new"


def test_ties_by_seq():
    for events in ([ev("t", 7, 1, "a"), ev("t", 7, 2, "b")], [ev("t", 7, 2, "b"), ev("t", 7, 1, "a")]):
        assert latest_per_trip(events)["t"]["status"] == "b"
`,
    ],
  },

  'python-paginated-api-extractor': {
    pass: [
      `import random
from datetime import datetime, timedelta

PACE_S = 0.7


def extract(fetch, store, run_id, now, sleep, clock):
    state = store.load_state()
    resume = state.get("next_cursor")
    if resume:
        params, page, run_started = {"cursor": resume}, state["page"], state["run_started"]
    else:
        run_started = now().isoformat()
        since = datetime.fromisoformat(state["watermark"]) - timedelta(minutes=5)
        params, page = {"updated_since": since.isoformat()}, 0
    last_request = None
    while True:
        body = None
        for attempt in range(6):
            if last_request is not None:
                wait = PACE_S - (clock() - last_request)
                if wait > 0:
                    sleep(wait)
            last_request = clock()
            try:
                response = fetch(params)
            except (ConnectionError, TimeoutError):
                sleep(random.uniform(0, 1.5 ** attempt))
                continue
            if response.status_code == 429:
                sleep(float(response.headers["Retry-After"]))
                continue
            if 500 <= response.status_code < 600:
                sleep(random.uniform(0, 1.5 ** attempt))
                continue
            response.raise_for_status()
            body = response.json()
            break
        if body is None:
            raise RuntimeError("the charges API kept failing")
        store.write_page(run_id, page, body["data"])
        page += 1
        if body["next_cursor"] is None:
            store.save_state({"watermark": run_started})
            return
        params = {"cursor": body["next_cursor"]}
        store.save_state({"watermark": state["watermark"], "next_cursor": body["next_cursor"],
                          "page": page, "run_started": run_started})
`,
      `import random
from datetime import datetime, timedelta


def _get(fetch, params, sleep):
    delay = 0.5
    for _ in range(5):
        try:
            response = fetch(params)
        except (ConnectionError, TimeoutError):
            response = None
        if response is not None and response.status_code == 429:
            sleep(int(response.headers.get("Retry-After", 60)))
            continue
        if response is None or response.status_code >= 500:
            sleep(random.uniform(0, delay))
            delay *= 2
            continue
        if response.status_code != 200:
            raise RuntimeError("HTTP %d" % response.status_code)
        return response.json()
    raise RuntimeError("gave up after 5 attempts")


def extract(fetch, store, run_id, now, sleep, clock):
    state = store.load_state()
    if state.get("cursor"):
        params = {"cursor": state["cursor"]}
    else:
        since = datetime.fromisoformat(state["watermark"]) - timedelta(minutes=5)
        state = {"watermark": state["watermark"], "started": now().strftime("%Y-%m-%dT%H:%M:%SZ"), "page": 0}
        params = {"updated_since": since.isoformat()}
    while True:
        body = _get(fetch, params, sleep)
        store.write_page(run_id, state["page"], body["data"])
        if not body["next_cursor"]:
            store.save_state({"watermark": state["started"]})
            return
        state = {**state, "cursor": body["next_cursor"], "page": state["page"] + 1}
        store.save_state(state)
        params = {"cursor": body["next_cursor"]}
        sleep(0.65)
`,
    ],
    fail: [
      // Saves the cursor before the page lands.
      changed(
        `        store.write_page(run_id, page_no, body["data"])
        page_no += 1
        cursor = body.get("next_cursor")
        if not cursor:`,
        `        cursor = body.get("next_cursor")
        if cursor:
            store.save_state({"watermark": state["watermark"], "cursor": cursor,
                              "page_no": page_no + 1, "started": started})
        store.write_page(run_id, page_no, body["data"])
        page_no += 1
        if not cursor:`,
      ),
      // The watermark is the time the run ended.
      changed(
        `store.save_state({"watermark": started, "cursor": None, "page_no": 0, "started": None})`,
        `store.save_state({"watermark": now().isoformat(), "cursor": None, "page_no": 0, "started": None})`,
      ),
      // No overlap.
      changed(
        'since = datetime.fromisoformat(state["watermark"]) - OVERLAP',
        'since = datetime.fromisoformat(state["watermark"])',
      ),
      // No pacing: it waits for the 429s.
      changed('sleep(max(0.0, MIN_INTERVAL - (clock() - began)))', 'pass'),
      // Ignores Retry-After.
      changed('sleep(float(response.headers.get("Retry-After", "60")))', 'sleep(1)'),
      // Retries a 401.
      changed(
        `        if response.status_code >= 500:
            sleep(random.uniform(0, 2 ** attempt))
            continue
        if response.status_code >= 400:
            raise RuntimeError(f"HTTP {response.status_code}")`,
        `        if response.status_code >= 400:
            sleep(random.uniform(0, 2 ** attempt))
            continue`,
      ),
      // Starts over after a crash.
      changed('if state.get("cursor"):', 'if False:'),
      // A resumed run takes its own start time as the watermark.
      changed('started = state["started"]', 'started = now().isoformat()'),
      // Retries a dead API forever.
      changed('for attempt in range(8):', 'for attempt in iter(int, 1):'),
      // Waits for real.
      changed('import random\n', 'import random\nimport time\n').replace(
        'sleep(max(0.0, MIN_INTERVAL - (clock() - began)))',
        'time.sleep(max(0.0, MIN_INTERVAL - (clock() - began)))',
      ),
    ],
  },
};
