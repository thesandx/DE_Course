"""Prefect look-alike for the browser sandbox.

It runs the flows a learner writes in an orchestration problem: @flow and
@task, task.submit and task.map with futures, retries with
retry_delay_seconds, global concurrency limits (prefect.concurrency.sync)
and the thread pool task runner's max_workers. Only these parts of Prefect 3
are here, and only sync flows and tasks.

Time is simulated. Work inside a task run moves that run's own clock: a fake
service calls _sandbox.sleep(seconds), and a check can patch time.sleep to do
the same. The sandbox places each task run on the timeline as a task runner
and the concurrency limits would, so a check can read how many calls ran at
once and how long the run took. The code itself runs one task at a time, in
the order the flow submits the tasks.
"""

import contextlib as _contextlib
import functools as _functools
import heapq as _heapq
import inspect as _inspect
import sys as _sys
import time as _time
import types as _types

__sandbox__ = True
__version__ = "3.1.0"


# --------------------------------------------------------------------------
# Exceptions
# --------------------------------------------------------------------------


class PrefectException(Exception):
    pass


class UpstreamTaskError(PrefectException):
    """A task's input came from a task run that failed."""


class MappingLengthMismatch(PrefectException):
    pass


class MappingMissingIterable(PrefectException):
    pass


class ConcurrencySlotAcquisitionError(PrefectException):
    pass


# --------------------------------------------------------------------------
# The simulated timeline
# --------------------------------------------------------------------------


class _Clock:
    __slots__ = ("time",)

    def __init__(self, time=0.0):
        self.time = float(time)


class _Slots:
    """A pool of slots on the timeline. Each entry is the time a slot is free again."""

    def __init__(self, size):
        self.size = size
        self.free = [0.0] * size if size is not None else None

    def take(self, count, at):
        if self.free is None:
            return at
        if count > self.size:
            raise ConcurrencySlotAcquisitionError(
                "occupy=%d asks for more than the %d slots of the limit." % (count, self.size)
            )
        taken = [_heapq.heappop(self.free) for _ in range(count)]
        return max([at] + taken)

    def give(self, count, at):
        if self.free is None:
            return
        for _ in range(count):
            _heapq.heappush(self.free, at)


class _Runtime:
    """The state of the sandbox: limits, clocks and every run so far. Checks read it."""

    def __init__(self):
        self.reset()

    def reset(self, limits=None):
        self.limits = {name: _Slots(int(size)) for name, size in (limits or {}).items()}
        self.clocks = [_Clock(0.0)]
        self.flow_stack = []
        self.run_stack = []
        self.task_runs = []
        self.flow_runs = []
        self.missing_limits = []

    def now(self):
        return self.clocks[-1].time

    def sleep(self, seconds):
        """Moves the clock of the code that runs now: a flow run or a task run."""
        self.clocks[-1].time += max(0.0, float(seconds))

    def current_run(self):
        return self.run_stack[-1] if self.run_stack else None

    @_contextlib.contextmanager
    def patched_sleep(self, namespace=None):
        """time.sleep moves the simulated clock while the block runs, also in namespace."""
        real = _time.sleep
        swapped = [name for name, value in (namespace or {}).items() if value is real]
        _time.sleep = self.sleep
        for name in swapped:
            namespace[name] = self.sleep
        try:
            yield
        finally:
            _time.sleep = real
            for name in swapped:
                namespace[name] = real


_sandbox = _Runtime()


# --------------------------------------------------------------------------
# States and futures
# --------------------------------------------------------------------------


class State:
    def __init__(self, type, message="", data=None, error=None):  # noqa: A002 - Prefect's name
        self.type = type
        self.name = type.title().replace("_", "")
        self.message = message
        self._data = data
        self._error = error

    def is_completed(self):
        return self.type == "COMPLETED"

    def is_failed(self):
        return self.type == "FAILED"

    def result(self, raise_on_failure=True):
        if self._error is not None:
            if raise_on_failure:
                raise self._error
            return self._error
        return self._data

    def __repr__(self):
        return "%s(message=%r, type=%s)" % (self.name, self.message, self.type)


def Completed(data=None, message=""):  # noqa: N802 - Prefect's name
    return State("COMPLETED", message, data=data)


