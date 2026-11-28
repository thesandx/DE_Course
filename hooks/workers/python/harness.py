"""Runs a learner's Python against the reference solution and compares the results.

The worker calls run_job() with one JSON string and gets one JSON string back.
The same file runs in Pyodide in the browser and in CPython for the tests.

The job is `PythonJob` in lib/runner/data.ts: key, action, language, code,
solution, modules and cases. Each case carries its prelude (imports and sample
data), its own setup, the check expression, the compare order, the tolerance
and the time limit. The result is {"cases": [CaseResult, ...]}, the shape of
`CaseResult` in types/runner.ts.

The expected result of each case is cached by (key, case index). The key holds
a hash of the spec, so an edited spec never compares against a stale result.

The check reads the case's inputs as the setup made them. Before the learner's
code runs, the harness copies the plain data the check names (lists, dicts,
sets, tuples and pandas objects) and puts the copies back before the check. So
a function that changes its input, a print of the sample, or the learner's own
test data cannot change what the test passes in. A problem that tests a change
in place calls the function on fresh data inside a helper.
"""

import ast as _ast
import collections.abc as _abc
import contextlib as _contextlib
import copy as _copy
import datetime as _dt
import decimal as _dec
import io as _io
import json as _json
import linecache as _linecache
import math as _math
import pprint as _pprint
import sys as _sys
import time as _time
import traceback as _traceback
import types as _types

_EXPECTED = {}
_MISSING = object()
_MAX_OUTPUT = 20000
_MAX_ROWS = 50
_MAX_ITEMS = 200
_ATOMS = frozenset((type(None), bool, int, float, complex, str, bytes))


class Verdict:
    """What a custom check returns: pass or fail, with a sentence that says why."""

    def __init__(self, passed, message=""):
        self.passed = bool(passed)
        self.message = str(message)

    def __repr__(self):
        return "Verdict(%s, %r)" % (self.passed, self.message)


def verdict(passed, message=""):
    return Verdict(passed, message)


class _Frame:
    def __init__(self, columns, rows):
        self.columns = [str(name) for name in columns]
        self.rows = rows


class _CappedOutput(_io.StringIO):
    def write(self, text):
        if self.tell() < _MAX_OUTPUT:
            return super().write(text[: _MAX_OUTPUT - self.tell()])
        return len(text)


# --------------------------------------------------------------------------
# Canonical values: what two results must agree on
# --------------------------------------------------------------------------


def _is_frame(value):
    return type(value).__name__ == "DataFrame" and hasattr(value, "columns")


def _is_series(value):
    return type(value).__name__ == "Series" and hasattr(value, "index")


def _missing_scalar(value):
    if value is None:
        return True
    if isinstance(value, float) and value != value:
        return True
    name = type(value).__name__
    return name in ("NAType", "NaTType")


def _canon(value):
    """Plain data: None, bool, int, float, str, list, dict or _Frame."""
    if isinstance(value, _Frame):
        return value
    if _missing_scalar(value):
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, int):
        return int(value)
    if isinstance(value, float):
        return float(value)
    if isinstance(value, str):
        return value
    if isinstance(value, _dec.Decimal):
        return float(value)
    if isinstance(value, _dt.datetime):
        text = value.replace(tzinfo=None).isoformat(sep=" ")
        return text[:19] if text.endswith(".000000") else text
    if isinstance(value, _dt.date):
        return value.isoformat()
    if isinstance(value, _dt.timedelta):
        return value.total_seconds()
    type_name = type(value).__name__
    module = type(value).__module__ or ""
    if type_name == "Timestamp":
        return _canon(value.to_pydatetime())
    if type_name == "Timedelta":
        return value.total_seconds()
    if module.startswith("numpy"):
        if hasattr(value, "tolist"):
            return _canon(value.tolist())
        if hasattr(value, "item"):
            return _canon(value.item())
    if _is_frame(value):
        return _frame_from_dataframe(value)
    if _is_series(value):
        return _frame_from_series(value)
    if type_name == "Row" and isinstance(value, tuple):
        return [_canon(item) for item in value]
    if isinstance(value, dict):
        return {_key(item): _canon(child) for item, child in value.items()}
    if isinstance(value, (set, frozenset)):
        items = [_canon(item) for item in value]
        return sorted(items, key=_sort_key)
    if isinstance(value, (list, tuple)):
        return [_canon(item) for item in value]
    if isinstance(value, (_abc.KeysView, _abc.ValuesView, _abc.ItemsView)):
        return [_canon(item) for item in value]
    if hasattr(value, "__iter__") and hasattr(value, "__next__"):
        items = []
        for item in value:
            items.append(_canon(item))
            if len(items) > 1_000_000:
                break
        return items
    return repr(value)


