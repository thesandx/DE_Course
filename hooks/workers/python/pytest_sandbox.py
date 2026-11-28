"""pytest look-alike for the browser sandbox.

It runs the tests a learner writes in a "write the tests" problem: test
functions and Test classes, plain assert, raises, approx, fail, skip,
fixtures (a yield fixture tears down), mark.parametrize, and the
monkeypatch, tmp_path and capsys fixtures. Only these parts of pytest are
here.

A test is a function of the learner's program whose name starts with
"test", or a method of a class whose name starts with "Test". Functions that
the problem's own setup defines are not tests.

A spec's helpers call run_tests(namespace) to run the tests and read the
outcomes. The learner calls main() to print a report, as pytest would.
"""

import ast as _ast
import collections as _collections
import contextlib as _contextlib
import importlib as _importlib
import inspect as _inspect
import io as _io
import itertools as _itertools
import linecache as _linecache
import math as _math
import os as _os
import pathlib as _pathlib
import re as _re
import sys as _sys
import tempfile as _tempfile
import time as _time

__sandbox__ = True
__version__ = "8.3.0"

_NOTSET = object()
_SETUP_FILES = ("<setup>",)


# --------------------------------------------------------------------------
# Outcomes
# --------------------------------------------------------------------------


class Failed(AssertionError):
    """What pytest.fail() and a raises() block that did not raise report."""


class Skipped(Exception):
    """What pytest.skip() raises."""


class FixtureLookupError(LookupError):
    pass


def fail(reason="", pytrace=True):
    raise Failed(reason)


def skip(reason="", allow_module_level=False):
    raise Skipped(reason)


# --------------------------------------------------------------------------
# raises
# --------------------------------------------------------------------------


class ExceptionInfo:
    def __init__(self):
        self.type = None
        self.value = None
        self.tb = None

    @property
    def typename(self):
        return self.type.__name__ if self.type else ""

    def match(self, pattern):
        text = str(self.value)
        if not _re.search(pattern, text):
            raise AssertionError("Regex pattern %r did not match %r." % (pattern, text))
        return True

    def __repr__(self):
        return "<ExceptionInfo %r>" % (self.value,)


def _exception_names(expected):
    if isinstance(expected, tuple):
        return " or ".join(getattr(item, "__name__", repr(item)) for item in expected)
    return getattr(expected, "__name__", repr(expected))


def _check_exception_type(expected):
    items = expected if isinstance(expected, tuple) else (expected,)
    for item in items:
        if not (isinstance(item, type) and issubclass(item, BaseException)):
            raise TypeError(
                "pytest.raises takes an exception class, such as ValueError, not %r." % (item,)
            )


class RaisesContext:
    def __init__(self, expected, match):
        _check_exception_type(expected)
        self.expected = expected
        self.match_expr = match
        self.excinfo = ExceptionInfo()

    def __enter__(self):
        return self.excinfo

    def __exit__(self, kind, value, traceback):
        if kind is None:
            raise Failed("DID NOT RAISE %s" % _exception_names(self.expected))
        if not issubclass(kind, self.expected):
            return False
        self.excinfo.type, self.excinfo.value, self.excinfo.tb = kind, value, traceback
        if self.match_expr is not None:
            self.excinfo.match(self.match_expr)
        return True


def raises(expected_exception, *args, match=None, **kwargs):
    if not args:
        return RaisesContext(expected_exception, match)
    func = args[0]
    with RaisesContext(expected_exception, match) as excinfo:
        func(*args[1:], **kwargs)
    return excinfo


# --------------------------------------------------------------------------
# approx
# --------------------------------------------------------------------------


def _number(value):
    return isinstance(value, (int, float, complex)) and not isinstance(value, bool)


def _close(actual, expected, rel, abs_):
    if not (_number(actual) and _number(expected)):
        if type(expected).__module__.startswith(("numpy", "decimal")):
            try:
                expected = float(expected)
            except (TypeError, ValueError):
                return actual == expected
        if type(actual).__module__.startswith(("numpy", "decimal")):
            try:
                actual = float(actual)
            except (TypeError, ValueError):
                return actual == expected
        if not (_number(actual) and _number(expected)):
            return actual == expected
    if actual == expected:
        return True
    if isinstance(expected, float) and (_math.isinf(expected) or _math.isnan(expected)):
        return False
    absolute = 1e-12 if abs_ is None else abs_
    if rel is None and abs_ is not None:
        tolerance = absolute
    else:
        tolerance = max((1e-6 if rel is None else rel) * abs(expected), absolute)
    return abs(actual - expected) <= tolerance


