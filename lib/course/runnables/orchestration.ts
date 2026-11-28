import type { RunnableSpec } from '@/types/runner';

/**
 * Runnable specs for the coding problems of the orchestration track. The code
 * runs on small look-alikes of Prefect 3 and Airflow 3
 * (`hooks/workers/python/prefect_sandbox.py` and `airflow_sandbox.py`). The
 * helpers add fake services: a partner API on a simulated clock, and an
 * object store. A check runs the learner's flow or operator against them and
 * returns `verdict(...)` with the first broken rule.
 */

/** A fake partner API for the Prefect problem. Each call takes 2 simulated seconds. */
const PREFECT_HELPERS = `import sys as _sys
import types as _types

import prefect as _prefect

_RUNTIME = _prefect._sandbox


class _Partner:
    """The partner API and the warehouse, on the sandbox's simulated clock."""

    def __init__(self):
        self.setup("2026-11-27", 30, {})

    def setup(self, day, count, failures, prefix="city"):
        self.day = day
        self.cities = ["%s-%03d" % (prefix, n) for n in range(count)]
        self.failures = dict(failures)
        self.calls = []
        self.saved = {}
        self.loads = []
        self.listed = []

    def active_cities(self, day):
        self.listed.append(day)
        return list(self.cities) if day == self.day else []

    def fetch_trips(self, city, day):
        start = _RUNTIME.now()
        _RUNTIME.sleep(2.0)
        failed = self.failures.get(city, 0) > 0
        if failed:
            self.failures[city] -= 1
        self.calls.append((city, start, _RUNTIME.now(), not failed))
        if failed:
            raise TimeoutError("the partner timed out for %s" % city)
        return [{"trip_id": "%s-%d" % (city, n), "fare": 100 + n} for n in range(3)]

    def save_raw(self, city, day, rows):
        if not isinstance(rows, list):
            raise TypeError("save_raw takes the list of rows, not %s." % type(rows).__name__)
        path = "raw/partner/%s/%s.json" % (day, city)
        self.saved[path] = len(rows)
        return path

    def load_raw(self, paths, day):
        if not isinstance(paths, (list, tuple)) or not all(isinstance(path, str) for path in paths):
            raise TypeError("load_raw takes a list of paths: the strings that save_raw returned.")
        unknown = [path for path in paths if path not in self.saved]
        if unknown:
            raise ValueError("load_raw got a path that save_raw never returned: %s" % unknown[0])
        self.loads.append((list(paths), day, _RUNTIME.now()))
        return sum(self.saved[path] for path in paths)


_partner = _Partner()
partner = _types.ModuleType("partner")
partner.active_cities = _partner.active_cities
partner.fetch_trips = _partner.fetch_trips
partner.save_raw = _partner.save_raw
partner.load_raw = _partner.load_raw
_sys.modules["partner"] = partner


def _peak(calls):
    edges = sorted([(start, 1) for _, start, _, _ in calls] + [(end, -1) for _, _, end, _ in calls])
    peak = running = 0
    for _, step in edges:
        running += step
        peak = max(peak, running)
    return peak


def _minutes(seconds):
    return "%.1f min" % (seconds / 60.0)


def _waits(city):
    calls = sorted((start, end) for name, start, end, _ in _partner.calls if name == city)
    return [later[0] - earlier[1] for earlier, later in zip(calls, calls[1:])]


def check_daily(day, count, failures=None, prefix="city", growing=None):
    """Runs partner_daily(day) against the fake partner and checks the contract."""
    flow_fn = globals().get("partner_daily")
    if flow_fn is None:
        return verdict(False, "Define the flow partner_daily(day).")
    if not isinstance(flow_fn, _prefect.Flow):
        return verdict(False, "Decorate partner_daily with @flow, so that Prefect runs it as a flow.")
    _partner.setup(day, count, failures or {}, prefix)
    _RUNTIME.reset(limits={"partner-api": 20})
    try:
        with _RUNTIME.patched_sleep(globals()):
            flow_fn(day)
    except Exception as error:
        hint = ""
        if isinstance(error, TimeoutError):
            hint = " A partner call can time out: let Prefect retry the task, for example @task(retries=3, retry_delay_seconds=[5, 30, 120])."
        return verdict(False, "The flow run failed with %s: %s.%s" % (type(error).__name__, error, hint))
    if day not in _partner.listed:
        return verdict(False, "The flow never called active_cities(day). The list changes every day: read it when the flow runs.")
    done = {}
    for city, _, _, ok in _partner.calls:
        if ok:
            done[city] = done.get(city, 0) + 1
    missing = [city for city in _partner.cities if city not in done]
    if missing:
        return verdict(False, "%d of %d cities were never fetched, for example %s." % (len(missing), len(_partner.cities), missing[0]))
    twice = sorted(city for city, times in done.items() if times > 1)
    if twice:
        return verdict(False, "%s was fetched %d times. Fetch each city once." % (twice[0], done[twice[0]]))
    if not _partner.loads:
        return verdict(False, "load_raw was never called. Call it once, with the paths of all cities.")
    if len(_partner.loads) > 1:
        return verdict(False, "load_raw ran %d times. Call it once, with the paths of all cities." % len(_partner.loads))
    paths, _, loaded_at = _partner.loads[0]
    if len(paths) != len(set(paths)):
        return verdict(False, "load_raw got some paths twice. Pass the path of each city once.")
    if sorted(paths) != sorted(_partner.saved):
        return verdict(False, "load_raw got %d paths, and save_raw stored %d. Pass the path of every city." % (len(paths), len(_partner.saved)))
    peak = _peak(_partner.calls)
    if peak > 20:
        hint = ""
        if _RUNTIME.missing_limits:
            hint = " The flow asked for the limit %s, which does not exist: its name is partner-api." % _RUNTIME.missing_limits[0]
        elif any(run.task.tags for run in _RUNTIME.task_runs):
            hint = " A task tag limits nothing here: the server has the global limit partner-api, not a tag limit."
        return verdict(False, "Up to %d partner calls ran at the same time, and the partner allows 20. Hold a slot of the global limit partner-api around each call, or run the flow with ThreadPoolTaskRunner(max_workers=20).%s" % (peak, hint))
    finished = max([end for _, _, end, _ in _partner.calls] + [loaded_at])
    if finished > 600:
        return verdict(False, "The run took %s of partner time, and the limit is 10 min. The calls ran one after another: fan out with fetch.map(...) so that up to 20 run at once." % _minutes(finished))
    for city in sorted(failures or {}):
        waits = _waits(city)
        if any(wait <= 0 for wait in waits):
            return verdict(False, "%s was retried at once, with no wait. Give the task retry_delay_seconds, so that a struggling partner gets time to recover." % city)
        if growing == city and not all(later > earlier for earlier, later in zip(waits, waits[1:])):
            return verdict(False, "The waits before the retries of %s were %s. Let each wait be longer than the one before, for example retry_delay_seconds=[5, 30, 120]." % (city, ", ".join("%g s" % wait for wait in waits)))
    return verdict(True, "%d cities in %s, at most %d calls at once." % (len(_partner.cities), _minutes(finished), peak))`;

