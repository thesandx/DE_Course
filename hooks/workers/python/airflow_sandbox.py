"""Airflow look-alike for the browser sandbox.

It runs the hooks and operators a learner writes in an orchestration problem:
BaseHook with connections, BaseOperator with template_fields and execute,
the {{ ... }} templates of the task context, and a small DAG with >> and <<.
Only these parts of Airflow 3 are here. The Airflow 2 import paths
(airflow.models, airflow.hooks.base) give the same classes.

A check sets the connections with _sandbox.add_connection(), builds a context
with _sandbox.context(ds), and runs a task with _sandbox.run(operator,
context): it renders the template fields and calls execute(), as a worker
does.
"""

import datetime as _datetime
import json as _json
import re as _re
import sys as _sys
import types as _types

__sandbox__ = True
__version__ = "3.0.2"


# --------------------------------------------------------------------------
# Exceptions
# --------------------------------------------------------------------------


class AirflowException(Exception):
    pass


class AirflowNotFoundException(AirflowException):
    pass


class AirflowSkipException(AirflowException):
    pass


class AirflowFailException(AirflowException):
    pass


class AirflowTaskTimeout(AirflowException):
    pass


class UndefinedError(AirflowException):
    """What Jinja raises for a name the context does not have."""


# --------------------------------------------------------------------------
# Connections and variables
# --------------------------------------------------------------------------


class Connection:
    def __init__(self, conn_id, conn_type="http", host=None, login=None, password=None, schema=None, port=None, extra=None, description=None):
        self.conn_id = conn_id
        self.conn_type = conn_type
        self.host = host
        self.login = login
        self.password = password
        self.schema = schema
        self.port = port
        self.description = description
        self.extra = extra if isinstance(extra, str) or extra is None else _json.dumps(extra)

    @property
    def extra_dejson(self):
        return _json.loads(self.extra) if self.extra else {}

    def get_uri(self):
        auth = ""
        if self.login or self.password:
            auth = "%s:%s@" % (self.login or "", "***" if self.password else "")
        port = ":%s" % self.port if self.port else ""
        return "%s://%s%s%s/%s" % (self.conn_type, auth, self.host or "", port, self.schema or "")

    def __repr__(self):
        return "Connection(conn_id=%r, host=%r)" % (self.conn_id, self.host)

    @classmethod
    def get(cls, conn_id):
        return _sandbox.connection(conn_id)


_NOTHING = object()


class Variable:
    @staticmethod
    def get(key, default=_NOTHING, deserialize_json=False):
        if key not in _sandbox.variables:
            if default is _NOTHING:
                raise KeyError("Variable %s does not exist" % key)
            return default
        value = _sandbox.variables[key]
        return _json.loads(value) if deserialize_json else value

    @staticmethod
    def set(key, value, serialize_json=False):
        _sandbox.variables[key] = _json.dumps(value) if serialize_json else value


# --------------------------------------------------------------------------
# Logging
# --------------------------------------------------------------------------


class _TaskLogger:
    def _log(self, level, message, *args):
        text = message % args if args else str(message)
        print("[%s] %s" % (level, text))

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


class LoggingMixin:
    @property
    def log(self):
        return _TaskLogger()


# --------------------------------------------------------------------------
# Templates
# --------------------------------------------------------------------------

_TEMPLATE = _re.compile(r"\{\{\s*(.*?)\s*\}\}", _re.S)


def _as_date(value):
    if isinstance(value, _datetime.datetime):
        return value.date()
    return value


_FILTERS = {
    "ds": lambda value: _as_date(value).isoformat(),
    "ds_nodash": lambda value: _as_date(value).isoformat().replace("-", ""),
    "ts": lambda value: value.isoformat(),
    "upper": lambda value: str(value).upper(),
    "lower": lambda value: str(value).lower(),
    "string": str,
    "int": int,
    "tojson": _json.dumps,
}


class _Names(dict):
    def __missing__(self, key):
        raise UndefinedError("'%s' is undefined" % key)


