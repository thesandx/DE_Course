"""A small PySpark for the browser.

It runs the DataFrame API on DuckDB, so interview-style PySpark code works
without a JVM. Each DataFrame is a SQL query. A Column is a function that
renders a SQL expression once it knows which DataFrame it belongs to.

What it is not: a cluster. There are no partitions, no shuffles and no RDDs.
`explain()` prints a small logical plan, not Spark's physical plan.
"""

import builtins as _b
import datetime as _dt
import decimal as _dec
import itertools as _it
import json as _json
import math as _math
import os as _os
import re as _re
import sys as _sys
import tempfile as _tempfile
import types as _types

import duckdb as _duckdb

__version__ = "4.0.1"

# --------------------------------------------------------------------------
# Errors
# --------------------------------------------------------------------------


class PySparkException(Exception):
    pass


class AnalysisException(PySparkException):
    pass


class PySparkValueError(PySparkException, ValueError):
    pass


class PySparkTypeError(PySparkException, TypeError):
    pass


class ParseException(AnalysisException):
    pass


# --------------------------------------------------------------------------
# State: one DuckDB connection per run
# --------------------------------------------------------------------------

_state = {"con": None, "session": None, "udfs": 0, "udf_used": False}
_ids = _it.count(1)


def _con():
    if _state["con"] is None:
        _state["con"] = _duckdb.connect(":memory:")
    return _state["con"]


def _reset():
    """Forget every table, view, setting and UDF. The harness calls it before each run."""
    if _state["con"] is not None:
        try:
            _state["con"].close()
        except Exception:  # noqa: BLE001 - a closed connection is the goal either way
            pass
    _state["con"] = None
    _state["session"] = None
    _state["udf_used"] = False


def _fresh(prefix="t"):
    return "%s_%d" % (prefix, next(_ids))


def _q(name):
    return '"' + str(name).replace('"', '""') + '"'


class ArithmeticException(PySparkException, ArithmeticError):
    pass


def _sql_error(error, sql=None):
    message = str(error).split("\n\nLINE")[0]
    if "[DIVIDE_BY_ZERO]" in message:
        return ArithmeticException(message[message.index("[DIVIDE_BY_ZERO]") :])
    if "[PYTHON_UDF_FAILED]" in message:
        return PySparkException(message[message.index("[PYTHON_UDF_FAILED]") :])
    return AnalysisException(message)


def _run(sql, params=None):
    try:
        if params is None:
            return _con().execute(sql)
        return _con().execute(sql, params)
    except _duckdb.Error as error:
        raise _sql_error(error, sql) from None


# --------------------------------------------------------------------------
# Types
# --------------------------------------------------------------------------


class DataType:
    def simpleString(self):
        return self.typeName()

    def typeName(self):
        return type(self).__name__[:-4].lower()

    def __repr__(self):
        return type(self).__name__ + "()"

    def __eq__(self, other):
        return type(self) is type(other) and self.__dict__ == other.__dict__

    def __hash__(self):
        return hash(repr(self))

    def _duck(self):
        raise NotImplementedError


def _simple(name, duck, spark_name):
    def typeName(self):
        return spark_name

    cls = type(name, (DataType,), {"typeName": typeName, "_duck": lambda self: duck})
    return cls


StringType = _simple("StringType", "VARCHAR", "string")
IntegerType = _simple("IntegerType", "INTEGER", "int")
LongType = _simple("LongType", "BIGINT", "bigint")
ShortType = _simple("ShortType", "SMALLINT", "smallint")
ByteType = _simple("ByteType", "TINYINT", "tinyint")
DoubleType = _simple("DoubleType", "DOUBLE", "double")
FloatType = _simple("FloatType", "FLOAT", "float")
BooleanType = _simple("BooleanType", "BOOLEAN", "boolean")
DateType = _simple("DateType", "DATE", "date")
TimestampType = _simple("TimestampType", "TIMESTAMP", "timestamp")
TimestampNTZType = _simple("TimestampNTZType", "TIMESTAMP", "timestamp_ntz")
BinaryType = _simple("BinaryType", "BLOB", "binary")
NullType = _simple("NullType", "VARCHAR", "void")


class DecimalType(DataType):
    def __init__(self, precision=10, scale=0):
        self.precision = precision
        self.scale = scale

    def typeName(self):
        return "decimal"

    def simpleString(self):
        return "decimal(%d,%d)" % (self.precision, self.scale)

    def __repr__(self):
        return "DecimalType(%d, %d)" % (self.precision, self.scale)

    def _duck(self):
        return "DECIMAL(%d,%d)" % (self.precision, self.scale)


class ArrayType(DataType):
    def __init__(self, elementType, containsNull=True):
        self.elementType = elementType
        self.containsNull = containsNull

    def typeName(self):
        return "array"

    def simpleString(self):
        return "array<%s>" % self.elementType.simpleString()

    def __repr__(self):
        return "ArrayType(%r, %r)" % (self.elementType, self.containsNull)

    def _duck(self):
        return self.elementType._duck() + "[]"


class MapType(DataType):
    def __init__(self, keyType, valueType, valueContainsNull=True):
        self.keyType = keyType
        self.valueType = valueType
        self.valueContainsNull = valueContainsNull

    def typeName(self):
        return "map"

    def simpleString(self):
        return "map<%s,%s>" % (self.keyType.simpleString(), self.valueType.simpleString())

    def __repr__(self):
        return "MapType(%r, %r, %r)" % (self.keyType, self.valueType, self.valueContainsNull)

    def _duck(self):
        return "MAP(%s, %s)" % (self.keyType._duck(), self.valueType._duck())


class StructField(DataType):
    def __init__(self, name, dataType, nullable=True, metadata=None):
        self.name = name
        self.dataType = dataType
        self.nullable = nullable
        self.metadata = metadata or {}

    def simpleString(self):
        return "%s:%s" % (self.name, self.dataType.simpleString())

    def __repr__(self):
        return "StructField(%r, %r, %r)" % (self.name, self.dataType, self.nullable)


class StructType(DataType):
    def __init__(self, fields=None):
        self.fields = list(fields or [])

    @property
    def names(self):
        return [field.name for field in self.fields]

    def fieldNames(self):
        return self.names

    def add(self, field, data_type=None, nullable=True, metadata=None):
        if isinstance(field, StructField):
            self.fields.append(field)
        else:
            if isinstance(data_type, str):
                data_type = _parse_type(data_type)
            self.fields.append(StructField(field, data_type, nullable, metadata))
        return self

    def typeName(self):
        return "struct"

    def simpleString(self):
        return "struct<%s>" % ",".join(field.simpleString() for field in self.fields)

    def __iter__(self):
        return iter(self.fields)

    def __len__(self):
        return len(self.fields)

    def __getitem__(self, key):
        if isinstance(key, int):
            return self.fields[key]
        for field in self.fields:
            if field.name == key:
                return field
        raise KeyError("No StructField named %s" % key)

    def __repr__(self):
        return "StructType([%s])" % ", ".join(repr(field) for field in self.fields)

    def _duck(self):
        return "STRUCT(%s)" % ", ".join(
            "%s %s" % (_q(field.name), field.dataType._duck()) for field in self.fields
        )

    def treeString(self, level=None):
        lines = ["root"]
        for field in self.fields:
            _tree_lines(field, 1, lines)
        return "\n".join(lines) + "\n"


def _tree_lines(field, depth, lines):
    prefix = " |   " * (depth - 1) + " |-- "
    data_type = field.dataType
    lines.append(
        "%s%s: %s (nullable = %s)"
        % (prefix, field.name, data_type.typeName(), "true" if field.nullable else "false")
    )
    if isinstance(data_type, StructType):
        for child in data_type.fields:
            _tree_lines(child, depth + 1, lines)
    elif isinstance(data_type, ArrayType):
        element = data_type.elementType
        lines.append(
            " |   " * depth
            + " |-- element: %s (containsNull = true)" % element.typeName()
        )
        if isinstance(element, StructType):
            for child in element.fields:
                _tree_lines(child, depth + 2, lines)


_SPARK_TYPES = {
    "string": StringType,
    "varchar": StringType,
    "char": StringType,
    "int": IntegerType,
    "integer": IntegerType,
    "bigint": LongType,
    "long": LongType,
    "smallint": ShortType,
    "short": ShortType,
    "tinyint": ByteType,
    "byte": ByteType,
    "double": DoubleType,
    "float": FloatType,
    "real": FloatType,
    "boolean": BooleanType,
    "bool": BooleanType,
    "date": DateType,
    "timestamp": TimestampType,
    "timestamp_ntz": TimestampNTZType,
    "timestamp_ltz": TimestampType,
    "binary": BinaryType,
    "void": NullType,
}


def _split_top(text, sep=","):
    parts, depth, current = [], 0, []
    for char in text:
        if char in "<(":
            depth += 1
        elif char in ">)":
            depth -= 1
        if char == sep and depth == 0:
            parts.append("".join(current))
            current = []
        else:
            current.append(char)
    if "".join(current).strip():
        parts.append("".join(current))
    return [part.strip() for part in parts]


def _parse_type(text):
    """Parse a Spark type string such as 'array<struct<sku:string,qty:int>>'."""
    if isinstance(text, DataType):
        return text
    source = text.strip()
    lower = source.lower()
    if lower in _SPARK_TYPES:
        return _SPARK_TYPES[lower]()
    match = _re.match(r"^decimal\s*\(\s*(\d+)\s*(?:,\s*(\d+)\s*)?\)$", lower)
    if match:
        return DecimalType(int(match.group(1)), int(match.group(2) or 0))
    if lower == "decimal":
        return DecimalType(10, 0)
    if lower.startswith("array<") and lower.endswith(">"):
        return ArrayType(_parse_type(source[6:-1]))
    if lower.startswith("map<") and lower.endswith(">"):
        key, value = _split_top(source[4:-1])
        return MapType(_parse_type(key), _parse_type(value))
    if lower.startswith("struct<") and lower.endswith(">"):
        fields = []
        for part in _split_top(source[7:-1]):
            name, _, kind = part.partition(":")
            if not kind:
                name, _, kind = part.partition(" ")
            fields.append(StructField(name.strip().strip("`"), _parse_type(kind)))
        return StructType(fields)
    raise ParseException("[UNSUPPORTED_DATATYPE] Unsupported data type %r." % text)


def _parse_schema_ddl(text):
    """'id INT, name STRING' or 'id: int, name: string' -> StructType."""
    fields = []
    for part in _split_top(text):
        part = part.strip()
        if not part:
            continue
        match = _re.match(r"^`?([A-Za-z_][\w]*)`?\s*:?\s*(.+)$", part)
        if not match:
            raise ParseException("[PARSE_SYNTAX_ERROR] Cannot parse the schema %r." % text)
        fields.append(StructField(match.group(1), _parse_type(match.group(2))))
    return StructType(fields)


def _duck_to_spark(duck):
    """Map a DuckDB type string to a Spark DataType."""
    text = str(duck).strip()
    upper = text.upper()
    if upper.endswith("[]"):
        return ArrayType(_duck_to_spark(text[:-2]))
    if upper.startswith("STRUCT(") and upper.endswith(")"):
        fields = []
        for part in _split_top(text[7:-1]):
            name, kind = _split_name_type(part)
            fields.append(StructField(name, _duck_to_spark(kind)))
        return StructType(fields)
    if upper.startswith("MAP(") and upper.endswith(")"):
        key, value = _split_top(text[4:-1])
        return MapType(_duck_to_spark(key), _duck_to_spark(value))
    match = _re.match(r"^DECIMAL\((\d+),\s*(\d+)\)$", upper)
    if match:
        return DecimalType(int(match.group(1)), int(match.group(2)))
    simple = {
        "VARCHAR": StringType,
        "INTEGER": IntegerType,
        "BIGINT": LongType,
        "HUGEINT": LongType,
        "UBIGINT": LongType,
        "UINTEGER": LongType,
        "SMALLINT": ShortType,
        "TINYINT": ByteType,
        "DOUBLE": DoubleType,
        "FLOAT": FloatType,
        "BOOLEAN": BooleanType,
        "DATE": DateType,
        "TIMESTAMP": TimestampType,
        "TIMESTAMP WITH TIME ZONE": TimestampType,
        "TIMESTAMP_NS": TimestampType,
        "TIMESTAMP_MS": TimestampType,
        "TIMESTAMP_S": TimestampType,
        "BLOB": BinaryType,
        '"NULL"': NullType,
        "NULL": NullType,
    }
    if upper in simple:
        return simple[upper]()
    if upper == "INTERVAL":
        return StringType()
    return StringType()


def _split_name_type(part):
    part = part.strip()
    if part.startswith('"'):
        end = part.index('"', 1)
        while end + 1 < len(part) and part[end + 1] == '"':
            end = part.index('"', end + 2)
        return part[1:end].replace('""', '"'), part[end + 1 :].strip()
    name, _, kind = part.partition(" ")
    return name, kind.strip()


def _infer_type(value):
    if value is None:
        return None
    if isinstance(value, bool):
        return BooleanType()
    if isinstance(value, int):
        return LongType()
    if isinstance(value, float):
        return DoubleType()
    if isinstance(value, _dec.Decimal):
        return DecimalType(38, 18)
    if isinstance(value, str):
        return StringType()
    if isinstance(value, _dt.datetime):
        return TimestampType()
    if isinstance(value, _dt.date):
        return DateType()
    if isinstance(value, (bytes, bytearray)):
        return BinaryType()
    if isinstance(value, Row) and value._fields is not None:
        return StructType(
            [StructField(name, _infer_type(item) or StringType()) for name, item in zip(value._fields, value)]
        )
    if isinstance(value, dict):
        return StructType(
            [StructField(str(key), _infer_type(item) or StringType()) for key, item in value.items()]
        )
    if isinstance(value, (list, tuple)):
        element = None
        for item in value:
            element = _merge_types(element, _infer_type(item))
        return ArrayType(element or StringType())
    raise PySparkTypeError(
        "[CANNOT_INFER_TYPE_FOR_FIELD] Unable to infer the type of %r." % (value,)
    )


def _merge_types(a, b):
    if a is None:
        return b
    if b is None:
        return a
    if isinstance(a, LongType) and isinstance(b, DoubleType):
        return b
    if isinstance(a, DoubleType) and isinstance(b, LongType):
        return a
    if isinstance(a, StructType) and isinstance(b, StructType):
        names = list(a.names)
        merged = {field.name: field.dataType for field in a.fields}
        for field in b.fields:
            if field.name not in merged:
                names.append(field.name)
                merged[field.name] = field.dataType
            else:
                merged[field.name] = _merge_types(merged[field.name], field.dataType)
        return StructType([StructField(name, merged[name]) for name in names])
    if isinstance(a, ArrayType) and isinstance(b, ArrayType):
        return ArrayType(_merge_types(a.elementType, b.elementType))
    return a


def _to_duck_value(value, data_type):
    """Shape a Python value so DuckDB accepts it for the given Spark type."""
    if value is None:
        return None
    if isinstance(data_type, StructType):
        if isinstance(value, Row):
            value = value.asDict() if value._fields is not None else dict(
                zip(data_type.names, value)
            )
        elif isinstance(value, (list, tuple)):
            value = dict(zip(data_type.names, value))
        return {
            field.name: _to_duck_value(value.get(field.name), field.dataType)
            for field in data_type.fields
        }
    if isinstance(data_type, ArrayType):
        return [_to_duck_value(item, data_type.elementType) for item in value]
    if isinstance(data_type, MapType):
        return {
            _to_duck_value(key, data_type.keyType): _to_duck_value(item, data_type.valueType)
            for key, item in value.items()
        }
    if isinstance(data_type, (DoubleType, FloatType)) and isinstance(value, int):
        return float(value)
    if isinstance(data_type, (TimestampType, TimestampNTZType)) and isinstance(value, str):
        return _dt.datetime.fromisoformat(value.replace("Z", ""))
    if isinstance(data_type, DateType) and isinstance(value, str):
        return _dt.date.fromisoformat(value[:10])
    return value


class _NotJson(Exception):
    """A value JSON cannot carry exactly: bytes, NaN, a time zone, a non-string map key."""


def _json_value(value, data_type):
    """The JSON form of a value that `_to_duck_value` shaped, or raise _NotJson."""
    if value is None or isinstance(value, (bool, int, str)):
        return value
    if isinstance(value, float):
        if _math.isnan(value) or _math.isinf(value):
            raise _NotJson()
        return value
    if isinstance(value, _dt.datetime):
        if value.tzinfo is not None:
            raise _NotJson()
        return value.isoformat(sep=" ")
    if isinstance(value, _dt.date):
        return value.isoformat()
    if isinstance(value, _dec.Decimal):
        return str(value)
    if isinstance(value, list) and isinstance(data_type, ArrayType):
        return [_json_value(item, data_type.elementType) for item in value]
    if isinstance(value, dict) and isinstance(data_type, StructType):
        return {
            field.name: _json_value(value.get(field.name), field.dataType)
            for field in data_type.fields
        }
    if isinstance(value, dict) and isinstance(data_type, MapType):
        if not all(isinstance(key, str) for key in value):
            raise _NotJson()
        return {key: _json_value(item, data_type.valueType) for key, item in value.items()}
    raise _NotJson()


def _insert_json(table, names, types, rows):
    """Loads rows through DuckDB's JSON reader. Binding thousands of Python
    values one by one takes seconds in the browser; one JSON file takes a
    tenth of that. Returns False when a value needs the slower exact path."""
    try:
        lines = [
            _json.dumps({name: _json_value(value, kind) for name, value, kind in zip(names, row, types)})
            for row in rows
        ]
    except _NotJson:
        return False
    path = _os.path.join(_tempfile.gettempdir(), "%s.json" % table)
    with open(path, "w", encoding="utf-8") as handle:
        handle.write("\n".join(lines))
    columns = ", ".join(
        "'%s': '%s'" % (name.replace("'", "''"), kind._duck().replace("'", "''"))
        for name, kind in zip(names, types)
    )
    try:
        _con().execute(
            "INSERT INTO %s SELECT * FROM read_json('%s', format = 'newline_delimited', "
            "columns = {%s})" % (table, path.replace("'", "''"), columns)
        )
    except _duckdb.Error:
        return False
    finally:
        _os.remove(path)
    return True