/** A fake partner API, its HTTP layer and an object store for the Airflow problem. */
const AIRFLOW_HELPERS = `import contextlib as _contextlib
import io as _io
import json as _json
import sys as _sys
import time as _time
import types as _types
import urllib.error as _urlerror
import urllib.parse as _urlparse
import urllib.request as _urlrequest

import airflow as _airflow

_AIRFLOW = _airflow._sandbox
_NO_TIMEOUT = object()
_DAY = "2026-11-27"
_TARGET = "mem://raw/partner/{{ ds }}/trips.jsonl"
_FINAL = "mem://raw/partner/2026-11-27/trips.jsonl"
_HOST = "api.partner.example"
_TOKEN = "tok-5f2a"


class _Store:
    """Files that a reader sees as they are written, like a mounted bucket."""

    def __init__(self):
        self.objects = {}


class _Writer:
    def __init__(self, store, uri):
        self.store = store
        self.uri = uri

    def write(self, text):
        if not isinstance(text, str):
            raise TypeError("write() takes text, such as a JSON line, not %s." % type(text).__name__)
        self.store.objects[self.uri] = self.store.objects.get(self.uri, "") + text
        return len(text)

    def writelines(self, lines):
        for line in lines:
            self.write(line)

    def close(self):
        pass

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


_store = _Store()


def _open(uri, mode="r"):
    if mode in ("w", "wt"):
        _store.objects[uri] = ""
        return _Writer(_store, uri)
    if mode in ("a", "at"):
        _store.objects.setdefault(uri, "")
        return _Writer(_store, uri)
    if mode in ("r", "rt"):
        if uri not in _store.objects:
            raise FileNotFoundError(uri)
        return _io.StringIO(_store.objects[uri])
    raise ValueError("storage.open takes the mode 'r', 'w' or 'a', not %r." % mode)


def _rename(src, dst):
    if src not in _store.objects:
        raise FileNotFoundError(src)
    _store.objects[dst] = _store.objects.pop(src)


storage = _types.ModuleType("storage")
storage.open = _open
storage.rename = _rename
storage.exists = lambda uri: uri in _store.objects
storage.delete = lambda uri: _store.objects.pop(uri, None) and None
storage.list = lambda prefix="": sorted(uri for uri in _store.objects if uri.startswith(prefix))
_sys.modules["storage"] = storage


def _items(count, first=1):
    cities = ["Pune", "Delhi", "Goa", "Agra"]
    return [{"trip_id": "t-%03d" % n, "city": cities[n % 4], "fare": round(80 + n * 7.5, 2)} for n in range(first, first + count)]


class _Response:
    def __init__(self, body):
        self._body = body
        self.status = 200
        self.headers = {"Content-Type": "application/json"}

    def read(self, *args):
        return self._body

    def getcode(self):
        return 200

    def close(self):
        pass

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


class _Partner:
    """The partner's HTTP API. faults maps a page to the answers it gives before a good one."""

    def __init__(self, pages, faults=None, last=None, host=_HOST, token=_TOKEN):
        self.host = host
        self.token = token
        self.pages = pages
        self.faults = {page: list(answers) for page, answers in (faults or {}).items()}
        self.last = last
        self.requests = []
        self.sleeps = []

    def urlopen(self, url, data=None, timeout=_NO_TIMEOUT, **kwargs):
        if isinstance(url, _urlrequest.Request):
            full, auth = url.full_url, url.get_header("Authorization")
        else:
            full, auth = str(url), None
        parts = _urlparse.urlsplit(full)
        query = _urlparse.parse_qs(parts.query, keep_blank_values=True)
        day = query.get("day", [""])[0]
        cursor = query.get("cursor", [""])[0]
        page = 0 if cursor == "" else (int(cursor[1:]) if cursor[:1] == "c" and cursor[1:].isdigit() else None)
        self.requests.append({"url": full, "host": parts.hostname, "timeout": timeout, "day": day, "page": page, "slept": len(self.sleeps)})
        if parts.scheme != "https" or parts.hostname != self.host:
            raise _urlerror.URLError("[Errno -2] Name or service not known: %s" % parts.hostname)
        if parts.path != "/v1/trips":
            raise self._http(full, 404, "Not Found")
        if auth != "Bearer " + self.token:
            raise self._http(full, 401, "Unauthorized")
        if day != _DAY or page is None or page >= len(self.pages):
            raise self._http(full, 400, "Bad Request")
        answers = self.faults.get(page)
        answer = answers.pop(0) if answers else "ok"
        if answer == "timeout":
            raise TimeoutError("The read operation timed out")
        if answer != "ok":
            raise self._http(full, answer, {404: "Not Found", 503: "Service Unavailable"}.get(answer, "Error"))
        body = {"items": self.pages[page]}
        if page + 1 < len(self.pages):
            body["next_cursor"] = "c%d" % (page + 1)
        elif self.last != "missing":
            body["next_cursor"] = self.last
        return _Response(_json.dumps(body).encode())

    @staticmethod
    def _http(url, code, reason):
        return _urlerror.HTTPError(url, code, reason, {}, _io.BytesIO(b"{}"))

    def sleep(self, seconds):
        self.sleeps.append(float(seconds))

    def asked(self, page):
        return [request for request in self.requests if request["page"] == page]

    def waits(self, page):
        """The time slept before each retry of page."""
        asked = self.asked(page)
        return [sum(self.sleeps[earlier["slept"] : later["slept"]]) for earlier, later in zip(asked, asked[1:])]


@_contextlib.contextmanager
def _patched(server):
    real_open, real_sleep = _urlrequest.urlopen, _time.sleep
    names = globals()
    swapped = [(name, value) for name, value in list(names.items()) if value is real_open or value is real_sleep]
    _urlrequest.urlopen, _time.sleep = server.urlopen, server.sleep
    for name, value in swapped:
        names[name] = server.urlopen if value is real_open else server.sleep
    try:
        yield
    finally:
        _urlrequest.urlopen, _time.sleep = real_open, real_sleep
        for name, value in swapped:
            names[name] = value


def _run(server, conn_id=None, seed=None):
    """Runs the operator for _DAY as a worker would. Returns (returned, error) or a verdict."""
    hook = globals().get("PartnerApiHook")
    operator = globals().get("PartnerApiToStorageOperator")
    if not isinstance(hook, type) or not issubclass(hook, _airflow.BaseHook):
        return verdict(False, "Define the class PartnerApiHook(BaseHook).")
    if not isinstance(operator, type) or not issubclass(operator, _airflow.BaseOperator):
        return verdict(False, "Define the class PartnerApiToStorageOperator(BaseOperator).")
    _AIRFLOW.reset()
    _AIRFLOW.add_connection(conn_id or "partner_api", conn_type="http", host=server.host, password=server.token)
    _store.objects.clear()
    if seed is not None:
        _store.objects[_FINAL] = seed
    arguments = {"task_id": "pull_trips", "day": "{{ ds }}", "target_uri": _TARGET}
    if conn_id is not None:
        arguments["conn_id"] = conn_id
    with _patched(server):
        try:
            task = operator(**arguments)
            return _AIRFLOW.run(task, _AIRFLOW.context(_DAY, task=task)), None
        except Exception as error:
            return None, error


def _explain(error, server):
    days = [request["day"] for request in server.requests]
    if any("{{" in day for day in days):
        return "The request asked for day=%s: the template was not rendered. List day in template_fields." % days[0]
    if isinstance(error, _urlerror.HTTPError):
        if error.code == 401:
            return "The partner answered 401 Unauthorized. Send the header Authorization: Bearer <token>, with the token from the password of the connection."
        if error.code == 400:
            return "The partner answered 400 Bad Request for %s. Send day=%s and the cursor of the page before; the first request has an empty cursor." % (server.requests[-1]["url"], _DAY)
        if error.code >= 500:
            return "The partner answered %d once, and the task failed. Retry a 5xx answer up to 4 times, with a longer wait each time." % error.code
    if isinstance(error, TimeoutError):
        return "A request timed out once, and the task failed. Retry a timeout up to 4 times, with a longer wait each time."
    if isinstance(error, _urlerror.URLError):
        hosts = sorted({str(request["host"]) for request in server.requests if request["host"] != server.host})
        if hosts:
            return "Requests went to %s, not to the host of the connection, %s. Read the host from self.get_connection(conn_id)." % (hosts[0], server.host)
    if isinstance(error, _airflow.AirflowNotFoundException):
        return "%s. Use the conn_id that the operator gets." % error
    return "The task failed with %s: %s" % (type(error).__name__, error)


def _lines(uri):
    return [line for line in _store.objects.get(uri, "").split("\\n") if line.strip()]


def _check_success(server, returned, error, expected):
    if error is not None:
        return verdict(False, _explain(error, server))
    if not server.requests:
        return verdict(False, "The operator made no request. execute(context) should read the pages through the hook.")
    if any(request["timeout"] is _NO_TIMEOUT or request["timeout"] is None for request in server.requests):
        return verdict(False, "A request has no timeout. Pass timeout= to urlopen, so that a stuck call cannot hold the worker forever.")
    if _FINAL not in _store.objects:
        others = ", ".join(sorted(_store.objects)) or "none"
        return verdict(False, "Nothing was written to %s. The files are: %s." % (_FINAL, others))
    try:
        got = [_json.loads(line) for line in _lines(_FINAL)]
    except ValueError:
        return verdict(False, "Each line of the file must be one JSON object, such as json.dumps(item). A line is not JSON.")
    if got != expected:
        if len(got) < len(expected):
            return verdict(False, "The file holds %d items of %d. Follow next_cursor until it is empty or missing." % (len(got), len(expected)))
        if len(got) > len(expected):
            return verdict(False, "The file holds %d items, and the partner has %d. Write each item once, and replace the old file: do not append to it." % (len(got), len(expected)))
        return verdict(False, "The file does not hold the items in the order of the pages.")
    if returned != _FINAL:
        return verdict(False, "execute(context) returned %r. Return the target URI, %s, so that the next task can read it." % (returned, _FINAL))
    return None


def _check_failure(server, returned, error, page, seed, attempts):
    tries = len(server.asked(page))
    if tries == 0:
        if error is not None:
            return verdict(False, _explain(error, server))
        return verdict(False, "The hook never asked for page %d. Follow next_cursor until it is empty or missing." % (page + 1))
    if error is None:
        return verdict(False, "The task succeeded although page %d kept failing. Let the error fail the task, so that Airflow retries it and alerts." % (page + 1))
    if tries != attempts:
        if attempts == 1:
            return verdict(False, "The hook asked for page %d %d times, and it answered 404 each time. A 4xx answer will not change on a retry: fail at once." % (page + 1, tries))
        return verdict(False, "The hook asked for page %d %d times. Try 5 times in all: the first try and 4 retries." % (page + 1, tries))
    content = _store.objects.get(_FINAL)
    if content is not None and content != seed:
        return verdict(False, "After the failure, %s holds a partial file of %d lines. Write to a temporary file, and rename it to the target only after the last page." % (_FINAL, len(_lines(_FINAL))))
    return None


def check_three_pages():
    pages = [_items(2, 1), _items(2, 3), _items(1, 5)]
    server = _Partner(pages)
    outcome = _run(server)
    if isinstance(outcome, Verdict):
        return outcome
    problem = _check_success(server, *outcome, [item for page in pages for item in page])
    if problem is not None:
        return problem
    asked = [request["page"] for request in server.requests]
    if asked != [0, 1, 2]:
        return verdict(False, "The hook asked for the pages %s. Ask for each page once, in order." % [page + 1 for page in asked])
    return verdict(True)


def check_flaky():
    pages = [_items(3, 1), _items(3, 4), _items(2, 7)]
    server = _Partner(pages, faults={1: ["timeout"], 2: [503, 503]}, last="")
    outcome = _run(server)
    if isinstance(outcome, Verdict):
        return outcome
    problem = _check_success(server, *outcome, [item for page in pages for item in page])
    if problem is not None:
        return problem
    waits = server.waits(1) + server.waits(2)
    if any(wait <= 0 for wait in waits):
        return verdict(False, "The hook retried at once, with no wait. Sleep before each retry, and make each wait longer, for example 1, 2, 4 and 8 seconds.")
    third = server.waits(2)
    if len(third) == 2 and not third[1] > third[0]:
        return verdict(False, "Page 3 failed twice, and the waits before its retries were %g s and %g s. Make each wait longer than the one before." % tuple(third))
    return verdict(True)


def check_connection():
    pages = [_items(2, 11), _items(2, 13)]
    server = _Partner(pages, last="missing", host="eu.partner.example", token="tok-eu-81c")
    outcome = _run(server, conn_id="partner_eu")
    if isinstance(outcome, Verdict):
        return outcome
    return _check_success(server, *outcome, [item for page in pages for item in page]) or verdict(True)


def check_not_found():
    server = _Partner([_items(2, 1), _items(2, 3), _items(2, 5)], faults={1: [404] * 10})
    outcome = _run(server)
    if isinstance(outcome, Verdict):
        return outcome
    return _check_failure(server, *outcome, page=1, seed=None, attempts=1) or verdict(True)


def check_down():
    seed = "".join(_json.dumps(item) + "\\n" for item in _items(4, 90))
    server = _Partner([_items(2, 1), _items(2, 3), _items(2, 5)], faults={2: [503] * 20})
    outcome = _run(server, seed=seed)
    if isinstance(outcome, Verdict):
        return outcome
    problem = _check_failure(server, *outcome, page=2, seed=seed, attempts=5)
    if problem is not None:
        return problem
    waits = server.waits(2)
    if not all(later >= earlier for earlier, later in zip(waits, waits[1:])) or not waits or waits[-1] <= waits[0]:
        return verdict(False, "The waits before the retries of page 3 were %s. Make each wait longer, for example 1, 2, 4 and 8 seconds." % ", ".join("%g s" % wait for wait in waits))
    return verdict(True)


def check_rerun():
    seed = "".join(_json.dumps(item) + "\\n" for item in _items(3, 50))
    pages = [_items(2, 1), _items(1, 3)]
    server = _Partner(pages, last=None)
    outcome = _run(server, seed=seed)
    if isinstance(outcome, Verdict):
        return outcome
    return _check_success(server, *outcome, [item for page in pages for item in page]) or verdict(True)`;