def Failed(message="", error=None):  # noqa: N802 - Prefect's name
    return State("FAILED", message, error=error or PrefectException(message))


class _TaskRun:
    def __init__(self, task, run_id):
        self.task = task
        self.id = "%s-%d" % (task.name, run_id)
        self.start = None
        self.end = None
        self.value = None
        self.error = None
        self.attempts = []
        self.delays = []

    @property
    def failed(self):
        return self.error is not None

    @property
    def state(self):
        if self.error is None:
            return Completed(self.value)
        kind = "NOT_READY" if isinstance(self.error, UpstreamTaskError) else "FAILED"
        return State(kind, str(self.error), error=self.error)

    def result(self):
        if self.error is not None:
            raise self.error
        return self.value


class PrefectFuture:
    """A task run that the flow submitted. result() waits for it on the timeline."""

    def __init__(self, run):
        self._run = run
        self.task_run_id = run.id

    def wait(self, timeout=None):
        clock = _sandbox.clocks[-1]
        clock.time = max(clock.time, self._run.end)

    def result(self, timeout=None, raise_on_failure=True):
        self.wait()
        if self._run.error is not None and raise_on_failure:
            raise self._run.error
        return self._run.error if self._run.error is not None else self._run.value

    @property
    def state(self):
        return self._run.state

    def add_done_callback(self, fn):
        fn(self)

    def __repr__(self):
        return "PrefectFuture(%s)" % self.task_run_id


class PrefectFutureList(list):
    def wait(self, timeout=None):
        for future in self:
            future.wait()

    def result(self, timeout=None, raise_on_failure=True):
        return [future.result(raise_on_failure=raise_on_failure) for future in self]


class _DoneAndNotDone(tuple):
    @property
    def done(self):
        return self[0]

    @property
    def not_done(self):
        return self[1]


def wait(futures, timeout=None):
    for future in futures:
        future.wait()
    return _DoneAndNotDone((set(futures), set()))


def as_completed(futures, timeout=None):
    for future in sorted(futures, key=lambda item: item._run.end):
        future.wait()
        yield future


def resolve_futures_to_results(value):
    return _resolve(value)


# --------------------------------------------------------------------------
# Annotations
# --------------------------------------------------------------------------


class unmapped:  # noqa: N801 - Prefect's name
    """Passes one value to every mapped task run."""

    def __init__(self, value):
        self.value = value


class allow_failure:  # noqa: N801 - Prefect's name
    """Lets a task run take the result of a failed upstream run: the exception."""

    def __init__(self, value):
        self.value = value


class quote:  # noqa: N801 - Prefect's name
    def __init__(self, value):
        self.value = value

    def unquote(self):
        return self.value


def _futures_in(value, found=None):
    found = [] if found is None else found
    if isinstance(value, PrefectFuture):
        found.append(value)
    elif isinstance(value, (unmapped, quote)):
        _futures_in(value.value, found)
    elif isinstance(value, allow_failure):
        pass
    elif isinstance(value, dict):
        for item in value.values():
            _futures_in(item, found)
    elif isinstance(value, (list, tuple, set, frozenset)):
        for item in value:
            _futures_in(item, found)
    return found


def _resolve(value):
    if isinstance(value, PrefectFuture):
        return value.result()
    if isinstance(value, allow_failure):
        inner = value.value
        if isinstance(inner, PrefectFuture):
            return inner.result(raise_on_failure=False)
        return _resolve(inner)
    if isinstance(value, (unmapped, quote)):
        return _resolve(value.value)
    if isinstance(value, dict):
        return {key: _resolve(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set, frozenset)) and not isinstance(value, str):
        items = [_resolve(item) for item in value]
        if isinstance(value, PrefectFutureList) or type(value) is list:
            return items
        return type(value)(items) if not hasattr(value, "_fields") else type(value)(*items)
    return value


def _is_iterable(value):
    if isinstance(value, (str, bytes, dict, unmapped, quote)):
        return False
    try:
        iter(value)
    except TypeError:
        return False
    return True


# --------------------------------------------------------------------------
# Task runners
# --------------------------------------------------------------------------


class ThreadPoolTaskRunner:
    """Runs submitted tasks in a pool of max_workers threads; None means no limit here."""

    def __init__(self, max_workers=None):
        if max_workers is not None and int(max_workers) < 1:
            raise ValueError("max_workers must be at least 1.")
        self.max_workers = None if max_workers is None else int(max_workers)

    def __repr__(self):
        return "ThreadPoolTaskRunner(max_workers=%r)" % self.max_workers