def _insert_params(table, names, rows):
    """Loads rows as bound parameters, one INSERT per chunk. Exact for every type."""
    row_marks = "(%s)" % ", ".join("?" for _ in names)
    chunk = max(1, 2000 // len(names))
    for start in range(0, len(rows), chunk):
        batch = rows[start : start + chunk]
        _con().execute(
            "INSERT INTO %s VALUES %s" % (table, ", ".join(row_marks for _ in batch)),
            [value for row in batch for value in row],
        )


# --------------------------------------------------------------------------
# Row
# --------------------------------------------------------------------------


class Row(tuple):
    """A result row. Read a value by name (row.city, row["city"]) or position."""

    def __new__(cls, *args, **kwargs):
        if args and kwargs:
            raise ValueError("Can not use both args and kwargs to create Row")
        if kwargs:
            row = tuple.__new__(cls, list(kwargs.values()))
            row._fields = list(kwargs.keys())
            return row
        row = tuple.__new__(cls, args)
        row._fields = None
        return row

    @classmethod
    def _make(cls, names, values):
        row = tuple.__new__(cls, values)
        row._fields = list(names)
        return row

    def __call__(self, *values):
        if self._fields is not None or not _b.all(isinstance(item, str) for item in self):
            raise TypeError("Row is not callable")
        return Row._make(list(self), values)

    @property
    def __fields__(self):
        return self._fields

    def asDict(self, recursive=False):
        if self._fields is None:
            raise TypeError("Cannot convert a Row class into dict")

        def convert(value):
            if not recursive:
                return value
            if isinstance(value, Row):
                return value.asDict(True)
            if isinstance(value, list):
                return [convert(item) for item in value]
            if isinstance(value, dict):
                return {key: convert(item) for key, item in value.items()}
            return value

        return {name: convert(value) for name, value in zip(self._fields, self)}

    def __getitem__(self, key):
        if isinstance(key, str):
            if self._fields is None or key not in self._fields:
                raise PySparkValueError("[KEY_NOT_EXISTS] Key `%s` is not in the row." % key)
            return tuple.__getitem__(self, self._fields.index(key))
        return tuple.__getitem__(self, key)

    def __getattr__(self, name):
        if name.startswith("__") or name == "_fields":
            raise AttributeError(name)
        fields = self.__dict__.get("_fields")
        if fields is None or name not in fields:
            raise AttributeError(name)
        return tuple.__getitem__(self, fields.index(name))

    def __contains__(self, item):
        if self._fields is not None and isinstance(item, str):
            return item in self._fields
        return tuple.__contains__(self, item)

    def __repr__(self):
        if self._fields is None:
            return "<Row(%s)>" % ", ".join(repr(item) for item in self)
        return "Row(%s)" % ", ".join(
            "%s=%r" % (name, value) for name, value in zip(self._fields, self)
        )

    def __reduce__(self):
        return (Row._make, (self._fields, tuple(self)))


# --------------------------------------------------------------------------
# Columns
# --------------------------------------------------------------------------


def _lit_sql(value):
    if isinstance(value, Column):
        raise TypeError("internal: column passed as literal")
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"
    if isinstance(value, int):
        if -(2**63) <= value < 2**63:
            return "CAST(%d AS BIGINT)" % value if abs(value) >= 2**31 else str(value)
        return "CAST('%d' AS HUGEINT)" % value
    if isinstance(value, float):
        if _math.isnan(value):
            return "CAST('NaN' AS DOUBLE)"
        if _math.isinf(value):
            return "CAST('%sinf' AS DOUBLE)" % ("-" if value < 0 else "")
        return "CAST(%r AS DOUBLE)" % value
    if isinstance(value, _dec.Decimal):
        exponent = value.as_tuple().exponent
        scale = -exponent if isinstance(exponent, int) and exponent < 0 else 0
        return "CAST('%s' AS DECIMAL(38,%d))" % (value, _b.min(scale, 37))
    if isinstance(value, str):
        return "'" + value.replace("'", "''") + "'"
    if isinstance(value, _dt.datetime):
        return "TIMESTAMP '%s'" % value.replace(tzinfo=None).isoformat(sep=" ")
    if isinstance(value, _dt.date):
        return "DATE '%s'" % value.isoformat()
    if isinstance(value, (list, tuple)):
        return "[" + ", ".join(_lit_sql(item) for item in value) + "]"
    if isinstance(value, dict):
        return "{" + ", ".join(
            "%s: %s" % (_lit_sql(str(key)), _lit_sql(item)) for key, item in value.items()
        ) + "}"
    raise PySparkTypeError("[UNSUPPORTED_LITERAL] Unsupported literal type %s." % type(value).__name__)


def _lit_name(value):
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, _dt.datetime):
        return "TIMESTAMP '%s'" % value.isoformat(sep=" ")
    if isinstance(value, _dt.date):
        return "DATE '%s'" % value.isoformat()
    return str(value)


_DIVIDE_BY_ZERO = (
    "[DIVIDE_BY_ZERO] Division by zero. Use `try_divide` to tolerate divisor being 0 and "
    "return NULL instead."
)


class Column:
    """A column expression. It renders to SQL once it is used in a DataFrame."""

    def __init__(self, render, name, *, agg=False, udf=False, refs=(), sort=None, generator=None):
        self._render = render
        self._name = name
        self._agg = agg
        self._udf = udf
        self._refs = frozenset(refs)
        self._sort = sort
        self._generator = generator

    # -- helpers -----------------------------------------------------------
    def _sql(self, ctx):
        return self._render(ctx)

    def _derive(self, render, name, *others, agg=None, sort=None, generator=None):
        refs = set(self._refs)
        udf = self._udf
        is_agg = self._agg
        for other in others:
            if isinstance(other, Column):
                refs |= other._refs
                udf = udf or other._udf
                is_agg = is_agg or other._agg
        return Column(
            render,
            name,
            agg=is_agg if agg is None else agg,
            udf=udf,
            refs=refs,
            sort=sort,
            generator=generator,
        )

    def _binary(self, other, op, name_op=None, reverse=False):
        right = _to_col(other, literal=True)
        left = self
        if reverse:
            left, right = right, left
        return left._derive(
            lambda ctx: "(%s %s %s)" % (left._sql(ctx), op, right._sql(ctx)),
            "(%s %s %s)" % (left._name, name_op or op, right._name),
            right,
        )

    # -- arithmetic --------------------------------------------------------
    def __add__(self, other):
        return self._binary(other, "+")

    def __radd__(self, other):
        return self._binary(other, "+", reverse=True)

    def __sub__(self, other):
        return self._binary(other, "-")

    def __rsub__(self, other):
        return self._binary(other, "-", reverse=True)

    def __mul__(self, other):
        return self._binary(other, "*")

    def __rmul__(self, other):
        return self._binary(other, "*", reverse=True)

    def __truediv__(self, other):
        right = _to_col(other, literal=True)
        return self._derive(
            lambda ctx: "(CAST(%s AS DOUBLE) / CASE WHEN CAST(%s AS DOUBLE) = 0 THEN error(%s) "
            "ELSE CAST(%s AS DOUBLE) END)"
            % (self._sql(ctx), right._sql(ctx), _lit_sql(_DIVIDE_BY_ZERO), right._sql(ctx)),
            "(%s / %s)" % (self._name, right._name),
            right,
        )

    def __rtruediv__(self, other):
        return _to_col(other, literal=True).__truediv__(self)

    def __mod__(self, other):
        return self._binary(other, "%")

    def __rmod__(self, other):
        return self._binary(other, "%", reverse=True)

    def __pow__(self, other):
        right = _to_col(other, literal=True)
        return self._derive(
            lambda ctx: "pow(%s, %s)" % (self._sql(ctx), right._sql(ctx)),
            "POWER(%s, %s)" % (self._name, right._name),
            right,
        )

    def __neg__(self):
        return self._derive(lambda ctx: "(- %s)" % self._sql(ctx), "(- %s)" % self._name)

    # -- comparison --------------------------------------------------------
    def __eq__(self, other):
        return self._binary(other, "=")

    def __ne__(self, other):
        right = _to_col(other, literal=True)
        return self._derive(
            lambda ctx: "(NOT (%s = %s))" % (self._sql(ctx), right._sql(ctx)),
            "(NOT (%s = %s))" % (self._name, right._name),
            right,
        )

    def __lt__(self, other):
        return self._binary(other, "<")

    def __le__(self, other):
        return self._binary(other, "<=")

    def __gt__(self, other):
        return self._binary(other, ">")

    def __ge__(self, other):
        return self._binary(other, ">=")

    __hash__ = None

    def eqNullSafe(self, other):
        return self._binary(other, "IS NOT DISTINCT FROM", "<=>")

    # -- logic -------------------------------------------------------------
    def __and__(self, other):
        return self._binary(other, "AND")

    def __rand__(self, other):
        return self._binary(other, "AND", reverse=True)

    def __or__(self, other):
        return self._binary(other, "OR")

    def __ror__(self, other):
        return self._binary(other, "OR", reverse=True)

    def __invert__(self):
        return self._derive(lambda ctx: "(NOT %s)" % self._sql(ctx), "(NOT %s)" % self._name)

    def __bool__(self):
        raise PySparkValueError(
            "[CANNOT_CONVERT_COLUMN_INTO_BOOL] Cannot convert column into bool: please use '&' "
            "for 'and', '|' for 'or', '~' for 'not' when building DataFrame boolean expressions."
        )

    def __iter__(self):
        raise PySparkTypeError("[NOT_ITERABLE] Column is not iterable.")

    def __contains__(self, item):
        raise PySparkValueError(
            "[CANNOT_APPLY_IN_FOR_COLUMN] Cannot apply 'in' operator against a column: please "
            "use 'contains' in a string column or 'array_contains' function for an array column."
        )

    # -- naming and types --------------------------------------------------
    def alias(self, *names, **kwargs):
        name = names[0]
        return Column(
            self._render,
            name,
            agg=self._agg,
            udf=self._udf,
            refs=self._refs,
            sort=self._sort,
            generator=self._generator,
        )

    name = alias
    As = alias

    def cast(self, data_type):
        target = _parse_type(data_type) if isinstance(data_type, str) else data_type
        duck = target._duck()

        def render(ctx):
            inner = self._sql(ctx)
            source = ctx.type_of(inner).upper()
            if duck in ("BIGINT", "INTEGER", "SMALLINT", "TINYINT") and source.startswith("TIMESTAMP"):
                return "CAST(epoch(%s) AS %s)" % (inner, duck)
            if duck in ("BIGINT", "INTEGER", "SMALLINT", "TINYINT") and source == "DATE":
                return "CAST(NULL AS %s)" % duck
            if duck.startswith("TIMESTAMP") and source in (
                "BIGINT",
                "INTEGER",
                "DOUBLE",
                "FLOAT",
                "HUGEINT",
            ) or (duck.startswith("TIMESTAMP") and source.startswith("DECIMAL")):
                return "CAST(to_timestamp(%s) AS TIMESTAMP)" % inner
            if duck in ("BIGINT", "INTEGER", "SMALLINT", "TINYINT") and source in (
                "DOUBLE",
                "FLOAT",
            ) or (duck in ("BIGINT", "INTEGER") and source.startswith("DECIMAL")):
                return "CAST(trunc(%s) AS %s)" % (inner, duck)
            if duck == "VARCHAR" and source == "BOOLEAN":
                return "CASE WHEN %s IS NULL THEN NULL WHEN %s THEN 'true' ELSE 'false' END" % (
                    inner,
                    inner,
                )
            if duck in ("BIGINT", "INTEGER", "DOUBLE", "DATE", "TIMESTAMP") and source == "VARCHAR":
                return "TRY_CAST(trim(%s) AS %s)" % (inner, duck)
            if duck == "BOOLEAN" and source == "VARCHAR":
                return "TRY_CAST(%s AS BOOLEAN)" % inner
            return "CAST(%s AS %s)" % (inner, duck)

        return self._derive(render, self._name)

    astype = cast

    # -- predicates --------------------------------------------------------
    def isNull(self):
        return self._derive(lambda ctx: "(%s IS NULL)" % self._sql(ctx), "(%s IS NULL)" % self._name)

    def isNotNull(self):
        return self._derive(
            lambda ctx: "(%s IS NOT NULL)" % self._sql(ctx), "(%s IS NOT NULL)" % self._name
        )

    def isNaN(self):
        return self._derive(lambda ctx: "isnan(%s)" % self._sql(ctx), "isnan(%s)" % self._name)

    def isin(self, *values):
        if len(values) == 1 and isinstance(values[0], (list, tuple, set)):
            values = list(values[0])
        items = [_to_col(value, literal=True) for value in values]
        if not items:
            return self._derive(lambda ctx: "FALSE", "(%s IN ())" % self._name)
        return self._derive(
            lambda ctx: "(%s IN (%s))" % (self._sql(ctx), ", ".join(item._sql(ctx) for item in items)),
            "(%s IN (%s))" % (self._name, ", ".join(item._name for item in items)),
            *items,
        )

    def between(self, lower, upper):
        return (self >= lower) & (self <= upper)

    def like(self, pattern):
        return self._derive(
            lambda ctx: "(%s LIKE %s)" % (self._sql(ctx), _lit_sql(pattern)),
            "%s LIKE %s" % (self._name, pattern),
        )

    def ilike(self, pattern):
        return self._derive(
            lambda ctx: "(%s ILIKE %s)" % (self._sql(ctx), _lit_sql(pattern)),
            "ilike(%s, %s)" % (self._name, pattern),
        )

    def rlike(self, pattern):
        return self._derive(
            lambda ctx: "regexp_matches(%s, %s)" % (self._sql(ctx), _lit_sql(pattern)),
            "RLIKE(%s, %s)" % (self._name, pattern),
        )

    def contains(self, other):
        right = _to_col(other, literal=True)
        return self._derive(
            lambda ctx: "contains(%s, %s)" % (self._sql(ctx), right._sql(ctx)),
            "contains(%s, %s)" % (self._name, right._name),
            right,
        )

    def startswith(self, other):
        right = _to_col(other, literal=True)
        return self._derive(
            lambda ctx: "starts_with(%s, %s)" % (self._sql(ctx), right._sql(ctx)),
            "startswith(%s, %s)" % (self._name, right._name),
            right,
        )

    def endswith(self, other):
        right = _to_col(other, literal=True)
        return self._derive(
            lambda ctx: "suffix(%s, %s)" % (self._sql(ctx), right._sql(ctx)),
            "endswith(%s, %s)" % (self._name, right._name),
            right,
        )

    def substr(self, start, length):
        start_col = _to_col(start, literal=True)
        length_col = _to_col(length, literal=True)
        return self._derive(
            lambda ctx: "substring(%s, %s, %s)"
            % (self._sql(ctx), start_col._sql(ctx), length_col._sql(ctx)),
            "substr(%s, %s, %s)" % (self._name, start_col._name, length_col._name),
            start_col,
            length_col,
        )

    # -- nested values -----------------------------------------------------
    def getItem(self, key):
        def render(ctx):
            inner = self._sql(ctx)
            kind = ctx.type_of(inner).upper()
            if kind.startswith("MAP("):
                return "%s[%s]" % (inner, _lit_sql(key))
            if kind.startswith("STRUCT("):
                return "struct_extract(%s, %s)" % (inner, _lit_sql(str(key)))
            if isinstance(key, Column):
                return "%s[%s + 1]" % (inner, key._sql(ctx))
            return "%s[%d]" % (inner, int(key) + 1)

        return self._derive(render, "%s[%s]" % (self._name, key))

    def getField(self, name):
        return self._derive(
            lambda ctx: "struct_extract(%s, %s)" % (self._sql(ctx), _lit_sql(name)),
            "%s.%s" % (self._name, name),
        )

    def __getitem__(self, key):
        if isinstance(key, slice):
            return self.substr(key.start, key.stop)
        return self.getItem(key)

    def __getattr__(self, name):
        if name.startswith("_"):
            raise AttributeError(name)
        return self.getField(name)

    def withField(self, name, column):
        value = _to_col(column, literal=True)
        return self._derive(
            lambda ctx: "struct_insert(%s, %s := %s)" % (self._sql(ctx), _q(name), value._sql(ctx)),
            self._name,
            value,
        )

    # -- sorting -----------------------------------------------------------
    def _sorted(self, direction, nulls):
        return Column(
            self._render,
            self._name,
            agg=self._agg,
            udf=self._udf,
            refs=self._refs,
            sort=(direction, nulls),
        )

    def asc(self):
        return self._sorted("ASC", "FIRST")

    def asc_nulls_first(self):
        return self._sorted("ASC", "FIRST")

    def asc_nulls_last(self):
        return self._sorted("ASC", "LAST")

    def desc(self):
        return self._sorted("DESC", "LAST")

    def desc_nulls_first(self):
        return self._sorted("DESC", "FIRST")

    def desc_nulls_last(self):
        return self._sorted("DESC", "LAST")

    # -- conditionals ------------------------------------------------------
    def when(self, condition, value):
        branches = getattr(self, "_branches", None)
        if branches is None:
            raise PySparkTypeError(
                "[INVALID_WHEN_USAGE] when() can only be applied on a Column previously "
                "generated by when() function."
            )
        return _case(branches + [(condition, value)], None)

    def otherwise(self, value):
        branches = getattr(self, "_branches", None)
        if branches is None:
            raise PySparkTypeError(
                "[INVALID_WHEN_USAGE] otherwise() can only be applied on a Column previously "
                "generated by when() function."
            )
        if getattr(self, "_has_else", False):
            raise PySparkTypeError("[INVALID_WHEN_USAGE] otherwise() can only be applied once.")
        return _case(branches, value, has_else=True)

    # -- windows -----------------------------------------------------------
    def over(self, window=None):
        spec = window if window is not None else WindowSpec()

        def render(ctx):
            return "%s OVER (%s)" % (self._sql(ctx), spec._sql(ctx, self))

        return Column(
            render,
            "%s OVER (%s)" % (self._name, spec._name()),
            agg=False,
            udf=self._udf,
            refs=self._refs | spec._refs(),
        )

    def __repr__(self):
        return "Column<'%s'>" % self._name

    def explain(self, extended=False):
        print(self._name)


def _case(branches, default, has_else=False):
    conditions = [(_to_col(cond), _to_col(value, literal=True)) for cond, value in branches]
    default_col = _to_col(default, literal=True) if has_else else None
    parts = []
    for cond, value in conditions:
        parts.append((cond, value))

    def render(ctx):
        sql = "CASE"
        for cond, value in parts:
            sql += " WHEN %s THEN %s" % (cond._sql(ctx), value._sql(ctx))
        if default_col is not None:
            sql += " ELSE %s" % default_col._sql(ctx)
        return sql + " END"

    name = "CASE" + "".join(" WHEN %s THEN %s" % (cond._name, value._name) for cond, value in parts)
    if default_col is not None:
        name += " ELSE %s" % default_col._name
    name += " END"
    others = [item for pair in parts for item in pair] + ([default_col] if default_col is not None else [])
    column = Column(render, name)
    column = column._derive(render, name, *others)
    column._branches = list(branches)
    column._has_else = has_else
    return column


def _to_col(value, literal=False):
    if isinstance(value, Column):
        return value
    if literal or not isinstance(value, str):
        return _lit(value)
    return _col(value)


def _lit(value):
    if isinstance(value, Column):
        return value
    return Column(lambda ctx: _lit_sql(value), _lit_name(value))


def _col(name):
    if not isinstance(name, str):
        raise PySparkTypeError("[NOT_STR] Argument `col` should be a str, got %s." % type(name).__name__)
    if name == "*":
        return Column(lambda ctx: ctx.star(None), "*")
    if name.endswith(".*"):
        prefix = name[:-2]
        return Column(lambda ctx: ctx.star(prefix), name)
    short = name.strip("`").split(".")[-1] if not name.startswith("`") else name.strip("`")
    return Column(lambda ctx: ctx.resolve(name), short, refs=[name.strip("`").split(".")[0]])


def _bound(df, name):
    return Column(lambda ctx: ctx.resolve_bound(df, name), name, refs=[name])


# --------------------------------------------------------------------------
# Windows
# --------------------------------------------------------------------------