export const ORCHESTRATION_RUNNABLES: Record<string, RunnableSpec> = {
  'prefect-dynamic-fanout': {
    language: 'python',
    modules: ['prefect'],
    task: `Write the flow «partner_daily(day)» with Prefect 3. The module «partner» has four functions. «active_cities(day)» returns the cities to fetch: about 600, and the list changes every day. «fetch_trips(city, day)» calls the partner API once and returns the rows of a city; a call takes 2 seconds and can raise «TimeoutError». «save_raw(city, day, rows)» stores the rows and returns their path. «load_raw(paths, day)» loads the stored files into the warehouse. The flow reads the cities when it runs and fetches each city once. It retries a failed fetch up to 3 times, with a longer wait before each retry. At most 20 fetches run at a time: the server has a global concurrency limit «partner-api» with 20 slots. At the end, the flow calls «load_raw» once, with the paths of all cities. The whole run must take less than 10 minutes. The time is simulated, so the tests take about a second.`,
    helpers: PREFECT_HELPERS,
    starter: `from prefect import flow, task
from prefect.concurrency.sync import concurrency

from partner import active_cities, fetch_trips, save_raw, load_raw


@task
def fetch(city, day):
    rows = fetch_trips(city, day)
    return save_raw(city, day, rows)


@flow
def partner_daily(day):
    # One city at a time, with no retries: 600 cities take 20 minutes,
    # and one timeout fails the whole run.
    paths = [fetch(city, day) for city in active_cities(day)]
    load_raw(paths, day)
`,
    solution: `from prefect import flow, task
from prefect.concurrency.sync import concurrency

from partner import active_cities, fetch_trips, save_raw, load_raw


@task
def cities_for(day):
    return active_cities(day)


@task(retries=3, retry_delay_seconds=[5, 30, 120])
def fetch(city, day):
    with concurrency("partner-api", occupy=1):
        rows = fetch_trips(city, day)
    return save_raw(city, day, rows)


@task
def load(paths, day):
    return load_raw(paths, day)


@flow
def partner_daily(day):
    cities = cities_for(day)
    futures = fetch.map(cities, day=day)
    load([future.result() for future in futures], day)
`,
    cases: [
      {
        name: 'Thirty cities',
        note: 'city-004 times out once. The partner allows 20 calls at a time.',
        check: 'check_daily("2026-11-27", 30, {"city-004": 1})',
      },
      {
        name: 'Six hundred cities',
        note: 'At 2 seconds a call, one city at a time takes 20 minutes. 20 at a time takes about 1.',
        check: 'check_daily("2026-11-27", 600, {"city-017": 1, "city-230": 2, "city-599": 1})',
      },
      {
        name: 'A new list the next day',
        hidden: true,
        note: 'The next day has 450 other cities. Read the list when the flow runs.',
        check: 'check_daily("2026-11-28", 450, {"town-010": 1}, prefix="town")',
      },
      {
        name: 'A city that fails three times',
        hidden: true,
        note: 'city-007 times out three times, then answers. It needs all 3 retries, with longer waits each time.',
        check: 'check_daily("2026-11-27", 60, {"city-007": 3}, growing="city-007")',
      },
    ],
  },

  'partner-api-operator': {
    language: 'python',
    modules: ['airflow'],
    task: `Write «PartnerApiHook» and «PartnerApiToStorageOperator» with the Airflow 3 SDK: «from airflow.sdk import BaseHook, BaseOperator».

«PartnerApiHook(conn_id="partner_api")» reads the host and the token from the Airflow connection: «self.get_connection(conn_id)» returns an object with «.host» and «.password». Its method «pages(day)» yields the «items» of each page of «GET https://{host}/v1/trips?day={day}&cursor={cursor}», sent with the header «Authorization: Bearer {token}». A page is JSON, «{"items": [...], "next_cursor": "c1"}». The first request has an empty cursor, and an empty or missing «next_cursor» ends the list. Give every request a timeout. Retry a timeout or an HTTP 5xx answer up to 4 times, and wait longer before each retry. Any other error fails at once.

«PartnerApiToStorageOperator(*, day, target_uri, conn_id="partner_api", **kwargs)» has the template fields «day» and «target_uri». «execute(context)» writes each item as one JSON line to «target_uri», and returns «target_uri». A failure must never leave a partial file at «target_uri», and a rerun replaces the file.

Call the API with «urllib.request.urlopen». The module «storage» writes the files: «storage.open(uri, "w")» (a reader sees each line as soon as it is written), «storage.rename(src, dst)» (replaces «dst» in one step), «storage.exists(uri)» and «storage.delete(uri)».`,
    helpers: AIRFLOW_HELPERS,
    starter: `import json
import urllib.request

from airflow.sdk import BaseHook, BaseOperator

import storage


class PartnerApiHook(BaseHook):
    def __init__(self, conn_id="partner_api"):
        super().__init__()
        self.conn_id = conn_id

    def pages(self, day):
        conn = self.get_connection(self.conn_id)
        # One page only, no timeout and no retries.
        url = f"https://{conn.host}/v1/trips?day={day}&cursor="
        request = urllib.request.Request(url, headers={"Authorization": f"Bearer {conn.password}"})
        with urllib.request.urlopen(request) as response:
            yield json.load(response)["items"]


class PartnerApiToStorageOperator(BaseOperator):
    template_fields = ("day", "target_uri")

    def __init__(self, *, day, target_uri, conn_id="partner_api", **kwargs):
        super().__init__(**kwargs)
        self.day = day
        self.target_uri = target_uri
        self.conn_id = conn_id

    def execute(self, context):
        hook = PartnerApiHook(self.conn_id)
        # Writes straight to the target: a failure leaves a partial file.
        with storage.open(self.target_uri, "w") as out:
            for page in hook.pages(self.day):
                for item in page:
                    out.write(json.dumps(item) + "\\n")
        return self.target_uri
`,
    solution: `import json
import time
import urllib.error
import urllib.parse
import urllib.request

from airflow.sdk import BaseHook, BaseOperator

import storage


class PartnerApiHook(BaseHook):
    """Owns the connection and the HTTP details of the partner API."""

    def __init__(self, conn_id="partner_api", timeout_s=30, max_retries=4):
        super().__init__()
        self.conn_id = conn_id
        self.timeout_s = timeout_s
        self.max_retries = max_retries

    def _get(self, url, token):
        request = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
        for attempt in range(self.max_retries + 1):
            try:
                with urllib.request.urlopen(request, timeout=self.timeout_s) as response:
                    return json.load(response)
            except urllib.error.HTTPError as error:
                if error.code < 500 or attempt == self.max_retries:
                    raise
            except (TimeoutError, urllib.error.URLError):
                if attempt == self.max_retries:
                    raise
            time.sleep(2 ** attempt)

    def pages(self, day):
        conn = self.get_connection(self.conn_id)
        cursor = ""
        while True:
            query = urllib.parse.urlencode({"day": day, "cursor": cursor})
            body = self._get(f"https://{conn.host}/v1/trips?{query}", conn.password)
            yield body["items"]
            cursor = body.get("next_cursor") or ""
            if not cursor:
                return


class PartnerApiToStorageOperator(BaseOperator):
    """Writes one day of the partner API to storage as JSON lines, all or nothing."""

    template_fields = ("day", "target_uri")

    def __init__(self, *, day, target_uri, conn_id="partner_api", **kwargs):
        super().__init__(**kwargs)
        self.day = day
        self.target_uri = target_uri
        self.conn_id = conn_id

    def execute(self, context):
        hook = PartnerApiHook(self.conn_id)
        temp_uri = f"{self.target_uri}.tmp-{context['run_id']}"
        try:
            with storage.open(temp_uri, "w") as out:
                for page in hook.pages(self.day):
                    for item in page:
                        out.write(json.dumps(item) + "\\n")
            storage.rename(temp_uri, self.target_uri)
        finally:
            if storage.exists(temp_uri):
                storage.delete(temp_uri)
        return self.target_uri
`,
    cases: [
      {
        name: 'Three pages',
        note: 'Follow next_cursor from page to page. The last page has next_cursor null.',
        check: 'check_three_pages()',
      },
      {
        name: 'A timeout, then two 503 answers',
        note: 'Page 2 times out once, and page 3 answers 503 twice. Retry them, with a longer wait each time.',
        check: 'check_flaky()',
      },
      {
        name: 'Credentials from the connection',
        hidden: true,
        note: 'The connection partner_eu has another host and token. The last page has no next_cursor.',
        check: 'check_connection()',
      },
      {
        name: 'A 404 fails at once',
        hidden: true,
        note: 'Page 2 answers 404. Retrying will not help: fail at once, and leave no partial file.',
        check: 'check_not_found()',
      },
      {
        name: 'The partner stays down',
        hidden: true,
        note: 'Page 3 answers 503 every time. After 5 tries the task fails, and the complete file of an earlier run must stay as it was.',
        check: 'check_down()',
      },
      {
        name: 'A rerun replaces the file',
        hidden: true,
        note: 'An old file is already at the target. The new run replaces it.',
        check: 'check_rerun()',
      },
    ],
  },
};