def _render_text(text, context):
    if "{%" in text:
        raise AirflowException(
            "This sandbox renders {{ ... }} expressions only, not {% ... %} blocks: %s" % text
        )

    def replace(match):
        expression, *filters = [part.strip() for part in match.group(1).split("|")]
        try:
            value = eval(expression, {"__builtins__": {}}, _Names(context))  # noqa: S307 - templates of the learner's own DAG
        except UndefinedError:
            raise
        except Exception as error:  # noqa: BLE001 - shown to the learner as a template error
            raise AirflowException("Cannot render {{ %s }}: %s" % (match.group(1), error)) from None
        for name in filters:
            name = name.split("(")[0].strip()
            if name not in _FILTERS:
                raise AirflowException("This sandbox has no template filter %r." % name)
            value = _FILTERS[name](value)
        return str(value)

    return _TEMPLATE.sub(replace, text)


def render_template(content, context):
    if isinstance(content, str):
        return _render_text(content, context)
    if isinstance(content, (list, tuple, set)):
        return type(content)(render_template(item, context) for item in content)
    if isinstance(content, dict):
        return {key: render_template(value, context) for key, value in content.items()}
    return content


class _Macros:
    datetime = _datetime.datetime
    timedelta = _datetime.timedelta
    json = _json

    @staticmethod
    def ds_add(ds, days):
        day = _datetime.date.fromisoformat(ds) + _datetime.timedelta(days=days)
        return day.isoformat()

    @staticmethod
    def ds_format(ds, input_format, output_format):
        return _datetime.datetime.strptime(ds, input_format).strftime(output_format)


# --------------------------------------------------------------------------
# DAGs
# --------------------------------------------------------------------------


class DAG:
    def __init__(self, dag_id, schedule=None, start_date=None, catchup=False, default_args=None, tags=None, **kwargs):
        self.dag_id = dag_id
        self.schedule = schedule
        self.start_date = start_date
        self.catchup = catchup
        self.default_args = dict(default_args or {})
        self.tags = list(tags or [])
        self.task_dict = {}

    @property
    def tasks(self):
        return list(self.task_dict.values())

    def get_task(self, task_id):
        return self.task_dict[task_id]

    def __enter__(self):
        _sandbox.dag_stack.append(self)
        return self

    def __exit__(self, *exc):
        _sandbox.dag_stack.pop()
        _sandbox.dags[self.dag_id] = self
        return False

    def test(self, *args, **kwargs):
        raise NotImplementedError("dag.test() needs a scheduler. A check runs one task at a time here.")


def dag(dag_id=None, **dag_kwargs):
    def decorate(function):
        def build(*args, **kwargs):
            with DAG(dag_id or function.__name__, **dag_kwargs) as made:
                function(*args, **kwargs)
            return made

        build.__name__ = function.__name__
        return build

    if callable(dag_id):
        function, dag_id = dag_id, None
        return decorate(function)
    return decorate


def task(python_callable=None, **kwargs):
    """TaskFlow tasks run at once here: the sandbox has no scheduler."""

    def decorate(function):
        function.override = lambda **options: function
        return function

    if callable(python_callable):
        return decorate(python_callable)
    return decorate


# --------------------------------------------------------------------------
# Hooks and operators
# --------------------------------------------------------------------------


class BaseHook(LoggingMixin):
    conn_name_attr = "conn_id"
    default_conn_name = "default_conn_id"

    def __init__(self, logger_name=None, *args, **kwargs):
        pass

    @classmethod
    def get_connection(cls, conn_id):
        return _sandbox.connection(conn_id)

    def get_conn(self):
        raise NotImplementedError("%s does not define get_conn()." % type(self).__name__)