class WindowSpec:
    def __init__(self, partition=(), order=(), frame=None):
        self._partition = list(partition)
        self._order = list(order)
        self._frame = frame

    def partitionBy(self, *cols):
        return WindowSpec(_flatten_cols(cols), self._order, self._frame)

    def orderBy(self, *cols):
        return WindowSpec(self._partition, _flatten_cols(cols), self._frame)

    def rowsBetween(self, start, end):
        return WindowSpec(self._partition, self._order, ("ROWS", start, end))

    def rangeBetween(self, start, end):
        return WindowSpec(self._partition, self._order, ("RANGE", start, end))

    def _refs(self):
        refs = set()
        for item in self._partition + self._order:
            refs |= _to_col(item)._refs
        return refs

    def _sql(self, ctx, function=None):
        parts = []
        if self._partition:
            parts.append(
                "PARTITION BY " + ", ".join(_to_col(item)._sql(ctx) for item in self._partition)
            )
        if self._order:
            parts.append("ORDER BY " + ", ".join(_order_sql(item, ctx) for item in self._order))
        if self._frame is not None:
            kind, start, end = self._frame
            unit = None
            if kind == "RANGE" and self._order:
                order_type = ctx.type_of(_to_col(self._order[0])._sql(ctx)).upper()
                if order_type == "DATE":
                    unit = "DAY"
            parts.append(
                "%s BETWEEN %s AND %s"
                % (kind, _bound_sql(start, True, unit), _bound_sql(end, False, unit))
            )
        return " ".join(parts)

    def _name(self):
        parts = []
        if self._partition:
            parts.append("PARTITION BY " + ", ".join(_to_col(item)._name for item in self._partition))
        if self._order:
            parts.append(
                "ORDER BY "
                + ", ".join(
                    "%s %s NULLS %s" % ((_to_col(item)._name,) + (_to_col(item)._sort or ("ASC", "FIRST")))
                    for item in self._order
                )
            )
        if self._frame is not None:
            kind, start, end = self._frame
            parts.append(
                "%s BETWEEN %s AND %s"
                % (kind.upper(), _bound_sql(start, True), _bound_sql(end, False))
            )
        return " ".join(parts)


def _bound_sql(value, is_start, unit=None):
    if value is None:
        return "UNBOUNDED PRECEDING" if is_start else "UNBOUNDED FOLLOWING"
    if value <= Window.unboundedPreceding:
        return "UNBOUNDED PRECEDING"
    if value >= Window.unboundedFollowing:
        return "UNBOUNDED FOLLOWING"
    if value == 0:
        return "CURRENT ROW"
    amount = ("INTERVAL %d %s" % (abs(value), unit)) if unit else "%d" % abs(value)
    return "%s %s" % (amount, "PRECEDING" if value < 0 else "FOLLOWING")


class Window:
    unboundedPreceding = -(2**63)
    unboundedFollowing = 2**63 - 1
    currentRow = 0

    @staticmethod
    def partitionBy(*cols):
        return WindowSpec().partitionBy(*cols)

    @staticmethod
    def orderBy(*cols):
        return WindowSpec().orderBy(*cols)

    @staticmethod
    def rowsBetween(start, end):
        return WindowSpec().rowsBetween(start, end)

    @staticmethod
    def rangeBetween(start, end):
        return WindowSpec().rangeBetween(start, end)


def _flatten_cols(cols):
    if len(cols) == 1 and isinstance(cols[0], (list, tuple)):
        return list(cols[0])
    return list(cols)


def _order_sql(item, ctx):
    column = _to_col(item)
    direction, nulls = column._sort or ("ASC", "FIRST")
    return "%s %s NULLS %s" % (column._sql(ctx), direction, nulls)


# --------------------------------------------------------------------------
# Resolution context
# --------------------------------------------------------------------------


class _Field:
    __slots__ = ("name", "internal", "origins", "aliases", "hidden")

    def __init__(self, name, internal, origins=(), aliases=(), hidden=False):
        self.name = name
        self.internal = internal
        self.origins = frozenset(origins)
        self.aliases = frozenset(aliases)
        self.hidden = hidden

    def copy(self, **changes):
        values = {
            "name": self.name,
            "internal": self.internal,
            "origins": self.origins,
            "aliases": self.aliases,
            "hidden": self.hidden,
        }
        values.update(changes)
        return _Field(**values)


class _Ctx:
    """Turns column names into SQL references for one or two sources."""

    def __init__(self, sources, from_sql, agg_filter=None):
        self.sources = sources  # list of (alias, [fields])
        self.from_sql = from_sql
        self.agg_filter = agg_filter

    def _visible(self):
        for alias, fields in self.sources:
            for field in fields:
                if not field.hidden:
                    yield alias, field

    def _names(self):
        return ", ".join("`%s`" % field.name for _, field in self._visible())

    def _ref(self, alias, field):
        return "%s.%s" % (alias, _q(field.internal))

    def resolve(self, name):
        if name.startswith("`") and name.endswith("`"):
            return self._resolve_exact(name[1:-1], name)
        found = self._match(name)
        if found is not None:
            return found
        if "." in name:
            head, rest = name.split(".", 1)
            head = head.strip("`")
            qualified = [
                (alias, field)
                for alias, field in self._visible()
                if head in field.aliases and field.name.lower() == rest.split(".")[0].lower()
            ]
            if len(qualified) == 1:
                alias, field = qualified[0]
                sql = self._ref(alias, field)
                for part in rest.split(".")[1:]:
                    sql = "struct_extract(%s, %s)" % (sql, _lit_sql(part))
                return sql
            if len(qualified) > 1:
                raise AnalysisException(
                    "[AMBIGUOUS_REFERENCE] Reference `%s` is ambiguous." % name
                )
            base = self._match(head)
            if base is not None:
                sql = base
                for part in rest.split("."):
                    sql = "struct_extract(%s, %s)" % (sql, _lit_sql(part.strip("`")))
                return sql
        raise AnalysisException(
            "[UNRESOLVED_COLUMN.WITH_SUGGESTION] A column, variable, or function parameter with "
            "name `%s` cannot be resolved. Did you mean one of the following? [%s]."
            % (name, self._names())
        )

    def _resolve_exact(self, name, shown):
        matches = [(alias, field) for alias, field in self._visible() if field.name == name]
        if len(matches) == 1:
            return self._ref(*matches[0])
        if len(matches) > 1:
            raise AnalysisException("[AMBIGUOUS_REFERENCE] Reference `%s` is ambiguous." % name)
        raise AnalysisException(
            "[UNRESOLVED_COLUMN.WITH_SUGGESTION] A column, variable, or function parameter with "
            "name %s cannot be resolved. Did you mean one of the following? [%s]."
            % (shown, self._names())
        )

    def _match(self, name):
        exact = [(alias, field) for alias, field in self._visible() if field.name == name]
        matches = exact or [
            (alias, field)
            for alias, field in self._visible()
            if field.name.lower() == name.lower()
        ]
        if len(matches) == 1:
            return self._ref(*matches[0])
        if len(matches) > 1:
            raise AnalysisException(
                "[AMBIGUOUS_REFERENCE] Reference `%s` is ambiguous, could be: [%s]."
                % (name, ", ".join("`%s`" % field.name for _, field in matches))
            )
        hidden = [
            (alias, field)
            for alias, fields in self.sources
            for field in fields
            if field.hidden and field.name == name
        ]
        if len(hidden) == 1:
            return self._ref(*hidden[0])
        return None

    def resolve_bound(self, df, name):
        if "." in name and not name.startswith("`"):
            head, rest = name.split(".", 1)
            base = self.resolve_bound(df, head)
            sql = base
            for part in rest.split("."):
                sql = "struct_extract(%s, %s)" % (sql, _lit_sql(part))
            return sql
        name = name.strip("`")
        matches = [
            (alias, field)
            for alias, field in self._visible()
            if df._id in field.origins and field.name.lower() == name.lower()
        ]
        if len(matches) == 1:
            return self._ref(*matches[0])
        if len(matches) > 1:
            raise AnalysisException(
                "[AMBIGUOUS_COLUMN_REFERENCE] Column `%s` is ambiguous. It's because you joined "
                "several DataFrame together, and some of these DataFrames are the same. Please "
                "alias the DataFrames with different names via `DataFrame.alias` before joining "
                "them, and specify the column using qualified name, e.g. "
                "`df.alias(\"a\").join(df.alias(\"b\"), col(\"a.id\") > col(\"b.id\"))`." % name
            )
        found = self._match(name)
        if found is not None:
            return found
        raise AnalysisException(
            "[CANNOT_RESOLVE_DATAFRAME_COLUMN] Cannot resolve dataframe column `%s`. It's "
            "probably because of illegal references like `df1.select(df2.col(\"a\"))`." % name
        )

    def star(self, prefix):
        raise AnalysisException(
            "[INVALID_USAGE_OF_STAR_OR_REGEX] Invalid usage of '*' in expression."
        )

    def type_of(self, sql):
        try:
            rows = _con().execute(
                "DESCRIBE SELECT %s AS v FROM %s" % (sql, self.from_sql)
            ).fetchall()
            return str(rows[0][1])
        except _duckdb.Error:
            return ""

    def agg_filter_sql(self):
        return " FILTER (WHERE %s)" % self.agg_filter if self.agg_filter else ""


# --------------------------------------------------------------------------
# Plans, for explain()
# --------------------------------------------------------------------------


class _Plan:
    def __init__(self, op, detail="", children=(), scan=None):
        self.op = op
        self.detail = detail
        self.children = list(children)
        self.scan = scan

    def lines(self, depth=0):
        if self.scan is not None:
            text = self.scan.describe()
        else:
            text = "%s %s" % (self.op, self.detail) if self.detail else self.op
        prefix = "" if depth == 0 else "   " * (depth - 1) + "+- "
        out = [prefix + text]
        for child in self.children:
            out.extend(child.lines(depth + 1))
        return out

    def scans(self):
        found = [self.scan] if self.scan is not None else []
        for child in self.children:
            found.extend(child.scans())
        return found


class _Scan:
    def __init__(self, table, partition_cols, all_partitions):
        self.table = table
        self.partition_cols = list(partition_cols)
        self.all_partitions = all_partitions
        self.partition_filters = []
        self.data_filters = []
        self.partitions_read = all_partitions

    def copy(self):
        other = _Scan(self.table, self.partition_cols, self.all_partitions)
        other.partition_filters = list(self.partition_filters)
        other.data_filters = list(self.data_filters)
        other.partitions_read = self.partitions_read
        return other

    @property
    def pruned(self):
        return bool(self.partition_filters)

    def describe(self):
        text = "FileScan parquet %s PartitionFilters: [%s], PushedFilters: [%s]" % (
            self.table,
            ", ".join(self.partition_filters),
            ", ".join(self.data_filters),
        )
        if self.partition_cols:
            text += "  -- sandbox: reads %d of %d partitions" % (
                self.partitions_read,
                self.all_partitions,
            )
        return text


# --------------------------------------------------------------------------
# DataFrame
# --------------------------------------------------------------------------


def _visible(fields):
    return [field for field in fields if not field.hidden]


def _unique(name, taken):
    if name not in taken:
        return name
    index = 2
    while "%s_%d" % (name, index) in taken:
        index += 1
    return "%s_%d" % (name, index)