def _approx_equal(actual, expected, rel, abs_):
    if isinstance(expected, dict):
        if not isinstance(actual, dict) or actual.keys() != expected.keys():
            return False
        return all(_approx_equal(actual[key], expected[key], rel, abs_) for key in expected)
    if isinstance(expected, (list, tuple)):
        if hasattr(actual, "tolist"):
            actual = actual.tolist()
        if not isinstance(actual, (list, tuple)) or len(actual) != len(expected):
            return False
        return all(_approx_equal(a, e, rel, abs_) for a, e in zip(actual, expected))
    return _close(actual, expected, rel, abs_)


class ApproxBase:
    __hash__ = None

    def __init__(self, expected, rel=None, abs=None, nan_ok=False):  # noqa: A002 - pytest's names
        if hasattr(expected, "tolist"):
            expected = expected.tolist()
        self.expected = expected
        self.rel = rel
        self.abs = abs

    def __eq__(self, actual):
        return _approx_equal(actual, self.expected, self.rel, self.abs)

    def __ne__(self, actual):
        return not self.__eq__(actual)

    def __repr__(self):
        return "approx(%r)" % (self.expected,)


def approx(expected, rel=None, abs=None, nan_ok=False):  # noqa: A002 - pytest's names
    return ApproxBase(expected, rel=rel, abs=abs, nan_ok=nan_ok)


# --------------------------------------------------------------------------
# Marks, parametrize and fixtures
# --------------------------------------------------------------------------


class ParameterSet:
    def __init__(self, values, id=None, marks=()):  # noqa: A002 - pytest's names
        self.values = values
        self.id = id
        self.marks = marks


def param(*values, id=None, marks=()):  # noqa: A002 - pytest's names
    return ParameterSet(values, id, marks)


class Mark:
    def __init__(self, name, args, kwargs):
        self.name = name
        self.args = args
        self.kwargs = kwargs


def _add_mark(target, mark):
    marks = list(getattr(target, "pytestmark", []))
    marks.append(mark)
    target.pytestmark = marks
    return target


class MarkDecorator:
    def __init__(self, name):
        self.name = name

    def __call__(self, *args, **kwargs):
        bare = len(args) == 1 and not kwargs and (_inspect.isfunction(args[0]) or _inspect.isclass(args[0]))
        if bare and self.name not in ("parametrize", "skipif"):
            return _add_mark(args[0], Mark(self.name, (), {}))
        if self.name == "parametrize" and len(args) >= 2:
            args = (args[0], list(args[1])) + tuple(args[2:])
        mark = Mark(self.name, args, kwargs)
        return lambda target: _add_mark(target, mark)


class MarkGenerator:
    def __getattr__(self, name):
        if name.startswith("_"):
            raise AttributeError(name)
        return MarkDecorator(name)


mark = MarkGenerator()


def fixture(function=None, *, scope="function", params=None, autouse=False, ids=None, name=None):
    def wrap(func):
        func._sandbox_fixture = {"name": name or func.__name__, "autouse": autouse}
        return func

    if function is not None and callable(function):
        return wrap(function)
    return wrap


def yield_fixture(*args, **kwargs):
    return fixture(*args, **kwargs)