def _key(value):
    canon = _canon(value)
    if isinstance(canon, str):
        return canon
    return _json.dumps(canon, sort_keys=True, default=str)


def _flat_index(frame):
    """A pandas frame without its row index: named levels become columns, unnamed ones go.

    A named index is data, such as the key of a groupby, so groupby("city").sum()
    and groupby("city", as_index=False).sum() compare the same. An unnamed index
    is row numbers left over from a filter or a sort, and it is not part of the answer.
    """
    names = list(frame.index.names)
    taken = {str(column) for column in frame.columns}
    keep = [name for name in names if name is not None and str(name) not in taken]
    if keep:
        frame = frame.reset_index(level=keep)
    return frame.reset_index(drop=True)


def _frame_from_dataframe(frame):
    # A Spark DataFrame (the sandbox one) collects into rows.
    if hasattr(frame, "collect") and hasattr(frame, "sparkSession"):
        rows = frame.collect()
        return _Frame(frame.columns, [[_canon(item) for item in row] for row in rows])
    frame = _flat_index(frame)
    columns = [
        str(name) if not isinstance(name, tuple) else "_".join(str(part) for part in name if part != "")
        for name in frame.columns
    ]
    rows = [[_canon(item) for item in row] for row in frame.itertuples(index=False, name=None)]
    return _Frame(columns, rows)


def _frame_from_series(series):
    """A named index makes a table; row numbers make a list; other labels make a dict."""
    index = series.index
    if any(name is not None for name in index.names):
        name = series.name if series.name is not None and series.name not in index.names else "value"
        return _frame_from_dataframe(series.to_frame(name=name))
    if getattr(index.dtype, "kind", "O") in "iu":
        return [_canon(item) for item in series.tolist()]
    return {_key(label): _canon(item) for label, item in series.items()}


def _sort_key(value):
    return _json.dumps(_rounded(value), sort_keys=True, default=str)


def _rounded(value):
    if isinstance(value, float):
        return round(value, 4)
    if isinstance(value, list):
        return [_rounded(item) for item in value]
    if isinstance(value, dict):
        return {key: _rounded(item) for key, item in value.items()}
    if isinstance(value, _Frame):
        return {"columns": value.columns, "rows": [_rounded(row) for row in value.rows]}
    return value


# --------------------------------------------------------------------------
# Comparison
# --------------------------------------------------------------------------


def _same(a, b, tol):
    if a is None or b is None:
        return a is None and b is None
    if isinstance(a, bool) or isinstance(b, bool):
        return isinstance(a, bool) and isinstance(b, bool) and a == b
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        if isinstance(a, float) and isinstance(b, float) and _math.isnan(a) and _math.isnan(b):
            return True
        return abs(a - b) <= tol * max(1.0, abs(b))
    if isinstance(a, list) and isinstance(b, list):
        return len(a) == len(b) and all(_same(x, y, tol) for x, y in zip(a, b))
    if isinstance(a, dict) and isinstance(b, dict):
        return a.keys() == b.keys() and all(_same(a[key], b[key], tol) for key in a)
    if isinstance(a, _Frame) and isinstance(b, _Frame):
        return len(a.columns) == len(b.columns) and _same(a.rows, b.rows, tol)
    return a == b


def _order(value, mode):
    """Sort what the case says order does not matter for."""
    if mode == "any":
        if isinstance(value, _Frame):
            return _Frame(value.columns, sorted(value.rows, key=_sort_key))
        if isinstance(value, list):
            return sorted(value, key=_sort_key)
    if mode == "nested" and isinstance(value, list):
        inner = [sorted(item, key=_sort_key) if isinstance(item, list) else item for item in value]
        return sorted(inner, key=_sort_key)
    if mode == "rows" and isinstance(value, _Frame):
        return _Frame(value.columns, sorted(value.rows, key=_sort_key))
    return value