class DataFrame:
    def __init__(self, session, sql, fields, plan, order=None, scan_lineage=None):
        self._id = next(_ids)
        self.sparkSession = session
        self._sql_text = sql
        self._fields = [field.copy(origins=field.origins | {self._id}) for field in fields]
        self._plan = plan
        self._order = order
        self._scan_lineage = scan_lineage

    # -- building blocks ---------------------------------------------------
    def _alias(self):
        return _fresh("s")

    def _ctx(self, alias):
        return _Ctx([(alias, self._fields)], "(%s) AS %s" % (self._sql_text, alias))

    def _new(self, sql, fields, plan, order=None, scan_lineage=None):
        return DataFrame(self.sparkSession, sql, fields, plan, order, scan_lineage)

    def _expand(self, cols, ctx, alias):
        """Turn select arguments into (sql, field) pairs, expanding stars."""
        out = []
        for item in cols:
            if isinstance(item, (list, tuple)):
                out.extend(self._expand(item, ctx, alias))
                continue
            if isinstance(item, str) and (item == "*" or item.endswith(".*")):
                out.extend(self._star(item, ctx, alias))
                continue
            column = _to_col(item)
            if column._name == "*" or column._name.endswith(".*"):
                out.extend(self._star(column._name, ctx, alias))
                continue
            out.append((column, None))
        return out

    def _star(self, text, ctx, alias):
        if text == "*":
            return [
                (_Passthrough(alias, field), field)
                for field in self._fields
                if not field.hidden
            ]
        prefix = text[:-2].strip("`")
        aliased = [field for field in self._fields if not field.hidden and prefix in field.aliases]
        if aliased:
            return [(_Passthrough(alias, field), field) for field in aliased]
        struct_sql = ctx.resolve(prefix)
        kind = ctx.type_of(struct_sql)
        if not kind.upper().startswith("STRUCT("):
            raise AnalysisException(
                "[CANNOT_RESOLVE_STAR_EXPAND] Cannot resolve %s.* given input columns." % prefix
            )
        out = []
        for part in _split_top(kind[7:-1]):
            name, _ = _split_name_type(part)
            out.append(
                (
                    Column(
                        lambda c, s=struct_sql, n=name: "struct_extract(%s, %s)" % (s, _lit_sql(n)),
                        name,
                    ),
                    None,
                )
            )
        return out

    def _project(self, items, plan_op="Project", keep_hidden=True, extra_order=None):
        """SELECT the given columns. items: list of Column or (Column, field)."""
        alias = self._alias()
        ctx = self._ctx(alias)
        pairs = self._expand(items, ctx, alias)
        select_sql, fields, taken = [], [], set()
        generators = 0
        for column, source_field in pairs:
            if column._generator is not None:
                generators += 1
                if generators > 1:
                    raise AnalysisException(
                        "[UNSUPPORTED_GENERATOR.MULTI_GENERATOR] only one generator allowed per "
                        "select clause but found 2."
                    )
                for sql, name in column._generator(ctx):
                    internal = _unique(name, taken)
                    taken.add(internal)
                    select_sql.append("%s AS %s" % (sql, _q(internal)))
                    fields.append(_Field(name, internal))
                continue
            sql = column._sql(ctx)
            if source_field is not None:
                internal = _unique(source_field.internal, taken)
                field = source_field.copy(internal=internal, hidden=False)
            else:
                name = column._name
                internal = _unique(name, taken)
                passthrough = isinstance(column, _Passthrough)
                field = (
                    column._field.copy(internal=internal, name=name)
                    if passthrough
                    else self._carry(column, name, internal, ctx)
                )
            taken.add(internal)
            select_sql.append("%s AS %s" % (sql, _q(internal)))
            fields.append(field)
        has_agg = _b.any(column._agg for column, _ in pairs)
        order = None
        if keep_hidden and not has_agg and generators == 0:
            for field in self._fields:
                if field.hidden:
                    internal = _unique(field.internal, taken)
                    taken.add(internal)
                    select_sql.append("%s.%s AS %s" % (alias, _q(field.internal), _q(internal)))
                    fields.append(field.copy(internal=internal))
                    if field.internal == self._order:
                        order = internal
        sql = "SELECT %s FROM (%s) AS %s" % (
            ", ".join(select_sql) or "NULL AS __empty",
            self._sql_text,
            alias,
        )
        detail = "[%s]" % ", ".join(field.name for field in fields if not field.hidden)
        lineage = self._scan_lineage if not has_agg else None
        return self._new(sql, fields, _Plan(plan_op, detail, [self._plan]), order, lineage)

    def _carry(self, column, name, internal, ctx):
        """A plain column reference keeps its origin, so df["x"] still resolves after select."""
        sql = column._sql(ctx)
        for alias, field in ctx._visible():
            if sql == ctx._ref(alias, field):
                return field.copy(name=name, internal=internal)
        return _Field(name, internal)

    # -- schema ------------------------------------------------------------
    @property
    def columns(self):
        return [field.name for field in self._fields if not field.hidden]

    def _describe(self):
        alias = self._alias()
        rows = _run(
            "DESCRIBE SELECT %s FROM (%s) AS %s"
            % (
                ", ".join(
                    "%s.%s" % (alias, _q(field.internal)) for field in _visible(self._fields)
                )
                or "NULL",
                self._sql_text,
                alias,
            )
        ).fetchall()
        return [(field.name, str(row[1])) for field, row in zip(_visible(self._fields), rows)]

    @property
    def schema(self):
        return StructType(
            [StructField(name, _duck_to_spark(kind)) for name, kind in self._describe()]
        )

    @property
    def dtypes(self):
        return [(name, _duck_to_spark(kind).simpleString()) for name, kind in self._describe()]

    def printSchema(self, level=None):
        print(self.schema.treeString(), end="")

    def __getattr__(self, name):
        if name.startswith("_"):
            raise AttributeError(name)
        if name in self.columns:
            return _bound(self, name)
        raise AttributeError(
            "'DataFrame' object has no attribute '%s'" % name
        )

    def __getitem__(self, item):
        if isinstance(item, str):
            if item not in self.columns and item.split(".")[0] not in self.columns:
                lowered = [name.lower() for name in self.columns]
                if item.lower() not in lowered:
                    raise AnalysisException(
                        "[UNRESOLVED_COLUMN.WITH_SUGGESTION] A column with name `%s` cannot be "
                        "resolved. Did you mean one of the following? [%s]."
                        % (item, ", ".join("`%s`" % name for name in self.columns))
                    )
            return _bound(self, item)
        if isinstance(item, int):
            return _bound(self, self.columns[item])
        if isinstance(item, Column):
            return self.filter(item)
        if isinstance(item, (list, tuple)):
            return self.select(*item)
        raise PySparkTypeError("[NOT_COLUMN_OR_INT_OR_STR] Unexpected item %r." % (item,))

    def col(self, name):
        return self[name]

    # -- transformations ---------------------------------------------------
    def select(self, *cols):
        cols = _flatten_cols(cols)
        return self._project(cols)

    def selectExpr(self, *exprs):
        return self.select(*[expr(item) for item in _flatten_cols(exprs)])

    def withColumn(self, name, column):
        if not isinstance(column, Column):
            raise PySparkTypeError(
                "[NOT_COLUMN] Argument `col` should be a Column, got %s." % type(column).__name__
            )
        return self.withColumns({name: column})

    def withColumns(self, mapping):
        items = []
        replaced = set()
        for field in _visible(self._fields):
            match = next((key for key in mapping if key.lower() == field.name.lower()), None)
            if match is not None:
                items.append(mapping[match].alias(field.name))
                replaced.add(match)
            else:
                items.append(_Passthrough(None, field))
        for key, column in mapping.items():
            if key not in replaced:
                items.append(column.alias(key))
        return self._project(items)

    def withColumnRenamed(self, existing, new):
        items = []
        for field in _visible(self._fields):
            if field.name == existing:
                items.append(_Passthrough(None, field, rename=new))
            else:
                items.append(_Passthrough(None, field))
        return self._project(items)

    def withColumnsRenamed(self, mapping):
        result = self
        for old, new in mapping.items():
            result = result.withColumnRenamed(old, new)
        return result

    def toDF(self, *names):
        names = _flatten_cols(names)
        visible = _visible(self._fields)
        if len(names) != len(visible):
            raise PySparkValueError(
                "[LENGTH_SHOULD_BE_THE_SAME] toDF() needs %d names, got %d." % (len(visible), len(names))
            )
        return self._project(
            [_Passthrough(None, field, rename=name) for field, name in zip(visible, names)]
        )

    def drop(self, *cols):
        names = set()
        bound = []
        for item in cols:
            if isinstance(item, str):
                names.add(item.lower())
            elif isinstance(item, Column):
                bound.append(item)
        drop_refs = set()
        if bound:
            alias = self._alias()
            ctx = self._ctx(alias)
            for column in bound:
                try:
                    drop_refs.add(column._sql(ctx))
                except AnalysisException:
                    continue
            items = [
                _Passthrough(None, field)
                for field in _visible(self._fields)
                if field.name.lower() not in names
                and "%s.%s" % (alias, _q(field.internal)) not in drop_refs
            ]
            # The alias above is only for matching; re-render against a fresh one.
            return self._project(items)
        items = [
            _Passthrough(None, field)
            for field in _visible(self._fields)
            if field.name.lower() not in names
        ]
        return self._project(items)

    def filter(self, condition):
        alias = self._alias()
        ctx = self._ctx(alias)
        column = expr(condition) if isinstance(condition, str) else _to_col(condition)
        if column._agg:
            raise AnalysisException(
                "[INVALID_WHERE_CONDITION] The WHERE condition contains invalid expressions. "
                "Rewrite the query to avoid window functions, aggregate functions, and generator "
                "functions in the WHERE clause."
            )
        sql = "SELECT * FROM (%s) AS %s WHERE %s" % (self._sql_text, alias, column._sql(ctx))
        fields = [field.copy() for field in self._fields]
        child = self._plan
        if column._udf:
            child = _Plan("BatchEvalPython", "[%s]" % column._name, [child])
        plan = _Plan("Filter", column._name, [child])
        lineage = self._scan_lineage
        if lineage is not None:
            lineage = self._push_filter(lineage, column, ctx)
        return self._new(sql, fields, plan, self._order, lineage)

    where = filter

    def _push_filter(self, lineage, column, ctx):
        scan, plan_node = lineage
        new_scan = scan.copy()
        refs = {ref.lower() for ref in column._refs}
        partition_cols = {name.lower() for name in scan.partition_cols}
        if not column._udf and refs and refs <= partition_cols:
            new_scan.partition_filters.append(column._name)
            try:
                read = _run(
                    "SELECT count(*) FROM (SELECT DISTINCT %s FROM (%s) AS %s WHERE %s) AS x"
                    % (
                        ", ".join(_q(name) for name in scan.partition_cols),
                        self._sql_text,
                        ctx.sources[0][0],
                        column._sql(ctx),
                    )
                ).fetchone()[0]
                new_scan.partitions_read = _b.min(new_scan.partitions_read, read)
            except AnalysisException:
                new_scan.partitions_read = scan.partitions_read
        elif not column._udf:
            new_scan.data_filters.append(column._name)
        plan_node.scan = new_scan
        return (new_scan, plan_node)

    def limit(self, n):
        alias = self._alias()
        order = " ORDER BY %s.%s" % (alias, _q(self._order)) if self._order else ""
        sql = "SELECT * FROM (%s) AS %s%s LIMIT %d" % (self._sql_text, alias, order, int(n))
        return self._new(
            sql,
            [field.copy() for field in self._fields],
            _Plan("GlobalLimit", str(n), [self._plan]),
            self._order,
        )

    def orderBy(self, *cols, **kwargs):
        cols = _flatten_cols(cols)
        ascending = kwargs.get("ascending", True)
        if not isinstance(ascending, (list, tuple)):
            ascending = [ascending] * len(cols)
        ordered = []
        for item, asc in zip(cols, ascending):
            column = _to_col(item)
            if column._sort is None and not asc:
                column = column.desc()
            ordered.append(column)
        alias = self._alias()
        ctx = self._ctx(alias)
        key = _fresh("__order")
        order_sql = ", ".join(_order_sql(column, ctx) for column in ordered)
        visible = [field for field in self._fields if not field.hidden]
        select = ", ".join("%s.%s" % (alias, _q(field.internal)) for field in visible)
        sql = "SELECT %s%srow_number() OVER (ORDER BY %s) AS %s FROM (%s) AS %s" % (
            select,
            ", " if select else "",
            order_sql,
            _q(key),
            self._sql_text,
            alias,
        )
        fields = [field.copy() for field in visible] + [_Field(key, key, hidden=True)]
        detail = "[%s]" % ", ".join(
            "%s %s NULLS %s" % ((column._name,) + (column._sort or ("ASC", "FIRST")))
            for column in ordered
        )
        return self._new(sql, fields, _Plan("Sort", detail, [self._plan]), key)

    sort = orderBy

    def sortWithinPartitions(self, *cols, **kwargs):
        return self.orderBy(*cols, **kwargs)

    def distinct(self):
        alias = self._alias()
        visible = _visible(self._fields)
        sql = "SELECT DISTINCT %s FROM (%s) AS %s" % (
            ", ".join("%s.%s" % (alias, _q(field.internal)) for field in visible),
            self._sql_text,
            alias,
        )
        return self._new(sql, [field.copy() for field in visible], _Plan("Aggregate", "distinct", [self._plan]))

    def dropDuplicates(self, subset=None):
        if subset is None:
            return self.distinct()
        if isinstance(subset, str):
            subset = [subset]
        alias = self._alias()
        ctx = self._ctx(alias)
        keys = ", ".join(ctx.resolve(name) for name in subset)
        visible = _visible(self._fields)
        order = "%s.%s" % (alias, _q(self._order)) if self._order else "1"
        rank = _fresh("__rn")
        inner = "SELECT %s.*, row_number() OVER (PARTITION BY %s ORDER BY %s) AS %s FROM (%s) AS %s" % (
            alias,
            keys,
            order,
            _q(rank),
            self._sql_text,
            alias,
        )
        outer = _fresh("d")
        sql = "SELECT %s FROM (%s) AS %s WHERE %s = 1" % (
            ", ".join("%s.%s" % (outer, _q(field.internal)) for field in visible),
            inner,
            outer,
            _q(rank),
        )
        return self._new(
            sql,
            [field.copy() for field in visible],
            _Plan("Deduplicate", "[%s]" % ", ".join(subset), [self._plan]),
        )

    drop_duplicates = dropDuplicates

    def dropDuplicatesWithinWatermark(self, subset=None):
        return self.dropDuplicates(subset)

    def _set_op(self, other, op, by_name=False, allow_missing=False):
        left = _visible(self._fields)
        right = _visible(other._fields)
        a, b = self._alias(), other._alias()
        if by_name:
            right_by = {field.name.lower(): field for field in right}
            left_names = {field.name.lower() for field in left}
            missing = [field.name for field in left if field.name.lower() not in right_by]
            extra = [field for field in right if field.name.lower() not in left_names]
            if (missing or extra) and not allow_missing:
                raise AnalysisException(
                    "[NUM_COLUMNS_MISMATCH] UNION can only be performed on inputs with the same "
                    "columns. Missing in the second input: %s." % (missing or [f.name for f in extra])
                )
            out_fields = left + extra
            left_sql = ["%s.%s" % (a, _q(field.internal)) for field in left] + ["NULL" for _ in extra]
            right_sql = [
                "%s.%s" % (b, _q(right_by[field.name.lower()].internal))
                if field.name.lower() in right_by
                else "NULL"
                for field in left
            ] + ["%s.%s" % (b, _q(field.internal)) for field in extra]
        else:
            if len(left) != len(right):
                raise AnalysisException(
                    "[NUM_COLUMNS_MISMATCH] %s can only be performed on inputs with the same "
                    "number of columns, but the first input has %d columns and the second input "
                    "has %d columns." % (op.split()[0], len(left), len(right))
                )
            out_fields = left
            left_sql = ["%s.%s" % (a, _q(field.internal)) for field in left]
            right_sql = ["%s.%s" % (b, _q(field.internal)) for field in right]
        names = []
        taken = set()
        for field in out_fields:
            internal = _unique(field.name, taken)
            taken.add(internal)
            names.append(internal)
        sql = "SELECT %s FROM (%s) AS %s %s SELECT %s FROM (%s) AS %s" % (
            ", ".join("%s AS %s" % (s, _q(n)) for s, n in zip(left_sql, names)),
            self._sql_text,
            a,
            op,
            ", ".join("%s AS %s" % (s, _q(n)) for s, n in zip(right_sql, names)),
            other._sql_text,
            b,
        )
        fields = [_Field(field.name, internal) for field, internal in zip(out_fields, names)]
        return self._new(sql, fields, _Plan(op.title(), "", [self._plan, other._plan]))

    def union(self, other):
        return self._set_op(other, "UNION ALL")

    unionAll = union

    def unionByName(self, other, allowMissingColumns=False):
        return self._set_op(other, "UNION ALL", by_name=True, allow_missing=allowMissingColumns)

    def intersect(self, other):
        return self._set_op(other, "INTERSECT")

    def intersectAll(self, other):
        return self._set_op(other, "INTERSECT ALL")

    def subtract(self, other):
        return self._set_op(other, "EXCEPT")

    def exceptAll(self, other):
        return self._set_op(other, "EXCEPT ALL")

    def join(self, other, on=None, how=None):
        how_key = (how or "inner").lower().replace("_", "")
        kinds = {
            "inner": "INNER",
            "cross": "CROSS",
            "outer": "FULL",
            "full": "FULL",
            "fullouter": "FULL",
            "left": "LEFT",
            "leftouter": "LEFT",
            "right": "RIGHT",
            "rightouter": "RIGHT",
            "semi": "SEMI",
            "leftsemi": "SEMI",
            "anti": "ANTI",
            "leftanti": "ANTI",
        }
        if how_key not in kinds:
            raise PySparkValueError(
                "[UNSUPPORTED_JOIN_TYPE] Unsupported join type: '%s'. Supported join types "
                "include: 'inner', 'outer', 'full', 'fullouter', 'full_outer', 'leftouter', "
                "'left', 'left_outer', 'rightouter', 'right', 'right_outer', 'leftsemi', "
                "'left_semi', 'semi', 'leftanti', 'left_anti', 'anti', 'cross'." % how
            )
        kind = kinds[how_key]
        if isinstance(other, DataFrame) and other._id == self._id:
            other = other._copy()
        la, ra = _fresh("l"), _fresh("r")
        left_fields = [field for field in self._fields if not field.hidden]
        right_fields = [field for field in other._fields if not field.hidden]
        from_sql = "(%s) AS %s, (%s) AS %s" % (self._sql_text, la, other._sql_text, ra)
        ctx = _Ctx([(la, left_fields), (ra, right_fields)], from_sql)
        using = None
        if on is None:
            condition = "TRUE"
            if kind not in ("CROSS", "INNER"):
                condition = "TRUE"
        elif isinstance(on, str) or (
            isinstance(on, (list, tuple)) and on and _b.all(isinstance(x, str) for x in on)
        ):
            using = [on] if isinstance(on, str) else list(on)
            parts = []
            for key in using:
                left_key = self._find(left_fields, key, "left")
                right_key = self._find(right_fields, key, "right")
                parts.append(
                    "%s.%s = %s.%s" % (la, _q(left_key.internal), ra, _q(right_key.internal))
                )
            condition = " AND ".join(parts)
        else:
            conditions = on if isinstance(on, (list, tuple)) else [on]
            condition = " AND ".join("(%s)" % _to_col(item)._sql(ctx) for item in conditions)
        if kind in ("SEMI", "ANTI"):
            sql = "SELECT %s.* FROM (%s) AS %s WHERE %sEXISTS (SELECT 1 FROM (%s) AS %s WHERE %s)" % (
                la,
                self._sql_text,
                la,
                "NOT " if kind == "ANTI" else "",
                other._sql_text,
                ra,
                condition,
            )
            fields = [field.copy() for field in self._fields if not field.hidden]
            plan = _Plan("Join", "Left%s %s" % (kind.title(), condition), [self._plan, other._plan])
            return self._new(sql, fields, plan)
        select, fields, taken = [], [], set()

        def add(sql, field):
            internal = _unique(field.name, taken)
            taken.add(internal)
            select.append("%s AS %s" % (sql, _q(internal)))
            fields.append(field.copy(internal=internal))

        if using is not None:
            key_set = {key.lower() for key in using}
            for key in using:
                left_key = self._find(left_fields, key, "left")
                right_key = self._find(right_fields, key, "right")
                if kind == "FULL":
                    add(
                        "COALESCE(%s.%s, %s.%s)"
                        % (la, _q(left_key.internal), ra, _q(right_key.internal)),
                        left_key.copy(origins=left_key.origins | right_key.origins),
                    )
                elif kind == "RIGHT":
                    add("%s.%s" % (ra, _q(right_key.internal)), right_key)
                else:
                    add("%s.%s" % (la, _q(left_key.internal)), left_key)
            for field in left_fields:
                if field.name.lower() not in key_set:
                    add("%s.%s" % (la, _q(field.internal)), field)
            for field in right_fields:
                if field.name.lower() not in key_set:
                    add("%s.%s" % (ra, _q(field.internal)), field)
        else:
            for field in left_fields:
                add("%s.%s" % (la, _q(field.internal)), field)
            for field in right_fields:
                add("%s.%s" % (ra, _q(field.internal)), field)
        join_sql = "CROSS JOIN" if kind == "CROSS" or on is None else "%s JOIN" % kind
        on_sql = "" if join_sql == "CROSS JOIN" else " ON %s" % condition
        sql = "SELECT %s FROM (%s) AS %s %s (%s) AS %s%s" % (
            ", ".join(select),
            self._sql_text,
            la,
            join_sql,
            other._sql_text,
            ra,
            on_sql,
        )
        detail = "%s, %s" % (kind.title(), ("[%s]" % ", ".join(using)) if using else condition)
        plan = _Plan("Join", detail, [self._plan, other._plan])
        return self._new(sql, fields, plan)

    def _find(self, fields, key, side):
        matches = [field for field in fields if field.name.lower() == key.lower()]
        if len(matches) != 1:
            raise AnalysisException(
                "[UNRESOLVED_USING_COLUMN_FOR_JOIN] USING column `%s` cannot be resolved on the "
                "%s side of the join. The %s-side columns: [%s]."
                % (key, side, side, ", ".join("`%s`" % field.name for field in fields))
            )
        return matches[0]

    def crossJoin(self, other):
        return self.join(other, how="cross")

    def _copy(self):
        return self._new(
            self._sql_text, [field.copy() for field in self._fields], self._plan, self._order
        )

    def alias(self, name):
        fields = [field.copy(aliases={name}) for field in self._fields]
        return self._new(self._sql_text, fields, _Plan("SubqueryAlias", name, [self._plan]), self._order, self._scan_lineage)

    def groupBy(self, *cols):
        return GroupedData(self, _flatten_cols(cols))

    groupby = groupBy

    def rollup(self, *cols):
        return GroupedData(self, _flatten_cols(cols), mode="ROLLUP")

    def cube(self, *cols):
        return GroupedData(self, _flatten_cols(cols), mode="CUBE")

    def agg(self, *exprs):
        return GroupedData(self, []).agg(*exprs)

    def unpivot(self, ids, values, variableColumnName, valueColumnName):
        ids = [ids] if isinstance(ids, (str, Column)) else list(ids or [])
        if values is None:
            id_names = {(_to_col(item)._name).lower() for item in ids}
            values = [name for name in self.columns if name.lower() not in id_names]
        values = [values] if isinstance(values, (str, Column)) else list(values)
        parts = []
        for value in values:
            name = value if isinstance(value, str) else _to_col(value)._name
            parts.append(
                self.select(
                    *ids,
                    _lit(name).alias(variableColumnName),
                    _to_col(value).alias(valueColumnName),
                )
            )
        result = parts[0]
        for part in parts[1:]:
            result = result.union(part)
        return result

    melt = unpivot

    def fillna(self, value, subset=None):
        if isinstance(value, dict):
            items = []
            for field in _visible(self._fields):
                match = next((key for key in value if key.lower() == field.name.lower()), None)
                if match is None:
                    items.append(_Passthrough(None, field))
                else:
                    items.append(coalesce(_col(field.name), _lit(value[match])).alias(field.name))
            return self._project(items)
        if subset is not None and isinstance(subset, str):
            subset = [subset]
        subset_lower = {name.lower() for name in subset} if subset else None
        types = dict(self._describe())
        items = []
        for field in _visible(self._fields):
            kind = types.get(field.name, "").upper()
            fits = False
            if isinstance(value, bool):
                fits = kind == "BOOLEAN"
            elif isinstance(value, (int, float)):
                fits = kind in (
                    "INTEGER",
                    "BIGINT",
                    "SMALLINT",
                    "TINYINT",
                    "HUGEINT",
                    "DOUBLE",
                    "FLOAT",
                ) or kind.startswith("DECIMAL")
            elif isinstance(value, str):
                fits = kind == "VARCHAR"
            if fits and (subset_lower is None or field.name.lower() in subset_lower):
                fill = value
                if isinstance(value, float) and kind in ("INTEGER", "BIGINT", "SMALLINT", "TINYINT"):
                    fill = int(value)
                items.append(
                    Column(
                        lambda ctx, f=field, v=fill: "COALESCE(%s, %s)"
                        % (ctx.resolve("`%s`" % f.name), _lit_sql(v)),
                        field.name,
                    )
                )
            else:
                items.append(_Passthrough(None, field))
        return self._project(items)

    def dropna(self, how="any", thresh=None, subset=None):
        names = subset if subset is not None else self.columns
        if isinstance(names, str):
            names = [names]
        alias = self._alias()
        ctx = self._ctx(alias)
        counts = " + ".join(
            "(CASE WHEN %s IS NOT NULL THEN 1 ELSE 0 END)" % ctx.resolve(name) for name in names
        )
        if thresh is not None:
            condition = "(%s) >= %d" % (counts, thresh)
        elif how == "all":
            condition = "(%s) > 0" % counts
        else:
            condition = "(%s) = %d" % (counts, len(names))
        sql = "SELECT * FROM (%s) AS %s WHERE %s" % (self._sql_text, alias, condition)
        return self._new(
            sql,
            [field.copy() for field in self._fields],
            _Plan("Filter", "dropna", [self._plan]),
            self._order,
        )

    @property
    def na(self):
        return _NaFunctions(self)

    def replace(self, to_replace, value=None, subset=None):
        if isinstance(to_replace, dict):
            mapping = to_replace
        else:
            olds = to_replace if isinstance(to_replace, (list, tuple)) else [to_replace]
            news = value if isinstance(value, (list, tuple)) else [value] * len(olds)
            mapping = dict(zip(olds, news))
        names = {name.lower() for name in (subset or self.columns)}
        items = []
        for field in _visible(self._fields):
            if field.name.lower() not in names:
                items.append(_Passthrough(None, field))
                continue
            column = _col("`%s`" % field.name)
            result = None
            for old, new in mapping.items():
                branch = column == old
                result = when(branch, _lit(new)) if result is None else result.when(branch, _lit(new))
            if result is None:
                items.append(_Passthrough(None, field))
            else:
                items.append(result.otherwise(column).alias(field.name))
        return self._project(items)

    def transform(self, func, *args, **kwargs):
        return func(self, *args, **kwargs)

    def hint(self, *args, **kwargs):
        return self

    def repartition(self, *args, **kwargs):
        return self._new(
            self._sql_text,
            [field.copy() for field in self._fields],
            _Plan("Exchange", "hashpartitioning", [self._plan]),
            self._order,
            self._scan_lineage,
        )

    repartitionByRange = repartition

    def coalesce(self, numPartitions):
        return self

    def cache(self):
        return self

    def persist(self, *args, **kwargs):
        return self

    def unpersist(self, *args, **kwargs):
        return self

    def checkpoint(self, eager=True):
        return self

    localCheckpoint = checkpoint

    @property
    def storageLevel(self):
        return None

    @property
    def rdd(self):
        raise PySparkException(
            "This sandbox runs the DataFrame API only. RDDs are not available here: use "
            "DataFrame functions instead."
        )

    @property
    def write(self):
        return DataFrameWriter(self)

    @property
    def writeStream(self):
        raise PySparkException("Structured Streaming is not available in this sandbox.")

    def createOrReplaceTempView(self, name):
        self.sparkSession._views[name.lower()] = self
        _run(
            "CREATE OR REPLACE TEMP VIEW %s AS %s"
            % (_q(name), self._output_sql())
        )

    createTempView = createOrReplaceTempView
    createGlobalTempView = createOrReplaceTempView
    createOrReplaceGlobalTempView = createOrReplaceTempView
    registerTempTable = createOrReplaceTempView

    def _output_sql(self):
        alias = self._alias()
        visible = _visible(self._fields)
        order = " ORDER BY %s.%s" % (alias, _q(self._order)) if self._order else ""
        return "SELECT %s FROM (%s) AS %s%s" % (
            ", ".join("%s.%s AS %s" % (alias, _q(field.internal), _q(field.name)) for field in visible)
            or "NULL AS __empty",
            self._sql_text,
            alias,
            order,
        )

    # -- actions -----------------------------------------------------------
    def _fetch(self):
        cursor = _run(self._output_sql())
        rows = cursor.fetchall()
        kinds = [str(item[1]) for item in cursor.description]
        names = self.columns
        return [Row._make(names, [_from_duck(value, kind) for value, kind in zip(row, kinds)]) for row in rows], kinds

    def collect(self):
        return self._fetch()[0]

    def toLocalIterator(self, prefetchPartitions=False):
        return iter(self.collect())

    def count(self):
        alias = self._alias()
        return _run("SELECT count(*) FROM (%s) AS %s" % (self._sql_text, alias)).fetchone()[0]

    def isEmpty(self):
        return self.limit(1).count() == 0

    def first(self):
        rows = self.limit(1).collect()
        return rows[0] if rows else None

    def head(self, n=None):
        if n is None:
            return self.first()
        return self.limit(n).collect()

    def take(self, num):
        return self.limit(num).collect()

    def tail(self, num):
        return self.collect()[-num:] if num else []

    def toPandas(self):
        import pandas as pd

        rows, _ = self._fetch()
        return pd.DataFrame.from_records([tuple(row) for row in rows], columns=self.columns)

    def foreach(self, f):
        for row in self.collect():
            f(row)

    def show(self, n=20, truncate=True, vertical=False):
        print(self._show_string(n, truncate, vertical))

    def _show_string(self, n=20, truncate=True, vertical=False):
        rows = self.limit(n + 1).collect()
        has_more = len(rows) > n
        rows = rows[:n]
        names = self.columns
        width_limit = 20 if truncate is True else (int(truncate) if truncate else 0)

        def cell(value):
            text = _show_value(value)
            if width_limit and len(text) > width_limit:
                text = text[: width_limit - 3] + "..." if width_limit > 3 else text[:width_limit]
            return text

        table = [[cell(value) for value in row] for row in rows]
        if vertical:
            lines = []
            for index, row in enumerate(table):
                lines.append("-RECORD %d" % index + "-" * 10)
                for name, value in zip(names, row):
                    lines.append(" %s | %s" % (name, value))
            if not table:
                lines.append("(0 rows)")
            return "\n".join(lines)
        widths = [_b.max(3, len(name)) for name in names]
        for row in table:
            for index, value in enumerate(row):
                widths[index] = _b.max(widths[index], len(value))
        border = "+" + "+".join("-" * width for width in widths) + "+"

        def line(values):
            if width_limit:
                return "|" + "|".join(value.rjust(width) for value, width in zip(values, widths)) + "|"
            return "|" + "|".join(value.ljust(width) for value, width in zip(values, widths)) + "|"

        out = [border, line(names), border]
        out.extend(line(row) for row in table)
        out.append(border)
        if has_more:
            out.append("only showing top %d row%s" % (n, "" if n == 1 else "s"))
            return "\n".join(out)
        return "\n".join(out) + "\n"

    def explain(self, extended=False, mode=None):
        print("== Physical Plan ==")
        print("\n".join(self._plan.lines()))
        print()

    def describe(self, *cols):
        names = _flatten_cols(cols) or self.columns
        stats = []
        for stat, fn in (("count", "count"), ("mean", "avg"), ("stddev", "stddev_samp"), ("min", "min"), ("max", "max")):
            items = [_lit(stat).alias("summary")]
            for name in names:
                inner = _col(name)
                items.append(
                    Column(
                        lambda ctx, i=inner, f=fn: "CAST(%s(%s) AS VARCHAR)" % (f, i._sql(ctx))
                        if f in ("count", "min", "max")
                        else "CAST(%s(TRY_CAST(%s AS DOUBLE)) AS VARCHAR)" % (f, i._sql(ctx)),
                        name,
                        agg=True,
                    )
                )
            stats.append(self.select(*items))
        result = stats[0]
        for part in stats[1:]:
            result = result.union(part)
        return result

    summary = describe

    def __repr__(self):
        try:
            return "DataFrame[%s]" % ", ".join("%s: %s" % pair for pair in self.dtypes)
        except Exception:  # noqa: BLE001 - repr must not raise
            return "DataFrame[...]"