ConcurrentTaskRunner = ThreadPoolTaskRunner


# --------------------------------------------------------------------------
# Tasks
# --------------------------------------------------------------------------


def _not_async(fn, kind):
    if _inspect.iscoroutinefunction(fn) or _inspect.isasyncgenfunction(fn):
        raise TypeError(
            "%s %s is async. This sandbox runs sync flows and tasks only: write it with def, and "
            "fan out with .map() or .submit()." % (kind, getattr(fn, "__name__", "?"))
        )


def exponential_backoff(backoff_factor):
    """retry_delay_seconds=exponential_backoff(10) waits 10, 20, 40 ... seconds."""

    def delays(retries):
        return [backoff_factor * 2**index for index in range(retries)]

    return delays


class Task:
    def __init__(self, fn, name=None, retries=None, retry_delay_seconds=None, tags=None, **options):
        _not_async(fn, "The task")
        self.fn = fn
        self.name = name or fn.__name__
        self.retries = int(retries or 0)
        self.retry_delay_seconds = retry_delay_seconds or 0
        self.tags = set(tags or ())
        self.options = options
        _functools.update_wrapper(self, fn)

    def _delay(self, attempt):
        delays = self.retry_delay_seconds
        if callable(delays):
            delays = delays(self.retries)
        if isinstance(delays, (list, tuple)):
            if not delays:
                return 0.0
            return float(delays[min(attempt, len(delays) - 1)])
        return float(delays)

    def with_options(self, **options):
        merged = dict(
            name=self.name,
            retries=self.retries,
            retry_delay_seconds=self.retry_delay_seconds,
            tags=self.tags,
        )
        merged.update(self.options)
        merged.update(options)
        return Task(self.fn, **merged)

    def __call__(self, *args, **kwargs):
        return_state = kwargs.pop("return_state", False)
        wait_for = kwargs.pop("wait_for", None)
        run = _run_task(self, args, kwargs, wait_for, submitted=False)
        if return_state:
            return run.state
        return run.result()

    def submit(self, *args, **kwargs):
        kwargs.pop("return_state", None)
        wait_for = kwargs.pop("wait_for", None)
        return PrefectFuture(_run_task(self, args, kwargs, wait_for, submitted=True))

    def map(self, *args, **kwargs):
        wait_for = kwargs.pop("wait_for", None)
        kwargs.pop("return_state", None)
        try:
            bound = _inspect.signature(self.fn).bind(*args, **kwargs)
        except TypeError as error:
            raise TypeError("%s.map(...): %s" % (self.name, error)) from None
        parameters = dict(bound.arguments)
        for key, value in parameters.items():
            if isinstance(value, PrefectFuture):
                parameters[key] = value.result()
        mapped = {key: list(value) for key, value in parameters.items() if _is_iterable(value)}
        if not mapped:
            raise MappingMissingIterable(
                "No iterable parameters were received. Parameters for map must include at least "
                "one iterable. Parameters: %s" % parameters
            )
        lengths = {key: len(value) for key, value in mapped.items()}
        if len(set(lengths.values())) > 1:
            raise MappingLengthMismatch(
                "Received iterable parameters with different lengths. Parameters for map must "
                "all be the same length. Got lengths: %s" % lengths
            )
        size = next(iter(lengths.values()))
        futures = PrefectFutureList()
        for index in range(size):
            call = {
                key: (mapped[key][index] if key in mapped else value)
                for key, value in parameters.items()
            }
            futures.append(self.submit(wait_for=wait_for, **call))
        return futures

    def __repr__(self):
        return "Task(%s)" % self.name


def task(__fn=None, **options):
    if __fn is not None and callable(__fn):
        return Task(__fn, **options)

    def decorate(fn):
        return Task(fn, **options)

    return decorate