def _short(value, limit=160):
    if isinstance(value, _Frame):
        text = "a table with %d rows" % len(value.rows)
    else:
        text = repr(_clip(value))
    return text if len(text) <= limit else text[: limit - 3] + "..."


def _explain(got, expected, tol):
    """One or two sentences that say how the answer differs."""
    if isinstance(expected, _Frame):
        if not isinstance(got, _Frame):
            return "Expected a table, got %s." % _short(got)
        if len(got.columns) != len(expected.columns):
            return "Expected %d columns (%s), got %d (%s)." % (
                len(expected.columns),
                ", ".join(expected.columns),
                len(got.columns),
                ", ".join(got.columns),
            )
        return _explain_rows(got.rows, expected.rows, tol)
    if isinstance(expected, list) and isinstance(got, list):
        if len(got) != len(expected):
            return "Expected %d items, got %d." % (len(expected), len(got))
        for index, (x, y) in enumerate(zip(got, expected)):
            if not _same(x, y, tol):
                return "Item %d differs: expected %s, got %s." % (index, _short(y), _short(x))
    if isinstance(expected, dict) and isinstance(got, dict):
        missing = [key for key in expected if key not in got]
        extra = [key for key in got if key not in expected]
        if missing:
            return "Missing keys: %s." % ", ".join(repr(key) for key in missing[:5])
        if extra:
            return "Unexpected keys: %s." % ", ".join(repr(key) for key in extra[:5])
        for key in expected:
            if not _same(got[key], expected[key], tol):
                return "Key %r: expected %s, got %s." % (key, _short(expected[key]), _short(got[key]))
    return "Expected %s, got %s." % (_short(expected), _short(got))


def _explain_rows(got, expected, tol):
    if len(got) != len(expected):
        return "Expected %d rows, got %d." % (len(expected), len(got))
    for index, (x, y) in enumerate(zip(got, expected)):
        if not _same(x, y, tol):
            return "Row %d differs: expected %s, got %s." % (index + 1, _short(y), _short(x))
    return "The rows differ."


# --------------------------------------------------------------------------
# Display
# --------------------------------------------------------------------------


class _More:
    """Stands in for the items a long value hides, so a display stays fast and short."""

    def __init__(self, count):
        self.count = count

    def __repr__(self):
        return "... %d more" % self.count


def _clip(value, depth=0):
    """A shortened copy of a big list, tuple, set or dict. Formatting a million items takes seconds."""
    if depth > 8:
        return value
    if isinstance(value, (list, tuple)) and type(value) in (list, tuple):
        items = [_clip(item, depth + 1) for item in value[:_MAX_ITEMS]]
        if len(value) > _MAX_ITEMS:
            items.append(_More(len(value) - _MAX_ITEMS))
        return items if type(value) is list else tuple(items)
    if isinstance(value, (set, frozenset)) and len(value) > _MAX_ITEMS:
        items = sorted(value, key=_sort_key)[:_MAX_ITEMS]
        return items + [_More(len(value) - _MAX_ITEMS)]
    if type(value) is dict and len(value) > _MAX_ITEMS:
        clipped = {}
        for index, (key, item) in enumerate(value.items()):
            if index == _MAX_ITEMS:
                break
            clipped[key] = _clip(item, depth + 1)
        clipped["..."] = "%d more" % (len(value) - _MAX_ITEMS)
        return clipped
    return value


def _cell(value):
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, float):
        if value == int(value) and abs(value) < 1e15:
            return "%.1f" % value
        return repr(round(value, 6))
    if isinstance(value, (list, dict)):
        return _json.dumps(value, default=str)
    return str(value)


def _display(value, raw=_MISSING):
    if value is _MISSING:
        return None
    if isinstance(value, _Frame):
        return {
            "kind": "table",
            "columns": value.columns,
            "rows": [[_cell(item) for item in row] for row in value.rows[:_MAX_ROWS]],
            "total": len(value.rows),
        }
    shown = _clip(raw if raw is not _MISSING else value)
    try:
        text = _pprint.pformat(shown, width=64, sort_dicts=False)
    except Exception:  # noqa: BLE001 - a display must not fail the run
        text = repr(shown)
    if len(text) > 6000:
        text = text[:6000] + "\n..."
    return {"kind": "text", "text": text}