_OPERATOR_ARGS = frozenset(
    """task_id owner email email_on_retry email_on_failure retries retry_delay
    retry_exponential_backoff max_retry_delay start_date end_date depends_on_past
    wait_for_downstream dag params default_args priority_weight weight_rule queue pool
    pool_slots execution_timeout on_execute_callback on_failure_callback on_success_callback
    on_retry_callback on_skipped_callback trigger_rule resources run_as_user task_group
    max_active_tis_per_dag max_active_tis_per_dagrun executor_config do_xcom_push
    multiple_outputs inlets outlets doc doc_md doc_json doc_yaml doc_rst map_index_template
    sla executor retry_jitter""".split()
)


class BaseOperator(LoggingMixin):
    template_fields = ()
    template_ext = ()
    template_fields_renderers = {}
    ui_color = "#fff"

    def __init__(self, task_id=None, **kwargs):
        unknown = sorted(set(kwargs) - _OPERATOR_ARGS)
        if unknown:
            raise TypeError(
                "Invalid arguments were passed to %s (task_id: %s). Invalid arguments were: "
                "**kwargs: %s" % (type(self).__name__, task_id, {key: kwargs[key] for key in unknown})
            )
        if not task_id:
            raise TypeError("%s needs a task_id." % type(self).__name__)
        self.task_id = task_id
        self.retries = kwargs.get("retries", 0)
        self.retry_delay = kwargs.get("retry_delay", _datetime.timedelta(seconds=300))
        self.retry_exponential_backoff = kwargs.get("retry_exponential_backoff", False)
        self.execution_timeout = kwargs.get("execution_timeout")
        self.pool = kwargs.get("pool", "default_pool")
        self.trigger_rule = kwargs.get("trigger_rule", "all_success")
        self.params = dict(kwargs.get("params") or {})
        self.do_xcom_push = kwargs.get("do_xcom_push", True)
        self.upstream_task_ids = set()
        self.downstream_task_ids = set()
        self.dag = kwargs.get("dag") or (_sandbox.dag_stack[-1] if _sandbox.dag_stack else None)
        if self.dag is not None:
            if task_id in self.dag.task_dict:
                raise AirflowException("Task id '%s' has already been added to the DAG." % task_id)
            self.dag.task_dict[task_id] = self

    def execute(self, context):
        raise NotImplementedError("%s does not define execute(context)." % type(self).__name__)

    def render_template(self, content, context, jinja_env=None, seen_oids=None):
        return render_template(content, context)

    def render_template_fields(self, context, jinja_env=None):
        for name in self.template_fields:
            if not hasattr(self, name):
                raise AttributeError(
                    "template_fields names %r, but %s has no attribute %r. Store each templated "
                    "argument on self under the same name." % (name, type(self).__name__, name)
                )
            setattr(self, name, render_template(getattr(self, name), context))

    def set_downstream(self, other):
        for item in other if isinstance(other, (list, tuple)) else [other]:
            self.downstream_task_ids.add(item.task_id)
            item.upstream_task_ids.add(self.task_id)

    def set_upstream(self, other):
        for item in other if isinstance(other, (list, tuple)) else [other]:
            item.set_downstream(self)

    def __rshift__(self, other):
        self.set_downstream(other)
        return other

    def __lshift__(self, other):
        self.set_upstream(other)
        return other

    def __rrshift__(self, other):
        self.set_upstream(other)
        return self

    def __rlshift__(self, other):
        self.set_downstream(other)
        return self

    def __repr__(self):
        return "<Task(%s): %s>" % (type(self).__name__, self.task_id)


class _TaskInstance:
    def __init__(self, task, run_id):
        self.task = task
        self.task_id = getattr(task, "task_id", None)
        self.run_id = run_id
        self.try_number = 1
        self.xcom = {}

    def xcom_push(self, key, value):
        self.xcom[key] = value

    def xcom_pull(self, task_ids=None, key="return_value"):
        return self.xcom.get(key)


# --------------------------------------------------------------------------
# The sandbox state, for checks
# --------------------------------------------------------------------------