def _run_task(task, args, kwargs, wait_for, submitted):
    runtime = _sandbox
    caller = runtime.clocks[-1]
    upstream = _futures_in((args, kwargs, wait_for or ()))
    earliest = max([caller.time] + [future._run.end for future in upstream])
    run = _TaskRun(task, len(runtime.task_runs) + 1)
    runtime.task_runs.append(run)
    failed = [future for future in upstream if future._run.failed]
    allowed = {id(item.value) for item in _allowed(args, kwargs)}
    blocking = [future for future in failed if id(future) not in allowed]
    if blocking:
        run.start = run.end = earliest
        run.error = UpstreamTaskError(
            "Upstream task run %s did not reach a 'COMPLETED' state." % blocking[0].task_run_id
        )
        return run
    call_args = _resolve(list(args))
    call_kwargs = _resolve(dict(kwargs))
    workers = runtime.flow_stack[-1].workers if (submitted and runtime.flow_stack) else _Slots(None)
    start = workers.take(1, earliest)
    clock = _Clock(start)
    run.start = start
    runtime.clocks.append(clock)
    runtime.run_stack.append(run)
    try:
        attempts = task.retries + 1
        for attempt in range(attempts):
            run.attempts.append(clock.time)
            try:
                run.value = task.fn(*call_args, **call_kwargs)
                run.error = None
                break
            except Exception as error:  # noqa: BLE001 - a task run fails on any error
                run.error = error
                if attempt < attempts - 1:
                    delay = task._delay(attempt)
                    run.delays.append(delay)
                    clock.time += delay
    finally:
        runtime.run_stack.pop()
        runtime.clocks.pop()
        workers.give(1, clock.time)
    run.end = clock.time
    if not submitted:
        caller.time = max(caller.time, run.end)
    return run


def _allowed(args, kwargs):
    found = []

    def visit(value):
        if isinstance(value, allow_failure):
            found.append(value)
        elif isinstance(value, dict):
            for item in value.values():
                visit(item)
        elif isinstance(value, (list, tuple, set)):
            for item in value:
                visit(item)

    visit(list(args))
    visit(dict(kwargs))
    return found


# --------------------------------------------------------------------------
# Flows
# --------------------------------------------------------------------------


class _FlowRun:
    def __init__(self, flow, workers, clock):
        self.flow = flow
        self.workers = workers
        self.clock = clock
        self.start = clock.time
        self.end = None
        self.error = None


class Flow:
    def __init__(self, fn, name=None, task_runner=None, retries=None, retry_delay_seconds=None, **options):
        _not_async(fn, "The flow")
        self.fn = fn
        self.name = name or fn.__name__.replace("_", "-")
        self.task_runner = task_runner
        self.retries = int(retries or 0)
        self.retry_delay_seconds = retry_delay_seconds or 0
        self.options = options
        _functools.update_wrapper(self, fn)

    def with_options(self, **options):
        merged = dict(
            name=self.name,
            task_runner=self.task_runner,
            retries=self.retries,
            retry_delay_seconds=self.retry_delay_seconds,
        )
        merged.update(self.options)
        merged.update(options)
        return Flow(self.fn, **merged)

    def __call__(self, *args, **kwargs):
        runtime = _sandbox
        runner = self.task_runner or ThreadPoolTaskRunner()
        if isinstance(runner, type):
            runner = runner()
        parent = runtime.clocks[-1]
        clock = _Clock(parent.time)
        run = _FlowRun(self, _Slots(getattr(runner, "max_workers", None)), clock)
        runtime.flow_runs.append(run)
        runtime.flow_stack.append(run)
        runtime.clocks.append(clock)
        first_task = len(runtime.task_runs)
        try:
            for attempt in range(self.retries + 1):
                try:
                    return self.fn(*args, **kwargs)
                except Exception as error:  # noqa: BLE001 - a flow run fails on any error
                    run.error = error
                    if attempt == self.retries:
                        raise
                    clock.time += float(self.retry_delay_seconds or 0)
        finally:
            runtime.clocks.pop()
            runtime.flow_stack.pop()
            ends = [item.end for item in runtime.task_runs[first_task:] if item.end is not None]
            run.end = max([clock.time] + ends)
            parent.time = max(parent.time, run.end)

    def serve(self, *args, **kwargs):
        raise NotImplementedError("This sandbox has no server. Run the flow by calling it.")

    def deploy(self, *args, **kwargs):
        raise NotImplementedError("This sandbox has no server. Run the flow by calling it.")

    def __repr__(self):
        return "Flow(%s)" % self.name