# --------------------------------------------------------------------------
# Running
# --------------------------------------------------------------------------


def _format_error(error, label):
    lineno = None
    if isinstance(error, SyntaxError) and error.filename == label:
        lineno = error.lineno
        detail = "%s: %s" % (type(error).__name__, error.msg)
    else:
        frames = _traceback.extract_tb(error.__traceback__)
        for frame in frames:
            if frame.filename == label:
                lineno = frame.lineno
        message = str(error)
        detail = "%s: %s" % (type(error).__name__, message) if message else type(error).__name__
        name = getattr(error, "name", None)
        if isinstance(error, NameError) and name and frames and frames[-1].filename == "<check>":
            detail = (
                "The tests call %s, but your code does not define it. "
                "Keep the name from the starter code." % name
            )
    if len(detail) > 1500:
        detail = detail[:1500] + "..."
    return {"message": detail, "line": lineno}


def _install_modules(modules):
    """Puts the fake libraries a job lists in sys.modules, and takes out the others.

    One worker runs every problem of a visit. Without the take-out, a fake
    library that one problem lists would answer an import in the next problem,
    so the result of a run would depend on the problems run before it.
    """
    wanted = set(modules or [])
    for loaded in list(_sys.modules):
        root = loaded.split(".")[0]
        if root in _MODULE_SOURCES and root not in wanted:
            if getattr(_sys.modules[loaded], "__sandbox__", False):
                del _sys.modules[loaded]
    for name in modules or []:
        source = _MODULE_SOURCES.get(name)
        if source is None:
            continue
        if name in _sys.modules and getattr(_sys.modules[name], "__sandbox__", False):
            continue
        module = _types.ModuleType(name)
        module.__sandbox__ = True
        _sys.modules[name] = module
        exec(compile(source, "<%s>" % name, "exec"), module.__dict__)


_MODULE_SOURCES = {}


def register_module(name, source):
    """The worker registers fake libraries (prefect, airflow, pytest) before a run."""
    _MODULE_SOURCES[name] = source
    _sys.modules.pop(name, None)


def _check_names(check):
    """The names a check expression reads."""
    try:
        tree = _ast.parse(check, mode="eval")
    except SyntaxError:
        return set()
    return {node.id for node in _ast.walk(tree) if isinstance(node, _ast.Name)}


def _copy_data(value):
    """A deep copy of plain test data, quick for the flat lists and grids most tests use."""
    if type(value) is list:
        if all(type(item) in _ATOMS for item in value):
            return list(value)
        if all(type(row) is list and all(type(item) in _ATOMS for item in row) for row in value):
            return [list(row) for row in value]
    if (_is_frame(value) or _is_series(value)) and not hasattr(value, "sparkSession"):
        return value.copy(deep=True)
    if isinstance(value, (list, dict, set, tuple, bytearray)):
        return _copy.deepcopy(value)
    return _MISSING


def _save_inputs(namespace, check):
    """Copies of the data a check reads, taken before the learner's code can change it."""
    saved = {}
    for name in _check_names(check):
        if name not in namespace:
            continue
        try:
            copy = _copy_data(namespace[name])
        except Exception:  # noqa: BLE001 - data that will not copy is left as it is
            continue
        if copy is not _MISSING:
            saved[name] = copy
    return saved