class _Sandbox:
    def __init__(self):
        self.reset()

    def reset(self):
        self.connections = {}
        self.variables = {}
        self.dags = {}
        self.dag_stack = []
        self.current = None

    def add_connection(self, conn_id, **fields):
        self.connections[conn_id] = Connection(conn_id, **fields)
        return self.connections[conn_id]

    def connection(self, conn_id):
        if conn_id not in self.connections:
            raise AirflowNotFoundException("The conn_id `%s` isn't defined" % conn_id)
        return self.connections[conn_id]

    def context(self, ds, task=None):
        day = _datetime.datetime.fromisoformat(ds).replace(tzinfo=_datetime.timezone.utc)
        end = day + _datetime.timedelta(days=1)
        run_id = "scheduled__%s" % day.isoformat()
        return {
            "ds": ds,
            "ds_nodash": ds.replace("-", ""),
            "ts": day.isoformat(),
            "ts_nodash": day.strftime("%Y%m%dT%H%M%S"),
            "logical_date": day,
            "data_interval_start": day,
            "data_interval_end": end,
            "run_id": run_id,
            "params": dict(getattr(task, "params", {}) or {}),
            "macros": _Macros,
            "task": task,
            "ti": _TaskInstance(task, run_id),
            "dag": getattr(task, "dag", None),
            "dag_run": _types.SimpleNamespace(run_id=run_id, conf={}, logical_date=day),
            "var": _types.SimpleNamespace(value=_types.SimpleNamespace(), json=_types.SimpleNamespace()),
        }

    def run(self, operator, context):
        """Renders the template fields and calls execute(), as a worker does."""
        operator.render_template_fields(context)
        self.current = context
        try:
            return operator.execute(context)
        finally:
            self.current = None


_sandbox = _Sandbox()


def get_current_context():
    if _sandbox.current is None:
        raise AirflowException("get_current_context() works only while a task runs.")
    return _sandbox.current


# --------------------------------------------------------------------------
# Submodules, so the usual imports work
# --------------------------------------------------------------------------


def _submodule(name, **attributes):
    module = _types.ModuleType(name)
    module.__sandbox__ = True
    module.__dict__.update(attributes)
    _sys.modules[name] = module
    return module


_PUBLIC = dict(
    BaseHook=BaseHook,
    BaseOperator=BaseOperator,
    Connection=Connection,
    Variable=Variable,
    DAG=DAG,
    dag=dag,
    task=task,
    get_current_context=get_current_context,
)

sdk = _submodule("airflow.sdk", **_PUBLIC)
sdk.bases = _submodule("airflow.sdk.bases")
sdk.bases.operator = _submodule("airflow.sdk.bases.operator", BaseOperator=BaseOperator)
sdk.bases.hook = _submodule("airflow.sdk.bases.hook", BaseHook=BaseHook)
models = _submodule(
    "airflow.models", BaseOperator=BaseOperator, Connection=Connection, Variable=Variable, DAG=DAG
)
models.baseoperator = _submodule("airflow.models.baseoperator", BaseOperator=BaseOperator)
models.connection = _submodule("airflow.models.connection", Connection=Connection)
models.variable = _submodule("airflow.models.variable", Variable=Variable)
models.dag = _submodule("airflow.models.dag", DAG=DAG)
hooks = _submodule("airflow.hooks")
hooks.base = _submodule("airflow.hooks.base", BaseHook=BaseHook)
decorators = _submodule("airflow.decorators", dag=dag, task=task)
exceptions = _submodule(
    "airflow.exceptions",
    AirflowException=AirflowException,
    AirflowNotFoundException=AirflowNotFoundException,
    AirflowSkipException=AirflowSkipException,
    AirflowFailException=AirflowFailException,
    AirflowTaskTimeout=AirflowTaskTimeout,
)
utils = _submodule("airflow.utils")
utils.context = _submodule("airflow.utils.context", Context=dict, get_current_context=get_current_context)
utils.log = _submodule("airflow.utils.log")
utils.log.logging_mixin = _submodule("airflow.utils.log.logging_mixin", LoggingMixin=LoggingMixin)