class MonkeyPatch:
    """Records each change and undoes it after the test, newest first."""

    def __init__(self):
        self._undo = []

    @staticmethod
    def _resolve(dotted):
        parts = dotted.split(".")
        for cut in range(len(parts) - 1, 0, -1):
            try:
                target = _importlib.import_module(".".join(parts[:cut]))
            except ImportError:
                continue
            for part in parts[cut:-1]:
                target = getattr(target, part)
            return target, parts[-1]
        raise ImportError("monkeypatch could not import %r." % dotted)

    def setattr(self, target, name, value=_NOTSET, raising=True):
        if value is _NOTSET:
            if not isinstance(target, str):
                raise TypeError("Use monkeypatch.setattr(object, 'name', value) or setattr('module.name', value).")
            value = name
            target, name = self._resolve(target)
        old = getattr(target, name, _NOTSET)
        if raising and old is _NOTSET:
            raise AttributeError("%r has no attribute %r" % (target, name))
        if _inspect.isclass(target):
            old = target.__dict__.get(name, _NOTSET)
        self._undo.append(("attr", target, name, old))
        setattr(target, name, value)

    def delattr(self, target, name=_NOTSET, raising=True):
        if name is _NOTSET:
            target, name = self._resolve(target)
        if not hasattr(target, name):
            if raising:
                raise AttributeError(name)
            return
        self._undo.append(("attr", target, name, getattr(target, name)))
        delattr(target, name)

    def setitem(self, mapping, key, value):
        self._undo.append(("item", mapping, key, mapping.get(key, _NOTSET)))
        mapping[key] = value

    def delitem(self, mapping, key, raising=True):
        if key not in mapping:
            if raising:
                raise KeyError(key)
            return
        self._undo.append(("item", mapping, key, mapping[key]))
        del mapping[key]

    def setenv(self, name, value, prepend=None):
        value = str(value)
        if prepend and name in _os.environ:
            value = value + prepend + _os.environ[name]
        self.setitem(_os.environ, name, value)

    def delenv(self, name, raising=True):
        self.delitem(_os.environ, name, raising=raising)

    def chdir(self, path):
        self._undo.append(("cwd", None, None, _os.getcwd()))
        _os.chdir(path)

    def syspath_prepend(self, path):
        self._undo.append(("path", None, None, list(_sys.path)))
        _sys.path.insert(0, str(path))

    @_contextlib.contextmanager
    def context(self):
        patch = MonkeyPatch()
        try:
            yield patch
        finally:
            patch.undo()

    def undo(self):
        for kind, target, name, old in reversed(self._undo):
            if kind == "attr":
                if old is _NOTSET:
                    try:
                        delattr(target, name)
                    except AttributeError:
                        pass
                else:
                    setattr(target, name, old)
            elif kind == "item":
                if old is _NOTSET:
                    target.pop(name, None)
                else:
                    target[name] = old
            elif kind == "cwd":
                _os.chdir(old)
            elif kind == "path":
                _sys.path[:] = old
        self._undo.clear()


CaptureResult = _collections.namedtuple("CaptureResult", ["out", "err"])


class CaptureFixture:
    def __init__(self):
        self._out = _io.StringIO()
        self._err = _io.StringIO()

    def readouterr(self):
        result = CaptureResult(self._out.getvalue(), self._err.getvalue())
        for stream in (self._out, self._err):
            stream.seek(0)
            stream.truncate()
        return result


class FixtureRequest:
    def __init__(self, item):
        self.node = item
        self.function = item.function
        self.param = None

    def getfixturevalue(self, name):
        return self.node._value(name)


# --------------------------------------------------------------------------
# Collecting tests
# --------------------------------------------------------------------------


class _Outcome:
    def __init__(self, name, outcome, message=""):
        self.name = name
        self.outcome = outcome
        self.message = message

    @property
    def passed(self):
        return self.outcome == "passed"

    def __repr__(self):
        return "<%s %s>" % (self.name, self.outcome)


def _param_id(value, name, index):
    if value is None or isinstance(value, (bool, int, float, str)):
        text = str(value)
        return text if len(text) <= 30 else "%s%d" % (name, index)
    return "%s%d" % (name, index)


def _expand(marks):
    """The parameter sets of a test: one empty set when it has no parametrize."""
    sets = [({}, [])]
    for mark in marks:
        if mark.name != "parametrize":
            continue
        if len(mark.args) < 2:
            raise TypeError("parametrize takes the argument names and a list of values.")
        names, values = mark.args[0], mark.args[1]
        ids = mark.kwargs.get("ids")
        if isinstance(names, str):
            names = [part.strip() for part in names.split(",") if part.strip()]
        names = list(names)
        options = []
        for index, value in enumerate(values):
            label = None
            if isinstance(value, ParameterSet):
                label, value = value.id, value.values
                if len(names) == 1:
                    value = value[0] if len(value) == 1 else value
            if len(names) == 1:
                bound = {names[0]: value}
            else:
                if len(value) != len(names):
                    raise TypeError(
                        "parametrize: %d names but a value has %d items." % (len(names), len(value))
                    )
                bound = dict(zip(names, value))
            if label is None and isinstance(ids, (list, tuple)) and index < len(ids):
                label = str(ids[index])
            if label is None and callable(ids):
                label = str(ids(value))
            if label is None:
                label = "-".join(_param_id(bound[name], name, index) for name in names)
            options.append((bound, label))
        sets = [
            ({**old_bound, **bound}, old_labels + [label])
            for (bound, label), (old_bound, old_labels) in _itertools.product(options, sets)
        ]
    return sets


def _skip_reason(marks):
    for mark in marks:
        if mark.name == "skip":
            return mark.kwargs.get("reason") or (mark.args[0] if mark.args else "skipped")
        if mark.name == "skipif":
            condition = mark.args[0] if mark.args else mark.kwargs.get("condition", False)
            if condition:
                return mark.kwargs.get("reason") or "skipped"
    return None