class _Passthrough(Column):
    """Selects an existing field unchanged, keeping its identity."""

    def __init__(self, alias, field, rename=None):
        self._field = field
        self._fixed_alias = alias
        name = rename or field.name

        def render(ctx):
            for source_alias, fields in ctx.sources:
                for candidate in fields:
                    if candidate is field or (
                        candidate.internal == field.internal and candidate.name == field.name
                    ):
                        return "%s.%s" % (source_alias, _q(candidate.internal))
            return ctx.resolve("`%s`" % field.name)

        Column.__init__(self, render, name, refs=[field.name])

    def alias(self, *names, **kwargs):
        return _Passthrough(self._fixed_alias, self._field, rename=names[0])


class _NaFunctions:
    def __init__(self, df):
        self._df = df

    def fill(self, value, subset=None):
        return self._df.fillna(value, subset)

    def drop(self, how="any", thresh=None, subset=None):
        return self._df.dropna(how, thresh, subset)

    def replace(self, to_replace, value=None, subset=None):
        return self._df.replace(to_replace, value, subset)


def _from_duck(value, kind):
    """Turn a DuckDB value into what PySpark returns: Row for a struct, dict for a map."""
    if value is None:
        return None
    upper = kind.upper()
    if upper.endswith("[]"):
        return [_from_duck(item, kind[:-2]) for item in value]
    if upper.startswith("STRUCT("):
        parts = _split_top(kind[7:-1])
        names, kinds = [], []
        for part in parts:
            name, inner = _split_name_type(part)
            names.append(name)
            kinds.append(inner)
        return Row._make(names, [_from_duck(value.get(name), k) for name, k in zip(names, kinds)])
    if upper.startswith("MAP("):
        key_kind, value_kind = _split_top(kind[4:-1])
        if isinstance(value, dict) and set(value.keys()) == {"key", "value"} and isinstance(value["key"], list):
            pairs = zip(value["key"], value["value"])
        else:
            pairs = value.items()
        return {_from_duck(k, key_kind): _from_duck(v, value_kind) for k, v in pairs}
    if upper in ("HUGEINT", "UBIGINT") and isinstance(value, int):
        return int(value)
    if upper == "FLOAT" and isinstance(value, float):
        return value
    return value


def _show_value(value):
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, float):
        if value != value:
            return "NaN"
        if value in (float("inf"), float("-inf")):
            return "Infinity" if value > 0 else "-Infinity"
        text = repr(value)
        if "e" in text:
            mantissa, exponent = text.split("e")
            if "." not in mantissa:
                mantissa += ".0"
            return "%sE%d" % (mantissa, int(exponent))
        if abs(value) >= 1e7 or (value != 0 and abs(value) < 1e-3):
            exponent = int(_math.floor(_math.log10(abs(value))))
            mantissa = value / 10**exponent
            return "%sE%d" % (repr(round(mantissa, 15)), exponent)
        return text
    if isinstance(value, _dt.datetime):
        text = value.strftime("%Y-%m-%d %H:%M:%S")
        if value.microsecond:
            text += (".%06d" % value.microsecond).rstrip("0")
        return text
    if isinstance(value, _dt.date):
        return value.isoformat()
    if isinstance(value, Row):
        return "{" + ", ".join(_show_value(item) for item in value) + "}"
    if isinstance(value, list):
        return "[" + ", ".join(_show_value(item) for item in value) + "]"
    if isinstance(value, dict):
        return "{" + ", ".join(
            "%s -> %s" % (_show_value(k), _show_value(v)) for k, v in value.items()
        ) + "}"
    if isinstance(value, (bytes, bytearray)):
        return "[" + " ".join("%02X" % byte for byte in value) + "]"
    return str(value)


# --------------------------------------------------------------------------
# Grouping
# --------------------------------------------------------------------------


class GroupedData:
    def __init__(self, df, keys, mode=None, pivot=None):
        self._df = df
        self._keys = keys
        self._mode = mode
        self._pivot = pivot

    def pivot(self, pivot_col, values=None):
        if values is None:
            column = _to_col(pivot_col)
            distinct = self._df.select(column.alias("__v")).filter(_col("__v").isNotNull()).distinct()
            values = sorted(row[0] for row in distinct.collect())
        return GroupedData(self._df, self._keys, self._mode, (pivot_col, list(values)))

    def agg(self, *exprs):
        if len(exprs) == 1 and isinstance(exprs[0], dict):
            columns = []
            for name, fn in exprs[0].items():
                fn = {"mean": "avg", "average": "avg"}.get(fn, fn)
                columns.append(_agg_call(fn, _col(name) if name != "*" else _lit(1), name_arg=name if name != "*" else "1"))
            exprs = columns
        exprs = _flatten_cols(exprs)
        for column in exprs:
            if not isinstance(column, Column):
                raise PySparkTypeError(
                    "[NOT_COLUMN] Argument `exprs` should be a Column, got %s." % type(column).__name__
                )
        df = self._df
        alias = df._alias()
        ctx = df._ctx(alias)
        select, fields, taken, groups = [], [], set(), []
        for key in self._keys:
            column = _to_col(key)
            sql = column._sql(ctx)
            groups.append(sql)
            internal = _unique(column._name, taken)
            taken.add(internal)
            select.append("%s AS %s" % (sql, _q(internal)))
            fields.append(df._carry(column, column._name, internal, ctx))
        if self._pivot is None:
            for column in exprs:
                internal = _unique(column._name, taken)
                taken.add(internal)
                select.append("%s AS %s" % (column._sql(ctx), _q(internal)))
                fields.append(_Field(column._name, internal))
        else:
            pivot_col, values = self._pivot
            pivot_sql = _to_col(pivot_col)._sql(ctx)
            for value in values:
                condition = "%s IS NOT DISTINCT FROM %s" % (pivot_sql, _lit_sql(value))
                pivot_ctx = _Ctx(ctx.sources, ctx.from_sql, agg_filter=condition)
                for column in exprs:
                    name = _lit_name(value) if len(exprs) == 1 else "%s_%s" % (_lit_name(value), column._name)
                    internal = _unique(name, taken)
                    taken.add(internal)
                    select.append(
                        "CASE WHEN count(*) FILTER (WHERE %s) > 0 THEN %s END AS %s"
                        % (condition, column._sql(pivot_ctx), _q(internal))
                    )
                    fields.append(_Field(name, internal))
        group_sql = ""
        if groups:
            if self._mode:
                group_sql = " GROUP BY %s (%s)" % (self._mode, ", ".join(groups))
            else:
                group_sql = " GROUP BY %s" % ", ".join(groups)
        sql = "SELECT %s FROM (%s) AS %s%s" % (", ".join(select), df._sql_text, alias, group_sql)
        detail = "[%s], [%s]" % (
            ", ".join(_to_col(key)._name for key in self._keys),
            ", ".join(column._name for column in exprs),
        )
        return df._new(sql, fields, _Plan("Aggregate", detail, [df._plan]))

    def count(self):
        return self.agg(_agg_call("count", _lit(1), name_arg="1").alias("count"))

    def _simple(self, fn, cols):
        names = cols or [
            name
            for name, kind in self._df._describe()
            if kind.upper()
            in ("INTEGER", "BIGINT", "SMALLINT", "TINYINT", "HUGEINT", "DOUBLE", "FLOAT")
            or kind.upper().startswith("DECIMAL")
        ]
        key_names = {_to_col(key)._name.lower() for key in self._keys}
        return self.agg(*[_agg_call(fn, _col(name)) for name in names if cols or name.lower() not in key_names])

    def sum(self, *cols):
        return self._simple("sum", cols)

    def avg(self, *cols):
        return self._simple("avg", cols)

    mean = avg

    def max(self, *cols):
        return self._simple("max", cols)

    def min(self, *cols):
        return self._simple("min", cols)

    def applyInPandas(self, func, schema):
        raise PySparkException("applyInPandas is not available in this sandbox.")


# --------------------------------------------------------------------------
# Session, reader, writer and catalog
# --------------------------------------------------------------------------


class _Stored:
    def __init__(self, key, table, partition_cols):
        self.key = key
        self.table = table
        self.partition_cols = list(partition_cols)


class RuntimeConfig:
    def __init__(self):
        self._values = {
            "spark.sql.shuffle.partitions": "200",
            "spark.sql.sources.partitionOverwriteMode": "static",
            "spark.sql.adaptive.enabled": "true",
        }

    def set(self, key, value):
        self._values[key] = str(value).lower() if isinstance(value, bool) else str(value)

    def get(self, key, default=None):
        return self._values.get(key, default)

    def unset(self, key):
        self._values.pop(key, None)

    def isModifiable(self, key):
        return True


class _SparkContext:
    def setLogLevel(self, level):
        return None

    def parallelize(self, *args, **kwargs):
        raise PySparkException(
            "This sandbox runs the DataFrame API only. Use spark.createDataFrame(...) instead of "
            "parallelize."
        )

    @property
    def defaultParallelism(self):
        return 8

    def setJobDescription(self, value):
        return None

    def setJobGroup(self, *args, **kwargs):
        return None

    @property
    def applicationId(self):
        return "local-sandbox"

    def broadcast(self, value):
        return _Broadcast(value)


class _Broadcast:
    def __init__(self, value):
        self.value = value


class SparkSession:
    class _Builder:
        def appName(self, name):
            return self

        def master(self, master):
            return self

        def config(self, key=None, value=None, conf=None, **kwargs):
            self._pending = getattr(self, "_pending", [])
            if key is not None:
                self._pending.append((key, value))
            return self

        def enableHiveSupport(self):
            return self

        def remote(self, url):
            return self

        def getOrCreate(self):
            session = SparkSession._get()
            for key, value in getattr(self, "_pending", []):
                session.conf.set(key, value)
            self._pending = []
            return session

        create = getOrCreate

    builder = _Builder()

    def __init__(self):
        self.conf = RuntimeConfig()
        self.sparkContext = _SparkContext()
        self._store = {}
        self._views = {}
        self.catalog = _Catalog(self)
        self.version = __version__

    @classmethod
    def _get(cls):
        if _state["session"] is None:
            _state["session"] = SparkSession()
        return _state["session"]

    @classmethod
    def getActiveSession(cls):
        return cls._get()

    active = getActiveSession

    def newSession(self):
        return self

    def stop(self):
        return None

    @property
    def read(self):
        return DataFrameReader(self)

    @property
    def readStream(self):
        raise PySparkException("Structured Streaming is not available in this sandbox.")

    @property
    def udf(self):
        return _UDFRegistration()

    def range(self, start, end=None, step=1, numPartitions=None):
        if end is None:
            start, end = 0, start
        sql = "SELECT CAST(range AS BIGINT) AS id FROM range(%d, %d, %d)" % (start, end, step)
        return DataFrame(self, sql, [_Field("id", "id")], _Plan("Range", "(%d, %d, step=%d)" % (start, end, step)))

    def createDataFrame(self, data, schema=None, samplingRatio=None, verifySchema=True):
        if hasattr(data, "to_dict") and hasattr(data, "columns") and hasattr(data, "itertuples"):
            names = [str(name) for name in data.columns]
            records = []
            for row in data.itertuples(index=False, name=None):
                records.append(tuple(_from_pandas(value) for value in row))
            data = records
            if schema is None:
                schema = names
        if isinstance(data, DataFrame):
            return data
        rows = list(data)
        if isinstance(schema, str):
            text = schema.strip()
            if (":" in text or " " in text or "," in text) and not _re.match(r"^\w+$", text):
                schema = _parse_schema_ddl(text)
            else:
                schema = StructType([StructField("value", _parse_type(text))])
                rows = [(row,) for row in rows]
        elif isinstance(schema, DataType) and not isinstance(schema, StructType):
            schema = StructType([StructField("value", schema)])
            rows = [(row,) for row in rows]
        if isinstance(schema, StructType):
            names = schema.names
            types = [field.dataType for field in schema.fields]
            values = [self._row_values(row, names) for row in rows]
        else:
            if schema is not None:
                names = list(schema)
                values = [self._row_values(row, names, positional=True) for row in rows]
            elif rows and isinstance(rows[0], dict):
                keys = []
                for row in rows:
                    for key in row.keys():
                        if key not in keys:
                            keys.append(key)
                names = sorted(keys)
                values = [[row.get(name) for name in names] for row in rows]
            elif rows and isinstance(rows[0], Row) and rows[0]._fields is not None:
                names = list(rows[0]._fields)
                values = [list(row) for row in rows]
            elif rows and not isinstance(rows[0], (list, tuple)):
                raise PySparkTypeError(
                    "[CANNOT_INFER_SCHEMA_FOR_TYPE] Can not infer schema for type: `%s`."
                    % type(rows[0]).__name__
                )
            else:
                width = len(rows[0]) if rows else 0
                names = ["_%d" % (index + 1) for index in range(width)]
                values = [list(row) for row in rows]
            types = []
            for index in range(len(names)):
                kind = None
                for row in values:
                    if index < len(row):
                        kind = _merge_types(kind, _infer_type(row[index]))
                types.append(kind or StringType())
        table = _fresh("data")
        columns = ", ".join("%s %s" % (_q(name), kind._duck()) for name, kind in zip(names, types))
        _run("CREATE TEMP TABLE %s (%s)" % (table, columns or "__empty INTEGER"))
        if values and names:
            converted = [
                [_to_duck_value(row[index] if index < len(row) else None, kind) for index, kind in enumerate(types)]
                for row in values
            ]
            try:
                if not _insert_json(table, names, types, converted):
                    _insert_params(table, names, converted)
            except _duckdb.Error as error:
                raise PySparkTypeError(
                    "[FIELD_DATA_TYPE_UNACCEPTABLE] A value does not match the schema: %s" % error
                ) from None
        fields = [_Field(name, name) for name in names]
        sql = "SELECT %s FROM %s" % (", ".join(_q(name) for name in names) or "*", table)
        return DataFrame(self, sql, fields, _Plan("LocalRelation", "[%s]" % ", ".join(names)))

    def _row_values(self, row, names, positional=False):
        if isinstance(row, dict):
            return [row.get(name) for name in names]
        if isinstance(row, Row) and row._fields is not None and not positional:
            lookup = row.asDict()
            return [lookup.get(name) for name in names]
        if isinstance(row, (list, tuple)):
            if len(row) != len(names):
                raise PySparkValueError(
                    "[LENGTH_SHOULD_BE_THE_SAME] obj and fields should be of the same length, got "
                    "%d and %d." % (len(row), len(names))
                )
            return list(row)
        return [row]

    def sql(self, query, args=None, **kwargs):
        text = query.strip().rstrip(";")
        cursor_sql = _translate_spark_sql(text)
        try:
            described = _con().execute("DESCRIBE " + cursor_sql).fetchall()
        except _duckdb.Error as error:
            if _re.match(r"^\s*(create|insert|drop|delete|update|merge|set|use|alter)\b", text, _re.I):
                _run(cursor_sql)
                return self.createDataFrame([], StructType([]))
            raise _sql_error(error) from None
        names = [row[0] for row in described]
        fields = [_Field(name, name) for name in names]
        sql = "SELECT * FROM (%s) AS %s" % (cursor_sql, _fresh("q"))
        return DataFrame(self, sql, fields, _Plan("SQL", text[:60]))

    def table(self, name):
        return self.read.table(name)