def flow(__fn=None, **options):
    if __fn is not None and callable(__fn):
        return Flow(__fn, **options)

    def decorate(fn):
        return Flow(fn, **options)

    return decorate


# --------------------------------------------------------------------------
# Concurrency limits
# --------------------------------------------------------------------------


@_contextlib.contextmanager
def _concurrency(names, occupy=1, timeout_seconds=None, max_retries=None, lease_duration=None, strict=False, holder=None):
    """Holds occupy slots of each named global concurrency limit while the block runs."""
    runtime = _sandbox
    names = [names] if isinstance(names, str) else list(names)
    clock = runtime.clocks[-1]
    held = []
    for name in names:
        slots = runtime.limits.get(name)
        if slots is None:
            if strict:
                raise ConcurrencySlotAcquisitionError(
                    "Concurrency limits %s must be created before acquiring slots." % names
                )
            if name not in runtime.missing_limits:
                runtime.missing_limits.append(name)
            continue
        clock.time = slots.take(int(occupy), clock.time)
        held.append(slots)
    try:
        yield
    finally:
        for slots in held:
            slots.give(int(occupy), clock.time)


def rate_limit(names, occupy=1, timeout_seconds=None, strict=False):
    """Rate limits are not simulated: this only checks that the limits exist."""
    runtime = _sandbox
    for name in [names] if isinstance(names, str) else list(names):
        if name not in runtime.limits and name not in runtime.missing_limits:
            runtime.missing_limits.append(name)


# --------------------------------------------------------------------------
# Logging
# --------------------------------------------------------------------------


class _RunLogger:
    def _log(self, level, message, *args):
        text = message % args if args else str(message)
        print("%s | %s" % (level, text))

    def debug(self, message, *args, **kwargs):
        pass

    def info(self, message, *args, **kwargs):
        self._log("INFO", message, *args)

    def warning(self, message, *args, **kwargs):
        self._log("WARNING", message, *args)

    def error(self, message, *args, **kwargs):
        self._log("ERROR", message, *args)

    def exception(self, message, *args, **kwargs):
        self._log("ERROR", message, *args)


def get_run_logger(context=None, **kwargs):
    return _RunLogger()


# --------------------------------------------------------------------------
# Submodules, so the usual imports work
# --------------------------------------------------------------------------


def _submodule(name, **attributes):
    module = _types.ModuleType(name)
    module.__sandbox__ = True
    module.__dict__.update(attributes)
    _sys.modules[name] = module
    return module


_CACHE = _types.SimpleNamespace(INPUTS="INPUTS", NONE="NONE", TASK_SOURCE="TASK_SOURCE", DEFAULT="DEFAULT")

futures = _submodule(
    "prefect.futures",
    PrefectFuture=PrefectFuture,
    PrefectFutureList=PrefectFutureList,
    wait=wait,
    as_completed=as_completed,
    resolve_futures_to_results=resolve_futures_to_results,
)
task_runners = _submodule(
    "prefect.task_runners",
    ThreadPoolTaskRunner=ThreadPoolTaskRunner,
    ConcurrentTaskRunner=ConcurrentTaskRunner,
)
concurrency = _submodule("prefect.concurrency")
concurrency.sync = _submodule(
    "prefect.concurrency.sync", concurrency=_concurrency, rate_limit=rate_limit
)
tasks = _submodule("prefect.tasks", Task=Task, task=task, exponential_backoff=exponential_backoff)
flows = _submodule("prefect.flows", Flow=Flow, flow=flow)
exceptions = _submodule(
    "prefect.exceptions",
    PrefectException=PrefectException,
    UpstreamTaskError=UpstreamTaskError,
    MappingLengthMismatch=MappingLengthMismatch,
    MappingMissingIterable=MappingMissingIterable,
    ConcurrencySlotAcquisitionError=ConcurrencySlotAcquisitionError,
)
utilities = _submodule("prefect.utilities")
utilities.annotations = _submodule(
    "prefect.utilities.annotations", unmapped=unmapped, allow_failure=allow_failure, quote=quote
)
logging = _submodule("prefect.logging", get_run_logger=get_run_logger)
states = _submodule("prefect.states", State=State, Completed=Completed, Failed=Failed)
cache_policies = _submodule("prefect.cache_policies", **vars(_CACHE))