class _Item:
    def __init__(self, name, function, params, owner, fixtures):
        self.name = name
        self.function = function
        self.params = params
        self.owner = owner
        self.fixtures = fixtures
        self._cache = {}
        self._teardowns = []
        self._resolving = set()
        self.capture = None

    def _value(self, name):
        if name in self.params:
            return self.params[name]
        if name in self._cache:
            return self._cache[name]
        if name in self._resolving:
            raise FixtureLookupError("Fixture %r depends on itself." % name)
        self._resolving.add(name)
        try:
            value = self._make(name)
        finally:
            self._resolving.discard(name)
        self._cache[name] = value
        return value

    def _make(self, name):
        if name == "monkeypatch":
            patch = MonkeyPatch()
            self._teardowns.append(patch.undo)
            return patch
        if name == "tmp_path":
            return _pathlib.Path(_tempfile.mkdtemp(prefix="pytest-"))
        if name == "tmpdir":
            return _tempfile.mkdtemp(prefix="pytest-")
        if name in ("capsys", "capfd"):
            self.capture = CaptureFixture()
            return self.capture
        if name == "request":
            return FixtureRequest(self)
        func = self.fixtures.get(name)
        if func is None:
            raise FixtureLookupError(
                "fixture %r not found. Define it with @pytest.fixture, or use monkeypatch, "
                "tmp_path or capsys." % name
            )
        kwargs = {arg: self._value(arg) for arg in _arg_names(func)}
        if _inspect.isgeneratorfunction(func):
            generator = func(**kwargs)
            value = next(generator)
            self._teardowns.append(lambda: next(generator, None))
            return value
        return func(**kwargs)

    def teardown(self):
        errors = []
        while self._teardowns:
            step = self._teardowns.pop()
            try:
                step()
            except Exception as error:  # noqa: BLE001 - a teardown failure is reported, not raised
                errors.append(error)
        return errors


def _arg_names(func):
    try:
        signature = _inspect.signature(func)
    except (TypeError, ValueError):
        return []
    names = []
    for parameter in signature.parameters.values():
        if parameter.kind in (parameter.VAR_POSITIONAL, parameter.VAR_KEYWORD):
            continue
        if parameter.default is not parameter.empty:
            continue
        names.append(parameter.name)
    return names


def _is_learner_function(value, namespace):
    return (
        _inspect.isfunction(value)
        and value.__globals__ is namespace
        and value.__code__.co_filename not in _SETUP_FILES
    )


def _collect(namespace):
    fixtures = {}
    for value in list(namespace.values()):
        info = getattr(value, "_sandbox_fixture", None)
        if info is not None and _inspect.isfunction(value):
            fixtures[info["name"]] = value
    autouse = [name for name, func in fixtures.items() if func._sandbox_fixture["autouse"]]
    items = []
    for name, value in list(namespace.items()):
        if name.startswith("test") and _is_learner_function(value, namespace):
            if getattr(value, "_sandbox_fixture", None) is None:
                items.extend(_items_for(name, value, None, fixtures))
        elif name.startswith("Test") and _inspect.isclass(value) and "__init__" not in vars(value):
            for method_name, method in vars(value).items():
                if method_name.startswith("test") and _is_learner_function(method, namespace):
                    items.extend(_items_for("%s.%s" % (name, method_name), method, value, fixtures))
    return items, autouse


def _items_for(name, function, owner, fixtures):
    marks = list(getattr(function, "pytestmark", [])) + list(getattr(owner, "pytestmark", []) if owner else [])
    items = []
    for params, labels in _expand(marks):
        label = "%s[%s]" % (name, "-".join(labels)) if labels else name
        item = _Item(label, function, params, owner, fixtures)
        item.skip = _skip_reason(marks)
        items.append(item)
    return items


# --------------------------------------------------------------------------
# Running tests
# --------------------------------------------------------------------------


def _short(value, limit=120):
    try:
        text = repr(value)
    except Exception:  # noqa: BLE001 - a broken repr must not break the report
        text = "<%s>" % type(value).__name__
    return text if len(text) <= limit else text[: limit - 3] + "..."


def _innermost(error, filename):
    """The deepest traceback entry in the test's own file."""
    found = None
    entry = error.__traceback__
    while entry is not None:
        if entry.tb_frame.f_code.co_filename == filename:
            found = entry
        entry = entry.tb_next
    return found


