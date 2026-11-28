import type { RunnableSpec } from '@/types/runner';

/**
 * Runnable specs for production Python: retries with idempotency keys, a
 * retry decorator with a time budget, a test suite graded by mutation
 * testing, and a resumable extractor for a rate-limited API.
 *
 * These problems are about behaviour over time, so each test is a scenario
 * on a fake clock: the code gets `sleep` and `clock` functions that move fake
 * time at once, and a call to the real `time.sleep` fails the test. Each
 * scenario returns `verdict(...)` with a sentence that names the behaviour
 * that broke.
 */
export const PYTHON_PRODUCTION_RUNNABLES: Record<string, RunnableSpec> = {
  'idempotent-retry-writer': {
    language: 'python',
    task: `Write «pay_with_retries(send, payment, attempts=5, sleep=time.sleep)». Call «send» with the payment plus an «"idempotency_key"»: keep the payment's own key when it has one, otherwise make one key, such as a UUID string, before the first attempt. Send the same key on every attempt. Retry only after a «TimeoutError», with at most «attempts» calls in all. Between two attempts call «sleep(seconds)» with a backoff with jitter of at most 10 seconds; never call «time.sleep» yourself. Any other error goes to the caller at once. After the last timeout, raise that «TimeoutError». Return what «send» returns.`,
    setup: `import time


class FakePaymentsApi:
    """Answers like the payments API. Each outcome in the script is used once, in order:
    "ok"; "timeout", where the request is lost; "charged_then_timeout", where the
    charge goes through and the reply is lost; or an exception, which is raised.
    The API remembers each idempotency key, so a repeated key never charges twice."""

    def __init__(self, *script):
        self.script = list(script)
        self.calls = []
        self.charges = {}

    def __call__(self, payment):
        self.calls.append(dict(payment))
        outcome = self.script.pop(0) if self.script else "ok"
        if isinstance(outcome, BaseException):
            raise outcome
        if outcome == "timeout":
            raise TimeoutError("the request timed out")
        key = payment.get("idempotency_key") or "no-key-%d" % len(self.calls)
        if key not in self.charges:
            self.charges[key] = {"charge_id": "ch_%d" % (len(self.charges) + 1), "amount": payment["amount"]}
        if outcome == "charged_then_timeout":
            raise TimeoutError("the reply timed out")
        return self.charges[key]


payment = {"order_id": "o-881", "amount": 499}
api = FakePaymentsApi("charged_then_timeout", "ok")`,
    helpers: `import time as _time_module


class _RealSleep(BaseException):
    pass


def _pay(fn, api, payment, **settings):
    slept = []

    def sleep(seconds):
        slept.append(seconds)

    def refuse(seconds):
        raise _RealSleep()

    real_sleep = _time_module.sleep
    _time_module.sleep = refuse
    try:
        try:
            return fn(api, dict(payment), sleep=sleep, **settings), None, slept
        except _RealSleep:
            raise
        except Exception as caught:
            return None, caught, slept
    finally:
        _time_module.sleep = real_sleep


def _keys_problem(api):
    keys = [call.get("idempotency_key") for call in api.calls]
    if not keys:
        return "send was never called."
    for number, key in enumerate(keys, 1):
        if not key:
            return "Attempt %d sent no idempotency_key. Add the key to the payment you send." % number
    if len(set(keys)) > 1:
        return "The attempts sent %d different keys (%s). Make one key before the first attempt and send it every time, or the API cannot tell a retry from a new payment." % (len(set(keys)), ", ".join(repr(key) for key in keys[:3]))
    return None


def _scenario(fn, script, payment, **settings):
    """Runs one scenario. Returns (result, error, slept, api), or a Verdict when a rule broke."""
    api = FakePaymentsApi(*script)
    try:
        result, error, slept = _pay(fn, api, payment, **settings)
    except _RealSleep:
        return verdict(False, "Your code called time.sleep. Call the sleep function you are given, so a test never waits.")
    if isinstance(error, TypeError) and "sleep" in str(error):
        return verdict(False, "pay_with_retries must take a sleep argument: pay_with_retries(send, payment, attempts=5, sleep=time.sleep).")
    problem = _keys_problem(api)
    if problem:
        return verdict(False, problem)
    return result, error, slept, api


def check_lost_reply(fn):
    outcome = _scenario(fn, ["charged_then_timeout", "ok"], {"order_id": "o-881", "amount": 499})
    if isinstance(outcome, Verdict):
        return outcome
    result, error, slept, api = outcome
    if error is not None:
        return verdict(False, "The first attempt timed out and the second one worked, so return its result. Your code raised %r." % error)
    if len(api.charges) != 1:
        return verdict(False, "The customer was charged %d times." % len(api.charges))
    if result != next(iter(api.charges.values())):
        return verdict(False, "Return what send returns. Your code returned %r." % (result,))
    if len(slept) != 1:
        return verdict(False, "Two attempts need one sleep between them. Your code slept %d times." % len(slept))
    return verdict(True)


def check_first_try(fn):
    outcome = _scenario(fn, ["ok"], {"order_id": "o-1", "amount": 100})
    if isinstance(outcome, Verdict):
        return outcome
    result, error, slept, api = outcome
    if error is not None:
        return verdict(False, "send worked at once, so return its result. Your code raised %r." % error)
    if len(api.calls) != 1 or slept:
        return verdict(False, "send worked on the first attempt, so call it once and do not sleep. Your code called it %d times and slept %d times." % (len(api.calls), len(slept)))
    if result != next(iter(api.charges.values())):
        return verdict(False, "Return what send returns. Your code returned %r." % (result,))
    return verdict(True)


def check_own_key(fn):
    outcome = _scenario(fn, ["timeout", "ok"], {"order_id": "o-2", "amount": 5, "idempotency_key": "order-o-2"})
    if isinstance(outcome, Verdict):
        return outcome
    result, error, slept, api = outcome
    keys = [call["idempotency_key"] for call in api.calls]
    if any(key != "order-o-2" for key in keys):
        return verdict(False, "The payment already has the key 'order-o-2', saved with the order. Send that key, so a restart after a crash reuses it. Your code sent %r." % keys[0])
    if error is not None:
        return verdict(False, "The second attempt worked, so return its result. Your code raised %r." % error)
    return verdict(True)


def check_gives_up(fn):
    outcome = _scenario(fn, ["timeout", "timeout", "timeout"], {"order_id": "o-3", "amount": 7}, attempts=3)
    if isinstance(outcome, Verdict):
        return outcome
    result, error, slept, api = outcome
    if len(api.calls) != 3:
        return verdict(False, "With attempts=3, call send 3 times in all. Your code called it %d times." % len(api.calls))
    if error is None:
        return verdict(False, "Every attempt timed out, so raise the last TimeoutError. Your code returned %r." % (result,))
    if not isinstance(error, TimeoutError):
        return verdict(False, "After the last attempt, raise the TimeoutError itself, not %s." % type(error).__name__)
    if len(slept) != 2:
        return verdict(False, "Sleep only between attempts: 3 attempts need 2 sleeps, and your code slept %d times." % len(slept))
    return verdict(True)


def check_default_attempts(fn):
    outcome = _scenario(fn, ["timeout"] * 10, {"order_id": "o-4", "amount": 9})
    if isinstance(outcome, Verdict):
        return outcome
    result, error, slept, api = outcome
    if len(api.calls) != 5 or not isinstance(error, TimeoutError):
        return verdict(False, "By default, make 5 attempts and then raise the TimeoutError. Your code made %d attempts." % len(api.calls))
    return verdict(True)


def check_other_errors(fn):
    declined = ValueError("card declined")
    outcome = _scenario(fn, [declined, "ok"], {"order_id": "o-5", "amount": 20})
    if isinstance(outcome, Verdict):
        return outcome
    result, error, slept, api = outcome
    if len(api.calls) != 1 or slept:
        return verdict(False, "A declined card will not succeed on a retry. Retry only TimeoutError; your code called send %d times." % len(api.calls))
    if error is not declined:
        return verdict(False, "Let the ValueError reach the caller as it is. Your code gave %r." % (error if error is not None else result,))
    return verdict(True)


def check_backoff(fn):
    runs = []
    for _ in range(20):
        outcome = _scenario(fn, ["timeout"] * 4 + ["ok"], {"order_id": "o-6", "amount": 30})
        if isinstance(outcome, Verdict):
            return outcome
        result, error, slept, api = outcome
        if len(slept) != 4:
            return verdict(False, "Five attempts need four sleeps between them. Your code slept %d times." % len(slept))
        for seconds in slept:
            if not isinstance(seconds, (int, float)) or seconds < 0 or seconds > 10:
                return verdict(False, "Each sleep must be between 0 and 10 seconds. Your code slept %r." % (seconds,))
        runs.append(tuple(slept))
    if all(sum(run) == 0 for run in runs):
        return verdict(False, "Your code never waits between attempts. Back off, so a struggling API gets time to recover.")
    if len(set(runs)) == 1:
        return verdict(False, "Every client would retry at the same moments: %r. Add random jitter to each delay." % (runs[0],))
    return verdict(True)`,
    starter: `import random
import time
import uuid


def pay_with_retries(send, payment, attempts=5, sleep=time.sleep):
    # Retry on TimeoutError, with one idempotency key for every attempt.
    ...


print(pay_with_retries(api, payment, sleep=lambda seconds: None))
print(len(api.charges), "charge(s) made")
`,
    solution: `import random
import time
import uuid


def pay_with_retries(send, payment, attempts=5, sleep=time.sleep):
    key = payment.get("idempotency_key") or str(uuid.uuid4())
    payment = {**payment, "idempotency_key": key}
    for attempt in range(attempts):
        try:
            return send(payment)
        except TimeoutError:
            if attempt == attempts - 1:
                raise
            sleep(random.uniform(0, min(10, 0.5 * 2 ** attempt)))
`,
    cases: [
      {
        name: 'A lost reply is retried with the same key',
        note: 'The charge went through but the reply was lost. The retry must not charge again.',
        check: 'check_lost_reply(pay_with_retries)',
      },
      {
        name: 'Success on the first try',
        check: 'check_first_try(pay_with_retries)',
      },
      {
        name: 'Keeps the key the payment already has',
        check: 'check_own_key(pay_with_retries)',
      },
      {
        name: 'Gives up after the last attempt',
        hidden: true,
        check: 'check_gives_up(pay_with_retries)',
      },
      {
        name: 'Five attempts by default',
        hidden: true,
        check: 'check_default_attempts(pay_with_retries)',
      },
      {
        name: 'Does not retry a declined card',
        hidden: true,
        check: 'check_other_errors(pay_with_retries)',
      },
      {
        name: 'Waits with jitter, at most 10 seconds',
        hidden: true,
        check: 'check_backoff(pay_with_retries)',
      },
    ],
  },

  'retry-decorator-with-budget': {
    language: 'python',
    // The written answer tests the decorator with pytest, and learners do the same.
    modules: ['pytest'],
    task: `Write the decorator factory «retry(*, retry_on, attempts=5, base_s=0.2, cap_s=10.0, budget_s=60.0, sleep=time.sleep, clock=time.monotonic)» and the exception «RetryBudgetExceeded». The wrapped function returns the first successful result. It retries only the exception types in «retry_on»; others reach the caller at once. It calls the function at most «attempts» times, and after the last failure re-raises that error. Before retry «k» (1, 2, ...) it waits a random delay between 0 and «min(cap_s, base_s * 2 ** (k - 1))» with «sleep». The budget starts at each call: when a wait would end more than «budget_s» seconds after the call started, by «clock()», raise «RetryBudgetExceeded» instead, with the last error as its cause («raise ... from error»). Keep the function's name and docstring, and pass every argument through.`,
    setup: `class FakeClock:
    """A clock for tests. sleep moves it forward at once."""

    def __init__(self):
        self.now = 0.0

    def __call__(self):
        return self.now

    def sleep(self, seconds):
        self.now += seconds`,
    helpers: `import time as _time_module


class _RealSleep(BaseException):
    pass


class _Service:
    """A flaky call: raises the given errors in order, then returns "ok". Each call takes takes_s."""

    def __init__(self, clock, errors, takes_s=0.0):
        self.__name__ = self.__qualname__ = "fetch_rates"
        self.clock = clock
        self.errors = list(errors)
        self.takes_s = takes_s
        self.calls = 0

    def __call__(self, *args, **kwargs):
        self.calls += 1
        self.clock.now += self.takes_s
        if self.errors:
            raise self.errors.pop(0)
        return ("ok", args, kwargs)


class _Sleeper:
    def __init__(self, clock):
        self.clock = clock
        self.delays = []
        self.ends = []

    def __call__(self, seconds):
        self.delays.append(seconds)
        self.clock.now += seconds
        self.ends.append(self.clock.now)


def _call(wrapped, *args, **kwargs):
    def refuse(seconds):
        raise _RealSleep()

    real_sleep = _time_module.sleep
    _time_module.sleep = refuse
    try:
        try:
            return wrapped(*args, **kwargs), None
        except _RealSleep:
            raise
        except Exception as caught:
            return None, caught
    finally:
        _time_module.sleep = real_sleep


def _scenario(retry, errors, takes_s=0.0, args=(), kwargs=None, **settings):
    clock = FakeClock()
    sleeper = _Sleeper(clock)
    service = _Service(clock, errors, takes_s)
    wrapped = retry(sleep=sleeper, clock=clock, **settings)(service)
    if not callable(wrapped):
        raise TypeError("retry(...) must return a decorator, and the decorator a function. It returned %r." % (wrapped,))
    result, error = _call(wrapped, *args, **(kwargs or {}))
    return result, error, service, sleeper, clock


def _guard(check):
    def run(*args):
        try:
            return check(*args)
        except _RealSleep:
            return verdict(False, "Your code called time.sleep. Call the sleep function you are given, so a test never waits.")
    return run


@_guard
def check_success(retry):
    result, error, service, sleeper, clock = _scenario(retry, [ConnectionError("reset"), ConnectionError("reset")], retry_on=(ConnectionError,))
    if error is not None:
        return verdict(False, "The third call works, so return its result. The wrapper raised %r." % error)
    if result != ("ok", (), {}):
        return verdict(False, "Return what the function returns. The wrapper returned %r." % (result,))
    if service.calls != 3 or len(sleeper.delays) != 2:
        return verdict(False, "Two failures and a success: 3 calls with 2 sleeps between them. Your code made %d calls and %d sleeps." % (service.calls, len(sleeper.delays)))
    return verdict(True)


@_guard
def check_other_errors(retry):
    bad = ValueError("bad trip id")
    result, error, service, sleeper, clock = _scenario(retry, [bad], retry_on=(ConnectionError,))
    if service.calls != 1 or sleeper.delays:
        return verdict(False, "ValueError is not in retry_on, so do not retry it. Your code called the function %d times." % service.calls)
    if error is not bad:
        return verdict(False, "Let the ValueError reach the caller as it is. The wrapper gave %r." % (error if error is not None else result,))
    return verdict(True)


@_guard
def check_last_error(retry):
    errors = [ConnectionError("reset %d" % n) for n in (1, 2, 3)]
    result, error, service, sleeper, clock = _scenario(retry, list(errors), retry_on=(ConnectionError,), attempts=3)
    if service.calls != 3:
        return verdict(False, "With attempts=3, call the function 3 times in all. Your code called it %d times." % service.calls)
    if error is not errors[2]:
        return verdict(False, "After the last attempt, re-raise the error of that attempt, ConnectionError('reset 3'), so the caller sees the real failure. The wrapper gave %r." % (error if error is not None else result,))
    if len(sleeper.delays) != 2:
        return verdict(False, "Sleep only between attempts: 3 attempts need 2 sleeps, and your code slept %d times." % len(sleeper.delays))
    return verdict(True)


def _budget_problem(error, errors, sleeper, deadline, exceeded):
    for end in sleeper.ends:
        if end > deadline + 1e-9:
            return "A sleep ended at %.2f s, after the budget ran out at %.2f s. Check the budget before you sleep." % (end, deadline)
    if not isinstance(error, exceeded):
        return "The budget ran out, so raise RetryBudgetExceeded. The wrapper gave %r." % (error,)
    if error.__cause__ is None or error.__cause__ not in errors:
        return "Raise RetryBudgetExceeded from the last error (raise ... from error), so the real failure stays in the traceback."
    return None


@_guard
def check_budget_slow_calls(retry, exceeded):
    errors = [ConnectionError("reset %d" % n) for n in range(10)]
    result, error, service, sleeper, clock = _scenario(retry, list(errors), takes_s=2.0, retry_on=(ConnectionError,), attempts=10, base_s=0.001, cap_s=0.001, budget_s=5.0)
    problem = _budget_problem(error, errors, sleeper, 5.0, exceeded)
    if problem:
        return verdict(False, problem)
    if service.calls != 3 or error.__cause__ is not errors[2]:
        return verdict(False, "Each call takes 2 s and the budget is 5 s, so the third failure ends at 6 s and is the last one. Your code made %d calls." % service.calls)
    return verdict(True)


@_guard
def check_budget_jitter(retry, exceeded):
    for _ in range(30):
        errors = [ConnectionError("reset %d" % n) for n in range(50)]
        result, error, service, sleeper, clock = _scenario(retry, list(errors), retry_on=(ConnectionError,), attempts=50, base_s=4.0, cap_s=4.0, budget_s=10.0)
        problem = _budget_problem(error, errors, sleeper, 10.0, exceeded)
        if problem:
            return verdict(False, problem)
    return verdict(True)


@_guard
def check_backoff(retry):
    runs = []
    for _ in range(200):
        errors = [ConnectionError("reset")] * 7
        result, error, service, sleeper, clock = _scenario(retry, errors, retry_on=(ConnectionError,), attempts=8, base_s=0.5, cap_s=3.0, budget_s=10_000.0)
        if len(sleeper.delays) != 7:
            return verdict(False, "Eight attempts need seven sleeps between them. Your code slept %d times." % len(sleeper.delays))
        for k, delay in enumerate(sleeper.delays, 1):
            bound = min(3.0, 0.5 * 2 ** (k - 1))
            if not 0 <= delay <= bound + 1e-9:
                return verdict(False, "Retry %d waited %.3f s. Its delay must be between 0 and min(cap_s, base_s * 2 ** (k - 1)) = %.3f s." % (k, delay, bound))
        runs.append(sleeper.delays)
    if len({run[0] for run in runs}) == 1:
        return verdict(False, "The first delay is always %.3f s. Pick a random delay, so a fleet of workers does not retry in step." % runs[0][0])
    if max(run[-1] for run in runs) <= 1.5:
        return verdict(False, "The delays do not grow. Retry 7 may wait up to min(3.0, 0.5 * 2 ** 6) = 3.0 s.")
    return verdict(True)


@_guard
def check_budget_per_call(retry):
    clock = FakeClock()
    sleeper = _Sleeper(clock)
    service = _Service(clock, [])
    wrapped = retry(retry_on=(ConnectionError,), budget_s=5.0, sleep=sleeper, clock=clock)(service)
    for start in (100.0, 200.0):
        clock.now = start
        service.errors = [ConnectionError("reset")]
        result, error = _call(wrapped)
        if error is not None:
            return verdict(False, "The wrapper was made at 0 s and called at %d s. The 5 s budget starts at each call, so one retry fits. The wrapper raised %r." % (start, error))
    return verdict(True)


@_guard
def check_wraps(retry):
    def fetch_rates(currency):
        """Fetch exchange rates for a currency."""
        return currency

    wrapped = retry(retry_on=(ConnectionError,))(fetch_rates)
    if getattr(wrapped, "__name__", None) != "fetch_rates" or getattr(wrapped, "__doc__", None) != fetch_rates.__doc__:
        return verdict(False, "The wrapped function is named %r. Use functools.wraps, so logs and tracebacks show fetch_rates." % getattr(wrapped, "__name__", None))
    return verdict(True)


@_guard
def check_arguments(retry):
    result, error, service, sleeper, clock = _scenario(retry, [], args=(1, "INR"), kwargs={"fresh": True}, retry_on=(ConnectionError,))
    if error is not None or result != ("ok", (1, "INR"), {"fresh": True}):
        return verdict(False, "Pass every positional and keyword argument through to the function. The call returned %r." % (result if error is None else error,))
    return verdict(True)`,
    starter: `import functools
import random
import time


class RetryBudgetExceeded(Exception):
    pass


def retry(*, retry_on, attempts=5, base_s=0.2, cap_s=10.0, budget_s=60.0,
          sleep=time.sleep, clock=time.monotonic):
    def decorator(func):
        ...
    return decorator


# Try it on a fake clock: nothing really sleeps.
clock = FakeClock()
calls = {"n": 0}


@retry(retry_on=(ConnectionError,), sleep=clock.sleep, clock=clock)
def flaky():
    calls["n"] += 1
    if calls["n"] < 3:
        raise ConnectionError("reset")
    return "ok"


print(flaky(), "after", calls["n"], "calls and", round(clock.now, 2), "s of waiting")
`,
    solution: `import functools
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
                    delay = random.uniform(0, min(cap_s, base_s * 2 ** (attempt - 1)))
                    if clock() + delay > deadline:
                        raise RetryBudgetExceeded(f"{func.__name__}: budget of {budget_s}s spent") from error
                    sleep(delay)
        return wrapper
    return decorator
`,
    cases: [
      {
        name: 'Succeeds after two failures',
        check: 'check_success(retry)',
      },
      {
        name: 'Does not retry other errors',
        check: 'check_other_errors(retry)',
      },
      {
        name: 'Re-raises the last error',
        check: 'check_last_error(retry)',
      },
      {
        name: 'Stops when the budget is spent',
        hidden: true,
        note: 'Each call takes 2 s of a 5 s budget.',
        check: 'check_budget_slow_calls(retry, RetryBudgetExceeded)',
      },
      {
        name: 'Never sleeps past the budget',
        hidden: true,
        note: 'Random delays of up to 4 s inside a 10 s budget, 30 times.',
        check: 'check_budget_jitter(retry, RetryBudgetExceeded)',
      },
      {
        name: 'Capped exponential backoff with jitter',
        hidden: true,
        note: '200 runs of 8 attempts, each delay checked against its bound.',
        check: 'check_backoff(retry)',
      },
      {
        name: 'The budget starts at each call',
        hidden: true,
        check: 'check_budget_per_call(retry)',
      },
      {
        name: 'Keeps the name of the function',
        hidden: true,
        check: 'check_wraps(retry)',
      },
      {
        name: 'Passes the arguments through',
        hidden: true,
        check: 'check_arguments(retry)',
      },
    ],
  },

  'test-latest-per-trip': {
    language: 'python',
    modules: ['pytest'],
    task: `Write pytest tests for «latest_per_trip(events)», which is already defined. A test is a function whose name starts with «test». Every test must pass on the function as it is. Each hidden test then swaps in a copy of the function with one bug, and at least one of your tests must fail on it. «pytest.raises», «pytest.approx», «pytest.mark.parametrize», fixtures and «monkeypatch» work. «pytest.main()» prints a report.`,
    setup: `def latest_per_trip(events):
    latest = {}
    for event in events:
        key = event["trip_id"]
        rank = (event["event_ts"], event["seq"])
        current = latest.get(key)
        if current is None or rank > (current["event_ts"], current["seq"]):
            latest[key] = event
    return latest`,
    helpers: `import sys as _sys
import types as _types

import pytest as _pytest

_dedup = _types.ModuleType("dedup")
_dedup.latest_per_trip = latest_per_trip
_sys.modules["dedup"] = _dedup
_CORRECT = latest_per_trip


def _first_seen(events):
    latest = {}
    for event in events:
        latest.setdefault(event["trip_id"], event)
    return latest


def _last_arrival(events):
    latest = {}
    for event in events:
        latest[event["trip_id"]] = event
    return latest


def _event_ts_only(events):
    latest = {}
    for event in events:
        current = latest.get(event["trip_id"])
        if current is None or event["event_ts"] > current["event_ts"]:
            latest[event["trip_id"]] = event
    return latest


def _seq_only(events):
    latest = {}
    for event in events:
        current = latest.get(event["trip_id"])
        if current is None or event["seq"] > current["seq"]:
            latest[event["trip_id"]] = event
    return latest


def _ties_reversed(events):
    latest = {}
    for event in events:
        rank = (event["event_ts"], -event["seq"])
        current = latest.get(event["trip_id"])
        if current is None or rank > (current["event_ts"], -current["seq"]):
            latest[event["trip_id"]] = event
    return latest


def _empty_is_none(events):
    if not events:
        return None
    return _CORRECT(events)


def _rejects_duplicates(events):
    seen = set()
    for event in events:
        marker = (event["trip_id"], event["event_ts"], event["seq"])
        if marker in seen:
            raise ValueError("duplicate event %r" % (marker,))
        seen.add(marker)
    return _CORRECT(events)


_BUGS = {
    "first_seen": (_first_seen, "keeps the first event it sees for each trip and never replaces it", "a newer event that arrives after an older one"),
    "last_arrival": (_last_arrival, "keeps the last event to arrive, whatever its time", "an older event that arrives after a newer one"),
    "event_ts_only": (_event_ts_only, "compares event_ts only, so a tie keeps whichever event came first", "two events with the same event_ts, where the one with the higher seq arrives second"),
    "seq_only": (_seq_only, "compares seq only and ignores event_ts", "an event with a newer event_ts but a lower seq"),
    "ties_reversed": (_ties_reversed, "keeps the lower seq when event_ts ties", "two events with the same event_ts, checking that the higher seq wins"),
    "empty_is_none": (_empty_is_none, "returns None for an empty list", "the empty input"),
    "rejects_duplicates": (_rejects_duplicates, "raises an error when the same event is delivered twice", "an exact duplicate delivery"),
}


def _run_with(namespace, implementation):
    saved = namespace.get("latest_per_trip")
    namespace["latest_per_trip"] = implementation
    _dedup.latest_per_trip = implementation
    try:
        return _pytest.run_tests(namespace)
    finally:
        namespace["latest_per_trip"] = saved
        _dedup.latest_per_trip = _CORRECT


def check_suite(namespace):
    outcomes = _run_with(namespace, _CORRECT)
    if not outcomes:
        return verdict(False, "No tests found. Write functions whose names start with test, such as def test_empty_input().")
    failed = [outcome for outcome in outcomes if outcome.outcome == "failed"]
    if failed:
        first = failed[0]
        return verdict(False, "%d of %d tests fail on the correct function, so they test the wrong thing. %s: %s" % (len(failed), len(outcomes), first.name, first.message))
    return verdict(True)


def check_catches(namespace, bug):
    implementation, behaviour, hint = _BUGS[bug]
    good = {outcome.name for outcome in _run_with(namespace, _CORRECT) if outcome.outcome == "passed"}
    if not good:
        return verdict(False, "None of your tests pass on the correct function yet, so none can catch a bug.")
    caught = [outcome.name for outcome in _run_with(namespace, implementation) if outcome.name in good and outcome.outcome == "failed"]
    if caught:
        return verdict(True)
    return verdict(False, "A version that %s passes all your tests. Add a test with %s." % (behaviour, hint))`,
    starter: `import pytest


def ev(trip, ts, seq, status):
    return {"trip_id": trip, "event_ts": ts, "seq": seq, "status": status}


def test_empty_input():
    assert latest_per_trip([]) == {}


# Add tests for events that arrive out of order, timestamp ties
# and an event that is delivered twice.


pytest.main()
`,
    solution: `import random

import pytest


def ev(trip, ts, seq, status):
    return {"trip_id": trip, "event_ts": ts, "seq": seq, "status": status}


def test_empty_input():
    assert latest_per_trip([]) == {}


def test_keeps_latest_by_event_time_not_arrival_order():
    events = [ev("t1", 20, 1, "completed"), ev("t1", 10, 2, "accepted")]
    assert latest_per_trip(events)["t1"]["status"] == "completed"


def test_breaks_timestamp_ties_with_sequence():
    events = [ev("t1", 10, 2, "completed"), ev("t1", 10, 1, "accepted")]
    assert latest_per_trip(events)["t1"]["status"] == "completed"


def test_exact_duplicates_are_harmless():
    event = ev("t1", 10, 1, "accepted")
    assert latest_per_trip([event, dict(event)]) == {"t1": event}


@pytest.mark.parametrize("seed", range(20))
def test_result_does_not_depend_on_order(seed):
    events = [ev(f"t{i % 3}", i % 5, i, f"s{i}") for i in range(30)]
    shuffled = events[:]
    random.Random(seed).shuffle(shuffled)
    assert latest_per_trip(shuffled) == latest_per_trip(events)


def test_rerun_on_own_output_is_stable():
    events = [ev("t1", 10, 1, "a"), ev("t2", 5, 1, "b"), ev("t1", 12, 3, "c")]
    once = latest_per_trip(events)
    assert latest_per_trip(list(once.values())) == once
`,
    cases: [
      {
        name: 'Your tests pass on the correct function',
        check: 'check_suite(globals())',
      },
      {
        name: 'Catches a version that keeps the first event',
        check: 'check_catches(globals(), "first_seen")',
      },
      {
        name: 'Catches a version that keeps the last arrival',
        check: 'check_catches(globals(), "last_arrival")',
      },
      {
        name: 'Catches a version that ignores seq',
        hidden: true,
        check: 'check_catches(globals(), "event_ts_only")',
      },
      {
        name: 'Catches a version that ignores event_ts',
        hidden: true,
        check: 'check_catches(globals(), "seq_only")',
      },
      {
        name: 'Catches a version that breaks ties the wrong way',
        hidden: true,
        check: 'check_catches(globals(), "ties_reversed")',
      },
      {
        name: 'Catches a version that fails on no events',
        hidden: true,
        check: 'check_catches(globals(), "empty_is_none")',
      },
      {
        name: 'Catches a version that rejects a duplicate delivery',
        hidden: true,
        check: 'check_catches(globals(), "rejects_duplicates")',
      },
    ],
  },

  'python-paginated-api-extractor': {
    language: 'python',
    task: `Write «extract(fetch, store, run_id, now, sleep, clock)» for the charges API. «fetch(params)» sends «GET /v1/charges» and returns a response with «status_code», «headers» and «json()», which is «{"data": [...], "next_cursor": ...}»; it raises «ConnectionError» or «TimeoutError» when the network fails. «store» has «load_state()», «save_state(state)» and «write_page(run_id, n, records)»; the state holds «"watermark"», an ISO time. Ask for «{"updated_since": ...}» with the watermark minus 5 minutes first, then «{"cursor": next_cursor}» until it is «None». Land each page with «write_page», numbered from 0, and after a crash resume from the saved cursor. When the last page lands, save the time the run started, from «now()», as the new «"watermark"». Stay under 100 requests a minute by «clock()». On a 429 wait «Retry-After» seconds; retry a 5xx or a network error a few times with backoff; raise at once on any other 4xx. Wait only with «sleep(seconds)».`,
    setup: `from datetime import datetime, timedelta, timezone


class Response:
    def __init__(self, status_code, body=None, headers=None):
        self.status_code = status_code
        self.headers = headers or {}
        self._body = body

    @property
    def ok(self):
        return self.status_code < 400

    def json(self):
        return self._body

    def raise_for_status(self):
        if self.status_code >= 400:
            raise HTTPError("HTTP %d" % self.status_code, response=self)


class HTTPError(Exception):
    def __init__(self, message, response=None):
        super().__init__(message)
        self.response = response


class FakeApi:
    """The charges API on a fake clock. A request takes 0.2 s; sleep moves the clock at once.
    It allows 100 requests in any 60 s and answers 429 with Retry-After when you go over.
    failures maps a request number, from 1, to a Response or an exception to send instead."""

    START = datetime(2026, 11, 27, 6, 0, tzinfo=timezone.utc)

    def __init__(self, pages=3, page_size=4, failures=None):
        self.time = 0.0
        self.failures = dict(failures or {})
        self.requests = []  # (start time, params, status)
        self.pages = [
            [{"id": "ch_%04d" % (page * page_size + n), "amount": 100 + n} for n in range(page_size)]
            for page in range(pages)
        ]

    def clock(self):
        return self.time

    def sleep(self, seconds):
        self.time += max(0.0, seconds)

    def now(self):
        return self.START + timedelta(seconds=self.time)

    def fetch(self, params):
        started = self.time
        self.time += 0.2
        answer = self._answer(len(self.requests) + 1, started, dict(params))
        self.requests.append((started, dict(params), getattr(answer, "status_code", "error")))
        if isinstance(answer, BaseException):
            raise answer
        return answer

    def _answer(self, number, started, params):
        if number in self.failures:
            return self.failures[number]
        recent = [t for t, _, _ in self.requests if t > started - 60]
        if len(recent) >= 100:
            return Response(429, headers={"Retry-After": str(int(min(recent) + 60 - started) + 1)})
        cursor = params.get("cursor")
        if cursor is not None:
            if not (isinstance(cursor, str) and cursor[1:].isdigit() and int(cursor[1:]) < len(self.pages)):
                return Response(400, {"error": "unknown cursor %r" % (cursor,)})
            page = int(cursor[1:])
        elif "updated_since" in params:
            page = 0
        else:
            return Response(400, {"error": "send updated_since or cursor"})
        more = page + 1 < len(self.pages)
        return Response(200, {"data": self.pages[page], "next_cursor": "c%d" % (page + 1) if more else None})


class FakeStore:
    """Landing storage and the job's state, kept in memory."""

    def __init__(self, state):
        self.state = dict(state)
        self.pages = []  # (run_id, n, record ids), in the order landed

    def load_state(self):
        return dict(self.state)

    def save_state(self, state):
        self.state = dict(state)

    def write_page(self, run_id, n, records):
        self.pages.append((run_id, n, [record["id"] for record in records]))`,
    helpers: `import time as _time_module

_WATERMARK = "2026-11-26T06:00:00+00:00"


class _Crash(BaseException):
    """The process dies here. Nothing catches it."""


class _Stop(BaseException):
    """The test stops a run that does not end."""


class _RealSleep(BaseException):
    pass


class _Api(FakeApi):
    def __init__(self, *args, max_requests=1000, **kwargs):
        super().__init__(*args, **kwargs)
        self.max_requests = max_requests

    def fetch(self, params):
        if len(self.requests) >= self.max_requests:
            raise _Stop()
        return super().fetch(params)


class _Store(FakeStore):
    def __init__(self, state, crash_on=None):
        super().__init__(state)
        self.crash_on = crash_on
        self.writes = 0
        self.saves = 0

    def write_page(self, run_id, n, records):
        self.writes += 1
        if self.crash_on == ("write", self.writes):
            raise _Crash()
        super().write_page(run_id, n, records)

    def save_state(self, state):
        super().save_state(state)
        self.saves += 1
        if self.crash_on == ("save", self.saves):
            raise _Crash()


def _extract(fn, api, store, run_id="run-1"):
    def refuse(seconds):
        raise _RealSleep()

    real_sleep = _time_module.sleep
    _time_module.sleep = refuse
    try:
        fn(api.fetch, store, run_id, api.now, api.sleep, api.clock)
        return None
    except (_Crash, _Stop, _RealSleep) as stop:
        return stop
    except Exception as error:
        return error
    finally:
        _time_module.sleep = real_sleep


def _moment(text):
    try:
        moment = datetime.fromisoformat(str(text).replace("Z", "+00:00"))
    except ValueError:
        return None
    return moment if moment.tzinfo else moment.replace(tzinfo=timezone.utc)


def _problem(error, api=None):
    if isinstance(error, _RealSleep):
        return "Your code called time.sleep. Wait with the sleep function you are given, so the test runs on its fake clock."
    if isinstance(error, _Stop):
        return "Your code sent %d requests without finishing. Stop retrying after a few attempts." % (api.max_requests if api else 0)
    return "extract raised %s: %s" % (type(error).__name__, error)


def _landed(store, api):
    """The page index of each landed page, found by its record ids."""
    index = {tuple(record["id"] for record in page): number for number, page in enumerate(api.pages)}
    return [index.get(tuple(ids), -1) for _, _, ids in store.pages]


def check_full_run(fn):
    api = _Api(pages=3)
    store = _Store({"watermark": _WATERMARK})
    error = _extract(fn, api, store)
    if error is not None:
        return verdict(False, _problem(error, api))
    if [n for _, n, _ in store.pages] != [0, 1, 2] or _landed(store, api) != [0, 1, 2]:
        return verdict(False, "Land the 3 pages once each, numbered 0, 1 and 2. Your code landed %r." % ([(n, ids[:1] + ["..."]) for _, n, ids in store.pages],))
    first = api.requests[0][1]
    want = _moment(_WATERMARK) - timedelta(minutes=5)
    if _moment(first.get("updated_since")) != want:
        return verdict(False, "The first request should ask for updated_since %s: the watermark minus 5 minutes of overlap. It sent %r." % (want.isoformat(), first))
    mark = _moment(store.state.get("watermark"))
    if mark is None:
        return verdict(False, 'After the last page, save the new watermark as an ISO time under "watermark". The state is %r.' % (store.state,))
    if mark != FakeApi.START:
        return verdict(False, "The new watermark should be the time the run started, from now(): %s. Your code saved %s." % (FakeApi.START.isoformat(), mark.isoformat()))
    return verdict(True)


def check_next_run(fn):
    store = _Store({"watermark": _WATERMARK})
    first = _Api(pages=2)
    error = _extract(fn, first, store, "run-1")
    if error is not None:
        return verdict(False, _problem(error, first))
    second = _Api(pages=2)
    second.START = FakeApi.START + timedelta(hours=1)
    error = _extract(fn, second, store, "run-2")
    if error is not None:
        return verdict(False, "The second run failed. " + _problem(error, second))
    params = second.requests[0][1]
    want = FakeApi.START - timedelta(minutes=5)
    if "cursor" in params or _moment(params.get("updated_since")) != want:
        return verdict(False, "The next run should start fresh, from updated_since %s: the new watermark minus 5 minutes. It sent %r. Clear the cursor when a run finishes." % (want.isoformat(), params))
    if [n for run, n, _ in store.pages if run == "run-2"] != [0, 1]:
        return verdict(False, "The second run should land its pages numbered from 0.")
    if _moment(store.state.get("watermark")) != second.START:
        return verdict(False, "After the second run, the watermark should be its start time, %s." % second.START.isoformat())
    return verdict(True)


def _point_name(point):
    kind, number = point
    if kind == "fetch":
        return "request %d" % number
    if kind == "write":
        return "landing page %d" % (number - 1)
    return "save %d of the state" % number


def check_resume(fn):
    clean = _Store({"watermark": _WATERMARK})
    api = _Api(pages=4)
    error = _extract(fn, api, clean)
    if error is not None:
        return verdict(False, _problem(error, api))
    points = [("fetch", n) for n in range(1, len(api.requests) + 1)]
    points += [("write", n) for n in range(1, clean.writes + 1)]
    points += [("save", n) for n in range(1, clean.saves)]
    for point in points:
        failures = {point[1]: _Crash()} if point[0] == "fetch" else {}
        store = _Store({"watermark": _WATERMARK}, crash_on=None if point[0] == "fetch" else point)
        crashed = _Api(pages=4, failures=failures)
        error = _extract(fn, crashed, store, "run-1")
        if not isinstance(error, _Crash):
            if error is not None:
                return verdict(False, _problem(error, crashed))
            continue
        store.crash_on = None
        later = _Api(pages=4)
        later.START = FakeApi.START + timedelta(hours=1)
        error = _extract(fn, later, store, "run-2")
        if error is not None:
            return verdict(False, "After a crash at %s, the next run failed. %s" % (_point_name(point), _problem(error, later)))
        landed = _landed(store, crashed)
        missing = sorted(set(range(4)) - set(landed))
        if missing:
            return verdict(False, "After a crash at %s, page %r never landed. Land a page before you save the cursor that comes after it." % (_point_name(point), missing))
        again = sorted({page for page in landed if landed.count(page) > 1})
        if len(again) > 1:
            return verdict(False, "After a crash at %s, your code landed pages %r twice. Resume from the saved cursor; at most the page in flight should repeat." % (_point_name(point), again))
        watermark = _moment(store.state.get("watermark"))
        if watermark is None or watermark < FakeApi.START:
            return verdict(False, "After a crash at %s and a resume, the watermark should move forward to the start of the run that crashed, %s. Your code saved %s." % (_point_name(point), FakeApi.START.isoformat(), store.state.get("watermark")))
        resumed = bool(later.requests) and "cursor" in later.requests[0][1]
        if resumed and watermark > FakeApi.START:
            return verdict(False, "After a crash at %s, the next run went on from the saved cursor, so the watermark should be the start of the run that crashed, %s, saved with the cursor. Your code saved %s, so a charge updated during the first run would be missed." % (_point_name(point), FakeApi.START.isoformat(), store.state.get("watermark")))
        if watermark > later.START:
            return verdict(False, "After a crash at %s, the watermark %s is later than the start of the run that finished, %s." % (_point_name(point), store.state.get("watermark"), later.START.isoformat()))
    return verdict(True)


def check_rate_limit(fn):
    api = _Api(pages=250, page_size=2)
    store = _Store({"watermark": _WATERMARK})
    error = _extract(fn, api, store)
    if error is not None:
        return verdict(False, _problem(error, api))
    refused = sum(1 for _, _, status in api.requests if status == 429)
    if refused:
        return verdict(False, "The API answered 429 Too Many Requests %d times. Pace your requests under 100 a minute, for example one every 0.67 s, instead of waiting for 429s." % refused)
    if sorted(set(_landed(store, api))) != list(range(250)):
        return verdict(False, "Land all 250 pages.")
    return verdict(True)


def check_retry_after(fn):
    api = _Api(pages=3, failures={2: Response(429, headers={"Retry-After": "7"})})
    store = _Store({"watermark": _WATERMARK})
    error = _extract(fn, api, store)
    if error is not None:
        return verdict(False, _problem(error, api))
    answered = api.requests[1][0] + 0.2
    waited = api.requests[2][0] - answered
    if waited < 7 - 1e-6:
        return verdict(False, "The API asked for a wait of 7 s with Retry-After, but the next request came %.1f s later." % waited)
    if sorted(set(_landed(store, api))) != [0, 1, 2]:
        return verdict(False, "After the wait, send the same request again and land every page.")
    return verdict(True)


def check_transient(fn):
    failures = {1: ConnectionError("connection reset"), 3: Response(503), 4: TimeoutError("read timed out"), 5: Response(502)}
    api = _Api(pages=3, failures=failures)
    store = _Store({"watermark": _WATERMARK})
    error = _extract(fn, api, store)
    if error is not None:
        return verdict(False, "A dropped connection, a timeout, a 503 and a 502 are all worth retrying. " + _problem(error, api))
    if sorted(set(_landed(store, api))) != [0, 1, 2]:
        return verdict(False, "Retry the failed requests and land every page.")
    return verdict(True)


def check_client_error(fn):
    api = _Api(pages=3, failures={2: Response(401, {"error": "invalid token"})})
    store = _Store({"watermark": _WATERMARK})
    error = _extract(fn, api, store)
    if isinstance(error, (_RealSleep, _Stop)):
        return verdict(False, _problem(error, api))
    if len(api.requests) > 2 or error is None:
        return verdict(False, "The API answered 401 Unauthorized. A retry will not fix wrong credentials: raise an error at once.")
    if _moment(store.state.get("watermark")) != _moment(_WATERMARK):
        return verdict(False, "The run failed, so keep the old watermark.")
    return verdict(True)


def check_dead_api(fn):
    api = _Api(pages=3, failures={n: Response(503) for n in range(1, 200)}, max_requests=30)
    store = _Store({"watermark": _WATERMARK})
    error = _extract(fn, api, store)
    if isinstance(error, _Stop):
        return verdict(False, "The API failed 30 requests in a row and your code kept trying. Give up after a few attempts and raise an error.")
    if isinstance(error, _RealSleep):
        return verdict(False, _problem(error, api))
    if error is None:
        return verdict(False, "Every request failed, so extract should raise an error.")
    return verdict(True)`,
    starter: `import random
from datetime import datetime, timedelta

OVERLAP = timedelta(minutes=5)


def extract(fetch, store, run_id, now, sleep, clock):
    # fetch(params) returns a response with .status_code, .headers and .json(),
    #   or raises ConnectionError or TimeoutError.
    # store.load_state(), store.save_state(state), store.write_page(run_id, n, records)
    # now() is the time in UTC, sleep(seconds) waits, clock() counts seconds for pacing.
    state = store.load_state()
    ...


api = FakeApi(pages=3)
store = FakeStore({"watermark": "2026-11-26T06:00:00+00:00"})
extract(api.fetch, store, "run-1", api.now, api.sleep, api.clock)
print("landed:", store.pages)
print("state:", store.state)
print("requests:", [(round(t, 2), params, status) for t, params, status in api.requests])
`,
    solution: `import random
from datetime import datetime, timedelta

MIN_INTERVAL = 60 / 90  # 90 requests a minute, under the limit of 100
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
            raise RuntimeError(f"HTTP {response.status_code}: the request is wrong, so a retry will not help")
        return response.json()
    raise RuntimeError("the API still fails after 8 attempts")


def extract(fetch, store, run_id, now, sleep, clock):
    state = store.load_state()
    if state.get("cursor"):  # resume an interrupted run
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
        store.write_page(run_id, page_no, body["data"])  # land the page first
        page_no += 1
        cursor = body.get("next_cursor")
        if not cursor:
            store.save_state({"watermark": started, "cursor": None, "page_no": 0, "started": None})
            return
        store.save_state({"watermark": state["watermark"], "cursor": cursor,
                          "page_no": page_no, "started": started})
        params = {"cursor": cursor}
        sleep(max(0.0, MIN_INTERVAL - (clock() - began)))
`,
    cases: [
      {
        name: 'Reads every page and moves the watermark',
        check: 'check_full_run(extract)',
      },
      {
        name: 'The next run starts from the new watermark',
        check: 'check_next_run(extract)',
      },
      {
        name: 'Waits as long as Retry-After says',
        hidden: true,
        check: 'check_retry_after(extract)',
      },
      {
        name: 'Retries network errors and 5xx',
        hidden: true,
        check: 'check_transient(extract)',
      },
      {
        name: 'Fails at once on a 401',
        hidden: true,
        check: 'check_client_error(extract)',
      },
      {
        name: 'Gives up on a dead API',
        hidden: true,
        check: 'check_dead_api(extract)',
      },
      {
        name: 'Resumes after a crash at any point',
        hidden: true,
        note: 'The process dies at each request, each landing and each save of the state in turn; the next run must finish the job.',
        check: 'check_resume(extract)',
      },
      {
        name: 'Stays under 100 requests a minute',
        hidden: true,
        note: '250 pages on the fake clock.',
        check: 'check_rate_limit(extract)',
      },
    ],
  },
};