def _evaluate(source, label, language, case):
    """Run one program against one case. Returns (canonical, raw, stdout, error, seconds)."""
    if language == "pyspark":
        import pyspark_shim

        pyspark_shim._reset()
    namespace = {"__name__": "__main__", "verdict": verdict, "Verdict": Verdict}
    output = _CappedOutput()
    value, raw, error, elapsed = _MISSING, _MISSING, None, 0.0
    try:
        with _contextlib.redirect_stdout(output), _contextlib.redirect_stderr(output):
            exec(compile(case.get("prelude") or "", "<setup>", "exec"), namespace)
            if case.get("setup"):
                exec(compile(case["setup"], "<setup>", "exec"), namespace)
            check = case.get("check") or ""
            inputs = _save_inputs(namespace, check) if check else {}
            _linecache.cache[label] = (len(source), None, source.splitlines(True), label)
            started = _time.perf_counter()
            try:
                exec(compile(source, label, "exec"), namespace)
                namespace.update(inputs)
                if check:
                    raw = eval(compile(check, "<check>", "eval"), namespace)
                else:
                    raw = namespace.get("result", _MISSING)
            finally:
                elapsed = _time.perf_counter() - started
            # Turning a big result into plain data takes time that is not the learner's.
            if raw is not _MISSING and not isinstance(raw, Verdict):
                value = _canon(raw)
            elif isinstance(raw, Verdict):
                value = raw
    except SystemExit:
        error = {"message": "Your code called exit(). Remove it and return a value instead.", "line": None}
    except RecursionError:
        error = {"message": "RecursionError: the recursion went too deep. Use a loop or an explicit stack.", "line": None}
    except BaseException as caught:  # noqa: BLE001 - every learner error is reported, not raised
        error = _format_error(caught, label)
    return value, raw, output.getvalue(), error, elapsed


def _expected(job, index, case):
    key = (job.get("key"), index)
    if key in _EXPECTED:
        return _EXPECTED[key]
    value, raw, stdout, error, elapsed = _evaluate(job["solution"], "<solution>", job["language"], case)
    result = (value, raw, error)
    if error is None:
        _EXPECTED[key] = result
    return result


def _run_case(job, index, case):
    if job.get("violation"):
        # The code breaks a rule of the spec, such as a banned loop: no case runs.
        return {
            "name": case.get("name", "Case %d" % (index + 1)),
            "note": case.get("note") or "",
            "hidden": bool(case.get("hidden")),
            "stdout": "",
            "ms": 0,
            "passed": False,
            "message": job["violation"],
        }
    mode = case.get("order") or ("any" if job["language"] == "pyspark" else "exact")
    tol = float(case.get("tolerance") or 1e-6)
    value, raw, stdout, error, elapsed = _evaluate(job["code"], "<code>", job["language"], case)
    out = {
        "name": case.get("name", "Case %d" % (index + 1)),
        "note": case.get("note") or "",
        "hidden": bool(case.get("hidden")),
        "stdout": stdout,
        "ms": round(elapsed * 1000, 1),
    }
    if error is not None:
        out.update(passed=False, error=error, message=error["message"])
        return out
    limit = case.get("limitS")
    if limit and elapsed > float(limit):
        out.update(
            passed=False,
            message="Too slow: this test took %.2f s and the limit is %.2f s. %s"
            % (elapsed, float(limit), case.get("slowHint") or "Look for a faster algorithm."),
        )
        return out
    if isinstance(value, Verdict):
        out.update(passed=value.passed, message=value.message)
        return out
    expected, expected_raw, expected_error = _expected(job, index, case)
    if expected_error is not None:
        out.update(
            passed=False,
            message="The reference solution failed on this case: %s" % expected_error["message"],
        )
        return out
    if isinstance(expected, Verdict):
        expected = _MISSING
    out["got"] = _display(_order(value, mode) if value is not _MISSING else value, raw if not isinstance(value, _Frame) else _MISSING) if value is not _MISSING else None
    out["expected"] = _display(_order(expected, mode), expected_raw if not isinstance(expected, _Frame) else _MISSING) if expected is not _MISSING else None
    if value is _MISSING:
        target = case.get("check") or "result"
        out.update(
            passed=False,
            message="Nothing to check yet. %s"
            % (
                "Assign your answer to `result`."
                if target == "result"
                else "Define what `%s` needs." % target
            ),
        )
        return out
    left, right = _order(value, mode), _order(expected, mode)
    passed = _same(left, right, tol)
    out["passed"] = passed
    out["message"] = "" if passed else _explain(left, right, tol)
    return out


def run_job(job_text, emit=None):
    job = _json.loads(job_text)
    _install_modules(job.get("modules"))
    cases = job["cases"]
    if job.get("action") == "run":
        cases = cases[:1]
    results = []
    for index, case in enumerate(cases):
        result = _run_case(job, index, case)
        results.append(result)
        if emit is not None:
            emit(_json.dumps({"type": "case", "index": index, "result": result}))
    return _json.dumps({"cases": results})


def clear_expected():
    _EXPECTED.clear()