def _explain_assert(entry, filename):
    """The values on both sides of a failed "assert a == b", as pytest shows them."""
    line = _linecache.getline(filename, entry.tb_lineno).strip()
    try:
        tree = _ast.parse(line)
    except SyntaxError:
        return line, ""
    node = tree.body[0] if tree.body else None
    if not isinstance(node, _ast.Assert) or not isinstance(node.test, _ast.Compare):
        return line, ""
    if len(node.test.ops) != 1:
        return line, ""
    frame = entry.tb_frame
    sides = []
    for part in (node.test.left, node.test.comparators[0]):
        if isinstance(part, _ast.Constant):
            sides.append(None)
            continue
        expression = _ast.fix_missing_locations(_ast.Expression(part))
        try:
            value = eval(compile(expression, filename, "eval"), frame.f_globals, dict(frame.f_locals))
        except Exception:  # noqa: BLE001 - the explanation is best effort
            return line, ""
        sides.append(value)
    notes = []
    if sides[0] is not None:
        notes.append("the left side is %s" % _short(sides[0]))
    if sides[1] is not None:
        notes.append("the right side is %s" % _short(sides[1]))
    return line, " and ".join(notes)


def _describe(error, filename):
    entry = _innermost(error, filename)
    where = "line %d: " % entry.tb_lineno if entry is not None else ""
    if isinstance(error, Failed):
        return "%s%s" % (where, str(error) or "failed")
    if isinstance(error, AssertionError):
        if entry is None:
            return "assertion failed: %s" % (str(error) or "no message")
        line, values = _explain_assert(entry, filename)
        text = "%s%s" % (where, line or "assert failed")
        if str(error):
            text += " (%s)" % str(error)
        if values:
            text += ": %s" % values
        return text
    message = str(error)
    kind = type(error).__name__
    return "%s%s%s" % (where, kind, ": %s" % message if message else "")


def _run_item(item, autouse):
    if getattr(item, "skip", None):
        return _Outcome(item.name, "skipped", str(item.skip))
    filename = item.function.__code__.co_filename
    try:
        try:
            for name in autouse:
                item._value(name)
            names = _arg_names(item.function)
            if item.owner is not None:
                names = names[1:]
            kwargs = {name: item._value(name) for name in names}
            if item.owner is not None:
                instance = item.owner()
                setup = getattr(instance, "setup_method", None)
                if callable(setup):
                    setup(item.function)
                call = lambda: item.function(instance, **kwargs)  # noqa: E731 - one-line call
            else:
                call = lambda: item.function(**kwargs)  # noqa: E731 - one-line call
            if item.capture is not None:
                with _contextlib.redirect_stdout(item.capture._out), _contextlib.redirect_stderr(item.capture._err):
                    call()
            else:
                call()
            if item.owner is not None:
                teardown = getattr(instance, "teardown_method", None)
                if callable(teardown):
                    teardown(item.function)
        finally:
            errors = item.teardown()
        if errors:
            return _Outcome(item.name, "failed", "teardown: %s" % _describe(errors[0], filename))
        return _Outcome(item.name, "passed")
    except Skipped as error:
        return _Outcome(item.name, "skipped", str(error))
    except FixtureLookupError as error:
        return _Outcome(item.name, "failed", str(error))
    except (KeyboardInterrupt, MemoryError):
        raise
    except BaseException as error:  # noqa: BLE001 - every test failure is reported
        return _Outcome(item.name, "failed", _describe(error, filename))


def run_tests(namespace):
    """Run the tests defined in a program's namespace. Returns one outcome per test."""
    items, autouse = _collect(namespace)
    return [_run_item(item, autouse) for item in items]


def _report(outcomes, seconds):
    lines = ["collected %d item%s" % (len(outcomes), "" if len(outcomes) == 1 else "s"), ""]
    for outcome in outcomes:
        lines.append("%s %s" % (outcome.name, outcome.outcome.upper()))
    failures = [outcome for outcome in outcomes if outcome.outcome == "failed"]
    if failures:
        lines.extend(["", "FAILURES"])
        for outcome in failures:
            lines.append("%s: %s" % (outcome.name, outcome.message))
    counts = _collections.Counter(outcome.outcome for outcome in outcomes)
    summary = ", ".join("%d %s" % (counts[kind], kind) for kind in ("failed", "passed", "skipped") if counts[kind])
    lines.extend(["", "%s in %.2fs" % (summary or "no tests ran", seconds)])
    return "\n".join(lines)


def main(args=None, plugins=None):
    """Run the tests of the program that calls it and print a report. Returns pytest's exit code."""
    namespace = _sys._getframe(1).f_globals
    started = _time.perf_counter()
    outcomes = run_tests(namespace)
    print(_report(outcomes, _time.perf_counter() - started))
    if not outcomes:
        return 5
    return 1 if any(outcome.outcome == "failed" for outcome in outcomes) else 0