def _from_pandas(value):
    try:
        import pandas as pd

        if value is pd.NaT:
            return None
        if isinstance(value, pd.Timestamp):
            return value.to_pydatetime()
    except ImportError:
        pass
    if isinstance(value, float) and value != value:
        return None
    if hasattr(value, "item") and not isinstance(value, (list, dict, str, bytes)):
        try:
            return value.item()
        except (ValueError, AttributeError):
            return value
    return value


def _translate_spark_sql(text):
    """Small Spark SQL to DuckDB fixes for the common interview queries."""
    out = text
    out = _re.sub(r"\bdatediff\s*\(", "__spark_datediff(", out, flags=_re.I)
    out = _re.sub(r"\bcollect_list\s*\(", "list(", out, flags=_re.I)
    out = _re.sub(r"\bcollect_set\s*\(", "__spark_collect_set(", out, flags=_re.I)
    out = _re.sub(r"\bsize\s*\(", "len(", out, flags=_re.I)
    out = _re.sub(r"\bnvl\s*\(", "coalesce(", out, flags=_re.I)
    out = _re.sub(r"`([^`]*)`", lambda m: _q(m.group(1)), out)
    return out


class _Catalog:
    def __init__(self, session):
        self._session = session

    def tableExists(self, name, dbName=None):
        key = (dbName + "." + name if dbName else name).lower()
        return key in self._session._store

    def listTables(self, dbName=None):
        return [
            _types.SimpleNamespace(name=key, database=None, isTemporary=False)
            for key in self._session._store
        ]

    def dropTempView(self, name):
        self._session._views.pop(name.lower(), None)
        return True

    def clearCache(self):
        return None

    def cacheTable(self, name):
        return None

    def uncacheTable(self, name):
        return None

    def refreshTable(self, name):
        return None


def _store_key(path_or_name):
    return str(path_or_name).rstrip("/").lower()


class DataFrameReader:
    def __init__(self, session):
        self._session = session
        self._format = "parquet"
        self._options = {}

    def format(self, source):
        self._format = source
        return self

    def option(self, key, value):
        self._options[key] = value
        return self

    def options(self, **options):
        self._options.update(options)
        return self

    def schema(self, schema):
        return self

    def load(self, path=None, format=None, **options):
        return self._read(path)

    def parquet(self, *paths, **options):
        return self._read(paths[0])

    def json(self, path, *args, **kwargs):
        return self._read(path)

    def csv(self, path, *args, **kwargs):
        return self._read(path)

    def orc(self, path, *args, **kwargs):
        return self._read(path)

    def table(self, name):
        return self._read(name, is_table=True)

    def _read(self, path, is_table=False):
        if isinstance(path, (list, tuple)):
            path = path[0]
        key = _store_key(path)
        stored = self._session._store.get(key)
        if stored is None:
            if is_table and key in self._session._views:
                return self._session._views[key]
            if is_table:
                raise AnalysisException(
                    "[TABLE_OR_VIEW_NOT_FOUND] The table or view `%s` cannot be found. Verify the "
                    "spelling and correctness of the schema and catalog." % path
                )
            raise AnalysisException("[PATH_NOT_FOUND] Path does not exist: %s." % path)
        return _scan_stored(self._session, stored)


def _scan_stored(session, stored):
    described = _run("DESCRIBE SELECT * FROM %s" % stored.table).fetchall()
    names = [row[0] for row in described]
    partitions = 1
    if stored.partition_cols:
        partitions = _run(
            "SELECT count(*) FROM (SELECT DISTINCT %s FROM %s)"
            % (", ".join(_q(name) for name in stored.partition_cols), stored.table)
        ).fetchone()[0]
    scan = _Scan(stored.key, stored.partition_cols, partitions)
    plan = _Plan("Scan", stored.key, scan=scan)
    fields = [_Field(name, name) for name in names]
    sql = "SELECT %s FROM %s" % (", ".join(_q(name) for name in names), stored.table)
    df = DataFrame(session, sql, fields, plan)
    df._scan_lineage = (scan, plan)
    return df


class DataFrameWriter:
    def __init__(self, df):
        self._df = df
        self._mode = "errorifexists"
        self._format = "parquet"
        self._options = {}
        self._partition_by = []

    def mode(self, saveMode):
        mode = (saveMode or "errorifexists").lower()
        if mode == "error":
            mode = "errorifexists"
        if mode not in ("append", "overwrite", "ignore", "errorifexists"):
            raise PySparkValueError("[INVALID_SAVE_MODE] Unknown save mode: %s." % saveMode)
        self._mode = mode
        return self

    def format(self, source):
        self._format = source
        return self

    def option(self, key, value):
        self._options[key] = value
        return self

    def options(self, **options):
        self._options.update(options)
        return self

    def partitionBy(self, *cols):
        self._partition_by = _flatten_cols(cols)
        return self

    def bucketBy(self, *args, **kwargs):
        return self

    def sortBy(self, *args, **kwargs):
        return self

    def save(self, path=None, format=None, mode=None, partitionBy=None, **options):
        if mode:
            self.mode(mode)
        if partitionBy:
            self.partitionBy(partitionBy)
        self._options.update(options)
        self._write(path)

    def parquet(self, path, mode=None, partitionBy=None, compression=None):
        self.save(path, mode=mode, partitionBy=partitionBy)

    def json(self, path, mode=None, **kwargs):
        self.save(path, mode=mode)

    def csv(self, path, mode=None, **kwargs):
        self.save(path, mode=mode)

    def orc(self, path, mode=None, partitionBy=None, **kwargs):
        self.save(path, mode=mode, partitionBy=partitionBy)

    def saveAsTable(self, name, format=None, mode=None, partitionBy=None, **options):
        if mode:
            self.mode(mode)
        if partitionBy:
            self.partitionBy(partitionBy)
        self._options.update(options)
        self._write(name, as_table=True)

    def insertInto(self, tableName, overwrite=None):
        session = self._df.sparkSession
        key = _store_key(tableName)
        stored = session._store.get(key)
        if stored is None:
            raise AnalysisException(
                "[TABLE_OR_VIEW_NOT_FOUND] The table or view `%s` cannot be found." % tableName
            )
        columns = [row[0] for row in _run("DESCRIBE SELECT * FROM %s" % stored.table).fetchall()]
        visible = self._df.columns
        if len(visible) != len(columns):
            raise AnalysisException(
                "[INSERT_COLUMN_ARITY_MISMATCH] Cannot write to `%s`: the table has %d columns "
                "and the data has %d." % (tableName, len(columns), len(visible))
            )
        positional = self._df.toDF(*columns)
        replace = overwrite if overwrite is not None else self._mode == "overwrite"
        self._apply(stored, positional, "overwrite" if replace else "append", stored.partition_cols)

    def _dynamic(self):
        value = self._options.get("partitionOverwriteMode") or self._df.sparkSession.conf.get(
            "spark.sql.sources.partitionOverwriteMode", "static"
        )
        return str(value).lower() == "dynamic"

    def _write(self, path, as_table=False):
        if path is None:
            raise PySparkValueError("A path or table name is required.")
        session = self._df.sparkSession
        key = _store_key(path)
        stored = session._store.get(key)
        df = self._df
        partition_cols = self._partition_by
        if partition_cols:
            others = [name for name in df.columns if name not in partition_cols]
            df = df.select(*(others + list(partition_cols)))
        if stored is None:
            table = _fresh("stored")
            _run("CREATE TABLE %s AS %s" % (table, df._output_sql()))
            session._store[key] = _Stored(key, table, partition_cols)
            _register_table_name(path, table)
            return
        if self._mode == "errorifexists":
            raise AnalysisException(
                "[PATH_ALREADY_EXISTS] Path %s already exists. Set mode as \"overwrite\" to "
                "overwrite the existing path." % path
            )
        if self._mode == "ignore":
            return
        if as_table and self._mode == "overwrite" and not self._options.get("replaceWhere"):
            table = _fresh("stored")
            _run("CREATE TABLE %s AS %s" % (table, df._output_sql()))
            session._store[key] = _Stored(key, table, partition_cols)
            _register_table_name(path, table)
            return
        self._apply(stored, df, self._mode, partition_cols or stored.partition_cols)

    def _apply(self, stored, df, mode, partition_cols):
        data_sql = df._output_sql()
        if mode == "append":
            _run("INSERT INTO %s BY NAME %s" % (stored.table, data_sql))
            return
        replace_where = self._options.get("replaceWhere")
        if replace_where:
            staged = _fresh("staged")
            _run("CREATE TEMP TABLE %s AS %s" % (staged, data_sql))
            bad = _run(
                "SELECT count(*) FROM %s WHERE NOT (%s)" % (staged, _translate_spark_sql(replace_where))
            ).fetchone()[0]
            if bad:
                raise AnalysisException(
                    "[DELTA_REPLACE_WHERE_MISMATCH] Written data does not conform to partial table "
                    "overwrite condition or constraint '%s'." % replace_where
                )
            _run("DELETE FROM %s WHERE %s" % (stored.table, _translate_spark_sql(replace_where)))
            _run("INSERT INTO %s BY NAME SELECT * FROM %s" % (stored.table, staged))
            return
        if partition_cols and self._dynamic():
            staged = _fresh("staged")
            _run("CREATE TEMP TABLE %s AS %s" % (staged, data_sql))
            keys = ", ".join(_q(name) for name in partition_cols)
            _run(
                "DELETE FROM %s WHERE (%s) IN (SELECT DISTINCT %s FROM %s)"
                % (stored.table, keys, keys, staged)
            )
            _run("INSERT INTO %s BY NAME SELECT * FROM %s" % (stored.table, staged))
            return
        _run("DELETE FROM %s" % stored.table)
        _run("INSERT INTO %s BY NAME %s" % (stored.table, data_sql))
        if partition_cols:
            stored.partition_cols = list(partition_cols)


def _register_table_name(path, table):
    text = str(path)
    if "/" in text or ":" in text:
        return
    parts = text.split(".")
    try:
        if len(parts) == 2:
            _run("CREATE SCHEMA IF NOT EXISTS %s" % _q(parts[0]))
            _run("CREATE OR REPLACE VIEW %s.%s AS SELECT * FROM %s" % (_q(parts[0]), _q(parts[1]), table))
        elif len(parts) == 1:
            _run("CREATE OR REPLACE VIEW %s AS SELECT * FROM %s" % (_q(parts[0]), table))
    except AnalysisException:
        return


def _save_table(session, name, df, partition_cols=()):
    """Harness helper: store a DataFrame as a table or path, partitioned like a lake table."""
    writer = df.write.mode("overwrite")
    if partition_cols:
        writer = writer.partitionBy(*partition_cols)
    key = _store_key(name)
    session._store.pop(key, None)
    writer._write(name)


# --------------------------------------------------------------------------
# UDFs
# --------------------------------------------------------------------------


def _udf_wrap(function, return_type):
    data_type = _parse_type(return_type) if isinstance(return_type, str) else (return_type or StringType())
    name = _fresh("udf")
    registered = {}

    def make(*cols):
        columns = [_to_col(col) for col in cols]

        def render(ctx):
            _state["udf_used"] = True
            arg_sql = [column._sql(ctx) for column in columns]
            arg_types = tuple(ctx.type_of(sql) for sql in arg_sql)
            key = (arg_types,)
            if key not in registered:
                function_name = "%s_%d" % (name, len(registered) + 1)

                def call(*args):
                    try:
                        return _to_duck_value(function(*[_from_duck(a, t) for a, t in zip(args, arg_types)]), data_type)
                    except Exception as error:  # noqa: BLE001 - surface the learner's error
                        raise RuntimeError(
                            "[PYTHON_UDF_FAILED] %s: %s" % (type(error).__name__, error)
                        ) from None

                from duckdb import sqltypes as _st

                params = [_duck_type_object(t) for t in arg_types]
                _con().create_function(
                    function_name,
                    call,
                    params,
                    _duck_type_object(data_type._duck()),
                    null_handling="special",
                    side_effects=False,
                )
                registered[key] = function_name
            return "%s(%s)" % (registered[key], ", ".join(arg_sql))

        label = "%s(%s)" % (getattr(function, "__name__", "udf"), ", ".join(column._name for column in columns))
        return Column(render, label, udf=True, refs=set().union(*[c._refs for c in columns]) if columns else ())

    make.func = function
    make.returnType = data_type
    make.__name__ = getattr(function, "__name__", "udf")
    make.asNondeterministic = lambda: make
    return make


def _duck_type_object(text):
    return _duckdb.typing.DuckDBPyType(text) if hasattr(_duckdb, "typing") else text


def udf(f=None, returnType=None, useArrow=None):
    if f is None or isinstance(f, (str, DataType)):
        return_type = f if returnType is None else returnType

        def decorator(function):
            return _udf_wrap(function, return_type or StringType())

        return decorator
    return _udf_wrap(f, returnType or StringType())


class _UDFRegistration:
    def register(self, name, f, returnType=None):
        wrapped = f if hasattr(f, "func") else _udf_wrap(f, returnType or StringType())
        return wrapped


def pandas_udf(f=None, returnType=None, functionType=None):
    raise PySparkException(
        "pandas_udf needs Apache Arrow, which this sandbox does not include. Use built-in "
        "functions, or F.udf for a plain Python UDF."
    )


# --------------------------------------------------------------------------
# Functions (pyspark.sql.functions)
# --------------------------------------------------------------------------

_F = {}


def _fn(name=None):
    def register(function):
        _F[name or function.__name__.lstrip("_")] = function
        return function

    return register


def _args(cols):
    return [_to_col(col) for col in cols]


def _call(sql_name, cols, spark_name=None, agg=False, literal_args=()):
    columns = _args(cols)
    literals = list(literal_args)

    def render(ctx):
        parts = [column._sql(ctx) for column in columns] + [_lit_sql(item) for item in literals]
        text = "%s(%s)" % (sql_name, ", ".join(parts))
        if agg and ctx.agg_filter:
            text += ctx.agg_filter_sql()
        return text

    label = "%s(%s)" % (
        spark_name or sql_name,
        ", ".join([column._name for column in columns] + [_lit_name(item) for item in literals]),
    )
    base = Column(render, label, agg=agg)
    return base._derive(render, label, *columns, agg=agg or None) if columns else base


def _agg_call(fn, column, name_arg=None, distinct=False):
    column = _to_col(column)
    label = "%s(%s%s)" % (fn, "DISTINCT " if distinct else "", name_arg or column._name)

    def render(ctx):
        inner = column._sql(ctx)
        text = "%s(%s%s)" % (fn, "DISTINCT " if distinct else "", inner)
        if ctx.agg_filter:
            text += ctx.agg_filter_sql()
        return text

    return column._derive(render, label, agg=True)


def col(name):
    return _col(name)


_F["col"] = col
_F["column"] = col
_F["lit"] = _lit


@_fn()
def expr(text):
    """A SQL expression string. It runs on DuckDB, so most Spark SQL works unchanged."""
    if isinstance(text, Column):
        return text
    translated = _translate_spark_sql(text)
    tokens = set(_re.findall(r"[A-Za-z_][A-Za-z0-9_]*", text))
    is_agg = bool(
        _re.search(
            r"\b(sum|count|avg|min|max|collect_list|collect_set|first|last|mean|stddev)\s*\(",
            text,
            _re.I,
        )
    ) and not _re.search(r"\bover\s*\(", text, _re.I)

    def render(ctx):
        out = translated
        names = sorted(
            {field.name for _, field in ctx._visible()}, key=len, reverse=True
        )
        if len(ctx.sources) == 1:
            alias = ctx.sources[0][0]
            for field in ctx.sources[0][1]:
                if field.name != field.internal:
                    out = _re.sub(
                        r'(?<![\w".])%s(?![\w"])' % _re.escape(field.name),
                        "%s.%s" % (alias, _q(field.internal)),
                        out,
                    )
        return "(%s)" % out

    name = text
    match = _re.match(r"^(.*?)\s+(?:as\s+)?`?([A-Za-z_][\w]*)`?\s*$", text.strip(), _re.I)
    if match and _re.search(r"\s+as\s+", text, _re.I):
        inner_text = _re.split(r"\s+as\s+", text.strip(), flags=_re.I)
        alias_name = inner_text[-1].strip("` ")
        body = " as ".join(inner_text[:-1])
        inner = expr(body)
        return inner.alias(alias_name)
    return Column(render, name, agg=is_agg, refs=tokens)


@_fn()
def broadcast(df):
    return df


@_fn("asc")
def _asc(name):
    return _to_col(name).asc()


@_fn("desc")
def _desc(name):
    return _to_col(name).desc()


@_fn()
def asc_nulls_first(name):
    return _to_col(name).asc_nulls_first()


@_fn()
def asc_nulls_last(name):
    return _to_col(name).asc_nulls_last()


@_fn()
def desc_nulls_first(name):
    return _to_col(name).desc_nulls_first()


@_fn()
def desc_nulls_last(name):
    return _to_col(name).desc_nulls_last()


# -- aggregates -------------------------------------------------------------


def _agg(fn, spark=None):
    def function(column):
        return _agg_call(fn, column)._rename_fn(spark) if spark else _agg_call(fn, column)

    return function


def _rename_fn(self, spark_name):
    self._name = _re.sub(r"^[a-z_]+\(", spark_name + "(", self._name)
    return self


Column._rename_fn = _rename_fn


@_fn("sum")
def _sum(column):
    return _agg_call("sum", column)


@_fn("avg")
def _avg(column):
    return _agg_call("avg", column)


_F["mean"] = _F["avg"]


@_fn("min")
def _min(column):
    return _agg_call("min", column)


@_fn("max")
def _max(column):
    return _agg_call("max", column)


@_fn("count")
def _count(column):
    if isinstance(column, str) and column == "*":
        return _agg_call("count", _lit(1), name_arg="1")
    return _agg_call("count", column)


@_fn()
def countDistinct(column, *cols):
    columns = _args((column,) + cols)
    if len(columns) == 1:
        return _agg_call("count", columns[0], distinct=True)

    def render(ctx):
        parts = [item._sql(ctx) for item in columns]
        condition = " AND ".join("%s IS NOT NULL" % part for part in parts)
        text = "count(DISTINCT CASE WHEN %s THEN row(%s) END)" % (condition, ", ".join(parts))
        return text + ctx.agg_filter_sql()

    label = "count(DISTINCT %s)" % ", ".join(item._name for item in columns)
    return columns[0]._derive(render, label, *columns[1:], agg=True)


_F["count_distinct"] = countDistinct


