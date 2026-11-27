import type { SpecAnswers } from '@/lib/course/runnables/test-answers';

/** Other answers for the orchestration track's runnable problems. See `test-answers.ts`. */
export const ORCHESTRATION_ANSWERS: Readonly<Record<string, SpecAnswers>> = {
  'prefect-dynamic-fanout': {
    pass: [
      // A thread pool of 20 instead of the global limit, and exponential backoff.
      `from prefect import flow, task
from prefect.task_runners import ThreadPoolTaskRunner
from prefect.tasks import exponential_backoff

import partner


@task(retries=3, retry_delay_seconds=exponential_backoff(backoff_factor=10))
def fetch(city, day):
    return partner.save_raw(city, day, partner.fetch_trips(city, day))


@flow(task_runner=ThreadPoolTaskRunner(max_workers=20))
def partner_daily(day):
    cities = partner.active_cities(day)
    paths = fetch.map(cities, day).result()
    partner.load_raw(paths, day)
`,
      // submit in a loop, then wait for all of them.
      `from prefect import flow, task
from prefect.concurrency.sync import concurrency
from prefect.futures import wait

from partner import active_cities, fetch_trips, save_raw, load_raw


@task(retries=3, retry_delay_seconds=[10, 60, 180])
def fetch_city(city, day):
    with concurrency("partner-api"):
        rows = fetch_trips(city, day)
    return save_raw(city, day, rows)


@flow(log_prints=True)
def partner_daily(day):
    futures = [fetch_city.submit(city, day) for city in active_cities(day)]
    wait(futures)
    paths = [future.result() for future in futures]
    print(f"loading {len(paths)} files")
    load_raw(paths, day)
`,
    ],
    fail: [
      // Retries, but one city at a time: 600 cities take 20 minutes.
      `from prefect import flow, task

from partner import active_cities, fetch_trips, save_raw, load_raw


@task(retries=3, retry_delay_seconds=[5, 30, 120])
def fetch(city, day):
    return save_raw(city, day, fetch_trips(city, day))


@flow
def partner_daily(day):
    paths = [fetch(city, day) for city in active_cities(day)]
    load_raw(paths, day)
`,
      // map with no limit: every call runs at once.
      `from prefect import flow, task

from partner import active_cities, fetch_trips, save_raw, load_raw


@task(retries=3, retry_delay_seconds=[5, 30, 120])
def fetch(city, day):
    return save_raw(city, day, fetch_trips(city, day))


@flow
def partner_daily(day):
    load_raw(fetch.map(active_cities(day), day).result(), day)
`,
      // No retries: one timeout fails the run.
      `from prefect import flow, task
from prefect.concurrency.sync import concurrency

from partner import active_cities, fetch_trips, save_raw, load_raw


@task
def fetch(city, day):
    with concurrency("partner-api", occupy=1):
        rows = fetch_trips(city, day)
    return save_raw(city, day, rows)


@flow
def partner_daily(day):
    load_raw(fetch.map(active_cities(day), day).result(), day)
`,
      // The same wait before every retry.
      `from prefect import flow, task
from prefect.concurrency.sync import concurrency

from partner import active_cities, fetch_trips, save_raw, load_raw


@task(retries=3, retry_delay_seconds=10)
def fetch(city, day):
    with concurrency("partner-api", occupy=1):
        rows = fetch_trips(city, day)
    return save_raw(city, day, rows)


@flow
def partner_daily(day):
    load_raw(fetch.map(active_cities(day), day).result(), day)
`,
      // A limit name that does not exist limits nothing.
      `from prefect import flow, task
from prefect.concurrency.sync import concurrency

from partner import active_cities, fetch_trips, save_raw, load_raw


@task(retries=3, retry_delay_seconds=[5, 30, 120])
def fetch(city, day):
    with concurrency("partner_api", occupy=1):
        rows = fetch_trips(city, day)
    return save_raw(city, day, rows)


@flow
def partner_daily(day):
    load_raw(fetch.map(active_cities(day), day).result(), day)
`,
      // Loads each city on its own: 600 loads instead of one.
      `from prefect import flow, task
from prefect.concurrency.sync import concurrency

from partner import active_cities, fetch_trips, save_raw, load_raw


@task(retries=3, retry_delay_seconds=[5, 30, 120])
def fetch_and_load(city, day):
    with concurrency("partner-api", occupy=1):
        rows = fetch_trips(city, day)
    load_raw([save_raw(city, day, rows)], day)


@flow
def partner_daily(day):
    fetch_and_load.map(active_cities(day), day).wait()
`,
    ],
  },

  'partner-api-operator': {
    pass: [
      // Imported names, a capped backoff, and the lines written after all pages.
      `import json
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from airflow.sdk import BaseHook, BaseOperator

import storage

RETRYABLE = {500, 502, 503, 504}


class PartnerApiHook(BaseHook):
    def __init__(self, conn_id="partner_api"):
        super().__init__()
        self.conn_id = conn_id

    def _page(self, host, token, day, cursor):
        url = "https://%s/v1/trips?%s" % (host, urlencode({"day": day, "cursor": cursor}))
        for attempt in range(5):
            try:
                with urlopen(Request(url, headers={"Authorization": "Bearer " + token}), timeout=20) as response:
                    return json.loads(response.read())
            except HTTPError as error:
                if error.code not in RETRYABLE or attempt == 4:
                    raise
            except (TimeoutError, URLError):
                if attempt == 4:
                    raise
            time.sleep(min(60, 2 ** attempt))

    def pages(self, day):
        conn = self.get_connection(self.conn_id)
        cursor = ""
        while True:
            body = self._page(conn.host, conn.password, day, cursor)
            yield body["items"]
            cursor = body.get("next_cursor")
            if not cursor:
                break


class PartnerApiToStorageOperator(BaseOperator):
    template_fields = ("day", "target_uri")

    def __init__(self, *, day, target_uri, conn_id="partner_api", **kwargs):
        super().__init__(**kwargs)
        self.day = day
        self.target_uri = target_uri
        self.conn_id = conn_id

    def execute(self, context):
        lines = [json.dumps(item) for page in PartnerApiHook(self.conn_id).pages(self.day) for item in page]
        temp = self.target_uri + ".part"
        with storage.open(temp, "w") as out:
            out.write("\\n".join(lines) + "\\n")
        storage.rename(temp, self.target_uri)
        self.log.info("wrote %d items to %s", len(lines), self.target_uri)
        return self.target_uri
`,
    ],
    fail: [
      // Retries every OSError, so a 404 is asked for five times.
      `import json
import time
import urllib.parse
import urllib.request

from airflow.sdk import BaseHook, BaseOperator

import storage


class PartnerApiHook(BaseHook):
    def __init__(self, conn_id="partner_api"):
        super().__init__()
        self.conn_id = conn_id

    def pages(self, day):
        conn = self.get_connection(self.conn_id)
        cursor = ""
        while True:
            query = urllib.parse.urlencode({"day": day, "cursor": cursor})
            request = urllib.request.Request(f"https://{conn.host}/v1/trips?{query}", headers={"Authorization": f"Bearer {conn.password}"})
            for attempt in range(5):
                try:
                    with urllib.request.urlopen(request, timeout=30) as response:
                        body = json.load(response)
                    break
                except OSError:
                    if attempt == 4:
                        raise
                    time.sleep(2 ** attempt)
            yield body["items"]
            cursor = body.get("next_cursor") or ""
            if not cursor:
                return


class PartnerApiToStorageOperator(BaseOperator):
    template_fields = ("day", "target_uri")

    def __init__(self, *, day, target_uri, conn_id="partner_api", **kwargs):
        super().__init__(**kwargs)
        self.day = day
        self.target_uri = target_uri
        self.conn_id = conn_id

    def execute(self, context):
        temp = self.target_uri + ".tmp"
        with storage.open(temp, "w") as out:
            for page in PartnerApiHook(self.conn_id).pages(self.day):
                for item in page:
                    out.write(json.dumps(item) + "\\n")
        storage.rename(temp, self.target_uri)
        return self.target_uri
`,
      // Writes straight to the target: a failure leaves a partial file.
      `import json
import time
import urllib.error
import urllib.parse
import urllib.request

from airflow.sdk import BaseHook, BaseOperator

import storage


class PartnerApiHook(BaseHook):
    def __init__(self, conn_id="partner_api"):
        super().__init__()
        self.conn_id = conn_id

    def pages(self, day):
        conn = self.get_connection(self.conn_id)
        cursor = ""
        while True:
            query = urllib.parse.urlencode({"day": day, "cursor": cursor})
            request = urllib.request.Request(f"https://{conn.host}/v1/trips?{query}", headers={"Authorization": f"Bearer {conn.password}"})
            for attempt in range(5):
                try:
                    with urllib.request.urlopen(request, timeout=30) as response:
                        body = json.load(response)
                    break
                except urllib.error.HTTPError as error:
                    if error.code < 500 or attempt == 4:
                        raise
                except TimeoutError:
                    if attempt == 4:
                        raise
                time.sleep(2 ** attempt)
            yield body["items"]
            cursor = body.get("next_cursor") or ""
            if not cursor:
                return


class PartnerApiToStorageOperator(BaseOperator):
    template_fields = ("day", "target_uri")

    def __init__(self, *, day, target_uri, conn_id="partner_api", **kwargs):
        super().__init__(**kwargs)
        self.day = day
        self.target_uri = target_uri
        self.conn_id = conn_id

    def execute(self, context):
        with storage.open(self.target_uri, "w") as out:
            for page in PartnerApiHook(self.conn_id).pages(self.day):
                for item in page:
                    out.write(json.dumps(item) + "\\n")
        return self.target_uri
`,
      // Retries with no wait.
      `import json
import urllib.error
import urllib.parse
import urllib.request

from airflow.sdk import BaseHook, BaseOperator

import storage


class PartnerApiHook(BaseHook):
    def __init__(self, conn_id="partner_api"):
        super().__init__()
        self.conn_id = conn_id

    def pages(self, day):
        conn = self.get_connection(self.conn_id)
        cursor = ""
        while True:
            query = urllib.parse.urlencode({"day": day, "cursor": cursor})
            request = urllib.request.Request(f"https://{conn.host}/v1/trips?{query}", headers={"Authorization": f"Bearer {conn.password}"})
            for attempt in range(5):
                try:
                    with urllib.request.urlopen(request, timeout=30) as response:
                        body = json.load(response)
                    break
                except urllib.error.HTTPError as error:
                    if error.code < 500 or attempt == 4:
                        raise
                except TimeoutError:
                    if attempt == 4:
                        raise
            yield body["items"]
            cursor = body.get("next_cursor") or ""
            if not cursor:
                return


class PartnerApiToStorageOperator(BaseOperator):
    template_fields = ("day", "target_uri")

    def __init__(self, *, day, target_uri, conn_id="partner_api", **kwargs):
        super().__init__(**kwargs)
        self.day = day
        self.target_uri = target_uri
        self.conn_id = conn_id

    def execute(self, context):
        temp = self.target_uri + ".tmp"
        with storage.open(temp, "w") as out:
            for page in PartnerApiHook(self.conn_id).pages(self.day):
                for item in page:
                    out.write(json.dumps(item) + "\\n")
        storage.rename(temp, self.target_uri)
        return self.target_uri
`,
      // The host is written in the code, not read from the connection.
      `import json
import time
import urllib.error
import urllib.parse
import urllib.request

from airflow.sdk import BaseHook, BaseOperator

import storage


class PartnerApiHook(BaseHook):
    def __init__(self, conn_id="partner_api"):
        super().__init__()
        self.conn_id = conn_id

    def pages(self, day):
        token = self.get_connection(self.conn_id).password
        cursor = ""
        while True:
            query = urllib.parse.urlencode({"day": day, "cursor": cursor})
            request = urllib.request.Request(f"https://api.partner.example/v1/trips?{query}", headers={"Authorization": f"Bearer {token}"})
            for attempt in range(5):
                try:
                    with urllib.request.urlopen(request, timeout=30) as response:
                        body = json.load(response)
                    break
                except urllib.error.HTTPError as error:
                    if error.code < 500 or attempt == 4:
                        raise
                except (TimeoutError, urllib.error.URLError):
                    if attempt == 4:
                        raise
                time.sleep(2 ** attempt)
            yield body["items"]
            cursor = body.get("next_cursor") or ""
            if not cursor:
                return


class PartnerApiToStorageOperator(BaseOperator):
    template_fields = ("day", "target_uri")

    def __init__(self, *, day, target_uri, conn_id="partner_api", **kwargs):
        super().__init__(**kwargs)
        self.day = day
        self.target_uri = target_uri
        self.conn_id = conn_id

    def execute(self, context):
        temp = self.target_uri + ".tmp"
        with storage.open(temp, "w") as out:
            for page in PartnerApiHook(self.conn_id).pages(self.day):
                for item in page:
                    out.write(json.dumps(item) + "\\n")
        storage.rename(temp, self.target_uri)
        return self.target_uri
`,
      // day is not a template field, so "{{ ds }}" goes to the API as it is.
      `import json
import time
import urllib.error
import urllib.parse
import urllib.request

from airflow.sdk import BaseHook, BaseOperator

import storage


class PartnerApiHook(BaseHook):
    def __init__(self, conn_id="partner_api"):
        super().__init__()
        self.conn_id = conn_id

    def pages(self, day):
        conn = self.get_connection(self.conn_id)
        cursor = ""
        while True:
            query = urllib.parse.urlencode({"day": day, "cursor": cursor})
            request = urllib.request.Request(f"https://{conn.host}/v1/trips?{query}", headers={"Authorization": f"Bearer {conn.password}"})
            for attempt in range(5):
                try:
                    with urllib.request.urlopen(request, timeout=30) as response:
                        body = json.load(response)
                    break
                except urllib.error.HTTPError as error:
                    if error.code < 500 or attempt == 4:
                        raise
                except TimeoutError:
                    if attempt == 4:
                        raise
                time.sleep(2 ** attempt)
            yield body["items"]
            cursor = body.get("next_cursor") or ""
            if not cursor:
                return


class PartnerApiToStorageOperator(BaseOperator):
    template_fields = ("target_uri",)

    def __init__(self, *, day, target_uri, conn_id="partner_api", **kwargs):
        super().__init__(**kwargs)
        self.day = day
        self.target_uri = target_uri
        self.conn_id = conn_id

    def execute(self, context):
        temp = self.target_uri + ".tmp"
        with storage.open(temp, "w") as out:
            for page in PartnerApiHook(self.conn_id).pages(self.day):
                for item in page:
                    out.write(json.dumps(item) + "\\n")
        storage.rename(temp, self.target_uri)
        return self.target_uri
`,
      // Appends to the target, so a rerun keeps the old lines.
      `import json
import time
import urllib.error
import urllib.parse
import urllib.request

from airflow.sdk import BaseHook, BaseOperator

import storage


class PartnerApiHook(BaseHook):
    def __init__(self, conn_id="partner_api"):
        super().__init__()
        self.conn_id = conn_id

    def pages(self, day):
        conn = self.get_connection(self.conn_id)
        cursor = ""
        while True:
            query = urllib.parse.urlencode({"day": day, "cursor": cursor})
            request = urllib.request.Request(f"https://{conn.host}/v1/trips?{query}", headers={"Authorization": f"Bearer {conn.password}"})
            for attempt in range(5):
                try:
                    with urllib.request.urlopen(request, timeout=30) as response:
                        body = json.load(response)
                    break
                except urllib.error.HTTPError as error:
                    if error.code < 500 or attempt == 4:
                        raise
                except TimeoutError:
                    if attempt == 4:
                        raise
                time.sleep(2 ** attempt)
            yield body["items"]
            cursor = body.get("next_cursor") or ""
            if not cursor:
                return


class PartnerApiToStorageOperator(BaseOperator):
    template_fields = ("day", "target_uri")

    def __init__(self, *, day, target_uri, conn_id="partner_api", **kwargs):
        super().__init__(**kwargs)
        self.day = day
        self.target_uri = target_uri
        self.conn_id = conn_id

    def execute(self, context):
        lines = [json.dumps(item) + "\\n" for page in PartnerApiHook(self.conn_id).pages(self.day) for item in page]
        with storage.open(self.target_uri, "a") as out:
            out.writelines(lines)
        return self.target_uri
`,
    ],
  },
};