@_fn()
def sum_distinct(column):
    return _agg_call("sum", column, distinct=True)


_F["sumDistinct"] = sum_distinct


@_fn()
def approx_count_distinct(column, rsd=None):
    return _agg_call("count", column, distinct=True)._rename_fn("approx_count_distinct")


_F["approxCountDistinct"] = approx_count_distinct


@_fn()
def first(column, ignorenulls=False):
    column = _to_col(column)

    def render(ctx):
        inner = column._sql(ctx)
        if ignorenulls:
            text = "first(%s) FILTER (WHERE %s IS NOT NULL)" % (inner, inner)
            if ctx.agg_filter:
                text = "first(%s) FILTER (WHERE %s IS NOT NULL AND %s)" % (inner, inner, ctx.agg_filter)
            return text
        return "first(%s)%s" % (inner, ctx.agg_filter_sql())

    return column._derive(render, "first(%s)" % column._name, agg=True)


@_fn()
def last(column, ignorenulls=False):
    column = _to_col(column)

    def render(ctx):
        inner = column._sql(ctx)
        if ignorenulls:
            return "last(%s) FILTER (WHERE %s IS NOT NULL)" % (inner, inner)
        return "last(%s)%s" % (inner, ctx.agg_filter_sql())

    return column._derive(render, "last(%s)" % column._name, agg=True)


_F["any_value"] = _F["first"]
_F["first_value"] = _F["first"]
_F["last_value"] = _F["last"]


@_fn()
def collect_list(column):
    column = _to_col(column)

    def render(ctx):
        inner = column._sql(ctx)
        condition = "%s IS NOT NULL" % inner
        if ctx.agg_filter:
            condition += " AND " + ctx.agg_filter
        return "COALESCE(list(%s) FILTER (WHERE %s), [])" % (inner, condition)

    return column._derive(render, "collect_list(%s)" % column._name, agg=True)


@_fn()
def collect_set(column):
    column = _to_col(column)

    def render(ctx):
        inner = column._sql(ctx)
        condition = "%s IS NOT NULL" % inner
        if ctx.agg_filter:
            condition += " AND " + ctx.agg_filter
        return "COALESCE(list(DISTINCT %s) FILTER (WHERE %s), [])" % (inner, condition)

    return column._derive(render, "collect_set(%s)" % column._name, agg=True)


@_fn()
def stddev(column):
    return _agg_call("stddev_samp", column)._rename_fn("stddev")


_F["stddev_samp"] = stddev
_F["std"] = stddev


@_fn()
def stddev_pop(column):
    return _agg_call("stddev_pop", column)


@_fn()
def variance(column):
    return _agg_call("var_samp", column)._rename_fn("variance")


_F["var_samp"] = variance


@_fn()
def var_pop(column):
    return _agg_call("var_pop", column)


@_fn()
def median(column):
    return _agg_call("median", column)


@_fn()
def mode(column, deterministic=False):
    return _agg_call("mode", column)


@_fn()
def max_by(column, ordering):
    return _call("arg_max", (column, ordering), "max_by", agg=True)


@_fn()
def min_by(column, ordering):
    return _call("arg_min", (column, ordering), "min_by", agg=True)


@_fn()
def percentile_approx(column, percentage, accuracy=10000):
    column = _to_col(column)
    if isinstance(percentage, (list, tuple)):
        values = "[%s]" % ", ".join(repr(float(item)) for item in percentage)
    else:
        values = repr(float(percentage))
    return column._derive(
        lambda ctx: "quantile_disc(%s, %s)%s" % (column._sql(ctx), values, ctx.agg_filter_sql()),
        "percentile_approx(%s, %s, %s)" % (column._name, percentage, accuracy),
        agg=True,
    )


_F["approx_percentile"] = percentile_approx


@_fn()
def percentile(column, percentage, frequency=1):
    column = _to_col(column)
    return column._derive(
        lambda ctx: "quantile_cont(%s, %s)%s" % (column._sql(ctx), float(percentage), ctx.agg_filter_sql()),
        "percentile(%s, %s, %s)" % (column._name, percentage, frequency),
        agg=True,
    )


@_fn()
def bool_and(column):
    return _agg_call("bool_and", column)


_F["every"] = bool_and


@_fn()
def bool_or(column):
    return _agg_call("bool_or", column)


_F["some"] = bool_or


@_fn()
def count_if(column):
    column = _to_col(column)
    return column._derive(
        lambda ctx: "count_if(%s)%s" % (column._sql(ctx), ctx.agg_filter_sql()),
        "count_if(%s)" % column._name,
        agg=True,
    )


@_fn()
def product(column):
    return _agg_call("product", column)


@_fn()
def corr(col1, col2):
    return _call("corr", (col1, col2), agg=True)


# -- window functions -------------------------------------------------------


def _window_fn(sql_name, spark_name=None):
    def function():
        return Column(lambda ctx: "%s()" % sql_name, "%s()" % (spark_name or sql_name))

    return function


_F["row_number"] = _window_fn("row_number")
_F["rank"] = _window_fn("rank")
_F["dense_rank"] = _window_fn("dense_rank")
_F["percent_rank"] = _window_fn("percent_rank")
_F["cume_dist"] = _window_fn("cume_dist")


@_fn()
def ntile(n):
    return Column(lambda ctx: "ntile(%d)" % n, "ntile(%d)" % n)


@_fn()
def lag(column, offset=1, default=None):
    column = _to_col(column)
    return column._derive(
        lambda ctx: "lag(%s, %d, %s)" % (column._sql(ctx), offset, _lit_sql(default)),
        "lag(%s, %d, %s)" % (column._name, offset, _lit_name(default)),
    )


@_fn()
def lead(column, offset=1, default=None):
    column = _to_col(column)
    return column._derive(
        lambda ctx: "lead(%s, %d, %s)" % (column._sql(ctx), offset, _lit_sql(default)),
        "lead(%s, %d, %s)" % (column._name, offset, _lit_name(default)),
    )


@_fn()
def nth_value(column, offset, ignoreNulls=False):
    column = _to_col(column)
    return column._derive(
        lambda ctx: "nth_value(%s, %d)" % (column._sql(ctx), offset),
        "nth_value(%s, %d)" % (column._name, offset),
    )


@_fn()
def monotonically_increasing_id():
    return Column(lambda ctx: "(row_number() OVER () - 1)", "monotonically_increasing_id()")


@_fn()
def spark_partition_id():
    return Column(lambda ctx: "0", "SPARK_PARTITION_ID()")


@_fn()
def input_file_name():
    return Column(lambda ctx: "''", "input_file_name()")


# -- conditionals and nulls -------------------------------------------------


@_fn()
def when(condition, value):
    return _case([(condition, value)], None)


@_fn()
def coalesce(*cols):
    return _call("COALESCE", cols, "coalesce")


_F["coalesce"] = coalesce


@_fn()
def nvl(col1, col2):
    return _call("COALESCE", (col1, col2), "nvl")


_F["ifnull"] = nvl


@_fn()
def nullif(col1, col2):
    return _call("NULLIF", (col1, col2), "nullif")


@_fn()
def isnull(column):
    return _to_col(column).isNull()


@_fn()
def isnotnull(column):
    return _to_col(column).isNotNull()


@_fn()
def isnan(column):
    return _to_col(column).isNaN()


@_fn()
def nanvl(col1, col2):
    a, b = _to_col(col1), _to_col(col2)
    return a._derive(
        lambda ctx: "CASE WHEN isnan(%s) THEN %s ELSE %s END" % (a._sql(ctx), b._sql(ctx), a._sql(ctx)),
        "nanvl(%s, %s)" % (a._name, b._name),
        b,
    )


@_fn()
def greatest(*cols):
    return _call("greatest", cols)


@_fn()
def least(*cols):
    return _call("least", cols)


# -- math ---------------------------------------------------------------------


def _simple_fn(sql_name, spark_name=None):
    def function(column):
        return _call(sql_name, (column,), spark_name or sql_name)

    return function


for _name, _sql_name in (
    ("abs", "abs"),
    ("sqrt", "sqrt"),
    ("exp", "exp"),
    ("log10", "log10"),
    ("log2", "log2"),
    ("signum", "sign"),
    ("sign", "sign"),
    ("sin", "sin"),
    ("cos", "cos"),
    ("tan", "tan"),
    ("lower", "lower"),
    ("upper", "upper"),
    ("trim", "trim"),
    ("ltrim", "ltrim"),
    ("rtrim", "rtrim"),
    ("reverse", "reverse"),
    ("md5", "md5"),
    ("year", "year"),
    ("month", "month"),
    ("quarter", "quarter"),
    ("hour", "hour"),
    ("minute", "minute"),
    ("dayofmonth", "dayofmonth"),
    ("dayofyear", "dayofyear"),
    ("weekofyear", "week"),
    ("last_day", "last_day"),
    ("initcap", "initcap"),
    ("unbase64", "from_base64"),
    ("base64", "to_base64"),
    ("ascii", "ascii"),
    ("array_distinct", "list_distinct"),
    ("flatten", "flatten"),
    ("map_keys", "map_keys"),
    ("map_values", "map_values"),
):
    _F[_name] = _simple_fn(_sql_name, _name)

_F["lcase"] = _F["lower"]
_F["ucase"] = _F["upper"]
_F["day"] = _F["dayofmonth"]


@_fn()
def second(column):
    column = _to_col(column)
    return column._derive(
        lambda ctx: "CAST(floor(second(%s)) AS INTEGER)" % column._sql(ctx),
        "second(%s)" % column._name,
    )


@_fn()
def ceil(column, scale=None):
    column = _to_col(column)
    return column._derive(
        lambda ctx: "CAST(ceil(%s) AS BIGINT)" % column._sql(ctx), "CEIL(%s)" % column._name
    )


_F["ceiling"] = ceil


@_fn()
def floor(column, scale=None):
    column = _to_col(column)
    return column._derive(
        lambda ctx: "CAST(floor(%s) AS BIGINT)" % column._sql(ctx), "FLOOR(%s)" % column._name
    )


@_fn()
def log(arg1, arg2=None):
    if arg2 is None:
        return _call("ln", (arg1,), "ln")
    base = float(arg1)
    column = _to_col(arg2)
    return column._derive(
        lambda ctx: "(ln(%s) / ln(%r))" % (column._sql(ctx), base),
        "LOG(%s, %s)" % (base, column._name),
    )


_F["ln"] = lambda column: _call("ln", (column,), "ln")


@_fn("pow")
def _pow(col1, col2):
    return _to_col(col1, literal=True).__pow__(col2)


_F["power"] = _F["pow"]


@_fn("round")
def _round(column, scale=0):
    column = _to_col(column)

    def render(ctx):
        return "round(%s, %d)" % (column._sql(ctx), scale)

    return column._derive(render, "round(%s, %d)" % (column._name, scale))


@_fn()
def bround(column, scale=0):
    return _call("round_even", (column,), "bround", literal_args=(scale,))


@_fn()
def rand(seed=None):
    return Column(lambda ctx: "random()", "rand()")


@_fn()
def randn(seed=None):
    return Column(lambda ctx: "random()", "randn()")


@_fn()
def try_divide(left, right):
    a, b = _to_col(left), _to_col(right, literal=True)
    return a._derive(
        lambda ctx: "(CAST(%s AS DOUBLE) / NULLIF(CAST(%s AS DOUBLE), 0))" % (a._sql(ctx), b._sql(ctx)),
        "try_divide(%s, %s)" % (a._name, b._name),
        b,
    )


@_fn()
def factorial(column):
    return _call("factorial", (column,))


# -- strings -----------------------------------------------------------------


@_fn()
def length(column):
    return _call("length", (column,))


_F["char_length"] = _F["length"]


@_fn()
def concat(*cols):
    columns = _args(cols)

    def render(ctx):
        parts = [column._sql(ctx) for column in columns]
        kinds = [ctx.type_of(part).upper() for part in parts]
        if kinds and _b.all(kind.endswith("[]") for kind in kinds):
            return "list_concat(%s)" % ", ".join(parts)
        return "(" + " || ".join("CAST(%s AS VARCHAR)" % part for part in parts) + ")"

    label = "concat(%s)" % ", ".join(column._name for column in columns)
    return columns[0]._derive(render, label, *columns[1:])


@_fn()
def concat_ws(sep, *cols):
    columns = _args(cols)

    def render(ctx):
        parts = []
        for column in columns:
            sql = column._sql(ctx)
            if ctx.type_of(sql).upper().endswith("[]"):
                parts.append("array_to_string(%s, %s)" % (sql, _lit_sql(sep)))
            else:
                parts.append("CAST(%s AS VARCHAR)" % sql)
        return "concat_ws(%s, %s)" % (_lit_sql(sep), ", ".join(parts))

    label = "concat_ws(%s, %s)" % (sep, ", ".join(column._name for column in columns))
    return columns[0]._derive(render, label, *columns[1:])


@_fn()
def substring(column, pos, length):
    return _to_col(column).substr(pos, length)


_F["substr"] = substring


@_fn()
def substring_index(column, delim, count):
    column = _to_col(column)

    def render(ctx):
        inner = column._sql(ctx)
        parts = "string_split(%s, %s)" % (inner, _lit_sql(delim))
        if count > 0:
            return "array_to_string(%s[1:%d], %s)" % (parts, count, _lit_sql(delim))
        return "array_to_string(%s[%d:], %s)" % (parts, count, _lit_sql(delim))

    return column._derive(render, "substring_index(%s, %s, %d)" % (column._name, delim, count))


@_fn()
def split(column, pattern, limit=-1):
    column = _to_col(column)
    return column._derive(
        lambda ctx: "string_split_regex(%s, %s)" % (column._sql(ctx), _lit_sql(pattern)),
        "split(%s, %s, %d)" % (column._name, pattern, limit),
    )


def _java_group_refs(replacement):
    return _re.sub(r"\$(\d+)", r"\\\1", replacement)


@_fn()
def regexp_replace(column, pattern, replacement):
    column = _to_col(column)
    pattern_col = _to_col(pattern, literal=True)
    replacement_col = _lit(_java_group_refs(replacement)) if isinstance(replacement, str) else _to_col(replacement)
    return column._derive(
        lambda ctx: "regexp_replace(%s, %s, %s, 'g')"
        % (column._sql(ctx), pattern_col._sql(ctx), replacement_col._sql(ctx)),
        "regexp_replace(%s, %s, %s, 1)" % (column._name, pattern_col._name, replacement_col._name),
    )


@_fn()
def regexp_extract(column, pattern, idx):
    column = _to_col(column)
    return column._derive(
        lambda ctx: "COALESCE(regexp_extract(%s, %s, %d), '')"
        % (column._sql(ctx), _lit_sql(pattern), idx)
        if True
        else "",
        "regexp_extract(%s, %s, %d)" % (column._name, pattern, idx),
    )


@_fn()
def regexp_like(column, pattern):
    return _to_col(column).rlike(pattern if isinstance(pattern, str) else pattern)


_F["rlike"] = regexp_like


@_fn()
def lpad(column, length, pad):
    return _call("lpad", (column,), "lpad", literal_args=(length, pad))


@_fn()
def rpad(column, length, pad):
    return _call("rpad", (column,), "rpad", literal_args=(length, pad))


@_fn()
def repeat(column, n):
    return _call("repeat", (column,), "repeat", literal_args=(n,))


@_fn()
def instr(column, substr):
    return _call("instr", (column,), "instr", literal_args=(substr,))


@_fn()
def locate(substr, column, pos=1):
    column = _to_col(column)
    return column._derive(
        lambda ctx: "instr(%s, %s)" % (column._sql(ctx), _lit_sql(substr)),
        "locate(%s, %s, %d)" % (substr, column._name, pos),
    )


@_fn()
def translate(column, matching, replace):
    return _call("translate", (column,), "translate", literal_args=(matching, replace))


@_fn()
def format_string(fmt, *cols):
    columns = _args(cols)
    return Column(
        lambda ctx: "printf(%s, %s)" % (_lit_sql(fmt), ", ".join(column._sql(ctx) for column in columns)),
        "format_string(%s, %s)" % (fmt, ", ".join(column._name for column in columns)),
    )


_F["printf"] = format_string


@_fn()
def format_number(column, d):
    column = _to_col(column)
    return column._derive(
        lambda ctx: "format('{:,.%df}', %s)" % (d, column._sql(ctx)),
        "format_number(%s, %d)" % (column._name, d),
    )


@_fn()
def sha2(column, numBits):
    if numBits not in (0, 256):
        return _call("sha256", (column,), "sha2")
    return _call("sha256", (column,), "sha2")


@_fn()
def sha1(column):
    return _call("sha1", (column,))


@_fn("hash")
def _hash(*cols):
    columns = _args(cols)
    return Column(
        lambda ctx: "CAST(hash(%s) %% 2147483647 AS INTEGER)" % ", ".join(c._sql(ctx) for c in columns),
        "hash(%s)" % ", ".join(c._name for c in columns),
    )


@_fn()
def xxhash64(*cols):
    columns = _args(cols)
    return Column(
        lambda ctx: "CAST(hash(%s) AS BIGINT)" % ", ".join(c._sql(ctx) for c in columns),
        "xxhash64(%s)" % ", ".join(c._name for c in columns),
    )


@_fn()
def crc32(column):
    return _call("hash", (column,), "crc32")


# -- dates -------------------------------------------------------------------

_JAVA_FORMAT = [
    ("yyyy", "%Y"),
    ("yy", "%y"),
    ("MMMM", "%B"),
    ("MMM", "%b"),
    ("MM", "%m"),
    ("dd", "%d"),
    ("HH", "%H"),
    ("hh", "%I"),
    ("mm", "%M"),
    ("ss", "%S"),
    ("SSSSSS", "%f"),
    ("SSS", "%g"),
    ("EEEE", "%A"),
    ("EEE", "%a"),
    ("a", "%p"),
    ("XXX", "%z"),
    ("Z", "%z"),
]


def _java_to_strftime(fmt):
    out, index = "", 0
    while index < len(fmt):
        if fmt[index] == "'":
            end = fmt.find("'", index + 1)
            end = len(fmt) if end == -1 else end
            out += fmt[index + 1 : end]
            index = end + 1
            continue
        for java, c_format in _JAVA_FORMAT:
            if fmt.startswith(java, index):
                out += c_format
                index += len(java)
                break
        else:
            if fmt[index] == "M":
                out += "%-m"
            elif fmt[index] == "d":
                out += "%-d"
            elif fmt[index] == "T":
                out += "T"
            else:
                out += fmt[index]
            index += 1
    return out


@_fn()
def current_date():
    return Column(lambda ctx: "current_date", "current_date()")


@_fn()
def current_timestamp():
    return Column(lambda ctx: "CAST(current_timestamp AS TIMESTAMP)", "current_timestamp()")


_F["now"] = current_timestamp


@_fn()
def to_date(column, format=None):
    column = _to_col(column)

    def render(ctx):
        inner = column._sql(ctx)
        if format is None:
            kind = ctx.type_of(inner).upper()
            if kind == "VARCHAR":
                return "TRY_CAST(TRY_CAST(%s AS TIMESTAMP) AS DATE)" % inner
            return "CAST(%s AS DATE)" % inner
        return "CAST(try_strptime(%s, %s) AS DATE)" % (inner, _lit_sql(_java_to_strftime(format)))

    return column._derive(render, "to_date(%s)" % column._name)


@_fn()
def to_timestamp(column, format=None):
    column = _to_col(column)

    def render(ctx):
        inner = column._sql(ctx)
        if format is None:
            kind = ctx.type_of(inner).upper()
            if kind in ("BIGINT", "INTEGER", "DOUBLE"):
                return "CAST(to_timestamp(%s) AS TIMESTAMP)" % inner
            if kind == "VARCHAR":
                return "TRY_CAST(replace(replace(%s, 'T', ' '), 'Z', '') AS TIMESTAMP)" % inner
            return "CAST(%s AS TIMESTAMP)" % inner
        return "CAST(try_strptime(%s, %s) AS TIMESTAMP)" % (inner, _lit_sql(_java_to_strftime(format)))

    return column._derive(render, "to_timestamp(%s)" % column._name)


@_fn()
def date_format(column, format):
    column = _to_col(column)
    return column._derive(
        lambda ctx: "strftime(CAST(%s AS TIMESTAMP), %s)" % (column._sql(ctx), _lit_sql(_java_to_strftime(format))),
        "date_format(%s, %s)" % (column._name, format),
    )


@_fn()
def dayofweek(column):
    column = _to_col(column)
    return column._derive(
        lambda ctx: "(dayofweek(%s) + 1)" % column._sql(ctx), "dayofweek(%s)" % column._name
    )


@_fn()
def date_add(column, days):
    column = _to_col(column)
    days_col = _to_col(days, literal=True)
    return column._derive(
        lambda ctx: "CAST(CAST(%s AS DATE) + CAST(%s AS INTEGER) AS DATE)" % (column._sql(ctx), days_col._sql(ctx)),
        "date_add(%s, %s)" % (column._name, days_col._name),
        days_col,
    )


_F["dateadd"] = date_add


@_fn()
def date_sub(column, days):
    column = _to_col(column)
    days_col = _to_col(days, literal=True)
    return column._derive(
        lambda ctx: "CAST(CAST(%s AS DATE) - CAST(%s AS INTEGER) AS DATE)" % (column._sql(ctx), days_col._sql(ctx)),
        "date_sub(%s, %s)" % (column._name, days_col._name),
        days_col,
    )


@_fn()
def datediff(end, start):
    end_col, start_col = _to_col(end), _to_col(start)
    return end_col._derive(
        lambda ctx: "date_diff('day', CAST(%s AS DATE), CAST(%s AS DATE))"
        % (start_col._sql(ctx), end_col._sql(ctx)),
        "datediff(%s, %s)" % (end_col._name, start_col._name),
        start_col,
    )


_F["date_diff"] = datediff


@_fn()
def months_between(date1, date2, roundOff=True):
    a, b = _to_col(date1), _to_col(date2)
    return a._derive(
        lambda ctx: "round(date_diff('day', CAST(%s AS DATE), CAST(%s AS DATE)) / 31.0, 8)"
        % (b._sql(ctx), a._sql(ctx)),
        "months_between(%s, %s, true)" % (a._name, b._name),
        b,
    )


@_fn()
def add_months(column, months):
    column = _to_col(column)
    months_col = _to_col(months, literal=True)
    return column._derive(
        lambda ctx: "CAST(CAST(%s AS DATE) + to_months(CAST(%s AS INTEGER)) AS DATE)"
        % (column._sql(ctx), months_col._sql(ctx)),
        "add_months(%s, %s)" % (column._name, months_col._name),
        months_col,
    )


_TRUNC_UNITS = {
    "year": "year",
    "yyyy": "year",
    "yy": "year",
    "quarter": "quarter",
    "month": "month",
    "mon": "month",
    "mm": "month",
    "week": "week",
    "day": "day",
    "dd": "day",
    "hour": "hour",
    "minute": "minute",
    "second": "second",
}


@_fn()
def trunc(column, format):
    column = _to_col(column)
    unit = _TRUNC_UNITS.get(format.lower(), format.lower())
    return column._derive(
        lambda ctx: "CAST(date_trunc('%s', CAST(%s AS DATE)) AS DATE)" % (unit, column._sql(ctx)),
        "trunc(%s, %s)" % (column._name, format),
    )


@_fn()
def date_trunc(format, timestamp):
    column = _to_col(timestamp)
    unit = _TRUNC_UNITS.get(format.lower(), format.lower())
    return column._derive(
        lambda ctx: "CAST(date_trunc('%s', CAST(%s AS TIMESTAMP)) AS TIMESTAMP)" % (unit, column._sql(ctx)),
        "date_trunc(%s, %s)" % (format, column._name),
    )


@_fn()
def unix_timestamp(timestamp=None, format="yyyy-MM-dd HH:mm:ss"):
    if timestamp is None:
        return Column(lambda ctx: "CAST(epoch(current_timestamp) AS BIGINT)", "unix_timestamp()")
    column = _to_col(timestamp)

    def render(ctx):
        inner = column._sql(ctx)
        kind = ctx.type_of(inner).upper()
        if kind == "VARCHAR":
            inner = "try_strptime(%s, %s)" % (inner, _lit_sql(_java_to_strftime(format)))
        return "CAST(epoch(CAST(%s AS TIMESTAMP)) AS BIGINT)" % inner

    return column._derive(render, "unix_timestamp(%s, %s)" % (column._name, format))


@_fn()
def from_unixtime(timestamp, format="yyyy-MM-dd HH:mm:ss"):
    column = _to_col(timestamp)
    return column._derive(
        lambda ctx: "strftime(CAST(to_timestamp(%s) AS TIMESTAMP), %s)"
        % (column._sql(ctx), _lit_sql(_java_to_strftime(format))),
        "from_unixtime(%s, %s)" % (column._name, format),
    )


@_fn()
def timestamp_seconds(column):
    column = _to_col(column)
    return column._derive(
        lambda ctx: "CAST(to_timestamp(%s) AS TIMESTAMP)" % column._sql(ctx),
        "timestamp_seconds(%s)" % column._name,
    )


@_fn()
def make_date(year, month, day):
    return _call("make_date", (year, month, day))


@_fn("window")
def _time_window(timeColumn, windowDuration, slideDuration=None, startTime=None):
    column = _to_col(timeColumn)
    duration = windowDuration

    def render(ctx):
        start = "time_bucket(INTERVAL '%s', CAST(%s AS TIMESTAMP))" % (duration, column._sql(ctx))
        return "struct_pack(start := %s, \"end\" := %s + INTERVAL '%s')" % (start, start, duration)

    return column._derive(render, "window")


@_fn()
def sequence(start, stop, step=None):
    a, b = _to_col(start), _to_col(stop)
    step_col = _to_col(step, literal=True) if step is not None else None

    def render(ctx):
        a_sql, b_sql = a._sql(ctx), b._sql(ctx)
        kind = ctx.type_of(a_sql).upper()
        if kind in ("DATE", "TIMESTAMP"):
            step_sql = step_col._sql(ctx) if step_col is not None else "INTERVAL 1 DAY"
            series = "generate_series(CAST(%s AS TIMESTAMP), CAST(%s AS TIMESTAMP), %s)" % (a_sql, b_sql, step_sql)
            if kind == "DATE":
                return "list_transform(%s, x -> CAST(x AS DATE))" % series
            return series
        step_sql = step_col._sql(ctx) if step_col is not None else "1"
        return "generate_series(%s, %s, %s)" % (a_sql, b_sql, step_sql)

    return a._derive(render, "sequence(%s, %s)" % (a._name, b._name), b)


# -- collections ---------------------------------------------------------------


@_fn()
def array(*cols):
    columns = _args(_flatten_cols(cols))
    return Column(
        lambda ctx: "[%s]" % ", ".join(column._sql(ctx) for column in columns),
        "array(%s)" % ", ".join(column._name for column in columns),
    )


@_fn()
def struct(*cols):
    columns = _args(_flatten_cols(cols))
    return Column(
        lambda ctx: "struct_pack(%s)"
        % ", ".join("%s := %s" % (_q(column._name), column._sql(ctx)) for column in columns),
        "struct(%s)" % ", ".join(column._name for column in columns),
    )


_F["named_struct"] = lambda *args: struct(*[_to_col(args[i + 1], literal=True).alias(args[i]) for i in range(0, len(args), 2)])


@_fn()
def create_map(*cols):
    columns = _args(_flatten_cols(cols))
    keys, values = columns[0::2], columns[1::2]
    return Column(
        lambda ctx: "MAP {%s}"
        % ", ".join("%s: %s" % (k._sql(ctx), v._sql(ctx)) for k, v in zip(keys, values)),
        "map(%s)" % ", ".join(column._name for column in columns),
    )


@_fn()
def size(column):
    column = _to_col(column)
    return column._derive(
        lambda ctx: "COALESCE(len(%s), -1)" % column._sql(ctx), "size(%s)" % column._name
    )


_F["array_size"] = _F["size"]
_F["cardinality"] = _F["size"]


@_fn()
def array_contains(column, value):
    column = _to_col(column)
    value_col = _to_col(value, literal=True)
    return column._derive(
        lambda ctx: "list_contains(%s, %s)" % (column._sql(ctx), value_col._sql(ctx)),
        "array_contains(%s, %s)" % (column._name, value_col._name),
        value_col,
    )


@_fn()
def element_at(column, extraction):
    column = _to_col(column)

    def render(ctx):
        inner = column._sql(ctx)
        if ctx.type_of(inner).upper().startswith("MAP("):
            return "%s[%s]" % (inner, _lit_sql(extraction))
        return "%s[%s]" % (inner, _lit_sql(extraction) if not isinstance(extraction, Column) else extraction._sql(ctx))

    return column._derive(render, "element_at(%s, %s)" % (column._name, extraction))


@_fn()
def array_join(column, delimiter, null_replacement=None):
    column = _to_col(column)
    return column._derive(
        lambda ctx: "array_to_string(%s, %s)" % (column._sql(ctx), _lit_sql(delimiter)),
        "array_join(%s, %s)" % (column._name, delimiter),
    )


@_fn()
def sort_array(column, asc=True):
    column = _to_col(column)
    return column._derive(
        lambda ctx: "list_sort(%s, '%s', 'NULLS %s')" % (column._sql(ctx), "ASC" if asc else "DESC", "FIRST" if asc else "LAST"),
        "sort_array(%s, %s)" % (column._name, "true" if asc else "false"),
    )


_F["array_sort"] = lambda column: sort_array(column)


@_fn()
def array_union(col1, col2):
    return _call("list_distinct", (), "array_union") if False else _to_col(col1)._derive(
        lambda ctx: "list_distinct(list_concat(%s, %s))" % (_to_col(col1)._sql(ctx), _to_col(col2)._sql(ctx)),
        "array_union(%s, %s)" % (_to_col(col1)._name, _to_col(col2)._name),
        _to_col(col2),
    )


@_fn()
def array_intersect(col1, col2):
    return _call("list_intersect", (col1, col2), "array_intersect")


@_fn()
def array_except(col1, col2):
    a, b = _to_col(col1), _to_col(col2)
    return a._derive(
        lambda ctx: "list_filter(list_distinct(%s), x -> NOT list_contains(%s, x))" % (a._sql(ctx), b._sql(ctx)),
        "array_except(%s, %s)" % (a._name, b._name),
        b,
    )


@_fn()
def array_max(column):
    return _call("list_max", (column,), "array_max")


@_fn()
def array_min(column):
    return _call("list_min", (column,), "array_min")


@_fn()
def array_position(column, value):
    column = _to_col(column)
    return column._derive(
        lambda ctx: "COALESCE(list_position(%s, %s), 0)" % (column._sql(ctx), _lit_sql(value)),
        "array_position(%s, %s)" % (column._name, value),
    )


@_fn()
def slice(column, start, length):
    column = _to_col(column)
    return column._derive(
        lambda ctx: "%s[%d:%d]" % (column._sql(ctx), start, start + length - 1),
        "slice(%s, %d, %d)" % (column._name, start, length),
    )


def _lambda_column(function, names):
    params = [Column(lambda ctx, n=name: n, name) for name in names]
    return function(*params)


@_fn()
def transform(column, f):
    column = _to_col(column)
    nargs = f.__code__.co_argcount
    names = ["x", "i"][:nargs]
    body = _lambda_column(f, names)
    return column._derive(
        lambda ctx: "list_transform(%s, (%s) -> %s)" % (column._sql(ctx), ", ".join(names), body._sql(ctx)),
        "transform(%s, lambda)" % column._name,
    )


@_fn("filter")
def _array_filter(column, f):
    column = _to_col(column)
    body = _lambda_column(f, ["x"])
    return column._derive(
        lambda ctx: "list_filter(%s, x -> %s)" % (column._sql(ctx), body._sql(ctx)),
        "filter(%s, lambda)" % column._name,
    )


@_fn()
def exists(column, f):
    column = _to_col(column)
    body = _lambda_column(f, ["x"])
    return column._derive(
        lambda ctx: "len(list_filter(%s, x -> %s)) > 0" % (column._sql(ctx), body._sql(ctx)),
        "exists(%s, lambda)" % column._name,
    )


@_fn()
def aggregate(column, initialValue, merge, finish=None):
    column = _to_col(column)
    init = _to_col(initialValue, literal=True)
    body = _lambda_column(merge, ["acc", "x"])
    final = _lambda_column(finish, ["acc"]) if finish else None

    def render(ctx):
        reduced = "list_reduce(list_prepend(%s, %s), (acc, x) -> %s)" % (init._sql(ctx), column._sql(ctx), body._sql(ctx))
        if final is None:
            return reduced
        return "(SELECT %s FROM (SELECT %s AS acc))" % (final._sql(ctx), reduced)

    return column._derive(render, "aggregate(%s)" % column._name)


def _explode(column, outer=False, with_pos=False, name=None):
    column = _to_col(column)

    def generator(ctx):
        inner = column._sql(ctx)
        kind = ctx.type_of(inner).upper()
        if kind.startswith("MAP("):
            source = inner
            if outer:
                source = "CASE WHEN %s IS NULL OR cardinality(%s) = 0 THEN MAP {NULL: NULL} ELSE %s END" % (inner, inner, inner)
            out = [
                ("unnest(map_keys(%s))" % source, "key"),
                ("unnest(map_values(%s))" % source, "value"),
            ]
            return out
        source = inner
        if outer:
            source = "CASE WHEN %s IS NULL OR len(%s) = 0 THEN [NULL] ELSE %s END" % (inner, inner, inner)
        out = []
        if with_pos:
            out.append(("unnest(range(len(%s)))" % source, "pos"))
        out.append(("unnest(%s)" % source, name or "col"))
        return out

    label = name or "col"
    result = Column(lambda ctx: "unnest(%s)" % column._sql(ctx), label, refs=column._refs, generator=generator)

    def alias(*names, **kwargs):
        if with_pos and len(names) == 2:
            return _explode_named(column, outer, names)
        return _explode(column, outer, with_pos, names[0])

    result.alias = alias
    result.name = alias
    return result


def _explode_named(column, outer, names):
    base = _explode(column, outer, True)
    original = base._generator

    def generator(ctx):
        return [(sql, new) for (sql, _), new in zip(original(ctx), names)]

    base._generator = generator
    return base


@_fn()
def explode(column):
    return _explode(column)


@_fn()
def explode_outer(column):
    return _explode(column, outer=True)


@_fn()
def posexplode(column):
    return _explode(column, with_pos=True)


@_fn()
def posexplode_outer(column):
    return _explode(column, outer=True, with_pos=True)


@_fn()
def inline(column):
    raise PySparkException("inline is not available in this sandbox. Use explode, then select col.*.")


# -- json --------------------------------------------------------------------


@_fn()
def to_json(column, options=None):
    return _call("to_json", (column,), "to_json")


@_fn()
def get_json_object(column, path):
    column = _to_col(column)
    return column._derive(
        lambda ctx: "json_extract_string(%s, %s)" % (column._sql(ctx), _lit_sql(path)),
        "get_json_object(%s, %s)" % (column._name, path),
    )


@_fn()
def from_json(column, schema, options=None):
    column = _to_col(column)
    data_type = _parse_type(schema) if isinstance(schema, str) and not _re.search(r"\w+\s*:", schema) else (
        _parse_schema_ddl(schema) if isinstance(schema, str) else schema
    )
    return column._derive(
        lambda ctx: "TRY_CAST(json(%s) AS %s)" % (column._sql(ctx), data_type._duck()),
        "from_json(%s)" % column._name,
    )


_F["udf"] = udf
_F["pandas_udf"] = pandas_udf


# --------------------------------------------------------------------------
# Module installation
# --------------------------------------------------------------------------


def _module(name, attrs):
    module = _types.ModuleType(name)
    module.__dict__.update(attrs)
    _sys.modules[name] = module
    return module


def _install():
    """Register pyspark, pyspark.sql and friends in sys.modules."""
    type_names = [
        "DataType",
        "StringType",
        "IntegerType",
        "LongType",
        "ShortType",
        "ByteType",
        "DoubleType",
        "FloatType",
        "BooleanType",
        "DateType",
        "TimestampType",
        "TimestampNTZType",
        "BinaryType",
        "NullType",
        "DecimalType",
        "ArrayType",
        "MapType",
        "StructField",
        "StructType",
        "Row",
    ]
    here = globals()
    types_module = _module("pyspark.sql.types", {name: here[name] for name in type_names})
    functions_module = _module("pyspark.sql.functions", dict(_F))
    functions_module.__dict__["Column"] = Column
    window_module = _module("pyspark.sql.window", {"Window": Window, "WindowSpec": WindowSpec})
    errors = {
        "AnalysisException": AnalysisException,
        "PySparkException": PySparkException,
        "PySparkValueError": PySparkValueError,
        "PySparkTypeError": PySparkTypeError,
        "ParseException": ParseException,
        "ArithmeticException": ArithmeticException,
    }
    utils_module = _module("pyspark.sql.utils", errors)
    errors_module = _module("pyspark.errors", errors)
    _module("pyspark.errors.exceptions", errors)
    _module("pyspark.errors.exceptions.captured", errors)
    column_module = _module("pyspark.sql.column", {"Column": Column})
    dataframe_module = _module("pyspark.sql.dataframe", {"DataFrame": DataFrame})
    session_module = _module("pyspark.sql.session", {"SparkSession": SparkSession})
    group_module = _module("pyspark.sql.group", {"GroupedData": GroupedData})
    sql_module = _module(
        "pyspark.sql",
        {
            "SparkSession": SparkSession,
            "DataFrame": DataFrame,
            "Column": Column,
            "Row": Row,
            "Window": Window,
            "WindowSpec": WindowSpec,
            "GroupedData": GroupedData,
            "DataFrameReader": DataFrameReader,
            "DataFrameWriter": DataFrameWriter,
            "functions": functions_module,
            "types": types_module,
            "window": window_module,
            "utils": utils_module,
            "column": column_module,
            "dataframe": dataframe_module,
            "session": session_module,
            "group": group_module,
            "AnalysisException": AnalysisException,
        },
    )
    storage = _types.SimpleNamespace(
        MEMORY_ONLY="MEMORY_ONLY",
        MEMORY_AND_DISK="MEMORY_AND_DISK",
        DISK_ONLY="DISK_ONLY",
        MEMORY_AND_DISK_DESER="MEMORY_AND_DISK_DESER",
    )
    _module(
        "pyspark",
        {
            "__version__": __version__,
            "sql": sql_module,
            "errors": errors_module,
            "StorageLevel": storage,
            "SparkContext": _SparkContext,
            "SparkConf": RuntimeConfig,
        },
    )
    _module("pyspark.storagelevel", {"StorageLevel": storage})


_install()
