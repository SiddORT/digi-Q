var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all3) => {
  for (var name in all3)
    __defProp(target, name, { get: all3[name], enumerable: true });
};

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/entity.js
function is(value, type) {
  if (!value || typeof value !== "object") {
    return false;
  }
  if (value instanceof type) {
    return true;
  }
  if (!Object.prototype.hasOwnProperty.call(type, entityKind)) {
    throw new Error(
      `Class "${type.name ?? "<unknown>"}" doesn't look like a Drizzle entity. If this is incorrect and the class is provided by Drizzle, please report this as a bug.`
    );
  }
  let cls = Object.getPrototypeOf(value).constructor;
  if (cls) {
    while (cls) {
      if (entityKind in cls && cls[entityKind] === type[entityKind]) {
        return true;
      }
      cls = Object.getPrototypeOf(cls);
    }
  }
  return false;
}
var entityKind;
var init_entity = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/entity.js"() {
    entityKind = /* @__PURE__ */ Symbol.for("drizzle:entityKind");
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/logger.js
var ConsoleLogWriter, DefaultLogger, NoopLogger;
var init_logger = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/logger.js"() {
    init_entity();
    ConsoleLogWriter = class {
      static [entityKind] = "ConsoleLogWriter";
      write(message) {
        console.log(message);
      }
    };
    DefaultLogger = class {
      static [entityKind] = "DefaultLogger";
      writer;
      constructor(config) {
        this.writer = config?.writer ?? new ConsoleLogWriter();
      }
      logQuery(query2, params) {
        const stringifiedParams = params.map((p) => {
          try {
            return JSON.stringify(p);
          } catch {
            return String(p);
          }
        });
        const paramsStr = stringifiedParams.length ? ` -- params: [${stringifiedParams.join(", ")}]` : "";
        this.writer.write(`Query: ${query2}${paramsStr}`);
      }
    };
    NoopLogger = class {
      static [entityKind] = "NoopLogger";
      logQuery() {
      }
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/query-promise.js
var QueryPromise;
var init_query_promise = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/query-promise.js"() {
    init_entity();
    QueryPromise = class {
      static [entityKind] = "QueryPromise";
      [Symbol.toStringTag] = "QueryPromise";
      catch(onRejected) {
        return this.then(void 0, onRejected);
      }
      finally(onFinally) {
        return this.then(
          (value) => {
            onFinally?.();
            return value;
          },
          (reason) => {
            onFinally?.();
            throw reason;
          }
        );
      }
      then(onFulfilled, onRejected) {
        return this.execute().then(onFulfilled, onRejected);
      }
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/column.js
var Column;
var init_column = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/column.js"() {
    init_entity();
    Column = class {
      constructor(table, config) {
        this.table = table;
        this.config = config;
        this.name = config.name;
        this.keyAsName = config.keyAsName;
        this.notNull = config.notNull;
        this.default = config.default;
        this.defaultFn = config.defaultFn;
        this.onUpdateFn = config.onUpdateFn;
        this.hasDefault = config.hasDefault;
        this.primary = config.primaryKey;
        this.isUnique = config.isUnique;
        this.uniqueName = config.uniqueName;
        this.uniqueType = config.uniqueType;
        this.dataType = config.dataType;
        this.columnType = config.columnType;
        this.generated = config.generated;
        this.generatedIdentity = config.generatedIdentity;
      }
      static [entityKind] = "Column";
      name;
      keyAsName;
      primary;
      notNull;
      default;
      defaultFn;
      onUpdateFn;
      hasDefault;
      isUnique;
      uniqueName;
      uniqueType;
      dataType;
      columnType;
      enumValues = void 0;
      generated = void 0;
      generatedIdentity = void 0;
      config;
      mapFromDriverValue(value) {
        return value;
      }
      mapToDriverValue(value) {
        return value;
      }
      // ** @internal */
      shouldDisableInsert() {
        return this.config.generated !== void 0 && this.config.generated.type !== "byDefault";
      }
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/column-builder.js
var ColumnBuilder;
var init_column_builder = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/column-builder.js"() {
    init_entity();
    ColumnBuilder = class {
      static [entityKind] = "ColumnBuilder";
      config;
      constructor(name, dataType, columnType) {
        this.config = {
          name,
          keyAsName: name === "",
          notNull: false,
          default: void 0,
          hasDefault: false,
          primaryKey: false,
          isUnique: false,
          uniqueName: void 0,
          uniqueType: void 0,
          dataType,
          columnType,
          generated: void 0
        };
      }
      /**
       * Changes the data type of the column. Commonly used with `json` columns. Also, useful for branded types.
       *
       * @example
       * ```ts
       * const users = pgTable('users', {
       * 	id: integer('id').$type<UserId>().primaryKey(),
       * 	details: json('details').$type<UserDetails>().notNull(),
       * });
       * ```
       */
      $type() {
        return this;
      }
      /**
       * Adds a `not null` clause to the column definition.
       *
       * Affects the `select` model of the table - columns *without* `not null` will be nullable on select.
       */
      notNull() {
        this.config.notNull = true;
        return this;
      }
      /**
       * Adds a `default <value>` clause to the column definition.
       *
       * Affects the `insert` model of the table - columns *with* `default` are optional on insert.
       *
       * If you need to set a dynamic default value, use {@link $defaultFn} instead.
       */
      default(value) {
        this.config.default = value;
        this.config.hasDefault = true;
        return this;
      }
      /**
       * Adds a dynamic default value to the column.
       * The function will be called when the row is inserted, and the returned value will be used as the column value.
       *
       * **Note:** This value does not affect the `drizzle-kit` behavior, it is only used at runtime in `drizzle-orm`.
       */
      $defaultFn(fn) {
        this.config.defaultFn = fn;
        this.config.hasDefault = true;
        return this;
      }
      /**
       * Alias for {@link $defaultFn}.
       */
      $default = this.$defaultFn;
      /**
       * Adds a dynamic update value to the column.
       * The function will be called when the row is updated, and the returned value will be used as the column value if none is provided.
       * If no `default` (or `$defaultFn`) value is provided, the function will be called when the row is inserted as well, and the returned value will be used as the column value.
       *
       * **Note:** This value does not affect the `drizzle-kit` behavior, it is only used at runtime in `drizzle-orm`.
       */
      $onUpdateFn(fn) {
        this.config.onUpdateFn = fn;
        this.config.hasDefault = true;
        return this;
      }
      /**
       * Alias for {@link $onUpdateFn}.
       */
      $onUpdate = this.$onUpdateFn;
      /**
       * Adds a `primary key` clause to the column definition. This implicitly makes the column `not null`.
       *
       * In SQLite, `integer primary key` implicitly makes the column auto-incrementing.
       */
      primaryKey() {
        this.config.primaryKey = true;
        this.config.notNull = true;
        return this;
      }
      /** @internal Sets the name of the column to the key within the table definition if a name was not given. */
      setName(name) {
        if (this.config.name !== "") return;
        this.config.name = name;
      }
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/table.utils.js
var TableName;
var init_table_utils = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/table.utils.js"() {
    TableName = /* @__PURE__ */ Symbol.for("drizzle:Name");
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/foreign-keys.js
function foreignKey(config) {
  function mappedConfig() {
    const { name, columns, foreignColumns } = config;
    return {
      name,
      columns,
      foreignColumns
    };
  }
  return new ForeignKeyBuilder(mappedConfig);
}
var ForeignKeyBuilder, ForeignKey;
var init_foreign_keys = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/foreign-keys.js"() {
    init_entity();
    init_table_utils();
    ForeignKeyBuilder = class {
      static [entityKind] = "PgForeignKeyBuilder";
      /** @internal */
      reference;
      /** @internal */
      _onUpdate = "no action";
      /** @internal */
      _onDelete = "no action";
      constructor(config, actions) {
        this.reference = () => {
          const { name, columns, foreignColumns } = config();
          return { name, columns, foreignTable: foreignColumns[0].table, foreignColumns };
        };
        if (actions) {
          this._onUpdate = actions.onUpdate;
          this._onDelete = actions.onDelete;
        }
      }
      onUpdate(action) {
        this._onUpdate = action === void 0 ? "no action" : action;
        return this;
      }
      onDelete(action) {
        this._onDelete = action === void 0 ? "no action" : action;
        return this;
      }
      /** @internal */
      build(table) {
        return new ForeignKey(table, this);
      }
    };
    ForeignKey = class {
      constructor(table, builder) {
        this.table = table;
        this.reference = builder.reference;
        this.onUpdate = builder._onUpdate;
        this.onDelete = builder._onDelete;
      }
      static [entityKind] = "PgForeignKey";
      reference;
      onUpdate;
      onDelete;
      getName() {
        const { name, columns, foreignColumns } = this.reference();
        const columnNames = columns.map((column) => column.name);
        const foreignColumnNames = foreignColumns.map((column) => column.name);
        const chunks = [
          this.table[TableName],
          ...columnNames,
          foreignColumns[0].table[TableName],
          ...foreignColumnNames
        ];
        return name ?? `${chunks.join("_")}_fk`;
      }
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/tracing-utils.js
function iife(fn, ...args) {
  return fn(...args);
}
var init_tracing_utils = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/tracing-utils.js"() {
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/unique-constraint.js
function uniqueKeyName(table, columns) {
  return `${table[TableName]}_${columns.join("_")}_unique`;
}
var UniqueConstraintBuilder, UniqueOnConstraintBuilder, UniqueConstraint;
var init_unique_constraint = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/unique-constraint.js"() {
    init_entity();
    init_table_utils();
    UniqueConstraintBuilder = class {
      constructor(columns, name) {
        this.name = name;
        this.columns = columns;
      }
      static [entityKind] = "PgUniqueConstraintBuilder";
      /** @internal */
      columns;
      /** @internal */
      nullsNotDistinctConfig = false;
      nullsNotDistinct() {
        this.nullsNotDistinctConfig = true;
        return this;
      }
      /** @internal */
      build(table) {
        return new UniqueConstraint(table, this.columns, this.nullsNotDistinctConfig, this.name);
      }
    };
    UniqueOnConstraintBuilder = class {
      static [entityKind] = "PgUniqueOnConstraintBuilder";
      /** @internal */
      name;
      constructor(name) {
        this.name = name;
      }
      on(...columns) {
        return new UniqueConstraintBuilder(columns, this.name);
      }
    };
    UniqueConstraint = class {
      constructor(table, columns, nullsNotDistinct, name) {
        this.table = table;
        this.columns = columns;
        this.name = name ?? uniqueKeyName(this.table, this.columns.map((column) => column.name));
        this.nullsNotDistinct = nullsNotDistinct;
      }
      static [entityKind] = "PgUniqueConstraint";
      columns;
      name;
      nullsNotDistinct = false;
      getName() {
        return this.name;
      }
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/utils/array.js
function parsePgArrayValue(arrayString, startFrom, inQuotes) {
  for (let i = startFrom; i < arrayString.length; i++) {
    const char2 = arrayString[i];
    if (char2 === "\\") {
      i++;
      continue;
    }
    if (char2 === '"') {
      return [arrayString.slice(startFrom, i).replace(/\\/g, ""), i + 1];
    }
    if (inQuotes) {
      continue;
    }
    if (char2 === "," || char2 === "}") {
      return [arrayString.slice(startFrom, i).replace(/\\/g, ""), i];
    }
  }
  return [arrayString.slice(startFrom).replace(/\\/g, ""), arrayString.length];
}
function parsePgNestedArray(arrayString, startFrom = 0) {
  const result = [];
  let i = startFrom;
  let lastCharIsComma = false;
  while (i < arrayString.length) {
    const char2 = arrayString[i];
    if (char2 === ",") {
      if (lastCharIsComma || i === startFrom) {
        result.push("");
      }
      lastCharIsComma = true;
      i++;
      continue;
    }
    lastCharIsComma = false;
    if (char2 === "\\") {
      i += 2;
      continue;
    }
    if (char2 === '"') {
      const [value2, startFrom2] = parsePgArrayValue(arrayString, i + 1, true);
      result.push(value2);
      i = startFrom2;
      continue;
    }
    if (char2 === "}") {
      return [result, i + 1];
    }
    if (char2 === "{") {
      const [value2, startFrom2] = parsePgNestedArray(arrayString, i + 1);
      result.push(value2);
      i = startFrom2;
      continue;
    }
    const [value, newStartFrom] = parsePgArrayValue(arrayString, i, false);
    result.push(value);
    i = newStartFrom;
  }
  return [result, i];
}
function parsePgArray(arrayString) {
  const [result] = parsePgNestedArray(arrayString, 1);
  return result;
}
function makePgArray(array) {
  return `{${array.map((item) => {
    if (Array.isArray(item)) {
      return makePgArray(item);
    }
    if (typeof item === "string") {
      return `"${item.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
    }
    return `${item}`;
  }).join(",")}}`;
}
var init_array = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/utils/array.js"() {
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/common.js
var PgColumnBuilder, PgColumn, ExtraConfigColumn, IndexedColumn, PgArrayBuilder, PgArray;
var init_common = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/common.js"() {
    init_column_builder();
    init_column();
    init_entity();
    init_foreign_keys();
    init_tracing_utils();
    init_unique_constraint();
    init_array();
    PgColumnBuilder = class extends ColumnBuilder {
      foreignKeyConfigs = [];
      static [entityKind] = "PgColumnBuilder";
      array(size) {
        return new PgArrayBuilder(this.config.name, this, size);
      }
      references(ref, actions = {}) {
        this.foreignKeyConfigs.push({ ref, actions });
        return this;
      }
      unique(name, config) {
        this.config.isUnique = true;
        this.config.uniqueName = name;
        this.config.uniqueType = config?.nulls;
        return this;
      }
      generatedAlwaysAs(as) {
        this.config.generated = {
          as,
          type: "always",
          mode: "stored"
        };
        return this;
      }
      /** @internal */
      buildForeignKeys(column, table) {
        return this.foreignKeyConfigs.map(({ ref, actions }) => {
          return iife(
            (ref2, actions2) => {
              const builder = new ForeignKeyBuilder(() => {
                const foreignColumn = ref2();
                return { columns: [column], foreignColumns: [foreignColumn] };
              });
              if (actions2.onUpdate) {
                builder.onUpdate(actions2.onUpdate);
              }
              if (actions2.onDelete) {
                builder.onDelete(actions2.onDelete);
              }
              return builder.build(table);
            },
            ref,
            actions
          );
        });
      }
      /** @internal */
      buildExtraConfigColumn(table) {
        return new ExtraConfigColumn(table, this.config);
      }
    };
    PgColumn = class extends Column {
      constructor(table, config) {
        if (!config.uniqueName) {
          config.uniqueName = uniqueKeyName(table, [config.name]);
        }
        super(table, config);
        this.table = table;
      }
      static [entityKind] = "PgColumn";
    };
    ExtraConfigColumn = class extends PgColumn {
      static [entityKind] = "ExtraConfigColumn";
      getSQLType() {
        return this.getSQLType();
      }
      indexConfig = {
        order: this.config.order ?? "asc",
        nulls: this.config.nulls ?? "last",
        opClass: this.config.opClass
      };
      defaultConfig = {
        order: "asc",
        nulls: "last",
        opClass: void 0
      };
      asc() {
        this.indexConfig.order = "asc";
        return this;
      }
      desc() {
        this.indexConfig.order = "desc";
        return this;
      }
      nullsFirst() {
        this.indexConfig.nulls = "first";
        return this;
      }
      nullsLast() {
        this.indexConfig.nulls = "last";
        return this;
      }
      /**
       * ### PostgreSQL documentation quote
       *
       * > An operator class with optional parameters can be specified for each column of an index.
       * The operator class identifies the operators to be used by the index for that column.
       * For example, a B-tree index on four-byte integers would use the int4_ops class;
       * this operator class includes comparison functions for four-byte integers.
       * In practice the default operator class for the column's data type is usually sufficient.
       * The main point of having operator classes is that for some data types, there could be more than one meaningful ordering.
       * For example, we might want to sort a complex-number data type either by absolute value or by real part.
       * We could do this by defining two operator classes for the data type and then selecting the proper class when creating an index.
       * More information about operator classes check:
       *
       * ### Useful links
       * https://www.postgresql.org/docs/current/sql-createindex.html
       *
       * https://www.postgresql.org/docs/current/indexes-opclass.html
       *
       * https://www.postgresql.org/docs/current/xindex.html
       *
       * ### Additional types
       * If you have the `pg_vector` extension installed in your database, you can use the
       * `vector_l2_ops`, `vector_ip_ops`, `vector_cosine_ops`, `vector_l1_ops`, `bit_hamming_ops`, `bit_jaccard_ops`, `halfvec_l2_ops`, `sparsevec_l2_ops` options, which are predefined types.
       *
       * **You can always specify any string you want in the operator class, in case Drizzle doesn't have it natively in its types**
       *
       * @param opClass
       * @returns
       */
      op(opClass) {
        this.indexConfig.opClass = opClass;
        return this;
      }
    };
    IndexedColumn = class {
      static [entityKind] = "IndexedColumn";
      constructor(name, keyAsName, type, indexConfig) {
        this.name = name;
        this.keyAsName = keyAsName;
        this.type = type;
        this.indexConfig = indexConfig;
      }
      name;
      keyAsName;
      type;
      indexConfig;
    };
    PgArrayBuilder = class extends PgColumnBuilder {
      static [entityKind] = "PgArrayBuilder";
      constructor(name, baseBuilder, size) {
        super(name, "array", "PgArray");
        this.config.baseBuilder = baseBuilder;
        this.config.size = size;
      }
      /** @internal */
      build(table) {
        const baseColumn = this.config.baseBuilder.build(table);
        return new PgArray(
          table,
          this.config,
          baseColumn
        );
      }
    };
    PgArray = class _PgArray extends PgColumn {
      constructor(table, config, baseColumn, range) {
        super(table, config);
        this.baseColumn = baseColumn;
        this.range = range;
        this.size = config.size;
      }
      size;
      static [entityKind] = "PgArray";
      getSQLType() {
        return `${this.baseColumn.getSQLType()}[${typeof this.size === "number" ? this.size : ""}]`;
      }
      mapFromDriverValue(value) {
        if (typeof value === "string") {
          value = parsePgArray(value);
        }
        return value.map((v) => this.baseColumn.mapFromDriverValue(v));
      }
      mapToDriverValue(value, isNestedArray = false) {
        const a = value.map(
          (v) => v === null ? null : is(this.baseColumn, _PgArray) ? this.baseColumn.mapToDriverValue(v, true) : this.baseColumn.mapToDriverValue(v)
        );
        if (isNestedArray) return a;
        return makePgArray(a);
      }
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/enum.js
function isPgEnum(obj) {
  return !!obj && typeof obj === "function" && isPgEnumSym in obj && obj[isPgEnumSym] === true;
}
function pgEnumWithSchema(enumName, values, schema) {
  const enumInstance = Object.assign(
    (name) => new PgEnumColumnBuilder(name ?? "", enumInstance),
    {
      enumName,
      enumValues: values,
      schema,
      [isPgEnumSym]: true
    }
  );
  return enumInstance;
}
function pgEnumObjectWithSchema(enumName, values, schema) {
  const enumInstance = Object.assign(
    (name) => new PgEnumObjectColumnBuilder(name ?? "", enumInstance),
    {
      enumName,
      enumValues: Object.values(values),
      schema,
      [isPgEnumSym]: true
    }
  );
  return enumInstance;
}
var PgEnumObjectColumnBuilder, PgEnumObjectColumn, isPgEnumSym, PgEnumColumnBuilder, PgEnumColumn;
var init_enum = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/enum.js"() {
    init_entity();
    init_common();
    PgEnumObjectColumnBuilder = class extends PgColumnBuilder {
      static [entityKind] = "PgEnumObjectColumnBuilder";
      constructor(name, enumInstance) {
        super(name, "string", "PgEnumObjectColumn");
        this.config.enum = enumInstance;
      }
      /** @internal */
      build(table) {
        return new PgEnumObjectColumn(
          table,
          this.config
        );
      }
    };
    PgEnumObjectColumn = class extends PgColumn {
      static [entityKind] = "PgEnumObjectColumn";
      enum;
      enumValues = this.config.enum.enumValues;
      constructor(table, config) {
        super(table, config);
        this.enum = config.enum;
      }
      getSQLType() {
        return this.enum.enumName;
      }
    };
    isPgEnumSym = /* @__PURE__ */ Symbol.for("drizzle:isPgEnum");
    PgEnumColumnBuilder = class extends PgColumnBuilder {
      static [entityKind] = "PgEnumColumnBuilder";
      constructor(name, enumInstance) {
        super(name, "string", "PgEnumColumn");
        this.config.enum = enumInstance;
      }
      /** @internal */
      build(table) {
        return new PgEnumColumn(
          table,
          this.config
        );
      }
    };
    PgEnumColumn = class extends PgColumn {
      static [entityKind] = "PgEnumColumn";
      enum = this.config.enum;
      enumValues = this.config.enum.enumValues;
      constructor(table, config) {
        super(table, config);
        this.enum = config.enum;
      }
      getSQLType() {
        return this.enum.enumName;
      }
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/subquery.js
var Subquery, WithSubquery;
var init_subquery = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/subquery.js"() {
    init_entity();
    Subquery = class {
      static [entityKind] = "Subquery";
      constructor(sql2, fields2, alias, isWith = false, usedTables = []) {
        this._ = {
          brand: "Subquery",
          sql: sql2,
          selectedFields: fields2,
          alias,
          isWith,
          usedTables
        };
      }
      // getSQL(): SQL<unknown> {
      // 	return new SQL([this]);
      // }
    };
    WithSubquery = class extends Subquery {
      static [entityKind] = "WithSubquery";
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/version.js
var version;
var init_version = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/version.js"() {
    version = "0.45.2";
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/tracing.js
var otel, rawTracer, tracer;
var init_tracing = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/tracing.js"() {
    init_tracing_utils();
    init_version();
    tracer = {
      startActiveSpan(name, fn) {
        if (!otel) {
          return fn();
        }
        if (!rawTracer) {
          rawTracer = otel.trace.getTracer("drizzle-orm", version);
        }
        return iife(
          (otel2, rawTracer2) => rawTracer2.startActiveSpan(
            name,
            (span) => {
              try {
                return fn(span);
              } catch (e) {
                span.setStatus({
                  code: otel2.SpanStatusCode.ERROR,
                  message: e instanceof Error ? e.message : "Unknown error"
                  // eslint-disable-line no-instanceof/no-instanceof
                });
                throw e;
              } finally {
                span.end();
              }
            }
          ),
          otel,
          rawTracer
        );
      }
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/view-common.js
var ViewBaseConfig;
var init_view_common = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/view-common.js"() {
    ViewBaseConfig = /* @__PURE__ */ Symbol.for("drizzle:ViewBaseConfig");
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/table.js
function getTableName(table) {
  return table[TableName];
}
function getTableUniqueName(table) {
  return `${table[Schema] ?? "public"}.${table[TableName]}`;
}
var Schema, Columns, ExtraConfigColumns, OriginalName, BaseName, IsAlias, ExtraConfigBuilder, IsDrizzleTable, Table;
var init_table = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/table.js"() {
    init_entity();
    init_table_utils();
    Schema = /* @__PURE__ */ Symbol.for("drizzle:Schema");
    Columns = /* @__PURE__ */ Symbol.for("drizzle:Columns");
    ExtraConfigColumns = /* @__PURE__ */ Symbol.for("drizzle:ExtraConfigColumns");
    OriginalName = /* @__PURE__ */ Symbol.for("drizzle:OriginalName");
    BaseName = /* @__PURE__ */ Symbol.for("drizzle:BaseName");
    IsAlias = /* @__PURE__ */ Symbol.for("drizzle:IsAlias");
    ExtraConfigBuilder = /* @__PURE__ */ Symbol.for("drizzle:ExtraConfigBuilder");
    IsDrizzleTable = /* @__PURE__ */ Symbol.for("drizzle:IsDrizzleTable");
    Table = class {
      static [entityKind] = "Table";
      /** @internal */
      static Symbol = {
        Name: TableName,
        Schema,
        OriginalName,
        Columns,
        ExtraConfigColumns,
        BaseName,
        IsAlias,
        ExtraConfigBuilder
      };
      /**
       * @internal
       * Can be changed if the table is aliased.
       */
      [TableName];
      /**
       * @internal
       * Used to store the original name of the table, before any aliasing.
       */
      [OriginalName];
      /** @internal */
      [Schema];
      /** @internal */
      [Columns];
      /** @internal */
      [ExtraConfigColumns];
      /**
       *  @internal
       * Used to store the table name before the transformation via the `tableCreator` functions.
       */
      [BaseName];
      /** @internal */
      [IsAlias] = false;
      /** @internal */
      [IsDrizzleTable] = true;
      /** @internal */
      [ExtraConfigBuilder] = void 0;
      constructor(name, schema, baseName) {
        this[TableName] = this[OriginalName] = name;
        this[Schema] = schema;
        this[BaseName] = baseName;
      }
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/sql/sql.js
function isSQLWrapper(value) {
  return value !== null && value !== void 0 && typeof value.getSQL === "function";
}
function mergeQueries(queries) {
  const result = { sql: "", params: [] };
  for (const query2 of queries) {
    result.sql += query2.sql;
    result.params.push(...query2.params);
    if (query2.typings?.length) {
      if (!result.typings) {
        result.typings = [];
      }
      result.typings.push(...query2.typings);
    }
  }
  return result;
}
function isDriverValueEncoder(value) {
  return typeof value === "object" && value !== null && "mapToDriverValue" in value && typeof value.mapToDriverValue === "function";
}
function sql(strings, ...params) {
  const queryChunks = [];
  if (params.length > 0 || strings.length > 0 && strings[0] !== "") {
    queryChunks.push(new StringChunk(strings[0]));
  }
  for (const [paramIndex, param2] of params.entries()) {
    queryChunks.push(param2, new StringChunk(strings[paramIndex + 1]));
  }
  return new SQL(queryChunks);
}
function fillPlaceholders(params, values) {
  return params.map((p) => {
    if (is(p, Placeholder)) {
      if (!(p.name in values)) {
        throw new Error(`No value for placeholder "${p.name}" was provided`);
      }
      return values[p.name];
    }
    if (is(p, Param) && is(p.value, Placeholder)) {
      if (!(p.value.name in values)) {
        throw new Error(`No value for placeholder "${p.value.name}" was provided`);
      }
      return p.encoder.mapToDriverValue(values[p.value.name]);
    }
    return p;
  });
}
var FakePrimitiveParam, StringChunk, SQL, Name, noopDecoder, noopEncoder, noopMapper, Param, Placeholder, IsDrizzleView, View;
var init_sql = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/sql/sql.js"() {
    init_entity();
    init_enum();
    init_subquery();
    init_tracing();
    init_view_common();
    init_column();
    init_table();
    FakePrimitiveParam = class {
      static [entityKind] = "FakePrimitiveParam";
    };
    StringChunk = class {
      static [entityKind] = "StringChunk";
      value;
      constructor(value) {
        this.value = Array.isArray(value) ? value : [value];
      }
      getSQL() {
        return new SQL([this]);
      }
    };
    SQL = class _SQL {
      constructor(queryChunks) {
        this.queryChunks = queryChunks;
        for (const chunk of queryChunks) {
          if (is(chunk, Table)) {
            const schemaName = chunk[Table.Symbol.Schema];
            this.usedTables.push(
              schemaName === void 0 ? chunk[Table.Symbol.Name] : schemaName + "." + chunk[Table.Symbol.Name]
            );
          }
        }
      }
      static [entityKind] = "SQL";
      /** @internal */
      decoder = noopDecoder;
      shouldInlineParams = false;
      /** @internal */
      usedTables = [];
      append(query2) {
        this.queryChunks.push(...query2.queryChunks);
        return this;
      }
      toQuery(config) {
        return tracer.startActiveSpan("drizzle.buildSQL", (span) => {
          const query2 = this.buildQueryFromSourceParams(this.queryChunks, config);
          span?.setAttributes({
            "drizzle.query.text": query2.sql,
            "drizzle.query.params": JSON.stringify(query2.params)
          });
          return query2;
        });
      }
      buildQueryFromSourceParams(chunks, _config) {
        const config = Object.assign({}, _config, {
          inlineParams: _config.inlineParams || this.shouldInlineParams,
          paramStartIndex: _config.paramStartIndex || { value: 0 }
        });
        const {
          casing,
          escapeName,
          escapeParam,
          prepareTyping,
          inlineParams,
          paramStartIndex
        } = config;
        return mergeQueries(chunks.map((chunk) => {
          if (is(chunk, StringChunk)) {
            return { sql: chunk.value.join(""), params: [] };
          }
          if (is(chunk, Name)) {
            return { sql: escapeName(chunk.value), params: [] };
          }
          if (chunk === void 0) {
            return { sql: "", params: [] };
          }
          if (Array.isArray(chunk)) {
            const result = [new StringChunk("(")];
            for (const [i, p] of chunk.entries()) {
              result.push(p);
              if (i < chunk.length - 1) {
                result.push(new StringChunk(", "));
              }
            }
            result.push(new StringChunk(")"));
            return this.buildQueryFromSourceParams(result, config);
          }
          if (is(chunk, _SQL)) {
            return this.buildQueryFromSourceParams(chunk.queryChunks, {
              ...config,
              inlineParams: inlineParams || chunk.shouldInlineParams
            });
          }
          if (is(chunk, Table)) {
            const schemaName = chunk[Table.Symbol.Schema];
            const tableName = chunk[Table.Symbol.Name];
            return {
              sql: schemaName === void 0 || chunk[IsAlias] ? escapeName(tableName) : escapeName(schemaName) + "." + escapeName(tableName),
              params: []
            };
          }
          if (is(chunk, Column)) {
            const columnName = casing.getColumnCasing(chunk);
            if (_config.invokeSource === "indexes") {
              return { sql: escapeName(columnName), params: [] };
            }
            const schemaName = chunk.table[Table.Symbol.Schema];
            return {
              sql: chunk.table[IsAlias] || schemaName === void 0 ? escapeName(chunk.table[Table.Symbol.Name]) + "." + escapeName(columnName) : escapeName(schemaName) + "." + escapeName(chunk.table[Table.Symbol.Name]) + "." + escapeName(columnName),
              params: []
            };
          }
          if (is(chunk, View)) {
            const schemaName = chunk[ViewBaseConfig].schema;
            const viewName = chunk[ViewBaseConfig].name;
            return {
              sql: schemaName === void 0 || chunk[ViewBaseConfig].isAlias ? escapeName(viewName) : escapeName(schemaName) + "." + escapeName(viewName),
              params: []
            };
          }
          if (is(chunk, Param)) {
            if (is(chunk.value, Placeholder)) {
              return { sql: escapeParam(paramStartIndex.value++, chunk), params: [chunk], typings: ["none"] };
            }
            const mappedValue = chunk.value === null ? null : chunk.encoder.mapToDriverValue(chunk.value);
            if (is(mappedValue, _SQL)) {
              return this.buildQueryFromSourceParams([mappedValue], config);
            }
            if (inlineParams) {
              return { sql: this.mapInlineParam(mappedValue, config), params: [] };
            }
            let typings = ["none"];
            if (prepareTyping) {
              typings = [prepareTyping(chunk.encoder)];
            }
            return { sql: escapeParam(paramStartIndex.value++, mappedValue), params: [mappedValue], typings };
          }
          if (is(chunk, Placeholder)) {
            return { sql: escapeParam(paramStartIndex.value++, chunk), params: [chunk], typings: ["none"] };
          }
          if (is(chunk, _SQL.Aliased) && chunk.fieldAlias !== void 0) {
            return { sql: escapeName(chunk.fieldAlias), params: [] };
          }
          if (is(chunk, Subquery)) {
            if (chunk._.isWith) {
              return { sql: escapeName(chunk._.alias), params: [] };
            }
            return this.buildQueryFromSourceParams([
              new StringChunk("("),
              chunk._.sql,
              new StringChunk(") "),
              new Name(chunk._.alias)
            ], config);
          }
          if (isPgEnum(chunk)) {
            if (chunk.schema) {
              return { sql: escapeName(chunk.schema) + "." + escapeName(chunk.enumName), params: [] };
            }
            return { sql: escapeName(chunk.enumName), params: [] };
          }
          if (isSQLWrapper(chunk)) {
            if (chunk.shouldOmitSQLParens?.()) {
              return this.buildQueryFromSourceParams([chunk.getSQL()], config);
            }
            return this.buildQueryFromSourceParams([
              new StringChunk("("),
              chunk.getSQL(),
              new StringChunk(")")
            ], config);
          }
          if (inlineParams) {
            return { sql: this.mapInlineParam(chunk, config), params: [] };
          }
          return { sql: escapeParam(paramStartIndex.value++, chunk), params: [chunk], typings: ["none"] };
        }));
      }
      mapInlineParam(chunk, { escapeString }) {
        if (chunk === null) {
          return "null";
        }
        if (typeof chunk === "number" || typeof chunk === "boolean") {
          return chunk.toString();
        }
        if (typeof chunk === "string") {
          return escapeString(chunk);
        }
        if (typeof chunk === "object") {
          const mappedValueAsString = chunk.toString();
          if (mappedValueAsString === "[object Object]") {
            return escapeString(JSON.stringify(chunk));
          }
          return escapeString(mappedValueAsString);
        }
        throw new Error("Unexpected param value: " + chunk);
      }
      getSQL() {
        return this;
      }
      as(alias) {
        if (alias === void 0) {
          return this;
        }
        return new _SQL.Aliased(this, alias);
      }
      mapWith(decoder) {
        this.decoder = typeof decoder === "function" ? { mapFromDriverValue: decoder } : decoder;
        return this;
      }
      inlineParams() {
        this.shouldInlineParams = true;
        return this;
      }
      /**
       * This method is used to conditionally include a part of the query.
       *
       * @param condition - Condition to check
       * @returns itself if the condition is `true`, otherwise `undefined`
       */
      if(condition) {
        return condition ? this : void 0;
      }
    };
    Name = class {
      constructor(value) {
        this.value = value;
      }
      static [entityKind] = "Name";
      brand;
      getSQL() {
        return new SQL([this]);
      }
    };
    noopDecoder = {
      mapFromDriverValue: (value) => value
    };
    noopEncoder = {
      mapToDriverValue: (value) => value
    };
    noopMapper = {
      ...noopDecoder,
      ...noopEncoder
    };
    Param = class {
      /**
       * @param value - Parameter value
       * @param encoder - Encoder to convert the value to a driver parameter
       */
      constructor(value, encoder = noopEncoder) {
        this.value = value;
        this.encoder = encoder;
      }
      static [entityKind] = "Param";
      brand;
      getSQL() {
        return new SQL([this]);
      }
    };
    ((sql2) => {
      function empty() {
        return new SQL([]);
      }
      sql2.empty = empty;
      function fromList(list) {
        return new SQL(list);
      }
      sql2.fromList = fromList;
      function raw3(str) {
        return new SQL([new StringChunk(str)]);
      }
      sql2.raw = raw3;
      function join(chunks, separator) {
        const result = [];
        for (const [i, chunk] of chunks.entries()) {
          if (i > 0 && separator !== void 0) {
            result.push(separator);
          }
          result.push(chunk);
        }
        return new SQL(result);
      }
      sql2.join = join;
      function identifier(value) {
        return new Name(value);
      }
      sql2.identifier = identifier;
      function placeholder2(name2) {
        return new Placeholder(name2);
      }
      sql2.placeholder = placeholder2;
      function param2(value, encoder) {
        return new Param(value, encoder);
      }
      sql2.param = param2;
    })(sql || (sql = {}));
    ((SQL2) => {
      class Aliased {
        constructor(sql2, fieldAlias) {
          this.sql = sql2;
          this.fieldAlias = fieldAlias;
        }
        static [entityKind] = "SQL.Aliased";
        /** @internal */
        isSelectionField = false;
        getSQL() {
          return this.sql;
        }
        /** @internal */
        clone() {
          return new Aliased(this.sql, this.fieldAlias);
        }
      }
      SQL2.Aliased = Aliased;
    })(SQL || (SQL = {}));
    Placeholder = class {
      constructor(name2) {
        this.name = name2;
      }
      static [entityKind] = "Placeholder";
      getSQL() {
        return new SQL([this]);
      }
    };
    IsDrizzleView = /* @__PURE__ */ Symbol.for("drizzle:IsDrizzleView");
    View = class {
      static [entityKind] = "View";
      /** @internal */
      [ViewBaseConfig];
      /** @internal */
      [IsDrizzleView] = true;
      constructor({ name: name2, schema, selectedFields, query: query2 }) {
        this[ViewBaseConfig] = {
          name: name2,
          originalName: name2,
          schema,
          selectedFields,
          query: query2,
          isExisting: !query2,
          isAlias: false
        };
      }
      getSQL() {
        return new SQL([this]);
      }
    };
    Column.prototype.getSQL = function() {
      return new SQL([this]);
    };
    Table.prototype.getSQL = function() {
      return new SQL([this]);
    };
    Subquery.prototype.getSQL = function() {
      return new SQL([this]);
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/alias.js
function aliasedTable(table, tableAlias) {
  return new Proxy(table, new TableAliasProxyHandler(tableAlias, false));
}
function aliasedTableColumn(column, tableAlias) {
  return new Proxy(
    column,
    new ColumnAliasProxyHandler(new Proxy(column.table, new TableAliasProxyHandler(tableAlias, false)))
  );
}
function mapColumnsInAliasedSQLToAlias(query2, alias) {
  return new SQL.Aliased(mapColumnsInSQLToAlias(query2.sql, alias), query2.fieldAlias);
}
function mapColumnsInSQLToAlias(query2, alias) {
  return sql.join(query2.queryChunks.map((c) => {
    if (is(c, Column)) {
      return aliasedTableColumn(c, alias);
    }
    if (is(c, SQL)) {
      return mapColumnsInSQLToAlias(c, alias);
    }
    if (is(c, SQL.Aliased)) {
      return mapColumnsInAliasedSQLToAlias(c, alias);
    }
    return c;
  }));
}
var ColumnAliasProxyHandler, TableAliasProxyHandler, RelationTableAliasProxyHandler;
var init_alias = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/alias.js"() {
    init_column();
    init_entity();
    init_sql();
    init_table();
    init_view_common();
    ColumnAliasProxyHandler = class {
      constructor(table) {
        this.table = table;
      }
      static [entityKind] = "ColumnAliasProxyHandler";
      get(columnObj, prop) {
        if (prop === "table") {
          return this.table;
        }
        return columnObj[prop];
      }
    };
    TableAliasProxyHandler = class {
      constructor(alias, replaceOriginalName) {
        this.alias = alias;
        this.replaceOriginalName = replaceOriginalName;
      }
      static [entityKind] = "TableAliasProxyHandler";
      get(target, prop) {
        if (prop === Table.Symbol.IsAlias) {
          return true;
        }
        if (prop === Table.Symbol.Name) {
          return this.alias;
        }
        if (this.replaceOriginalName && prop === Table.Symbol.OriginalName) {
          return this.alias;
        }
        if (prop === ViewBaseConfig) {
          return {
            ...target[ViewBaseConfig],
            name: this.alias,
            isAlias: true
          };
        }
        if (prop === Table.Symbol.Columns) {
          const columns = target[Table.Symbol.Columns];
          if (!columns) {
            return columns;
          }
          const proxiedColumns = {};
          Object.keys(columns).map((key2) => {
            proxiedColumns[key2] = new Proxy(
              columns[key2],
              new ColumnAliasProxyHandler(new Proxy(target, this))
            );
          });
          return proxiedColumns;
        }
        const value = target[prop];
        if (is(value, Column)) {
          return new Proxy(value, new ColumnAliasProxyHandler(new Proxy(target, this)));
        }
        return value;
      }
    };
    RelationTableAliasProxyHandler = class {
      constructor(alias) {
        this.alias = alias;
      }
      static [entityKind] = "RelationTableAliasProxyHandler";
      get(target, prop) {
        if (prop === "sourceTable") {
          return aliasedTable(target.sourceTable, this.alias);
        }
        return target[prop];
      }
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/selection-proxy.js
var SelectionProxyHandler;
var init_selection_proxy = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/selection-proxy.js"() {
    init_alias();
    init_column();
    init_entity();
    init_sql();
    init_subquery();
    init_view_common();
    SelectionProxyHandler = class _SelectionProxyHandler {
      static [entityKind] = "SelectionProxyHandler";
      config;
      constructor(config) {
        this.config = { ...config };
      }
      get(subquery, prop) {
        if (prop === "_") {
          return {
            ...subquery["_"],
            selectedFields: new Proxy(
              subquery._.selectedFields,
              this
            )
          };
        }
        if (prop === ViewBaseConfig) {
          return {
            ...subquery[ViewBaseConfig],
            selectedFields: new Proxy(
              subquery[ViewBaseConfig].selectedFields,
              this
            )
          };
        }
        if (typeof prop === "symbol") {
          return subquery[prop];
        }
        const columns = is(subquery, Subquery) ? subquery._.selectedFields : is(subquery, View) ? subquery[ViewBaseConfig].selectedFields : subquery;
        const value = columns[prop];
        if (is(value, SQL.Aliased)) {
          if (this.config.sqlAliasedBehavior === "sql" && !value.isSelectionField) {
            return value.sql;
          }
          const newValue = value.clone();
          newValue.isSelectionField = true;
          return newValue;
        }
        if (is(value, SQL)) {
          if (this.config.sqlBehavior === "sql") {
            return value;
          }
          throw new Error(
            `You tried to reference "${prop}" field from a subquery, which is a raw SQL field, but it doesn't have an alias declared. Please add an alias to the field using ".as('alias')" method.`
          );
        }
        if (is(value, Column)) {
          if (this.config.alias) {
            return new Proxy(
              value,
              new ColumnAliasProxyHandler(
                new Proxy(
                  value.table,
                  new TableAliasProxyHandler(this.config.alias, this.config.replaceOriginalName ?? false)
                )
              )
            );
          }
          return value;
        }
        if (typeof value !== "object" || value === null) {
          return value;
        }
        return new Proxy(value, new _SelectionProxyHandler(this.config));
      }
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/utils.js
function mapResultRow(columns, row, joinsNotNullableMap) {
  const nullifyMap = {};
  const result = columns.reduce(
    (result2, { path, field }, columnIndex) => {
      let decoder;
      if (is(field, Column)) {
        decoder = field;
      } else if (is(field, SQL)) {
        decoder = field.decoder;
      } else if (is(field, Subquery)) {
        decoder = field._.sql.decoder;
      } else {
        decoder = field.sql.decoder;
      }
      let node = result2;
      for (const [pathChunkIndex, pathChunk] of path.entries()) {
        if (pathChunkIndex < path.length - 1) {
          if (!(pathChunk in node)) {
            node[pathChunk] = {};
          }
          node = node[pathChunk];
        } else {
          const rawValue = row[columnIndex];
          const value = node[pathChunk] = rawValue === null ? null : decoder.mapFromDriverValue(rawValue);
          if (joinsNotNullableMap && is(field, Column) && path.length === 2) {
            const objectName = path[0];
            if (!(objectName in nullifyMap)) {
              nullifyMap[objectName] = value === null ? getTableName(field.table) : false;
            } else if (typeof nullifyMap[objectName] === "string" && nullifyMap[objectName] !== getTableName(field.table)) {
              nullifyMap[objectName] = false;
            }
          }
        }
      }
      return result2;
    },
    {}
  );
  if (joinsNotNullableMap && Object.keys(nullifyMap).length > 0) {
    for (const [objectName, tableName] of Object.entries(nullifyMap)) {
      if (typeof tableName === "string" && !joinsNotNullableMap[tableName]) {
        result[objectName] = null;
      }
    }
  }
  return result;
}
function orderSelectedFields(fields2, pathPrefix) {
  return Object.entries(fields2).reduce((result, [name, field]) => {
    if (typeof name !== "string") {
      return result;
    }
    const newPath = pathPrefix ? [...pathPrefix, name] : [name];
    if (is(field, Column) || is(field, SQL) || is(field, SQL.Aliased) || is(field, Subquery)) {
      result.push({ path: newPath, field });
    } else if (is(field, Table)) {
      result.push(...orderSelectedFields(field[Table.Symbol.Columns], newPath));
    } else {
      result.push(...orderSelectedFields(field, newPath));
    }
    return result;
  }, []);
}
function haveSameKeys(left, right) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }
  for (const [index2, key2] of leftKeys.entries()) {
    if (key2 !== rightKeys[index2]) {
      return false;
    }
  }
  return true;
}
function mapUpdateSet(table, values) {
  const entries = Object.entries(values).filter(([, value]) => value !== void 0).map(([key2, value]) => {
    if (is(value, SQL) || is(value, Column)) {
      return [key2, value];
    } else {
      return [key2, new Param(value, table[Table.Symbol.Columns][key2])];
    }
  });
  if (entries.length === 0) {
    throw new Error("No values to set");
  }
  return Object.fromEntries(entries);
}
function applyMixins(baseClass, extendedClasses) {
  for (const extendedClass of extendedClasses) {
    for (const name of Object.getOwnPropertyNames(extendedClass.prototype)) {
      if (name === "constructor") continue;
      Object.defineProperty(
        baseClass.prototype,
        name,
        Object.getOwnPropertyDescriptor(extendedClass.prototype, name) || /* @__PURE__ */ Object.create(null)
      );
    }
  }
}
function getTableColumns(table) {
  return table[Table.Symbol.Columns];
}
function getTableLikeName(table) {
  return is(table, Subquery) ? table._.alias : is(table, View) ? table[ViewBaseConfig].name : is(table, SQL) ? void 0 : table[Table.Symbol.IsAlias] ? table[Table.Symbol.Name] : table[Table.Symbol.BaseName];
}
function getColumnNameAndConfig(a, b) {
  return {
    name: typeof a === "string" && a.length > 0 ? a : "",
    config: typeof a === "object" ? a : b
  };
}
function isConfig(data2) {
  if (typeof data2 !== "object" || data2 === null) return false;
  if (data2.constructor.name !== "Object") return false;
  if ("logger" in data2) {
    const type = typeof data2["logger"];
    if (type !== "boolean" && (type !== "object" || typeof data2["logger"]["logQuery"] !== "function") && type !== "undefined") return false;
    return true;
  }
  if ("schema" in data2) {
    const type = typeof data2["schema"];
    if (type !== "object" && type !== "undefined") return false;
    return true;
  }
  if ("casing" in data2) {
    const type = typeof data2["casing"];
    if (type !== "string" && type !== "undefined") return false;
    return true;
  }
  if ("mode" in data2) {
    if (data2["mode"] !== "default" || data2["mode"] !== "planetscale" || data2["mode"] !== void 0) return false;
    return true;
  }
  if ("connection" in data2) {
    const type = typeof data2["connection"];
    if (type !== "string" && type !== "object" && type !== "undefined") return false;
    return true;
  }
  if ("client" in data2) {
    const type = typeof data2["client"];
    if (type !== "object" && type !== "function" && type !== "undefined") return false;
    return true;
  }
  if (Object.keys(data2).length === 0) return true;
  return false;
}
var textDecoder;
var init_utils = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/utils.js"() {
    init_column();
    init_entity();
    init_sql();
    init_subquery();
    init_table();
    init_view_common();
    textDecoder = typeof TextDecoder === "undefined" ? null : new TextDecoder();
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/int.common.js
var PgIntColumnBaseBuilder;
var init_int_common = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/int.common.js"() {
    init_entity();
    init_common();
    PgIntColumnBaseBuilder = class extends PgColumnBuilder {
      static [entityKind] = "PgIntColumnBaseBuilder";
      generatedAlwaysAsIdentity(sequence) {
        if (sequence) {
          const { name, ...options } = sequence;
          this.config.generatedIdentity = {
            type: "always",
            sequenceName: name,
            sequenceOptions: options
          };
        } else {
          this.config.generatedIdentity = {
            type: "always"
          };
        }
        this.config.hasDefault = true;
        this.config.notNull = true;
        return this;
      }
      generatedByDefaultAsIdentity(sequence) {
        if (sequence) {
          const { name, ...options } = sequence;
          this.config.generatedIdentity = {
            type: "byDefault",
            sequenceName: name,
            sequenceOptions: options
          };
        } else {
          this.config.generatedIdentity = {
            type: "byDefault"
          };
        }
        this.config.hasDefault = true;
        this.config.notNull = true;
        return this;
      }
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/bigint.js
function bigint(a, b) {
  const { name, config } = getColumnNameAndConfig(a, b);
  if (config.mode === "number") {
    return new PgBigInt53Builder(name);
  }
  return new PgBigInt64Builder(name);
}
var PgBigInt53Builder, PgBigInt53, PgBigInt64Builder, PgBigInt64;
var init_bigint = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/bigint.js"() {
    init_entity();
    init_utils();
    init_common();
    init_int_common();
    PgBigInt53Builder = class extends PgIntColumnBaseBuilder {
      static [entityKind] = "PgBigInt53Builder";
      constructor(name) {
        super(name, "number", "PgBigInt53");
      }
      /** @internal */
      build(table) {
        return new PgBigInt53(table, this.config);
      }
    };
    PgBigInt53 = class extends PgColumn {
      static [entityKind] = "PgBigInt53";
      getSQLType() {
        return "bigint";
      }
      mapFromDriverValue(value) {
        if (typeof value === "number") {
          return value;
        }
        return Number(value);
      }
    };
    PgBigInt64Builder = class extends PgIntColumnBaseBuilder {
      static [entityKind] = "PgBigInt64Builder";
      constructor(name) {
        super(name, "bigint", "PgBigInt64");
      }
      /** @internal */
      build(table) {
        return new PgBigInt64(
          table,
          this.config
        );
      }
    };
    PgBigInt64 = class extends PgColumn {
      static [entityKind] = "PgBigInt64";
      getSQLType() {
        return "bigint";
      }
      // eslint-disable-next-line unicorn/prefer-native-coercion-functions
      mapFromDriverValue(value) {
        return BigInt(value);
      }
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/bigserial.js
function bigserial(a, b) {
  const { name, config } = getColumnNameAndConfig(a, b);
  if (config.mode === "number") {
    return new PgBigSerial53Builder(name);
  }
  return new PgBigSerial64Builder(name);
}
var PgBigSerial53Builder, PgBigSerial53, PgBigSerial64Builder, PgBigSerial64;
var init_bigserial = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/bigserial.js"() {
    init_entity();
    init_utils();
    init_common();
    PgBigSerial53Builder = class extends PgColumnBuilder {
      static [entityKind] = "PgBigSerial53Builder";
      constructor(name) {
        super(name, "number", "PgBigSerial53");
        this.config.hasDefault = true;
        this.config.notNull = true;
      }
      /** @internal */
      build(table) {
        return new PgBigSerial53(
          table,
          this.config
        );
      }
    };
    PgBigSerial53 = class extends PgColumn {
      static [entityKind] = "PgBigSerial53";
      getSQLType() {
        return "bigserial";
      }
      mapFromDriverValue(value) {
        if (typeof value === "number") {
          return value;
        }
        return Number(value);
      }
    };
    PgBigSerial64Builder = class extends PgColumnBuilder {
      static [entityKind] = "PgBigSerial64Builder";
      constructor(name) {
        super(name, "bigint", "PgBigSerial64");
        this.config.hasDefault = true;
      }
      /** @internal */
      build(table) {
        return new PgBigSerial64(
          table,
          this.config
        );
      }
    };
    PgBigSerial64 = class extends PgColumn {
      static [entityKind] = "PgBigSerial64";
      getSQLType() {
        return "bigserial";
      }
      // eslint-disable-next-line unicorn/prefer-native-coercion-functions
      mapFromDriverValue(value) {
        return BigInt(value);
      }
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/boolean.js
function boolean(name) {
  return new PgBooleanBuilder(name ?? "");
}
var PgBooleanBuilder, PgBoolean;
var init_boolean = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/boolean.js"() {
    init_entity();
    init_common();
    PgBooleanBuilder = class extends PgColumnBuilder {
      static [entityKind] = "PgBooleanBuilder";
      constructor(name) {
        super(name, "boolean", "PgBoolean");
      }
      /** @internal */
      build(table) {
        return new PgBoolean(table, this.config);
      }
    };
    PgBoolean = class extends PgColumn {
      static [entityKind] = "PgBoolean";
      getSQLType() {
        return "boolean";
      }
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/char.js
function char(a, b = {}) {
  const { name, config } = getColumnNameAndConfig(a, b);
  return new PgCharBuilder(name, config);
}
var PgCharBuilder, PgChar;
var init_char = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/char.js"() {
    init_entity();
    init_utils();
    init_common();
    PgCharBuilder = class extends PgColumnBuilder {
      static [entityKind] = "PgCharBuilder";
      constructor(name, config) {
        super(name, "string", "PgChar");
        this.config.length = config.length;
        this.config.enumValues = config.enum;
      }
      /** @internal */
      build(table) {
        return new PgChar(
          table,
          this.config
        );
      }
    };
    PgChar = class extends PgColumn {
      static [entityKind] = "PgChar";
      length = this.config.length;
      enumValues = this.config.enumValues;
      getSQLType() {
        return this.length === void 0 ? `char` : `char(${this.length})`;
      }
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/cidr.js
function cidr(name) {
  return new PgCidrBuilder(name ?? "");
}
var PgCidrBuilder, PgCidr;
var init_cidr = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/cidr.js"() {
    init_entity();
    init_common();
    PgCidrBuilder = class extends PgColumnBuilder {
      static [entityKind] = "PgCidrBuilder";
      constructor(name) {
        super(name, "string", "PgCidr");
      }
      /** @internal */
      build(table) {
        return new PgCidr(table, this.config);
      }
    };
    PgCidr = class extends PgColumn {
      static [entityKind] = "PgCidr";
      getSQLType() {
        return "cidr";
      }
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/custom.js
function customType(customTypeParams) {
  return (a, b) => {
    const { name, config } = getColumnNameAndConfig(a, b);
    return new PgCustomColumnBuilder(name, config, customTypeParams);
  };
}
var PgCustomColumnBuilder, PgCustomColumn;
var init_custom = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/custom.js"() {
    init_entity();
    init_utils();
    init_common();
    PgCustomColumnBuilder = class extends PgColumnBuilder {
      static [entityKind] = "PgCustomColumnBuilder";
      constructor(name, fieldConfig, customTypeParams) {
        super(name, "custom", "PgCustomColumn");
        this.config.fieldConfig = fieldConfig;
        this.config.customTypeParams = customTypeParams;
      }
      /** @internal */
      build(table) {
        return new PgCustomColumn(
          table,
          this.config
        );
      }
    };
    PgCustomColumn = class extends PgColumn {
      static [entityKind] = "PgCustomColumn";
      sqlName;
      mapTo;
      mapFrom;
      constructor(table, config) {
        super(table, config);
        this.sqlName = config.customTypeParams.dataType(config.fieldConfig);
        this.mapTo = config.customTypeParams.toDriver;
        this.mapFrom = config.customTypeParams.fromDriver;
      }
      getSQLType() {
        return this.sqlName;
      }
      mapFromDriverValue(value) {
        return typeof this.mapFrom === "function" ? this.mapFrom(value) : value;
      }
      mapToDriverValue(value) {
        return typeof this.mapTo === "function" ? this.mapTo(value) : value;
      }
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/date.common.js
var PgDateColumnBaseBuilder;
var init_date_common = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/date.common.js"() {
    init_entity();
    init_sql();
    init_common();
    PgDateColumnBaseBuilder = class extends PgColumnBuilder {
      static [entityKind] = "PgDateColumnBaseBuilder";
      defaultNow() {
        return this.default(sql`now()`);
      }
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/date.js
function date(a, b) {
  const { name, config } = getColumnNameAndConfig(a, b);
  if (config?.mode === "date") {
    return new PgDateBuilder(name);
  }
  return new PgDateStringBuilder(name);
}
var PgDateBuilder, PgDate, PgDateStringBuilder, PgDateString;
var init_date = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/date.js"() {
    init_entity();
    init_utils();
    init_common();
    init_date_common();
    PgDateBuilder = class extends PgDateColumnBaseBuilder {
      static [entityKind] = "PgDateBuilder";
      constructor(name) {
        super(name, "date", "PgDate");
      }
      /** @internal */
      build(table) {
        return new PgDate(table, this.config);
      }
    };
    PgDate = class extends PgColumn {
      static [entityKind] = "PgDate";
      getSQLType() {
        return "date";
      }
      mapFromDriverValue(value) {
        if (typeof value === "string") return new Date(value);
        return value;
      }
      mapToDriverValue(value) {
        return value.toISOString();
      }
    };
    PgDateStringBuilder = class extends PgDateColumnBaseBuilder {
      static [entityKind] = "PgDateStringBuilder";
      constructor(name) {
        super(name, "string", "PgDateString");
      }
      /** @internal */
      build(table) {
        return new PgDateString(
          table,
          this.config
        );
      }
    };
    PgDateString = class extends PgColumn {
      static [entityKind] = "PgDateString";
      getSQLType() {
        return "date";
      }
      mapFromDriverValue(value) {
        if (typeof value === "string") return value;
        return value.toISOString().slice(0, -14);
      }
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/double-precision.js
function doublePrecision(name) {
  return new PgDoublePrecisionBuilder(name ?? "");
}
var PgDoublePrecisionBuilder, PgDoublePrecision;
var init_double_precision = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/double-precision.js"() {
    init_entity();
    init_common();
    PgDoublePrecisionBuilder = class extends PgColumnBuilder {
      static [entityKind] = "PgDoublePrecisionBuilder";
      constructor(name) {
        super(name, "number", "PgDoublePrecision");
      }
      /** @internal */
      build(table) {
        return new PgDoublePrecision(
          table,
          this.config
        );
      }
    };
    PgDoublePrecision = class extends PgColumn {
      static [entityKind] = "PgDoublePrecision";
      getSQLType() {
        return "double precision";
      }
      mapFromDriverValue(value) {
        if (typeof value === "string") {
          return Number.parseFloat(value);
        }
        return value;
      }
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/inet.js
function inet(name) {
  return new PgInetBuilder(name ?? "");
}
var PgInetBuilder, PgInet;
var init_inet = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/inet.js"() {
    init_entity();
    init_common();
    PgInetBuilder = class extends PgColumnBuilder {
      static [entityKind] = "PgInetBuilder";
      constructor(name) {
        super(name, "string", "PgInet");
      }
      /** @internal */
      build(table) {
        return new PgInet(table, this.config);
      }
    };
    PgInet = class extends PgColumn {
      static [entityKind] = "PgInet";
      getSQLType() {
        return "inet";
      }
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/integer.js
function integer(name) {
  return new PgIntegerBuilder(name ?? "");
}
var PgIntegerBuilder, PgInteger;
var init_integer = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/integer.js"() {
    init_entity();
    init_common();
    init_int_common();
    PgIntegerBuilder = class extends PgIntColumnBaseBuilder {
      static [entityKind] = "PgIntegerBuilder";
      constructor(name) {
        super(name, "number", "PgInteger");
      }
      /** @internal */
      build(table) {
        return new PgInteger(table, this.config);
      }
    };
    PgInteger = class extends PgColumn {
      static [entityKind] = "PgInteger";
      getSQLType() {
        return "integer";
      }
      mapFromDriverValue(value) {
        if (typeof value === "string") {
          return Number.parseInt(value);
        }
        return value;
      }
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/interval.js
function interval(a, b = {}) {
  const { name, config } = getColumnNameAndConfig(a, b);
  return new PgIntervalBuilder(name, config);
}
var PgIntervalBuilder, PgInterval;
var init_interval = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/interval.js"() {
    init_entity();
    init_utils();
    init_common();
    PgIntervalBuilder = class extends PgColumnBuilder {
      static [entityKind] = "PgIntervalBuilder";
      constructor(name, intervalConfig) {
        super(name, "string", "PgInterval");
        this.config.intervalConfig = intervalConfig;
      }
      /** @internal */
      build(table) {
        return new PgInterval(table, this.config);
      }
    };
    PgInterval = class extends PgColumn {
      static [entityKind] = "PgInterval";
      fields = this.config.intervalConfig.fields;
      precision = this.config.intervalConfig.precision;
      getSQLType() {
        const fields2 = this.fields ? ` ${this.fields}` : "";
        const precision = this.precision ? `(${this.precision})` : "";
        return `interval${fields2}${precision}`;
      }
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/json.js
function json(name) {
  return new PgJsonBuilder(name ?? "");
}
var PgJsonBuilder, PgJson;
var init_json = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/json.js"() {
    init_entity();
    init_common();
    PgJsonBuilder = class extends PgColumnBuilder {
      static [entityKind] = "PgJsonBuilder";
      constructor(name) {
        super(name, "json", "PgJson");
      }
      /** @internal */
      build(table) {
        return new PgJson(table, this.config);
      }
    };
    PgJson = class extends PgColumn {
      static [entityKind] = "PgJson";
      constructor(table, config) {
        super(table, config);
      }
      getSQLType() {
        return "json";
      }
      mapToDriverValue(value) {
        return JSON.stringify(value);
      }
      mapFromDriverValue(value) {
        if (typeof value === "string") {
          try {
            return JSON.parse(value);
          } catch {
            return value;
          }
        }
        return value;
      }
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/jsonb.js
function jsonb(name) {
  return new PgJsonbBuilder(name ?? "");
}
var PgJsonbBuilder, PgJsonb;
var init_jsonb = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/jsonb.js"() {
    init_entity();
    init_common();
    PgJsonbBuilder = class extends PgColumnBuilder {
      static [entityKind] = "PgJsonbBuilder";
      constructor(name) {
        super(name, "json", "PgJsonb");
      }
      /** @internal */
      build(table) {
        return new PgJsonb(table, this.config);
      }
    };
    PgJsonb = class extends PgColumn {
      static [entityKind] = "PgJsonb";
      constructor(table, config) {
        super(table, config);
      }
      getSQLType() {
        return "jsonb";
      }
      mapToDriverValue(value) {
        return JSON.stringify(value);
      }
      mapFromDriverValue(value) {
        if (typeof value === "string") {
          try {
            return JSON.parse(value);
          } catch {
            return value;
          }
        }
        return value;
      }
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/line.js
function line(a, b) {
  const { name, config } = getColumnNameAndConfig(a, b);
  if (!config?.mode || config.mode === "tuple") {
    return new PgLineBuilder(name);
  }
  return new PgLineABCBuilder(name);
}
var PgLineBuilder, PgLineTuple, PgLineABCBuilder, PgLineABC;
var init_line = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/line.js"() {
    init_entity();
    init_utils();
    init_common();
    PgLineBuilder = class extends PgColumnBuilder {
      static [entityKind] = "PgLineBuilder";
      constructor(name) {
        super(name, "array", "PgLine");
      }
      /** @internal */
      build(table) {
        return new PgLineTuple(
          table,
          this.config
        );
      }
    };
    PgLineTuple = class extends PgColumn {
      static [entityKind] = "PgLine";
      getSQLType() {
        return "line";
      }
      mapFromDriverValue(value) {
        const [a, b, c] = value.slice(1, -1).split(",");
        return [Number.parseFloat(a), Number.parseFloat(b), Number.parseFloat(c)];
      }
      mapToDriverValue(value) {
        return `{${value[0]},${value[1]},${value[2]}}`;
      }
    };
    PgLineABCBuilder = class extends PgColumnBuilder {
      static [entityKind] = "PgLineABCBuilder";
      constructor(name) {
        super(name, "json", "PgLineABC");
      }
      /** @internal */
      build(table) {
        return new PgLineABC(
          table,
          this.config
        );
      }
    };
    PgLineABC = class extends PgColumn {
      static [entityKind] = "PgLineABC";
      getSQLType() {
        return "line";
      }
      mapFromDriverValue(value) {
        const [a, b, c] = value.slice(1, -1).split(",");
        return { a: Number.parseFloat(a), b: Number.parseFloat(b), c: Number.parseFloat(c) };
      }
      mapToDriverValue(value) {
        return `{${value.a},${value.b},${value.c}}`;
      }
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/macaddr.js
function macaddr(name) {
  return new PgMacaddrBuilder(name ?? "");
}
var PgMacaddrBuilder, PgMacaddr;
var init_macaddr = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/macaddr.js"() {
    init_entity();
    init_common();
    PgMacaddrBuilder = class extends PgColumnBuilder {
      static [entityKind] = "PgMacaddrBuilder";
      constructor(name) {
        super(name, "string", "PgMacaddr");
      }
      /** @internal */
      build(table) {
        return new PgMacaddr(table, this.config);
      }
    };
    PgMacaddr = class extends PgColumn {
      static [entityKind] = "PgMacaddr";
      getSQLType() {
        return "macaddr";
      }
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/macaddr8.js
function macaddr8(name) {
  return new PgMacaddr8Builder(name ?? "");
}
var PgMacaddr8Builder, PgMacaddr8;
var init_macaddr8 = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/macaddr8.js"() {
    init_entity();
    init_common();
    PgMacaddr8Builder = class extends PgColumnBuilder {
      static [entityKind] = "PgMacaddr8Builder";
      constructor(name) {
        super(name, "string", "PgMacaddr8");
      }
      /** @internal */
      build(table) {
        return new PgMacaddr8(table, this.config);
      }
    };
    PgMacaddr8 = class extends PgColumn {
      static [entityKind] = "PgMacaddr8";
      getSQLType() {
        return "macaddr8";
      }
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/numeric.js
function numeric(a, b) {
  const { name, config } = getColumnNameAndConfig(a, b);
  const mode = config?.mode;
  return mode === "number" ? new PgNumericNumberBuilder(name, config?.precision, config?.scale) : mode === "bigint" ? new PgNumericBigIntBuilder(name, config?.precision, config?.scale) : new PgNumericBuilder(name, config?.precision, config?.scale);
}
var PgNumericBuilder, PgNumeric, PgNumericNumberBuilder, PgNumericNumber, PgNumericBigIntBuilder, PgNumericBigInt;
var init_numeric = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/numeric.js"() {
    init_entity();
    init_utils();
    init_common();
    PgNumericBuilder = class extends PgColumnBuilder {
      static [entityKind] = "PgNumericBuilder";
      constructor(name, precision, scale) {
        super(name, "string", "PgNumeric");
        this.config.precision = precision;
        this.config.scale = scale;
      }
      /** @internal */
      build(table) {
        return new PgNumeric(table, this.config);
      }
    };
    PgNumeric = class extends PgColumn {
      static [entityKind] = "PgNumeric";
      precision;
      scale;
      constructor(table, config) {
        super(table, config);
        this.precision = config.precision;
        this.scale = config.scale;
      }
      mapFromDriverValue(value) {
        if (typeof value === "string") return value;
        return String(value);
      }
      getSQLType() {
        if (this.precision !== void 0 && this.scale !== void 0) {
          return `numeric(${this.precision}, ${this.scale})`;
        } else if (this.precision === void 0) {
          return "numeric";
        } else {
          return `numeric(${this.precision})`;
        }
      }
    };
    PgNumericNumberBuilder = class extends PgColumnBuilder {
      static [entityKind] = "PgNumericNumberBuilder";
      constructor(name, precision, scale) {
        super(name, "number", "PgNumericNumber");
        this.config.precision = precision;
        this.config.scale = scale;
      }
      /** @internal */
      build(table) {
        return new PgNumericNumber(
          table,
          this.config
        );
      }
    };
    PgNumericNumber = class extends PgColumn {
      static [entityKind] = "PgNumericNumber";
      precision;
      scale;
      constructor(table, config) {
        super(table, config);
        this.precision = config.precision;
        this.scale = config.scale;
      }
      mapFromDriverValue(value) {
        if (typeof value === "number") return value;
        return Number(value);
      }
      mapToDriverValue = String;
      getSQLType() {
        if (this.precision !== void 0 && this.scale !== void 0) {
          return `numeric(${this.precision}, ${this.scale})`;
        } else if (this.precision === void 0) {
          return "numeric";
        } else {
          return `numeric(${this.precision})`;
        }
      }
    };
    PgNumericBigIntBuilder = class extends PgColumnBuilder {
      static [entityKind] = "PgNumericBigIntBuilder";
      constructor(name, precision, scale) {
        super(name, "bigint", "PgNumericBigInt");
        this.config.precision = precision;
        this.config.scale = scale;
      }
      /** @internal */
      build(table) {
        return new PgNumericBigInt(
          table,
          this.config
        );
      }
    };
    PgNumericBigInt = class extends PgColumn {
      static [entityKind] = "PgNumericBigInt";
      precision;
      scale;
      constructor(table, config) {
        super(table, config);
        this.precision = config.precision;
        this.scale = config.scale;
      }
      mapFromDriverValue = BigInt;
      mapToDriverValue = String;
      getSQLType() {
        if (this.precision !== void 0 && this.scale !== void 0) {
          return `numeric(${this.precision}, ${this.scale})`;
        } else if (this.precision === void 0) {
          return "numeric";
        } else {
          return `numeric(${this.precision})`;
        }
      }
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/point.js
function point(a, b) {
  const { name, config } = getColumnNameAndConfig(a, b);
  if (!config?.mode || config.mode === "tuple") {
    return new PgPointTupleBuilder(name);
  }
  return new PgPointObjectBuilder(name);
}
var PgPointTupleBuilder, PgPointTuple, PgPointObjectBuilder, PgPointObject;
var init_point = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/point.js"() {
    init_entity();
    init_utils();
    init_common();
    PgPointTupleBuilder = class extends PgColumnBuilder {
      static [entityKind] = "PgPointTupleBuilder";
      constructor(name) {
        super(name, "array", "PgPointTuple");
      }
      /** @internal */
      build(table) {
        return new PgPointTuple(
          table,
          this.config
        );
      }
    };
    PgPointTuple = class extends PgColumn {
      static [entityKind] = "PgPointTuple";
      getSQLType() {
        return "point";
      }
      mapFromDriverValue(value) {
        if (typeof value === "string") {
          const [x, y] = value.slice(1, -1).split(",");
          return [Number.parseFloat(x), Number.parseFloat(y)];
        }
        return [value.x, value.y];
      }
      mapToDriverValue(value) {
        return `(${value[0]},${value[1]})`;
      }
    };
    PgPointObjectBuilder = class extends PgColumnBuilder {
      static [entityKind] = "PgPointObjectBuilder";
      constructor(name) {
        super(name, "json", "PgPointObject");
      }
      /** @internal */
      build(table) {
        return new PgPointObject(
          table,
          this.config
        );
      }
    };
    PgPointObject = class extends PgColumn {
      static [entityKind] = "PgPointObject";
      getSQLType() {
        return "point";
      }
      mapFromDriverValue(value) {
        if (typeof value === "string") {
          const [x, y] = value.slice(1, -1).split(",");
          return { x: Number.parseFloat(x), y: Number.parseFloat(y) };
        }
        return value;
      }
      mapToDriverValue(value) {
        return `(${value.x},${value.y})`;
      }
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/postgis_extension/utils.js
function hexToBytes(hex) {
  const bytes = [];
  for (let c = 0; c < hex.length; c += 2) {
    bytes.push(Number.parseInt(hex.slice(c, c + 2), 16));
  }
  return new Uint8Array(bytes);
}
function bytesToFloat64(bytes, offset) {
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  for (let i = 0; i < 8; i++) {
    view.setUint8(i, bytes[offset + i]);
  }
  return view.getFloat64(0, true);
}
function parseEWKB(hex) {
  const bytes = hexToBytes(hex);
  let offset = 0;
  const byteOrder = bytes[offset];
  offset += 1;
  const view = new DataView(bytes.buffer);
  const geomType = view.getUint32(offset, byteOrder === 1);
  offset += 4;
  let _srid;
  if (geomType & 536870912) {
    _srid = view.getUint32(offset, byteOrder === 1);
    offset += 4;
  }
  if ((geomType & 65535) === 1) {
    const x = bytesToFloat64(bytes, offset);
    offset += 8;
    const y = bytesToFloat64(bytes, offset);
    offset += 8;
    return [x, y];
  }
  throw new Error("Unsupported geometry type");
}
var init_utils2 = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/postgis_extension/utils.js"() {
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/postgis_extension/geometry.js
function geometry(a, b) {
  const { name, config } = getColumnNameAndConfig(a, b);
  if (!config?.mode || config.mode === "tuple") {
    return new PgGeometryBuilder(name);
  }
  return new PgGeometryObjectBuilder(name);
}
var PgGeometryBuilder, PgGeometry, PgGeometryObjectBuilder, PgGeometryObject;
var init_geometry = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/postgis_extension/geometry.js"() {
    init_entity();
    init_utils();
    init_common();
    init_utils2();
    PgGeometryBuilder = class extends PgColumnBuilder {
      static [entityKind] = "PgGeometryBuilder";
      constructor(name) {
        super(name, "array", "PgGeometry");
      }
      /** @internal */
      build(table) {
        return new PgGeometry(
          table,
          this.config
        );
      }
    };
    PgGeometry = class extends PgColumn {
      static [entityKind] = "PgGeometry";
      getSQLType() {
        return "geometry(point)";
      }
      mapFromDriverValue(value) {
        return parseEWKB(value);
      }
      mapToDriverValue(value) {
        return `point(${value[0]} ${value[1]})`;
      }
    };
    PgGeometryObjectBuilder = class extends PgColumnBuilder {
      static [entityKind] = "PgGeometryObjectBuilder";
      constructor(name) {
        super(name, "json", "PgGeometryObject");
      }
      /** @internal */
      build(table) {
        return new PgGeometryObject(
          table,
          this.config
        );
      }
    };
    PgGeometryObject = class extends PgColumn {
      static [entityKind] = "PgGeometryObject";
      getSQLType() {
        return "geometry(point)";
      }
      mapFromDriverValue(value) {
        const parsed = parseEWKB(value);
        return { x: parsed[0], y: parsed[1] };
      }
      mapToDriverValue(value) {
        return `point(${value.x} ${value.y})`;
      }
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/real.js
function real(name) {
  return new PgRealBuilder(name ?? "");
}
var PgRealBuilder, PgReal;
var init_real = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/real.js"() {
    init_entity();
    init_common();
    PgRealBuilder = class extends PgColumnBuilder {
      static [entityKind] = "PgRealBuilder";
      constructor(name, length) {
        super(name, "number", "PgReal");
        this.config.length = length;
      }
      /** @internal */
      build(table) {
        return new PgReal(table, this.config);
      }
    };
    PgReal = class extends PgColumn {
      static [entityKind] = "PgReal";
      constructor(table, config) {
        super(table, config);
      }
      getSQLType() {
        return "real";
      }
      mapFromDriverValue = (value) => {
        if (typeof value === "string") {
          return Number.parseFloat(value);
        }
        return value;
      };
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/serial.js
function serial(name) {
  return new PgSerialBuilder(name ?? "");
}
var PgSerialBuilder, PgSerial;
var init_serial = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/serial.js"() {
    init_entity();
    init_common();
    PgSerialBuilder = class extends PgColumnBuilder {
      static [entityKind] = "PgSerialBuilder";
      constructor(name) {
        super(name, "number", "PgSerial");
        this.config.hasDefault = true;
        this.config.notNull = true;
      }
      /** @internal */
      build(table) {
        return new PgSerial(table, this.config);
      }
    };
    PgSerial = class extends PgColumn {
      static [entityKind] = "PgSerial";
      getSQLType() {
        return "serial";
      }
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/smallint.js
function smallint(name) {
  return new PgSmallIntBuilder(name ?? "");
}
var PgSmallIntBuilder, PgSmallInt;
var init_smallint = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/smallint.js"() {
    init_entity();
    init_common();
    init_int_common();
    PgSmallIntBuilder = class extends PgIntColumnBaseBuilder {
      static [entityKind] = "PgSmallIntBuilder";
      constructor(name) {
        super(name, "number", "PgSmallInt");
      }
      /** @internal */
      build(table) {
        return new PgSmallInt(table, this.config);
      }
    };
    PgSmallInt = class extends PgColumn {
      static [entityKind] = "PgSmallInt";
      getSQLType() {
        return "smallint";
      }
      mapFromDriverValue = (value) => {
        if (typeof value === "string") {
          return Number(value);
        }
        return value;
      };
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/smallserial.js
function smallserial(name) {
  return new PgSmallSerialBuilder(name ?? "");
}
var PgSmallSerialBuilder, PgSmallSerial;
var init_smallserial = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/smallserial.js"() {
    init_entity();
    init_common();
    PgSmallSerialBuilder = class extends PgColumnBuilder {
      static [entityKind] = "PgSmallSerialBuilder";
      constructor(name) {
        super(name, "number", "PgSmallSerial");
        this.config.hasDefault = true;
        this.config.notNull = true;
      }
      /** @internal */
      build(table) {
        return new PgSmallSerial(
          table,
          this.config
        );
      }
    };
    PgSmallSerial = class extends PgColumn {
      static [entityKind] = "PgSmallSerial";
      getSQLType() {
        return "smallserial";
      }
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/text.js
function text(a, b = {}) {
  const { name, config } = getColumnNameAndConfig(a, b);
  return new PgTextBuilder(name, config);
}
var PgTextBuilder, PgText;
var init_text = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/text.js"() {
    init_entity();
    init_utils();
    init_common();
    PgTextBuilder = class extends PgColumnBuilder {
      static [entityKind] = "PgTextBuilder";
      constructor(name, config) {
        super(name, "string", "PgText");
        this.config.enumValues = config.enum;
      }
      /** @internal */
      build(table) {
        return new PgText(table, this.config);
      }
    };
    PgText = class extends PgColumn {
      static [entityKind] = "PgText";
      enumValues = this.config.enumValues;
      getSQLType() {
        return "text";
      }
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/time.js
function time(a, b = {}) {
  const { name, config } = getColumnNameAndConfig(a, b);
  return new PgTimeBuilder(name, config.withTimezone ?? false, config.precision);
}
var PgTimeBuilder, PgTime;
var init_time = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/time.js"() {
    init_entity();
    init_utils();
    init_common();
    init_date_common();
    PgTimeBuilder = class extends PgDateColumnBaseBuilder {
      constructor(name, withTimezone, precision) {
        super(name, "string", "PgTime");
        this.withTimezone = withTimezone;
        this.precision = precision;
        this.config.withTimezone = withTimezone;
        this.config.precision = precision;
      }
      static [entityKind] = "PgTimeBuilder";
      /** @internal */
      build(table) {
        return new PgTime(table, this.config);
      }
    };
    PgTime = class extends PgColumn {
      static [entityKind] = "PgTime";
      withTimezone;
      precision;
      constructor(table, config) {
        super(table, config);
        this.withTimezone = config.withTimezone;
        this.precision = config.precision;
      }
      getSQLType() {
        const precision = this.precision === void 0 ? "" : `(${this.precision})`;
        return `time${precision}${this.withTimezone ? " with time zone" : ""}`;
      }
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/timestamp.js
function timestamp(a, b = {}) {
  const { name, config } = getColumnNameAndConfig(a, b);
  if (config?.mode === "string") {
    return new PgTimestampStringBuilder(name, config.withTimezone ?? false, config.precision);
  }
  return new PgTimestampBuilder(name, config?.withTimezone ?? false, config?.precision);
}
var PgTimestampBuilder, PgTimestamp, PgTimestampStringBuilder, PgTimestampString;
var init_timestamp = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/timestamp.js"() {
    init_entity();
    init_utils();
    init_common();
    init_date_common();
    PgTimestampBuilder = class extends PgDateColumnBaseBuilder {
      static [entityKind] = "PgTimestampBuilder";
      constructor(name, withTimezone, precision) {
        super(name, "date", "PgTimestamp");
        this.config.withTimezone = withTimezone;
        this.config.precision = precision;
      }
      /** @internal */
      build(table) {
        return new PgTimestamp(table, this.config);
      }
    };
    PgTimestamp = class extends PgColumn {
      static [entityKind] = "PgTimestamp";
      withTimezone;
      precision;
      constructor(table, config) {
        super(table, config);
        this.withTimezone = config.withTimezone;
        this.precision = config.precision;
      }
      getSQLType() {
        const precision = this.precision === void 0 ? "" : ` (${this.precision})`;
        return `timestamp${precision}${this.withTimezone ? " with time zone" : ""}`;
      }
      mapFromDriverValue(value) {
        if (typeof value === "string") return new Date(this.withTimezone ? value : value + "+0000");
        return value;
      }
      mapToDriverValue = (value) => {
        return value.toISOString();
      };
    };
    PgTimestampStringBuilder = class extends PgDateColumnBaseBuilder {
      static [entityKind] = "PgTimestampStringBuilder";
      constructor(name, withTimezone, precision) {
        super(name, "string", "PgTimestampString");
        this.config.withTimezone = withTimezone;
        this.config.precision = precision;
      }
      /** @internal */
      build(table) {
        return new PgTimestampString(
          table,
          this.config
        );
      }
    };
    PgTimestampString = class extends PgColumn {
      static [entityKind] = "PgTimestampString";
      withTimezone;
      precision;
      constructor(table, config) {
        super(table, config);
        this.withTimezone = config.withTimezone;
        this.precision = config.precision;
      }
      getSQLType() {
        const precision = this.precision === void 0 ? "" : `(${this.precision})`;
        return `timestamp${precision}${this.withTimezone ? " with time zone" : ""}`;
      }
      mapFromDriverValue(value) {
        if (typeof value === "string") return value;
        const shortened = value.toISOString().slice(0, -1).replace("T", " ");
        if (this.withTimezone) {
          const offset = value.getTimezoneOffset();
          const sign = offset <= 0 ? "+" : "-";
          return `${shortened}${sign}${Math.floor(Math.abs(offset) / 60).toString().padStart(2, "0")}`;
        }
        return shortened;
      }
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/uuid.js
function uuid(name) {
  return new PgUUIDBuilder(name ?? "");
}
var PgUUIDBuilder, PgUUID;
var init_uuid = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/uuid.js"() {
    init_entity();
    init_sql();
    init_common();
    PgUUIDBuilder = class extends PgColumnBuilder {
      static [entityKind] = "PgUUIDBuilder";
      constructor(name) {
        super(name, "string", "PgUUID");
      }
      /**
       * Adds `default gen_random_uuid()` to the column definition.
       */
      defaultRandom() {
        return this.default(sql`gen_random_uuid()`);
      }
      /** @internal */
      build(table) {
        return new PgUUID(table, this.config);
      }
    };
    PgUUID = class extends PgColumn {
      static [entityKind] = "PgUUID";
      getSQLType() {
        return "uuid";
      }
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/varchar.js
function varchar(a, b = {}) {
  const { name, config } = getColumnNameAndConfig(a, b);
  return new PgVarcharBuilder(name, config);
}
var PgVarcharBuilder, PgVarchar;
var init_varchar = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/varchar.js"() {
    init_entity();
    init_utils();
    init_common();
    PgVarcharBuilder = class extends PgColumnBuilder {
      static [entityKind] = "PgVarcharBuilder";
      constructor(name, config) {
        super(name, "string", "PgVarchar");
        this.config.length = config.length;
        this.config.enumValues = config.enum;
      }
      /** @internal */
      build(table) {
        return new PgVarchar(
          table,
          this.config
        );
      }
    };
    PgVarchar = class extends PgColumn {
      static [entityKind] = "PgVarchar";
      length = this.config.length;
      enumValues = this.config.enumValues;
      getSQLType() {
        return this.length === void 0 ? `varchar` : `varchar(${this.length})`;
      }
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/vector_extension/bit.js
function bit(a, b) {
  const { name, config } = getColumnNameAndConfig(a, b);
  return new PgBinaryVectorBuilder(name, config);
}
var PgBinaryVectorBuilder, PgBinaryVector;
var init_bit = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/vector_extension/bit.js"() {
    init_entity();
    init_utils();
    init_common();
    PgBinaryVectorBuilder = class extends PgColumnBuilder {
      static [entityKind] = "PgBinaryVectorBuilder";
      constructor(name, config) {
        super(name, "string", "PgBinaryVector");
        this.config.dimensions = config.dimensions;
      }
      /** @internal */
      build(table) {
        return new PgBinaryVector(
          table,
          this.config
        );
      }
    };
    PgBinaryVector = class extends PgColumn {
      static [entityKind] = "PgBinaryVector";
      dimensions = this.config.dimensions;
      getSQLType() {
        return `bit(${this.dimensions})`;
      }
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/vector_extension/halfvec.js
function halfvec(a, b) {
  const { name, config } = getColumnNameAndConfig(a, b);
  return new PgHalfVectorBuilder(name, config);
}
var PgHalfVectorBuilder, PgHalfVector;
var init_halfvec = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/vector_extension/halfvec.js"() {
    init_entity();
    init_utils();
    init_common();
    PgHalfVectorBuilder = class extends PgColumnBuilder {
      static [entityKind] = "PgHalfVectorBuilder";
      constructor(name, config) {
        super(name, "array", "PgHalfVector");
        this.config.dimensions = config.dimensions;
      }
      /** @internal */
      build(table) {
        return new PgHalfVector(
          table,
          this.config
        );
      }
    };
    PgHalfVector = class extends PgColumn {
      static [entityKind] = "PgHalfVector";
      dimensions = this.config.dimensions;
      getSQLType() {
        return `halfvec(${this.dimensions})`;
      }
      mapToDriverValue(value) {
        return JSON.stringify(value);
      }
      mapFromDriverValue(value) {
        return value.slice(1, -1).split(",").map((v) => Number.parseFloat(v));
      }
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/vector_extension/sparsevec.js
function sparsevec(a, b) {
  const { name, config } = getColumnNameAndConfig(a, b);
  return new PgSparseVectorBuilder(name, config);
}
var PgSparseVectorBuilder, PgSparseVector;
var init_sparsevec = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/vector_extension/sparsevec.js"() {
    init_entity();
    init_utils();
    init_common();
    PgSparseVectorBuilder = class extends PgColumnBuilder {
      static [entityKind] = "PgSparseVectorBuilder";
      constructor(name, config) {
        super(name, "string", "PgSparseVector");
        this.config.dimensions = config.dimensions;
      }
      /** @internal */
      build(table) {
        return new PgSparseVector(
          table,
          this.config
        );
      }
    };
    PgSparseVector = class extends PgColumn {
      static [entityKind] = "PgSparseVector";
      dimensions = this.config.dimensions;
      getSQLType() {
        return `sparsevec(${this.dimensions})`;
      }
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/vector_extension/vector.js
function vector(a, b) {
  const { name, config } = getColumnNameAndConfig(a, b);
  return new PgVectorBuilder(name, config);
}
var PgVectorBuilder, PgVector;
var init_vector = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/vector_extension/vector.js"() {
    init_entity();
    init_utils();
    init_common();
    PgVectorBuilder = class extends PgColumnBuilder {
      static [entityKind] = "PgVectorBuilder";
      constructor(name, config) {
        super(name, "array", "PgVector");
        this.config.dimensions = config.dimensions;
      }
      /** @internal */
      build(table) {
        return new PgVector(
          table,
          this.config
        );
      }
    };
    PgVector = class extends PgColumn {
      static [entityKind] = "PgVector";
      dimensions = this.config.dimensions;
      getSQLType() {
        return `vector(${this.dimensions})`;
      }
      mapToDriverValue(value) {
        return JSON.stringify(value);
      }
      mapFromDriverValue(value) {
        return value.slice(1, -1).split(",").map((v) => Number.parseFloat(v));
      }
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/all.js
function getPgColumnBuilders() {
  return {
    bigint,
    bigserial,
    boolean,
    char,
    cidr,
    customType,
    date,
    doublePrecision,
    inet,
    integer,
    interval,
    json,
    jsonb,
    line,
    macaddr,
    macaddr8,
    numeric,
    point,
    geometry,
    real,
    serial,
    smallint,
    smallserial,
    text,
    time,
    timestamp,
    uuid,
    varchar,
    bit,
    halfvec,
    sparsevec,
    vector
  };
}
var init_all = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/all.js"() {
    init_bigint();
    init_bigserial();
    init_boolean();
    init_char();
    init_cidr();
    init_custom();
    init_date();
    init_double_precision();
    init_inet();
    init_integer();
    init_interval();
    init_json();
    init_jsonb();
    init_line();
    init_macaddr();
    init_macaddr8();
    init_numeric();
    init_point();
    init_geometry();
    init_real();
    init_serial();
    init_smallint();
    init_smallserial();
    init_text();
    init_time();
    init_timestamp();
    init_uuid();
    init_varchar();
    init_bit();
    init_halfvec();
    init_sparsevec();
    init_vector();
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/table.js
function pgTableWithSchema(name, columns, extraConfig, schema, baseName = name) {
  const rawTable = new PgTable(name, schema, baseName);
  const parsedColumns = typeof columns === "function" ? columns(getPgColumnBuilders()) : columns;
  const builtColumns = Object.fromEntries(
    Object.entries(parsedColumns).map(([name2, colBuilderBase]) => {
      const colBuilder = colBuilderBase;
      colBuilder.setName(name2);
      const column = colBuilder.build(rawTable);
      rawTable[InlineForeignKeys].push(...colBuilder.buildForeignKeys(column, rawTable));
      return [name2, column];
    })
  );
  const builtColumnsForExtraConfig = Object.fromEntries(
    Object.entries(parsedColumns).map(([name2, colBuilderBase]) => {
      const colBuilder = colBuilderBase;
      colBuilder.setName(name2);
      const column = colBuilder.buildExtraConfigColumn(rawTable);
      return [name2, column];
    })
  );
  const table = Object.assign(rawTable, builtColumns);
  table[Table.Symbol.Columns] = builtColumns;
  table[Table.Symbol.ExtraConfigColumns] = builtColumnsForExtraConfig;
  if (extraConfig) {
    table[PgTable.Symbol.ExtraConfigBuilder] = extraConfig;
  }
  return Object.assign(table, {
    enableRLS: () => {
      table[PgTable.Symbol.EnableRLS] = true;
      return table;
    }
  });
}
var InlineForeignKeys, EnableRLS, PgTable, pgTable;
var init_table2 = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/table.js"() {
    init_entity();
    init_table();
    init_all();
    InlineForeignKeys = /* @__PURE__ */ Symbol.for("drizzle:PgInlineForeignKeys");
    EnableRLS = /* @__PURE__ */ Symbol.for("drizzle:EnableRLS");
    PgTable = class extends Table {
      static [entityKind] = "PgTable";
      /** @internal */
      static Symbol = Object.assign({}, Table.Symbol, {
        InlineForeignKeys,
        EnableRLS
      });
      /**@internal */
      [InlineForeignKeys] = [];
      /** @internal */
      [EnableRLS] = false;
      /** @internal */
      [Table.Symbol.ExtraConfigBuilder] = void 0;
      /** @internal */
      [Table.Symbol.ExtraConfigColumns] = {};
    };
    pgTable = (name, columns, extraConfig) => {
      return pgTableWithSchema(name, columns, extraConfig, void 0);
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/checks.js
function check(name, value) {
  return new CheckBuilder(name, value);
}
var CheckBuilder, Check;
var init_checks = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/checks.js"() {
    init_entity();
    CheckBuilder = class {
      constructor(name, value) {
        this.name = name;
        this.value = value;
      }
      static [entityKind] = "PgCheckBuilder";
      brand;
      /** @internal */
      build(table) {
        return new Check(table, this);
      }
    };
    Check = class {
      constructor(table, builder) {
        this.table = table;
        this.name = builder.name;
        this.value = builder.value;
      }
      static [entityKind] = "PgCheck";
      name;
      value;
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/index.js
var init_columns = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/columns/index.js"() {
    init_bigint();
    init_bigserial();
    init_boolean();
    init_char();
    init_cidr();
    init_common();
    init_custom();
    init_date();
    init_double_precision();
    init_enum();
    init_inet();
    init_int_common();
    init_integer();
    init_interval();
    init_json();
    init_jsonb();
    init_line();
    init_macaddr();
    init_macaddr8();
    init_numeric();
    init_point();
    init_geometry();
    init_real();
    init_serial();
    init_smallint();
    init_smallserial();
    init_text();
    init_time();
    init_timestamp();
    init_uuid();
    init_varchar();
    init_bit();
    init_halfvec();
    init_sparsevec();
    init_vector();
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/indexes.js
function index(name) {
  return new IndexBuilderOn(false, name);
}
function uniqueIndex(name) {
  return new IndexBuilderOn(true, name);
}
var IndexBuilderOn, IndexBuilder, Index;
var init_indexes = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/indexes.js"() {
    init_sql();
    init_entity();
    init_columns();
    IndexBuilderOn = class {
      constructor(unique, name) {
        this.unique = unique;
        this.name = name;
      }
      static [entityKind] = "PgIndexBuilderOn";
      on(...columns) {
        return new IndexBuilder(
          columns.map((it) => {
            if (is(it, SQL)) {
              return it;
            }
            it = it;
            const clonedIndexedColumn = new IndexedColumn(it.name, !!it.keyAsName, it.columnType, it.indexConfig);
            it.indexConfig = JSON.parse(JSON.stringify(it.defaultConfig));
            return clonedIndexedColumn;
          }),
          this.unique,
          false,
          this.name
        );
      }
      onOnly(...columns) {
        return new IndexBuilder(
          columns.map((it) => {
            if (is(it, SQL)) {
              return it;
            }
            it = it;
            const clonedIndexedColumn = new IndexedColumn(it.name, !!it.keyAsName, it.columnType, it.indexConfig);
            it.indexConfig = it.defaultConfig;
            return clonedIndexedColumn;
          }),
          this.unique,
          true,
          this.name
        );
      }
      /**
       * Specify what index method to use. Choices are `btree`, `hash`, `gist`, `spgist`, `gin`, `brin`, or user-installed access methods like `bloom`. The default method is `btree.
       *
       * If you have the `pg_vector` extension installed in your database, you can use the `hnsw` and `ivfflat` options, which are predefined types.
       *
       * **You can always specify any string you want in the method, in case Drizzle doesn't have it natively in its types**
       *
       * @param method The name of the index method to be used
       * @param columns
       * @returns
       */
      using(method, ...columns) {
        return new IndexBuilder(
          columns.map((it) => {
            if (is(it, SQL)) {
              return it;
            }
            it = it;
            const clonedIndexedColumn = new IndexedColumn(it.name, !!it.keyAsName, it.columnType, it.indexConfig);
            it.indexConfig = JSON.parse(JSON.stringify(it.defaultConfig));
            return clonedIndexedColumn;
          }),
          this.unique,
          true,
          this.name,
          method
        );
      }
    };
    IndexBuilder = class {
      static [entityKind] = "PgIndexBuilder";
      /** @internal */
      config;
      constructor(columns, unique, only, name, method = "btree") {
        this.config = {
          name,
          columns,
          unique,
          only,
          method
        };
      }
      concurrently() {
        this.config.concurrently = true;
        return this;
      }
      with(obj) {
        this.config.with = obj;
        return this;
      }
      where(condition) {
        this.config.where = condition;
        return this;
      }
      /** @internal */
      build(table) {
        return new Index(this.config, table);
      }
    };
    Index = class {
      static [entityKind] = "PgIndex";
      config;
      constructor(config, table) {
        this.config = { ...config, table };
      }
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/policies.js
var PgPolicy;
var init_policies = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/policies.js"() {
    init_entity();
    PgPolicy = class {
      constructor(name, config) {
        this.name = name;
        if (config) {
          this.as = config.as;
          this.for = config.for;
          this.to = config.to;
          this.using = config.using;
          this.withCheck = config.withCheck;
        }
      }
      static [entityKind] = "PgPolicy";
      as;
      for;
      to;
      using;
      withCheck;
      /** @internal */
      _linkedTable;
      link(table) {
        this._linkedTable = table;
        return this;
      }
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/primary-keys.js
function primaryKey(...config) {
  if (config[0].columns) {
    return new PrimaryKeyBuilder(config[0].columns, config[0].name);
  }
  return new PrimaryKeyBuilder(config);
}
var PrimaryKeyBuilder, PrimaryKey;
var init_primary_keys = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/primary-keys.js"() {
    init_entity();
    init_table2();
    PrimaryKeyBuilder = class {
      static [entityKind] = "PgPrimaryKeyBuilder";
      /** @internal */
      columns;
      /** @internal */
      name;
      constructor(columns, name) {
        this.columns = columns;
        this.name = name;
      }
      /** @internal */
      build(table) {
        return new PrimaryKey(table, this.columns, this.name);
      }
    };
    PrimaryKey = class {
      constructor(table, columns, name) {
        this.table = table;
        this.columns = columns;
        this.name = name;
      }
      static [entityKind] = "PgPrimaryKey";
      columns;
      name;
      getName() {
        return this.name ?? `${this.table[PgTable.Symbol.Name]}_${this.columns.map((column) => column.name).join("_")}_pk`;
      }
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/view-common.js
var PgViewConfig;
var init_view_common2 = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/view-common.js"() {
    PgViewConfig = /* @__PURE__ */ Symbol.for("drizzle:PgViewConfig");
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/casing.js
function toSnakeCase(input) {
  const words = input.replace(/['\u2019]/g, "").match(/[\da-z]+|[A-Z]+(?![a-z])|[A-Z][\da-z]+/g) ?? [];
  return words.map((word) => word.toLowerCase()).join("_");
}
function toCamelCase(input) {
  const words = input.replace(/['\u2019]/g, "").match(/[\da-z]+|[A-Z]+(?![a-z])|[A-Z][\da-z]+/g) ?? [];
  return words.reduce((acc, word, i) => {
    const formattedWord = i === 0 ? word.toLowerCase() : `${word[0].toUpperCase()}${word.slice(1)}`;
    return acc + formattedWord;
  }, "");
}
function noopCase(input) {
  return input;
}
var CasingCache;
var init_casing = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/casing.js"() {
    init_entity();
    init_table();
    CasingCache = class {
      static [entityKind] = "CasingCache";
      /** @internal */
      cache = {};
      cachedTables = {};
      convert;
      constructor(casing) {
        this.convert = casing === "snake_case" ? toSnakeCase : casing === "camelCase" ? toCamelCase : noopCase;
      }
      getColumnCasing(column) {
        if (!column.keyAsName) return column.name;
        const schema = column.table[Table.Symbol.Schema] ?? "public";
        const tableName = column.table[Table.Symbol.OriginalName];
        const key2 = `${schema}.${tableName}.${column.name}`;
        if (!this.cache[key2]) {
          this.cacheTable(column.table);
        }
        return this.cache[key2];
      }
      cacheTable(table) {
        const schema = table[Table.Symbol.Schema] ?? "public";
        const tableName = table[Table.Symbol.OriginalName];
        const tableKey = `${schema}.${tableName}`;
        if (!this.cachedTables[tableKey]) {
          for (const column of Object.values(table[Table.Symbol.Columns])) {
            const columnKey = `${tableKey}.${column.name}`;
            this.cache[columnKey] = this.convert(column.name);
          }
          this.cachedTables[tableKey] = true;
        }
      }
      clearCache() {
        this.cache = {};
        this.cachedTables = {};
      }
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/errors.js
var DrizzleError, DrizzleQueryError, TransactionRollbackError;
var init_errors = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/errors.js"() {
    init_entity();
    DrizzleError = class extends Error {
      static [entityKind] = "DrizzleError";
      constructor({ message, cause }) {
        super(message);
        this.name = "DrizzleError";
        this.cause = cause;
      }
    };
    DrizzleQueryError = class _DrizzleQueryError extends Error {
      constructor(query2, params, cause) {
        super(`Failed query: ${query2}
params: ${params}`);
        this.query = query2;
        this.params = params;
        this.cause = cause;
        Error.captureStackTrace(this, _DrizzleQueryError);
        if (cause) this.cause = cause;
      }
    };
    TransactionRollbackError = class extends DrizzleError {
      static [entityKind] = "TransactionRollbackError";
      constructor() {
        super({ message: "Rollback" });
      }
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/sql/expressions/conditions.js
function bindIfParam(value, column) {
  if (isDriverValueEncoder(column) && !isSQLWrapper(value) && !is(value, Param) && !is(value, Placeholder) && !is(value, Column) && !is(value, Table) && !is(value, View)) {
    return new Param(value, column);
  }
  return value;
}
function and(...unfilteredConditions) {
  const conditions = unfilteredConditions.filter(
    (c) => c !== void 0
  );
  if (conditions.length === 0) {
    return void 0;
  }
  if (conditions.length === 1) {
    return new SQL(conditions);
  }
  return new SQL([
    new StringChunk("("),
    sql.join(conditions, new StringChunk(" and ")),
    new StringChunk(")")
  ]);
}
function or(...unfilteredConditions) {
  const conditions = unfilteredConditions.filter(
    (c) => c !== void 0
  );
  if (conditions.length === 0) {
    return void 0;
  }
  if (conditions.length === 1) {
    return new SQL(conditions);
  }
  return new SQL([
    new StringChunk("("),
    sql.join(conditions, new StringChunk(" or ")),
    new StringChunk(")")
  ]);
}
function not(condition) {
  return sql`not ${condition}`;
}
function inArray(column, values) {
  if (Array.isArray(values)) {
    if (values.length === 0) {
      return sql`false`;
    }
    return sql`${column} in ${values.map((v) => bindIfParam(v, column))}`;
  }
  return sql`${column} in ${bindIfParam(values, column)}`;
}
function notInArray(column, values) {
  if (Array.isArray(values)) {
    if (values.length === 0) {
      return sql`true`;
    }
    return sql`${column} not in ${values.map((v) => bindIfParam(v, column))}`;
  }
  return sql`${column} not in ${bindIfParam(values, column)}`;
}
function isNull(value) {
  return sql`${value} is null`;
}
function isNotNull(value) {
  return sql`${value} is not null`;
}
function exists(subquery) {
  return sql`exists ${subquery}`;
}
function notExists(subquery) {
  return sql`not exists ${subquery}`;
}
function between(column, min, max) {
  return sql`${column} between ${bindIfParam(min, column)} and ${bindIfParam(
    max,
    column
  )}`;
}
function notBetween(column, min, max) {
  return sql`${column} not between ${bindIfParam(
    min,
    column
  )} and ${bindIfParam(max, column)}`;
}
function like(column, value) {
  return sql`${column} like ${value}`;
}
function notLike(column, value) {
  return sql`${column} not like ${value}`;
}
function ilike(column, value) {
  return sql`${column} ilike ${value}`;
}
function notIlike(column, value) {
  return sql`${column} not ilike ${value}`;
}
var eq, ne, gt, gte, lt, lte;
var init_conditions = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/sql/expressions/conditions.js"() {
    init_column();
    init_entity();
    init_table();
    init_sql();
    eq = (left, right) => {
      return sql`${left} = ${bindIfParam(right, left)}`;
    };
    ne = (left, right) => {
      return sql`${left} <> ${bindIfParam(right, left)}`;
    };
    gt = (left, right) => {
      return sql`${left} > ${bindIfParam(right, left)}`;
    };
    gte = (left, right) => {
      return sql`${left} >= ${bindIfParam(right, left)}`;
    };
    lt = (left, right) => {
      return sql`${left} < ${bindIfParam(right, left)}`;
    };
    lte = (left, right) => {
      return sql`${left} <= ${bindIfParam(right, left)}`;
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/sql/expressions/select.js
function asc(column) {
  return sql`${column} asc`;
}
function desc(column) {
  return sql`${column} desc`;
}
var init_select = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/sql/expressions/select.js"() {
    init_sql();
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/sql/expressions/index.js
var init_expressions = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/sql/expressions/index.js"() {
    init_conditions();
    init_select();
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/relations.js
function getOperators() {
  return {
    and,
    between,
    eq,
    exists,
    gt,
    gte,
    ilike,
    inArray,
    isNull,
    isNotNull,
    like,
    lt,
    lte,
    ne,
    not,
    notBetween,
    notExists,
    notLike,
    notIlike,
    notInArray,
    or,
    sql
  };
}
function getOrderByOperators() {
  return {
    sql,
    asc,
    desc
  };
}
function extractTablesRelationalConfig(schema, configHelpers) {
  if (Object.keys(schema).length === 1 && "default" in schema && !is(schema["default"], Table)) {
    schema = schema["default"];
  }
  const tableNamesMap = {};
  const relationsBuffer = {};
  const tablesConfig = {};
  for (const [key2, value] of Object.entries(schema)) {
    if (is(value, Table)) {
      const dbName = getTableUniqueName(value);
      const bufferedRelations = relationsBuffer[dbName];
      tableNamesMap[dbName] = key2;
      tablesConfig[key2] = {
        tsName: key2,
        dbName: value[Table.Symbol.Name],
        schema: value[Table.Symbol.Schema],
        columns: value[Table.Symbol.Columns],
        relations: bufferedRelations?.relations ?? {},
        primaryKey: bufferedRelations?.primaryKey ?? []
      };
      for (const column of Object.values(
        value[Table.Symbol.Columns]
      )) {
        if (column.primary) {
          tablesConfig[key2].primaryKey.push(column);
        }
      }
      const extraConfig = value[Table.Symbol.ExtraConfigBuilder]?.(value[Table.Symbol.ExtraConfigColumns]);
      if (extraConfig) {
        for (const configEntry of Object.values(extraConfig)) {
          if (is(configEntry, PrimaryKeyBuilder)) {
            tablesConfig[key2].primaryKey.push(...configEntry.columns);
          }
        }
      }
    } else if (is(value, Relations)) {
      const dbName = getTableUniqueName(value.table);
      const tableName = tableNamesMap[dbName];
      const relations2 = value.config(
        configHelpers(value.table)
      );
      let primaryKey2;
      for (const [relationName, relation] of Object.entries(relations2)) {
        if (tableName) {
          const tableConfig = tablesConfig[tableName];
          tableConfig.relations[relationName] = relation;
          if (primaryKey2) {
            tableConfig.primaryKey.push(...primaryKey2);
          }
        } else {
          if (!(dbName in relationsBuffer)) {
            relationsBuffer[dbName] = {
              relations: {},
              primaryKey: primaryKey2
            };
          }
          relationsBuffer[dbName].relations[relationName] = relation;
        }
      }
    }
  }
  return { tables: tablesConfig, tableNamesMap };
}
function createOne(sourceTable) {
  return function one2(table, config) {
    return new One(
      sourceTable,
      table,
      config,
      config?.fields.reduce((res, f) => res && f.notNull, true) ?? false
    );
  };
}
function createMany(sourceTable) {
  return function many(referencedTable, config) {
    return new Many(sourceTable, referencedTable, config);
  };
}
function normalizeRelation(schema, tableNamesMap, relation) {
  if (is(relation, One) && relation.config) {
    return {
      fields: relation.config.fields,
      references: relation.config.references
    };
  }
  const referencedTableTsName = tableNamesMap[getTableUniqueName(relation.referencedTable)];
  if (!referencedTableTsName) {
    throw new Error(
      `Table "${relation.referencedTable[Table.Symbol.Name]}" not found in schema`
    );
  }
  const referencedTableConfig = schema[referencedTableTsName];
  if (!referencedTableConfig) {
    throw new Error(`Table "${referencedTableTsName}" not found in schema`);
  }
  const sourceTable = relation.sourceTable;
  const sourceTableTsName = tableNamesMap[getTableUniqueName(sourceTable)];
  if (!sourceTableTsName) {
    throw new Error(
      `Table "${sourceTable[Table.Symbol.Name]}" not found in schema`
    );
  }
  const reverseRelations = [];
  for (const referencedTableRelation of Object.values(
    referencedTableConfig.relations
  )) {
    if (relation.relationName && relation !== referencedTableRelation && referencedTableRelation.relationName === relation.relationName || !relation.relationName && referencedTableRelation.referencedTable === relation.sourceTable) {
      reverseRelations.push(referencedTableRelation);
    }
  }
  if (reverseRelations.length > 1) {
    throw relation.relationName ? new Error(
      `There are multiple relations with name "${relation.relationName}" in table "${referencedTableTsName}"`
    ) : new Error(
      `There are multiple relations between "${referencedTableTsName}" and "${relation.sourceTable[Table.Symbol.Name]}". Please specify relation name`
    );
  }
  if (reverseRelations[0] && is(reverseRelations[0], One) && reverseRelations[0].config) {
    return {
      fields: reverseRelations[0].config.references,
      references: reverseRelations[0].config.fields
    };
  }
  throw new Error(
    `There is not enough information to infer relation "${sourceTableTsName}.${relation.fieldName}"`
  );
}
function createTableRelationsHelpers(sourceTable) {
  return {
    one: createOne(sourceTable),
    many: createMany(sourceTable)
  };
}
function mapRelationalRow(tablesConfig, tableConfig, row, buildQueryResultSelection, mapColumnValue = (value) => value) {
  const result = {};
  for (const [
    selectionItemIndex,
    selectionItem
  ] of buildQueryResultSelection.entries()) {
    if (selectionItem.isJson) {
      const relation = tableConfig.relations[selectionItem.tsKey];
      const rawSubRows = row[selectionItemIndex];
      const subRows = typeof rawSubRows === "string" ? JSON.parse(rawSubRows) : rawSubRows;
      result[selectionItem.tsKey] = is(relation, One) ? subRows && mapRelationalRow(
        tablesConfig,
        tablesConfig[selectionItem.relationTableTsKey],
        subRows,
        selectionItem.selection,
        mapColumnValue
      ) : subRows.map(
        (subRow) => mapRelationalRow(
          tablesConfig,
          tablesConfig[selectionItem.relationTableTsKey],
          subRow,
          selectionItem.selection,
          mapColumnValue
        )
      );
    } else {
      const value = mapColumnValue(row[selectionItemIndex]);
      const field = selectionItem.field;
      let decoder;
      if (is(field, Column)) {
        decoder = field;
      } else if (is(field, SQL)) {
        decoder = field.decoder;
      } else {
        decoder = field.sql.decoder;
      }
      result[selectionItem.tsKey] = value === null ? null : decoder.mapFromDriverValue(value);
    }
  }
  return result;
}
var Relation, Relations, One, Many;
var init_relations = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/relations.js"() {
    init_table();
    init_column();
    init_entity();
    init_primary_keys();
    init_expressions();
    init_sql();
    Relation = class {
      constructor(sourceTable, referencedTable, relationName) {
        this.sourceTable = sourceTable;
        this.referencedTable = referencedTable;
        this.relationName = relationName;
        this.referencedTableName = referencedTable[Table.Symbol.Name];
      }
      static [entityKind] = "Relation";
      referencedTableName;
      fieldName;
    };
    Relations = class {
      constructor(table, config) {
        this.table = table;
        this.config = config;
      }
      static [entityKind] = "Relations";
    };
    One = class _One extends Relation {
      constructor(sourceTable, referencedTable, config, isNullable) {
        super(sourceTable, referencedTable, config?.relationName);
        this.config = config;
        this.isNullable = isNullable;
      }
      static [entityKind] = "One";
      withFieldName(fieldName) {
        const relation = new _One(
          this.sourceTable,
          this.referencedTable,
          this.config,
          this.isNullable
        );
        relation.fieldName = fieldName;
        return relation;
      }
    };
    Many = class _Many extends Relation {
      constructor(sourceTable, referencedTable, config) {
        super(sourceTable, referencedTable, config?.relationName);
        this.config = config;
      }
      static [entityKind] = "Many";
      withFieldName(fieldName) {
        const relation = new _Many(
          this.sourceTable,
          this.referencedTable,
          this.config
        );
        relation.fieldName = fieldName;
        return relation;
      }
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/sql/functions/aggregate.js
var init_aggregate = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/sql/functions/aggregate.js"() {
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/sql/functions/vector.js
var init_vector2 = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/sql/functions/vector.js"() {
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/sql/functions/index.js
var init_functions = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/sql/functions/index.js"() {
    init_aggregate();
    init_vector2();
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/sql/index.js
var init_sql2 = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/sql/index.js"() {
    init_expressions();
    init_functions();
    init_sql();
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/view-base.js
var PgViewBase;
var init_view_base = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/view-base.js"() {
    init_entity();
    init_sql();
    PgViewBase = class extends View {
      static [entityKind] = "PgViewBase";
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/dialect.js
var PgDialect;
var init_dialect = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/dialect.js"() {
    init_alias();
    init_casing();
    init_column();
    init_entity();
    init_errors();
    init_columns();
    init_table2();
    init_relations();
    init_sql2();
    init_sql();
    init_subquery();
    init_table();
    init_utils();
    init_view_common();
    init_view_base();
    PgDialect = class {
      static [entityKind] = "PgDialect";
      /** @internal */
      casing;
      constructor(config) {
        this.casing = new CasingCache(config?.casing);
      }
      async migrate(migrations, session, config) {
        const migrationsTable = typeof config === "string" ? "__drizzle_migrations" : config.migrationsTable ?? "__drizzle_migrations";
        const migrationsSchema = typeof config === "string" ? "drizzle" : config.migrationsSchema ?? "drizzle";
        const migrationTableCreate = sql`
			CREATE TABLE IF NOT EXISTS ${sql.identifier(migrationsSchema)}.${sql.identifier(migrationsTable)} (
				id SERIAL PRIMARY KEY,
				hash text NOT NULL,
				created_at bigint
			)
		`;
        await session.execute(sql`CREATE SCHEMA IF NOT EXISTS ${sql.identifier(migrationsSchema)}`);
        await session.execute(migrationTableCreate);
        const dbMigrations = await session.all(
          sql`select id, hash, created_at from ${sql.identifier(migrationsSchema)}.${sql.identifier(migrationsTable)} order by created_at desc limit 1`
        );
        const lastDbMigration = dbMigrations[0];
        await session.transaction(async (tx) => {
          for await (const migration of migrations) {
            if (!lastDbMigration || Number(lastDbMigration.created_at) < migration.folderMillis) {
              for (const stmt of migration.sql) {
                await tx.execute(sql.raw(stmt));
              }
              await tx.execute(
                sql`insert into ${sql.identifier(migrationsSchema)}.${sql.identifier(migrationsTable)} ("hash", "created_at") values(${migration.hash}, ${migration.folderMillis})`
              );
            }
          }
        });
      }
      escapeName(name) {
        return `"${name.replace(/"/g, '""')}"`;
      }
      escapeParam(num) {
        return `$${num + 1}`;
      }
      escapeString(str) {
        return `'${str.replace(/'/g, "''")}'`;
      }
      buildWithCTE(queries) {
        if (!queries?.length) return void 0;
        const withSqlChunks = [sql`with `];
        for (const [i, w] of queries.entries()) {
          withSqlChunks.push(sql`${sql.identifier(w._.alias)} as (${w._.sql})`);
          if (i < queries.length - 1) {
            withSqlChunks.push(sql`, `);
          }
        }
        withSqlChunks.push(sql` `);
        return sql.join(withSqlChunks);
      }
      buildDeleteQuery({ table, where, returning, withList }) {
        const withSql = this.buildWithCTE(withList);
        const returningSql = returning ? sql` returning ${this.buildSelection(returning, { isSingleTable: true })}` : void 0;
        const whereSql = where ? sql` where ${where}` : void 0;
        return sql`${withSql}delete from ${table}${whereSql}${returningSql}`;
      }
      buildUpdateSet(table, set) {
        const tableColumns = table[Table.Symbol.Columns];
        const columnNames = Object.keys(tableColumns).filter(
          (colName) => set[colName] !== void 0 || tableColumns[colName]?.onUpdateFn !== void 0
        );
        const setSize = columnNames.length;
        return sql.join(columnNames.flatMap((colName, i) => {
          const col = tableColumns[colName];
          const onUpdateFnResult = col.onUpdateFn?.();
          const value = set[colName] ?? (is(onUpdateFnResult, SQL) ? onUpdateFnResult : sql.param(onUpdateFnResult, col));
          const res = sql`${sql.identifier(this.casing.getColumnCasing(col))} = ${value}`;
          if (i < setSize - 1) {
            return [res, sql.raw(", ")];
          }
          return [res];
        }));
      }
      buildUpdateQuery({ table, set, where, returning, withList, from, joins }) {
        const withSql = this.buildWithCTE(withList);
        const tableName = table[PgTable.Symbol.Name];
        const tableSchema = table[PgTable.Symbol.Schema];
        const origTableName = table[PgTable.Symbol.OriginalName];
        const alias = tableName === origTableName ? void 0 : tableName;
        const tableSql = sql`${tableSchema ? sql`${sql.identifier(tableSchema)}.` : void 0}${sql.identifier(origTableName)}${alias && sql` ${sql.identifier(alias)}`}`;
        const setSql = this.buildUpdateSet(table, set);
        const fromSql = from && sql.join([sql.raw(" from "), this.buildFromTable(from)]);
        const joinsSql = this.buildJoins(joins);
        const returningSql = returning ? sql` returning ${this.buildSelection(returning, { isSingleTable: !from })}` : void 0;
        const whereSql = where ? sql` where ${where}` : void 0;
        return sql`${withSql}update ${tableSql} set ${setSql}${fromSql}${joinsSql}${whereSql}${returningSql}`;
      }
      /**
       * Builds selection SQL with provided fields/expressions
       *
       * Examples:
       *
       * `select <selection> from`
       *
       * `insert ... returning <selection>`
       *
       * If `isSingleTable` is true, then columns won't be prefixed with table name
       */
      buildSelection(fields2, { isSingleTable = false } = {}) {
        const columnsLen = fields2.length;
        const chunks = fields2.flatMap(({ field }, i) => {
          const chunk = [];
          if (is(field, SQL.Aliased) && field.isSelectionField) {
            chunk.push(sql.identifier(field.fieldAlias));
          } else if (is(field, SQL.Aliased) || is(field, SQL)) {
            const query2 = is(field, SQL.Aliased) ? field.sql : field;
            if (isSingleTable) {
              chunk.push(
                new SQL(
                  query2.queryChunks.map((c) => {
                    if (is(c, PgColumn)) {
                      return sql.identifier(this.casing.getColumnCasing(c));
                    }
                    return c;
                  })
                )
              );
            } else {
              chunk.push(query2);
            }
            if (is(field, SQL.Aliased)) {
              chunk.push(sql` as ${sql.identifier(field.fieldAlias)}`);
            }
          } else if (is(field, Column)) {
            if (isSingleTable) {
              chunk.push(sql.identifier(this.casing.getColumnCasing(field)));
            } else {
              chunk.push(field);
            }
          } else if (is(field, Subquery)) {
            const entries = Object.entries(field._.selectedFields);
            if (entries.length === 1) {
              const entry = entries[0][1];
              const fieldDecoder = is(entry, SQL) ? entry.decoder : is(entry, Column) ? { mapFromDriverValue: (v) => entry.mapFromDriverValue(v) } : entry.sql.decoder;
              if (fieldDecoder) {
                field._.sql.decoder = fieldDecoder;
              }
            }
            chunk.push(field);
          }
          if (i < columnsLen - 1) {
            chunk.push(sql`, `);
          }
          return chunk;
        });
        return sql.join(chunks);
      }
      buildJoins(joins) {
        if (!joins || joins.length === 0) {
          return void 0;
        }
        const joinsArray = [];
        for (const [index2, joinMeta] of joins.entries()) {
          if (index2 === 0) {
            joinsArray.push(sql` `);
          }
          const table = joinMeta.table;
          const lateralSql = joinMeta.lateral ? sql` lateral` : void 0;
          const onSql = joinMeta.on ? sql` on ${joinMeta.on}` : void 0;
          if (is(table, PgTable)) {
            const tableName = table[PgTable.Symbol.Name];
            const tableSchema = table[PgTable.Symbol.Schema];
            const origTableName = table[PgTable.Symbol.OriginalName];
            const alias = tableName === origTableName ? void 0 : joinMeta.alias;
            joinsArray.push(
              sql`${sql.raw(joinMeta.joinType)} join${lateralSql} ${tableSchema ? sql`${sql.identifier(tableSchema)}.` : void 0}${sql.identifier(origTableName)}${alias && sql` ${sql.identifier(alias)}`}${onSql}`
            );
          } else if (is(table, View)) {
            const viewName = table[ViewBaseConfig].name;
            const viewSchema = table[ViewBaseConfig].schema;
            const origViewName = table[ViewBaseConfig].originalName;
            const alias = viewName === origViewName ? void 0 : joinMeta.alias;
            joinsArray.push(
              sql`${sql.raw(joinMeta.joinType)} join${lateralSql} ${viewSchema ? sql`${sql.identifier(viewSchema)}.` : void 0}${sql.identifier(origViewName)}${alias && sql` ${sql.identifier(alias)}`}${onSql}`
            );
          } else {
            joinsArray.push(
              sql`${sql.raw(joinMeta.joinType)} join${lateralSql} ${table}${onSql}`
            );
          }
          if (index2 < joins.length - 1) {
            joinsArray.push(sql` `);
          }
        }
        return sql.join(joinsArray);
      }
      buildFromTable(table) {
        if (is(table, Table) && table[Table.Symbol.IsAlias]) {
          let fullName = sql`${sql.identifier(table[Table.Symbol.OriginalName])}`;
          if (table[Table.Symbol.Schema]) {
            fullName = sql`${sql.identifier(table[Table.Symbol.Schema])}.${fullName}`;
          }
          return sql`${fullName} ${sql.identifier(table[Table.Symbol.Name])}`;
        }
        return table;
      }
      buildSelectQuery({
        withList,
        fields: fields2,
        fieldsFlat,
        where,
        having,
        table,
        joins,
        orderBy,
        groupBy,
        limit,
        offset,
        lockingClause,
        distinct,
        setOperators
      }) {
        const fieldsList = fieldsFlat ?? orderSelectedFields(fields2);
        for (const f of fieldsList) {
          if (is(f.field, Column) && getTableName(f.field.table) !== (is(table, Subquery) ? table._.alias : is(table, PgViewBase) ? table[ViewBaseConfig].name : is(table, SQL) ? void 0 : getTableName(table)) && !((table2) => joins?.some(
            ({ alias }) => alias === (table2[Table.Symbol.IsAlias] ? getTableName(table2) : table2[Table.Symbol.BaseName])
          ))(f.field.table)) {
            const tableName = getTableName(f.field.table);
            throw new Error(
              `Your "${f.path.join("->")}" field references a column "${tableName}"."${f.field.name}", but the table "${tableName}" is not part of the query! Did you forget to join it?`
            );
          }
        }
        const isSingleTable = !joins || joins.length === 0;
        const withSql = this.buildWithCTE(withList);
        let distinctSql;
        if (distinct) {
          distinctSql = distinct === true ? sql` distinct` : sql` distinct on (${sql.join(distinct.on, sql`, `)})`;
        }
        const selection = this.buildSelection(fieldsList, { isSingleTable });
        const tableSql = this.buildFromTable(table);
        const joinsSql = this.buildJoins(joins);
        const whereSql = where ? sql` where ${where}` : void 0;
        const havingSql = having ? sql` having ${having}` : void 0;
        let orderBySql;
        if (orderBy && orderBy.length > 0) {
          orderBySql = sql` order by ${sql.join(orderBy, sql`, `)}`;
        }
        let groupBySql;
        if (groupBy && groupBy.length > 0) {
          groupBySql = sql` group by ${sql.join(groupBy, sql`, `)}`;
        }
        const limitSql = typeof limit === "object" || typeof limit === "number" && limit >= 0 ? sql` limit ${limit}` : void 0;
        const offsetSql = offset ? sql` offset ${offset}` : void 0;
        const lockingClauseSql = sql.empty();
        if (lockingClause) {
          const clauseSql = sql` for ${sql.raw(lockingClause.strength)}`;
          if (lockingClause.config.of) {
            clauseSql.append(
              sql` of ${sql.join(
                Array.isArray(lockingClause.config.of) ? lockingClause.config.of : [lockingClause.config.of],
                sql`, `
              )}`
            );
          }
          if (lockingClause.config.noWait) {
            clauseSql.append(sql` nowait`);
          } else if (lockingClause.config.skipLocked) {
            clauseSql.append(sql` skip locked`);
          }
          lockingClauseSql.append(clauseSql);
        }
        const finalQuery = sql`${withSql}select${distinctSql} ${selection} from ${tableSql}${joinsSql}${whereSql}${groupBySql}${havingSql}${orderBySql}${limitSql}${offsetSql}${lockingClauseSql}`;
        if (setOperators.length > 0) {
          return this.buildSetOperations(finalQuery, setOperators);
        }
        return finalQuery;
      }
      buildSetOperations(leftSelect, setOperators) {
        const [setOperator, ...rest] = setOperators;
        if (!setOperator) {
          throw new Error("Cannot pass undefined values to any set operator");
        }
        if (rest.length === 0) {
          return this.buildSetOperationQuery({ leftSelect, setOperator });
        }
        return this.buildSetOperations(
          this.buildSetOperationQuery({ leftSelect, setOperator }),
          rest
        );
      }
      buildSetOperationQuery({
        leftSelect,
        setOperator: { type, isAll, rightSelect, limit, orderBy, offset }
      }) {
        const leftChunk = sql`(${leftSelect.getSQL()}) `;
        const rightChunk = sql`(${rightSelect.getSQL()})`;
        let orderBySql;
        if (orderBy && orderBy.length > 0) {
          const orderByValues = [];
          for (const singleOrderBy of orderBy) {
            if (is(singleOrderBy, PgColumn)) {
              orderByValues.push(sql.identifier(singleOrderBy.name));
            } else if (is(singleOrderBy, SQL)) {
              for (let i = 0; i < singleOrderBy.queryChunks.length; i++) {
                const chunk = singleOrderBy.queryChunks[i];
                if (is(chunk, PgColumn)) {
                  singleOrderBy.queryChunks[i] = sql.identifier(chunk.name);
                }
              }
              orderByValues.push(sql`${singleOrderBy}`);
            } else {
              orderByValues.push(sql`${singleOrderBy}`);
            }
          }
          orderBySql = sql` order by ${sql.join(orderByValues, sql`, `)} `;
        }
        const limitSql = typeof limit === "object" || typeof limit === "number" && limit >= 0 ? sql` limit ${limit}` : void 0;
        const operatorChunk = sql.raw(`${type} ${isAll ? "all " : ""}`);
        const offsetSql = offset ? sql` offset ${offset}` : void 0;
        return sql`${leftChunk}${operatorChunk}${rightChunk}${orderBySql}${limitSql}${offsetSql}`;
      }
      buildInsertQuery({ table, values: valuesOrSelect, onConflict, returning, withList, select, overridingSystemValue_ }) {
        const valuesSqlList = [];
        const columns = table[Table.Symbol.Columns];
        const colEntries = Object.entries(columns).filter(([_, col]) => !col.shouldDisableInsert());
        const insertOrder = colEntries.map(
          ([, column]) => sql.identifier(this.casing.getColumnCasing(column))
        );
        if (select) {
          const select2 = valuesOrSelect;
          if (is(select2, SQL)) {
            valuesSqlList.push(select2);
          } else {
            valuesSqlList.push(select2.getSQL());
          }
        } else {
          const values = valuesOrSelect;
          valuesSqlList.push(sql.raw("values "));
          for (const [valueIndex, value] of values.entries()) {
            const valueList = [];
            for (const [fieldName, col] of colEntries) {
              const colValue = value[fieldName];
              if (colValue === void 0 || is(colValue, Param) && colValue.value === void 0) {
                if (col.defaultFn !== void 0) {
                  const defaultFnResult = col.defaultFn();
                  const defaultValue = is(defaultFnResult, SQL) ? defaultFnResult : sql.param(defaultFnResult, col);
                  valueList.push(defaultValue);
                } else if (!col.default && col.onUpdateFn !== void 0) {
                  const onUpdateFnResult = col.onUpdateFn();
                  const newValue = is(onUpdateFnResult, SQL) ? onUpdateFnResult : sql.param(onUpdateFnResult, col);
                  valueList.push(newValue);
                } else {
                  valueList.push(sql`default`);
                }
              } else {
                valueList.push(colValue);
              }
            }
            valuesSqlList.push(valueList);
            if (valueIndex < values.length - 1) {
              valuesSqlList.push(sql`, `);
            }
          }
        }
        const withSql = this.buildWithCTE(withList);
        const valuesSql = sql.join(valuesSqlList);
        const returningSql = returning ? sql` returning ${this.buildSelection(returning, { isSingleTable: true })}` : void 0;
        const onConflictSql = onConflict ? sql` on conflict ${onConflict}` : void 0;
        const overridingSql = overridingSystemValue_ === true ? sql`overriding system value ` : void 0;
        return sql`${withSql}insert into ${table} ${insertOrder} ${overridingSql}${valuesSql}${onConflictSql}${returningSql}`;
      }
      buildRefreshMaterializedViewQuery({ view, concurrently, withNoData }) {
        const concurrentlySql = concurrently ? sql` concurrently` : void 0;
        const withNoDataSql = withNoData ? sql` with no data` : void 0;
        return sql`refresh materialized view${concurrentlySql} ${view}${withNoDataSql}`;
      }
      prepareTyping(encoder) {
        if (is(encoder, PgJsonb) || is(encoder, PgJson)) {
          return "json";
        } else if (is(encoder, PgNumeric)) {
          return "decimal";
        } else if (is(encoder, PgTime)) {
          return "time";
        } else if (is(encoder, PgTimestamp) || is(encoder, PgTimestampString)) {
          return "timestamp";
        } else if (is(encoder, PgDate) || is(encoder, PgDateString)) {
          return "date";
        } else if (is(encoder, PgUUID)) {
          return "uuid";
        } else {
          return "none";
        }
      }
      sqlToQuery(sql2, invokeSource) {
        return sql2.toQuery({
          casing: this.casing,
          escapeName: this.escapeName,
          escapeParam: this.escapeParam,
          escapeString: this.escapeString,
          prepareTyping: this.prepareTyping,
          invokeSource
        });
      }
      // buildRelationalQueryWithPK({
      // 	fullSchema,
      // 	schema,
      // 	tableNamesMap,
      // 	table,
      // 	tableConfig,
      // 	queryConfig: config,
      // 	tableAlias,
      // 	isRoot = false,
      // 	joinOn,
      // }: {
      // 	fullSchema: Record<string, unknown>;
      // 	schema: TablesRelationalConfig;
      // 	tableNamesMap: Record<string, string>;
      // 	table: PgTable;
      // 	tableConfig: TableRelationalConfig;
      // 	queryConfig: true | DBQueryConfig<'many', true>;
      // 	tableAlias: string;
      // 	isRoot?: boolean;
      // 	joinOn?: SQL;
      // }): BuildRelationalQueryResult<PgTable, PgColumn> {
      // 	// For { "<relation>": true }, return a table with selection of all columns
      // 	if (config === true) {
      // 		const selectionEntries = Object.entries(tableConfig.columns);
      // 		const selection: BuildRelationalQueryResult<PgTable, PgColumn>['selection'] = selectionEntries.map((
      // 			[key, value],
      // 		) => ({
      // 			dbKey: value.name,
      // 			tsKey: key,
      // 			field: value as PgColumn,
      // 			relationTableTsKey: undefined,
      // 			isJson: false,
      // 			selection: [],
      // 		}));
      // 		return {
      // 			tableTsKey: tableConfig.tsName,
      // 			sql: table,
      // 			selection,
      // 		};
      // 	}
      // 	// let selection: BuildRelationalQueryResult<PgTable, PgColumn>['selection'] = [];
      // 	// let selectionForBuild = selection;
      // 	const aliasedColumns = Object.fromEntries(
      // 		Object.entries(tableConfig.columns).map(([key, value]) => [key, aliasedTableColumn(value, tableAlias)]),
      // 	);
      // 	const aliasedRelations = Object.fromEntries(
      // 		Object.entries(tableConfig.relations).map(([key, value]) => [key, aliasedRelation(value, tableAlias)]),
      // 	);
      // 	const aliasedFields = Object.assign({}, aliasedColumns, aliasedRelations);
      // 	let where, hasUserDefinedWhere;
      // 	if (config.where) {
      // 		const whereSql = typeof config.where === 'function' ? config.where(aliasedFields, operators) : config.where;
      // 		where = whereSql && mapColumnsInSQLToAlias(whereSql, tableAlias);
      // 		hasUserDefinedWhere = !!where;
      // 	}
      // 	where = and(joinOn, where);
      // 	// const fieldsSelection: { tsKey: string; value: PgColumn | SQL.Aliased; isExtra?: boolean }[] = [];
      // 	let joins: Join[] = [];
      // 	let selectedColumns: string[] = [];
      // 	// Figure out which columns to select
      // 	if (config.columns) {
      // 		let isIncludeMode = false;
      // 		for (const [field, value] of Object.entries(config.columns)) {
      // 			if (value === undefined) {
      // 				continue;
      // 			}
      // 			if (field in tableConfig.columns) {
      // 				if (!isIncludeMode && value === true) {
      // 					isIncludeMode = true;
      // 				}
      // 				selectedColumns.push(field);
      // 			}
      // 		}
      // 		if (selectedColumns.length > 0) {
      // 			selectedColumns = isIncludeMode
      // 				? selectedColumns.filter((c) => config.columns?.[c] === true)
      // 				: Object.keys(tableConfig.columns).filter((key) => !selectedColumns.includes(key));
      // 		}
      // 	} else {
      // 		// Select all columns if selection is not specified
      // 		selectedColumns = Object.keys(tableConfig.columns);
      // 	}
      // 	// for (const field of selectedColumns) {
      // 	// 	const column = tableConfig.columns[field]! as PgColumn;
      // 	// 	fieldsSelection.push({ tsKey: field, value: column });
      // 	// }
      // 	let initiallySelectedRelations: {
      // 		tsKey: string;
      // 		queryConfig: true | DBQueryConfig<'many', false>;
      // 		relation: Relation;
      // 	}[] = [];
      // 	// let selectedRelations: BuildRelationalQueryResult<PgTable, PgColumn>['selection'] = [];
      // 	// Figure out which relations to select
      // 	if (config.with) {
      // 		initiallySelectedRelations = Object.entries(config.with)
      // 			.filter((entry): entry is [typeof entry[0], NonNullable<typeof entry[1]>] => !!entry[1])
      // 			.map(([tsKey, queryConfig]) => ({ tsKey, queryConfig, relation: tableConfig.relations[tsKey]! }));
      // 	}
      // 	const manyRelations = initiallySelectedRelations.filter((r) =>
      // 		is(r.relation, Many)
      // 		&& (schema[tableNamesMap[r.relation.referencedTable[Table.Symbol.Name]]!]?.primaryKey.length ?? 0) > 0
      // 	);
      // 	// If this is the last Many relation (or there are no Many relations), we are on the innermost subquery level
      // 	const isInnermostQuery = manyRelations.length < 2;
      // 	const selectedExtras: {
      // 		tsKey: string;
      // 		value: SQL.Aliased;
      // 	}[] = [];
      // 	// Figure out which extras to select
      // 	if (isInnermostQuery && config.extras) {
      // 		const extras = typeof config.extras === 'function'
      // 			? config.extras(aliasedFields, { sql })
      // 			: config.extras;
      // 		for (const [tsKey, value] of Object.entries(extras)) {
      // 			selectedExtras.push({
      // 				tsKey,
      // 				value: mapColumnsInAliasedSQLToAlias(value, tableAlias),
      // 			});
      // 		}
      // 	}
      // 	// Transform `fieldsSelection` into `selection`
      // 	// `fieldsSelection` shouldn't be used after this point
      // 	// for (const { tsKey, value, isExtra } of fieldsSelection) {
      // 	// 	selection.push({
      // 	// 		dbKey: is(value, SQL.Aliased) ? value.fieldAlias : tableConfig.columns[tsKey]!.name,
      // 	// 		tsKey,
      // 	// 		field: is(value, Column) ? aliasedTableColumn(value, tableAlias) : value,
      // 	// 		relationTableTsKey: undefined,
      // 	// 		isJson: false,
      // 	// 		isExtra,
      // 	// 		selection: [],
      // 	// 	});
      // 	// }
      // 	let orderByOrig = typeof config.orderBy === 'function'
      // 		? config.orderBy(aliasedFields, orderByOperators)
      // 		: config.orderBy ?? [];
      // 	if (!Array.isArray(orderByOrig)) {
      // 		orderByOrig = [orderByOrig];
      // 	}
      // 	const orderBy = orderByOrig.map((orderByValue) => {
      // 		if (is(orderByValue, Column)) {
      // 			return aliasedTableColumn(orderByValue, tableAlias) as PgColumn;
      // 		}
      // 		return mapColumnsInSQLToAlias(orderByValue, tableAlias);
      // 	});
      // 	const limit = isInnermostQuery ? config.limit : undefined;
      // 	const offset = isInnermostQuery ? config.offset : undefined;
      // 	// For non-root queries without additional config except columns, return a table with selection
      // 	if (
      // 		!isRoot
      // 		&& initiallySelectedRelations.length === 0
      // 		&& selectedExtras.length === 0
      // 		&& !where
      // 		&& orderBy.length === 0
      // 		&& limit === undefined
      // 		&& offset === undefined
      // 	) {
      // 		return {
      // 			tableTsKey: tableConfig.tsName,
      // 			sql: table,
      // 			selection: selectedColumns.map((key) => ({
      // 				dbKey: tableConfig.columns[key]!.name,
      // 				tsKey: key,
      // 				field: tableConfig.columns[key] as PgColumn,
      // 				relationTableTsKey: undefined,
      // 				isJson: false,
      // 				selection: [],
      // 			})),
      // 		};
      // 	}
      // 	const selectedRelationsWithoutPK:
      // 	// Process all relations without primary keys, because they need to be joined differently and will all be on the same query level
      // 	for (
      // 		const {
      // 			tsKey: selectedRelationTsKey,
      // 			queryConfig: selectedRelationConfigValue,
      // 			relation,
      // 		} of initiallySelectedRelations
      // 	) {
      // 		const normalizedRelation = normalizeRelation(schema, tableNamesMap, relation);
      // 		const relationTableName = relation.referencedTable[Table.Symbol.Name];
      // 		const relationTableTsName = tableNamesMap[relationTableName]!;
      // 		const relationTable = schema[relationTableTsName]!;
      // 		if (relationTable.primaryKey.length > 0) {
      // 			continue;
      // 		}
      // 		const relationTableAlias = `${tableAlias}_${selectedRelationTsKey}`;
      // 		const joinOn = and(
      // 			...normalizedRelation.fields.map((field, i) =>
      // 				eq(
      // 					aliasedTableColumn(normalizedRelation.references[i]!, relationTableAlias),
      // 					aliasedTableColumn(field, tableAlias),
      // 				)
      // 			),
      // 		);
      // 		const builtRelation = this.buildRelationalQueryWithoutPK({
      // 			fullSchema,
      // 			schema,
      // 			tableNamesMap,
      // 			table: fullSchema[relationTableTsName] as PgTable,
      // 			tableConfig: schema[relationTableTsName]!,
      // 			queryConfig: selectedRelationConfigValue,
      // 			tableAlias: relationTableAlias,
      // 			joinOn,
      // 			nestedQueryRelation: relation,
      // 		});
      // 		const field = sql`${sql.identifier(relationTableAlias)}.${sql.identifier('data')}`.as(selectedRelationTsKey);
      // 		joins.push({
      // 			on: sql`true`,
      // 			table: new Subquery(builtRelation.sql as SQL, {}, relationTableAlias),
      // 			alias: relationTableAlias,
      // 			joinType: 'left',
      // 			lateral: true,
      // 		});
      // 		selectedRelations.push({
      // 			dbKey: selectedRelationTsKey,
      // 			tsKey: selectedRelationTsKey,
      // 			field,
      // 			relationTableTsKey: relationTableTsName,
      // 			isJson: true,
      // 			selection: builtRelation.selection,
      // 		});
      // 	}
      // 	const oneRelations = initiallySelectedRelations.filter((r): r is typeof r & { relation: One } =>
      // 		is(r.relation, One)
      // 	);
      // 	// Process all One relations with PKs, because they can all be joined on the same level
      // 	for (
      // 		const {
      // 			tsKey: selectedRelationTsKey,
      // 			queryConfig: selectedRelationConfigValue,
      // 			relation,
      // 		} of oneRelations
      // 	) {
      // 		const normalizedRelation = normalizeRelation(schema, tableNamesMap, relation);
      // 		const relationTableName = relation.referencedTable[Table.Symbol.Name];
      // 		const relationTableTsName = tableNamesMap[relationTableName]!;
      // 		const relationTableAlias = `${tableAlias}_${selectedRelationTsKey}`;
      // 		const relationTable = schema[relationTableTsName]!;
      // 		if (relationTable.primaryKey.length === 0) {
      // 			continue;
      // 		}
      // 		const joinOn = and(
      // 			...normalizedRelation.fields.map((field, i) =>
      // 				eq(
      // 					aliasedTableColumn(normalizedRelation.references[i]!, relationTableAlias),
      // 					aliasedTableColumn(field, tableAlias),
      // 				)
      // 			),
      // 		);
      // 		const builtRelation = this.buildRelationalQueryWithPK({
      // 			fullSchema,
      // 			schema,
      // 			tableNamesMap,
      // 			table: fullSchema[relationTableTsName] as PgTable,
      // 			tableConfig: schema[relationTableTsName]!,
      // 			queryConfig: selectedRelationConfigValue,
      // 			tableAlias: relationTableAlias,
      // 			joinOn,
      // 		});
      // 		const field = sql`case when ${sql.identifier(relationTableAlias)} is null then null else json_build_array(${
      // 			sql.join(
      // 				builtRelation.selection.map(({ field }) =>
      // 					is(field, SQL.Aliased)
      // 						? sql`${sql.identifier(relationTableAlias)}.${sql.identifier(field.fieldAlias)}`
      // 						: is(field, Column)
      // 						? aliasedTableColumn(field, relationTableAlias)
      // 						: field
      // 				),
      // 				sql`, `,
      // 			)
      // 		}) end`.as(selectedRelationTsKey);
      // 		const isLateralJoin = is(builtRelation.sql, SQL);
      // 		joins.push({
      // 			on: isLateralJoin ? sql`true` : joinOn,
      // 			table: is(builtRelation.sql, SQL)
      // 				? new Subquery(builtRelation.sql, {}, relationTableAlias)
      // 				: aliasedTable(builtRelation.sql, relationTableAlias),
      // 			alias: relationTableAlias,
      // 			joinType: 'left',
      // 			lateral: is(builtRelation.sql, SQL),
      // 		});
      // 		selectedRelations.push({
      // 			dbKey: selectedRelationTsKey,
      // 			tsKey: selectedRelationTsKey,
      // 			field,
      // 			relationTableTsKey: relationTableTsName,
      // 			isJson: true,
      // 			selection: builtRelation.selection,
      // 		});
      // 	}
      // 	let distinct: PgSelectConfig['distinct'];
      // 	let tableFrom: PgTable | Subquery = table;
      // 	// Process first Many relation - each one requires a nested subquery
      // 	const manyRelation = manyRelations[0];
      // 	if (manyRelation) {
      // 		const {
      // 			tsKey: selectedRelationTsKey,
      // 			queryConfig: selectedRelationQueryConfig,
      // 			relation,
      // 		} = manyRelation;
      // 		distinct = {
      // 			on: tableConfig.primaryKey.map((c) => aliasedTableColumn(c as PgColumn, tableAlias)),
      // 		};
      // 		const normalizedRelation = normalizeRelation(schema, tableNamesMap, relation);
      // 		const relationTableName = relation.referencedTable[Table.Symbol.Name];
      // 		const relationTableTsName = tableNamesMap[relationTableName]!;
      // 		const relationTableAlias = `${tableAlias}_${selectedRelationTsKey}`;
      // 		const joinOn = and(
      // 			...normalizedRelation.fields.map((field, i) =>
      // 				eq(
      // 					aliasedTableColumn(normalizedRelation.references[i]!, relationTableAlias),
      // 					aliasedTableColumn(field, tableAlias),
      // 				)
      // 			),
      // 		);
      // 		const builtRelationJoin = this.buildRelationalQueryWithPK({
      // 			fullSchema,
      // 			schema,
      // 			tableNamesMap,
      // 			table: fullSchema[relationTableTsName] as PgTable,
      // 			tableConfig: schema[relationTableTsName]!,
      // 			queryConfig: selectedRelationQueryConfig,
      // 			tableAlias: relationTableAlias,
      // 			joinOn,
      // 		});
      // 		const builtRelationSelectionField = sql`case when ${
      // 			sql.identifier(relationTableAlias)
      // 		} is null then '[]' else json_agg(json_build_array(${
      // 			sql.join(
      // 				builtRelationJoin.selection.map(({ field }) =>
      // 					is(field, SQL.Aliased)
      // 						? sql`${sql.identifier(relationTableAlias)}.${sql.identifier(field.fieldAlias)}`
      // 						: is(field, Column)
      // 						? aliasedTableColumn(field, relationTableAlias)
      // 						: field
      // 				),
      // 				sql`, `,
      // 			)
      // 		})) over (partition by ${sql.join(distinct.on, sql`, `)}) end`.as(selectedRelationTsKey);
      // 		const isLateralJoin = is(builtRelationJoin.sql, SQL);
      // 		joins.push({
      // 			on: isLateralJoin ? sql`true` : joinOn,
      // 			table: isLateralJoin
      // 				? new Subquery(builtRelationJoin.sql as SQL, {}, relationTableAlias)
      // 				: aliasedTable(builtRelationJoin.sql as PgTable, relationTableAlias),
      // 			alias: relationTableAlias,
      // 			joinType: 'left',
      // 			lateral: isLateralJoin,
      // 		});
      // 		// Build the "from" subquery with the remaining Many relations
      // 		const builtTableFrom = this.buildRelationalQueryWithPK({
      // 			fullSchema,
      // 			schema,
      // 			tableNamesMap,
      // 			table,
      // 			tableConfig,
      // 			queryConfig: {
      // 				...config,
      // 				where: undefined,
      // 				orderBy: undefined,
      // 				limit: undefined,
      // 				offset: undefined,
      // 				with: manyRelations.slice(1).reduce<NonNullable<typeof config['with']>>(
      // 					(result, { tsKey, queryConfig: configValue }) => {
      // 						result[tsKey] = configValue;
      // 						return result;
      // 					},
      // 					{},
      // 				),
      // 			},
      // 			tableAlias,
      // 		});
      // 		selectedRelations.push({
      // 			dbKey: selectedRelationTsKey,
      // 			tsKey: selectedRelationTsKey,
      // 			field: builtRelationSelectionField,
      // 			relationTableTsKey: relationTableTsName,
      // 			isJson: true,
      // 			selection: builtRelationJoin.selection,
      // 		});
      // 		// selection = builtTableFrom.selection.map((item) =>
      // 		// 	is(item.field, SQL.Aliased)
      // 		// 		? { ...item, field: sql`${sql.identifier(tableAlias)}.${sql.identifier(item.field.fieldAlias)}` }
      // 		// 		: item
      // 		// );
      // 		// selectionForBuild = [{
      // 		// 	dbKey: '*',
      // 		// 	tsKey: '*',
      // 		// 	field: sql`${sql.identifier(tableAlias)}.*`,
      // 		// 	selection: [],
      // 		// 	isJson: false,
      // 		// 	relationTableTsKey: undefined,
      // 		// }];
      // 		// const newSelectionItem: (typeof selection)[number] = {
      // 		// 	dbKey: selectedRelationTsKey,
      // 		// 	tsKey: selectedRelationTsKey,
      // 		// 	field,
      // 		// 	relationTableTsKey: relationTableTsName,
      // 		// 	isJson: true,
      // 		// 	selection: builtRelationJoin.selection,
      // 		// };
      // 		// selection.push(newSelectionItem);
      // 		// selectionForBuild.push(newSelectionItem);
      // 		tableFrom = is(builtTableFrom.sql, PgTable)
      // 			? builtTableFrom.sql
      // 			: new Subquery(builtTableFrom.sql, {}, tableAlias);
      // 	}
      // 	if (selectedColumns.length === 0 && selectedRelations.length === 0 && selectedExtras.length === 0) {
      // 		throw new DrizzleError(`No fields selected for table "${tableConfig.tsName}" ("${tableAlias}")`);
      // 	}
      // 	let selection: BuildRelationalQueryResult<PgTable, PgColumn>['selection'];
      // 	function prepareSelectedColumns() {
      // 		return selectedColumns.map((key) => ({
      // 			dbKey: tableConfig.columns[key]!.name,
      // 			tsKey: key,
      // 			field: tableConfig.columns[key] as PgColumn,
      // 			relationTableTsKey: undefined,
      // 			isJson: false,
      // 			selection: [],
      // 		}));
      // 	}
      // 	function prepareSelectedExtras() {
      // 		return selectedExtras.map((item) => ({
      // 			dbKey: item.value.fieldAlias,
      // 			tsKey: item.tsKey,
      // 			field: item.value,
      // 			relationTableTsKey: undefined,
      // 			isJson: false,
      // 			selection: [],
      // 		}));
      // 	}
      // 	if (isRoot) {
      // 		selection = [
      // 			...prepareSelectedColumns(),
      // 			...prepareSelectedExtras(),
      // 		];
      // 	}
      // 	if (hasUserDefinedWhere || orderBy.length > 0) {
      // 		tableFrom = new Subquery(
      // 			this.buildSelectQuery({
      // 				table: is(tableFrom, PgTable) ? aliasedTable(tableFrom, tableAlias) : tableFrom,
      // 				fields: {},
      // 				fieldsFlat: selectionForBuild.map(({ field }) => ({
      // 					path: [],
      // 					field: is(field, Column) ? aliasedTableColumn(field, tableAlias) : field,
      // 				})),
      // 				joins,
      // 				distinct,
      // 			}),
      // 			{},
      // 			tableAlias,
      // 		);
      // 		selectionForBuild = selection.map((item) =>
      // 			is(item.field, SQL.Aliased)
      // 				? { ...item, field: sql`${sql.identifier(tableAlias)}.${sql.identifier(item.field.fieldAlias)}` }
      // 				: item
      // 		);
      // 		joins = [];
      // 		distinct = undefined;
      // 	}
      // 	const result = this.buildSelectQuery({
      // 		table: is(tableFrom, PgTable) ? aliasedTable(tableFrom, tableAlias) : tableFrom,
      // 		fields: {},
      // 		fieldsFlat: selectionForBuild.map(({ field }) => ({
      // 			path: [],
      // 			field: is(field, Column) ? aliasedTableColumn(field, tableAlias) : field,
      // 		})),
      // 		where,
      // 		limit,
      // 		offset,
      // 		joins,
      // 		orderBy,
      // 		distinct,
      // 	});
      // 	return {
      // 		tableTsKey: tableConfig.tsName,
      // 		sql: result,
      // 		selection,
      // 	};
      // }
      buildRelationalQueryWithoutPK({
        fullSchema,
        schema,
        tableNamesMap,
        table,
        tableConfig,
        queryConfig: config,
        tableAlias,
        nestedQueryRelation,
        joinOn
      }) {
        let selection = [];
        let limit, offset, orderBy = [], where;
        const joins = [];
        if (config === true) {
          const selectionEntries = Object.entries(tableConfig.columns);
          selection = selectionEntries.map(([key2, value]) => ({
            dbKey: value.name,
            tsKey: key2,
            field: aliasedTableColumn(value, tableAlias),
            relationTableTsKey: void 0,
            isJson: false,
            selection: []
          }));
        } else {
          const aliasedColumns = Object.fromEntries(
            Object.entries(tableConfig.columns).map(([key2, value]) => [key2, aliasedTableColumn(value, tableAlias)])
          );
          if (config.where) {
            const whereSql = typeof config.where === "function" ? config.where(aliasedColumns, getOperators()) : config.where;
            where = whereSql && mapColumnsInSQLToAlias(whereSql, tableAlias);
          }
          const fieldsSelection = [];
          let selectedColumns = [];
          if (config.columns) {
            let isIncludeMode = false;
            for (const [field, value] of Object.entries(config.columns)) {
              if (value === void 0) {
                continue;
              }
              if (field in tableConfig.columns) {
                if (!isIncludeMode && value === true) {
                  isIncludeMode = true;
                }
                selectedColumns.push(field);
              }
            }
            if (selectedColumns.length > 0) {
              selectedColumns = isIncludeMode ? selectedColumns.filter((c) => config.columns?.[c] === true) : Object.keys(tableConfig.columns).filter((key2) => !selectedColumns.includes(key2));
            }
          } else {
            selectedColumns = Object.keys(tableConfig.columns);
          }
          for (const field of selectedColumns) {
            const column = tableConfig.columns[field];
            fieldsSelection.push({ tsKey: field, value: column });
          }
          let selectedRelations = [];
          if (config.with) {
            selectedRelations = Object.entries(config.with).filter((entry) => !!entry[1]).map(([tsKey, queryConfig]) => ({ tsKey, queryConfig, relation: tableConfig.relations[tsKey] }));
          }
          let extras;
          if (config.extras) {
            extras = typeof config.extras === "function" ? config.extras(aliasedColumns, { sql }) : config.extras;
            for (const [tsKey, value] of Object.entries(extras)) {
              fieldsSelection.push({
                tsKey,
                value: mapColumnsInAliasedSQLToAlias(value, tableAlias)
              });
            }
          }
          for (const { tsKey, value } of fieldsSelection) {
            selection.push({
              dbKey: is(value, SQL.Aliased) ? value.fieldAlias : tableConfig.columns[tsKey].name,
              tsKey,
              field: is(value, Column) ? aliasedTableColumn(value, tableAlias) : value,
              relationTableTsKey: void 0,
              isJson: false,
              selection: []
            });
          }
          let orderByOrig = typeof config.orderBy === "function" ? config.orderBy(aliasedColumns, getOrderByOperators()) : config.orderBy ?? [];
          if (!Array.isArray(orderByOrig)) {
            orderByOrig = [orderByOrig];
          }
          orderBy = orderByOrig.map((orderByValue) => {
            if (is(orderByValue, Column)) {
              return aliasedTableColumn(orderByValue, tableAlias);
            }
            return mapColumnsInSQLToAlias(orderByValue, tableAlias);
          });
          limit = config.limit;
          offset = config.offset;
          for (const {
            tsKey: selectedRelationTsKey,
            queryConfig: selectedRelationConfigValue,
            relation
          } of selectedRelations) {
            const normalizedRelation = normalizeRelation(schema, tableNamesMap, relation);
            const relationTableName = getTableUniqueName(relation.referencedTable);
            const relationTableTsName = tableNamesMap[relationTableName];
            const relationTableAlias = `${tableAlias}_${selectedRelationTsKey}`;
            const joinOn2 = and(
              ...normalizedRelation.fields.map(
                (field2, i) => eq(
                  aliasedTableColumn(normalizedRelation.references[i], relationTableAlias),
                  aliasedTableColumn(field2, tableAlias)
                )
              )
            );
            const builtRelation = this.buildRelationalQueryWithoutPK({
              fullSchema,
              schema,
              tableNamesMap,
              table: fullSchema[relationTableTsName],
              tableConfig: schema[relationTableTsName],
              queryConfig: is(relation, One) ? selectedRelationConfigValue === true ? { limit: 1 } : { ...selectedRelationConfigValue, limit: 1 } : selectedRelationConfigValue,
              tableAlias: relationTableAlias,
              joinOn: joinOn2,
              nestedQueryRelation: relation
            });
            const field = sql`${sql.identifier(relationTableAlias)}.${sql.identifier("data")}`.as(selectedRelationTsKey);
            joins.push({
              on: sql`true`,
              table: new Subquery(builtRelation.sql, {}, relationTableAlias),
              alias: relationTableAlias,
              joinType: "left",
              lateral: true
            });
            selection.push({
              dbKey: selectedRelationTsKey,
              tsKey: selectedRelationTsKey,
              field,
              relationTableTsKey: relationTableTsName,
              isJson: true,
              selection: builtRelation.selection
            });
          }
        }
        if (selection.length === 0) {
          throw new DrizzleError({ message: `No fields selected for table "${tableConfig.tsName}" ("${tableAlias}")` });
        }
        let result;
        where = and(joinOn, where);
        if (nestedQueryRelation) {
          let field = sql`json_build_array(${sql.join(
            selection.map(
              ({ field: field2, tsKey, isJson }) => isJson ? sql`${sql.identifier(`${tableAlias}_${tsKey}`)}.${sql.identifier("data")}` : is(field2, SQL.Aliased) ? field2.sql : field2
            ),
            sql`, `
          )})`;
          if (is(nestedQueryRelation, Many)) {
            field = sql`coalesce(json_agg(${field}${orderBy.length > 0 ? sql` order by ${sql.join(orderBy, sql`, `)}` : void 0}), '[]'::json)`;
          }
          const nestedSelection = [{
            dbKey: "data",
            tsKey: "data",
            field: field.as("data"),
            isJson: true,
            relationTableTsKey: tableConfig.tsName,
            selection
          }];
          const needsSubquery = limit !== void 0 || offset !== void 0 || orderBy.length > 0;
          if (needsSubquery) {
            result = this.buildSelectQuery({
              table: aliasedTable(table, tableAlias),
              fields: {},
              fieldsFlat: [{
                path: [],
                field: sql.raw("*")
              }],
              where,
              limit,
              offset,
              orderBy,
              setOperators: []
            });
            where = void 0;
            limit = void 0;
            offset = void 0;
            orderBy = [];
          } else {
            result = aliasedTable(table, tableAlias);
          }
          result = this.buildSelectQuery({
            table: is(result, PgTable) ? result : new Subquery(result, {}, tableAlias),
            fields: {},
            fieldsFlat: nestedSelection.map(({ field: field2 }) => ({
              path: [],
              field: is(field2, Column) ? aliasedTableColumn(field2, tableAlias) : field2
            })),
            joins,
            where,
            limit,
            offset,
            orderBy,
            setOperators: []
          });
        } else {
          result = this.buildSelectQuery({
            table: aliasedTable(table, tableAlias),
            fields: {},
            fieldsFlat: selection.map(({ field }) => ({
              path: [],
              field: is(field, Column) ? aliasedTableColumn(field, tableAlias) : field
            })),
            joins,
            where,
            limit,
            offset,
            orderBy,
            setOperators: []
          });
        }
        return {
          tableTsKey: tableConfig.tsName,
          sql: result,
          selection
        };
      }
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/query-builders/query-builder.js
var TypedQueryBuilder;
var init_query_builder = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/query-builders/query-builder.js"() {
    init_entity();
    TypedQueryBuilder = class {
      static [entityKind] = "TypedQueryBuilder";
      /** @internal */
      getSelectedFields() {
        return this._.selectedFields;
      }
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/query-builders/select.js
function createSetOperator(type, isAll) {
  return (leftSelect, rightSelect, ...restSelects) => {
    const setOperators = [rightSelect, ...restSelects].map((select) => ({
      type,
      isAll,
      rightSelect: select
    }));
    for (const setOperator of setOperators) {
      if (!haveSameKeys(leftSelect.getSelectedFields(), setOperator.rightSelect.getSelectedFields())) {
        throw new Error(
          "Set operator error (union / intersect / except): selected fields are not the same or are in a different order"
        );
      }
    }
    return leftSelect.addSetOperators(setOperators);
  };
}
var PgSelectBuilder, PgSelectQueryBuilderBase, PgSelectBase, getPgSetOperators, union, unionAll, intersect, intersectAll, except, exceptAll;
var init_select2 = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/query-builders/select.js"() {
    init_entity();
    init_view_base();
    init_query_builder();
    init_query_promise();
    init_selection_proxy();
    init_sql();
    init_subquery();
    init_table();
    init_tracing();
    init_utils();
    init_utils();
    init_view_common();
    init_utils3();
    PgSelectBuilder = class {
      static [entityKind] = "PgSelectBuilder";
      fields;
      session;
      dialect;
      withList = [];
      distinct;
      constructor(config) {
        this.fields = config.fields;
        this.session = config.session;
        this.dialect = config.dialect;
        if (config.withList) {
          this.withList = config.withList;
        }
        this.distinct = config.distinct;
      }
      authToken;
      /** @internal */
      setToken(token) {
        this.authToken = token;
        return this;
      }
      /**
       * Specify the table, subquery, or other target that you're
       * building a select query against.
       *
       * {@link https://www.postgresql.org/docs/current/sql-select.html#SQL-FROM | Postgres from documentation}
       */
      from(source) {
        const isPartialSelect = !!this.fields;
        const src = source;
        let fields2;
        if (this.fields) {
          fields2 = this.fields;
        } else if (is(src, Subquery)) {
          fields2 = Object.fromEntries(
            Object.keys(src._.selectedFields).map((key2) => [key2, src[key2]])
          );
        } else if (is(src, PgViewBase)) {
          fields2 = src[ViewBaseConfig].selectedFields;
        } else if (is(src, SQL)) {
          fields2 = {};
        } else {
          fields2 = getTableColumns(src);
        }
        return new PgSelectBase({
          table: src,
          fields: fields2,
          isPartialSelect,
          session: this.session,
          dialect: this.dialect,
          withList: this.withList,
          distinct: this.distinct
        }).setToken(this.authToken);
      }
    };
    PgSelectQueryBuilderBase = class extends TypedQueryBuilder {
      static [entityKind] = "PgSelectQueryBuilder";
      _;
      config;
      joinsNotNullableMap;
      tableName;
      isPartialSelect;
      session;
      dialect;
      cacheConfig = void 0;
      usedTables = /* @__PURE__ */ new Set();
      constructor({ table, fields: fields2, isPartialSelect, session, dialect, withList, distinct }) {
        super();
        this.config = {
          withList,
          table,
          fields: { ...fields2 },
          distinct,
          setOperators: []
        };
        this.isPartialSelect = isPartialSelect;
        this.session = session;
        this.dialect = dialect;
        this._ = {
          selectedFields: fields2,
          config: this.config
        };
        this.tableName = getTableLikeName(table);
        this.joinsNotNullableMap = typeof this.tableName === "string" ? { [this.tableName]: true } : {};
        for (const item of extractUsedTable(table)) this.usedTables.add(item);
      }
      /** @internal */
      getUsedTables() {
        return [...this.usedTables];
      }
      createJoin(joinType, lateral) {
        return (table, on) => {
          const baseTableName = this.tableName;
          const tableName = getTableLikeName(table);
          for (const item of extractUsedTable(table)) this.usedTables.add(item);
          if (typeof tableName === "string" && this.config.joins?.some((join) => join.alias === tableName)) {
            throw new Error(`Alias "${tableName}" is already used in this query`);
          }
          if (!this.isPartialSelect) {
            if (Object.keys(this.joinsNotNullableMap).length === 1 && typeof baseTableName === "string") {
              this.config.fields = {
                [baseTableName]: this.config.fields
              };
            }
            if (typeof tableName === "string" && !is(table, SQL)) {
              const selection = is(table, Subquery) ? table._.selectedFields : is(table, View) ? table[ViewBaseConfig].selectedFields : table[Table.Symbol.Columns];
              this.config.fields[tableName] = selection;
            }
          }
          if (typeof on === "function") {
            on = on(
              new Proxy(
                this.config.fields,
                new SelectionProxyHandler({ sqlAliasedBehavior: "sql", sqlBehavior: "sql" })
              )
            );
          }
          if (!this.config.joins) {
            this.config.joins = [];
          }
          this.config.joins.push({ on, table, joinType, alias: tableName, lateral });
          if (typeof tableName === "string") {
            switch (joinType) {
              case "left": {
                this.joinsNotNullableMap[tableName] = false;
                break;
              }
              case "right": {
                this.joinsNotNullableMap = Object.fromEntries(
                  Object.entries(this.joinsNotNullableMap).map(([key2]) => [key2, false])
                );
                this.joinsNotNullableMap[tableName] = true;
                break;
              }
              case "cross":
              case "inner": {
                this.joinsNotNullableMap[tableName] = true;
                break;
              }
              case "full": {
                this.joinsNotNullableMap = Object.fromEntries(
                  Object.entries(this.joinsNotNullableMap).map(([key2]) => [key2, false])
                );
                this.joinsNotNullableMap[tableName] = false;
                break;
              }
            }
          }
          return this;
        };
      }
      /**
       * Executes a `left join` operation by adding another table to the current query.
       *
       * Calling this method associates each row of the table with the corresponding row from the joined table, if a match is found. If no matching row exists, it sets all columns of the joined table to null.
       *
       * See docs: {@link https://orm.drizzle.team/docs/joins#left-join}
       *
       * @param table the table to join.
       * @param on the `on` clause.
       *
       * @example
       *
       * ```ts
       * // Select all users and their pets
       * const usersWithPets: { user: User; pets: Pet | null; }[] = await db.select()
       *   .from(users)
       *   .leftJoin(pets, eq(users.id, pets.ownerId))
       *
       * // Select userId and petId
       * const usersIdsAndPetIds: { userId: number; petId: number | null; }[] = await db.select({
       *   userId: users.id,
       *   petId: pets.id,
       * })
       *   .from(users)
       *   .leftJoin(pets, eq(users.id, pets.ownerId))
       * ```
       */
      leftJoin = this.createJoin("left", false);
      /**
       * Executes a `left join lateral` operation by adding subquery to the current query.
       *
       * A `lateral` join allows the right-hand expression to refer to columns from the left-hand side.
       *
       * Calling this method associates each row of the table with the corresponding row from the joined table, if a match is found. If no matching row exists, it sets all columns of the joined table to null.
       *
       * See docs: {@link https://orm.drizzle.team/docs/joins#left-join-lateral}
       *
       * @param table the subquery to join.
       * @param on the `on` clause.
       */
      leftJoinLateral = this.createJoin("left", true);
      /**
       * Executes a `right join` operation by adding another table to the current query.
       *
       * Calling this method associates each row of the joined table with the corresponding row from the main table, if a match is found. If no matching row exists, it sets all columns of the main table to null.
       *
       * See docs: {@link https://orm.drizzle.team/docs/joins#right-join}
       *
       * @param table the table to join.
       * @param on the `on` clause.
       *
       * @example
       *
       * ```ts
       * // Select all users and their pets
       * const usersWithPets: { user: User | null; pets: Pet; }[] = await db.select()
       *   .from(users)
       *   .rightJoin(pets, eq(users.id, pets.ownerId))
       *
       * // Select userId and petId
       * const usersIdsAndPetIds: { userId: number | null; petId: number; }[] = await db.select({
       *   userId: users.id,
       *   petId: pets.id,
       * })
       *   .from(users)
       *   .rightJoin(pets, eq(users.id, pets.ownerId))
       * ```
       */
      rightJoin = this.createJoin("right", false);
      /**
       * Executes an `inner join` operation, creating a new table by combining rows from two tables that have matching values.
       *
       * Calling this method retrieves rows that have corresponding entries in both joined tables. Rows without matching entries in either table are excluded, resulting in a table that includes only matching pairs.
       *
       * See docs: {@link https://orm.drizzle.team/docs/joins#inner-join}
       *
       * @param table the table to join.
       * @param on the `on` clause.
       *
       * @example
       *
       * ```ts
       * // Select all users and their pets
       * const usersWithPets: { user: User; pets: Pet; }[] = await db.select()
       *   .from(users)
       *   .innerJoin(pets, eq(users.id, pets.ownerId))
       *
       * // Select userId and petId
       * const usersIdsAndPetIds: { userId: number; petId: number; }[] = await db.select({
       *   userId: users.id,
       *   petId: pets.id,
       * })
       *   .from(users)
       *   .innerJoin(pets, eq(users.id, pets.ownerId))
       * ```
       */
      innerJoin = this.createJoin("inner", false);
      /**
       * Executes an `inner join lateral` operation, creating a new table by combining rows from two queries that have matching values.
       *
       * A `lateral` join allows the right-hand expression to refer to columns from the left-hand side.
       *
       * Calling this method retrieves rows that have corresponding entries in both joined tables. Rows without matching entries in either table are excluded, resulting in a table that includes only matching pairs.
       *
       * See docs: {@link https://orm.drizzle.team/docs/joins#inner-join-lateral}
       *
       * @param table the subquery to join.
       * @param on the `on` clause.
       */
      innerJoinLateral = this.createJoin("inner", true);
      /**
       * Executes a `full join` operation by combining rows from two tables into a new table.
       *
       * Calling this method retrieves all rows from both main and joined tables, merging rows with matching values and filling in `null` for non-matching columns.
       *
       * See docs: {@link https://orm.drizzle.team/docs/joins#full-join}
       *
       * @param table the table to join.
       * @param on the `on` clause.
       *
       * @example
       *
       * ```ts
       * // Select all users and their pets
       * const usersWithPets: { user: User | null; pets: Pet | null; }[] = await db.select()
       *   .from(users)
       *   .fullJoin(pets, eq(users.id, pets.ownerId))
       *
       * // Select userId and petId
       * const usersIdsAndPetIds: { userId: number | null; petId: number | null; }[] = await db.select({
       *   userId: users.id,
       *   petId: pets.id,
       * })
       *   .from(users)
       *   .fullJoin(pets, eq(users.id, pets.ownerId))
       * ```
       */
      fullJoin = this.createJoin("full", false);
      /**
       * Executes a `cross join` operation by combining rows from two tables into a new table.
       *
       * Calling this method retrieves all rows from both main and joined tables, merging all rows from each table.
       *
       * See docs: {@link https://orm.drizzle.team/docs/joins#cross-join}
       *
       * @param table the table to join.
       *
       * @example
       *
       * ```ts
       * // Select all users, each user with every pet
       * const usersWithPets: { user: User; pets: Pet; }[] = await db.select()
       *   .from(users)
       *   .crossJoin(pets)
       *
       * // Select userId and petId
       * const usersIdsAndPetIds: { userId: number; petId: number; }[] = await db.select({
       *   userId: users.id,
       *   petId: pets.id,
       * })
       *   .from(users)
       *   .crossJoin(pets)
       * ```
       */
      crossJoin = this.createJoin("cross", false);
      /**
       * Executes a `cross join lateral` operation by combining rows from two queries into a new table.
       *
       * A `lateral` join allows the right-hand expression to refer to columns from the left-hand side.
       *
       * Calling this method retrieves all rows from both main and joined queries, merging all rows from each query.
       *
       * See docs: {@link https://orm.drizzle.team/docs/joins#cross-join-lateral}
       *
       * @param table the query to join.
       */
      crossJoinLateral = this.createJoin("cross", true);
      createSetOperator(type, isAll) {
        return (rightSelection) => {
          const rightSelect = typeof rightSelection === "function" ? rightSelection(getPgSetOperators()) : rightSelection;
          if (!haveSameKeys(this.getSelectedFields(), rightSelect.getSelectedFields())) {
            throw new Error(
              "Set operator error (union / intersect / except): selected fields are not the same or are in a different order"
            );
          }
          this.config.setOperators.push({ type, isAll, rightSelect });
          return this;
        };
      }
      /**
       * Adds `union` set operator to the query.
       *
       * Calling this method will combine the result sets of the `select` statements and remove any duplicate rows that appear across them.
       *
       * See docs: {@link https://orm.drizzle.team/docs/set-operations#union}
       *
       * @example
       *
       * ```ts
       * // Select all unique names from customers and users tables
       * await db.select({ name: users.name })
       *   .from(users)
       *   .union(
       *     db.select({ name: customers.name }).from(customers)
       *   );
       * // or
       * import { union } from 'drizzle-orm/pg-core'
       *
       * await union(
       *   db.select({ name: users.name }).from(users),
       *   db.select({ name: customers.name }).from(customers)
       * );
       * ```
       */
      union = this.createSetOperator("union", false);
      /**
       * Adds `union all` set operator to the query.
       *
       * Calling this method will combine the result-set of the `select` statements and keep all duplicate rows that appear across them.
       *
       * See docs: {@link https://orm.drizzle.team/docs/set-operations#union-all}
       *
       * @example
       *
       * ```ts
       * // Select all transaction ids from both online and in-store sales
       * await db.select({ transaction: onlineSales.transactionId })
       *   .from(onlineSales)
       *   .unionAll(
       *     db.select({ transaction: inStoreSales.transactionId }).from(inStoreSales)
       *   );
       * // or
       * import { unionAll } from 'drizzle-orm/pg-core'
       *
       * await unionAll(
       *   db.select({ transaction: onlineSales.transactionId }).from(onlineSales),
       *   db.select({ transaction: inStoreSales.transactionId }).from(inStoreSales)
       * );
       * ```
       */
      unionAll = this.createSetOperator("union", true);
      /**
       * Adds `intersect` set operator to the query.
       *
       * Calling this method will retain only the rows that are present in both result sets and eliminate duplicates.
       *
       * See docs: {@link https://orm.drizzle.team/docs/set-operations#intersect}
       *
       * @example
       *
       * ```ts
       * // Select course names that are offered in both departments A and B
       * await db.select({ courseName: depA.courseName })
       *   .from(depA)
       *   .intersect(
       *     db.select({ courseName: depB.courseName }).from(depB)
       *   );
       * // or
       * import { intersect } from 'drizzle-orm/pg-core'
       *
       * await intersect(
       *   db.select({ courseName: depA.courseName }).from(depA),
       *   db.select({ courseName: depB.courseName }).from(depB)
       * );
       * ```
       */
      intersect = this.createSetOperator("intersect", false);
      /**
       * Adds `intersect all` set operator to the query.
       *
       * Calling this method will retain only the rows that are present in both result sets including all duplicates.
       *
       * See docs: {@link https://orm.drizzle.team/docs/set-operations#intersect-all}
       *
       * @example
       *
       * ```ts
       * // Select all products and quantities that are ordered by both regular and VIP customers
       * await db.select({
       *   productId: regularCustomerOrders.productId,
       *   quantityOrdered: regularCustomerOrders.quantityOrdered
       * })
       * .from(regularCustomerOrders)
       * .intersectAll(
       *   db.select({
       *     productId: vipCustomerOrders.productId,
       *     quantityOrdered: vipCustomerOrders.quantityOrdered
       *   })
       *   .from(vipCustomerOrders)
       * );
       * // or
       * import { intersectAll } from 'drizzle-orm/pg-core'
       *
       * await intersectAll(
       *   db.select({
       *     productId: regularCustomerOrders.productId,
       *     quantityOrdered: regularCustomerOrders.quantityOrdered
       *   })
       *   .from(regularCustomerOrders),
       *   db.select({
       *     productId: vipCustomerOrders.productId,
       *     quantityOrdered: vipCustomerOrders.quantityOrdered
       *   })
       *   .from(vipCustomerOrders)
       * );
       * ```
       */
      intersectAll = this.createSetOperator("intersect", true);
      /**
       * Adds `except` set operator to the query.
       *
       * Calling this method will retrieve all unique rows from the left query, except for the rows that are present in the result set of the right query.
       *
       * See docs: {@link https://orm.drizzle.team/docs/set-operations#except}
       *
       * @example
       *
       * ```ts
       * // Select all courses offered in department A but not in department B
       * await db.select({ courseName: depA.courseName })
       *   .from(depA)
       *   .except(
       *     db.select({ courseName: depB.courseName }).from(depB)
       *   );
       * // or
       * import { except } from 'drizzle-orm/pg-core'
       *
       * await except(
       *   db.select({ courseName: depA.courseName }).from(depA),
       *   db.select({ courseName: depB.courseName }).from(depB)
       * );
       * ```
       */
      except = this.createSetOperator("except", false);
      /**
       * Adds `except all` set operator to the query.
       *
       * Calling this method will retrieve all rows from the left query, except for the rows that are present in the result set of the right query.
       *
       * See docs: {@link https://orm.drizzle.team/docs/set-operations#except-all}
       *
       * @example
       *
       * ```ts
       * // Select all products that are ordered by regular customers but not by VIP customers
       * await db.select({
       *   productId: regularCustomerOrders.productId,
       *   quantityOrdered: regularCustomerOrders.quantityOrdered,
       * })
       * .from(regularCustomerOrders)
       * .exceptAll(
       *   db.select({
       *     productId: vipCustomerOrders.productId,
       *     quantityOrdered: vipCustomerOrders.quantityOrdered,
       *   })
       *   .from(vipCustomerOrders)
       * );
       * // or
       * import { exceptAll } from 'drizzle-orm/pg-core'
       *
       * await exceptAll(
       *   db.select({
       *     productId: regularCustomerOrders.productId,
       *     quantityOrdered: regularCustomerOrders.quantityOrdered
       *   })
       *   .from(regularCustomerOrders),
       *   db.select({
       *     productId: vipCustomerOrders.productId,
       *     quantityOrdered: vipCustomerOrders.quantityOrdered
       *   })
       *   .from(vipCustomerOrders)
       * );
       * ```
       */
      exceptAll = this.createSetOperator("except", true);
      /** @internal */
      addSetOperators(setOperators) {
        this.config.setOperators.push(...setOperators);
        return this;
      }
      /**
       * Adds a `where` clause to the query.
       *
       * Calling this method will select only those rows that fulfill a specified condition.
       *
       * See docs: {@link https://orm.drizzle.team/docs/select#filtering}
       *
       * @param where the `where` clause.
       *
       * @example
       * You can use conditional operators and `sql function` to filter the rows to be selected.
       *
       * ```ts
       * // Select all cars with green color
       * await db.select().from(cars).where(eq(cars.color, 'green'));
       * // or
       * await db.select().from(cars).where(sql`${cars.color} = 'green'`)
       * ```
       *
       * You can logically combine conditional operators with `and()` and `or()` operators:
       *
       * ```ts
       * // Select all BMW cars with a green color
       * await db.select().from(cars).where(and(eq(cars.color, 'green'), eq(cars.brand, 'BMW')));
       *
       * // Select all cars with the green or blue color
       * await db.select().from(cars).where(or(eq(cars.color, 'green'), eq(cars.color, 'blue')));
       * ```
       */
      where(where) {
        if (typeof where === "function") {
          where = where(
            new Proxy(
              this.config.fields,
              new SelectionProxyHandler({ sqlAliasedBehavior: "sql", sqlBehavior: "sql" })
            )
          );
        }
        this.config.where = where;
        return this;
      }
      /**
       * Adds a `having` clause to the query.
       *
       * Calling this method will select only those rows that fulfill a specified condition. It is typically used with aggregate functions to filter the aggregated data based on a specified condition.
       *
       * See docs: {@link https://orm.drizzle.team/docs/select#aggregations}
       *
       * @param having the `having` clause.
       *
       * @example
       *
       * ```ts
       * // Select all brands with more than one car
       * await db.select({
       * 	brand: cars.brand,
       * 	count: sql<number>`cast(count(${cars.id}) as int)`,
       * })
       *   .from(cars)
       *   .groupBy(cars.brand)
       *   .having(({ count }) => gt(count, 1));
       * ```
       */
      having(having) {
        if (typeof having === "function") {
          having = having(
            new Proxy(
              this.config.fields,
              new SelectionProxyHandler({ sqlAliasedBehavior: "sql", sqlBehavior: "sql" })
            )
          );
        }
        this.config.having = having;
        return this;
      }
      groupBy(...columns) {
        if (typeof columns[0] === "function") {
          const groupBy = columns[0](
            new Proxy(
              this.config.fields,
              new SelectionProxyHandler({ sqlAliasedBehavior: "alias", sqlBehavior: "sql" })
            )
          );
          this.config.groupBy = Array.isArray(groupBy) ? groupBy : [groupBy];
        } else {
          this.config.groupBy = columns;
        }
        return this;
      }
      orderBy(...columns) {
        if (typeof columns[0] === "function") {
          const orderBy = columns[0](
            new Proxy(
              this.config.fields,
              new SelectionProxyHandler({ sqlAliasedBehavior: "alias", sqlBehavior: "sql" })
            )
          );
          const orderByArray = Array.isArray(orderBy) ? orderBy : [orderBy];
          if (this.config.setOperators.length > 0) {
            this.config.setOperators.at(-1).orderBy = orderByArray;
          } else {
            this.config.orderBy = orderByArray;
          }
        } else {
          const orderByArray = columns;
          if (this.config.setOperators.length > 0) {
            this.config.setOperators.at(-1).orderBy = orderByArray;
          } else {
            this.config.orderBy = orderByArray;
          }
        }
        return this;
      }
      /**
       * Adds a `limit` clause to the query.
       *
       * Calling this method will set the maximum number of rows that will be returned by this query.
       *
       * See docs: {@link https://orm.drizzle.team/docs/select#limit--offset}
       *
       * @param limit the `limit` clause.
       *
       * @example
       *
       * ```ts
       * // Get the first 10 people from this query.
       * await db.select().from(people).limit(10);
       * ```
       */
      limit(limit) {
        if (this.config.setOperators.length > 0) {
          this.config.setOperators.at(-1).limit = limit;
        } else {
          this.config.limit = limit;
        }
        return this;
      }
      /**
       * Adds an `offset` clause to the query.
       *
       * Calling this method will skip a number of rows when returning results from this query.
       *
       * See docs: {@link https://orm.drizzle.team/docs/select#limit--offset}
       *
       * @param offset the `offset` clause.
       *
       * @example
       *
       * ```ts
       * // Get the 10th-20th people from this query.
       * await db.select().from(people).offset(10).limit(10);
       * ```
       */
      offset(offset) {
        if (this.config.setOperators.length > 0) {
          this.config.setOperators.at(-1).offset = offset;
        } else {
          this.config.offset = offset;
        }
        return this;
      }
      /**
       * Adds a `for` clause to the query.
       *
       * Calling this method will specify a lock strength for this query that controls how strictly it acquires exclusive access to the rows being queried.
       *
       * See docs: {@link https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE}
       *
       * @param strength the lock strength.
       * @param config the lock configuration.
       */
      for(strength, config = {}) {
        this.config.lockingClause = { strength, config };
        return this;
      }
      /** @internal */
      getSQL() {
        return this.dialect.buildSelectQuery(this.config);
      }
      toSQL() {
        const { typings: _typings, ...rest } = this.dialect.sqlToQuery(this.getSQL());
        return rest;
      }
      as(alias) {
        const usedTables = [];
        usedTables.push(...extractUsedTable(this.config.table));
        if (this.config.joins) {
          for (const it of this.config.joins) usedTables.push(...extractUsedTable(it.table));
        }
        return new Proxy(
          new Subquery(this.getSQL(), this.config.fields, alias, false, [...new Set(usedTables)]),
          new SelectionProxyHandler({ alias, sqlAliasedBehavior: "alias", sqlBehavior: "error" })
        );
      }
      /** @internal */
      getSelectedFields() {
        return new Proxy(
          this.config.fields,
          new SelectionProxyHandler({ alias: this.tableName, sqlAliasedBehavior: "alias", sqlBehavior: "error" })
        );
      }
      $dynamic() {
        return this;
      }
      $withCache(config) {
        this.cacheConfig = config === void 0 ? { config: {}, enable: true, autoInvalidate: true } : config === false ? { enable: false } : { enable: true, autoInvalidate: true, ...config };
        return this;
      }
    };
    PgSelectBase = class extends PgSelectQueryBuilderBase {
      static [entityKind] = "PgSelect";
      /** @internal */
      _prepare(name) {
        const { session, config, dialect, joinsNotNullableMap, authToken, cacheConfig, usedTables } = this;
        if (!session) {
          throw new Error("Cannot execute a query on a query builder. Please use a database instance instead.");
        }
        const { fields: fields2 } = config;
        return tracer.startActiveSpan("drizzle.prepareQuery", () => {
          const fieldsList = orderSelectedFields(fields2);
          const query2 = session.prepareQuery(dialect.sqlToQuery(this.getSQL()), fieldsList, name, true, void 0, {
            type: "select",
            tables: [...usedTables]
          }, cacheConfig);
          query2.joinsNotNullableMap = joinsNotNullableMap;
          return query2.setToken(authToken);
        });
      }
      /**
       * Create a prepared statement for this query. This allows
       * the database to remember this query for the given session
       * and call it by name, rather than specifying the full query.
       *
       * {@link https://www.postgresql.org/docs/current/sql-prepare.html | Postgres prepare documentation}
       */
      prepare(name) {
        return this._prepare(name);
      }
      authToken;
      /** @internal */
      setToken(token) {
        this.authToken = token;
        return this;
      }
      execute = (placeholderValues) => {
        return tracer.startActiveSpan("drizzle.operation", () => {
          return this._prepare().execute(placeholderValues, this.authToken);
        });
      };
    };
    applyMixins(PgSelectBase, [QueryPromise]);
    getPgSetOperators = () => ({
      union,
      unionAll,
      intersect,
      intersectAll,
      except,
      exceptAll
    });
    union = createSetOperator("union", false);
    unionAll = createSetOperator("union", true);
    intersect = createSetOperator("intersect", false);
    intersectAll = createSetOperator("intersect", true);
    except = createSetOperator("except", false);
    exceptAll = createSetOperator("except", true);
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/query-builders/query-builder.js
var QueryBuilder;
var init_query_builder2 = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/query-builders/query-builder.js"() {
    init_entity();
    init_dialect();
    init_selection_proxy();
    init_subquery();
    init_select2();
    QueryBuilder = class {
      static [entityKind] = "PgQueryBuilder";
      dialect;
      dialectConfig;
      constructor(dialect) {
        this.dialect = is(dialect, PgDialect) ? dialect : void 0;
        this.dialectConfig = is(dialect, PgDialect) ? void 0 : dialect;
      }
      $with = (alias, selection) => {
        const queryBuilder = this;
        const as = (qb) => {
          if (typeof qb === "function") {
            qb = qb(queryBuilder);
          }
          return new Proxy(
            new WithSubquery(
              qb.getSQL(),
              selection ?? ("getSelectedFields" in qb ? qb.getSelectedFields() ?? {} : {}),
              alias,
              true
            ),
            new SelectionProxyHandler({ alias, sqlAliasedBehavior: "alias", sqlBehavior: "error" })
          );
        };
        return { as };
      };
      with(...queries) {
        const self = this;
        function select(fields2) {
          return new PgSelectBuilder({
            fields: fields2 ?? void 0,
            session: void 0,
            dialect: self.getDialect(),
            withList: queries
          });
        }
        function selectDistinct(fields2) {
          return new PgSelectBuilder({
            fields: fields2 ?? void 0,
            session: void 0,
            dialect: self.getDialect(),
            distinct: true
          });
        }
        function selectDistinctOn(on, fields2) {
          return new PgSelectBuilder({
            fields: fields2 ?? void 0,
            session: void 0,
            dialect: self.getDialect(),
            distinct: { on }
          });
        }
        return { select, selectDistinct, selectDistinctOn };
      }
      select(fields2) {
        return new PgSelectBuilder({
          fields: fields2 ?? void 0,
          session: void 0,
          dialect: this.getDialect()
        });
      }
      selectDistinct(fields2) {
        return new PgSelectBuilder({
          fields: fields2 ?? void 0,
          session: void 0,
          dialect: this.getDialect(),
          distinct: true
        });
      }
      selectDistinctOn(on, fields2) {
        return new PgSelectBuilder({
          fields: fields2 ?? void 0,
          session: void 0,
          dialect: this.getDialect(),
          distinct: { on }
        });
      }
      // Lazy load dialect to avoid circular dependency
      getDialect() {
        if (!this.dialect) {
          this.dialect = new PgDialect(this.dialectConfig);
        }
        return this.dialect;
      }
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/view.js
function pgViewWithSchema(name, selection, schema) {
  if (selection) {
    return new ManualViewBuilder(name, selection, schema);
  }
  return new ViewBuilder(name, schema);
}
function pgMaterializedViewWithSchema(name, selection, schema) {
  if (selection) {
    return new ManualMaterializedViewBuilder(name, selection, schema);
  }
  return new MaterializedViewBuilder(name, schema);
}
var DefaultViewBuilderCore, ViewBuilder, ManualViewBuilder, MaterializedViewBuilderCore, MaterializedViewBuilder, ManualMaterializedViewBuilder, PgView, PgMaterializedViewConfig, PgMaterializedView;
var init_view = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/view.js"() {
    init_entity();
    init_selection_proxy();
    init_utils();
    init_query_builder2();
    init_table2();
    init_view_base();
    init_view_common2();
    DefaultViewBuilderCore = class {
      constructor(name, schema) {
        this.name = name;
        this.schema = schema;
      }
      static [entityKind] = "PgDefaultViewBuilderCore";
      config = {};
      with(config) {
        this.config.with = config;
        return this;
      }
    };
    ViewBuilder = class extends DefaultViewBuilderCore {
      static [entityKind] = "PgViewBuilder";
      as(qb) {
        if (typeof qb === "function") {
          qb = qb(new QueryBuilder());
        }
        const selectionProxy = new SelectionProxyHandler({
          alias: this.name,
          sqlBehavior: "error",
          sqlAliasedBehavior: "alias",
          replaceOriginalName: true
        });
        const aliasedSelection = new Proxy(qb.getSelectedFields(), selectionProxy);
        return new Proxy(
          new PgView({
            pgConfig: this.config,
            config: {
              name: this.name,
              schema: this.schema,
              selectedFields: aliasedSelection,
              query: qb.getSQL().inlineParams()
            }
          }),
          selectionProxy
        );
      }
    };
    ManualViewBuilder = class extends DefaultViewBuilderCore {
      static [entityKind] = "PgManualViewBuilder";
      columns;
      constructor(name, columns, schema) {
        super(name, schema);
        this.columns = getTableColumns(pgTable(name, columns));
      }
      existing() {
        return new Proxy(
          new PgView({
            pgConfig: void 0,
            config: {
              name: this.name,
              schema: this.schema,
              selectedFields: this.columns,
              query: void 0
            }
          }),
          new SelectionProxyHandler({
            alias: this.name,
            sqlBehavior: "error",
            sqlAliasedBehavior: "alias",
            replaceOriginalName: true
          })
        );
      }
      as(query2) {
        return new Proxy(
          new PgView({
            pgConfig: this.config,
            config: {
              name: this.name,
              schema: this.schema,
              selectedFields: this.columns,
              query: query2.inlineParams()
            }
          }),
          new SelectionProxyHandler({
            alias: this.name,
            sqlBehavior: "error",
            sqlAliasedBehavior: "alias",
            replaceOriginalName: true
          })
        );
      }
    };
    MaterializedViewBuilderCore = class {
      constructor(name, schema) {
        this.name = name;
        this.schema = schema;
      }
      static [entityKind] = "PgMaterializedViewBuilderCore";
      config = {};
      using(using) {
        this.config.using = using;
        return this;
      }
      with(config) {
        this.config.with = config;
        return this;
      }
      tablespace(tablespace) {
        this.config.tablespace = tablespace;
        return this;
      }
      withNoData() {
        this.config.withNoData = true;
        return this;
      }
    };
    MaterializedViewBuilder = class extends MaterializedViewBuilderCore {
      static [entityKind] = "PgMaterializedViewBuilder";
      as(qb) {
        if (typeof qb === "function") {
          qb = qb(new QueryBuilder());
        }
        const selectionProxy = new SelectionProxyHandler({
          alias: this.name,
          sqlBehavior: "error",
          sqlAliasedBehavior: "alias",
          replaceOriginalName: true
        });
        const aliasedSelection = new Proxy(qb.getSelectedFields(), selectionProxy);
        return new Proxy(
          new PgMaterializedView({
            pgConfig: {
              with: this.config.with,
              using: this.config.using,
              tablespace: this.config.tablespace,
              withNoData: this.config.withNoData
            },
            config: {
              name: this.name,
              schema: this.schema,
              selectedFields: aliasedSelection,
              query: qb.getSQL().inlineParams()
            }
          }),
          selectionProxy
        );
      }
    };
    ManualMaterializedViewBuilder = class extends MaterializedViewBuilderCore {
      static [entityKind] = "PgManualMaterializedViewBuilder";
      columns;
      constructor(name, columns, schema) {
        super(name, schema);
        this.columns = getTableColumns(pgTable(name, columns));
      }
      existing() {
        return new Proxy(
          new PgMaterializedView({
            pgConfig: {
              tablespace: this.config.tablespace,
              using: this.config.using,
              with: this.config.with,
              withNoData: this.config.withNoData
            },
            config: {
              name: this.name,
              schema: this.schema,
              selectedFields: this.columns,
              query: void 0
            }
          }),
          new SelectionProxyHandler({
            alias: this.name,
            sqlBehavior: "error",
            sqlAliasedBehavior: "alias",
            replaceOriginalName: true
          })
        );
      }
      as(query2) {
        return new Proxy(
          new PgMaterializedView({
            pgConfig: {
              tablespace: this.config.tablespace,
              using: this.config.using,
              with: this.config.with,
              withNoData: this.config.withNoData
            },
            config: {
              name: this.name,
              schema: this.schema,
              selectedFields: this.columns,
              query: query2.inlineParams()
            }
          }),
          new SelectionProxyHandler({
            alias: this.name,
            sqlBehavior: "error",
            sqlAliasedBehavior: "alias",
            replaceOriginalName: true
          })
        );
      }
    };
    PgView = class extends PgViewBase {
      static [entityKind] = "PgView";
      [PgViewConfig];
      constructor({ pgConfig, config }) {
        super(config);
        if (pgConfig) {
          this[PgViewConfig] = {
            with: pgConfig.with
          };
        }
      }
    };
    PgMaterializedViewConfig = /* @__PURE__ */ Symbol.for("drizzle:PgMaterializedViewConfig");
    PgMaterializedView = class extends PgViewBase {
      static [entityKind] = "PgMaterializedView";
      [PgMaterializedViewConfig];
      constructor({ pgConfig, config }) {
        super(config);
        this[PgMaterializedViewConfig] = {
          with: pgConfig?.with,
          using: pgConfig?.using,
          tablespace: pgConfig?.tablespace,
          withNoData: pgConfig?.withNoData
        };
      }
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/utils.js
function extractUsedTable(table) {
  if (is(table, PgTable)) {
    return [table[Schema] ? `${table[Schema]}.${table[Table.Symbol.BaseName]}` : table[Table.Symbol.BaseName]];
  }
  if (is(table, Subquery)) {
    return table._.usedTables ?? [];
  }
  if (is(table, SQL)) {
    return table.usedTables ?? [];
  }
  return [];
}
var init_utils3 = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/utils.js"() {
    init_entity();
    init_table2();
    init_sql();
    init_subquery();
    init_table();
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/query-builders/delete.js
var PgDeleteBase;
var init_delete = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/query-builders/delete.js"() {
    init_entity();
    init_query_promise();
    init_selection_proxy();
    init_table();
    init_tracing();
    init_utils();
    init_utils3();
    PgDeleteBase = class extends QueryPromise {
      constructor(table, session, dialect, withList) {
        super();
        this.session = session;
        this.dialect = dialect;
        this.config = { table, withList };
      }
      static [entityKind] = "PgDelete";
      config;
      cacheConfig;
      /**
       * Adds a `where` clause to the query.
       *
       * Calling this method will delete only those rows that fulfill a specified condition.
       *
       * See docs: {@link https://orm.drizzle.team/docs/delete}
       *
       * @param where the `where` clause.
       *
       * @example
       * You can use conditional operators and `sql function` to filter the rows to be deleted.
       *
       * ```ts
       * // Delete all cars with green color
       * await db.delete(cars).where(eq(cars.color, 'green'));
       * // or
       * await db.delete(cars).where(sql`${cars.color} = 'green'`)
       * ```
       *
       * You can logically combine conditional operators with `and()` and `or()` operators:
       *
       * ```ts
       * // Delete all BMW cars with a green color
       * await db.delete(cars).where(and(eq(cars.color, 'green'), eq(cars.brand, 'BMW')));
       *
       * // Delete all cars with the green or blue color
       * await db.delete(cars).where(or(eq(cars.color, 'green'), eq(cars.color, 'blue')));
       * ```
       */
      where(where) {
        this.config.where = where;
        return this;
      }
      returning(fields2 = this.config.table[Table.Symbol.Columns]) {
        this.config.returningFields = fields2;
        this.config.returning = orderSelectedFields(fields2);
        return this;
      }
      /** @internal */
      getSQL() {
        return this.dialect.buildDeleteQuery(this.config);
      }
      toSQL() {
        const { typings: _typings, ...rest } = this.dialect.sqlToQuery(this.getSQL());
        return rest;
      }
      /** @internal */
      _prepare(name) {
        return tracer.startActiveSpan("drizzle.prepareQuery", () => {
          return this.session.prepareQuery(this.dialect.sqlToQuery(this.getSQL()), this.config.returning, name, true, void 0, {
            type: "delete",
            tables: extractUsedTable(this.config.table)
          }, this.cacheConfig);
        });
      }
      prepare(name) {
        return this._prepare(name);
      }
      authToken;
      /** @internal */
      setToken(token) {
        this.authToken = token;
        return this;
      }
      execute = (placeholderValues) => {
        return tracer.startActiveSpan("drizzle.operation", () => {
          return this._prepare().execute(placeholderValues, this.authToken);
        });
      };
      /** @internal */
      getSelectedFields() {
        return this.config.returningFields ? new Proxy(
          this.config.returningFields,
          new SelectionProxyHandler({
            alias: getTableName(this.config.table),
            sqlAliasedBehavior: "alias",
            sqlBehavior: "error"
          })
        ) : void 0;
      }
      $dynamic() {
        return this;
      }
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/query-builders/insert.js
var PgInsertBuilder, PgInsertBase;
var init_insert = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/query-builders/insert.js"() {
    init_entity();
    init_query_promise();
    init_selection_proxy();
    init_sql();
    init_table();
    init_tracing();
    init_utils();
    init_utils3();
    init_query_builder2();
    PgInsertBuilder = class {
      constructor(table, session, dialect, withList, overridingSystemValue_) {
        this.table = table;
        this.session = session;
        this.dialect = dialect;
        this.withList = withList;
        this.overridingSystemValue_ = overridingSystemValue_;
      }
      static [entityKind] = "PgInsertBuilder";
      authToken;
      /** @internal */
      setToken(token) {
        this.authToken = token;
        return this;
      }
      overridingSystemValue() {
        this.overridingSystemValue_ = true;
        return this;
      }
      values(values) {
        values = Array.isArray(values) ? values : [values];
        if (values.length === 0) {
          throw new Error("values() must be called with at least one value");
        }
        const mappedValues = values.map((entry) => {
          const result = {};
          const cols = this.table[Table.Symbol.Columns];
          for (const colKey of Object.keys(entry)) {
            const colValue = entry[colKey];
            result[colKey] = is(colValue, SQL) ? colValue : new Param(colValue, cols[colKey]);
          }
          return result;
        });
        return new PgInsertBase(
          this.table,
          mappedValues,
          this.session,
          this.dialect,
          this.withList,
          false,
          this.overridingSystemValue_
        ).setToken(this.authToken);
      }
      select(selectQuery) {
        const select = typeof selectQuery === "function" ? selectQuery(new QueryBuilder()) : selectQuery;
        if (!is(select, SQL) && !haveSameKeys(this.table[Columns], select._.selectedFields)) {
          throw new Error(
            "Insert select error: selected fields are not the same or are in a different order compared to the table definition"
          );
        }
        return new PgInsertBase(this.table, select, this.session, this.dialect, this.withList, true);
      }
    };
    PgInsertBase = class extends QueryPromise {
      constructor(table, values, session, dialect, withList, select, overridingSystemValue_) {
        super();
        this.session = session;
        this.dialect = dialect;
        this.config = { table, values, withList, select, overridingSystemValue_ };
      }
      static [entityKind] = "PgInsert";
      config;
      cacheConfig;
      returning(fields2 = this.config.table[Table.Symbol.Columns]) {
        this.config.returningFields = fields2;
        this.config.returning = orderSelectedFields(fields2);
        return this;
      }
      /**
       * Adds an `on conflict do nothing` clause to the query.
       *
       * Calling this method simply avoids inserting a row as its alternative action.
       *
       * See docs: {@link https://orm.drizzle.team/docs/insert#on-conflict-do-nothing}
       *
       * @param config The `target` and `where` clauses.
       *
       * @example
       * ```ts
       * // Insert one row and cancel the insert if there's a conflict
       * await db.insert(cars)
       *   .values({ id: 1, brand: 'BMW' })
       *   .onConflictDoNothing();
       *
       * // Explicitly specify conflict target
       * await db.insert(cars)
       *   .values({ id: 1, brand: 'BMW' })
       *   .onConflictDoNothing({ target: cars.id });
       * ```
       */
      onConflictDoNothing(config = {}) {
        if (config.target === void 0) {
          this.config.onConflict = sql`do nothing`;
        } else {
          let targetColumn = "";
          targetColumn = Array.isArray(config.target) ? config.target.map((it) => this.dialect.escapeName(this.dialect.casing.getColumnCasing(it))).join(",") : this.dialect.escapeName(this.dialect.casing.getColumnCasing(config.target));
          const whereSql = config.where ? sql` where ${config.where}` : void 0;
          this.config.onConflict = sql`(${sql.raw(targetColumn)})${whereSql} do nothing`;
        }
        return this;
      }
      /**
       * Adds an `on conflict do update` clause to the query.
       *
       * Calling this method will update the existing row that conflicts with the row proposed for insertion as its alternative action.
       *
       * See docs: {@link https://orm.drizzle.team/docs/insert#upserts-and-conflicts}
       *
       * @param config The `target`, `set` and `where` clauses.
       *
       * @example
       * ```ts
       * // Update the row if there's a conflict
       * await db.insert(cars)
       *   .values({ id: 1, brand: 'BMW' })
       *   .onConflictDoUpdate({
       *     target: cars.id,
       *     set: { brand: 'Porsche' }
       *   });
       *
       * // Upsert with 'where' clause
       * await db.insert(cars)
       *   .values({ id: 1, brand: 'BMW' })
       *   .onConflictDoUpdate({
       *     target: cars.id,
       *     set: { brand: 'newBMW' },
       *     targetWhere: sql`${cars.createdAt} > '2023-01-01'::date`,
       *   });
       * ```
       */
      onConflictDoUpdate(config) {
        if (config.where && (config.targetWhere || config.setWhere)) {
          throw new Error(
            'You cannot use both "where" and "targetWhere"/"setWhere" at the same time - "where" is deprecated, use "targetWhere" or "setWhere" instead.'
          );
        }
        const whereSql = config.where ? sql` where ${config.where}` : void 0;
        const targetWhereSql = config.targetWhere ? sql` where ${config.targetWhere}` : void 0;
        const setWhereSql = config.setWhere ? sql` where ${config.setWhere}` : void 0;
        const setSql = this.dialect.buildUpdateSet(this.config.table, mapUpdateSet(this.config.table, config.set));
        let targetColumn = "";
        targetColumn = Array.isArray(config.target) ? config.target.map((it) => this.dialect.escapeName(this.dialect.casing.getColumnCasing(it))).join(",") : this.dialect.escapeName(this.dialect.casing.getColumnCasing(config.target));
        this.config.onConflict = sql`(${sql.raw(targetColumn)})${targetWhereSql} do update set ${setSql}${whereSql}${setWhereSql}`;
        return this;
      }
      /** @internal */
      getSQL() {
        return this.dialect.buildInsertQuery(this.config);
      }
      toSQL() {
        const { typings: _typings, ...rest } = this.dialect.sqlToQuery(this.getSQL());
        return rest;
      }
      /** @internal */
      _prepare(name) {
        return tracer.startActiveSpan("drizzle.prepareQuery", () => {
          return this.session.prepareQuery(this.dialect.sqlToQuery(this.getSQL()), this.config.returning, name, true, void 0, {
            type: "insert",
            tables: extractUsedTable(this.config.table)
          }, this.cacheConfig);
        });
      }
      prepare(name) {
        return this._prepare(name);
      }
      authToken;
      /** @internal */
      setToken(token) {
        this.authToken = token;
        return this;
      }
      execute = (placeholderValues) => {
        return tracer.startActiveSpan("drizzle.operation", () => {
          return this._prepare().execute(placeholderValues, this.authToken);
        });
      };
      /** @internal */
      getSelectedFields() {
        return this.config.returningFields ? new Proxy(
          this.config.returningFields,
          new SelectionProxyHandler({
            alias: getTableName(this.config.table),
            sqlAliasedBehavior: "alias",
            sqlBehavior: "error"
          })
        ) : void 0;
      }
      $dynamic() {
        return this;
      }
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/query-builders/refresh-materialized-view.js
var PgRefreshMaterializedView;
var init_refresh_materialized_view = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/query-builders/refresh-materialized-view.js"() {
    init_entity();
    init_query_promise();
    init_tracing();
    PgRefreshMaterializedView = class extends QueryPromise {
      constructor(view, session, dialect) {
        super();
        this.session = session;
        this.dialect = dialect;
        this.config = { view };
      }
      static [entityKind] = "PgRefreshMaterializedView";
      config;
      concurrently() {
        if (this.config.withNoData !== void 0) {
          throw new Error("Cannot use concurrently and withNoData together");
        }
        this.config.concurrently = true;
        return this;
      }
      withNoData() {
        if (this.config.concurrently !== void 0) {
          throw new Error("Cannot use concurrently and withNoData together");
        }
        this.config.withNoData = true;
        return this;
      }
      /** @internal */
      getSQL() {
        return this.dialect.buildRefreshMaterializedViewQuery(this.config);
      }
      toSQL() {
        const { typings: _typings, ...rest } = this.dialect.sqlToQuery(this.getSQL());
        return rest;
      }
      /** @internal */
      _prepare(name) {
        return tracer.startActiveSpan("drizzle.prepareQuery", () => {
          return this.session.prepareQuery(this.dialect.sqlToQuery(this.getSQL()), void 0, name, true);
        });
      }
      prepare(name) {
        return this._prepare(name);
      }
      authToken;
      /** @internal */
      setToken(token) {
        this.authToken = token;
        return this;
      }
      execute = (placeholderValues) => {
        return tracer.startActiveSpan("drizzle.operation", () => {
          return this._prepare().execute(placeholderValues, this.authToken);
        });
      };
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/query-builders/select.types.js
var init_select_types = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/query-builders/select.types.js"() {
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/query-builders/update.js
var PgUpdateBuilder, PgUpdateBase;
var init_update = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/query-builders/update.js"() {
    init_entity();
    init_table2();
    init_query_promise();
    init_selection_proxy();
    init_sql();
    init_subquery();
    init_table();
    init_utils();
    init_view_common();
    init_utils3();
    PgUpdateBuilder = class {
      constructor(table, session, dialect, withList) {
        this.table = table;
        this.session = session;
        this.dialect = dialect;
        this.withList = withList;
      }
      static [entityKind] = "PgUpdateBuilder";
      authToken;
      setToken(token) {
        this.authToken = token;
        return this;
      }
      set(values) {
        return new PgUpdateBase(
          this.table,
          mapUpdateSet(this.table, values),
          this.session,
          this.dialect,
          this.withList
        ).setToken(this.authToken);
      }
    };
    PgUpdateBase = class extends QueryPromise {
      constructor(table, set, session, dialect, withList) {
        super();
        this.session = session;
        this.dialect = dialect;
        this.config = { set, table, withList, joins: [] };
        this.tableName = getTableLikeName(table);
        this.joinsNotNullableMap = typeof this.tableName === "string" ? { [this.tableName]: true } : {};
      }
      static [entityKind] = "PgUpdate";
      config;
      tableName;
      joinsNotNullableMap;
      cacheConfig;
      from(source) {
        const src = source;
        const tableName = getTableLikeName(src);
        if (typeof tableName === "string") {
          this.joinsNotNullableMap[tableName] = true;
        }
        this.config.from = src;
        return this;
      }
      getTableLikeFields(table) {
        if (is(table, PgTable)) {
          return table[Table.Symbol.Columns];
        } else if (is(table, Subquery)) {
          return table._.selectedFields;
        }
        return table[ViewBaseConfig].selectedFields;
      }
      createJoin(joinType) {
        return (table, on) => {
          const tableName = getTableLikeName(table);
          if (typeof tableName === "string" && this.config.joins.some((join) => join.alias === tableName)) {
            throw new Error(`Alias "${tableName}" is already used in this query`);
          }
          if (typeof on === "function") {
            const from = this.config.from && !is(this.config.from, SQL) ? this.getTableLikeFields(this.config.from) : void 0;
            on = on(
              new Proxy(
                this.config.table[Table.Symbol.Columns],
                new SelectionProxyHandler({ sqlAliasedBehavior: "sql", sqlBehavior: "sql" })
              ),
              from && new Proxy(
                from,
                new SelectionProxyHandler({ sqlAliasedBehavior: "sql", sqlBehavior: "sql" })
              )
            );
          }
          this.config.joins.push({ on, table, joinType, alias: tableName });
          if (typeof tableName === "string") {
            switch (joinType) {
              case "left": {
                this.joinsNotNullableMap[tableName] = false;
                break;
              }
              case "right": {
                this.joinsNotNullableMap = Object.fromEntries(
                  Object.entries(this.joinsNotNullableMap).map(([key2]) => [key2, false])
                );
                this.joinsNotNullableMap[tableName] = true;
                break;
              }
              case "inner": {
                this.joinsNotNullableMap[tableName] = true;
                break;
              }
              case "full": {
                this.joinsNotNullableMap = Object.fromEntries(
                  Object.entries(this.joinsNotNullableMap).map(([key2]) => [key2, false])
                );
                this.joinsNotNullableMap[tableName] = false;
                break;
              }
            }
          }
          return this;
        };
      }
      leftJoin = this.createJoin("left");
      rightJoin = this.createJoin("right");
      innerJoin = this.createJoin("inner");
      fullJoin = this.createJoin("full");
      /**
       * Adds a 'where' clause to the query.
       *
       * Calling this method will update only those rows that fulfill a specified condition.
       *
       * See docs: {@link https://orm.drizzle.team/docs/update}
       *
       * @param where the 'where' clause.
       *
       * @example
       * You can use conditional operators and `sql function` to filter the rows to be updated.
       *
       * ```ts
       * // Update all cars with green color
       * await db.update(cars).set({ color: 'red' })
       *   .where(eq(cars.color, 'green'));
       * // or
       * await db.update(cars).set({ color: 'red' })
       *   .where(sql`${cars.color} = 'green'`)
       * ```
       *
       * You can logically combine conditional operators with `and()` and `or()` operators:
       *
       * ```ts
       * // Update all BMW cars with a green color
       * await db.update(cars).set({ color: 'red' })
       *   .where(and(eq(cars.color, 'green'), eq(cars.brand, 'BMW')));
       *
       * // Update all cars with the green or blue color
       * await db.update(cars).set({ color: 'red' })
       *   .where(or(eq(cars.color, 'green'), eq(cars.color, 'blue')));
       * ```
       */
      where(where) {
        this.config.where = where;
        return this;
      }
      returning(fields2) {
        if (!fields2) {
          fields2 = Object.assign({}, this.config.table[Table.Symbol.Columns]);
          if (this.config.from) {
            const tableName = getTableLikeName(this.config.from);
            if (typeof tableName === "string" && this.config.from && !is(this.config.from, SQL)) {
              const fromFields = this.getTableLikeFields(this.config.from);
              fields2[tableName] = fromFields;
            }
            for (const join of this.config.joins) {
              const tableName2 = getTableLikeName(join.table);
              if (typeof tableName2 === "string" && !is(join.table, SQL)) {
                const fromFields = this.getTableLikeFields(join.table);
                fields2[tableName2] = fromFields;
              }
            }
          }
        }
        this.config.returningFields = fields2;
        this.config.returning = orderSelectedFields(fields2);
        return this;
      }
      /** @internal */
      getSQL() {
        return this.dialect.buildUpdateQuery(this.config);
      }
      toSQL() {
        const { typings: _typings, ...rest } = this.dialect.sqlToQuery(this.getSQL());
        return rest;
      }
      /** @internal */
      _prepare(name) {
        const query2 = this.session.prepareQuery(this.dialect.sqlToQuery(this.getSQL()), this.config.returning, name, true, void 0, {
          type: "insert",
          tables: extractUsedTable(this.config.table)
        }, this.cacheConfig);
        query2.joinsNotNullableMap = this.joinsNotNullableMap;
        return query2;
      }
      prepare(name) {
        return this._prepare(name);
      }
      authToken;
      /** @internal */
      setToken(token) {
        this.authToken = token;
        return this;
      }
      execute = (placeholderValues) => {
        return this._prepare().execute(placeholderValues, this.authToken);
      };
      /** @internal */
      getSelectedFields() {
        return this.config.returningFields ? new Proxy(
          this.config.returningFields,
          new SelectionProxyHandler({
            alias: getTableName(this.config.table),
            sqlAliasedBehavior: "alias",
            sqlBehavior: "error"
          })
        ) : void 0;
      }
      $dynamic() {
        return this;
      }
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/query-builders/index.js
var init_query_builders = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/query-builders/index.js"() {
    init_delete();
    init_insert();
    init_query_builder2();
    init_refresh_materialized_view();
    init_select2();
    init_select_types();
    init_update();
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/query-builders/count.js
var PgCountBuilder;
var init_count = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/query-builders/count.js"() {
    init_entity();
    init_sql();
    PgCountBuilder = class _PgCountBuilder extends SQL {
      constructor(params) {
        super(_PgCountBuilder.buildEmbeddedCount(params.source, params.filters).queryChunks);
        this.params = params;
        this.mapWith(Number);
        this.session = params.session;
        this.sql = _PgCountBuilder.buildCount(
          params.source,
          params.filters
        );
      }
      sql;
      token;
      static [entityKind] = "PgCountBuilder";
      [Symbol.toStringTag] = "PgCountBuilder";
      session;
      static buildEmbeddedCount(source, filters) {
        return sql`(select count(*) from ${source}${sql.raw(" where ").if(filters)}${filters})`;
      }
      static buildCount(source, filters) {
        return sql`select count(*) as count from ${source}${sql.raw(" where ").if(filters)}${filters};`;
      }
      /** @intrnal */
      setToken(token) {
        this.token = token;
        return this;
      }
      then(onfulfilled, onrejected) {
        return Promise.resolve(this.session.count(this.sql, this.token)).then(
          onfulfilled,
          onrejected
        );
      }
      catch(onRejected) {
        return this.then(void 0, onRejected);
      }
      finally(onFinally) {
        return this.then(
          (value) => {
            onFinally?.();
            return value;
          },
          (reason) => {
            onFinally?.();
            throw reason;
          }
        );
      }
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/query-builders/query.js
var RelationalQueryBuilder, PgRelationalQuery;
var init_query = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/query-builders/query.js"() {
    init_entity();
    init_query_promise();
    init_relations();
    init_tracing();
    RelationalQueryBuilder = class {
      constructor(fullSchema, schema, tableNamesMap, table, tableConfig, dialect, session) {
        this.fullSchema = fullSchema;
        this.schema = schema;
        this.tableNamesMap = tableNamesMap;
        this.table = table;
        this.tableConfig = tableConfig;
        this.dialect = dialect;
        this.session = session;
      }
      static [entityKind] = "PgRelationalQueryBuilder";
      findMany(config) {
        return new PgRelationalQuery(
          this.fullSchema,
          this.schema,
          this.tableNamesMap,
          this.table,
          this.tableConfig,
          this.dialect,
          this.session,
          config ? config : {},
          "many"
        );
      }
      findFirst(config) {
        return new PgRelationalQuery(
          this.fullSchema,
          this.schema,
          this.tableNamesMap,
          this.table,
          this.tableConfig,
          this.dialect,
          this.session,
          config ? { ...config, limit: 1 } : { limit: 1 },
          "first"
        );
      }
    };
    PgRelationalQuery = class extends QueryPromise {
      constructor(fullSchema, schema, tableNamesMap, table, tableConfig, dialect, session, config, mode) {
        super();
        this.fullSchema = fullSchema;
        this.schema = schema;
        this.tableNamesMap = tableNamesMap;
        this.table = table;
        this.tableConfig = tableConfig;
        this.dialect = dialect;
        this.session = session;
        this.config = config;
        this.mode = mode;
      }
      static [entityKind] = "PgRelationalQuery";
      /** @internal */
      _prepare(name) {
        return tracer.startActiveSpan("drizzle.prepareQuery", () => {
          const { query: query2, builtQuery } = this._toSQL();
          return this.session.prepareQuery(
            builtQuery,
            void 0,
            name,
            true,
            (rawRows, mapColumnValue) => {
              const rows = rawRows.map(
                (row) => mapRelationalRow(this.schema, this.tableConfig, row, query2.selection, mapColumnValue)
              );
              if (this.mode === "first") {
                return rows[0];
              }
              return rows;
            }
          );
        });
      }
      prepare(name) {
        return this._prepare(name);
      }
      _getQuery() {
        return this.dialect.buildRelationalQueryWithoutPK({
          fullSchema: this.fullSchema,
          schema: this.schema,
          tableNamesMap: this.tableNamesMap,
          table: this.table,
          tableConfig: this.tableConfig,
          queryConfig: this.config,
          tableAlias: this.tableConfig.tsName
        });
      }
      /** @internal */
      getSQL() {
        return this._getQuery().sql;
      }
      _toSQL() {
        const query2 = this._getQuery();
        const builtQuery = this.dialect.sqlToQuery(query2.sql);
        return { query: query2, builtQuery };
      }
      toSQL() {
        return this._toSQL().builtQuery;
      }
      authToken;
      /** @internal */
      setToken(token) {
        this.authToken = token;
        return this;
      }
      execute() {
        return tracer.startActiveSpan("drizzle.operation", () => {
          return this._prepare().execute(void 0, this.authToken);
        });
      }
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/query-builders/raw.js
var PgRaw;
var init_raw = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/query-builders/raw.js"() {
    init_entity();
    init_query_promise();
    PgRaw = class extends QueryPromise {
      constructor(execute, sql2, query2, mapBatchResult) {
        super();
        this.execute = execute;
        this.sql = sql2;
        this.query = query2;
        this.mapBatchResult = mapBatchResult;
      }
      static [entityKind] = "PgRaw";
      /** @internal */
      getSQL() {
        return this.sql;
      }
      getQuery() {
        return this.query;
      }
      mapResult(result, isFromBatch) {
        return isFromBatch ? this.mapBatchResult(result) : result;
      }
      _prepare() {
        return this;
      }
      /** @internal */
      isResponseInArrayMode() {
        return false;
      }
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/db.js
var PgDatabase;
var init_db = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/db.js"() {
    init_entity();
    init_query_builders();
    init_selection_proxy();
    init_sql();
    init_subquery();
    init_count();
    init_query();
    init_raw();
    init_refresh_materialized_view();
    PgDatabase = class {
      constructor(dialect, session, schema) {
        this.dialect = dialect;
        this.session = session;
        this._ = schema ? {
          schema: schema.schema,
          fullSchema: schema.fullSchema,
          tableNamesMap: schema.tableNamesMap,
          session
        } : {
          schema: void 0,
          fullSchema: {},
          tableNamesMap: {},
          session
        };
        this.query = {};
        if (this._.schema) {
          for (const [tableName, columns] of Object.entries(this._.schema)) {
            this.query[tableName] = new RelationalQueryBuilder(
              schema.fullSchema,
              this._.schema,
              this._.tableNamesMap,
              schema.fullSchema[tableName],
              columns,
              dialect,
              session
            );
          }
        }
        this.$cache = { invalidate: async (_params) => {
        } };
      }
      static [entityKind] = "PgDatabase";
      query;
      /**
       * Creates a subquery that defines a temporary named result set as a CTE.
       *
       * It is useful for breaking down complex queries into simpler parts and for reusing the result set in subsequent parts of the query.
       *
       * See docs: {@link https://orm.drizzle.team/docs/select#with-clause}
       *
       * @param alias The alias for the subquery.
       *
       * Failure to provide an alias will result in a DrizzleTypeError, preventing the subquery from being referenced in other queries.
       *
       * @example
       *
       * ```ts
       * // Create a subquery with alias 'sq' and use it in the select query
       * const sq = db.$with('sq').as(db.select().from(users).where(eq(users.id, 42)));
       *
       * const result = await db.with(sq).select().from(sq);
       * ```
       *
       * To select arbitrary SQL values as fields in a CTE and reference them in other CTEs or in the main query, you need to add aliases to them:
       *
       * ```ts
       * // Select an arbitrary SQL value as a field in a CTE and reference it in the main query
       * const sq = db.$with('sq').as(db.select({
       *   name: sql<string>`upper(${users.name})`.as('name'),
       * })
       * .from(users));
       *
       * const result = await db.with(sq).select({ name: sq.name }).from(sq);
       * ```
       */
      $with = (alias, selection) => {
        const self = this;
        const as = (qb) => {
          if (typeof qb === "function") {
            qb = qb(new QueryBuilder(self.dialect));
          }
          return new Proxy(
            new WithSubquery(
              qb.getSQL(),
              selection ?? ("getSelectedFields" in qb ? qb.getSelectedFields() ?? {} : {}),
              alias,
              true
            ),
            new SelectionProxyHandler({ alias, sqlAliasedBehavior: "alias", sqlBehavior: "error" })
          );
        };
        return { as };
      };
      $count(source, filters) {
        return new PgCountBuilder({ source, filters, session: this.session });
      }
      $cache;
      /**
       * Incorporates a previously defined CTE (using `$with`) into the main query.
       *
       * This method allows the main query to reference a temporary named result set.
       *
       * See docs: {@link https://orm.drizzle.team/docs/select#with-clause}
       *
       * @param queries The CTEs to incorporate into the main query.
       *
       * @example
       *
       * ```ts
       * // Define a subquery 'sq' as a CTE using $with
       * const sq = db.$with('sq').as(db.select().from(users).where(eq(users.id, 42)));
       *
       * // Incorporate the CTE 'sq' into the main query and select from it
       * const result = await db.with(sq).select().from(sq);
       * ```
       */
      with(...queries) {
        const self = this;
        function select(fields2) {
          return new PgSelectBuilder({
            fields: fields2 ?? void 0,
            session: self.session,
            dialect: self.dialect,
            withList: queries
          });
        }
        function selectDistinct(fields2) {
          return new PgSelectBuilder({
            fields: fields2 ?? void 0,
            session: self.session,
            dialect: self.dialect,
            withList: queries,
            distinct: true
          });
        }
        function selectDistinctOn(on, fields2) {
          return new PgSelectBuilder({
            fields: fields2 ?? void 0,
            session: self.session,
            dialect: self.dialect,
            withList: queries,
            distinct: { on }
          });
        }
        function update(table) {
          return new PgUpdateBuilder(table, self.session, self.dialect, queries);
        }
        function insert(table) {
          return new PgInsertBuilder(table, self.session, self.dialect, queries);
        }
        function delete_(table) {
          return new PgDeleteBase(table, self.session, self.dialect, queries);
        }
        return { select, selectDistinct, selectDistinctOn, update, insert, delete: delete_ };
      }
      select(fields2) {
        return new PgSelectBuilder({
          fields: fields2 ?? void 0,
          session: this.session,
          dialect: this.dialect
        });
      }
      selectDistinct(fields2) {
        return new PgSelectBuilder({
          fields: fields2 ?? void 0,
          session: this.session,
          dialect: this.dialect,
          distinct: true
        });
      }
      selectDistinctOn(on, fields2) {
        return new PgSelectBuilder({
          fields: fields2 ?? void 0,
          session: this.session,
          dialect: this.dialect,
          distinct: { on }
        });
      }
      /**
       * Creates an update query.
       *
       * Calling this method without `.where()` clause will update all rows in a table. The `.where()` clause specifies which rows should be updated.
       *
       * Use `.set()` method to specify which values to update.
       *
       * See docs: {@link https://orm.drizzle.team/docs/update}
       *
       * @param table The table to update.
       *
       * @example
       *
       * ```ts
       * // Update all rows in the 'cars' table
       * await db.update(cars).set({ color: 'red' });
       *
       * // Update rows with filters and conditions
       * await db.update(cars).set({ color: 'red' }).where(eq(cars.brand, 'BMW'));
       *
       * // Update with returning clause
       * const updatedCar: Car[] = await db.update(cars)
       *   .set({ color: 'red' })
       *   .where(eq(cars.id, 1))
       *   .returning();
       * ```
       */
      update(table) {
        return new PgUpdateBuilder(table, this.session, this.dialect);
      }
      /**
       * Creates an insert query.
       *
       * Calling this method will create new rows in a table. Use `.values()` method to specify which values to insert.
       *
       * See docs: {@link https://orm.drizzle.team/docs/insert}
       *
       * @param table The table to insert into.
       *
       * @example
       *
       * ```ts
       * // Insert one row
       * await db.insert(cars).values({ brand: 'BMW' });
       *
       * // Insert multiple rows
       * await db.insert(cars).values([{ brand: 'BMW' }, { brand: 'Porsche' }]);
       *
       * // Insert with returning clause
       * const insertedCar: Car[] = await db.insert(cars)
       *   .values({ brand: 'BMW' })
       *   .returning();
       * ```
       */
      insert(table) {
        return new PgInsertBuilder(table, this.session, this.dialect);
      }
      /**
       * Creates a delete query.
       *
       * Calling this method without `.where()` clause will delete all rows in a table. The `.where()` clause specifies which rows should be deleted.
       *
       * See docs: {@link https://orm.drizzle.team/docs/delete}
       *
       * @param table The table to delete from.
       *
       * @example
       *
       * ```ts
       * // Delete all rows in the 'cars' table
       * await db.delete(cars);
       *
       * // Delete rows with filters and conditions
       * await db.delete(cars).where(eq(cars.color, 'green'));
       *
       * // Delete with returning clause
       * const deletedCar: Car[] = await db.delete(cars)
       *   .where(eq(cars.id, 1))
       *   .returning();
       * ```
       */
      delete(table) {
        return new PgDeleteBase(table, this.session, this.dialect);
      }
      refreshMaterializedView(view) {
        return new PgRefreshMaterializedView(view, this.session, this.dialect);
      }
      authToken;
      execute(query2) {
        const sequel = typeof query2 === "string" ? sql.raw(query2) : query2.getSQL();
        const builtQuery = this.dialect.sqlToQuery(sequel);
        const prepared = this.session.prepareQuery(
          builtQuery,
          void 0,
          void 0,
          false
        );
        return new PgRaw(
          () => prepared.execute(void 0, this.authToken),
          sequel,
          builtQuery,
          (result) => prepared.mapResult(result, true)
        );
      }
      transaction(transaction, config) {
        return this.session.transaction(transaction, config);
      }
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/alias.js
var init_alias2 = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/alias.js"() {
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/roles.js
var PgRole;
var init_roles = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/roles.js"() {
    init_entity();
    PgRole = class {
      constructor(name, config) {
        this.name = name;
        if (config) {
          this.createDb = config.createDb;
          this.createRole = config.createRole;
          this.inherit = config.inherit;
        }
      }
      static [entityKind] = "PgRole";
      /** @internal */
      _existing;
      /** @internal */
      createDb;
      /** @internal */
      createRole;
      /** @internal */
      inherit;
      existing() {
        this._existing = true;
        return this;
      }
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/sequence.js
function pgSequenceWithSchema(name, options, schema) {
  return new PgSequence(name, options, schema);
}
var PgSequence;
var init_sequence = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/sequence.js"() {
    init_entity();
    PgSequence = class {
      constructor(seqName, seqOptions, schema) {
        this.seqName = seqName;
        this.seqOptions = seqOptions;
        this.schema = schema;
      }
      static [entityKind] = "PgSequence";
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/schema.js
var PgSchema;
var init_schema = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/schema.js"() {
    init_entity();
    init_sql();
    init_enum();
    init_sequence();
    init_table2();
    init_view();
    PgSchema = class {
      constructor(schemaName) {
        this.schemaName = schemaName;
      }
      static [entityKind] = "PgSchema";
      table = (name, columns, extraConfig) => {
        return pgTableWithSchema(name, columns, extraConfig, this.schemaName);
      };
      view = (name, columns) => {
        return pgViewWithSchema(name, columns, this.schemaName);
      };
      materializedView = (name, columns) => {
        return pgMaterializedViewWithSchema(name, columns, this.schemaName);
      };
      enum(enumName, input) {
        return Array.isArray(input) ? pgEnumWithSchema(
          enumName,
          [...input],
          this.schemaName
        ) : pgEnumObjectWithSchema(enumName, input, this.schemaName);
      }
      sequence = (name, options) => {
        return pgSequenceWithSchema(name, options, this.schemaName);
      };
      getSQL() {
        return new SQL([sql.identifier(this.schemaName)]);
      }
      shouldOmitSQLParens() {
        return true;
      }
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/cache/core/cache.js
async function hashQuery(sql2, params) {
  const dataToHash = `${sql2}-${JSON.stringify(params)}`;
  const encoder = new TextEncoder();
  const data2 = encoder.encode(dataToHash);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data2);
  const hashArray = [...new Uint8Array(hashBuffer)];
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return hashHex;
}
var Cache, NoopCache;
var init_cache = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/cache/core/cache.js"() {
    init_entity();
    Cache = class {
      static [entityKind] = "Cache";
    };
    NoopCache = class extends Cache {
      strategy() {
        return "all";
      }
      static [entityKind] = "NoopCache";
      async get(_key) {
        return void 0;
      }
      async put(_hashedQuery, _response, _tables, _config) {
      }
      async onMutate(_params) {
      }
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/session.js
var PgPreparedQuery, PgSession, PgTransaction;
var init_session = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/session.js"() {
    init_cache();
    init_entity();
    init_errors();
    init_sql2();
    init_tracing();
    init_db();
    PgPreparedQuery = class {
      constructor(query2, cache, queryMetadata, cacheConfig) {
        this.query = query2;
        this.cache = cache;
        this.queryMetadata = queryMetadata;
        this.cacheConfig = cacheConfig;
        if (cache && cache.strategy() === "all" && cacheConfig === void 0) {
          this.cacheConfig = { enable: true, autoInvalidate: true };
        }
        if (!this.cacheConfig?.enable) {
          this.cacheConfig = void 0;
        }
      }
      authToken;
      getQuery() {
        return this.query;
      }
      mapResult(response, _isFromBatch) {
        return response;
      }
      /** @internal */
      setToken(token) {
        this.authToken = token;
        return this;
      }
      static [entityKind] = "PgPreparedQuery";
      /** @internal */
      joinsNotNullableMap;
      /** @internal */
      async queryWithCache(queryString, params, query2) {
        if (this.cache === void 0 || is(this.cache, NoopCache) || this.queryMetadata === void 0) {
          try {
            return await query2();
          } catch (e) {
            throw new DrizzleQueryError(queryString, params, e);
          }
        }
        if (this.cacheConfig && !this.cacheConfig.enable) {
          try {
            return await query2();
          } catch (e) {
            throw new DrizzleQueryError(queryString, params, e);
          }
        }
        if ((this.queryMetadata.type === "insert" || this.queryMetadata.type === "update" || this.queryMetadata.type === "delete") && this.queryMetadata.tables.length > 0) {
          try {
            const [res] = await Promise.all([
              query2(),
              this.cache.onMutate({ tables: this.queryMetadata.tables })
            ]);
            return res;
          } catch (e) {
            throw new DrizzleQueryError(queryString, params, e);
          }
        }
        if (!this.cacheConfig) {
          try {
            return await query2();
          } catch (e) {
            throw new DrizzleQueryError(queryString, params, e);
          }
        }
        if (this.queryMetadata.type === "select") {
          const fromCache = await this.cache.get(
            this.cacheConfig.tag ?? await hashQuery(queryString, params),
            this.queryMetadata.tables,
            this.cacheConfig.tag !== void 0,
            this.cacheConfig.autoInvalidate
          );
          if (fromCache === void 0) {
            let result;
            try {
              result = await query2();
            } catch (e) {
              throw new DrizzleQueryError(queryString, params, e);
            }
            await this.cache.put(
              this.cacheConfig.tag ?? await hashQuery(queryString, params),
              result,
              // make sure we send tables that were used in a query only if user wants to invalidate it on each write
              this.cacheConfig.autoInvalidate ? this.queryMetadata.tables : [],
              this.cacheConfig.tag !== void 0,
              this.cacheConfig.config
            );
            return result;
          }
          return fromCache;
        }
        try {
          return await query2();
        } catch (e) {
          throw new DrizzleQueryError(queryString, params, e);
        }
      }
    };
    PgSession = class {
      constructor(dialect) {
        this.dialect = dialect;
      }
      static [entityKind] = "PgSession";
      /** @internal */
      execute(query2, token) {
        return tracer.startActiveSpan("drizzle.operation", () => {
          const prepared = tracer.startActiveSpan("drizzle.prepareQuery", () => {
            return this.prepareQuery(
              this.dialect.sqlToQuery(query2),
              void 0,
              void 0,
              false
            );
          });
          return prepared.setToken(token).execute(void 0, token);
        });
      }
      all(query2) {
        return this.prepareQuery(
          this.dialect.sqlToQuery(query2),
          void 0,
          void 0,
          false
        ).all();
      }
      /** @internal */
      async count(sql2, token) {
        const res = await this.execute(sql2, token);
        return Number(
          res[0]["count"]
        );
      }
    };
    PgTransaction = class extends PgDatabase {
      constructor(dialect, session, schema, nestedIndex = 0) {
        super(dialect, session, schema);
        this.schema = schema;
        this.nestedIndex = nestedIndex;
      }
      static [entityKind] = "PgTransaction";
      rollback() {
        throw new TransactionRollbackError();
      }
      /** @internal */
      getTransactionConfigSQL(config) {
        const chunks = [];
        if (config.isolationLevel) {
          chunks.push(`isolation level ${config.isolationLevel}`);
        }
        if (config.accessMode) {
          chunks.push(config.accessMode);
        }
        if (typeof config.deferrable === "boolean") {
          chunks.push(config.deferrable ? "deferrable" : "not deferrable");
        }
        return sql.raw(chunks.join(" "));
      }
      setTransaction(config) {
        return this.session.execute(sql`set transaction ${this.getTransactionConfigSQL(config)}`);
      }
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/subquery.js
var init_subquery2 = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/subquery.js"() {
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/utils/index.js
var init_utils4 = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/utils/index.js"() {
    init_array();
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/index.js
var init_pg_core = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pg-core/index.js"() {
    init_alias2();
    init_checks();
    init_columns();
    init_db();
    init_dialect();
    init_foreign_keys();
    init_indexes();
    init_policies();
    init_primary_keys();
    init_query_builders();
    init_roles();
    init_schema();
    init_sequence();
    init_session();
    init_subquery2();
    init_table2();
    init_unique_constraint();
    init_utils3();
    init_utils4();
    init_view_common2();
    init_view();
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pglite/session.js
import { types } from "@electric-sql/pglite";
var PglitePreparedQuery, PgliteSession, PgliteTransaction;
var init_session2 = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pglite/session.js"() {
    init_entity();
    init_logger();
    init_pg_core();
    init_session();
    init_sql();
    init_utils();
    init_cache();
    PglitePreparedQuery = class extends PgPreparedQuery {
      constructor(client, queryString, params, logger, cache, queryMetadata, cacheConfig, fields2, name, _isResponseInArrayMode, customResultMapper) {
        super({ sql: queryString, params }, cache, queryMetadata, cacheConfig);
        this.client = client;
        this.queryString = queryString;
        this.params = params;
        this.logger = logger;
        this.fields = fields2;
        this._isResponseInArrayMode = _isResponseInArrayMode;
        this.customResultMapper = customResultMapper;
        this.rawQueryConfig = {
          rowMode: "object",
          parsers: {
            [types.TIMESTAMP]: (value) => value,
            [types.TIMESTAMPTZ]: (value) => value,
            [types.INTERVAL]: (value) => value,
            [types.DATE]: (value) => value,
            // numeric[]
            [1231]: (value) => value,
            // timestamp[]
            [1115]: (value) => value,
            // timestamp with timezone[]
            [1185]: (value) => value,
            // interval[]
            [1187]: (value) => value,
            // date[]
            [1182]: (value) => value
          }
        };
        this.queryConfig = {
          rowMode: "array",
          parsers: {
            [types.TIMESTAMP]: (value) => value,
            [types.TIMESTAMPTZ]: (value) => value,
            [types.INTERVAL]: (value) => value,
            [types.DATE]: (value) => value,
            // numeric[]
            [1231]: (value) => value,
            // timestamp[]
            [1115]: (value) => value,
            // timestamp with timezone[]
            [1185]: (value) => value,
            // interval[]
            [1187]: (value) => value,
            // date[]
            [1182]: (value) => value
          }
        };
      }
      static [entityKind] = "PglitePreparedQuery";
      rawQueryConfig;
      queryConfig;
      async execute(placeholderValues = {}) {
        const params = fillPlaceholders(this.params, placeholderValues);
        this.logger.logQuery(this.queryString, params);
        const { fields: fields2, client, queryConfig, joinsNotNullableMap, customResultMapper, queryString, rawQueryConfig } = this;
        if (!fields2 && !customResultMapper) {
          return this.queryWithCache(queryString, params, async () => {
            return await client.query(queryString, params, rawQueryConfig);
          });
        }
        const result = await this.queryWithCache(queryString, params, async () => {
          return await client.query(queryString, params, queryConfig);
        });
        return customResultMapper ? customResultMapper(result.rows) : result.rows.map((row) => mapResultRow(fields2, row, joinsNotNullableMap));
      }
      all(placeholderValues = {}) {
        const params = fillPlaceholders(this.params, placeholderValues);
        this.logger.logQuery(this.queryString, params);
        return this.queryWithCache(this.queryString, params, async () => {
          return await this.client.query(this.queryString, params, this.rawQueryConfig);
        }).then((result) => result.rows);
      }
      /** @internal */
      isResponseInArrayMode() {
        return this._isResponseInArrayMode;
      }
    };
    PgliteSession = class _PgliteSession extends PgSession {
      constructor(client, dialect, schema, options = {}) {
        super(dialect);
        this.client = client;
        this.schema = schema;
        this.options = options;
        this.logger = options.logger ?? new NoopLogger();
        this.cache = options.cache ?? new NoopCache();
      }
      static [entityKind] = "PgliteSession";
      logger;
      cache;
      prepareQuery(query2, fields2, name, isResponseInArrayMode, customResultMapper, queryMetadata, cacheConfig) {
        return new PglitePreparedQuery(
          this.client,
          query2.sql,
          query2.params,
          this.logger,
          this.cache,
          queryMetadata,
          cacheConfig,
          fields2,
          name,
          isResponseInArrayMode,
          customResultMapper
        );
      }
      async transaction(transaction, config) {
        return this.client.transaction(async (client) => {
          const session = new _PgliteSession(
            client,
            this.dialect,
            this.schema,
            this.options
          );
          const tx = new PgliteTransaction(this.dialect, session, this.schema);
          if (config) {
            await tx.setTransaction(config);
          }
          return transaction(tx);
        });
      }
      async count(sql2) {
        const res = await this.execute(sql2);
        return Number(
          res["rows"][0]["count"]
        );
      }
    };
    PgliteTransaction = class _PgliteTransaction extends PgTransaction {
      static [entityKind] = "PgliteTransaction";
      async transaction(transaction) {
        const savepointName = `sp${this.nestedIndex + 1}`;
        const tx = new _PgliteTransaction(
          this.dialect,
          this.session,
          this.schema,
          this.nestedIndex + 1
        );
        await tx.execute(sql.raw(`savepoint ${savepointName}`));
        try {
          const result = await transaction(tx);
          await tx.execute(sql.raw(`release savepoint ${savepointName}`));
          return result;
        } catch (err) {
          await tx.execute(sql.raw(`rollback to savepoint ${savepointName}`));
          throw err;
        }
      }
    };
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pglite/driver.js
import { PGlite } from "@electric-sql/pglite";
function construct(client, config = {}) {
  const dialect = new PgDialect({ casing: config.casing });
  let logger;
  if (config.logger === true) {
    logger = new DefaultLogger();
  } else if (config.logger !== false) {
    logger = config.logger;
  }
  let schema;
  if (config.schema) {
    const tablesConfig = extractTablesRelationalConfig(
      config.schema,
      createTableRelationsHelpers
    );
    schema = {
      fullSchema: config.schema,
      schema: tablesConfig.tables,
      tableNamesMap: tablesConfig.tableNamesMap
    };
  }
  const driver = new PgliteDriver(client, dialect, { logger, cache: config.cache });
  const session = driver.createSession(schema);
  const db2 = new PgliteDatabase(dialect, session, schema);
  db2.$client = client;
  db2.$cache = config.cache;
  if (db2.$cache) {
    db2.$cache["invalidate"] = config.cache?.onMutate;
  }
  return db2;
}
function drizzle(...params) {
  if (params[0] === void 0 || typeof params[0] === "string") {
    const instance = new PGlite(params[0]);
    return construct(instance, params[1]);
  }
  if (isConfig(params[0])) {
    const { connection, client, ...drizzleConfig } = params[0];
    if (client) return construct(client, drizzleConfig);
    if (typeof connection === "object") {
      const { dataDir, ...options } = connection;
      const instance2 = new PGlite(dataDir, options);
      return construct(instance2, drizzleConfig);
    }
    const instance = new PGlite(connection);
    return construct(instance, drizzleConfig);
  }
  return construct(params[0], params[1]);
}
var PgliteDriver, PgliteDatabase;
var init_driver = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pglite/driver.js"() {
    init_entity();
    init_logger();
    init_db();
    init_dialect();
    init_relations();
    init_utils();
    init_session2();
    PgliteDriver = class {
      constructor(client, dialect, options = {}) {
        this.client = client;
        this.dialect = dialect;
        this.options = options;
      }
      static [entityKind] = "PgliteDriver";
      createSession(schema) {
        return new PgliteSession(this.client, this.dialect, schema, {
          logger: this.options.logger,
          cache: this.options.cache
        });
      }
    };
    PgliteDatabase = class extends PgDatabase {
      static [entityKind] = "PgliteDatabase";
    };
    ((drizzle2) => {
      function mock(config) {
        return construct({}, config);
      }
      drizzle2.mock = mock;
    })(drizzle || (drizzle = {}));
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pglite/index.js
var init_pglite = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/pglite/index.js"() {
    init_driver();
    init_session2();
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/operations.js
var init_operations = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/operations.js"() {
  }
});

// ../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/index.js
var init_drizzle_orm = __esm({
  "../../node_modules/.pnpm/drizzle-orm@0.45.2_@electric-sql+pglite@0.5.8_@types+pg@8.23.1_pg@8.23.0/node_modules/drizzle-orm/index.js"() {
    init_alias();
    init_column_builder();
    init_column();
    init_entity();
    init_errors();
    init_logger();
    init_operations();
    init_query_promise();
    init_relations();
    init_sql2();
    init_subquery();
    init_table();
    init_utils();
    init_view_common();
  }
});

// ../../lib/db/src/schema/core.ts
var id, data, created, users, clinics, branches, assignments, masters, doctors, patients, schedules, availabilityExceptions, appointments, appointmentHistory, guestRequests, qrs, auditLogs, settings, integrationCredentials, otpChallenges, staffSessionProofs, authSessions, authChallenges, authRateLimits, notificationReads, patientDocuments, savedViews;
var init_core = __esm({
  "../../lib/db/src/schema/core.ts"() {
    "use strict";
    init_pg_core();
    init_drizzle_orm();
    id = () => text("id").primaryKey();
    data = () => jsonb("data").$type().notNull().default({});
    created = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
    users = pgTable("users", {
      id: id(),
      clerkId: text("clerk_id").unique(),
      email: text("email").notNull().unique(),
      passwordHash: text("password_hash"),
      emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
      passwordChangedAt: timestamp("password_changed_at", { withTimezone: true }),
      fullName: text("full_name").notNull(),
      mobile: text("mobile"),
      role: text("role").notNull(),
      managingAdminId: text("managing_admin_id").references(() => users.id),
      invitationStatus: text("invitation_status").notNull().default("failed"),
      status: text("status").notNull().default("active"),
      data: data(),
      createdAt: created()
    }, (t) => [
      index("user_managing_admin_idx").on(t.managingAdminId),
      check("users_role", sql`${t.role} in ('superAdmin','clinicAdmin','doctor','receptionist','patient')`),
      check("users_managing_admin_role", sql`${t.managingAdminId} is null or ${t.role} = 'receptionist'`),
      check("users_invitation_status", sql`${t.invitationStatus} in ('sent','failed','notRequired')`)
    ]);
    clinics = pgTable("clinics", {
      id: id(),
      ownerId: text("owner_id").references(() => users.id),
      adminId: text("admin_id").notNull().references(() => users.id),
      // Display preferences belong to the parent, in the existing settings document.
      // Keeping these additive JSON fields avoids missing-column failures before migration.
      status: text("status").notNull().default("active"),
      data: jsonb("data").$type().notNull().default({}),
      createdAt: created()
    }, (t) => [index("clinic_owner_idx").on(t.ownerId), index("clinic_admin_idx").on(t.adminId), uniqueIndex("clinic_name_unique").on(sql`lower(${t.data}->>'name')`), uniqueIndex("clinic_slug_unique").on(sql`(${t.data}->>'slug')`)]);
    branches = pgTable("branches", {
      id: id(),
      clinicId: text("clinic_id").notNull().references(() => clinics.id),
      status: text("status").notNull().default("active"),
      data: data(),
      createdAt: created()
    }, (t) => [
      index("branch_clinic_idx").on(t.clinicId),
      uniqueIndex("branch_id_clinic_unique").on(t.id, t.clinicId),
      uniqueIndex("branch_name_clinic_unique").on(t.clinicId, sql`lower(${t.data}->>'name')`),
      uniqueIndex("branch_slug_clinic_unique").on(t.clinicId, sql`(${t.data}->>'slug')`)
    ]);
    assignments = pgTable("assignments", {
      id: id(),
      userId: text("user_id").notNull().references(() => users.id),
      clinicId: text("clinic_id").notNull().references(() => clinics.id),
      branchId: text("branch_id").references(() => branches.id)
    }, (t) => [
      index("assignment_user_idx").on(t.userId),
      index("assignment_scope_idx").on(t.clinicId, t.branchId),
      uniqueIndex("assignment_user_clinic_only_unique").on(t.userId, t.clinicId).where(sql`${t.branchId} is null`),
      uniqueIndex("assignment_user_branch_unique").on(t.userId, t.branchId).where(sql`${t.branchId} is not null`),
      foreignKey({ columns: [t.branchId, t.clinicId], foreignColumns: [branches.id, branches.clinicId], name: "assignment_branch_clinic_fk" })
    ]);
    masters = pgTable("masters", {
      id: id(),
      category: text("category").notNull(),
      code: text("code").notNull(),
      parentId: text("parent_id").references(() => masters.id),
      status: text("status").notNull().default("active"),
      data: data()
    }, (t) => [uniqueIndex("master_category_code").on(t.category, t.code)]);
    doctors = pgTable("doctors", {
      id: id(),
      userId: text("user_id").notNull().unique().references(() => users.id),
      ownerAdminId: text("owner_admin_id").notNull().references(() => users.id),
      specializationId: text("specialization_id").references(() => masters.id),
      status: text("status").notNull().default("active"),
      data: data(),
      createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
    }, (t) => [index("doctor_owner_admin_idx").on(t.ownerAdminId)]);
    patients = pgTable("patients", {
      id: id(),
      userId: text("user_id").unique().references(() => users.id),
      clinicId: text("clinic_id").references(() => clinics.id),
      branchId: text("branch_id").references(() => branches.id),
      mobile: text("mobile"),
      mobileVerified: boolean("mobile_verified").notNull().default(false),
      status: text("status").notNull().default("active"),
      data: data(),
      createdAt: created()
    }, (t) => [index("patient_scope_idx").on(t.clinicId, t.branchId), index("patient_mobile_idx").on(t.mobile)]);
    schedules = pgTable("schedules", {
      id: id(),
      doctorId: text("doctor_id").notNull().references(() => doctors.id),
      clinicId: text("clinic_id").notNull().references(() => clinics.id),
      branchId: text("branch_id").notNull().references(() => branches.id),
      dayOfWeek: integer("day_of_week").notNull(),
      status: text("status").notNull().default("active"),
      data: data()
    }, (t) => [
      index("schedule_lookup_idx").on(t.doctorId, t.branchId, t.dayOfWeek),
      uniqueIndex("schedule_active_location_day_unique").on(t.doctorId, t.branchId, t.dayOfWeek, sql`(${t.data}->>'startTime')`).where(sql`${t.status} = 'active'`),
      check("schedule_weekday", sql`${t.dayOfWeek} between 0 and 6`)
    ]);
    availabilityExceptions = pgTable("availability_exceptions", {
      id: id(),
      doctorId: text("doctor_id").notNull().references(() => doctors.id),
      branchId: text("branch_id").notNull().references(() => branches.id),
      date: text("date").notNull(),
      status: text("status").notNull().default("active"),
      data: data()
    }, (t) => [uniqueIndex("exception_date_idx").on(t.doctorId, t.branchId, t.date, sql`coalesce(${t.data}->>'sessionId','')`)]);
    appointments = pgTable("appointments", {
      id: id(),
      patientId: text("patient_id").notNull().references(() => patients.id),
      doctorId: text("doctor_id").notNull().references(() => doctors.id),
      clinicId: text("clinic_id").notNull().references(() => clinics.id),
      branchId: text("branch_id").notNull().references(() => branches.id),
      date: text("date").notNull(),
      tokenNumber: integer("token_number").notNull(),
      status: text("status").notNull().default("booked"),
      requestId: text("request_id"),
      actorId: text("actor_id").notNull().references(() => users.id),
      data: data(),
      createdAt: created()
    }, (t) => [
      uniqueIndex("appointment_token_idx").on(t.doctorId, t.branchId, t.date, sql`coalesce(${t.data}->>'startTime','')`, t.tokenNumber),
      uniqueIndex("appointment_request_idx").on(t.actorId, t.requestId),
      uniqueIndex("appointment_reference_idx").on(sql`(${t.data}->>'reference')`),
      index("appointment_patient_idx").on(t.patientId),
      index("appointment_scope_idx").on(t.clinicId, t.branchId, t.date),
      uniqueIndex("appointment_active_patient_idx").on(t.patientId, t.doctorId, t.branchId, t.date, sql`coalesce(${t.data}->>'startTime','')`).where(sql`${t.status} not in ('cancelled','completed','noShow')`),
      uniqueIndex("appointment_one_consult_idx").on(t.doctorId, t.branchId, t.date, sql`coalesce(${t.data}->>'startTime','')`).where(sql`${t.status} in ('called','inConsultation')`),
      check("appointment_status_check", sql`${t.status} in ('booked','checkedIn','waiting','called','inConsultation','completed','noShow','cancelled')`),
      check("appointment_token_positive", sql`${t.tokenNumber} > 0`)
    ]);
    appointmentHistory = pgTable("appointment_history", {
      id: id(),
      appointmentId: text("appointment_id").notNull().references(() => appointments.id),
      actorId: text("actor_id").notNull().references(() => users.id),
      fromStatus: text("from_status"),
      toStatus: text("to_status").notNull(),
      createdAt: created()
    }, (t) => [index("history_appointment_idx").on(t.appointmentId)]);
    guestRequests = pgTable("guest_requests", {
      id: id(),
      requestId: text("request_id").notNull().unique(),
      receiptHash: text("receipt_hash").notNull().unique(),
      inputHash: text("input_hash").notNull(),
      clinicId: text("clinic_id").notNull().references(() => clinics.id),
      branchId: text("branch_id").notNull().references(() => branches.id),
      doctorId: text("doctor_id").notNull().references(() => doctors.id),
      date: text("date").notNull(),
      status: text("status").notNull().default("pending"),
      appointmentId: text("appointment_id").unique().references(() => appointments.id),
      decidedBy: text("decided_by").references(() => users.id),
      data: data(),
      createdAt: created()
    }, (t) => [
      index("guest_request_scope_idx").on(t.clinicId, t.branchId, t.status),
      check("guest_request_status", sql`${t.status} in ('pending','confirmed','rejected')`)
    ]);
    qrs = pgTable("qrs", {
      id: id(),
      clinicId: text("clinic_id").notNull().references(() => clinics.id),
      branchId: text("branch_id").references(() => branches.id),
      doctorId: text("doctor_id").references(() => doctors.id),
      publicReference: text("public_reference").notNull().unique(),
      status: text("status").notNull().default("active"),
      data: data(),
      createdAt: created()
    }, (t) => [index("qr_scope_idx").on(t.clinicId, t.branchId)]);
    auditLogs = pgTable("audit_logs", {
      id: id(),
      actorId: text("actor_id").references(() => users.id),
      clinicId: text("clinic_id").references(() => clinics.id),
      branchId: text("branch_id").references(() => branches.id),
      action: text("action").notNull(),
      entityType: text("entity_type").notNull(),
      entityId: text("entity_id").notNull(),
      summary: text("summary").notNull(),
      createdAt: created()
    }, (t) => [index("audit_scope_idx").on(t.clinicId, t.branchId, t.createdAt)]);
    settings = pgTable("settings", { id: id(), data: data() });
    integrationCredentials = pgTable("integration_credentials", {
      provider: text("provider").primaryKey(),
      encrypted: text("encrypted").notNull(),
      revision: text("revision").notNull()
    });
    otpChallenges = pgTable("otp_challenges", {
      id: id(),
      userId: text("user_id").notNull().references(() => users.id),
      mobile: text("mobile").notNull(),
      codeHash: text("code_hash").notNull(),
      expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
      attempts: integer("attempts").notNull().default(0),
      consumedAt: timestamp("consumed_at", { withTimezone: true }),
      createdAt: created()
    }, (t) => [index("otp_user_idx").on(t.userId, t.createdAt)]);
    staffSessionProofs = pgTable("staff_session_proofs", {
      sessionId: text("session_id").primaryKey(),
      clerkUserId: text("clerk_user_id").notNull(),
      expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
      createdAt: created()
    }, (t) => [
      index("staff_session_proof_user_idx").on(t.clerkUserId),
      index("staff_session_proof_expiry_idx").on(t.expiresAt)
    ]);
    authSessions = pgTable("auth_sessions", {
      tokenHash: text("token_hash").primaryKey(),
      userId: text("user_id").notNull().references(() => users.id),
      expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
      revokedAt: timestamp("revoked_at", { withTimezone: true }),
      createdAt: created()
    }, (t) => [index("auth_session_user_idx").on(t.userId), index("auth_session_expiry_idx").on(t.expiresAt)]);
    authChallenges = pgTable("auth_challenges", {
      id: id(),
      userId: text("user_id").references(() => users.id),
      email: text("email").notNull(),
      purpose: text("purpose").notNull(),
      tokenHash: text("token_hash").notNull(),
      data: data(),
      attempts: integer("attempts").notNull().default(0),
      expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
      consumedAt: timestamp("consumed_at", { withTimezone: true }),
      createdAt: created()
    }, (t) => [index("auth_challenge_email_idx").on(t.email, t.purpose), index("auth_challenge_expiry_idx").on(t.expiresAt)]);
    authRateLimits = pgTable("auth_rate_limits", {
      key: text("key").primaryKey(),
      attempts: integer("attempts").notNull().default(0),
      expiresAt: timestamp("expires_at", { withTimezone: true }).notNull()
    }, (t) => [index("auth_rate_limit_expiry_idx").on(t.expiresAt)]);
    notificationReads = pgTable("notification_reads", {
      userId: text("user_id").notNull().references(() => users.id),
      notificationId: text("notification_id").notNull(),
      readAt: timestamp("read_at", { withTimezone: true }).notNull().defaultNow()
    }, (t) => [primaryKey({ columns: [t.userId, t.notificationId] })]);
    patientDocuments = pgTable("patient_documents", {
      id: id(),
      patientId: text("patient_id").notNull().references(() => patients.id),
      clinicId: text("clinic_id").notNull().references(() => clinics.id),
      uploadedBy: text("uploaded_by").notNull().references(() => users.id),
      name: text("name").notNull(),
      contentType: text("content_type").notNull(),
      size: integer("size").notNull(),
      provider: text("provider").notNull(),
      storageKey: text("storage_key").notNull(),
      status: text("status").notNull().default("active"),
      createdAt: created(),
      deletedAt: timestamp("deleted_at", { withTimezone: true })
    }, (t) => [index("patient_document_patient_idx").on(t.patientId, t.clinicId)]);
    savedViews = pgTable("saved_views", {
      id: id(),
      userId: text("user_id").notNull().references(() => users.id),
      tableKey: text("table_key").notNull(),
      name: text("name").notNull(),
      data: data(),
      sharedRole: text("shared_role"),
      clinicIds: jsonb("clinic_ids").$type().notNull().default([]),
      createdAt: created()
    }, (t) => [index("saved_view_owner_idx").on(t.userId, t.tableKey), index("saved_view_shared_idx").on(t.sharedRole, t.tableKey)]);
  }
});

// ../../lib/db/src/schema/index.ts
var schema_exports = {};
__export(schema_exports, {
  appointmentHistory: () => appointmentHistory,
  appointments: () => appointments,
  assignments: () => assignments,
  auditLogs: () => auditLogs,
  authChallenges: () => authChallenges,
  authRateLimits: () => authRateLimits,
  authSessions: () => authSessions,
  availabilityExceptions: () => availabilityExceptions,
  branches: () => branches,
  clinics: () => clinics,
  doctors: () => doctors,
  guestRequests: () => guestRequests,
  integrationCredentials: () => integrationCredentials,
  masters: () => masters,
  notificationReads: () => notificationReads,
  otpChallenges: () => otpChallenges,
  patientDocuments: () => patientDocuments,
  patients: () => patients,
  qrs: () => qrs,
  savedViews: () => savedViews,
  schedules: () => schedules,
  settings: () => settings,
  staffSessionProofs: () => staffSessionProofs,
  users: () => users
});
var init_schema2 = __esm({
  "../../lib/db/src/schema/index.ts"() {
    "use strict";
    init_core();
  }
});

// pglite-db:db
var db;
var init_db2 = __esm({
  "pglite-db:db"() {
    init_pglite();
    init_schema2();
    init_schema2();
    db = drizzle(globalThis.__featurePglite, { schema: schema_exports });
  }
});

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/helpers/util.js
var util, objectUtil, ZodParsedType, getParsedType;
var init_util = __esm({
  "../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/helpers/util.js"() {
    (function(util2) {
      util2.assertEqual = (_) => {
      };
      function assertIs(_arg) {
      }
      util2.assertIs = assertIs;
      function assertNever(_x) {
        throw new Error();
      }
      util2.assertNever = assertNever;
      util2.arrayToEnum = (items) => {
        const obj = {};
        for (const item of items) {
          obj[item] = item;
        }
        return obj;
      };
      util2.getValidEnumValues = (obj) => {
        const validKeys = util2.objectKeys(obj).filter((k) => typeof obj[obj[k]] !== "number");
        const filtered2 = {};
        for (const k of validKeys) {
          filtered2[k] = obj[k];
        }
        return util2.objectValues(filtered2);
      };
      util2.objectValues = (obj) => {
        return util2.objectKeys(obj).map(function(e) {
          return obj[e];
        });
      };
      util2.objectKeys = typeof Object.keys === "function" ? (obj) => Object.keys(obj) : (object) => {
        const keys = [];
        for (const key2 in object) {
          if (Object.prototype.hasOwnProperty.call(object, key2)) {
            keys.push(key2);
          }
        }
        return keys;
      };
      util2.find = (arr, checker) => {
        for (const item of arr) {
          if (checker(item))
            return item;
        }
        return void 0;
      };
      util2.isInteger = typeof Number.isInteger === "function" ? (val) => Number.isInteger(val) : (val) => typeof val === "number" && Number.isFinite(val) && Math.floor(val) === val;
      function joinValues(array, separator = " | ") {
        return array.map((val) => typeof val === "string" ? `'${val}'` : val).join(separator);
      }
      util2.joinValues = joinValues;
      util2.jsonStringifyReplacer = (_, value) => {
        if (typeof value === "bigint") {
          return value.toString();
        }
        return value;
      };
    })(util || (util = {}));
    (function(objectUtil2) {
      objectUtil2.mergeShapes = (first, second) => {
        return {
          ...first,
          ...second
          // second overwrites first
        };
      };
    })(objectUtil || (objectUtil = {}));
    ZodParsedType = util.arrayToEnum([
      "string",
      "nan",
      "number",
      "integer",
      "float",
      "boolean",
      "date",
      "bigint",
      "symbol",
      "function",
      "undefined",
      "null",
      "array",
      "object",
      "unknown",
      "promise",
      "void",
      "never",
      "map",
      "set"
    ]);
    getParsedType = (data2) => {
      const t = typeof data2;
      switch (t) {
        case "undefined":
          return ZodParsedType.undefined;
        case "string":
          return ZodParsedType.string;
        case "number":
          return Number.isNaN(data2) ? ZodParsedType.nan : ZodParsedType.number;
        case "boolean":
          return ZodParsedType.boolean;
        case "function":
          return ZodParsedType.function;
        case "bigint":
          return ZodParsedType.bigint;
        case "symbol":
          return ZodParsedType.symbol;
        case "object":
          if (Array.isArray(data2)) {
            return ZodParsedType.array;
          }
          if (data2 === null) {
            return ZodParsedType.null;
          }
          if (data2.then && typeof data2.then === "function" && data2.catch && typeof data2.catch === "function") {
            return ZodParsedType.promise;
          }
          if (typeof Map !== "undefined" && data2 instanceof Map) {
            return ZodParsedType.map;
          }
          if (typeof Set !== "undefined" && data2 instanceof Set) {
            return ZodParsedType.set;
          }
          if (typeof Date !== "undefined" && data2 instanceof Date) {
            return ZodParsedType.date;
          }
          return ZodParsedType.object;
        default:
          return ZodParsedType.unknown;
      }
    };
  }
});

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/ZodError.js
var ZodIssueCode, quotelessJson, ZodError;
var init_ZodError = __esm({
  "../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/ZodError.js"() {
    init_util();
    ZodIssueCode = util.arrayToEnum([
      "invalid_type",
      "invalid_literal",
      "custom",
      "invalid_union",
      "invalid_union_discriminator",
      "invalid_enum_value",
      "unrecognized_keys",
      "invalid_arguments",
      "invalid_return_type",
      "invalid_date",
      "invalid_string",
      "too_small",
      "too_big",
      "invalid_intersection_types",
      "not_multiple_of",
      "not_finite"
    ]);
    quotelessJson = (obj) => {
      const json2 = JSON.stringify(obj, null, 2);
      return json2.replace(/"([^"]+)":/g, "$1:");
    };
    ZodError = class _ZodError extends Error {
      get errors() {
        return this.issues;
      }
      constructor(issues) {
        super();
        this.issues = [];
        this.addIssue = (sub) => {
          this.issues = [...this.issues, sub];
        };
        this.addIssues = (subs = []) => {
          this.issues = [...this.issues, ...subs];
        };
        const actualProto = new.target.prototype;
        if (Object.setPrototypeOf) {
          Object.setPrototypeOf(this, actualProto);
        } else {
          this.__proto__ = actualProto;
        }
        this.name = "ZodError";
        this.issues = issues;
      }
      format(_mapper) {
        const mapper = _mapper || function(issue) {
          return issue.message;
        };
        const fieldErrors = { _errors: [] };
        const processError = (error) => {
          for (const issue of error.issues) {
            if (issue.code === "invalid_union") {
              issue.unionErrors.map(processError);
            } else if (issue.code === "invalid_return_type") {
              processError(issue.returnTypeError);
            } else if (issue.code === "invalid_arguments") {
              processError(issue.argumentsError);
            } else if (issue.path.length === 0) {
              fieldErrors._errors.push(mapper(issue));
            } else {
              let curr = fieldErrors;
              let i = 0;
              while (i < issue.path.length) {
                const el = issue.path[i];
                const terminal = i === issue.path.length - 1;
                if (!terminal) {
                  curr[el] = curr[el] || { _errors: [] };
                } else {
                  curr[el] = curr[el] || { _errors: [] };
                  curr[el]._errors.push(mapper(issue));
                }
                curr = curr[el];
                i++;
              }
            }
          }
        };
        processError(this);
        return fieldErrors;
      }
      static assert(value) {
        if (!(value instanceof _ZodError)) {
          throw new Error(`Not a ZodError: ${value}`);
        }
      }
      toString() {
        return this.message;
      }
      get message() {
        return JSON.stringify(this.issues, util.jsonStringifyReplacer, 2);
      }
      get isEmpty() {
        return this.issues.length === 0;
      }
      flatten(mapper = (issue) => issue.message) {
        const fieldErrors = {};
        const formErrors = [];
        for (const sub of this.issues) {
          if (sub.path.length > 0) {
            const firstEl = sub.path[0];
            fieldErrors[firstEl] = fieldErrors[firstEl] || [];
            fieldErrors[firstEl].push(mapper(sub));
          } else {
            formErrors.push(mapper(sub));
          }
        }
        return { formErrors, fieldErrors };
      }
      get formErrors() {
        return this.flatten();
      }
    };
    ZodError.create = (issues) => {
      const error = new ZodError(issues);
      return error;
    };
  }
});

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/locales/en.js
var errorMap, en_default;
var init_en = __esm({
  "../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/locales/en.js"() {
    init_ZodError();
    init_util();
    errorMap = (issue, _ctx) => {
      let message;
      switch (issue.code) {
        case ZodIssueCode.invalid_type:
          if (issue.received === ZodParsedType.undefined) {
            message = "Required";
          } else {
            message = `Expected ${issue.expected}, received ${issue.received}`;
          }
          break;
        case ZodIssueCode.invalid_literal:
          message = `Invalid literal value, expected ${JSON.stringify(issue.expected, util.jsonStringifyReplacer)}`;
          break;
        case ZodIssueCode.unrecognized_keys:
          message = `Unrecognized key(s) in object: ${util.joinValues(issue.keys, ", ")}`;
          break;
        case ZodIssueCode.invalid_union:
          message = `Invalid input`;
          break;
        case ZodIssueCode.invalid_union_discriminator:
          message = `Invalid discriminator value. Expected ${util.joinValues(issue.options)}`;
          break;
        case ZodIssueCode.invalid_enum_value:
          message = `Invalid enum value. Expected ${util.joinValues(issue.options)}, received '${issue.received}'`;
          break;
        case ZodIssueCode.invalid_arguments:
          message = `Invalid function arguments`;
          break;
        case ZodIssueCode.invalid_return_type:
          message = `Invalid function return type`;
          break;
        case ZodIssueCode.invalid_date:
          message = `Invalid date`;
          break;
        case ZodIssueCode.invalid_string:
          if (typeof issue.validation === "object") {
            if ("includes" in issue.validation) {
              message = `Invalid input: must include "${issue.validation.includes}"`;
              if (typeof issue.validation.position === "number") {
                message = `${message} at one or more positions greater than or equal to ${issue.validation.position}`;
              }
            } else if ("startsWith" in issue.validation) {
              message = `Invalid input: must start with "${issue.validation.startsWith}"`;
            } else if ("endsWith" in issue.validation) {
              message = `Invalid input: must end with "${issue.validation.endsWith}"`;
            } else {
              util.assertNever(issue.validation);
            }
          } else if (issue.validation !== "regex") {
            message = `Invalid ${issue.validation}`;
          } else {
            message = "Invalid";
          }
          break;
        case ZodIssueCode.too_small:
          if (issue.type === "array")
            message = `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`;
          else if (issue.type === "string")
            message = `String must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`;
          else if (issue.type === "number")
            message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
          else if (issue.type === "bigint")
            message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
          else if (issue.type === "date")
            message = `Date must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(issue.minimum))}`;
          else
            message = "Invalid input";
          break;
        case ZodIssueCode.too_big:
          if (issue.type === "array")
            message = `Array must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`;
          else if (issue.type === "string")
            message = `String must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`;
          else if (issue.type === "number")
            message = `Number must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
          else if (issue.type === "bigint")
            message = `BigInt must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
          else if (issue.type === "date")
            message = `Date must be ${issue.exact ? `exactly` : issue.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(issue.maximum))}`;
          else
            message = "Invalid input";
          break;
        case ZodIssueCode.custom:
          message = `Invalid input`;
          break;
        case ZodIssueCode.invalid_intersection_types:
          message = `Intersection results could not be merged`;
          break;
        case ZodIssueCode.not_multiple_of:
          message = `Number must be a multiple of ${issue.multipleOf}`;
          break;
        case ZodIssueCode.not_finite:
          message = "Number must be finite";
          break;
        default:
          message = _ctx.defaultError;
          util.assertNever(issue);
      }
      return { message };
    };
    en_default = errorMap;
  }
});

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/errors.js
function setErrorMap(map) {
  overrideErrorMap = map;
}
function getErrorMap() {
  return overrideErrorMap;
}
var overrideErrorMap;
var init_errors2 = __esm({
  "../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/errors.js"() {
    init_en();
    overrideErrorMap = en_default;
  }
});

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/helpers/parseUtil.js
function addIssueToContext(ctx, issueData) {
  const overrideMap = getErrorMap();
  const issue = makeIssue({
    issueData,
    data: ctx.data,
    path: ctx.path,
    errorMaps: [
      ctx.common.contextualErrorMap,
      // contextual error map is first priority
      ctx.schemaErrorMap,
      // then schema-bound map if available
      overrideMap,
      // then global override map
      overrideMap === en_default ? void 0 : en_default
      // then global default map
    ].filter((x) => !!x)
  });
  ctx.common.issues.push(issue);
}
var makeIssue, EMPTY_PATH, ParseStatus, INVALID, DIRTY, OK, isAborted, isDirty, isValid, isAsync;
var init_parseUtil = __esm({
  "../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/helpers/parseUtil.js"() {
    init_errors2();
    init_en();
    makeIssue = (params) => {
      const { data: data2, path, errorMaps, issueData } = params;
      const fullPath = [...path, ...issueData.path || []];
      const fullIssue = {
        ...issueData,
        path: fullPath
      };
      if (issueData.message !== void 0) {
        return {
          ...issueData,
          path: fullPath,
          message: issueData.message
        };
      }
      let errorMessage = "";
      const maps = errorMaps.filter((m) => !!m).slice().reverse();
      for (const map of maps) {
        errorMessage = map(fullIssue, { data: data2, defaultError: errorMessage }).message;
      }
      return {
        ...issueData,
        path: fullPath,
        message: errorMessage
      };
    };
    EMPTY_PATH = [];
    ParseStatus = class _ParseStatus {
      constructor() {
        this.value = "valid";
      }
      dirty() {
        if (this.value === "valid")
          this.value = "dirty";
      }
      abort() {
        if (this.value !== "aborted")
          this.value = "aborted";
      }
      static mergeArray(status, results) {
        const arrayValue = [];
        for (const s of results) {
          if (s.status === "aborted")
            return INVALID;
          if (s.status === "dirty")
            status.dirty();
          arrayValue.push(s.value);
        }
        return { status: status.value, value: arrayValue };
      }
      static async mergeObjectAsync(status, pairs) {
        const syncPairs = [];
        for (const pair of pairs) {
          const key2 = await pair.key;
          const value = await pair.value;
          syncPairs.push({
            key: key2,
            value
          });
        }
        return _ParseStatus.mergeObjectSync(status, syncPairs);
      }
      static mergeObjectSync(status, pairs) {
        const finalObject = {};
        for (const pair of pairs) {
          const { key: key2, value } = pair;
          if (key2.status === "aborted")
            return INVALID;
          if (value.status === "aborted")
            return INVALID;
          if (key2.status === "dirty")
            status.dirty();
          if (value.status === "dirty")
            status.dirty();
          if (key2.value !== "__proto__" && (typeof value.value !== "undefined" || pair.alwaysSet)) {
            finalObject[key2.value] = value.value;
          }
        }
        return { status: status.value, value: finalObject };
      }
    };
    INVALID = Object.freeze({
      status: "aborted"
    });
    DIRTY = (value) => ({ status: "dirty", value });
    OK = (value) => ({ status: "valid", value });
    isAborted = (x) => x.status === "aborted";
    isDirty = (x) => x.status === "dirty";
    isValid = (x) => x.status === "valid";
    isAsync = (x) => typeof Promise !== "undefined" && x instanceof Promise;
  }
});

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/helpers/typeAliases.js
var init_typeAliases = __esm({
  "../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/helpers/typeAliases.js"() {
  }
});

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/helpers/errorUtil.js
var errorUtil;
var init_errorUtil = __esm({
  "../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/helpers/errorUtil.js"() {
    (function(errorUtil2) {
      errorUtil2.errToObj = (message) => typeof message === "string" ? { message } : message || {};
      errorUtil2.toString = (message) => typeof message === "string" ? message : message?.message;
    })(errorUtil || (errorUtil = {}));
  }
});

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/types.js
function processCreateParams(params) {
  if (!params)
    return {};
  const { errorMap: errorMap2, invalid_type_error, required_error, description } = params;
  if (errorMap2 && (invalid_type_error || required_error)) {
    throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
  }
  if (errorMap2)
    return { errorMap: errorMap2, description };
  const customMap = (iss, ctx) => {
    const { message } = params;
    if (iss.code === "invalid_enum_value") {
      return { message: message ?? ctx.defaultError };
    }
    if (typeof ctx.data === "undefined") {
      return { message: message ?? required_error ?? ctx.defaultError };
    }
    if (iss.code !== "invalid_type")
      return { message: ctx.defaultError };
    return { message: message ?? invalid_type_error ?? ctx.defaultError };
  };
  return { errorMap: customMap, description };
}
function timeRegexSource(args) {
  let secondsRegexSource = `[0-5]\\d`;
  if (args.precision) {
    secondsRegexSource = `${secondsRegexSource}\\.\\d{${args.precision}}`;
  } else if (args.precision == null) {
    secondsRegexSource = `${secondsRegexSource}(\\.\\d+)?`;
  }
  const secondsQuantifier = args.precision ? "+" : "?";
  return `([01]\\d|2[0-3]):[0-5]\\d(:${secondsRegexSource})${secondsQuantifier}`;
}
function timeRegex(args) {
  return new RegExp(`^${timeRegexSource(args)}$`);
}
function datetimeRegex(args) {
  let regex = `${dateRegexSource}T${timeRegexSource(args)}`;
  const opts = [];
  opts.push(args.local ? `Z?` : `Z`);
  if (args.offset)
    opts.push(`([+-]\\d{2}:?\\d{2})`);
  regex = `${regex}(${opts.join("|")})`;
  return new RegExp(`^${regex}$`);
}
function isValidIP(ip, version2) {
  if ((version2 === "v4" || !version2) && ipv4Regex.test(ip)) {
    return true;
  }
  if ((version2 === "v6" || !version2) && ipv6Regex.test(ip)) {
    return true;
  }
  return false;
}
function isValidJWT(jwt, alg) {
  if (!jwtRegex.test(jwt))
    return false;
  try {
    const [header] = jwt.split(".");
    if (!header)
      return false;
    const base64 = header.replace(/-/g, "+").replace(/_/g, "/").padEnd(header.length + (4 - header.length % 4) % 4, "=");
    const decoded = JSON.parse(atob(base64));
    if (typeof decoded !== "object" || decoded === null)
      return false;
    if ("typ" in decoded && decoded?.typ !== "JWT")
      return false;
    if (!decoded.alg)
      return false;
    if (alg && decoded.alg !== alg)
      return false;
    return true;
  } catch {
    return false;
  }
}
function isValidCidr(ip, version2) {
  if ((version2 === "v4" || !version2) && ipv4CidrRegex.test(ip)) {
    return true;
  }
  if ((version2 === "v6" || !version2) && ipv6CidrRegex.test(ip)) {
    return true;
  }
  return false;
}
function floatSafeRemainder(val, step) {
  const valDecCount = (val.toString().split(".")[1] || "").length;
  const stepDecCount = (step.toString().split(".")[1] || "").length;
  const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
  const valInt = Number.parseInt(val.toFixed(decCount).replace(".", ""));
  const stepInt = Number.parseInt(step.toFixed(decCount).replace(".", ""));
  return valInt % stepInt / 10 ** decCount;
}
function deepPartialify(schema) {
  if (schema instanceof ZodObject) {
    const newShape = {};
    for (const key2 in schema.shape) {
      const fieldSchema = schema.shape[key2];
      newShape[key2] = ZodOptional.create(deepPartialify(fieldSchema));
    }
    return new ZodObject({
      ...schema._def,
      shape: () => newShape
    });
  } else if (schema instanceof ZodArray) {
    return new ZodArray({
      ...schema._def,
      type: deepPartialify(schema.element)
    });
  } else if (schema instanceof ZodOptional) {
    return ZodOptional.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodNullable) {
    return ZodNullable.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodTuple) {
    return ZodTuple.create(schema.items.map((item) => deepPartialify(item)));
  } else {
    return schema;
  }
}
function mergeValues(a, b) {
  const aType = getParsedType(a);
  const bType = getParsedType(b);
  if (a === b) {
    return { valid: true, data: a };
  } else if (aType === ZodParsedType.object && bType === ZodParsedType.object) {
    const bKeys = util.objectKeys(b);
    const sharedKeys = util.objectKeys(a).filter((key2) => bKeys.indexOf(key2) !== -1);
    const newObj = { ...a, ...b };
    for (const key2 of sharedKeys) {
      const sharedValue = mergeValues(a[key2], b[key2]);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newObj[key2] = sharedValue.data;
    }
    return { valid: true, data: newObj };
  } else if (aType === ZodParsedType.array && bType === ZodParsedType.array) {
    if (a.length !== b.length) {
      return { valid: false };
    }
    const newArray = [];
    for (let index2 = 0; index2 < a.length; index2++) {
      const itemA = a[index2];
      const itemB = b[index2];
      const sharedValue = mergeValues(itemA, itemB);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newArray.push(sharedValue.data);
    }
    return { valid: true, data: newArray };
  } else if (aType === ZodParsedType.date && bType === ZodParsedType.date && +a === +b) {
    return { valid: true, data: a };
  } else {
    return { valid: false };
  }
}
function createZodEnum(values, params) {
  return new ZodEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodEnum,
    ...processCreateParams(params)
  });
}
function cleanParams(params, data2) {
  const p = typeof params === "function" ? params(data2) : typeof params === "string" ? { message: params } : params;
  const p2 = typeof p === "string" ? { message: p } : p;
  return p2;
}
function custom(check2, _params = {}, fatal) {
  if (check2)
    return ZodAny.create().superRefine((data2, ctx) => {
      const r = check2(data2);
      if (r instanceof Promise) {
        return r.then((r2) => {
          if (!r2) {
            const params = cleanParams(_params, data2);
            const _fatal = params.fatal ?? fatal ?? true;
            ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
          }
        });
      }
      if (!r) {
        const params = cleanParams(_params, data2);
        const _fatal = params.fatal ?? fatal ?? true;
        ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
      }
      return;
    });
  return ZodAny.create();
}
var ParseInputLazyPath, handleResult, ZodType, cuidRegex, cuid2Regex, ulidRegex, uuidRegex, nanoidRegex, jwtRegex, durationRegex, emailRegex, _emojiRegex, emojiRegex, ipv4Regex, ipv4CidrRegex, ipv6Regex, ipv6CidrRegex, base64Regex, base64urlRegex, dateRegexSource, dateRegex, ZodString, ZodNumber, ZodBigInt, ZodBoolean, ZodDate, ZodSymbol, ZodUndefined, ZodNull, ZodAny, ZodUnknown, ZodNever, ZodVoid, ZodArray, ZodObject, ZodUnion, getDiscriminator, ZodDiscriminatedUnion, ZodIntersection, ZodTuple, ZodRecord, ZodMap, ZodSet, ZodFunction, ZodLazy, ZodLiteral, ZodEnum, ZodNativeEnum, ZodPromise, ZodEffects, ZodOptional, ZodNullable, ZodDefault, ZodCatch, ZodNaN, BRAND, ZodBranded, ZodPipeline, ZodReadonly, late, ZodFirstPartyTypeKind, instanceOfType, stringType, numberType, nanType, bigIntType, booleanType, dateType, symbolType, undefinedType, nullType, anyType, unknownType, neverType, voidType, arrayType, objectType, strictObjectType, unionType, discriminatedUnionType, intersectionType, tupleType, recordType, mapType, setType, functionType, lazyType, literalType, enumType, nativeEnumType, promiseType, effectsType, optionalType, nullableType, preprocessType, pipelineType, ostring, onumber, oboolean, coerce, NEVER;
var init_types = __esm({
  "../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/types.js"() {
    init_ZodError();
    init_errors2();
    init_errorUtil();
    init_parseUtil();
    init_util();
    ParseInputLazyPath = class {
      constructor(parent, value, path, key2) {
        this._cachedPath = [];
        this.parent = parent;
        this.data = value;
        this._path = path;
        this._key = key2;
      }
      get path() {
        if (!this._cachedPath.length) {
          if (Array.isArray(this._key)) {
            this._cachedPath.push(...this._path, ...this._key);
          } else {
            this._cachedPath.push(...this._path, this._key);
          }
        }
        return this._cachedPath;
      }
    };
    handleResult = (ctx, result) => {
      if (isValid(result)) {
        return { success: true, data: result.value };
      } else {
        if (!ctx.common.issues.length) {
          throw new Error("Validation failed but no issues detected.");
        }
        return {
          success: false,
          get error() {
            if (this._error)
              return this._error;
            const error = new ZodError(ctx.common.issues);
            this._error = error;
            return this._error;
          }
        };
      }
    };
    ZodType = class {
      get description() {
        return this._def.description;
      }
      _getType(input) {
        return getParsedType(input.data);
      }
      _getOrReturnCtx(input, ctx) {
        return ctx || {
          common: input.parent.common,
          data: input.data,
          parsedType: getParsedType(input.data),
          schemaErrorMap: this._def.errorMap,
          path: input.path,
          parent: input.parent
        };
      }
      _processInputParams(input) {
        return {
          status: new ParseStatus(),
          ctx: {
            common: input.parent.common,
            data: input.data,
            parsedType: getParsedType(input.data),
            schemaErrorMap: this._def.errorMap,
            path: input.path,
            parent: input.parent
          }
        };
      }
      _parseSync(input) {
        const result = this._parse(input);
        if (isAsync(result)) {
          throw new Error("Synchronous parse encountered promise.");
        }
        return result;
      }
      _parseAsync(input) {
        const result = this._parse(input);
        return Promise.resolve(result);
      }
      parse(data2, params) {
        const result = this.safeParse(data2, params);
        if (result.success)
          return result.data;
        throw result.error;
      }
      safeParse(data2, params) {
        const ctx = {
          common: {
            issues: [],
            async: params?.async ?? false,
            contextualErrorMap: params?.errorMap
          },
          path: params?.path || [],
          schemaErrorMap: this._def.errorMap,
          parent: null,
          data: data2,
          parsedType: getParsedType(data2)
        };
        const result = this._parseSync({ data: data2, path: ctx.path, parent: ctx });
        return handleResult(ctx, result);
      }
      "~validate"(data2) {
        const ctx = {
          common: {
            issues: [],
            async: !!this["~standard"].async
          },
          path: [],
          schemaErrorMap: this._def.errorMap,
          parent: null,
          data: data2,
          parsedType: getParsedType(data2)
        };
        if (!this["~standard"].async) {
          try {
            const result = this._parseSync({ data: data2, path: [], parent: ctx });
            return isValid(result) ? {
              value: result.value
            } : {
              issues: ctx.common.issues
            };
          } catch (err) {
            if (err?.message?.toLowerCase()?.includes("encountered")) {
              this["~standard"].async = true;
            }
            ctx.common = {
              issues: [],
              async: true
            };
          }
        }
        return this._parseAsync({ data: data2, path: [], parent: ctx }).then((result) => isValid(result) ? {
          value: result.value
        } : {
          issues: ctx.common.issues
        });
      }
      async parseAsync(data2, params) {
        const result = await this.safeParseAsync(data2, params);
        if (result.success)
          return result.data;
        throw result.error;
      }
      async safeParseAsync(data2, params) {
        const ctx = {
          common: {
            issues: [],
            contextualErrorMap: params?.errorMap,
            async: true
          },
          path: params?.path || [],
          schemaErrorMap: this._def.errorMap,
          parent: null,
          data: data2,
          parsedType: getParsedType(data2)
        };
        const maybeAsyncResult = this._parse({ data: data2, path: ctx.path, parent: ctx });
        const result = await (isAsync(maybeAsyncResult) ? maybeAsyncResult : Promise.resolve(maybeAsyncResult));
        return handleResult(ctx, result);
      }
      refine(check2, message) {
        const getIssueProperties = (val) => {
          if (typeof message === "string" || typeof message === "undefined") {
            return { message };
          } else if (typeof message === "function") {
            return message(val);
          } else {
            return message;
          }
        };
        return this._refinement((val, ctx) => {
          const result = check2(val);
          const setError = () => ctx.addIssue({
            code: ZodIssueCode.custom,
            ...getIssueProperties(val)
          });
          if (typeof Promise !== "undefined" && result instanceof Promise) {
            return result.then((data2) => {
              if (!data2) {
                setError();
                return false;
              } else {
                return true;
              }
            });
          }
          if (!result) {
            setError();
            return false;
          } else {
            return true;
          }
        });
      }
      refinement(check2, refinementData) {
        return this._refinement((val, ctx) => {
          if (!check2(val)) {
            ctx.addIssue(typeof refinementData === "function" ? refinementData(val, ctx) : refinementData);
            return false;
          } else {
            return true;
          }
        });
      }
      _refinement(refinement) {
        return new ZodEffects({
          schema: this,
          typeName: ZodFirstPartyTypeKind.ZodEffects,
          effect: { type: "refinement", refinement }
        });
      }
      superRefine(refinement) {
        return this._refinement(refinement);
      }
      constructor(def) {
        this.spa = this.safeParseAsync;
        this._def = def;
        this.parse = this.parse.bind(this);
        this.safeParse = this.safeParse.bind(this);
        this.parseAsync = this.parseAsync.bind(this);
        this.safeParseAsync = this.safeParseAsync.bind(this);
        this.spa = this.spa.bind(this);
        this.refine = this.refine.bind(this);
        this.refinement = this.refinement.bind(this);
        this.superRefine = this.superRefine.bind(this);
        this.optional = this.optional.bind(this);
        this.nullable = this.nullable.bind(this);
        this.nullish = this.nullish.bind(this);
        this.array = this.array.bind(this);
        this.promise = this.promise.bind(this);
        this.or = this.or.bind(this);
        this.and = this.and.bind(this);
        this.transform = this.transform.bind(this);
        this.brand = this.brand.bind(this);
        this.default = this.default.bind(this);
        this.catch = this.catch.bind(this);
        this.describe = this.describe.bind(this);
        this.pipe = this.pipe.bind(this);
        this.readonly = this.readonly.bind(this);
        this.isNullable = this.isNullable.bind(this);
        this.isOptional = this.isOptional.bind(this);
        this["~standard"] = {
          version: 1,
          vendor: "zod",
          validate: (data2) => this["~validate"](data2)
        };
      }
      optional() {
        return ZodOptional.create(this, this._def);
      }
      nullable() {
        return ZodNullable.create(this, this._def);
      }
      nullish() {
        return this.nullable().optional();
      }
      array() {
        return ZodArray.create(this);
      }
      promise() {
        return ZodPromise.create(this, this._def);
      }
      or(option) {
        return ZodUnion.create([this, option], this._def);
      }
      and(incoming) {
        return ZodIntersection.create(this, incoming, this._def);
      }
      transform(transform) {
        return new ZodEffects({
          ...processCreateParams(this._def),
          schema: this,
          typeName: ZodFirstPartyTypeKind.ZodEffects,
          effect: { type: "transform", transform }
        });
      }
      default(def) {
        const defaultValueFunc = typeof def === "function" ? def : () => def;
        return new ZodDefault({
          ...processCreateParams(this._def),
          innerType: this,
          defaultValue: defaultValueFunc,
          typeName: ZodFirstPartyTypeKind.ZodDefault
        });
      }
      brand() {
        return new ZodBranded({
          typeName: ZodFirstPartyTypeKind.ZodBranded,
          type: this,
          ...processCreateParams(this._def)
        });
      }
      catch(def) {
        const catchValueFunc = typeof def === "function" ? def : () => def;
        return new ZodCatch({
          ...processCreateParams(this._def),
          innerType: this,
          catchValue: catchValueFunc,
          typeName: ZodFirstPartyTypeKind.ZodCatch
        });
      }
      describe(description) {
        const This = this.constructor;
        return new This({
          ...this._def,
          description
        });
      }
      pipe(target) {
        return ZodPipeline.create(this, target);
      }
      readonly() {
        return ZodReadonly.create(this);
      }
      isOptional() {
        return this.safeParse(void 0).success;
      }
      isNullable() {
        return this.safeParse(null).success;
      }
    };
    cuidRegex = /^c[^\s-]{8,}$/i;
    cuid2Regex = /^[0-9a-z]+$/;
    ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
    uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
    nanoidRegex = /^[a-z0-9_-]{21}$/i;
    jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
    durationRegex = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
    emailRegex = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
    _emojiRegex = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
    ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
    ipv4CidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/;
    ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
    ipv6CidrRegex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
    base64Regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
    base64urlRegex = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/;
    dateRegexSource = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
    dateRegex = new RegExp(`^${dateRegexSource}$`);
    ZodString = class _ZodString extends ZodType {
      _parse(input) {
        if (this._def.coerce) {
          input.data = String(input.data);
        }
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.string) {
          const ctx2 = this._getOrReturnCtx(input);
          addIssueToContext(ctx2, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.string,
            received: ctx2.parsedType
          });
          return INVALID;
        }
        const status = new ParseStatus();
        let ctx = void 0;
        for (const check2 of this._def.checks) {
          if (check2.kind === "min") {
            if (input.data.length < check2.value) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.too_small,
                minimum: check2.value,
                type: "string",
                inclusive: true,
                exact: false,
                message: check2.message
              });
              status.dirty();
            }
          } else if (check2.kind === "max") {
            if (input.data.length > check2.value) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.too_big,
                maximum: check2.value,
                type: "string",
                inclusive: true,
                exact: false,
                message: check2.message
              });
              status.dirty();
            }
          } else if (check2.kind === "length") {
            const tooBig = input.data.length > check2.value;
            const tooSmall = input.data.length < check2.value;
            if (tooBig || tooSmall) {
              ctx = this._getOrReturnCtx(input, ctx);
              if (tooBig) {
                addIssueToContext(ctx, {
                  code: ZodIssueCode.too_big,
                  maximum: check2.value,
                  type: "string",
                  inclusive: true,
                  exact: true,
                  message: check2.message
                });
              } else if (tooSmall) {
                addIssueToContext(ctx, {
                  code: ZodIssueCode.too_small,
                  minimum: check2.value,
                  type: "string",
                  inclusive: true,
                  exact: true,
                  message: check2.message
                });
              }
              status.dirty();
            }
          } else if (check2.kind === "email") {
            if (!emailRegex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "email",
                code: ZodIssueCode.invalid_string,
                message: check2.message
              });
              status.dirty();
            }
          } else if (check2.kind === "emoji") {
            if (!emojiRegex) {
              emojiRegex = new RegExp(_emojiRegex, "u");
            }
            if (!emojiRegex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "emoji",
                code: ZodIssueCode.invalid_string,
                message: check2.message
              });
              status.dirty();
            }
          } else if (check2.kind === "uuid") {
            if (!uuidRegex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "uuid",
                code: ZodIssueCode.invalid_string,
                message: check2.message
              });
              status.dirty();
            }
          } else if (check2.kind === "nanoid") {
            if (!nanoidRegex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "nanoid",
                code: ZodIssueCode.invalid_string,
                message: check2.message
              });
              status.dirty();
            }
          } else if (check2.kind === "cuid") {
            if (!cuidRegex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "cuid",
                code: ZodIssueCode.invalid_string,
                message: check2.message
              });
              status.dirty();
            }
          } else if (check2.kind === "cuid2") {
            if (!cuid2Regex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "cuid2",
                code: ZodIssueCode.invalid_string,
                message: check2.message
              });
              status.dirty();
            }
          } else if (check2.kind === "ulid") {
            if (!ulidRegex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "ulid",
                code: ZodIssueCode.invalid_string,
                message: check2.message
              });
              status.dirty();
            }
          } else if (check2.kind === "url") {
            try {
              new URL(input.data);
            } catch {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "url",
                code: ZodIssueCode.invalid_string,
                message: check2.message
              });
              status.dirty();
            }
          } else if (check2.kind === "regex") {
            check2.regex.lastIndex = 0;
            const testResult = check2.regex.test(input.data);
            if (!testResult) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "regex",
                code: ZodIssueCode.invalid_string,
                message: check2.message
              });
              status.dirty();
            }
          } else if (check2.kind === "trim") {
            input.data = input.data.trim();
          } else if (check2.kind === "includes") {
            if (!input.data.includes(check2.value, check2.position)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_string,
                validation: { includes: check2.value, position: check2.position },
                message: check2.message
              });
              status.dirty();
            }
          } else if (check2.kind === "toLowerCase") {
            input.data = input.data.toLowerCase();
          } else if (check2.kind === "toUpperCase") {
            input.data = input.data.toUpperCase();
          } else if (check2.kind === "startsWith") {
            if (!input.data.startsWith(check2.value)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_string,
                validation: { startsWith: check2.value },
                message: check2.message
              });
              status.dirty();
            }
          } else if (check2.kind === "endsWith") {
            if (!input.data.endsWith(check2.value)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_string,
                validation: { endsWith: check2.value },
                message: check2.message
              });
              status.dirty();
            }
          } else if (check2.kind === "datetime") {
            const regex = datetimeRegex(check2);
            if (!regex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_string,
                validation: "datetime",
                message: check2.message
              });
              status.dirty();
            }
          } else if (check2.kind === "date") {
            const regex = dateRegex;
            if (!regex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_string,
                validation: "date",
                message: check2.message
              });
              status.dirty();
            }
          } else if (check2.kind === "time") {
            const regex = timeRegex(check2);
            if (!regex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_string,
                validation: "time",
                message: check2.message
              });
              status.dirty();
            }
          } else if (check2.kind === "duration") {
            if (!durationRegex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "duration",
                code: ZodIssueCode.invalid_string,
                message: check2.message
              });
              status.dirty();
            }
          } else if (check2.kind === "ip") {
            if (!isValidIP(input.data, check2.version)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "ip",
                code: ZodIssueCode.invalid_string,
                message: check2.message
              });
              status.dirty();
            }
          } else if (check2.kind === "jwt") {
            if (!isValidJWT(input.data, check2.alg)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "jwt",
                code: ZodIssueCode.invalid_string,
                message: check2.message
              });
              status.dirty();
            }
          } else if (check2.kind === "cidr") {
            if (!isValidCidr(input.data, check2.version)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "cidr",
                code: ZodIssueCode.invalid_string,
                message: check2.message
              });
              status.dirty();
            }
          } else if (check2.kind === "base64") {
            if (!base64Regex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "base64",
                code: ZodIssueCode.invalid_string,
                message: check2.message
              });
              status.dirty();
            }
          } else if (check2.kind === "base64url") {
            if (!base64urlRegex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "base64url",
                code: ZodIssueCode.invalid_string,
                message: check2.message
              });
              status.dirty();
            }
          } else {
            util.assertNever(check2);
          }
        }
        return { status: status.value, value: input.data };
      }
      _regex(regex, validation, message) {
        return this.refinement((data2) => regex.test(data2), {
          validation,
          code: ZodIssueCode.invalid_string,
          ...errorUtil.errToObj(message)
        });
      }
      _addCheck(check2) {
        return new _ZodString({
          ...this._def,
          checks: [...this._def.checks, check2]
        });
      }
      email(message) {
        return this._addCheck({ kind: "email", ...errorUtil.errToObj(message) });
      }
      url(message) {
        return this._addCheck({ kind: "url", ...errorUtil.errToObj(message) });
      }
      emoji(message) {
        return this._addCheck({ kind: "emoji", ...errorUtil.errToObj(message) });
      }
      uuid(message) {
        return this._addCheck({ kind: "uuid", ...errorUtil.errToObj(message) });
      }
      nanoid(message) {
        return this._addCheck({ kind: "nanoid", ...errorUtil.errToObj(message) });
      }
      cuid(message) {
        return this._addCheck({ kind: "cuid", ...errorUtil.errToObj(message) });
      }
      cuid2(message) {
        return this._addCheck({ kind: "cuid2", ...errorUtil.errToObj(message) });
      }
      ulid(message) {
        return this._addCheck({ kind: "ulid", ...errorUtil.errToObj(message) });
      }
      base64(message) {
        return this._addCheck({ kind: "base64", ...errorUtil.errToObj(message) });
      }
      base64url(message) {
        return this._addCheck({
          kind: "base64url",
          ...errorUtil.errToObj(message)
        });
      }
      jwt(options) {
        return this._addCheck({ kind: "jwt", ...errorUtil.errToObj(options) });
      }
      ip(options) {
        return this._addCheck({ kind: "ip", ...errorUtil.errToObj(options) });
      }
      cidr(options) {
        return this._addCheck({ kind: "cidr", ...errorUtil.errToObj(options) });
      }
      datetime(options) {
        if (typeof options === "string") {
          return this._addCheck({
            kind: "datetime",
            precision: null,
            offset: false,
            local: false,
            message: options
          });
        }
        return this._addCheck({
          kind: "datetime",
          precision: typeof options?.precision === "undefined" ? null : options?.precision,
          offset: options?.offset ?? false,
          local: options?.local ?? false,
          ...errorUtil.errToObj(options?.message)
        });
      }
      date(message) {
        return this._addCheck({ kind: "date", message });
      }
      time(options) {
        if (typeof options === "string") {
          return this._addCheck({
            kind: "time",
            precision: null,
            message: options
          });
        }
        return this._addCheck({
          kind: "time",
          precision: typeof options?.precision === "undefined" ? null : options?.precision,
          ...errorUtil.errToObj(options?.message)
        });
      }
      duration(message) {
        return this._addCheck({ kind: "duration", ...errorUtil.errToObj(message) });
      }
      regex(regex, message) {
        return this._addCheck({
          kind: "regex",
          regex,
          ...errorUtil.errToObj(message)
        });
      }
      includes(value, options) {
        return this._addCheck({
          kind: "includes",
          value,
          position: options?.position,
          ...errorUtil.errToObj(options?.message)
        });
      }
      startsWith(value, message) {
        return this._addCheck({
          kind: "startsWith",
          value,
          ...errorUtil.errToObj(message)
        });
      }
      endsWith(value, message) {
        return this._addCheck({
          kind: "endsWith",
          value,
          ...errorUtil.errToObj(message)
        });
      }
      min(minLength, message) {
        return this._addCheck({
          kind: "min",
          value: minLength,
          ...errorUtil.errToObj(message)
        });
      }
      max(maxLength, message) {
        return this._addCheck({
          kind: "max",
          value: maxLength,
          ...errorUtil.errToObj(message)
        });
      }
      length(len, message) {
        return this._addCheck({
          kind: "length",
          value: len,
          ...errorUtil.errToObj(message)
        });
      }
      /**
       * Equivalent to `.min(1)`
       */
      nonempty(message) {
        return this.min(1, errorUtil.errToObj(message));
      }
      trim() {
        return new _ZodString({
          ...this._def,
          checks: [...this._def.checks, { kind: "trim" }]
        });
      }
      toLowerCase() {
        return new _ZodString({
          ...this._def,
          checks: [...this._def.checks, { kind: "toLowerCase" }]
        });
      }
      toUpperCase() {
        return new _ZodString({
          ...this._def,
          checks: [...this._def.checks, { kind: "toUpperCase" }]
        });
      }
      get isDatetime() {
        return !!this._def.checks.find((ch) => ch.kind === "datetime");
      }
      get isDate() {
        return !!this._def.checks.find((ch) => ch.kind === "date");
      }
      get isTime() {
        return !!this._def.checks.find((ch) => ch.kind === "time");
      }
      get isDuration() {
        return !!this._def.checks.find((ch) => ch.kind === "duration");
      }
      get isEmail() {
        return !!this._def.checks.find((ch) => ch.kind === "email");
      }
      get isURL() {
        return !!this._def.checks.find((ch) => ch.kind === "url");
      }
      get isEmoji() {
        return !!this._def.checks.find((ch) => ch.kind === "emoji");
      }
      get isUUID() {
        return !!this._def.checks.find((ch) => ch.kind === "uuid");
      }
      get isNANOID() {
        return !!this._def.checks.find((ch) => ch.kind === "nanoid");
      }
      get isCUID() {
        return !!this._def.checks.find((ch) => ch.kind === "cuid");
      }
      get isCUID2() {
        return !!this._def.checks.find((ch) => ch.kind === "cuid2");
      }
      get isULID() {
        return !!this._def.checks.find((ch) => ch.kind === "ulid");
      }
      get isIP() {
        return !!this._def.checks.find((ch) => ch.kind === "ip");
      }
      get isCIDR() {
        return !!this._def.checks.find((ch) => ch.kind === "cidr");
      }
      get isBase64() {
        return !!this._def.checks.find((ch) => ch.kind === "base64");
      }
      get isBase64url() {
        return !!this._def.checks.find((ch) => ch.kind === "base64url");
      }
      get minLength() {
        let min = null;
        for (const ch of this._def.checks) {
          if (ch.kind === "min") {
            if (min === null || ch.value > min)
              min = ch.value;
          }
        }
        return min;
      }
      get maxLength() {
        let max = null;
        for (const ch of this._def.checks) {
          if (ch.kind === "max") {
            if (max === null || ch.value < max)
              max = ch.value;
          }
        }
        return max;
      }
    };
    ZodString.create = (params) => {
      return new ZodString({
        checks: [],
        typeName: ZodFirstPartyTypeKind.ZodString,
        coerce: params?.coerce ?? false,
        ...processCreateParams(params)
      });
    };
    ZodNumber = class _ZodNumber extends ZodType {
      constructor() {
        super(...arguments);
        this.min = this.gte;
        this.max = this.lte;
        this.step = this.multipleOf;
      }
      _parse(input) {
        if (this._def.coerce) {
          input.data = Number(input.data);
        }
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.number) {
          const ctx2 = this._getOrReturnCtx(input);
          addIssueToContext(ctx2, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.number,
            received: ctx2.parsedType
          });
          return INVALID;
        }
        let ctx = void 0;
        const status = new ParseStatus();
        for (const check2 of this._def.checks) {
          if (check2.kind === "int") {
            if (!util.isInteger(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: "integer",
                received: "float",
                message: check2.message
              });
              status.dirty();
            }
          } else if (check2.kind === "min") {
            const tooSmall = check2.inclusive ? input.data < check2.value : input.data <= check2.value;
            if (tooSmall) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.too_small,
                minimum: check2.value,
                type: "number",
                inclusive: check2.inclusive,
                exact: false,
                message: check2.message
              });
              status.dirty();
            }
          } else if (check2.kind === "max") {
            const tooBig = check2.inclusive ? input.data > check2.value : input.data >= check2.value;
            if (tooBig) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.too_big,
                maximum: check2.value,
                type: "number",
                inclusive: check2.inclusive,
                exact: false,
                message: check2.message
              });
              status.dirty();
            }
          } else if (check2.kind === "multipleOf") {
            if (floatSafeRemainder(input.data, check2.value) !== 0) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.not_multiple_of,
                multipleOf: check2.value,
                message: check2.message
              });
              status.dirty();
            }
          } else if (check2.kind === "finite") {
            if (!Number.isFinite(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.not_finite,
                message: check2.message
              });
              status.dirty();
            }
          } else {
            util.assertNever(check2);
          }
        }
        return { status: status.value, value: input.data };
      }
      gte(value, message) {
        return this.setLimit("min", value, true, errorUtil.toString(message));
      }
      gt(value, message) {
        return this.setLimit("min", value, false, errorUtil.toString(message));
      }
      lte(value, message) {
        return this.setLimit("max", value, true, errorUtil.toString(message));
      }
      lt(value, message) {
        return this.setLimit("max", value, false, errorUtil.toString(message));
      }
      setLimit(kind, value, inclusive, message) {
        return new _ZodNumber({
          ...this._def,
          checks: [
            ...this._def.checks,
            {
              kind,
              value,
              inclusive,
              message: errorUtil.toString(message)
            }
          ]
        });
      }
      _addCheck(check2) {
        return new _ZodNumber({
          ...this._def,
          checks: [...this._def.checks, check2]
        });
      }
      int(message) {
        return this._addCheck({
          kind: "int",
          message: errorUtil.toString(message)
        });
      }
      positive(message) {
        return this._addCheck({
          kind: "min",
          value: 0,
          inclusive: false,
          message: errorUtil.toString(message)
        });
      }
      negative(message) {
        return this._addCheck({
          kind: "max",
          value: 0,
          inclusive: false,
          message: errorUtil.toString(message)
        });
      }
      nonpositive(message) {
        return this._addCheck({
          kind: "max",
          value: 0,
          inclusive: true,
          message: errorUtil.toString(message)
        });
      }
      nonnegative(message) {
        return this._addCheck({
          kind: "min",
          value: 0,
          inclusive: true,
          message: errorUtil.toString(message)
        });
      }
      multipleOf(value, message) {
        return this._addCheck({
          kind: "multipleOf",
          value,
          message: errorUtil.toString(message)
        });
      }
      finite(message) {
        return this._addCheck({
          kind: "finite",
          message: errorUtil.toString(message)
        });
      }
      safe(message) {
        return this._addCheck({
          kind: "min",
          inclusive: true,
          value: Number.MIN_SAFE_INTEGER,
          message: errorUtil.toString(message)
        })._addCheck({
          kind: "max",
          inclusive: true,
          value: Number.MAX_SAFE_INTEGER,
          message: errorUtil.toString(message)
        });
      }
      get minValue() {
        let min = null;
        for (const ch of this._def.checks) {
          if (ch.kind === "min") {
            if (min === null || ch.value > min)
              min = ch.value;
          }
        }
        return min;
      }
      get maxValue() {
        let max = null;
        for (const ch of this._def.checks) {
          if (ch.kind === "max") {
            if (max === null || ch.value < max)
              max = ch.value;
          }
        }
        return max;
      }
      get isInt() {
        return !!this._def.checks.find((ch) => ch.kind === "int" || ch.kind === "multipleOf" && util.isInteger(ch.value));
      }
      get isFinite() {
        let max = null;
        let min = null;
        for (const ch of this._def.checks) {
          if (ch.kind === "finite" || ch.kind === "int" || ch.kind === "multipleOf") {
            return true;
          } else if (ch.kind === "min") {
            if (min === null || ch.value > min)
              min = ch.value;
          } else if (ch.kind === "max") {
            if (max === null || ch.value < max)
              max = ch.value;
          }
        }
        return Number.isFinite(min) && Number.isFinite(max);
      }
    };
    ZodNumber.create = (params) => {
      return new ZodNumber({
        checks: [],
        typeName: ZodFirstPartyTypeKind.ZodNumber,
        coerce: params?.coerce || false,
        ...processCreateParams(params)
      });
    };
    ZodBigInt = class _ZodBigInt extends ZodType {
      constructor() {
        super(...arguments);
        this.min = this.gte;
        this.max = this.lte;
      }
      _parse(input) {
        if (this._def.coerce) {
          try {
            input.data = BigInt(input.data);
          } catch {
            return this._getInvalidInput(input);
          }
        }
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.bigint) {
          return this._getInvalidInput(input);
        }
        let ctx = void 0;
        const status = new ParseStatus();
        for (const check2 of this._def.checks) {
          if (check2.kind === "min") {
            const tooSmall = check2.inclusive ? input.data < check2.value : input.data <= check2.value;
            if (tooSmall) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.too_small,
                type: "bigint",
                minimum: check2.value,
                inclusive: check2.inclusive,
                message: check2.message
              });
              status.dirty();
            }
          } else if (check2.kind === "max") {
            const tooBig = check2.inclusive ? input.data > check2.value : input.data >= check2.value;
            if (tooBig) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.too_big,
                type: "bigint",
                maximum: check2.value,
                inclusive: check2.inclusive,
                message: check2.message
              });
              status.dirty();
            }
          } else if (check2.kind === "multipleOf") {
            if (input.data % check2.value !== BigInt(0)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.not_multiple_of,
                multipleOf: check2.value,
                message: check2.message
              });
              status.dirty();
            }
          } else {
            util.assertNever(check2);
          }
        }
        return { status: status.value, value: input.data };
      }
      _getInvalidInput(input) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.bigint,
          received: ctx.parsedType
        });
        return INVALID;
      }
      gte(value, message) {
        return this.setLimit("min", value, true, errorUtil.toString(message));
      }
      gt(value, message) {
        return this.setLimit("min", value, false, errorUtil.toString(message));
      }
      lte(value, message) {
        return this.setLimit("max", value, true, errorUtil.toString(message));
      }
      lt(value, message) {
        return this.setLimit("max", value, false, errorUtil.toString(message));
      }
      setLimit(kind, value, inclusive, message) {
        return new _ZodBigInt({
          ...this._def,
          checks: [
            ...this._def.checks,
            {
              kind,
              value,
              inclusive,
              message: errorUtil.toString(message)
            }
          ]
        });
      }
      _addCheck(check2) {
        return new _ZodBigInt({
          ...this._def,
          checks: [...this._def.checks, check2]
        });
      }
      positive(message) {
        return this._addCheck({
          kind: "min",
          value: BigInt(0),
          inclusive: false,
          message: errorUtil.toString(message)
        });
      }
      negative(message) {
        return this._addCheck({
          kind: "max",
          value: BigInt(0),
          inclusive: false,
          message: errorUtil.toString(message)
        });
      }
      nonpositive(message) {
        return this._addCheck({
          kind: "max",
          value: BigInt(0),
          inclusive: true,
          message: errorUtil.toString(message)
        });
      }
      nonnegative(message) {
        return this._addCheck({
          kind: "min",
          value: BigInt(0),
          inclusive: true,
          message: errorUtil.toString(message)
        });
      }
      multipleOf(value, message) {
        return this._addCheck({
          kind: "multipleOf",
          value,
          message: errorUtil.toString(message)
        });
      }
      get minValue() {
        let min = null;
        for (const ch of this._def.checks) {
          if (ch.kind === "min") {
            if (min === null || ch.value > min)
              min = ch.value;
          }
        }
        return min;
      }
      get maxValue() {
        let max = null;
        for (const ch of this._def.checks) {
          if (ch.kind === "max") {
            if (max === null || ch.value < max)
              max = ch.value;
          }
        }
        return max;
      }
    };
    ZodBigInt.create = (params) => {
      return new ZodBigInt({
        checks: [],
        typeName: ZodFirstPartyTypeKind.ZodBigInt,
        coerce: params?.coerce ?? false,
        ...processCreateParams(params)
      });
    };
    ZodBoolean = class extends ZodType {
      _parse(input) {
        if (this._def.coerce) {
          input.data = Boolean(input.data);
        }
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.boolean) {
          const ctx = this._getOrReturnCtx(input);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.boolean,
            received: ctx.parsedType
          });
          return INVALID;
        }
        return OK(input.data);
      }
    };
    ZodBoolean.create = (params) => {
      return new ZodBoolean({
        typeName: ZodFirstPartyTypeKind.ZodBoolean,
        coerce: params?.coerce || false,
        ...processCreateParams(params)
      });
    };
    ZodDate = class _ZodDate extends ZodType {
      _parse(input) {
        if (this._def.coerce) {
          input.data = new Date(input.data);
        }
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.date) {
          const ctx2 = this._getOrReturnCtx(input);
          addIssueToContext(ctx2, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.date,
            received: ctx2.parsedType
          });
          return INVALID;
        }
        if (Number.isNaN(input.data.getTime())) {
          const ctx2 = this._getOrReturnCtx(input);
          addIssueToContext(ctx2, {
            code: ZodIssueCode.invalid_date
          });
          return INVALID;
        }
        const status = new ParseStatus();
        let ctx = void 0;
        for (const check2 of this._def.checks) {
          if (check2.kind === "min") {
            if (input.data.getTime() < check2.value) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.too_small,
                message: check2.message,
                inclusive: true,
                exact: false,
                minimum: check2.value,
                type: "date"
              });
              status.dirty();
            }
          } else if (check2.kind === "max") {
            if (input.data.getTime() > check2.value) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.too_big,
                message: check2.message,
                inclusive: true,
                exact: false,
                maximum: check2.value,
                type: "date"
              });
              status.dirty();
            }
          } else {
            util.assertNever(check2);
          }
        }
        return {
          status: status.value,
          value: new Date(input.data.getTime())
        };
      }
      _addCheck(check2) {
        return new _ZodDate({
          ...this._def,
          checks: [...this._def.checks, check2]
        });
      }
      min(minDate, message) {
        return this._addCheck({
          kind: "min",
          value: minDate.getTime(),
          message: errorUtil.toString(message)
        });
      }
      max(maxDate, message) {
        return this._addCheck({
          kind: "max",
          value: maxDate.getTime(),
          message: errorUtil.toString(message)
        });
      }
      get minDate() {
        let min = null;
        for (const ch of this._def.checks) {
          if (ch.kind === "min") {
            if (min === null || ch.value > min)
              min = ch.value;
          }
        }
        return min != null ? new Date(min) : null;
      }
      get maxDate() {
        let max = null;
        for (const ch of this._def.checks) {
          if (ch.kind === "max") {
            if (max === null || ch.value < max)
              max = ch.value;
          }
        }
        return max != null ? new Date(max) : null;
      }
    };
    ZodDate.create = (params) => {
      return new ZodDate({
        checks: [],
        coerce: params?.coerce || false,
        typeName: ZodFirstPartyTypeKind.ZodDate,
        ...processCreateParams(params)
      });
    };
    ZodSymbol = class extends ZodType {
      _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.symbol) {
          const ctx = this._getOrReturnCtx(input);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.symbol,
            received: ctx.parsedType
          });
          return INVALID;
        }
        return OK(input.data);
      }
    };
    ZodSymbol.create = (params) => {
      return new ZodSymbol({
        typeName: ZodFirstPartyTypeKind.ZodSymbol,
        ...processCreateParams(params)
      });
    };
    ZodUndefined = class extends ZodType {
      _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.undefined) {
          const ctx = this._getOrReturnCtx(input);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.undefined,
            received: ctx.parsedType
          });
          return INVALID;
        }
        return OK(input.data);
      }
    };
    ZodUndefined.create = (params) => {
      return new ZodUndefined({
        typeName: ZodFirstPartyTypeKind.ZodUndefined,
        ...processCreateParams(params)
      });
    };
    ZodNull = class extends ZodType {
      _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.null) {
          const ctx = this._getOrReturnCtx(input);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.null,
            received: ctx.parsedType
          });
          return INVALID;
        }
        return OK(input.data);
      }
    };
    ZodNull.create = (params) => {
      return new ZodNull({
        typeName: ZodFirstPartyTypeKind.ZodNull,
        ...processCreateParams(params)
      });
    };
    ZodAny = class extends ZodType {
      constructor() {
        super(...arguments);
        this._any = true;
      }
      _parse(input) {
        return OK(input.data);
      }
    };
    ZodAny.create = (params) => {
      return new ZodAny({
        typeName: ZodFirstPartyTypeKind.ZodAny,
        ...processCreateParams(params)
      });
    };
    ZodUnknown = class extends ZodType {
      constructor() {
        super(...arguments);
        this._unknown = true;
      }
      _parse(input) {
        return OK(input.data);
      }
    };
    ZodUnknown.create = (params) => {
      return new ZodUnknown({
        typeName: ZodFirstPartyTypeKind.ZodUnknown,
        ...processCreateParams(params)
      });
    };
    ZodNever = class extends ZodType {
      _parse(input) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.never,
          received: ctx.parsedType
        });
        return INVALID;
      }
    };
    ZodNever.create = (params) => {
      return new ZodNever({
        typeName: ZodFirstPartyTypeKind.ZodNever,
        ...processCreateParams(params)
      });
    };
    ZodVoid = class extends ZodType {
      _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.undefined) {
          const ctx = this._getOrReturnCtx(input);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.void,
            received: ctx.parsedType
          });
          return INVALID;
        }
        return OK(input.data);
      }
    };
    ZodVoid.create = (params) => {
      return new ZodVoid({
        typeName: ZodFirstPartyTypeKind.ZodVoid,
        ...processCreateParams(params)
      });
    };
    ZodArray = class _ZodArray extends ZodType {
      _parse(input) {
        const { ctx, status } = this._processInputParams(input);
        const def = this._def;
        if (ctx.parsedType !== ZodParsedType.array) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.array,
            received: ctx.parsedType
          });
          return INVALID;
        }
        if (def.exactLength !== null) {
          const tooBig = ctx.data.length > def.exactLength.value;
          const tooSmall = ctx.data.length < def.exactLength.value;
          if (tooBig || tooSmall) {
            addIssueToContext(ctx, {
              code: tooBig ? ZodIssueCode.too_big : ZodIssueCode.too_small,
              minimum: tooSmall ? def.exactLength.value : void 0,
              maximum: tooBig ? def.exactLength.value : void 0,
              type: "array",
              inclusive: true,
              exact: true,
              message: def.exactLength.message
            });
            status.dirty();
          }
        }
        if (def.minLength !== null) {
          if (ctx.data.length < def.minLength.value) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: def.minLength.value,
              type: "array",
              inclusive: true,
              exact: false,
              message: def.minLength.message
            });
            status.dirty();
          }
        }
        if (def.maxLength !== null) {
          if (ctx.data.length > def.maxLength.value) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: def.maxLength.value,
              type: "array",
              inclusive: true,
              exact: false,
              message: def.maxLength.message
            });
            status.dirty();
          }
        }
        if (ctx.common.async) {
          return Promise.all([...ctx.data].map((item, i) => {
            return def.type._parseAsync(new ParseInputLazyPath(ctx, item, ctx.path, i));
          })).then((result2) => {
            return ParseStatus.mergeArray(status, result2);
          });
        }
        const result = [...ctx.data].map((item, i) => {
          return def.type._parseSync(new ParseInputLazyPath(ctx, item, ctx.path, i));
        });
        return ParseStatus.mergeArray(status, result);
      }
      get element() {
        return this._def.type;
      }
      min(minLength, message) {
        return new _ZodArray({
          ...this._def,
          minLength: { value: minLength, message: errorUtil.toString(message) }
        });
      }
      max(maxLength, message) {
        return new _ZodArray({
          ...this._def,
          maxLength: { value: maxLength, message: errorUtil.toString(message) }
        });
      }
      length(len, message) {
        return new _ZodArray({
          ...this._def,
          exactLength: { value: len, message: errorUtil.toString(message) }
        });
      }
      nonempty(message) {
        return this.min(1, message);
      }
    };
    ZodArray.create = (schema, params) => {
      return new ZodArray({
        type: schema,
        minLength: null,
        maxLength: null,
        exactLength: null,
        typeName: ZodFirstPartyTypeKind.ZodArray,
        ...processCreateParams(params)
      });
    };
    ZodObject = class _ZodObject extends ZodType {
      constructor() {
        super(...arguments);
        this._cached = null;
        this.nonstrict = this.passthrough;
        this.augment = this.extend;
      }
      _getCached() {
        if (this._cached !== null)
          return this._cached;
        const shape = this._def.shape();
        const keys = util.objectKeys(shape);
        this._cached = { shape, keys };
        return this._cached;
      }
      _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.object) {
          const ctx2 = this._getOrReturnCtx(input);
          addIssueToContext(ctx2, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.object,
            received: ctx2.parsedType
          });
          return INVALID;
        }
        const { status, ctx } = this._processInputParams(input);
        const { shape, keys: shapeKeys } = this._getCached();
        const extraKeys = [];
        if (!(this._def.catchall instanceof ZodNever && this._def.unknownKeys === "strip")) {
          for (const key2 in ctx.data) {
            if (!shapeKeys.includes(key2)) {
              extraKeys.push(key2);
            }
          }
        }
        const pairs = [];
        for (const key2 of shapeKeys) {
          const keyValidator = shape[key2];
          const value = ctx.data[key2];
          pairs.push({
            key: { status: "valid", value: key2 },
            value: keyValidator._parse(new ParseInputLazyPath(ctx, value, ctx.path, key2)),
            alwaysSet: key2 in ctx.data
          });
        }
        if (this._def.catchall instanceof ZodNever) {
          const unknownKeys = this._def.unknownKeys;
          if (unknownKeys === "passthrough") {
            for (const key2 of extraKeys) {
              pairs.push({
                key: { status: "valid", value: key2 },
                value: { status: "valid", value: ctx.data[key2] }
              });
            }
          } else if (unknownKeys === "strict") {
            if (extraKeys.length > 0) {
              addIssueToContext(ctx, {
                code: ZodIssueCode.unrecognized_keys,
                keys: extraKeys
              });
              status.dirty();
            }
          } else if (unknownKeys === "strip") {
          } else {
            throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
          }
        } else {
          const catchall = this._def.catchall;
          for (const key2 of extraKeys) {
            const value = ctx.data[key2];
            pairs.push({
              key: { status: "valid", value: key2 },
              value: catchall._parse(
                new ParseInputLazyPath(ctx, value, ctx.path, key2)
                //, ctx.child(key), value, getParsedType(value)
              ),
              alwaysSet: key2 in ctx.data
            });
          }
        }
        if (ctx.common.async) {
          return Promise.resolve().then(async () => {
            const syncPairs = [];
            for (const pair of pairs) {
              const key2 = await pair.key;
              const value = await pair.value;
              syncPairs.push({
                key: key2,
                value,
                alwaysSet: pair.alwaysSet
              });
            }
            return syncPairs;
          }).then((syncPairs) => {
            return ParseStatus.mergeObjectSync(status, syncPairs);
          });
        } else {
          return ParseStatus.mergeObjectSync(status, pairs);
        }
      }
      get shape() {
        return this._def.shape();
      }
      strict(message) {
        errorUtil.errToObj;
        return new _ZodObject({
          ...this._def,
          unknownKeys: "strict",
          ...message !== void 0 ? {
            errorMap: (issue, ctx) => {
              const defaultError = this._def.errorMap?.(issue, ctx).message ?? ctx.defaultError;
              if (issue.code === "unrecognized_keys")
                return {
                  message: errorUtil.errToObj(message).message ?? defaultError
                };
              return {
                message: defaultError
              };
            }
          } : {}
        });
      }
      strip() {
        return new _ZodObject({
          ...this._def,
          unknownKeys: "strip"
        });
      }
      passthrough() {
        return new _ZodObject({
          ...this._def,
          unknownKeys: "passthrough"
        });
      }
      // const AugmentFactory =
      //   <Def extends ZodObjectDef>(def: Def) =>
      //   <Augmentation extends ZodRawShape>(
      //     augmentation: Augmentation
      //   ): ZodObject<
      //     extendShape<ReturnType<Def["shape"]>, Augmentation>,
      //     Def["unknownKeys"],
      //     Def["catchall"]
      //   > => {
      //     return new ZodObject({
      //       ...def,
      //       shape: () => ({
      //         ...def.shape(),
      //         ...augmentation,
      //       }),
      //     }) as any;
      //   };
      extend(augmentation) {
        return new _ZodObject({
          ...this._def,
          shape: () => ({
            ...this._def.shape(),
            ...augmentation
          })
        });
      }
      /**
       * Prior to zod@1.0.12 there was a bug in the
       * inferred type of merged objects. Please
       * upgrade if you are experiencing issues.
       */
      merge(merging) {
        const merged = new _ZodObject({
          unknownKeys: merging._def.unknownKeys,
          catchall: merging._def.catchall,
          shape: () => ({
            ...this._def.shape(),
            ...merging._def.shape()
          }),
          typeName: ZodFirstPartyTypeKind.ZodObject
        });
        return merged;
      }
      // merge<
      //   Incoming extends AnyZodObject,
      //   Augmentation extends Incoming["shape"],
      //   NewOutput extends {
      //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
      //       ? Augmentation[k]["_output"]
      //       : k extends keyof Output
      //       ? Output[k]
      //       : never;
      //   },
      //   NewInput extends {
      //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
      //       ? Augmentation[k]["_input"]
      //       : k extends keyof Input
      //       ? Input[k]
      //       : never;
      //   }
      // >(
      //   merging: Incoming
      // ): ZodObject<
      //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
      //   Incoming["_def"]["unknownKeys"],
      //   Incoming["_def"]["catchall"],
      //   NewOutput,
      //   NewInput
      // > {
      //   const merged: any = new ZodObject({
      //     unknownKeys: merging._def.unknownKeys,
      //     catchall: merging._def.catchall,
      //     shape: () =>
      //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
      //     typeName: ZodFirstPartyTypeKind.ZodObject,
      //   }) as any;
      //   return merged;
      // }
      setKey(key2, schema) {
        return this.augment({ [key2]: schema });
      }
      // merge<Incoming extends AnyZodObject>(
      //   merging: Incoming
      // ): //ZodObject<T & Incoming["_shape"], UnknownKeys, Catchall> = (merging) => {
      // ZodObject<
      //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
      //   Incoming["_def"]["unknownKeys"],
      //   Incoming["_def"]["catchall"]
      // > {
      //   // const mergedShape = objectUtil.mergeShapes(
      //   //   this._def.shape(),
      //   //   merging._def.shape()
      //   // );
      //   const merged: any = new ZodObject({
      //     unknownKeys: merging._def.unknownKeys,
      //     catchall: merging._def.catchall,
      //     shape: () =>
      //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
      //     typeName: ZodFirstPartyTypeKind.ZodObject,
      //   }) as any;
      //   return merged;
      // }
      catchall(index2) {
        return new _ZodObject({
          ...this._def,
          catchall: index2
        });
      }
      pick(mask) {
        const shape = {};
        for (const key2 of util.objectKeys(mask)) {
          if (mask[key2] && this.shape[key2]) {
            shape[key2] = this.shape[key2];
          }
        }
        return new _ZodObject({
          ...this._def,
          shape: () => shape
        });
      }
      omit(mask) {
        const shape = {};
        for (const key2 of util.objectKeys(this.shape)) {
          if (!mask[key2]) {
            shape[key2] = this.shape[key2];
          }
        }
        return new _ZodObject({
          ...this._def,
          shape: () => shape
        });
      }
      /**
       * @deprecated
       */
      deepPartial() {
        return deepPartialify(this);
      }
      partial(mask) {
        const newShape = {};
        for (const key2 of util.objectKeys(this.shape)) {
          const fieldSchema = this.shape[key2];
          if (mask && !mask[key2]) {
            newShape[key2] = fieldSchema;
          } else {
            newShape[key2] = fieldSchema.optional();
          }
        }
        return new _ZodObject({
          ...this._def,
          shape: () => newShape
        });
      }
      required(mask) {
        const newShape = {};
        for (const key2 of util.objectKeys(this.shape)) {
          if (mask && !mask[key2]) {
            newShape[key2] = this.shape[key2];
          } else {
            const fieldSchema = this.shape[key2];
            let newField = fieldSchema;
            while (newField instanceof ZodOptional) {
              newField = newField._def.innerType;
            }
            newShape[key2] = newField;
          }
        }
        return new _ZodObject({
          ...this._def,
          shape: () => newShape
        });
      }
      keyof() {
        return createZodEnum(util.objectKeys(this.shape));
      }
    };
    ZodObject.create = (shape, params) => {
      return new ZodObject({
        shape: () => shape,
        unknownKeys: "strip",
        catchall: ZodNever.create(),
        typeName: ZodFirstPartyTypeKind.ZodObject,
        ...processCreateParams(params)
      });
    };
    ZodObject.strictCreate = (shape, params) => {
      return new ZodObject({
        shape: () => shape,
        unknownKeys: "strict",
        catchall: ZodNever.create(),
        typeName: ZodFirstPartyTypeKind.ZodObject,
        ...processCreateParams(params)
      });
    };
    ZodObject.lazycreate = (shape, params) => {
      return new ZodObject({
        shape,
        unknownKeys: "strip",
        catchall: ZodNever.create(),
        typeName: ZodFirstPartyTypeKind.ZodObject,
        ...processCreateParams(params)
      });
    };
    ZodUnion = class extends ZodType {
      _parse(input) {
        const { ctx } = this._processInputParams(input);
        const options = this._def.options;
        function handleResults(results) {
          for (const result of results) {
            if (result.result.status === "valid") {
              return result.result;
            }
          }
          for (const result of results) {
            if (result.result.status === "dirty") {
              ctx.common.issues.push(...result.ctx.common.issues);
              return result.result;
            }
          }
          const unionErrors = results.map((result) => new ZodError(result.ctx.common.issues));
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_union,
            unionErrors
          });
          return INVALID;
        }
        if (ctx.common.async) {
          return Promise.all(options.map(async (option) => {
            const childCtx = {
              ...ctx,
              common: {
                ...ctx.common,
                issues: []
              },
              parent: null
            };
            return {
              result: await option._parseAsync({
                data: ctx.data,
                path: ctx.path,
                parent: childCtx
              }),
              ctx: childCtx
            };
          })).then(handleResults);
        } else {
          let dirty = void 0;
          const issues = [];
          for (const option of options) {
            const childCtx = {
              ...ctx,
              common: {
                ...ctx.common,
                issues: []
              },
              parent: null
            };
            const result = option._parseSync({
              data: ctx.data,
              path: ctx.path,
              parent: childCtx
            });
            if (result.status === "valid") {
              return result;
            } else if (result.status === "dirty" && !dirty) {
              dirty = { result, ctx: childCtx };
            }
            if (childCtx.common.issues.length) {
              issues.push(childCtx.common.issues);
            }
          }
          if (dirty) {
            ctx.common.issues.push(...dirty.ctx.common.issues);
            return dirty.result;
          }
          const unionErrors = issues.map((issues2) => new ZodError(issues2));
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_union,
            unionErrors
          });
          return INVALID;
        }
      }
      get options() {
        return this._def.options;
      }
    };
    ZodUnion.create = (types2, params) => {
      return new ZodUnion({
        options: types2,
        typeName: ZodFirstPartyTypeKind.ZodUnion,
        ...processCreateParams(params)
      });
    };
    getDiscriminator = (type) => {
      if (type instanceof ZodLazy) {
        return getDiscriminator(type.schema);
      } else if (type instanceof ZodEffects) {
        return getDiscriminator(type.innerType());
      } else if (type instanceof ZodLiteral) {
        return [type.value];
      } else if (type instanceof ZodEnum) {
        return type.options;
      } else if (type instanceof ZodNativeEnum) {
        return util.objectValues(type.enum);
      } else if (type instanceof ZodDefault) {
        return getDiscriminator(type._def.innerType);
      } else if (type instanceof ZodUndefined) {
        return [void 0];
      } else if (type instanceof ZodNull) {
        return [null];
      } else if (type instanceof ZodOptional) {
        return [void 0, ...getDiscriminator(type.unwrap())];
      } else if (type instanceof ZodNullable) {
        return [null, ...getDiscriminator(type.unwrap())];
      } else if (type instanceof ZodBranded) {
        return getDiscriminator(type.unwrap());
      } else if (type instanceof ZodReadonly) {
        return getDiscriminator(type.unwrap());
      } else if (type instanceof ZodCatch) {
        return getDiscriminator(type._def.innerType);
      } else {
        return [];
      }
    };
    ZodDiscriminatedUnion = class _ZodDiscriminatedUnion extends ZodType {
      _parse(input) {
        const { ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.object) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.object,
            received: ctx.parsedType
          });
          return INVALID;
        }
        const discriminator = this.discriminator;
        const discriminatorValue = ctx.data[discriminator];
        const option = this.optionsMap.get(discriminatorValue);
        if (!option) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_union_discriminator,
            options: Array.from(this.optionsMap.keys()),
            path: [discriminator]
          });
          return INVALID;
        }
        if (ctx.common.async) {
          return option._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          });
        } else {
          return option._parseSync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          });
        }
      }
      get discriminator() {
        return this._def.discriminator;
      }
      get options() {
        return this._def.options;
      }
      get optionsMap() {
        return this._def.optionsMap;
      }
      /**
       * The constructor of the discriminated union schema. Its behaviour is very similar to that of the normal z.union() constructor.
       * However, it only allows a union of objects, all of which need to share a discriminator property. This property must
       * have a different value for each object in the union.
       * @param discriminator the name of the discriminator property
       * @param types an array of object schemas
       * @param params
       */
      static create(discriminator, options, params) {
        const optionsMap = /* @__PURE__ */ new Map();
        for (const type of options) {
          const discriminatorValues = getDiscriminator(type.shape[discriminator]);
          if (!discriminatorValues.length) {
            throw new Error(`A discriminator value for key \`${discriminator}\` could not be extracted from all schema options`);
          }
          for (const value of discriminatorValues) {
            if (optionsMap.has(value)) {
              throw new Error(`Discriminator property ${String(discriminator)} has duplicate value ${String(value)}`);
            }
            optionsMap.set(value, type);
          }
        }
        return new _ZodDiscriminatedUnion({
          typeName: ZodFirstPartyTypeKind.ZodDiscriminatedUnion,
          discriminator,
          options,
          optionsMap,
          ...processCreateParams(params)
        });
      }
    };
    ZodIntersection = class extends ZodType {
      _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        const handleParsed = (parsedLeft, parsedRight) => {
          if (isAborted(parsedLeft) || isAborted(parsedRight)) {
            return INVALID;
          }
          const merged = mergeValues(parsedLeft.value, parsedRight.value);
          if (!merged.valid) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_intersection_types
            });
            return INVALID;
          }
          if (isDirty(parsedLeft) || isDirty(parsedRight)) {
            status.dirty();
          }
          return { status: status.value, value: merged.data };
        };
        if (ctx.common.async) {
          return Promise.all([
            this._def.left._parseAsync({
              data: ctx.data,
              path: ctx.path,
              parent: ctx
            }),
            this._def.right._parseAsync({
              data: ctx.data,
              path: ctx.path,
              parent: ctx
            })
          ]).then(([left, right]) => handleParsed(left, right));
        } else {
          return handleParsed(this._def.left._parseSync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          }), this._def.right._parseSync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          }));
        }
      }
    };
    ZodIntersection.create = (left, right, params) => {
      return new ZodIntersection({
        left,
        right,
        typeName: ZodFirstPartyTypeKind.ZodIntersection,
        ...processCreateParams(params)
      });
    };
    ZodTuple = class _ZodTuple extends ZodType {
      _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.array) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.array,
            received: ctx.parsedType
          });
          return INVALID;
        }
        if (ctx.data.length < this._def.items.length) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: this._def.items.length,
            inclusive: true,
            exact: false,
            type: "array"
          });
          return INVALID;
        }
        const rest = this._def.rest;
        if (!rest && ctx.data.length > this._def.items.length) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: this._def.items.length,
            inclusive: true,
            exact: false,
            type: "array"
          });
          status.dirty();
        }
        const items = [...ctx.data].map((item, itemIndex) => {
          const schema = this._def.items[itemIndex] || this._def.rest;
          if (!schema)
            return null;
          return schema._parse(new ParseInputLazyPath(ctx, item, ctx.path, itemIndex));
        }).filter((x) => !!x);
        if (ctx.common.async) {
          return Promise.all(items).then((results) => {
            return ParseStatus.mergeArray(status, results);
          });
        } else {
          return ParseStatus.mergeArray(status, items);
        }
      }
      get items() {
        return this._def.items;
      }
      rest(rest) {
        return new _ZodTuple({
          ...this._def,
          rest
        });
      }
    };
    ZodTuple.create = (schemas, params) => {
      if (!Array.isArray(schemas)) {
        throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
      }
      return new ZodTuple({
        items: schemas,
        typeName: ZodFirstPartyTypeKind.ZodTuple,
        rest: null,
        ...processCreateParams(params)
      });
    };
    ZodRecord = class _ZodRecord extends ZodType {
      get keySchema() {
        return this._def.keyType;
      }
      get valueSchema() {
        return this._def.valueType;
      }
      _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.object) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.object,
            received: ctx.parsedType
          });
          return INVALID;
        }
        const pairs = [];
        const keyType = this._def.keyType;
        const valueType = this._def.valueType;
        for (const key2 in ctx.data) {
          pairs.push({
            key: keyType._parse(new ParseInputLazyPath(ctx, key2, ctx.path, key2)),
            value: valueType._parse(new ParseInputLazyPath(ctx, ctx.data[key2], ctx.path, key2)),
            alwaysSet: key2 in ctx.data
          });
        }
        if (ctx.common.async) {
          return ParseStatus.mergeObjectAsync(status, pairs);
        } else {
          return ParseStatus.mergeObjectSync(status, pairs);
        }
      }
      get element() {
        return this._def.valueType;
      }
      static create(first, second, third) {
        if (second instanceof ZodType) {
          return new _ZodRecord({
            keyType: first,
            valueType: second,
            typeName: ZodFirstPartyTypeKind.ZodRecord,
            ...processCreateParams(third)
          });
        }
        return new _ZodRecord({
          keyType: ZodString.create(),
          valueType: first,
          typeName: ZodFirstPartyTypeKind.ZodRecord,
          ...processCreateParams(second)
        });
      }
    };
    ZodMap = class extends ZodType {
      get keySchema() {
        return this._def.keyType;
      }
      get valueSchema() {
        return this._def.valueType;
      }
      _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.map) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.map,
            received: ctx.parsedType
          });
          return INVALID;
        }
        const keyType = this._def.keyType;
        const valueType = this._def.valueType;
        const pairs = [...ctx.data.entries()].map(([key2, value], index2) => {
          return {
            key: keyType._parse(new ParseInputLazyPath(ctx, key2, ctx.path, [index2, "key"])),
            value: valueType._parse(new ParseInputLazyPath(ctx, value, ctx.path, [index2, "value"]))
          };
        });
        if (ctx.common.async) {
          const finalMap = /* @__PURE__ */ new Map();
          return Promise.resolve().then(async () => {
            for (const pair of pairs) {
              const key2 = await pair.key;
              const value = await pair.value;
              if (key2.status === "aborted" || value.status === "aborted") {
                return INVALID;
              }
              if (key2.status === "dirty" || value.status === "dirty") {
                status.dirty();
              }
              finalMap.set(key2.value, value.value);
            }
            return { status: status.value, value: finalMap };
          });
        } else {
          const finalMap = /* @__PURE__ */ new Map();
          for (const pair of pairs) {
            const key2 = pair.key;
            const value = pair.value;
            if (key2.status === "aborted" || value.status === "aborted") {
              return INVALID;
            }
            if (key2.status === "dirty" || value.status === "dirty") {
              status.dirty();
            }
            finalMap.set(key2.value, value.value);
          }
          return { status: status.value, value: finalMap };
        }
      }
    };
    ZodMap.create = (keyType, valueType, params) => {
      return new ZodMap({
        valueType,
        keyType,
        typeName: ZodFirstPartyTypeKind.ZodMap,
        ...processCreateParams(params)
      });
    };
    ZodSet = class _ZodSet extends ZodType {
      _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.set) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.set,
            received: ctx.parsedType
          });
          return INVALID;
        }
        const def = this._def;
        if (def.minSize !== null) {
          if (ctx.data.size < def.minSize.value) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: def.minSize.value,
              type: "set",
              inclusive: true,
              exact: false,
              message: def.minSize.message
            });
            status.dirty();
          }
        }
        if (def.maxSize !== null) {
          if (ctx.data.size > def.maxSize.value) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: def.maxSize.value,
              type: "set",
              inclusive: true,
              exact: false,
              message: def.maxSize.message
            });
            status.dirty();
          }
        }
        const valueType = this._def.valueType;
        function finalizeSet(elements2) {
          const parsedSet = /* @__PURE__ */ new Set();
          for (const element of elements2) {
            if (element.status === "aborted")
              return INVALID;
            if (element.status === "dirty")
              status.dirty();
            parsedSet.add(element.value);
          }
          return { status: status.value, value: parsedSet };
        }
        const elements = [...ctx.data.values()].map((item, i) => valueType._parse(new ParseInputLazyPath(ctx, item, ctx.path, i)));
        if (ctx.common.async) {
          return Promise.all(elements).then((elements2) => finalizeSet(elements2));
        } else {
          return finalizeSet(elements);
        }
      }
      min(minSize, message) {
        return new _ZodSet({
          ...this._def,
          minSize: { value: minSize, message: errorUtil.toString(message) }
        });
      }
      max(maxSize, message) {
        return new _ZodSet({
          ...this._def,
          maxSize: { value: maxSize, message: errorUtil.toString(message) }
        });
      }
      size(size, message) {
        return this.min(size, message).max(size, message);
      }
      nonempty(message) {
        return this.min(1, message);
      }
    };
    ZodSet.create = (valueType, params) => {
      return new ZodSet({
        valueType,
        minSize: null,
        maxSize: null,
        typeName: ZodFirstPartyTypeKind.ZodSet,
        ...processCreateParams(params)
      });
    };
    ZodFunction = class _ZodFunction extends ZodType {
      constructor() {
        super(...arguments);
        this.validate = this.implement;
      }
      _parse(input) {
        const { ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.function) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.function,
            received: ctx.parsedType
          });
          return INVALID;
        }
        function makeArgsIssue(args, error) {
          return makeIssue({
            data: args,
            path: ctx.path,
            errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
            issueData: {
              code: ZodIssueCode.invalid_arguments,
              argumentsError: error
            }
          });
        }
        function makeReturnsIssue(returns, error) {
          return makeIssue({
            data: returns,
            path: ctx.path,
            errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
            issueData: {
              code: ZodIssueCode.invalid_return_type,
              returnTypeError: error
            }
          });
        }
        const params = { errorMap: ctx.common.contextualErrorMap };
        const fn = ctx.data;
        if (this._def.returns instanceof ZodPromise) {
          const me = this;
          return OK(async function(...args) {
            const error = new ZodError([]);
            const parsedArgs = await me._def.args.parseAsync(args, params).catch((e) => {
              error.addIssue(makeArgsIssue(args, e));
              throw error;
            });
            const result = await Reflect.apply(fn, this, parsedArgs);
            const parsedReturns = await me._def.returns._def.type.parseAsync(result, params).catch((e) => {
              error.addIssue(makeReturnsIssue(result, e));
              throw error;
            });
            return parsedReturns;
          });
        } else {
          const me = this;
          return OK(function(...args) {
            const parsedArgs = me._def.args.safeParse(args, params);
            if (!parsedArgs.success) {
              throw new ZodError([makeArgsIssue(args, parsedArgs.error)]);
            }
            const result = Reflect.apply(fn, this, parsedArgs.data);
            const parsedReturns = me._def.returns.safeParse(result, params);
            if (!parsedReturns.success) {
              throw new ZodError([makeReturnsIssue(result, parsedReturns.error)]);
            }
            return parsedReturns.data;
          });
        }
      }
      parameters() {
        return this._def.args;
      }
      returnType() {
        return this._def.returns;
      }
      args(...items) {
        return new _ZodFunction({
          ...this._def,
          args: ZodTuple.create(items).rest(ZodUnknown.create())
        });
      }
      returns(returnType) {
        return new _ZodFunction({
          ...this._def,
          returns: returnType
        });
      }
      implement(func) {
        const validatedFunc = this.parse(func);
        return validatedFunc;
      }
      strictImplement(func) {
        const validatedFunc = this.parse(func);
        return validatedFunc;
      }
      static create(args, returns, params) {
        return new _ZodFunction({
          args: args ? args : ZodTuple.create([]).rest(ZodUnknown.create()),
          returns: returns || ZodUnknown.create(),
          typeName: ZodFirstPartyTypeKind.ZodFunction,
          ...processCreateParams(params)
        });
      }
    };
    ZodLazy = class extends ZodType {
      get schema() {
        return this._def.getter();
      }
      _parse(input) {
        const { ctx } = this._processInputParams(input);
        const lazySchema = this._def.getter();
        return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
      }
    };
    ZodLazy.create = (getter, params) => {
      return new ZodLazy({
        getter,
        typeName: ZodFirstPartyTypeKind.ZodLazy,
        ...processCreateParams(params)
      });
    };
    ZodLiteral = class extends ZodType {
      _parse(input) {
        if (input.data !== this._def.value) {
          const ctx = this._getOrReturnCtx(input);
          addIssueToContext(ctx, {
            received: ctx.data,
            code: ZodIssueCode.invalid_literal,
            expected: this._def.value
          });
          return INVALID;
        }
        return { status: "valid", value: input.data };
      }
      get value() {
        return this._def.value;
      }
    };
    ZodLiteral.create = (value, params) => {
      return new ZodLiteral({
        value,
        typeName: ZodFirstPartyTypeKind.ZodLiteral,
        ...processCreateParams(params)
      });
    };
    ZodEnum = class _ZodEnum extends ZodType {
      _parse(input) {
        if (typeof input.data !== "string") {
          const ctx = this._getOrReturnCtx(input);
          const expectedValues = this._def.values;
          addIssueToContext(ctx, {
            expected: util.joinValues(expectedValues),
            received: ctx.parsedType,
            code: ZodIssueCode.invalid_type
          });
          return INVALID;
        }
        if (!this._cache) {
          this._cache = new Set(this._def.values);
        }
        if (!this._cache.has(input.data)) {
          const ctx = this._getOrReturnCtx(input);
          const expectedValues = this._def.values;
          addIssueToContext(ctx, {
            received: ctx.data,
            code: ZodIssueCode.invalid_enum_value,
            options: expectedValues
          });
          return INVALID;
        }
        return OK(input.data);
      }
      get options() {
        return this._def.values;
      }
      get enum() {
        const enumValues = {};
        for (const val of this._def.values) {
          enumValues[val] = val;
        }
        return enumValues;
      }
      get Values() {
        const enumValues = {};
        for (const val of this._def.values) {
          enumValues[val] = val;
        }
        return enumValues;
      }
      get Enum() {
        const enumValues = {};
        for (const val of this._def.values) {
          enumValues[val] = val;
        }
        return enumValues;
      }
      extract(values, newDef = this._def) {
        return _ZodEnum.create(values, {
          ...this._def,
          ...newDef
        });
      }
      exclude(values, newDef = this._def) {
        return _ZodEnum.create(this.options.filter((opt) => !values.includes(opt)), {
          ...this._def,
          ...newDef
        });
      }
    };
    ZodEnum.create = createZodEnum;
    ZodNativeEnum = class extends ZodType {
      _parse(input) {
        const nativeEnumValues = util.getValidEnumValues(this._def.values);
        const ctx = this._getOrReturnCtx(input);
        if (ctx.parsedType !== ZodParsedType.string && ctx.parsedType !== ZodParsedType.number) {
          const expectedValues = util.objectValues(nativeEnumValues);
          addIssueToContext(ctx, {
            expected: util.joinValues(expectedValues),
            received: ctx.parsedType,
            code: ZodIssueCode.invalid_type
          });
          return INVALID;
        }
        if (!this._cache) {
          this._cache = new Set(util.getValidEnumValues(this._def.values));
        }
        if (!this._cache.has(input.data)) {
          const expectedValues = util.objectValues(nativeEnumValues);
          addIssueToContext(ctx, {
            received: ctx.data,
            code: ZodIssueCode.invalid_enum_value,
            options: expectedValues
          });
          return INVALID;
        }
        return OK(input.data);
      }
      get enum() {
        return this._def.values;
      }
    };
    ZodNativeEnum.create = (values, params) => {
      return new ZodNativeEnum({
        values,
        typeName: ZodFirstPartyTypeKind.ZodNativeEnum,
        ...processCreateParams(params)
      });
    };
    ZodPromise = class extends ZodType {
      unwrap() {
        return this._def.type;
      }
      _parse(input) {
        const { ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.promise && ctx.common.async === false) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.promise,
            received: ctx.parsedType
          });
          return INVALID;
        }
        const promisified = ctx.parsedType === ZodParsedType.promise ? ctx.data : Promise.resolve(ctx.data);
        return OK(promisified.then((data2) => {
          return this._def.type.parseAsync(data2, {
            path: ctx.path,
            errorMap: ctx.common.contextualErrorMap
          });
        }));
      }
    };
    ZodPromise.create = (schema, params) => {
      return new ZodPromise({
        type: schema,
        typeName: ZodFirstPartyTypeKind.ZodPromise,
        ...processCreateParams(params)
      });
    };
    ZodEffects = class extends ZodType {
      innerType() {
        return this._def.schema;
      }
      sourceType() {
        return this._def.schema._def.typeName === ZodFirstPartyTypeKind.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
      }
      _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        const effect = this._def.effect || null;
        const checkCtx = {
          addIssue: (arg) => {
            addIssueToContext(ctx, arg);
            if (arg.fatal) {
              status.abort();
            } else {
              status.dirty();
            }
          },
          get path() {
            return ctx.path;
          }
        };
        checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
        if (effect.type === "preprocess") {
          const processed = effect.transform(ctx.data, checkCtx);
          if (ctx.common.async) {
            return Promise.resolve(processed).then(async (processed2) => {
              if (status.value === "aborted")
                return INVALID;
              const result = await this._def.schema._parseAsync({
                data: processed2,
                path: ctx.path,
                parent: ctx
              });
              if (result.status === "aborted")
                return INVALID;
              if (result.status === "dirty")
                return DIRTY(result.value);
              if (status.value === "dirty")
                return DIRTY(result.value);
              return result;
            });
          } else {
            if (status.value === "aborted")
              return INVALID;
            const result = this._def.schema._parseSync({
              data: processed,
              path: ctx.path,
              parent: ctx
            });
            if (result.status === "aborted")
              return INVALID;
            if (result.status === "dirty")
              return DIRTY(result.value);
            if (status.value === "dirty")
              return DIRTY(result.value);
            return result;
          }
        }
        if (effect.type === "refinement") {
          const executeRefinement = (acc) => {
            const result = effect.refinement(acc, checkCtx);
            if (ctx.common.async) {
              return Promise.resolve(result);
            }
            if (result instanceof Promise) {
              throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
            }
            return acc;
          };
          if (ctx.common.async === false) {
            const inner = this._def.schema._parseSync({
              data: ctx.data,
              path: ctx.path,
              parent: ctx
            });
            if (inner.status === "aborted")
              return INVALID;
            if (inner.status === "dirty")
              status.dirty();
            executeRefinement(inner.value);
            return { status: status.value, value: inner.value };
          } else {
            return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((inner) => {
              if (inner.status === "aborted")
                return INVALID;
              if (inner.status === "dirty")
                status.dirty();
              return executeRefinement(inner.value).then(() => {
                return { status: status.value, value: inner.value };
              });
            });
          }
        }
        if (effect.type === "transform") {
          if (ctx.common.async === false) {
            const base = this._def.schema._parseSync({
              data: ctx.data,
              path: ctx.path,
              parent: ctx
            });
            if (!isValid(base))
              return INVALID;
            const result = effect.transform(base.value, checkCtx);
            if (result instanceof Promise) {
              throw new Error(`Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`);
            }
            return { status: status.value, value: result };
          } else {
            return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((base) => {
              if (!isValid(base))
                return INVALID;
              return Promise.resolve(effect.transform(base.value, checkCtx)).then((result) => ({
                status: status.value,
                value: result
              }));
            });
          }
        }
        util.assertNever(effect);
      }
    };
    ZodEffects.create = (schema, effect, params) => {
      return new ZodEffects({
        schema,
        typeName: ZodFirstPartyTypeKind.ZodEffects,
        effect,
        ...processCreateParams(params)
      });
    };
    ZodEffects.createWithPreprocess = (preprocess, schema, params) => {
      return new ZodEffects({
        schema,
        effect: { type: "preprocess", transform: preprocess },
        typeName: ZodFirstPartyTypeKind.ZodEffects,
        ...processCreateParams(params)
      });
    };
    ZodOptional = class extends ZodType {
      _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType === ZodParsedType.undefined) {
          return OK(void 0);
        }
        return this._def.innerType._parse(input);
      }
      unwrap() {
        return this._def.innerType;
      }
    };
    ZodOptional.create = (type, params) => {
      return new ZodOptional({
        innerType: type,
        typeName: ZodFirstPartyTypeKind.ZodOptional,
        ...processCreateParams(params)
      });
    };
    ZodNullable = class extends ZodType {
      _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType === ZodParsedType.null) {
          return OK(null);
        }
        return this._def.innerType._parse(input);
      }
      unwrap() {
        return this._def.innerType;
      }
    };
    ZodNullable.create = (type, params) => {
      return new ZodNullable({
        innerType: type,
        typeName: ZodFirstPartyTypeKind.ZodNullable,
        ...processCreateParams(params)
      });
    };
    ZodDefault = class extends ZodType {
      _parse(input) {
        const { ctx } = this._processInputParams(input);
        let data2 = ctx.data;
        if (ctx.parsedType === ZodParsedType.undefined) {
          data2 = this._def.defaultValue();
        }
        return this._def.innerType._parse({
          data: data2,
          path: ctx.path,
          parent: ctx
        });
      }
      removeDefault() {
        return this._def.innerType;
      }
    };
    ZodDefault.create = (type, params) => {
      return new ZodDefault({
        innerType: type,
        typeName: ZodFirstPartyTypeKind.ZodDefault,
        defaultValue: typeof params.default === "function" ? params.default : () => params.default,
        ...processCreateParams(params)
      });
    };
    ZodCatch = class extends ZodType {
      _parse(input) {
        const { ctx } = this._processInputParams(input);
        const newCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          }
        };
        const result = this._def.innerType._parse({
          data: newCtx.data,
          path: newCtx.path,
          parent: {
            ...newCtx
          }
        });
        if (isAsync(result)) {
          return result.then((result2) => {
            return {
              status: "valid",
              value: result2.status === "valid" ? result2.value : this._def.catchValue({
                get error() {
                  return new ZodError(newCtx.common.issues);
                },
                input: newCtx.data
              })
            };
          });
        } else {
          return {
            status: "valid",
            value: result.status === "valid" ? result.value : this._def.catchValue({
              get error() {
                return new ZodError(newCtx.common.issues);
              },
              input: newCtx.data
            })
          };
        }
      }
      removeCatch() {
        return this._def.innerType;
      }
    };
    ZodCatch.create = (type, params) => {
      return new ZodCatch({
        innerType: type,
        typeName: ZodFirstPartyTypeKind.ZodCatch,
        catchValue: typeof params.catch === "function" ? params.catch : () => params.catch,
        ...processCreateParams(params)
      });
    };
    ZodNaN = class extends ZodType {
      _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.nan) {
          const ctx = this._getOrReturnCtx(input);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.nan,
            received: ctx.parsedType
          });
          return INVALID;
        }
        return { status: "valid", value: input.data };
      }
    };
    ZodNaN.create = (params) => {
      return new ZodNaN({
        typeName: ZodFirstPartyTypeKind.ZodNaN,
        ...processCreateParams(params)
      });
    };
    BRAND = /* @__PURE__ */ Symbol("zod_brand");
    ZodBranded = class extends ZodType {
      _parse(input) {
        const { ctx } = this._processInputParams(input);
        const data2 = ctx.data;
        return this._def.type._parse({
          data: data2,
          path: ctx.path,
          parent: ctx
        });
      }
      unwrap() {
        return this._def.type;
      }
    };
    ZodPipeline = class _ZodPipeline extends ZodType {
      _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        if (ctx.common.async) {
          const handleAsync = async () => {
            const inResult = await this._def.in._parseAsync({
              data: ctx.data,
              path: ctx.path,
              parent: ctx
            });
            if (inResult.status === "aborted")
              return INVALID;
            if (inResult.status === "dirty") {
              status.dirty();
              return DIRTY(inResult.value);
            } else {
              return this._def.out._parseAsync({
                data: inResult.value,
                path: ctx.path,
                parent: ctx
              });
            }
          };
          return handleAsync();
        } else {
          const inResult = this._def.in._parseSync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          });
          if (inResult.status === "aborted")
            return INVALID;
          if (inResult.status === "dirty") {
            status.dirty();
            return {
              status: "dirty",
              value: inResult.value
            };
          } else {
            return this._def.out._parseSync({
              data: inResult.value,
              path: ctx.path,
              parent: ctx
            });
          }
        }
      }
      static create(a, b) {
        return new _ZodPipeline({
          in: a,
          out: b,
          typeName: ZodFirstPartyTypeKind.ZodPipeline
        });
      }
    };
    ZodReadonly = class extends ZodType {
      _parse(input) {
        const result = this._def.innerType._parse(input);
        const freeze = (data2) => {
          if (isValid(data2)) {
            data2.value = Object.freeze(data2.value);
          }
          return data2;
        };
        return isAsync(result) ? result.then((data2) => freeze(data2)) : freeze(result);
      }
      unwrap() {
        return this._def.innerType;
      }
    };
    ZodReadonly.create = (type, params) => {
      return new ZodReadonly({
        innerType: type,
        typeName: ZodFirstPartyTypeKind.ZodReadonly,
        ...processCreateParams(params)
      });
    };
    late = {
      object: ZodObject.lazycreate
    };
    (function(ZodFirstPartyTypeKind2) {
      ZodFirstPartyTypeKind2["ZodString"] = "ZodString";
      ZodFirstPartyTypeKind2["ZodNumber"] = "ZodNumber";
      ZodFirstPartyTypeKind2["ZodNaN"] = "ZodNaN";
      ZodFirstPartyTypeKind2["ZodBigInt"] = "ZodBigInt";
      ZodFirstPartyTypeKind2["ZodBoolean"] = "ZodBoolean";
      ZodFirstPartyTypeKind2["ZodDate"] = "ZodDate";
      ZodFirstPartyTypeKind2["ZodSymbol"] = "ZodSymbol";
      ZodFirstPartyTypeKind2["ZodUndefined"] = "ZodUndefined";
      ZodFirstPartyTypeKind2["ZodNull"] = "ZodNull";
      ZodFirstPartyTypeKind2["ZodAny"] = "ZodAny";
      ZodFirstPartyTypeKind2["ZodUnknown"] = "ZodUnknown";
      ZodFirstPartyTypeKind2["ZodNever"] = "ZodNever";
      ZodFirstPartyTypeKind2["ZodVoid"] = "ZodVoid";
      ZodFirstPartyTypeKind2["ZodArray"] = "ZodArray";
      ZodFirstPartyTypeKind2["ZodObject"] = "ZodObject";
      ZodFirstPartyTypeKind2["ZodUnion"] = "ZodUnion";
      ZodFirstPartyTypeKind2["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
      ZodFirstPartyTypeKind2["ZodIntersection"] = "ZodIntersection";
      ZodFirstPartyTypeKind2["ZodTuple"] = "ZodTuple";
      ZodFirstPartyTypeKind2["ZodRecord"] = "ZodRecord";
      ZodFirstPartyTypeKind2["ZodMap"] = "ZodMap";
      ZodFirstPartyTypeKind2["ZodSet"] = "ZodSet";
      ZodFirstPartyTypeKind2["ZodFunction"] = "ZodFunction";
      ZodFirstPartyTypeKind2["ZodLazy"] = "ZodLazy";
      ZodFirstPartyTypeKind2["ZodLiteral"] = "ZodLiteral";
      ZodFirstPartyTypeKind2["ZodEnum"] = "ZodEnum";
      ZodFirstPartyTypeKind2["ZodEffects"] = "ZodEffects";
      ZodFirstPartyTypeKind2["ZodNativeEnum"] = "ZodNativeEnum";
      ZodFirstPartyTypeKind2["ZodOptional"] = "ZodOptional";
      ZodFirstPartyTypeKind2["ZodNullable"] = "ZodNullable";
      ZodFirstPartyTypeKind2["ZodDefault"] = "ZodDefault";
      ZodFirstPartyTypeKind2["ZodCatch"] = "ZodCatch";
      ZodFirstPartyTypeKind2["ZodPromise"] = "ZodPromise";
      ZodFirstPartyTypeKind2["ZodBranded"] = "ZodBranded";
      ZodFirstPartyTypeKind2["ZodPipeline"] = "ZodPipeline";
      ZodFirstPartyTypeKind2["ZodReadonly"] = "ZodReadonly";
    })(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));
    instanceOfType = (cls, params = {
      message: `Input not instance of ${cls.name}`
    }) => custom((data2) => data2 instanceof cls, params);
    stringType = ZodString.create;
    numberType = ZodNumber.create;
    nanType = ZodNaN.create;
    bigIntType = ZodBigInt.create;
    booleanType = ZodBoolean.create;
    dateType = ZodDate.create;
    symbolType = ZodSymbol.create;
    undefinedType = ZodUndefined.create;
    nullType = ZodNull.create;
    anyType = ZodAny.create;
    unknownType = ZodUnknown.create;
    neverType = ZodNever.create;
    voidType = ZodVoid.create;
    arrayType = ZodArray.create;
    objectType = ZodObject.create;
    strictObjectType = ZodObject.strictCreate;
    unionType = ZodUnion.create;
    discriminatedUnionType = ZodDiscriminatedUnion.create;
    intersectionType = ZodIntersection.create;
    tupleType = ZodTuple.create;
    recordType = ZodRecord.create;
    mapType = ZodMap.create;
    setType = ZodSet.create;
    functionType = ZodFunction.create;
    lazyType = ZodLazy.create;
    literalType = ZodLiteral.create;
    enumType = ZodEnum.create;
    nativeEnumType = ZodNativeEnum.create;
    promiseType = ZodPromise.create;
    effectsType = ZodEffects.create;
    optionalType = ZodOptional.create;
    nullableType = ZodNullable.create;
    preprocessType = ZodEffects.createWithPreprocess;
    pipelineType = ZodPipeline.create;
    ostring = () => stringType().optional();
    onumber = () => numberType().optional();
    oboolean = () => booleanType().optional();
    coerce = {
      string: ((arg) => ZodString.create({ ...arg, coerce: true })),
      number: ((arg) => ZodNumber.create({ ...arg, coerce: true })),
      boolean: ((arg) => ZodBoolean.create({
        ...arg,
        coerce: true
      })),
      bigint: ((arg) => ZodBigInt.create({ ...arg, coerce: true })),
      date: ((arg) => ZodDate.create({ ...arg, coerce: true }))
    };
    NEVER = INVALID;
  }
});

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/external.js
var external_exports = {};
__export(external_exports, {
  BRAND: () => BRAND,
  DIRTY: () => DIRTY,
  EMPTY_PATH: () => EMPTY_PATH,
  INVALID: () => INVALID,
  NEVER: () => NEVER,
  OK: () => OK,
  ParseStatus: () => ParseStatus,
  Schema: () => ZodType,
  ZodAny: () => ZodAny,
  ZodArray: () => ZodArray,
  ZodBigInt: () => ZodBigInt,
  ZodBoolean: () => ZodBoolean,
  ZodBranded: () => ZodBranded,
  ZodCatch: () => ZodCatch,
  ZodDate: () => ZodDate,
  ZodDefault: () => ZodDefault,
  ZodDiscriminatedUnion: () => ZodDiscriminatedUnion,
  ZodEffects: () => ZodEffects,
  ZodEnum: () => ZodEnum,
  ZodError: () => ZodError,
  ZodFirstPartyTypeKind: () => ZodFirstPartyTypeKind,
  ZodFunction: () => ZodFunction,
  ZodIntersection: () => ZodIntersection,
  ZodIssueCode: () => ZodIssueCode,
  ZodLazy: () => ZodLazy,
  ZodLiteral: () => ZodLiteral,
  ZodMap: () => ZodMap,
  ZodNaN: () => ZodNaN,
  ZodNativeEnum: () => ZodNativeEnum,
  ZodNever: () => ZodNever,
  ZodNull: () => ZodNull,
  ZodNullable: () => ZodNullable,
  ZodNumber: () => ZodNumber,
  ZodObject: () => ZodObject,
  ZodOptional: () => ZodOptional,
  ZodParsedType: () => ZodParsedType,
  ZodPipeline: () => ZodPipeline,
  ZodPromise: () => ZodPromise,
  ZodReadonly: () => ZodReadonly,
  ZodRecord: () => ZodRecord,
  ZodSchema: () => ZodType,
  ZodSet: () => ZodSet,
  ZodString: () => ZodString,
  ZodSymbol: () => ZodSymbol,
  ZodTransformer: () => ZodEffects,
  ZodTuple: () => ZodTuple,
  ZodType: () => ZodType,
  ZodUndefined: () => ZodUndefined,
  ZodUnion: () => ZodUnion,
  ZodUnknown: () => ZodUnknown,
  ZodVoid: () => ZodVoid,
  addIssueToContext: () => addIssueToContext,
  any: () => anyType,
  array: () => arrayType,
  bigint: () => bigIntType,
  boolean: () => booleanType,
  coerce: () => coerce,
  custom: () => custom,
  date: () => dateType,
  datetimeRegex: () => datetimeRegex,
  defaultErrorMap: () => en_default,
  discriminatedUnion: () => discriminatedUnionType,
  effect: () => effectsType,
  enum: () => enumType,
  function: () => functionType,
  getErrorMap: () => getErrorMap,
  getParsedType: () => getParsedType,
  instanceof: () => instanceOfType,
  intersection: () => intersectionType,
  isAborted: () => isAborted,
  isAsync: () => isAsync,
  isDirty: () => isDirty,
  isValid: () => isValid,
  late: () => late,
  lazy: () => lazyType,
  literal: () => literalType,
  makeIssue: () => makeIssue,
  map: () => mapType,
  nan: () => nanType,
  nativeEnum: () => nativeEnumType,
  never: () => neverType,
  null: () => nullType,
  nullable: () => nullableType,
  number: () => numberType,
  object: () => objectType,
  objectUtil: () => objectUtil,
  oboolean: () => oboolean,
  onumber: () => onumber,
  optional: () => optionalType,
  ostring: () => ostring,
  pipeline: () => pipelineType,
  preprocess: () => preprocessType,
  promise: () => promiseType,
  quotelessJson: () => quotelessJson,
  record: () => recordType,
  set: () => setType,
  setErrorMap: () => setErrorMap,
  strictObject: () => strictObjectType,
  string: () => stringType,
  symbol: () => symbolType,
  transformer: () => effectsType,
  tuple: () => tupleType,
  undefined: () => undefinedType,
  union: () => unionType,
  unknown: () => unknownType,
  util: () => util,
  void: () => voidType
});
var init_external = __esm({
  "../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/external.js"() {
    init_errors2();
    init_parseUtil();
    init_typeAliases();
    init_util();
    init_types();
    init_ZodError();
  }
});

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/index.js
var init_zod = __esm({
  "../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/index.js"() {
    init_external();
    init_external();
  }
});

// src/lib/http.ts
function assert(value, status, message) {
  if (!value) throw new HttpError(status, message);
}
function parse(schema, value) {
  validateDates(value);
  if (value?.mobile) assert(/^\+[1-9][0-9]{7,14}$/.test(value.mobile), 400, "Mobile must use international format, for example +919876543210");
  return normalizeDates(schema.parse(value));
}
function validateDates(value) {
  for (const key2 of ["date", "from", "to", "dateOfBirth"]) {
    if (value?.[key2] !== void 0) {
      const v = value[key2];
      assert(typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v, 400, `Invalid ${key2}; expected YYYY-MM-DD`);
    }
  }
}
function normalizeDates(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (Array.isArray(value)) return value.map(normalizeDates);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, normalizeDates(v)]));
  return value;
}
function query(schema, req) {
  const q = { ...req.query };
  validateDates(q);
  for (const k of ["date", "from", "to"]) if (q[k] !== void 0) q[k] = new Date(q[k]);
  for (const k of ["page", "pageSize", "dayOfWeek", "weekday"]) if (q[k] !== void 0) q[k] = Number(q[k]);
  if (q.linkedOnly !== void 0) {
    assert(["true", "false"].includes(String(q.linkedOnly)), 400, "linkedOnly must be true or false");
    q.linkedOnly = String(q.linkedOnly) === "true";
  }
  const result = normalizeDates(schema.parse(q));
  for (const [key2, value] of Object.entries(result)) assert(value !== "undefined", 400, `${key2} is required`);
  return result;
}
function databaseIntegrityCode(error) {
  const seen = /* @__PURE__ */ new Set();
  let current = error;
  for (let depth = 0; current && typeof current === "object" && depth < 8 && !seen.has(current); depth++) {
    seen.add(current);
    if (typeof current.code === "string" && integrityCodes.has(current.code)) return current.code;
    current = current.cause;
  }
  return null;
}
function errors(err, req, res, _next) {
  const validation = err instanceof ZodError || err.name === "ZodError";
  const conflictCode = databaseIntegrityCode(err);
  const conflict = Boolean(conflictCode);
  const status = err.status || (validation ? 400 : conflict ? 409 : 500);
  if (status >= 500) req.log.error({ code: typeof err?.code === "string" ? err.code : "INTERNAL_ERROR" }, "Request failed");
  res.status(status).json({ error: validation ? "Invalid input: " + err.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ") : conflict ? "Record conflicts with existing data or references" : status >= 500 ? "Service unavailable. Please retry." : err.message, code: validation ? "VALIDATION_ERROR" : conflict ? "CONFLICT" : err.code || "REQUEST_FAILED" });
}
var HttpError, integrityCodes;
var init_http = __esm({
  "src/lib/http.ts"() {
    "use strict";
    init_zod();
    HttpError = class extends Error {
      constructor(status, message, code = "REQUEST_FAILED") {
        super(message);
        this.status = status;
        this.code = code;
      }
      status;
      code;
    };
    integrityCodes = /* @__PURE__ */ new Set(["23505", "23503", "23514", "23P01"]);
  }
});

// src/lib/integration-config.ts
function validEmailAddress(value) {
  return value.length <= 254 && emailAddressPattern.test(value);
}
function key(env, name, valid = () => true, optional = false) {
  const value = env[name];
  return { key: name, status: !value?.trim() ? optional ? "default" : "missing" : valid(value) ? "configured" : "invalid" };
}
function smtpKeys(env) {
  return [
    key(env, "SMTP_HOST", (value) => /^[a-z0-9.-]+$/i.test(value)),
    key(env, "SMTP_PORT", (value) => /^\d+$/.test(value) && Number(value) > 0 && Number(value) <= 65535),
    key(env, "SMTP_USER", (value) => !/[\r\n]/.test(value)),
    key(env, "SMTP_PASSWORD"),
    key(env, "SMTP_FROM", (value) => {
      const address = value.match(/^[^<>\r\n]+<([^<>]+)>$/)?.[1] ?? value;
      return validEmailAddress(address);
    }),
    key(env, "SMTP_SECURE", (value) => /^(true|false)$/.test(value), true),
    key(env, "SMTP_REQUIRE_TLS", (value) => value === "true", true)
  ];
}
function integrationReadiness(env = process.env) {
  const smtp = smtpKeys(env);
  const sms = [
    key(env, "OTP_PROVIDER", (value) => value === "twilio" || value === "development" && env.NODE_ENV === "development"),
    key(env, "TWILIO_ACCOUNT_SID", (value) => /^AC[a-f0-9]{32}$/i.test(value)),
    key(env, "TWILIO_MESSAGING_SERVICE_SID", (value) => /^MG[a-f0-9]{32}$/i.test(value)),
    key(env, "TWILIO_AUTH_TOKEN", (value) => /^[a-f0-9]{32}$/i.test(value))
  ];
  return { smtp: { ready: ready(smtp), keys: smtp }, sms: { ready: ready(sms), keys: sms } };
}
var emailAddressPattern, ready;
var init_integration_config = __esm({
  "src/lib/integration-config.ts"() {
    "use strict";
    init_http();
    emailAddressPattern = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;
    ready = (keys) => keys.every((item) => item.status === "configured" || item.status === "default");
  }
});

// src/lib/integration-vault.ts
import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from "node:crypto";
function masterKey() {
  const raw3 = process.env.INTEGRATIONS_ENCRYPTION_KEY;
  if (!raw3 || !/^[a-f0-9]{64}$/i.test(raw3))
    throw new HttpError(503, "Configure the server integration encryption key before editing credentials.", "INTEGRATION_KEY_REQUIRED");
  return Buffer.from(raw3, "hex");
}
function decryptIntegration(provider, encrypted) {
  try {
    const [version2, nonce, tag, data2, extra] = encrypted.split(".");
    if (version2 !== "v1" || extra !== void 0) throw new Error("Format");
    const cipher = createDecipheriv("aes-256-gcm", masterKey(), Buffer.from(nonce, "base64"));
    cipher.setAAD(Buffer.from(`digiq:integrations:v1:${provider}`));
    cipher.setAuthTag(Buffer.from(tag, "base64"));
    return JSON.parse(Buffer.concat([cipher.update(Buffer.from(data2, "base64")), cipher.final()]).toString("utf8"));
  } catch {
    throw new HttpError(503, "Stored integration configuration cannot be decrypted. Restore the correct server encryption key.", "INTEGRATION_DECRYPT_FAILED");
  }
}
async function resolvedIntegration(provider, conn = db) {
  const [row] = await conn.select().from(integrationCredentials).where(eq(integrationCredentials.provider, provider));
  return {
    env: row ? { NODE_ENV: process.env.NODE_ENV, ...decryptIntegration(provider, row.encrypted) } : process.env,
    source: row ? "database" : "environment",
    revision: row?.revision ?? null
  };
}
var init_integration_vault = __esm({
  "src/lib/integration-vault.ts"() {
    "use strict";
    init_drizzle_orm();
    init_db2();
    init_http();
    init_integration_config();
  }
});

// src/lib/otp-delivery.ts
function developmentOtpEnabled() {
  return process.env.NODE_ENV === "development" && process.env.OTP_PROVIDER === "development";
}
async function otpDeliveryConfigured(conn) {
  const { env, source } = await resolvedIntegration("sms", conn);
  return source === "environment" && developmentOtpEnabled() || integrationReadiness(env).sms.ready;
}
var init_otp_delivery = __esm({
  "src/lib/otp-delivery.ts"() {
    "use strict";
    init_http();
    init_integration_vault();
    init_integration_config();
  }
});

// src/lib/store.ts
import { randomUUID as randomUUID2 } from "node:crypto";
function flatten(row) {
  if (!row) return null;
  const { data: data2, clerkId: _legacyProviderId, passwordHash: _hash, tokenHash: _token, ...fields2 } = row;
  const { passwordHash: _nestedHash, tokenHash: _nestedToken, ...safeData } = data2 || {};
  return { ...safeData, ...fields2 };
}
async function all(table, conn = db) {
  return (await conn.select().from(table)).map(flatten);
}
async function one(table, id2, conn = db) {
  const [row] = await conn.select().from(table).where(eq(table.id, id2));
  assert(row, 404, "Record not found");
  return flatten(row);
}
async function audit(user, action, type, row, conn = db) {
  await conn.insert(auditLogs).values({ id: uid(), actorId: user.id, clinicId: row.clinicId || (type === "clinics" ? row.id : null), branchId: row.branchId || (type === "branches" ? row.id : null), action, entityType: type, entityId: row.id, summary: `${action} ${type} record` });
}
async function getSettings(conn = db, clinicId) {
  const [row] = await conn.select().from(settings).where(eq(settings.id, "platform"));
  const clinic = clinicId ? await one(clinics, clinicId, conn) : null;
  return { ...defaultSettings, ...row?.data, ...clinic?.policies || {}, otpProviderConfigured: await otpDeliveryConfigured(conn), queuePollSeconds: 30 };
}
var uid, defaultSettings;
var init_store = __esm({
  "src/lib/store.ts"() {
    "use strict";
    init_db2();
    init_drizzle_orm();
    init_http();
    init_otp_delivery();
    uid = () => randomUUID2();
    defaultSettings = {
      platformName: "DigiQ Doctors",
      timezone: "Asia/Kolkata",
      bookingHorizonDays: 60,
      cancellationCutoffMinutes: 0,
      requireMobileVerification: false,
      otpExpirySeconds: 300,
      otpMaxAttempts: 5,
      sessionTimeoutMinutes: 60,
      notificationsEnabled: false,
      queuePollSeconds: 30
    };
  }
});

// src/lib/clinical-membership.ts
function clinicalMembership(doctorId, branchId) {
  return sql`exists (
    select 1 from doctors cm_d
    join users cm_u on cm_u.id=cm_d.user_id and cm_u.status='active'
    join branches cm_b on cm_b.status='active'
    join clinics cm_c on cm_c.id=cm_b.clinic_id and cm_c.status='active'
    where cm_d.id=${doctorId} and cm_d.status='active'
      ${branchId ? sql`and cm_b.id=${branchId}` : sql``}
      and (
        (cm_u.role='doctor' and exists (
          select 1 from assignments cm_a where cm_a.user_id=cm_d.user_id
          and cm_a.clinic_id=cm_b.clinic_id and cm_a.branch_id=cm_b.id
        ))
        or (cm_u.role='clinicAdmin' and cm_d.user_id=cm_d.owner_admin_id
          and cm_c.admin_id=cm_u.id
          and jsonb_typeof(cm_d.data->'branchIds')='array'
          and cm_d.data->'branchIds' ? cm_b.id
          and exists (select 1 from assignments cm_a where cm_a.user_id=cm_u.id
            and cm_a.clinic_id=cm_c.id and cm_a.branch_id is null))
      )
  )`;
}
function managedDoctorLinks(doctorId) {
  return sql`select a.clinic_id, a.branch_id from doctors md
    join users mu on mu.id=md.user_id and mu.role='doctor'
    join assignments a on a.user_id=md.user_id
    join clinics c on c.id=a.clinic_id and c.admin_id=md.owner_admin_id
    where md.id=${doctorId} and (a.branch_id is null or exists (
      select 1 from branches b where b.id=a.branch_id and b.clinic_id=c.id))
    union all
    select a.clinic_id, null::text as branch_id from doctors md
    join users mu on mu.id=md.user_id and mu.role='clinicAdmin' and md.owner_admin_id=mu.id
    join assignments a on a.user_id=mu.id and a.branch_id is null
    join clinics c on c.id=a.clinic_id and c.admin_id=mu.id
    where md.id=${doctorId}
    union all
    select b.clinic_id, b.id as branch_id from doctors md
    join users mu on mu.id=md.user_id and mu.role='clinicAdmin' and md.owner_admin_id=mu.id
    join branches b on jsonb_typeof(md.data->'branchIds')='array' and md.data->'branchIds' ? b.id
    join clinics c on c.id=b.clinic_id and c.admin_id=mu.id
    join assignments a on a.user_id=mu.id and a.clinic_id=c.id and a.branch_id is null
    where md.id=${doctorId}`;
}
async function clinicalBranchIds(doctorId, conn = db) {
  const doctorRows = await all(doctors, conn), accountRows = await all(users, conn);
  const links2 = await all(assignments, conn), branchRows = await all(branches, conn), clinicRows = await all(clinics, conn);
  const doctor = doctorRows.find((d) => d.id === doctorId);
  const account = accountRows.find((u) => u.id === doctor?.userId);
  if (doctor?.status !== "active" || account?.status !== "active") return [];
  const selected = doctor.branchIds;
  return branchRows.filter((branch) => {
    if (branch.status !== "active") return false;
    const clinic = clinicRows.find((c) => c.id === branch.clinicId);
    if (clinic?.status !== "active") return false;
    if (account.role === "doctor") return links2.some((a) => a.userId === doctor.userId && a.clinicId === branch.clinicId && a.branchId === branch.id);
    return account.role === "clinicAdmin" && doctor.userId === doctor.ownerAdminId && clinic.adminId === account.id && Array.isArray(selected) && selected.includes(branch.id) && links2.some((a) => a.userId === account.id && a.clinicId === clinic.id && !a.branchId);
  }).map((b) => b.id).sort();
}
async function isClinicalMember(doctorId, branchId, conn = db) {
  return (await clinicalBranchIds(doctorId, conn)).includes(branchId);
}
var init_clinical_membership = __esm({
  "src/lib/clinical-membership.ts"() {
    "use strict";
    init_db2();
    init_drizzle_orm();
    init_store();
  }
});

// src/lib/feature-policy.ts
function notificationKind(toStatus) {
  return QUEUE_STATUSES.has(toStatus) ? "queue" : "appointments";
}
function narrowToWorkspace(user, activeClinicId, branchClinic) {
  if (!activeClinicId || user.role === "superAdmin" || user.role === "patient" || user.clinicIds.length < 2 || !user.clinicIds.includes(activeClinicId))
    return { ...user, activeClinicId: null };
  return { ...user, clinicIds: [activeClinicId], branchIds: user.branchIds.filter((b) => branchClinic.get(b) === activeClinicId), activeClinicId };
}
function sanitizeSavedView(input) {
  if (!VIEW_TABLE_KEY.test(input.tableKey)) throw new Error("Invalid table");
  const name = String(input.name || "").trim().slice(0, 60);
  if (!name) throw new Error("Enter a view name");
  const filters = {};
  for (const [k, v] of Object.entries(input.filters || {}).slice(0, 30)) {
    if (UNSAFE_VIEW_KEYS.has(k) || !VIEW_FILTER_KEY.test(k)) continue;
    if (typeof v === "string" && VIEW_SAFE_VALUE.test(v)) filters[k] = v;
  }
  const cols = (v) => Array.isArray(v) ? v.filter((x) => typeof x === "string" && COLUMN.test(x)).slice(0, 40) : [];
  const columns = input.columns ? { order: cols(input.columns.order), hidden: cols(input.columns.hidden), pinned: typeof input.columns.pinned === "string" && COLUMN.test(input.columns.pinned) ? input.columns.pinned : null } : void 0;
  return { tableKey: input.tableKey, name, filters, columns };
}
function sniffDocument(bytes) {
  if (!bytes.length || bytes.length > DOCUMENT_MAX_BYTES) return null;
  const head = bytes.subarray(0, 12);
  if (head.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  if (head.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (head[0] === 255 && head[1] === 216 && head[2] === 255) return "image/jpeg";
  if (head.subarray(0, 4).toString("latin1") === "RIFF" && head.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  const text2 = bytes.toString("utf8");
  if (Buffer.from(text2, "utf8").equals(bytes) && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text2)) return "text/plain";
  return null;
}
function safeDocumentName(name) {
  const cleaned = String(name || "").replace(/[\\/\u0000-\u001f"<>|:*?]/g, "_").trim().slice(0, 160);
  return cleaned || "document";
}
var QUEUE_STATUSES, VIEW_TABLE_KEY, VIEW_FILTER_KEY, VIEW_SAFE_VALUE, UNSAFE_VIEW_KEYS, COLUMN, SHARE_ROLES, DOCUMENT_MAX_BYTES;
var init_feature_policy = __esm({
  "src/lib/feature-policy.ts"() {
    "use strict";
    QUEUE_STATUSES = /* @__PURE__ */ new Set(["checkedIn", "waiting", "called", "inConsultation"]);
    VIEW_TABLE_KEY = /^[a-z][a-z0-9-]{0,59}$/;
    VIEW_FILTER_KEY = /^[a-zA-Z][a-zA-Z0-9]{0,39}$/;
    VIEW_SAFE_VALUE = /^[A-Za-z0-9_\-:.,]{1,80}$/;
    UNSAFE_VIEW_KEYS = /* @__PURE__ */ new Set(["search", "q", "page", "name", "fullName", "email", "mobile", "phone", "patientName", "reference"]);
    COLUMN = /^[a-zA-Z][a-zA-Z0-9_-]{0,59}$/;
    SHARE_ROLES = /* @__PURE__ */ new Set(["superAdmin", "clinicAdmin"]);
    DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
  }
});

// src/lib/demo-policy.ts
function demoWriteAllowed(method, path) {
  if (method === "GET" || method === "HEAD") return true;
  if (method === "POST" && path === "/queue/call-next") return true;
  if (method === "POST" && /^\/guest-requests\/[^/]+\/decision$/.test(path)) return true;
  if (method === "POST" && /^\/appointments\/[^/]+\/(actions|reschedule)$/.test(path)) return true;
  if (method === "PATCH" && /^\/doctors\/[^/]+\/presence$/.test(path)) return true;
  return false;
}
var DEMO_FIXTURE, DEMO_LOGIN_WINDOW_MS;
var init_demo_policy = __esm({
  "src/lib/demo-policy.ts"() {
    "use strict";
    DEMO_FIXTURE = "clinicflow:published-demo";
    DEMO_LOGIN_WINDOW_MS = 10 * 6e4;
  }
});

// src/lib/custom-roles.ts
var custom_roles_exports = {};
__export(custom_roles_exports, {
  customRolesInput: () => customRolesInput,
  enforceCustomRoles: () => enforceCustomRoles,
  getCustomRoles: () => getCustomRoles,
  saveCustomRoles: () => saveCustomRoles
});
async function getCustomRoles(conn = db) {
  const [row] = await conn.select().from(settings).where(eq(settings.id, "custom-roles"));
  return row?.data || { revision: 0, roles: [], bindings: [] };
}
async function saveCustomRoles(actor, input) {
  assert(actor.role === "superAdmin", 403, "Super Admin access required");
  const parsed = customRolesInput.safeParse(input);
  assert(parsed.success, 400, "Invalid roles or assignments");
  const body = parsed.data;
  assert(new Set(body.roles.map((r) => r.id)).size === body.roles.length, 400, "Duplicate role identifier");
  assert(new Set(body.roles.map((r) => r.name.toLowerCase())).size === body.roles.length, 400, "Role names must be unique");
  assert(new Set(body.bindings.map((b) => `${b.userId}:${b.roleId}:${b.clinicId || ""}`)).size === body.bindings.length, 400, "Duplicate role assignment");
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('custom-roles'))`);
    const current = await getCustomRoles(tx);
    assert(current.revision === body.revision, 409, "Roles changed. Reload before saving.");
    for (const binding of body.bindings) {
      const role = body.roles.find((r) => r.id === binding.roleId);
      const [user] = await tx.select().from(users).where(eq(users.id, binding.userId));
      assert(role && user && user.role === role.baseRole && user.status === "active", 400, "Assign roles only to active staff with the matching base role");
      if (binding.clinicId) {
        const [clinic] = await tx.select().from(clinics).where(eq(clinics.id, binding.clinicId));
        const links2 = await tx.select().from(assignments).where(and(eq(assignments.userId, user.id), eq(assignments.clinicId, binding.clinicId)));
        assert(clinic && (clinic.adminId === user.id || links2.length > 0), 400, "The user must already belong to this clinic");
      }
    }
    const next = { ...body, revision: current.revision + 1 };
    await tx.insert(settings).values({ id: "custom-roles", data: next }).onConflictDoUpdate({ target: settings.id, set: { data: next } });
    await audit(actor, "configure", "custom_roles", { id: "custom-roles" }, tx);
    return next;
  });
}
async function enforceCustomRoles(user, req, module, action) {
  const config = await getCustomRoles();
  const relevant = config.bindings.filter((b) => b.userId === user.id).filter((b) => config.roles.some((r) => r.id === b.roleId && r.baseRole === user.role && r.denied.includes(`${module}:${action}`)));
  if (!relevant.length) return;
  assert(!relevant.some((b) => !b.clinicId), 403, "Your assigned role does not allow this action");
  const parts = req.path.split("/").filter(Boolean);
  let clinicId = req.body?.clinicId || req.query?.clinicId;
  const branchId = req.body?.branchId || req.query?.branchId;
  if (typeof branchId === "string") {
    const [branch] = await db.select().from(branches).where(eq(branches.id, branchId));
    clinicId = branch?.clinicId;
  }
  const tables = { clinics, branches, appointments, doctors, patients, schedules, "availability-exceptions": availabilityExceptions, qrs };
  const table = tables[parts[0]];
  if (parts.length > 1 && !table && !["management", "queue"].includes(parts[0])) clinicId = void 0;
  if (table && parts[1] && !["public", "search"].includes(parts[1])) {
    const [record] = await db.select().from(table).where(eq(table.id, parts[1]));
    const row = record && { ...record.data, ...record };
    clinicId = parts[0] === "clinics" ? row?.id : row?.clinicId;
    if (!clinicId && row?.branchId) {
      const [branch] = await db.select().from(branches).where(eq(branches.id, row.branchId));
      clinicId = branch?.clinicId;
    }
  }
  assert(typeof clinicId === "string" && clinicId.length > 0, 403, "Select a clinic scope before using this operation with your assigned role");
  assert(!relevant.some((b) => b.clinicId === clinicId), 403, "Your assigned role does not allow this action in this clinic");
}
var capabilityKeys, roleSchema, bindingSchema, customRolesInput;
var init_custom_roles = __esm({
  "src/lib/custom-roles.ts"() {
    "use strict";
    init_db2();
    init_drizzle_orm();
    init_zod();
    init_http();
    init_store();
    init_permission_policy();
    capabilityKeys = new Set(permissionModules.flatMap((m) => permissionActions.map((a) => `${m}:${a}`)));
    roleSchema = external_exports.object({
      id: external_exports.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
      name: external_exports.string().trim().min(1).max(80),
      baseRole: external_exports.enum(["clinicAdmin", "doctor", "receptionist"]),
      denied: external_exports.array(external_exports.string().refine((k) => capabilityKeys.has(k))).max(capabilityKeys.size)
    }).strict();
    bindingSchema = external_exports.object({ userId: external_exports.string().min(1), roleId: external_exports.string().min(1), clinicId: external_exports.string().min(1).optional() }).strict();
    customRolesInput = external_exports.object({ revision: external_exports.number().int().min(0), roles: external_exports.array(roleSchema).max(100), bindings: external_exports.array(bindingSchema).max(5e3) }).strict();
  }
});

// src/lib/permission-policy.ts
var permission_policy_exports = {};
__export(permission_policy_exports, {
  configurableRoles: () => configurableRoles,
  enforcePermissionPolicy: () => enforcePermissionPolicy,
  permissionActions: () => permissionActions,
  permissionModules: () => permissionModules,
  permissionPolicy: () => permissionPolicy
});
async function permissionPolicy(conn = db) {
  const [row] = await conn.select().from(settings).where(eq(settings.id, "permission-policy"));
  return row?.data || { revision: 0, denied: [] };
}
async function enforcePermissionPolicy(user, req) {
  if (user.role === "superAdmin") return;
  const parts = req.path.split("/").filter(Boolean);
  let module = parts[0];
  if (module === "notifications" || module === "search" && parts[1] === "records") module = "appointments";
  if (module === "patient-documents") module = "patients";
  if (module === "clinic-registration") module = "clinics";
  if (module === "me" && parts[1] === "doctor-profile") module = "doctors";
  if (module === "management" && parts[1] === "templates") module = "templates";
  if (module === "clinic-settings") module = "clinics";
  if (!permissionModules.includes(module)) return;
  let action = req.method === "GET" ? "read" : req.method === "DELETE" ? "delete" : req.method === "POST" && parts.length === 1 ? "create" : "update";
  if (parts[0] === "notifications") action = "read";
  if (parts[0] === "me" && parts[1] === "doctor-profile" && req.method === "POST") action = "create";
  if (parts.includes("reschedule")) action = "reschedule";
  if (parts.includes("actions") && ["cancel", "complete"].includes(req.body?.action)) action = req.body.action;
  const policy = await permissionPolicy();
  assert(!policy.denied.includes(`${user.role}:${module}:${action}`), 403, "This operation is disabled by your administrator");
  const { enforceCustomRoles: enforceCustomRoles2 } = await Promise.resolve().then(() => (init_custom_roles(), custom_roles_exports));
  await enforceCustomRoles2(user, req, module, action);
}
var permissionModules, permissionActions, configurableRoles;
var init_permission_policy = __esm({
  "src/lib/permission-policy.ts"() {
    "use strict";
    init_db2();
    init_drizzle_orm();
    init_http();
    permissionModules = ["clinics", "branches", "users", "doctors", "patients", "appointments", "queue", "schedules", "availability-exceptions", "qrs", "reports", "templates"];
    permissionActions = ["read", "create", "update", "delete", "cancel", "reschedule", "complete"];
    configurableRoles = ["clinicAdmin", "doctor", "receptionist", "patient"];
  }
});

// src/lib/auth.ts
function isStaffRole(role) {
  return Boolean(role && STAFF_ROLES.includes(role));
}
function requireIdentity(req) {
  const id2 = req.authUserId;
  assert(id2, 401, "Sign in required");
  return id2;
}
function requireSessionIdentity(req) {
  const userId = requireIdentity(req), sessionId = req.authSessionHash;
  if (!sessionId) throw new HttpError(401, "Sign in required", "SIGN_IN_REQUIRED");
  return { userId, sessionId };
}
async function requireStaffSessionProof(req) {
  requireSessionIdentity(req);
}
async function findUser(userId) {
  const [row] = await db.select().from(users).where(eq(users.id, userId));
  if (!row) return null;
  if (row.data?.demoFixture === DEMO_FIXTURE) {
    const [state] = await db.select().from(settings).where(eq(settings.id, DEMO_FIXTURE));
    if (!state?.data?.enabled || state.data.userId !== row.id || row.status !== "active" || row.role !== "clinicAdmin") return null;
    const owned = await db.select().from(clinics).where(eq(clinics.adminId, row.id));
    const doctor2 = await db.select().from(doctors).where(eq(doctors.userId, row.id));
    const selected = await db.select().from(branches).where(eq(branches.clinicId, state.data.clinicId));
    if (owned.length !== 1 || owned[0].id !== state.data.clinicId || owned[0].status !== "active" || selected.length !== 1 || selected[0].id !== state.data.branchId || selected[0].status !== "active" || doctor2.length !== 1 || doctor2[0].id !== state.data.doctorId || doctor2[0].ownerAdminId !== row.id || doctor2[0].status !== "active")
      return null;
    const links3 = await db.select().from(assignments).where(eq(assignments.userId, row.id));
    if (links3.length !== 1 || links3[0].clinicId !== state.data.clinicId || links3[0].branchId) return null;
  }
  const user = flatten(row);
  const activeClinics = new Set((await all(clinics)).filter((c) => c.status === "active").map((c) => c.id));
  const activeBranches = new Set((await all(branches)).filter((b) => b.status === "active" && activeClinics.has(b.clinicId)).map((b) => b.id));
  const links2 = (await all(assignments)).filter((a) => a.userId === user.id && activeClinics.has(a.clinicId) && (!a.branchId || activeBranches.has(a.branchId)));
  const [doctor] = await db.select().from(doctors).where(eq(doctors.userId, user.id));
  const [patient] = await db.select().from(patients).where(eq(patients.userId, user.id));
  return { ...user, mobile: user.mobile || "", managingAdminId: user.role === "doctor" ? doctor?.ownerAdminId || null : user.managingAdminId || null, clinicIds: [...new Set(links2.map((a) => a.clinicId))], branchIds: [...new Set(links2.filter((a) => a.branchId).map((a) => a.branchId))], doctorId: doctor?.id || null, patientId: patient?.id || null };
}
async function applyWorkspace(user) {
  if (user.role === "superAdmin" || user.role === "patient" || user.clinicIds.length < 2) return { ...user, activeClinicId: null };
  const [row] = await db.select().from(settings).where(eq(settings.id, `workspace:${user.id}`));
  const active = row?.data?.clinicId;
  if (!active) return { ...user, activeClinicId: null };
  const branchRows = await db.select({ id: branches.id, clinicId: branches.clinicId }).from(branches).where(eq(branches.clinicId, active));
  return narrowToWorkspace(user, active, new Map(branchRows.map((b) => [b.id, b.clinicId])));
}
async function requireUser(req) {
  const found = await findUser(requireIdentity(req));
  assert(found, 403, "Complete onboarding first");
  const user = await applyWorkspace(found);
  assert(user.status === "active", 403, "Account inactive");
  if (isStaffRole(user.role)) await requireStaffSessionProof(req);
  if (user.demoFixture === DEMO_FIXTURE)
    assert(demoWriteAllowed(req.method, req.path), 403, "Demo account cannot modify clinic structure or staff");
  const { enforcePermissionPolicy: enforcePermissionPolicy2 } = await Promise.resolve().then(() => (init_permission_policy(), permission_policy_exports));
  await enforcePermissionPolicy2(user, req);
  return user;
}
function roles(user, allowed) {
  assert(allowed.includes(user.role), 403, "Permission denied");
}
function scope(user, clinicId, branchId) {
  if (user.role === "superAdmin") return true;
  if (!clinicId || !user.clinicIds.includes(clinicId)) return false;
  return !branchId || !["doctor", "receptionist"].includes(user.role) || user.branchIds.includes(branchId);
}
async function canRead(user, kind, row) {
  if (user.role === "superAdmin" || kind === "masters") return true;
  if (kind === "users") {
    if (user.id === row.id) return true;
    if (row.role === "receptionist" && ["clinicAdmin", "doctor"].includes(user.role)) return row.managingAdminId === (user.role === "clinicAdmin" ? user.id : user.managingAdminId);
    return row.role !== "superAdmin" && row.clinicIds?.some((id2) => scope(user, id2)) && (!["doctor", "receptionist"].includes(user.role) || row.branchIds?.some((id2) => user.branchIds.includes(id2)));
  }
  if (kind === "doctors") return user.doctorId === row.id || ["clinicAdmin", "doctor", "receptionist"].includes(user.role) && row.clinicIds?.some((id2) => scope(user, id2)) && (!["doctor", "receptionist"].includes(user.role) || row.branchIds?.some((id2) => user.branchIds.includes(id2)));
  if (kind === "patients") {
    if (user.role === "patient") return row.id === user.patientId;
    if (user.role !== "doctor" && scope(user, row.clinicId, row.branchId)) return true;
    return (await all(appointments)).some((a) => a.patientId === row.id && (user.role === "doctor" ? a.doctorId === user.doctorId && scope(user, a.clinicId, a.branchId) : scope(user, a.clinicId, a.branchId)));
  }
  if (kind === "clinics") return scope(user, row.id);
  if (user.role === "patient") return kind === "appointments" && row.patientId === user.patientId;
  if (user.role === "doctor" && ["appointments", "qrs"].includes(kind)) return row.doctorId === user.doctorId && scope(user, row.clinicId, row.branchId);
  if (["schedules", "availability-exceptions"].includes(kind)) {
    const doctor = await one(doctors, row.doctorId);
    const doctorAssigned = await isClinicalMember(doctor.id, row.branchId);
    if (!doctorAssigned) return false;
  }
  let clinicId = row.clinicId;
  if (!clinicId && row.branchId) clinicId = (await one(branches, row.branchId)).clinicId;
  return scope(user, clinicId, row.branchId || (kind === "branches" ? row.id : null));
}
var STAFF_ROLES;
var init_auth = __esm({
  "src/lib/auth.ts"() {
    "use strict";
    init_db2();
    init_drizzle_orm();
    init_http();
    init_store();
    init_clinical_membership();
    init_feature_policy();
    init_demo_policy();
    STAFF_ROLES = ["superAdmin", "clinicAdmin", "doctor", "receptionist"];
  }
});

// src/lib/queue-order.ts
var pendingStatuses, statusGroups, rank;
var init_queue_order = __esm({
  "src/lib/queue-order.ts"() {
    "use strict";
    pendingStatuses = ["booked", "checkedIn", "waiting"];
    statusGroups = {
      active: [...pendingStatuses, "called", "inConsultation"],
      waiting: pendingStatuses,
      absent: ["noShow"],
      completed: ["completed"],
      cancelled: ["cancelled"]
    };
    rank = (row) => row.queueRank ?? row.tokenNumber;
  }
});

// src/lib/session-duration.ts
var init_session_duration = __esm({
  "src/lib/session-duration.ts"() {
    "use strict";
    init_db2();
    init_store();
    init_queue_order();
  }
});

// src/lib/display-preferences.ts
function clinicDisplayPreferences(clinic) {
  const dateFormats = ["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"];
  const source = clinic?.data ? { ...clinic.data, ...clinic } : clinic;
  return {
    dateFormat: dateFormats.includes(source?.dateFormat) ? source.dateFormat : "DD MMM YYYY",
    timeFormat: source?.timeFormat === "24h" ? "24h" : "12h"
  };
}
var init_display_preferences = __esm({
  "src/lib/display-preferences.ts"() {
    "use strict";
  }
});

// src/lib/availability.ts
function localNow(timezone) {
  let parts;
  try {
    parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(/* @__PURE__ */ new Date());
  } catch {
    assert(false, 400, "Invalid timezone");
  }
  const p = Object.fromEntries(parts.map((p2) => [p2.type, p2.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, minute: Number(p.hour) * 60 + Number(p.minute) };
}
var init_availability = __esm({
  "src/lib/availability.ts"() {
    "use strict";
    init_db2();
    init_clinical_membership();
    init_session_duration();
    init_store();
    init_http();
    init_display_preferences();
  }
});

// src/lib/presence.ts
var init_presence = __esm({
  "src/lib/presence.ts"() {
    "use strict";
    init_db2();
    init_session_duration();
  }
});

// src/lib/appointments.ts
function appointmentView(row, user) {
  const allowedActions = Object.entries(transitions).filter(([action, rule]) => !["enqueue", "call", "start"].includes(action) && rule.from.includes(row.status) && (action === "cancel" ? !row.checkedInAt : row.date === localNow(row.timezone || "Asia/Kolkata").date) && (user.role !== "patient" || action === "cancel") && (action !== "requeue" || ["superAdmin", "clinicAdmin", "receptionist"].includes(user.role))).map(([a]) => a);
  const { actorId, requestId, ...view } = row;
  return { ...view, ...user.role === "patient" && row.history ? { history: row.history.map(({ actorId: _actor, ...event }) => event) } : {}, queueRank: rank(row), revision: row.revision || 0, expectedDurationMinutes: row.expectedDurationMinutes ?? null, allowedActions };
}
async function appointmentViews(rows, user, conn = db) {
  if (!rows.length) return [];
  const clinicMap = new Map((await all(clinics, conn)).map((c) => [c.id, c]));
  const branchMap = new Map((rows.some((r) => r.branchAddress == null) ? await all(branches, conn) : []).map((b) => [b.id, b]));
  return rows.map((row) => appointmentView({
    ...row,
    ...clinicDisplayPreferences(clinicMap.get(row.clinicId)),
    branchAddress: row.branchAddress ?? branchMap.get(row.branchId)?.address ?? null
  }, user));
}
var transitions;
var init_appointments = __esm({
  "src/lib/appointments.ts"() {
    "use strict";
    init_db2();
    init_store();
    init_http();
    init_auth();
    init_availability();
    init_queue_order();
    init_presence();
    init_session_duration();
    init_display_preferences();
    transitions = {
      checkIn: { from: ["booked", "checkedIn", "waiting", "called"], to: "inConsultation", stamp: "checkedInAt" },
      enqueue: { from: ["booked", "checkedIn"], to: "waiting", stamp: "waitingAt" },
      call: { from: ["booked", "checkedIn", "waiting"], to: "called", stamp: "calledAt" },
      start: { from: ["called"], to: "inConsultation", stamp: "consultationStartedAt" },
      complete: { from: ["inConsultation"], to: "completed", stamp: "completedAt" },
      noShow: { from: ["booked", "checkedIn", "waiting", "called"], to: "noShow" },
      requeue: { from: ["noShow"], to: "waiting", stamp: "waitingAt" },
      cancel: { from: ["booked", "checkedIn", "waiting", "called"], to: "cancelled", stamp: "cancelledAt" }
    };
  }
});

// <stdin>
import express from "express";

// src/routes/workspace-features.ts
init_db2();
init_drizzle_orm();
import { Router } from "express";

// ../../lib/api-zod/src/generated/api.ts
init_zod();
var CheckIntegrationConnectionParams = objectType({
  "provider": enumType(["smtp", "sms", "storage"])
});
var CheckIntegrationConnectionResponse = objectType({
  "provider": stringType(),
  "source": stringType(),
  "checkedAt": stringType(),
  "checks": arrayType(objectType({
    "name": stringType(),
    "status": enumType(["passed", "failed", "not_verified"]),
    "message": stringType()
  }))
});
var GetStorageConfigurationResponse = objectType({
  "provider": stringType(),
  "source": stringType(),
  "publicPath": stringType(),
  "configured": booleanType()
});
var GetSystemUsersQueryParams = objectType({
  "page": coerce.number().int().optional(),
  "search": coerce.string().optional(),
  "role": coerce.string().optional(),
  "status": coerce.string().optional(),
  "clinicId": coerce.string().optional()
});
var GetSystemUsersResponse = objectType({
  "data": arrayType(objectType({
    "id": stringType(),
    "fullName": stringType(),
    "email": stringType(),
    "role": stringType(),
    "status": stringType(),
    "clinics": arrayType(objectType({
      "id": stringType(),
      "name": stringType()
    }))
  })),
  "total": numberType().int(),
  "page": numberType().int(),
  "pageSize": numberType().int()
});
var GetCustomRolesResponse = objectType({
  "revision": numberType().int(),
  "roles": arrayType(objectType({
    "id": stringType(),
    "name": stringType(),
    "baseRole": enumType(["clinicAdmin", "doctor", "receptionist"]),
    "denied": arrayType(stringType())
  })),
  "bindings": arrayType(objectType({
    "userId": stringType(),
    "roleId": stringType(),
    "clinicId": stringType().optional()
  }))
});
var SaveCustomRolesBody = objectType({
  "revision": numberType().int(),
  "roles": arrayType(objectType({
    "id": stringType(),
    "name": stringType(),
    "baseRole": enumType(["clinicAdmin", "doctor", "receptionist"]),
    "denied": arrayType(stringType())
  })),
  "bindings": arrayType(objectType({
    "userId": stringType(),
    "roleId": stringType(),
    "clinicId": stringType().optional()
  }))
});
var SaveCustomRolesResponse = objectType({
  "revision": numberType().int(),
  "roles": arrayType(objectType({
    "id": stringType(),
    "name": stringType(),
    "baseRole": enumType(["clinicAdmin", "doctor", "receptionist"]),
    "denied": arrayType(stringType())
  })),
  "bindings": arrayType(objectType({
    "userId": stringType(),
    "roleId": stringType(),
    "clinicId": stringType().optional()
  }))
});
var GetPermissionPolicyResponse = objectType({
  "revision": numberType().int(),
  "denied": arrayType(stringType())
}).and(objectType({
  "modules": arrayType(stringType()),
  "actions": arrayType(stringType()),
  "roles": arrayType(stringType())
}));
var SavePermissionPolicyBody = objectType({
  "revision": numberType().int(),
  "denied": arrayType(stringType())
});
var SavePermissionPolicyResponse = objectType({
  "revision": numberType().int(),
  "denied": arrayType(stringType())
}).and(objectType({
  "modules": arrayType(stringType()),
  "actions": arrayType(stringType()),
  "roles": arrayType(stringType())
}));
var RequestLogoUploadBody = objectType({
  "name": stringType(),
  "size": numberType().int(),
  "contentType": stringType(),
  "clinicId": stringType().optional()
});
var RequestLogoUploadResponse = objectType({
  "id": stringType(),
  "uploadUrl": stringType()
});
var UploadLocalLogoParams = objectType({
  "id": coerce.string()
});
var UploadLocalLogoResponse = voidType();
var CompleteLogoUploadParams = objectType({
  "id": coerce.string()
});
var CompleteLogoUploadResponse = objectType({
  "logoUrl": stringType()
});
var GetNotificationTemplatesQueryParams = objectType({
  "clinicId": coerce.string().optional(),
  "recipient": enumType(["patient", "clinicAdmin", "doctor", "receptionist"]).optional()
});
var getNotificationTemplatesResponseItemsItemContentSubjectMax = 180;
var getNotificationTemplatesResponseItemsItemContentBodyMax = 8e3;
var getNotificationTemplatesResponseItemsItemContentPrefixMax = 60;
var getNotificationTemplatesResponseItemsItemContentFooterMax = 500;
var getNotificationTemplatesResponseItemsItemContentLogoUrlMax = 1e3;
var getNotificationTemplatesResponseItemsItemDraftSubjectMax = 180;
var getNotificationTemplatesResponseItemsItemDraftBodyMax = 8e3;
var getNotificationTemplatesResponseItemsItemDraftPrefixMax = 60;
var getNotificationTemplatesResponseItemsItemDraftFooterMax = 500;
var getNotificationTemplatesResponseItemsItemDraftLogoUrlMax = 1e3;
var GetNotificationTemplatesResponse = objectType({
  "scopeName": stringType(),
  "variables": arrayType(stringType()),
  "items": arrayType(objectType({
    "event": stringType(),
    "recipient": enumType(["patient", "clinicAdmin", "doctor", "receptionist"]).optional(),
    "title": stringType(),
    "revision": numberType().int(),
    "source": stringType(),
    "content": objectType({
      "enabled": booleanType().optional(),
      "subject": stringType().min(1).max(getNotificationTemplatesResponseItemsItemContentSubjectMax),
      "body": stringType().min(1).max(getNotificationTemplatesResponseItemsItemContentBodyMax),
      "prefix": stringType().max(getNotificationTemplatesResponseItemsItemContentPrefixMax),
      "footer": stringType().max(getNotificationTemplatesResponseItemsItemContentFooterMax),
      "logoUrl": stringType().max(getNotificationTemplatesResponseItemsItemContentLogoUrlMax)
    }),
    "draft": objectType({
      "enabled": booleanType().optional(),
      "subject": stringType().min(1).max(getNotificationTemplatesResponseItemsItemDraftSubjectMax),
      "body": stringType().min(1).max(getNotificationTemplatesResponseItemsItemDraftBodyMax),
      "prefix": stringType().max(getNotificationTemplatesResponseItemsItemDraftPrefixMax),
      "footer": stringType().max(getNotificationTemplatesResponseItemsItemDraftFooterMax),
      "logoUrl": stringType().max(getNotificationTemplatesResponseItemsItemDraftLogoUrlMax)
    }).optional(),
    "previewSubject": stringType(),
    "previewBody": stringType(),
    "delivery": stringType()
  }))
});
var saveNotificationTemplateBodyRevisionMin = 0;
var saveNotificationTemplateBodyContentSubjectMax = 180;
var saveNotificationTemplateBodyContentBodyMax = 8e3;
var saveNotificationTemplateBodyContentPrefixMax = 60;
var saveNotificationTemplateBodyContentFooterMax = 500;
var saveNotificationTemplateBodyContentLogoUrlMax = 1e3;
var SaveNotificationTemplateBody = objectType({
  "recipient": enumType(["patient", "clinicAdmin", "doctor", "receptionist"]).optional(),
  "clinicId": stringType().optional(),
  "event": enumType(["booking", "onboarding", "rescheduled", "cancelled", "completed", "reminder"]),
  "revision": numberType().int().min(saveNotificationTemplateBodyRevisionMin),
  "mode": enumType(["draft", "publish", "reset"]),
  "content": objectType({
    "enabled": booleanType().optional(),
    "subject": stringType().min(1).max(saveNotificationTemplateBodyContentSubjectMax),
    "body": stringType().min(1).max(saveNotificationTemplateBodyContentBodyMax),
    "prefix": stringType().max(saveNotificationTemplateBodyContentPrefixMax),
    "footer": stringType().max(saveNotificationTemplateBodyContentFooterMax),
    "logoUrl": stringType().max(saveNotificationTemplateBodyContentLogoUrlMax)
  }).optional()
});
var saveNotificationTemplateResponseItemsItemContentSubjectMax = 180;
var saveNotificationTemplateResponseItemsItemContentBodyMax = 8e3;
var saveNotificationTemplateResponseItemsItemContentPrefixMax = 60;
var saveNotificationTemplateResponseItemsItemContentFooterMax = 500;
var saveNotificationTemplateResponseItemsItemContentLogoUrlMax = 1e3;
var saveNotificationTemplateResponseItemsItemDraftSubjectMax = 180;
var saveNotificationTemplateResponseItemsItemDraftBodyMax = 8e3;
var saveNotificationTemplateResponseItemsItemDraftPrefixMax = 60;
var saveNotificationTemplateResponseItemsItemDraftFooterMax = 500;
var saveNotificationTemplateResponseItemsItemDraftLogoUrlMax = 1e3;
var SaveNotificationTemplateResponse = objectType({
  "scopeName": stringType(),
  "variables": arrayType(stringType()),
  "items": arrayType(objectType({
    "event": stringType(),
    "recipient": enumType(["patient", "clinicAdmin", "doctor", "receptionist"]).optional(),
    "title": stringType(),
    "revision": numberType().int(),
    "source": stringType(),
    "content": objectType({
      "enabled": booleanType().optional(),
      "subject": stringType().min(1).max(saveNotificationTemplateResponseItemsItemContentSubjectMax),
      "body": stringType().min(1).max(saveNotificationTemplateResponseItemsItemContentBodyMax),
      "prefix": stringType().max(saveNotificationTemplateResponseItemsItemContentPrefixMax),
      "footer": stringType().max(saveNotificationTemplateResponseItemsItemContentFooterMax),
      "logoUrl": stringType().max(saveNotificationTemplateResponseItemsItemContentLogoUrlMax)
    }),
    "draft": objectType({
      "enabled": booleanType().optional(),
      "subject": stringType().min(1).max(saveNotificationTemplateResponseItemsItemDraftSubjectMax),
      "body": stringType().min(1).max(saveNotificationTemplateResponseItemsItemDraftBodyMax),
      "prefix": stringType().max(saveNotificationTemplateResponseItemsItemDraftPrefixMax),
      "footer": stringType().max(saveNotificationTemplateResponseItemsItemDraftFooterMax),
      "logoUrl": stringType().max(saveNotificationTemplateResponseItemsItemDraftLogoUrlMax)
    }).optional(),
    "previewSubject": stringType(),
    "previewBody": stringType(),
    "delivery": stringType()
  }))
});
var updateIntegrationSettingsBodyCurrentPasswordMax = 1024;
var updateIntegrationSettingsBodyValuesMaxOne = 2048;
var UpdateIntegrationSettingsBody = objectType({
  "provider": enumType(["smtp", "sms"]),
  "mode": enumType(["database", "environment"]),
  "revision": stringType().nullable(),
  "currentPassword": stringType().min(1).max(updateIntegrationSettingsBodyCurrentPasswordMax),
  "values": recordType(stringType(), stringType().max(updateIntegrationSettingsBodyValuesMaxOne))
});
var UpdateIntegrationSettingsResponse = objectType({
  "editable": booleanType().optional(),
  "smtp": objectType({
    "source": enumType(["environment", "database"]).optional(),
    "revision": stringType().nullish(),
    "ready": booleanType(),
    "keys": arrayType(objectType({
      "key": stringType(),
      "status": enumType(["configured", "missing", "invalid", "default"])
    }))
  }),
  "sms": objectType({
    "source": enumType(["environment", "database"]).optional(),
    "revision": stringType().nullish(),
    "ready": booleanType(),
    "keys": arrayType(objectType({
      "key": stringType(),
      "status": enumType(["configured", "missing", "invalid", "default"])
    }))
  })
});
var GetIntegrationSettingsResponse = objectType({
  "editable": booleanType().optional(),
  "smtp": objectType({
    "source": enumType(["environment", "database"]).optional(),
    "revision": stringType().nullish(),
    "ready": booleanType(),
    "keys": arrayType(objectType({
      "key": stringType(),
      "status": enumType(["configured", "missing", "invalid", "default"])
    }))
  }),
  "sms": objectType({
    "source": enumType(["environment", "database"]).optional(),
    "revision": stringType().nullish(),
    "ready": booleanType(),
    "keys": arrayType(objectType({
      "key": stringType(),
      "status": enumType(["configured", "missing", "invalid", "default"])
    }))
  })
});
var sendSmtpTestEmailBodyRecipientMax = 254;
var SendSmtpTestEmailBody = objectType({
  "recipient": stringType().email().max(sendSmtpTestEmailBodyRecipientMax)
});
var SendSmtpTestEmailResponse = objectType({
  "status": enumType(["provider_accepted"]),
  "message": stringType()
});
var demoLoginBodyPasswordMax = 200;
var DemoLoginBody = objectType({
  "password": stringType().min(1).max(demoLoginBodyPasswordMax)
});
var DemoLoginResponse = objectType({
  "authenticated": booleanType()
});
var GetDemoSetupResponse = objectType({
  "configured": booleanType(),
  "enabled": booleanType(),
  "clinicName": stringType().optional(),
  "clinicSlug": stringType().optional(),
  "branchSlug": stringType().optional(),
  "doctorName": stringType().optional(),
  "username": stringType().optional(),
  "loginPath": stringType().optional(),
  "bookingPath": stringType().optional(),
  "clinicPath": stringType().optional(),
  "alreadyExists": booleanType().optional(),
  "password": stringType().optional().describe("One-time secret only on creation or rotation")
});
var CreateDemoSetupResponse = objectType({
  "configured": booleanType(),
  "enabled": booleanType(),
  "clinicName": stringType().optional(),
  "clinicSlug": stringType().optional(),
  "branchSlug": stringType().optional(),
  "doctorName": stringType().optional(),
  "username": stringType().optional(),
  "loginPath": stringType().optional(),
  "bookingPath": stringType().optional(),
  "clinicPath": stringType().optional(),
  "alreadyExists": booleanType().optional(),
  "password": stringType().optional().describe("One-time secret only on creation or rotation")
});
var UpdateDemoSetupBody = objectType({
  "action": enumType(["enable", "disable", "rotate-password"])
});
var UpdateDemoSetupResponse = objectType({
  "configured": booleanType(),
  "enabled": booleanType(),
  "clinicName": stringType().optional(),
  "clinicSlug": stringType().optional(),
  "branchSlug": stringType().optional(),
  "doctorName": stringType().optional(),
  "username": stringType().optional(),
  "loginPath": stringType().optional(),
  "bookingPath": stringType().optional(),
  "clinicPath": stringType().optional(),
  "alreadyExists": booleanType().optional(),
  "password": stringType().optional().describe("One-time secret only on creation or rotation")
});
var GetSessionContextsQueryParams = objectType({
  "doctorId": coerce.string(),
  "branchId": coerce.string(),
  "date": dateType()
});
var GetSessionContextsResponseItem = objectType({
  "dateFormat": enumType(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": enumType(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "sessionId": stringType().nullish(),
  "doctorId": stringType(),
  "clinicId": stringType(),
  "branchId": stringType(),
  "date": coerce.date(),
  "available": booleanType(),
  "reason": stringType().nullish(),
  "startTime": stringType().nullish(),
  "endTime": stringType().nullish(),
  "breakStart": stringType().nullish(),
  "breakEnd": stringType().nullish(),
  "timezone": stringType().optional(),
  "maxTokens": numberType().int(),
  "bookedTokens": numberType().int(),
  "remainingTokens": numberType().int(),
  "consultationMinutes": numberType().int().optional(),
  "tokenPrefix": stringType().optional(),
  "queueMode": enumType(["mixed", "appointmentsOnly", "walkInsOnly"]).optional(),
  "queueOpenTime": stringType().optional(),
  "queueCloseTime": stringType().optional()
}).and(objectType({
  "snapshotOnly": booleanType()
}));
var GetSessionContextsResponse = arrayType(GetSessionContextsResponseItem);
var GetRegistrationOptionsResponse = objectType({
  "categories": arrayType(objectType({
    "id": stringType(),
    "name": stringType()
  })),
  "specialities": arrayType(objectType({
    "id": stringType(),
    "name": stringType()
  })),
  "qualifications": arrayType(objectType({
    "id": stringType(),
    "name": stringType()
  }))
});
var registerClinicBodyFullNameMax = 150;
var registerClinicBodyPasswordMax = 1024;
var registerClinicBodyClinicSlugMin = 3;
var registerClinicBodyClinicSlugMax = 63;
var registerClinicBodyClinicReferralCodeMax = 100;
var registerClinicBodyBranchesItemSlugMin = 3;
var registerClinicBodyBranchesItemSlugMax = 63;
var registerClinicBodyBranchesItemOpeningHoursItemDayOfWeekMin = 0;
var registerClinicBodyBranchesItemOpeningHoursItemDayOfWeekMax = 6;
var registerClinicBodyBranchesItemOpeningHoursMax = 28;
var registerClinicBodyBranchesItemLinkedScheduleMaxTokensMax = 1e3;
var registerClinicBodyBranchesItemLinkedScheduleConsultationMinutesMax = 240;
var registerClinicBodyBranchesItemLinkedScheduleTokenPrefixRegExp = new RegExp("^[A-Za-z0-9]{1,8}$");
var registerClinicBodyBranchesMax = 30;
var registerClinicBodyPoliciesBookingHorizonDaysMax = 365;
var registerClinicBodyPoliciesCancellationCutoffMinutesMin = 0;
var registerClinicBodyPoliciesCancellationCutoffMinutesMax = 10080;
var registerClinicBodyOwnDoctorDefault = false;
var registerClinicBodyOwnerScheduleMaxTokensMax = 1e3;
var registerClinicBodyOwnerScheduleConsultationMinutesMax = 240;
var registerClinicBodyOwnerScheduleTokenPrefixRegExp = new RegExp("^[A-Za-z0-9]{1,8}$");
var RegisterClinicBody = objectType({
  "fullName": stringType().min(1).max(registerClinicBodyFullNameMax),
  "mobile": stringType().optional(),
  "password": stringType().min(1).max(registerClinicBodyPasswordMax),
  "clinic": objectType({
    "dateFormat": enumType(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": enumType(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "name": stringType().min(1).optional(),
    "address": stringType().optional(),
    "email": stringType().email().nullish(),
    "phone": stringType().nullish(),
    "slug": stringType().min(registerClinicBodyClinicSlugMin).max(registerClinicBodyClinicSlugMax).optional(),
    "categoryId": stringType().nullish(),
    "specialityIds": arrayType(stringType()).optional(),
    "referralCode": stringType().max(registerClinicBodyClinicReferralCodeMax).nullish()
  }),
  "branches": arrayType(objectType({
    "id": stringType().optional(),
    "name": stringType().min(1),
    "address": stringType(),
    "city": stringType().optional(),
    "timezone": stringType().optional(),
    "email": stringType().email().nullish(),
    "phone": stringType().nullish(),
    "inheritEmail": booleanType().optional(),
    "inheritPhone": booleanType().optional(),
    "slug": stringType().min(registerClinicBodyBranchesItemSlugMin).max(registerClinicBodyBranchesItemSlugMax).optional(),
    "openingHours": arrayType(objectType({
      "dayOfWeek": numberType().int().min(registerClinicBodyBranchesItemOpeningHoursItemDayOfWeekMin).max(registerClinicBodyBranchesItemOpeningHoursItemDayOfWeekMax),
      "startTime": stringType(),
      "endTime": stringType()
    })).max(registerClinicBodyBranchesItemOpeningHoursMax).nullish().describe("Null or absent preserves legacy unrestricted hours. An explicit empty array closes all days."),
    "linkedSchedule": objectType({
      "enabled": booleanType(),
      "doctorId": stringType().optional(),
      "maxTokens": numberType().int().min(1).max(registerClinicBodyBranchesItemLinkedScheduleMaxTokensMax).optional(),
      "consultationMinutes": numberType().int().min(1).max(registerClinicBodyBranchesItemLinkedScheduleConsultationMinutesMax).optional(),
      "tokenPrefix": stringType().regex(registerClinicBodyBranchesItemLinkedScheduleTokenPrefixRegExp).optional(),
      "queueMode": enumType(["mixed", "appointmentsOnly", "walkInsOnly"]).optional()
    }).optional()
  })).min(1).max(registerClinicBodyBranchesMax),
  "policies": objectType({
    "bookingHorizonDays": numberType().int().min(1).max(registerClinicBodyPoliciesBookingHorizonDaysMax).optional(),
    "cancellationCutoffMinutes": numberType().int().min(registerClinicBodyPoliciesCancellationCutoffMinutesMin).max(registerClinicBodyPoliciesCancellationCutoffMinutesMax).optional()
  }).optional(),
  "ownDoctor": booleanType().default(registerClinicBodyOwnDoctorDefault),
  "ownerSchedule": objectType({
    "maxTokens": numberType().int().min(1).max(registerClinicBodyOwnerScheduleMaxTokensMax),
    "consultationMinutes": numberType().int().min(1).max(registerClinicBodyOwnerScheduleConsultationMinutesMax),
    "tokenPrefix": stringType().regex(registerClinicBodyOwnerScheduleTokenPrefixRegExp),
    "queueMode": enumType(["mixed", "appointmentsOnly", "walkInsOnly"])
  }).optional(),
  "specializationId": stringType().optional(),
  "qualificationIds": arrayType(stringType()).optional()
});
var registerClinicResponseClinicOneSlugMin = 3;
var registerClinicResponseClinicOneSlugMax = 63;
var registerClinicResponseClinicOneReferralCodeMax = 100;
var registerClinicResponseBranchesItemOneSlugMin = 3;
var registerClinicResponseBranchesItemOneSlugMax = 63;
var registerClinicResponseBranchesItemOneOpeningHoursItemDayOfWeekMin = 0;
var registerClinicResponseBranchesItemOneOpeningHoursItemDayOfWeekMax = 6;
var registerClinicResponseBranchesItemOneOpeningHoursMax = 28;
var registerClinicResponseBranchesItemOneTimezoneDefault = `Asia/Kolkata`;
var registerClinicResponseBranchesItemTwoLinkedScheduleMaxTokensMax = 1e3;
var registerClinicResponseBranchesItemTwoLinkedScheduleConsultationMinutesMax = 240;
var registerClinicResponseBranchesItemTwoLinkedScheduleTokenPrefixRegExp = new RegExp("^[A-Za-z0-9]{1,8}$");
var registerClinicResponsePoliciesBookingHorizonDaysMax = 365;
var registerClinicResponsePoliciesCancellationCutoffMinutesMin = 0;
var registerClinicResponsePoliciesCancellationCutoffMinutesMax = 10080;
var RegisterClinicResponse = objectType({
  "clinic": objectType({
    "dateFormat": enumType(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": enumType(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "slug": stringType().min(registerClinicResponseClinicOneSlugMin).max(registerClinicResponseClinicOneSlugMax).optional(),
    "specialityIds": arrayType(stringType()).optional(),
    "referralCode": stringType().max(registerClinicResponseClinicOneReferralCodeMax).nullish(),
    "adminId": stringType().describe("Super admins may select the owning clinic administrator; other roles are assigned by the server."),
    "name": stringType().min(1),
    "address": stringType(),
    "country": stringType().optional(),
    "state": stringType().optional(),
    "city": stringType().optional(),
    "area": stringType().optional(),
    "pincode": stringType().optional(),
    "phone": stringType().nullish(),
    "email": stringType().email().nullish(),
    "description": stringType().optional(),
    "clinicTypeId": stringType().optional(),
    "categoryId": stringType().nullish(),
    "status": enumType(["active", "inactive"])
  }).and(objectType({
    "id": stringType(),
    "code": stringType(),
    "adminName": stringType(),
    "createdAt": coerce.date().nullable(),
    "doctorCount": numberType().int().optional(),
    "branchCount": numberType().int().optional()
  })),
  "branches": arrayType(objectType({
    "slug": stringType().min(registerClinicResponseBranchesItemOneSlugMin).max(registerClinicResponseBranchesItemOneSlugMax).optional(),
    "email": stringType().email().nullish(),
    "inheritEmail": booleanType().optional(),
    "inheritPhone": booleanType().optional(),
    "openingHours": arrayType(objectType({
      "dayOfWeek": numberType().int().min(registerClinicResponseBranchesItemOneOpeningHoursItemDayOfWeekMin).max(registerClinicResponseBranchesItemOneOpeningHoursItemDayOfWeekMax),
      "startTime": stringType(),
      "endTime": stringType()
    })).max(registerClinicResponseBranchesItemOneOpeningHoursMax).nullish().describe("Null or absent is legacy unrestricted; empty array means closed all days."),
    "clinicId": stringType(),
    "name": stringType().min(1),
    "address": stringType(),
    "city": stringType().optional(),
    "state": stringType().optional(),
    "pincode": stringType().optional(),
    "phone": stringType().nullish(),
    "timezone": stringType().default(registerClinicResponseBranchesItemOneTimezoneDefault),
    "status": enumType(["active", "inactive"])
  }).and(objectType({
    "dateFormat": enumType(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": enumType(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "linkedSchedule": objectType({
      "enabled": booleanType(),
      "doctorId": stringType().optional(),
      "maxTokens": numberType().int().min(1).max(registerClinicResponseBranchesItemTwoLinkedScheduleMaxTokensMax).optional(),
      "consultationMinutes": numberType().int().min(1).max(registerClinicResponseBranchesItemTwoLinkedScheduleConsultationMinutesMax).optional(),
      "tokenPrefix": stringType().regex(registerClinicResponseBranchesItemTwoLinkedScheduleTokenPrefixRegExp).optional(),
      "queueMode": enumType(["mixed", "appointmentsOnly", "walkInsOnly"]).optional()
    }).optional(),
    "effectiveEmail": stringType().nullish(),
    "effectivePhone": stringType().nullish(),
    "id": stringType(),
    "code": stringType(),
    "clinicName": stringType().optional(),
    "createdAt": coerce.date().nullable()
  }))),
  "policies": objectType({
    "bookingHorizonDays": numberType().int().min(1).max(registerClinicResponsePoliciesBookingHorizonDaysMax).optional(),
    "cancellationCutoffMinutes": numberType().int().min(registerClinicResponsePoliciesCancellationCutoffMinutesMin).max(registerClinicResponsePoliciesCancellationCutoffMinutesMax).optional()
  }),
  "doctorId": stringType().nullish()
});
var GetClinicSettingsParams = objectType({
  "id": coerce.string()
});
var getClinicSettingsResponseClinicOneSlugMin = 3;
var getClinicSettingsResponseClinicOneSlugMax = 63;
var getClinicSettingsResponseClinicOneReferralCodeMax = 100;
var getClinicSettingsResponseBranchesItemOneSlugMin = 3;
var getClinicSettingsResponseBranchesItemOneSlugMax = 63;
var getClinicSettingsResponseBranchesItemOneOpeningHoursItemDayOfWeekMin = 0;
var getClinicSettingsResponseBranchesItemOneOpeningHoursItemDayOfWeekMax = 6;
var getClinicSettingsResponseBranchesItemOneOpeningHoursMax = 28;
var getClinicSettingsResponseBranchesItemOneTimezoneDefault = `Asia/Kolkata`;
var getClinicSettingsResponseBranchesItemTwoLinkedScheduleMaxTokensMax = 1e3;
var getClinicSettingsResponseBranchesItemTwoLinkedScheduleConsultationMinutesMax = 240;
var getClinicSettingsResponseBranchesItemTwoLinkedScheduleTokenPrefixRegExp = new RegExp("^[A-Za-z0-9]{1,8}$");
var getClinicSettingsResponsePoliciesBookingHorizonDaysMax = 365;
var getClinicSettingsResponsePoliciesCancellationCutoffMinutesMin = 0;
var getClinicSettingsResponsePoliciesCancellationCutoffMinutesMax = 10080;
var GetClinicSettingsResponse = objectType({
  "clinic": objectType({
    "dateFormat": enumType(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": enumType(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "slug": stringType().min(getClinicSettingsResponseClinicOneSlugMin).max(getClinicSettingsResponseClinicOneSlugMax).optional(),
    "specialityIds": arrayType(stringType()).optional(),
    "referralCode": stringType().max(getClinicSettingsResponseClinicOneReferralCodeMax).nullish(),
    "adminId": stringType().describe("Super admins may select the owning clinic administrator; other roles are assigned by the server."),
    "name": stringType().min(1),
    "address": stringType(),
    "country": stringType().optional(),
    "state": stringType().optional(),
    "city": stringType().optional(),
    "area": stringType().optional(),
    "pincode": stringType().optional(),
    "phone": stringType().nullish(),
    "email": stringType().email().nullish(),
    "description": stringType().optional(),
    "clinicTypeId": stringType().optional(),
    "categoryId": stringType().nullish(),
    "status": enumType(["active", "inactive"])
  }).and(objectType({
    "id": stringType(),
    "code": stringType(),
    "adminName": stringType(),
    "createdAt": coerce.date().nullable(),
    "doctorCount": numberType().int().optional(),
    "branchCount": numberType().int().optional()
  })),
  "branches": arrayType(objectType({
    "slug": stringType().min(getClinicSettingsResponseBranchesItemOneSlugMin).max(getClinicSettingsResponseBranchesItemOneSlugMax).optional(),
    "email": stringType().email().nullish(),
    "inheritEmail": booleanType().optional(),
    "inheritPhone": booleanType().optional(),
    "openingHours": arrayType(objectType({
      "dayOfWeek": numberType().int().min(getClinicSettingsResponseBranchesItemOneOpeningHoursItemDayOfWeekMin).max(getClinicSettingsResponseBranchesItemOneOpeningHoursItemDayOfWeekMax),
      "startTime": stringType(),
      "endTime": stringType()
    })).max(getClinicSettingsResponseBranchesItemOneOpeningHoursMax).nullish().describe("Null or absent is legacy unrestricted; empty array means closed all days."),
    "clinicId": stringType(),
    "name": stringType().min(1),
    "address": stringType(),
    "city": stringType().optional(),
    "state": stringType().optional(),
    "pincode": stringType().optional(),
    "phone": stringType().nullish(),
    "timezone": stringType().default(getClinicSettingsResponseBranchesItemOneTimezoneDefault),
    "status": enumType(["active", "inactive"])
  }).and(objectType({
    "dateFormat": enumType(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": enumType(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "linkedSchedule": objectType({
      "enabled": booleanType(),
      "doctorId": stringType().optional(),
      "maxTokens": numberType().int().min(1).max(getClinicSettingsResponseBranchesItemTwoLinkedScheduleMaxTokensMax).optional(),
      "consultationMinutes": numberType().int().min(1).max(getClinicSettingsResponseBranchesItemTwoLinkedScheduleConsultationMinutesMax).optional(),
      "tokenPrefix": stringType().regex(getClinicSettingsResponseBranchesItemTwoLinkedScheduleTokenPrefixRegExp).optional(),
      "queueMode": enumType(["mixed", "appointmentsOnly", "walkInsOnly"]).optional()
    }).optional(),
    "effectiveEmail": stringType().nullish(),
    "effectivePhone": stringType().nullish(),
    "id": stringType(),
    "code": stringType(),
    "clinicName": stringType().optional(),
    "createdAt": coerce.date().nullable()
  }))),
  "policies": objectType({
    "bookingHorizonDays": numberType().int().min(1).max(getClinicSettingsResponsePoliciesBookingHorizonDaysMax).optional(),
    "cancellationCutoffMinutes": numberType().int().min(getClinicSettingsResponsePoliciesCancellationCutoffMinutesMin).max(getClinicSettingsResponsePoliciesCancellationCutoffMinutesMax).optional()
  }),
  "doctorId": stringType().nullish()
});
var UpdateClinicSettingsParams = objectType({
  "id": coerce.string()
});
var updateClinicSettingsBodyClinicSlugMin = 3;
var updateClinicSettingsBodyClinicSlugMax = 63;
var updateClinicSettingsBodyClinicReferralCodeMax = 100;
var updateClinicSettingsBodyBranchesItemSlugMin = 3;
var updateClinicSettingsBodyBranchesItemSlugMax = 63;
var updateClinicSettingsBodyBranchesItemOpeningHoursItemDayOfWeekMin = 0;
var updateClinicSettingsBodyBranchesItemOpeningHoursItemDayOfWeekMax = 6;
var updateClinicSettingsBodyBranchesItemOpeningHoursMax = 28;
var updateClinicSettingsBodyBranchesItemLinkedScheduleMaxTokensMax = 1e3;
var updateClinicSettingsBodyBranchesItemLinkedScheduleConsultationMinutesMax = 240;
var updateClinicSettingsBodyBranchesItemLinkedScheduleTokenPrefixRegExp = new RegExp("^[A-Za-z0-9]{1,8}$");
var updateClinicSettingsBodyBranchesMax = 30;
var updateClinicSettingsBodyPoliciesBookingHorizonDaysMax = 365;
var updateClinicSettingsBodyPoliciesCancellationCutoffMinutesMin = 0;
var updateClinicSettingsBodyPoliciesCancellationCutoffMinutesMax = 10080;
var UpdateClinicSettingsBody = objectType({
  "clinic": objectType({
    "dateFormat": enumType(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": enumType(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "name": stringType().min(1).optional(),
    "address": stringType().optional(),
    "email": stringType().email().nullish(),
    "phone": stringType().nullish(),
    "slug": stringType().min(updateClinicSettingsBodyClinicSlugMin).max(updateClinicSettingsBodyClinicSlugMax).optional(),
    "categoryId": stringType().nullish(),
    "specialityIds": arrayType(stringType()).optional(),
    "referralCode": stringType().max(updateClinicSettingsBodyClinicReferralCodeMax).nullish()
  }).optional(),
  "branches": arrayType(objectType({
    "id": stringType().optional(),
    "name": stringType().min(1),
    "address": stringType(),
    "city": stringType().optional(),
    "timezone": stringType().optional(),
    "email": stringType().email().nullish(),
    "phone": stringType().nullish(),
    "inheritEmail": booleanType().optional(),
    "inheritPhone": booleanType().optional(),
    "slug": stringType().min(updateClinicSettingsBodyBranchesItemSlugMin).max(updateClinicSettingsBodyBranchesItemSlugMax).optional(),
    "openingHours": arrayType(objectType({
      "dayOfWeek": numberType().int().min(updateClinicSettingsBodyBranchesItemOpeningHoursItemDayOfWeekMin).max(updateClinicSettingsBodyBranchesItemOpeningHoursItemDayOfWeekMax),
      "startTime": stringType(),
      "endTime": stringType()
    })).max(updateClinicSettingsBodyBranchesItemOpeningHoursMax).nullish().describe("Null or absent preserves legacy unrestricted hours. An explicit empty array closes all days."),
    "linkedSchedule": objectType({
      "enabled": booleanType(),
      "doctorId": stringType().optional(),
      "maxTokens": numberType().int().min(1).max(updateClinicSettingsBodyBranchesItemLinkedScheduleMaxTokensMax).optional(),
      "consultationMinutes": numberType().int().min(1).max(updateClinicSettingsBodyBranchesItemLinkedScheduleConsultationMinutesMax).optional(),
      "tokenPrefix": stringType().regex(updateClinicSettingsBodyBranchesItemLinkedScheduleTokenPrefixRegExp).optional(),
      "queueMode": enumType(["mixed", "appointmentsOnly", "walkInsOnly"]).optional()
    }).optional()
  })).max(updateClinicSettingsBodyBranchesMax).optional(),
  "policies": objectType({
    "bookingHorizonDays": numberType().int().min(1).max(updateClinicSettingsBodyPoliciesBookingHorizonDaysMax).optional(),
    "cancellationCutoffMinutes": numberType().int().min(updateClinicSettingsBodyPoliciesCancellationCutoffMinutesMin).max(updateClinicSettingsBodyPoliciesCancellationCutoffMinutesMax).optional()
  }).optional()
});
var updateClinicSettingsResponseClinicOneSlugMin = 3;
var updateClinicSettingsResponseClinicOneSlugMax = 63;
var updateClinicSettingsResponseClinicOneReferralCodeMax = 100;
var updateClinicSettingsResponseBranchesItemOneSlugMin = 3;
var updateClinicSettingsResponseBranchesItemOneSlugMax = 63;
var updateClinicSettingsResponseBranchesItemOneOpeningHoursItemDayOfWeekMin = 0;
var updateClinicSettingsResponseBranchesItemOneOpeningHoursItemDayOfWeekMax = 6;
var updateClinicSettingsResponseBranchesItemOneOpeningHoursMax = 28;
var updateClinicSettingsResponseBranchesItemOneTimezoneDefault = `Asia/Kolkata`;
var updateClinicSettingsResponseBranchesItemTwoLinkedScheduleMaxTokensMax = 1e3;
var updateClinicSettingsResponseBranchesItemTwoLinkedScheduleConsultationMinutesMax = 240;
var updateClinicSettingsResponseBranchesItemTwoLinkedScheduleTokenPrefixRegExp = new RegExp("^[A-Za-z0-9]{1,8}$");
var updateClinicSettingsResponsePoliciesBookingHorizonDaysMax = 365;
var updateClinicSettingsResponsePoliciesCancellationCutoffMinutesMin = 0;
var updateClinicSettingsResponsePoliciesCancellationCutoffMinutesMax = 10080;
var UpdateClinicSettingsResponse = objectType({
  "clinic": objectType({
    "dateFormat": enumType(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": enumType(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "slug": stringType().min(updateClinicSettingsResponseClinicOneSlugMin).max(updateClinicSettingsResponseClinicOneSlugMax).optional(),
    "specialityIds": arrayType(stringType()).optional(),
    "referralCode": stringType().max(updateClinicSettingsResponseClinicOneReferralCodeMax).nullish(),
    "adminId": stringType().describe("Super admins may select the owning clinic administrator; other roles are assigned by the server."),
    "name": stringType().min(1),
    "address": stringType(),
    "country": stringType().optional(),
    "state": stringType().optional(),
    "city": stringType().optional(),
    "area": stringType().optional(),
    "pincode": stringType().optional(),
    "phone": stringType().nullish(),
    "email": stringType().email().nullish(),
    "description": stringType().optional(),
    "clinicTypeId": stringType().optional(),
    "categoryId": stringType().nullish(),
    "status": enumType(["active", "inactive"])
  }).and(objectType({
    "id": stringType(),
    "code": stringType(),
    "adminName": stringType(),
    "createdAt": coerce.date().nullable(),
    "doctorCount": numberType().int().optional(),
    "branchCount": numberType().int().optional()
  })),
  "branches": arrayType(objectType({
    "slug": stringType().min(updateClinicSettingsResponseBranchesItemOneSlugMin).max(updateClinicSettingsResponseBranchesItemOneSlugMax).optional(),
    "email": stringType().email().nullish(),
    "inheritEmail": booleanType().optional(),
    "inheritPhone": booleanType().optional(),
    "openingHours": arrayType(objectType({
      "dayOfWeek": numberType().int().min(updateClinicSettingsResponseBranchesItemOneOpeningHoursItemDayOfWeekMin).max(updateClinicSettingsResponseBranchesItemOneOpeningHoursItemDayOfWeekMax),
      "startTime": stringType(),
      "endTime": stringType()
    })).max(updateClinicSettingsResponseBranchesItemOneOpeningHoursMax).nullish().describe("Null or absent is legacy unrestricted; empty array means closed all days."),
    "clinicId": stringType(),
    "name": stringType().min(1),
    "address": stringType(),
    "city": stringType().optional(),
    "state": stringType().optional(),
    "pincode": stringType().optional(),
    "phone": stringType().nullish(),
    "timezone": stringType().default(updateClinicSettingsResponseBranchesItemOneTimezoneDefault),
    "status": enumType(["active", "inactive"])
  }).and(objectType({
    "dateFormat": enumType(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": enumType(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "linkedSchedule": objectType({
      "enabled": booleanType(),
      "doctorId": stringType().optional(),
      "maxTokens": numberType().int().min(1).max(updateClinicSettingsResponseBranchesItemTwoLinkedScheduleMaxTokensMax).optional(),
      "consultationMinutes": numberType().int().min(1).max(updateClinicSettingsResponseBranchesItemTwoLinkedScheduleConsultationMinutesMax).optional(),
      "tokenPrefix": stringType().regex(updateClinicSettingsResponseBranchesItemTwoLinkedScheduleTokenPrefixRegExp).optional(),
      "queueMode": enumType(["mixed", "appointmentsOnly", "walkInsOnly"]).optional()
    }).optional(),
    "effectiveEmail": stringType().nullish(),
    "effectivePhone": stringType().nullish(),
    "id": stringType(),
    "code": stringType(),
    "clinicName": stringType().optional(),
    "createdAt": coerce.date().nullable()
  }))),
  "policies": objectType({
    "bookingHorizonDays": numberType().int().min(1).max(updateClinicSettingsResponsePoliciesBookingHorizonDaysMax).optional(),
    "cancellationCutoffMinutes": numberType().int().min(updateClinicSettingsResponsePoliciesCancellationCutoffMinutesMin).max(updateClinicSettingsResponsePoliciesCancellationCutoffMinutesMax).optional()
  }),
  "doctorId": stringType().nullish()
});
var PreviewClinicSettingsParams = objectType({
  "id": coerce.string()
});
var previewClinicSettingsBodyClinicSlugMin = 3;
var previewClinicSettingsBodyClinicSlugMax = 63;
var previewClinicSettingsBodyClinicReferralCodeMax = 100;
var previewClinicSettingsBodyBranchesItemSlugMin = 3;
var previewClinicSettingsBodyBranchesItemSlugMax = 63;
var previewClinicSettingsBodyBranchesItemOpeningHoursItemDayOfWeekMin = 0;
var previewClinicSettingsBodyBranchesItemOpeningHoursItemDayOfWeekMax = 6;
var previewClinicSettingsBodyBranchesItemOpeningHoursMax = 28;
var previewClinicSettingsBodyBranchesItemLinkedScheduleMaxTokensMax = 1e3;
var previewClinicSettingsBodyBranchesItemLinkedScheduleConsultationMinutesMax = 240;
var previewClinicSettingsBodyBranchesItemLinkedScheduleTokenPrefixRegExp = new RegExp("^[A-Za-z0-9]{1,8}$");
var previewClinicSettingsBodyBranchesMax = 30;
var previewClinicSettingsBodyPoliciesBookingHorizonDaysMax = 365;
var previewClinicSettingsBodyPoliciesCancellationCutoffMinutesMin = 0;
var previewClinicSettingsBodyPoliciesCancellationCutoffMinutesMax = 10080;
var PreviewClinicSettingsBody = objectType({
  "clinic": objectType({
    "dateFormat": enumType(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": enumType(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "name": stringType().min(1).optional(),
    "address": stringType().optional(),
    "email": stringType().email().nullish(),
    "phone": stringType().nullish(),
    "slug": stringType().min(previewClinicSettingsBodyClinicSlugMin).max(previewClinicSettingsBodyClinicSlugMax).optional(),
    "categoryId": stringType().nullish(),
    "specialityIds": arrayType(stringType()).optional(),
    "referralCode": stringType().max(previewClinicSettingsBodyClinicReferralCodeMax).nullish()
  }).optional(),
  "branches": arrayType(objectType({
    "id": stringType().optional(),
    "name": stringType().min(1),
    "address": stringType(),
    "city": stringType().optional(),
    "timezone": stringType().optional(),
    "email": stringType().email().nullish(),
    "phone": stringType().nullish(),
    "inheritEmail": booleanType().optional(),
    "inheritPhone": booleanType().optional(),
    "slug": stringType().min(previewClinicSettingsBodyBranchesItemSlugMin).max(previewClinicSettingsBodyBranchesItemSlugMax).optional(),
    "openingHours": arrayType(objectType({
      "dayOfWeek": numberType().int().min(previewClinicSettingsBodyBranchesItemOpeningHoursItemDayOfWeekMin).max(previewClinicSettingsBodyBranchesItemOpeningHoursItemDayOfWeekMax),
      "startTime": stringType(),
      "endTime": stringType()
    })).max(previewClinicSettingsBodyBranchesItemOpeningHoursMax).nullish().describe("Null or absent preserves legacy unrestricted hours. An explicit empty array closes all days."),
    "linkedSchedule": objectType({
      "enabled": booleanType(),
      "doctorId": stringType().optional(),
      "maxTokens": numberType().int().min(1).max(previewClinicSettingsBodyBranchesItemLinkedScheduleMaxTokensMax).optional(),
      "consultationMinutes": numberType().int().min(1).max(previewClinicSettingsBodyBranchesItemLinkedScheduleConsultationMinutesMax).optional(),
      "tokenPrefix": stringType().regex(previewClinicSettingsBodyBranchesItemLinkedScheduleTokenPrefixRegExp).optional(),
      "queueMode": enumType(["mixed", "appointmentsOnly", "walkInsOnly"]).optional()
    }).optional()
  })).max(previewClinicSettingsBodyBranchesMax).optional(),
  "policies": objectType({
    "bookingHorizonDays": numberType().int().min(1).max(previewClinicSettingsBodyPoliciesBookingHorizonDaysMax).optional(),
    "cancellationCutoffMinutes": numberType().int().min(previewClinicSettingsBodyPoliciesCancellationCutoffMinutesMin).max(previewClinicSettingsBodyPoliciesCancellationCutoffMinutesMax).optional()
  }).optional()
});
var PreviewClinicSettingsResponse = objectType({
  "allowed": booleanType(),
  "conflicts": arrayType(stringType()),
  "impacts": arrayType(objectType({
    "branchId": stringType(),
    "create": numberType().int(),
    "update": numberType().int(),
    "retire": numberType().int(),
    "unlink": booleanType()
  }))
});
var attachOwnDoctorProfileBodyBranchIdsMax = 30;
var AttachOwnDoctorProfileBody = objectType({
  "branchIds": arrayType(stringType()).max(attachOwnDoctorProfileBodyBranchIdsMax),
  "specializationId": stringType().optional(),
  "qualificationIds": arrayType(stringType()).optional(),
  "about": stringType().optional()
});
var attachOwnDoctorProfileResponseOneExperienceYearsMin = 0;
var attachOwnDoctorProfileResponseOneConsultationFeeMin = 0;
var AttachOwnDoctorProfileResponse = objectType({
  "ownerAdminId": stringType().describe("Backward-compatible only. If supplied it must match the managing admin derived by the server."),
  "fullName": stringType().min(1),
  "email": stringType().email(),
  "mobile": stringType().optional(),
  "photoUrl": stringType().optional(),
  "gender": stringType().optional(),
  "dateOfBirth": coerce.date().optional(),
  "specializationId": stringType().optional(),
  "qualificationIds": arrayType(stringType()).optional(),
  "registrationNumber": stringType().optional(),
  "experienceYears": numberType().int().min(attachOwnDoctorProfileResponseOneExperienceYearsMin).optional(),
  "about": stringType().optional(),
  "consultationFee": numberType().min(attachOwnDoctorProfileResponseOneConsultationFeeMin).optional(),
  "languages": arrayType(stringType()).optional(),
  "clinicIds": arrayType(stringType()).min(1).optional().describe("Required by the server for doctor assignment."),
  "branchIds": arrayType(stringType()).optional(),
  "status": enumType(["active", "inactive"])
}).and(objectType({
  "id": stringType(),
  "userId": stringType(),
  "code": stringType(),
  "managingAdminId": stringType(),
  "managingAdminName": stringType(),
  "invitationStatus": enumType(["sent", "failed", "notRequired"]),
  "createdAt": coerce.date().nullable(),
  "specializationName": stringType().optional(),
  "qualificationNames": arrayType(stringType()).optional()
}));
var checkSlugAvailabilityQuerySlugMin = 3;
var checkSlugAvailabilityQuerySlugMax = 63;
var CheckSlugAvailabilityQueryParams = objectType({
  "slug": coerce.string().min(checkSlugAvailabilityQuerySlugMin).max(checkSlugAvailabilityQuerySlugMax),
  "clinicId": coerce.string().optional()
});
var CheckSlugAvailabilityResponse = objectType({
  "available": booleanType(),
  "slug": stringType()
});
var ResolveClinicSlugParams = objectType({
  "clinicSlug": coerce.string()
});
var resolveClinicSlugQueryPageMax = 1e6;
var resolveClinicSlugQuerySearchMax = 200;
var ResolveClinicSlugQueryParams = objectType({
  "directory": coerce.boolean().optional().describe("Opt in to scoped server pagination; omitted preserves the legacy context arrays."),
  "page": coerce.number().int().min(1).max(resolveClinicSlugQueryPageMax).optional(),
  "pageSize": unionType([literalType(10), literalType(25), literalType(50), literalType(100)]).optional(),
  "search": coerce.string().max(resolveClinicSlugQuerySearchMax).optional().describe("Matches public clinic name/address/city or doctor name/specialization only."),
  "sort": enumType(["name", "-name"]).optional().describe("Public name with optional minus prefix; sorting never uses private fields.")
});
var resolveClinicSlugResponseDirectoryPaginationTotalMin = 0;
var resolveClinicSlugResponseBranchCountMin = 0;
var resolveClinicSlugResponseBranchDoctorCountMin = 0;
var resolveClinicSlugResponseBranchesItemOpeningHoursItemDayOfWeekMin = 0;
var resolveClinicSlugResponseBranchesItemOpeningHoursItemDayOfWeekMax = 6;
var resolveClinicSlugResponseBranchOneOpeningHoursItemDayOfWeekMin = 0;
var resolveClinicSlugResponseBranchOneOpeningHoursItemDayOfWeekMax = 6;
var ResolveClinicSlugResponse = objectType({
  "directoryPagination": objectType({
    "total": numberType().int().min(resolveClinicSlugResponseDirectoryPaginationTotalMin),
    "page": numberType().int(),
    "pageSize": numberType().int(),
    "totalPages": numberType().int().optional()
  }).optional(),
  "branchCount": numberType().int().min(resolveClinicSlugResponseBranchCountMin).optional().describe("Active clinic count before directory search."),
  "branchDoctorCount": numberType().int().min(resolveClinicSlugResponseBranchDoctorCountMin).optional().describe("Active doctors at the resolved clinic before directory search."),
  "clinic": objectType({
    "dateFormat": enumType(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": enumType(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "doctorCount": numberType().int().optional(),
    "averageConsultationMinutes": numberType().nullish(),
    "id": stringType(),
    "name": stringType(),
    "slug": stringType(),
    "address": stringType().nullish(),
    "email": stringType().nullish(),
    "phone": stringType().nullish()
  }),
  "branches": arrayType(objectType({
    "dateFormat": enumType(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": enumType(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "id": stringType(),
    "name": stringType(),
    "slug": stringType().nullish(),
    "address": stringType().nullish(),
    "city": stringType().nullish(),
    "timezone": stringType().optional(),
    "effectiveEmail": stringType().nullish(),
    "effectivePhone": stringType().nullish(),
    "openingHours": arrayType(objectType({
      "dayOfWeek": numberType().int().min(resolveClinicSlugResponseBranchesItemOpeningHoursItemDayOfWeekMin).max(resolveClinicSlugResponseBranchesItemOpeningHoursItemDayOfWeekMax),
      "startTime": stringType(),
      "endTime": stringType()
    })).nullish()
  })),
  "branch": unionType([objectType({
    "dateFormat": enumType(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": enumType(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "id": stringType(),
    "name": stringType(),
    "slug": stringType().nullish(),
    "address": stringType().nullish(),
    "city": stringType().nullish(),
    "timezone": stringType().optional(),
    "effectiveEmail": stringType().nullish(),
    "effectivePhone": stringType().nullish(),
    "openingHours": arrayType(objectType({
      "dayOfWeek": numberType().int().min(resolveClinicSlugResponseBranchOneOpeningHoursItemDayOfWeekMin).max(resolveClinicSlugResponseBranchOneOpeningHoursItemDayOfWeekMax),
      "startTime": stringType(),
      "endTime": stringType()
    })).nullish()
  }), nullType()]),
  "qrReference": stringType().nullable(),
  "doctors": arrayType(objectType({
    "averageConsultationMinutes": numberType().nullish().describe("Actual mean of valid completed consultation timestamps"),
    "expectedDurationMinutes": numberType().int().nullish().describe("Explicit clinic duration configuration"),
    "id": stringType(),
    "fullName": stringType(),
    "photoUrl": stringType().optional(),
    "specializationName": stringType().optional(),
    "qualificationNames": arrayType(stringType()).optional(),
    "about": stringType().optional(),
    "experienceYears": numberType().int().optional(),
    "consultationFee": numberType().optional(),
    "clinicIds": arrayType(stringType()),
    "branchIds": arrayType(stringType())
  }))
});
var ResolveBranchSlugParams = objectType({
  "clinicSlug": coerce.string(),
  "branchSlug": coerce.string()
});
var resolveBranchSlugQueryPageMax = 1e6;
var resolveBranchSlugQuerySearchMax = 200;
var ResolveBranchSlugQueryParams = objectType({
  "directory": coerce.boolean().optional().describe("Opt in to scoped server pagination; omitted preserves the legacy context arrays."),
  "page": coerce.number().int().min(1).max(resolveBranchSlugQueryPageMax).optional(),
  "pageSize": unionType([literalType(10), literalType(25), literalType(50), literalType(100)]).optional(),
  "search": coerce.string().max(resolveBranchSlugQuerySearchMax).optional().describe("Matches public clinic name/address/city or doctor name/specialization only."),
  "sort": enumType(["name", "-name"]).optional().describe("Public name with optional minus prefix; sorting never uses private fields.")
});
var resolveBranchSlugResponseDirectoryPaginationTotalMin = 0;
var resolveBranchSlugResponseBranchCountMin = 0;
var resolveBranchSlugResponseBranchDoctorCountMin = 0;
var resolveBranchSlugResponseBranchesItemOpeningHoursItemDayOfWeekMin = 0;
var resolveBranchSlugResponseBranchesItemOpeningHoursItemDayOfWeekMax = 6;
var resolveBranchSlugResponseBranchOneOpeningHoursItemDayOfWeekMin = 0;
var resolveBranchSlugResponseBranchOneOpeningHoursItemDayOfWeekMax = 6;
var ResolveBranchSlugResponse = objectType({
  "directoryPagination": objectType({
    "total": numberType().int().min(resolveBranchSlugResponseDirectoryPaginationTotalMin),
    "page": numberType().int(),
    "pageSize": numberType().int(),
    "totalPages": numberType().int().optional()
  }).optional(),
  "branchCount": numberType().int().min(resolveBranchSlugResponseBranchCountMin).optional().describe("Active clinic count before directory search."),
  "branchDoctorCount": numberType().int().min(resolveBranchSlugResponseBranchDoctorCountMin).optional().describe("Active doctors at the resolved clinic before directory search."),
  "clinic": objectType({
    "dateFormat": enumType(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": enumType(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "doctorCount": numberType().int().optional(),
    "averageConsultationMinutes": numberType().nullish(),
    "id": stringType(),
    "name": stringType(),
    "slug": stringType(),
    "address": stringType().nullish(),
    "email": stringType().nullish(),
    "phone": stringType().nullish()
  }),
  "branches": arrayType(objectType({
    "dateFormat": enumType(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": enumType(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "id": stringType(),
    "name": stringType(),
    "slug": stringType().nullish(),
    "address": stringType().nullish(),
    "city": stringType().nullish(),
    "timezone": stringType().optional(),
    "effectiveEmail": stringType().nullish(),
    "effectivePhone": stringType().nullish(),
    "openingHours": arrayType(objectType({
      "dayOfWeek": numberType().int().min(resolveBranchSlugResponseBranchesItemOpeningHoursItemDayOfWeekMin).max(resolveBranchSlugResponseBranchesItemOpeningHoursItemDayOfWeekMax),
      "startTime": stringType(),
      "endTime": stringType()
    })).nullish()
  })),
  "branch": unionType([objectType({
    "dateFormat": enumType(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": enumType(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "id": stringType(),
    "name": stringType(),
    "slug": stringType().nullish(),
    "address": stringType().nullish(),
    "city": stringType().nullish(),
    "timezone": stringType().optional(),
    "effectiveEmail": stringType().nullish(),
    "effectivePhone": stringType().nullish(),
    "openingHours": arrayType(objectType({
      "dayOfWeek": numberType().int().min(resolveBranchSlugResponseBranchOneOpeningHoursItemDayOfWeekMin).max(resolveBranchSlugResponseBranchOneOpeningHoursItemDayOfWeekMax),
      "startTime": stringType(),
      "endTime": stringType()
    })).nullish()
  }), nullType()]),
  "qrReference": stringType().nullable(),
  "doctors": arrayType(objectType({
    "averageConsultationMinutes": numberType().nullish().describe("Actual mean of valid completed consultation timestamps"),
    "expectedDurationMinutes": numberType().int().nullish().describe("Explicit clinic duration configuration"),
    "id": stringType(),
    "fullName": stringType(),
    "photoUrl": stringType().optional(),
    "specializationName": stringType().optional(),
    "qualificationNames": arrayType(stringType()).optional(),
    "about": stringType().optional(),
    "experienceYears": numberType().int().optional(),
    "consultationFee": numberType().optional(),
    "clinicIds": arrayType(stringType()),
    "branchIds": arrayType(stringType())
  }))
});
var GetDoctorPresenceParams = objectType({
  "id": coerce.string()
});
var GetDoctorPresenceQueryParams = objectType({
  "branchId": coerce.string(),
  "date": dateType(),
  "sessionId": coerce.string().optional(),
  "startTime": coerce.string().optional()
});
var GetDoctorPresenceResponse = objectType({
  "branchId": stringType(),
  "date": coerce.date(),
  "sessionId": stringType().optional(),
  "startTime": stringType().optional(),
  "status": enumType(["available", "onBreak", "away"])
}).and(objectType({
  "doctorId": stringType(),
  "updatedAt": coerce.date().nullable()
}));
var UpdateDoctorPresenceParams = objectType({
  "id": coerce.string()
});
var UpdateDoctorPresenceBody = objectType({
  "branchId": stringType(),
  "date": coerce.date(),
  "sessionId": stringType().optional(),
  "startTime": stringType().optional(),
  "status": enumType(["available", "onBreak", "away"])
});
var UpdateDoctorPresenceResponse = objectType({
  "branchId": stringType(),
  "date": coerce.date(),
  "sessionId": stringType().optional(),
  "startTime": stringType().optional(),
  "status": enumType(["available", "onBreak", "away"])
}).and(objectType({
  "doctorId": stringType(),
  "updatedAt": coerce.date().nullable()
}));
var GetPublicAvailabilitySessionsQueryParams = objectType({
  "doctorId": coerce.string(),
  "branchId": coerce.string(),
  "date": dateType()
});
var GetPublicAvailabilitySessionsResponseItem = objectType({
  "dateFormat": enumType(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": enumType(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "sessionId": stringType().nullish(),
  "doctorId": stringType(),
  "clinicId": stringType(),
  "branchId": stringType(),
  "date": coerce.date(),
  "available": booleanType(),
  "reason": stringType().nullish(),
  "startTime": stringType().nullish(),
  "endTime": stringType().nullish(),
  "breakStart": stringType().nullish(),
  "breakEnd": stringType().nullish(),
  "timezone": stringType().optional(),
  "maxTokens": numberType().int(),
  "bookedTokens": numberType().int(),
  "remainingTokens": numberType().int(),
  "consultationMinutes": numberType().int().optional(),
  "tokenPrefix": stringType().optional(),
  "queueMode": enumType(["mixed", "appointmentsOnly", "walkInsOnly"]).optional(),
  "queueOpenTime": stringType().optional(),
  "queueCloseTime": stringType().optional()
});
var GetPublicAvailabilitySessionsResponse = arrayType(GetPublicAvailabilitySessionsResponseItem);
var createGuestRequestBodyQrReferenceMax = 200;
var createGuestRequestBodyFullNameMax = 150;
var createGuestRequestBodyEmailMax = 254;
var createGuestRequestBodyMobileMax = 16;
var createGuestRequestBodyMobileRegExp = new RegExp("^\\+[1-9][0-9]{7,14}$");
var createGuestRequestBodyBranchIdMax = 100;
var createGuestRequestBodyDoctorIdMax = 100;
var createGuestRequestBodyDateRegExp = new RegExp("^\\d{4}-\\d{2}-\\d{2}$");
var createGuestRequestBodyReceiptSecretRegExp = new RegExp("^[a-f0-9]{64}$");
var CreateGuestRequestBody = objectType({
  "sessionId": stringType().optional(),
  "startTime": stringType().optional(),
  "qrReference": stringType().min(1).max(createGuestRequestBodyQrReferenceMax),
  "fullName": stringType().min(1).max(createGuestRequestBodyFullNameMax),
  "email": stringType().email().max(createGuestRequestBodyEmailMax).nullish(),
  "mobile": stringType().max(createGuestRequestBodyMobileMax).regex(createGuestRequestBodyMobileRegExp).nullish(),
  "branchId": stringType().min(1).max(createGuestRequestBodyBranchIdMax),
  "doctorId": stringType().min(1).max(createGuestRequestBodyDoctorIdMax),
  "date": stringType().regex(createGuestRequestBodyDateRegExp),
  "requestId": stringType().uuid(),
  "receiptSecret": stringType().regex(createGuestRequestBodyReceiptSecretRegExp)
});
var CreateGuestRequestResponse = objectType({
  "confirmationEmail": enumType(["provider_accepted", "unavailable", "disabled", "no_recipient", "not_attempted"]).optional().describe("Booking confirmation email attempt outcome. Provider acceptance is not proof of inbox delivery."),
  "dateFormat": enumType(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": enumType(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "sessionId": stringType().nullish(),
  "id": stringType(),
  "status": enumType(["pending", "confirmed", "rejected"]),
  "fullName": stringType(),
  "clinicName": stringType(),
  "branchName": stringType(),
  "doctorName": stringType(),
  "date": stringType(),
  "startTime": stringType().nullable(),
  "endTime": stringType().nullable(),
  "timezone": stringType(),
  "token": stringType().nullable(),
  "reason": stringType().nullable(),
  "appointmentId": stringType().nullable(),
  "reference": stringType().nullable(),
  "branchAddress": stringType().nullable(),
  "appointmentStatus": stringType().nullable(),
  "revision": numberType().int().nullable(),
  "checkInUrl": stringType().nullable().describe("Personal signed check-in QR URL. Keep private like receiptSecret; only returned via booking or receipt capability.")
});
var getGuestReceiptBodyReceiptSecretRegExp = new RegExp("^[a-f0-9]{64}$");
var GetGuestReceiptBody = objectType({
  "receiptSecret": stringType().regex(getGuestReceiptBodyReceiptSecretRegExp)
});
var GetGuestReceiptResponse = objectType({
  "confirmationEmail": enumType(["provider_accepted", "unavailable", "disabled", "no_recipient", "not_attempted"]).optional().describe("Booking confirmation email attempt outcome. Provider acceptance is not proof of inbox delivery."),
  "dateFormat": enumType(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": enumType(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "sessionId": stringType().nullish(),
  "id": stringType(),
  "status": enumType(["pending", "confirmed", "rejected"]),
  "fullName": stringType(),
  "clinicName": stringType(),
  "branchName": stringType(),
  "doctorName": stringType(),
  "date": stringType(),
  "startTime": stringType().nullable(),
  "endTime": stringType().nullable(),
  "timezone": stringType(),
  "token": stringType().nullable(),
  "reason": stringType().nullable(),
  "appointmentId": stringType().nullable(),
  "reference": stringType().nullable(),
  "branchAddress": stringType().nullable(),
  "appointmentStatus": stringType().nullable(),
  "revision": numberType().int().nullable(),
  "checkInUrl": stringType().nullable().describe("Personal signed check-in QR URL. Keep private like receiptSecret; only returned via booking or receipt capability.")
});
var listGuestRequestsQuerySearchMax = 200;
var listGuestRequestsQuerySortDefault = `-createdAt`;
var listGuestRequestsQueryPageMax = 1e5;
var listGuestRequestsQueryPageSizeMax = 100;
var ListGuestRequestsQueryParams = objectType({
  "search": coerce.string().max(listGuestRequestsQuerySearchMax).optional(),
  "sort": enumType(["createdAt", "-createdAt", "fullName", "-fullName", "date", "-date"]).default(listGuestRequestsQuerySortDefault),
  "sessionId": coerce.string().optional(),
  "startTime": coerce.string().optional(),
  "clinicId": coerce.string().optional(),
  "branchId": coerce.string().optional(),
  "doctorId": coerce.string().optional(),
  "date": dateType().optional(),
  "status": enumType(["pending", "confirmed", "rejected"]).optional(),
  "page": coerce.number().int().min(1).max(listGuestRequestsQueryPageMax).optional(),
  "pageSize": coerce.number().int().min(1).max(listGuestRequestsQueryPageSizeMax).optional()
});
var ListGuestRequestsResponse = objectType({
  "items": arrayType(objectType({
    "confirmationEmail": enumType(["provider_accepted", "unavailable", "disabled", "no_recipient", "not_attempted"]).optional().describe("Booking confirmation email attempt outcome. Provider acceptance is not proof of inbox delivery."),
    "dateFormat": enumType(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": enumType(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "sessionId": stringType().nullish(),
    "id": stringType(),
    "status": enumType(["pending", "confirmed", "rejected"]),
    "fullName": stringType(),
    "clinicName": stringType(),
    "branchName": stringType(),
    "doctorName": stringType(),
    "date": stringType(),
    "startTime": stringType().nullable(),
    "endTime": stringType().nullable(),
    "timezone": stringType(),
    "token": stringType().nullable(),
    "reason": stringType().nullable(),
    "appointmentId": stringType().nullable(),
    "reference": stringType().nullable(),
    "branchAddress": stringType().nullable(),
    "appointmentStatus": stringType().nullable(),
    "revision": numberType().int().nullable(),
    "checkInUrl": stringType().nullable().describe("Personal signed check-in QR URL. Keep private like receiptSecret; only returned via booking or receipt capability.")
  }).and(objectType({
    "clinicId": stringType(),
    "branchId": stringType(),
    "doctorId": stringType(),
    "email": stringType().nullable(),
    "mobile": stringType().nullable(),
    "appointmentId": stringType().nullable(),
    "createdAt": coerce.date()
  }))),
  "total": numberType().int(),
  "page": numberType().int(),
  "pageSize": numberType().int()
});
var DecideGuestRequestParams = objectType({
  "id": coerce.string()
});
var decideGuestRequestBodyReasonMax = 500;
var DecideGuestRequestBody = objectType({
  "action": enumType(["confirm", "reject"]),
  "reason": stringType().min(1).max(decideGuestRequestBodyReasonMax)
});
var DecideGuestRequestResponse = objectType({
  "confirmationEmail": enumType(["provider_accepted", "unavailable", "disabled", "no_recipient", "not_attempted"]).optional().describe("Booking confirmation email attempt outcome. Provider acceptance is not proof of inbox delivery."),
  "dateFormat": enumType(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": enumType(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "sessionId": stringType().nullish(),
  "id": stringType(),
  "status": enumType(["pending", "confirmed", "rejected"]),
  "fullName": stringType(),
  "clinicName": stringType(),
  "branchName": stringType(),
  "doctorName": stringType(),
  "date": stringType(),
  "startTime": stringType().nullable(),
  "endTime": stringType().nullable(),
  "timezone": stringType(),
  "token": stringType().nullable(),
  "reason": stringType().nullable(),
  "appointmentId": stringType().nullable(),
  "reference": stringType().nullable(),
  "branchAddress": stringType().nullable(),
  "appointmentStatus": stringType().nullable(),
  "revision": numberType().int().nullable(),
  "checkInUrl": stringType().nullable().describe("Personal signed check-in QR URL. Keep private like receiptSecret; only returned via booking or receipt capability.")
}).and(objectType({
  "clinicId": stringType(),
  "branchId": stringType(),
  "doctorId": stringType(),
  "email": stringType().nullable(),
  "mobile": stringType().nullable(),
  "appointmentId": stringType().nullable(),
  "createdAt": coerce.date()
}));
var HealthCheckResponse = objectType({
  "status": stringType()
});
var GetAuthCsrfResponse = objectType({
  "csrfToken": stringType()
});
var nativeStaffLoginBodyPasswordMax = 1024;
var NativeStaffLoginBody = objectType({
  "email": stringType().email(),
  "password": stringType().min(1).max(nativeStaffLoginBodyPasswordMax)
});
var NativeStaffLoginResponse = objectType({
  "authenticated": literalType(true),
  "user": objectType({
    "id": stringType(),
    "email": stringType().email(),
    "fullName": stringType(),
    "role": enumType(["superAdmin", "clinicAdmin", "doctor", "receptionist"]),
    "status": enumType(["active"])
  })
});
var verifyStaffDeviceBodyCodeMin = 6;
var verifyStaffDeviceBodyCodeMax = 6;
var VerifyStaffDeviceBody = objectType({
  "challengeId": stringType(),
  "code": stringType().min(verifyStaffDeviceBodyCodeMin).max(verifyStaffDeviceBodyCodeMax)
});
var VerifyStaffDeviceResponse = voidType();
var startPatientEmailBodyEmailMax = 254;
var StartPatientEmailBody = objectType({
  "email": stringType().email().max(startPatientEmailBodyEmailMax)
});
var StartPatientEmailResponse = objectType({
  "challengeId": stringType(),
  "requiresVerification": booleanType().optional()
});
var verifyPatientEmailBodyCodeMin = 6;
var verifyPatientEmailBodyCodeMax = 6;
var VerifyPatientEmailBody = objectType({
  "challengeId": stringType(),
  "code": stringType().min(verifyPatientEmailBodyCodeMin).max(verifyPatientEmailBodyCodeMax)
});
var VerifyPatientEmailResponse = objectType({
  "authenticated": booleanType()
});
var startClinicRegistrationBodyFullNameMax = 200;
var startClinicRegistrationBodyPasswordMin = 8;
var startClinicRegistrationBodyPasswordMax = 1024;
var startClinicRegistrationBodyPasswordRegExp = new RegExp("^(?=[\\s\\S]*[A-Za-z])(?=[\\s\\S]*[0-9])[\\s\\S]*$");
var StartClinicRegistrationBody = objectType({
  "email": stringType().email(),
  "fullName": stringType().min(1).max(startClinicRegistrationBodyFullNameMax),
  "password": stringType().min(startClinicRegistrationBodyPasswordMin).max(startClinicRegistrationBodyPasswordMax).regex(startClinicRegistrationBodyPasswordRegExp).describe("Requires letters and numbers; maximum 1024 UTF-8 bytes, enforced by server.")
});
var StartClinicRegistrationResponse = objectType({
  "challengeId": stringType(),
  "requiresVerification": booleanType().optional()
});
var ResendClinicRegistrationBody = objectType({
  "challengeId": stringType()
});
var ResendClinicRegistrationResponse = objectType({
  "challengeId": stringType()
});
var verifyClinicRegistrationBodyCodeMin = 6;
var verifyClinicRegistrationBodyCodeMax = 6;
var VerifyClinicRegistrationBody = objectType({
  "challengeId": stringType(),
  "code": stringType().min(verifyClinicRegistrationBodyCodeMin).max(verifyClinicRegistrationBodyCodeMax)
});
var VerifyClinicRegistrationResponse = objectType({
  "authenticated": booleanType()
});
var requestPasswordRecoveryBodyEmailMax = 254;
var RequestPasswordRecoveryBody = objectType({
  "email": stringType().email().max(requestPasswordRecoveryBodyEmailMax)
});
var RequestPasswordRecoveryResponse = objectType({
  "sent": booleanType()
});
var resetNativePasswordBodyPasswordMin = 8;
var resetNativePasswordBodyPasswordMax = 1024;
var resetNativePasswordBodyPasswordRegExp = new RegExp("^(?=[\\s\\S]*[A-Za-z])(?=[\\s\\S]*[0-9])[\\s\\S]*$");
var ResetNativePasswordBody = objectType({
  "token": stringType(),
  "password": stringType().min(resetNativePasswordBodyPasswordMin).max(resetNativePasswordBodyPasswordMax).regex(resetNativePasswordBodyPasswordRegExp).describe("Requires letters and numbers; maximum 1024 UTF-8 bytes, enforced by server.")
});
var ResetNativePasswordResponse = objectType({
  "reset": booleanType()
});
var acceptStaffInvitationBodyPasswordMin = 8;
var acceptStaffInvitationBodyPasswordMax = 1024;
var acceptStaffInvitationBodyPasswordRegExp = new RegExp("^(?=[\\s\\S]*[A-Za-z])(?=[\\s\\S]*[0-9])[\\s\\S]*$");
var AcceptStaffInvitationBody = objectType({
  "token": stringType(),
  "password": stringType().min(acceptStaffInvitationBodyPasswordMin).max(acceptStaffInvitationBodyPasswordMax).regex(acceptStaffInvitationBodyPasswordRegExp).describe("Requires letters and numbers; maximum 1024 UTF-8 bytes, enforced by server.")
});
var AcceptStaffInvitationResponse = objectType({
  "authenticated": booleanType()
});
var changeNativePasswordBodyPasswordMin = 8;
var changeNativePasswordBodyPasswordMax = 1024;
var changeNativePasswordBodyPasswordRegExp = new RegExp("^(?=[\\s\\S]*[A-Za-z])(?=[\\s\\S]*[0-9])[\\s\\S]*$");
var ChangeNativePasswordBody = objectType({
  "currentPassword": stringType(),
  "password": stringType().min(changeNativePasswordBodyPasswordMin).max(changeNativePasswordBodyPasswordMax).regex(changeNativePasswordBodyPasswordRegExp).describe("Requires letters and numbers; maximum 1024 UTF-8 bytes, enforced by server.")
});
var ChangeNativePasswordResponse = objectType({
  "changed": booleanType()
});
var LogoutNativeSessionResponse = objectType({
  "authenticated": booleanType()
});
var GetAuthStatusResponse = objectType({
  "role": stringType().nullable(),
  "staffPasswordVerified": booleanType(),
  "requiresStaffPassword": booleanType()
});
var GetMeResponse = objectType({
  "userId": stringType(),
  "user": unionType([objectType({
    "fullName": stringType().min(1),
    "email": stringType().email(),
    "mobile": stringType().optional(),
    "role": enumType(["superAdmin", "clinicAdmin", "doctor", "receptionist", "patient"]),
    "status": enumType(["active", "inactive"]),
    "clinicIds": arrayType(stringType()).min(1).describe("Required by the server for clinic-scoped roles."),
    "branchIds": arrayType(stringType()),
    "managingAdminId": stringType().describe("Backward-compatible only. If supplied it must match the managing admin derived by the server.")
  }).and(objectType({
    "id": stringType(),
    "managingAdminId": stringType().nullable(),
    "managingAdminName": stringType().nullable(),
    "invitationStatus": enumType(["sent", "failed", "notRequired"]),
    "passwordEnabled": booleanType().optional().describe("Whether this staff record has a local password configured."),
    "createdAt": coerce.date().nullable(),
    "lastLoginAt": coerce.date().nullish()
  })), nullType()]),
  "doctorId": stringType().nullish(),
  "patientId": stringType().nullish(),
  "needsOnboarding": booleanType()
});
var UpdateMeBody = objectType({
  "fullName": stringType().min(1).optional(),
  "mobile": stringType().optional(),
  "photoUrl": stringType().optional()
});
var UpdateMeResponse = objectType({
  "fullName": stringType().min(1),
  "email": stringType().email(),
  "mobile": stringType().optional(),
  "role": enumType(["superAdmin", "clinicAdmin", "doctor", "receptionist", "patient"]),
  "status": enumType(["active", "inactive"]),
  "clinicIds": arrayType(stringType()).min(1).describe("Required by the server for clinic-scoped roles."),
  "branchIds": arrayType(stringType()),
  "managingAdminId": stringType().describe("Backward-compatible only. If supplied it must match the managing admin derived by the server.")
}).and(objectType({
  "id": stringType(),
  "managingAdminId": stringType().nullable(),
  "managingAdminName": stringType().nullable(),
  "invitationStatus": enumType(["sent", "failed", "notRequired"]),
  "passwordEnabled": booleanType().optional().describe("Whether this staff record has a local password configured."),
  "createdAt": coerce.date().nullable(),
  "lastLoginAt": coerce.date().nullish()
}));
var onboardBodyIntentDefault = `patient`;
var OnboardBody = objectType({
  "intent": enumType(["patient"]).default(onboardBodyIntentDefault),
  "fullName": stringType().min(1),
  "mobile": stringType().optional(),
  "termsAccepted": booleanType().optional()
});
var OnboardResponse = objectType({
  "userId": stringType(),
  "user": unionType([objectType({
    "fullName": stringType().min(1),
    "email": stringType().email(),
    "mobile": stringType().optional(),
    "role": enumType(["superAdmin", "clinicAdmin", "doctor", "receptionist", "patient"]),
    "status": enumType(["active", "inactive"]),
    "clinicIds": arrayType(stringType()).min(1).describe("Required by the server for clinic-scoped roles."),
    "branchIds": arrayType(stringType()),
    "managingAdminId": stringType().describe("Backward-compatible only. If supplied it must match the managing admin derived by the server.")
  }).and(objectType({
    "id": stringType(),
    "managingAdminId": stringType().nullable(),
    "managingAdminName": stringType().nullable(),
    "invitationStatus": enumType(["sent", "failed", "notRequired"]),
    "passwordEnabled": booleanType().optional().describe("Whether this staff record has a local password configured."),
    "createdAt": coerce.date().nullable(),
    "lastLoginAt": coerce.date().nullish()
  })), nullType()]),
  "doctorId": stringType().nullish(),
  "patientId": stringType().nullish(),
  "needsOnboarding": booleanType()
});
var requestOtpBodyMobileRegExp = new RegExp("^\\+[1-9][0-9]{7,14}$");
var RequestOtpBody = objectType({
  "mobile": stringType().regex(requestOtpBodyMobileRegExp)
});
var RequestOtpResponse = objectType({
  "challengeId": stringType(),
  "expiresAt": coerce.date(),
  "resendAfterSeconds": numberType().int(),
  "provider": enumType(["sms", "development"]),
  "developmentCode": stringType().optional().describe("Returned only by the explicitly enabled development provider when NODE_ENV=development. Never present in production.")
});
var verifyOtpBodyCodeRegExp = new RegExp("^[0-9]{4,8}$");
var VerifyOtpBody = objectType({
  "challengeId": stringType(),
  "code": stringType().regex(verifyOtpBodyCodeRegExp)
});
var VerifyOtpResponse = objectType({
  "verified": booleanType(),
  "mobile": stringType(),
  "verifiedAt": coerce.date().optional()
});
var listPublicClinicsQuerySelectedIdsMax = 1e4;
var listPublicClinicsQueryPageDefault = 1;
var listPublicClinicsQueryPageSizeDefault = 20;
var listPublicClinicsQueryPageSizeMax = 100;
var ListPublicClinicsQueryParams = objectType({
  "selectedIds": coerce.string().max(listPublicClinicsQuerySelectedIdsMax).optional().describe("Comma-separated exact IDs within existing scope (maximum 100)."),
  "search": coerce.string().optional(),
  "page": coerce.number().int().min(1).default(listPublicClinicsQueryPageDefault),
  "pageSize": coerce.number().int().min(1).max(listPublicClinicsQueryPageSizeMax).default(listPublicClinicsQueryPageSizeDefault)
});
var listPublicClinicsResponseOneTotalMin = 0;
var listPublicClinicsResponseTwoItemsItemOneSlugMin = 3;
var listPublicClinicsResponseTwoItemsItemOneSlugMax = 63;
var listPublicClinicsResponseTwoItemsItemOneReferralCodeMax = 100;
var ListPublicClinicsResponse = objectType({
  "total": numberType().int().min(listPublicClinicsResponseOneTotalMin),
  "page": numberType().int(),
  "pageSize": numberType().int(),
  "totalPages": numberType().int().optional()
}).and(objectType({
  "items": arrayType(objectType({
    "dateFormat": enumType(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": enumType(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "slug": stringType().min(listPublicClinicsResponseTwoItemsItemOneSlugMin).max(listPublicClinicsResponseTwoItemsItemOneSlugMax).optional(),
    "specialityIds": arrayType(stringType()).optional(),
    "referralCode": stringType().max(listPublicClinicsResponseTwoItemsItemOneReferralCodeMax).nullish(),
    "adminId": stringType().describe("Super admins may select the owning clinic administrator; other roles are assigned by the server."),
    "name": stringType().min(1),
    "address": stringType(),
    "country": stringType().optional(),
    "state": stringType().optional(),
    "city": stringType().optional(),
    "area": stringType().optional(),
    "pincode": stringType().optional(),
    "phone": stringType().nullish(),
    "email": stringType().email().nullish(),
    "description": stringType().optional(),
    "clinicTypeId": stringType().optional(),
    "categoryId": stringType().nullish(),
    "status": enumType(["active", "inactive"])
  }).and(objectType({
    "id": stringType(),
    "code": stringType(),
    "adminName": stringType(),
    "createdAt": coerce.date().nullable(),
    "doctorCount": numberType().int().optional(),
    "branchCount": numberType().int().optional()
  })))
}));
var listPublicBranchesQuerySelectedIdsMax = 1e4;
var listPublicBranchesQueryPageDefault = 1;
var listPublicBranchesQueryPageSizeDefault = 20;
var listPublicBranchesQueryPageSizeMax = 100;
var ListPublicBranchesQueryParams = objectType({
  "selectedIds": coerce.string().max(listPublicBranchesQuerySelectedIdsMax).optional().describe("Comma-separated exact IDs within existing scope (maximum 100)."),
  "search": coerce.string().optional(),
  "doctorId": coerce.string().optional(),
  "clinicId": coerce.string().optional(),
  "page": coerce.number().int().min(1).default(listPublicBranchesQueryPageDefault),
  "pageSize": coerce.number().int().min(1).max(listPublicBranchesQueryPageSizeMax).default(listPublicBranchesQueryPageSizeDefault)
});
var listPublicBranchesResponseOneTotalMin = 0;
var listPublicBranchesResponseTwoItemsItemOneSlugMin = 3;
var listPublicBranchesResponseTwoItemsItemOneSlugMax = 63;
var listPublicBranchesResponseTwoItemsItemOneOpeningHoursItemDayOfWeekMin = 0;
var listPublicBranchesResponseTwoItemsItemOneOpeningHoursItemDayOfWeekMax = 6;
var listPublicBranchesResponseTwoItemsItemOneOpeningHoursMax = 28;
var listPublicBranchesResponseTwoItemsItemOneTimezoneDefault = `Asia/Kolkata`;
var listPublicBranchesResponseTwoItemsItemTwoLinkedScheduleMaxTokensMax = 1e3;
var listPublicBranchesResponseTwoItemsItemTwoLinkedScheduleConsultationMinutesMax = 240;
var listPublicBranchesResponseTwoItemsItemTwoLinkedScheduleTokenPrefixRegExp = new RegExp("^[A-Za-z0-9]{1,8}$");
var ListPublicBranchesResponse = objectType({
  "total": numberType().int().min(listPublicBranchesResponseOneTotalMin),
  "page": numberType().int(),
  "pageSize": numberType().int(),
  "totalPages": numberType().int().optional()
}).and(objectType({
  "items": arrayType(objectType({
    "slug": stringType().min(listPublicBranchesResponseTwoItemsItemOneSlugMin).max(listPublicBranchesResponseTwoItemsItemOneSlugMax).optional(),
    "email": stringType().email().nullish(),
    "inheritEmail": booleanType().optional(),
    "inheritPhone": booleanType().optional(),
    "openingHours": arrayType(objectType({
      "dayOfWeek": numberType().int().min(listPublicBranchesResponseTwoItemsItemOneOpeningHoursItemDayOfWeekMin).max(listPublicBranchesResponseTwoItemsItemOneOpeningHoursItemDayOfWeekMax),
      "startTime": stringType(),
      "endTime": stringType()
    })).max(listPublicBranchesResponseTwoItemsItemOneOpeningHoursMax).nullish().describe("Null or absent is legacy unrestricted; empty array means closed all days."),
    "clinicId": stringType(),
    "name": stringType().min(1),
    "address": stringType(),
    "city": stringType().optional(),
    "state": stringType().optional(),
    "pincode": stringType().optional(),
    "phone": stringType().nullish(),
    "timezone": stringType().default(listPublicBranchesResponseTwoItemsItemOneTimezoneDefault),
    "status": enumType(["active", "inactive"])
  }).and(objectType({
    "dateFormat": enumType(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": enumType(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "linkedSchedule": objectType({
      "enabled": booleanType(),
      "doctorId": stringType().optional(),
      "maxTokens": numberType().int().min(1).max(listPublicBranchesResponseTwoItemsItemTwoLinkedScheduleMaxTokensMax).optional(),
      "consultationMinutes": numberType().int().min(1).max(listPublicBranchesResponseTwoItemsItemTwoLinkedScheduleConsultationMinutesMax).optional(),
      "tokenPrefix": stringType().regex(listPublicBranchesResponseTwoItemsItemTwoLinkedScheduleTokenPrefixRegExp).optional(),
      "queueMode": enumType(["mixed", "appointmentsOnly", "walkInsOnly"]).optional()
    }).optional(),
    "effectiveEmail": stringType().nullish(),
    "effectivePhone": stringType().nullish(),
    "id": stringType(),
    "code": stringType(),
    "clinicName": stringType().optional(),
    "createdAt": coerce.date().nullable()
  })))
}));
var listPublicDoctorsQuerySelectedIdsMax = 1e4;
var listPublicDoctorsQueryPageDefault = 1;
var listPublicDoctorsQueryPageSizeDefault = 20;
var listPublicDoctorsQueryPageSizeMax = 100;
var ListPublicDoctorsQueryParams = objectType({
  "selectedIds": coerce.string().max(listPublicDoctorsQuerySelectedIdsMax).optional().describe("Comma-separated exact IDs within existing scope (maximum 100)."),
  "search": coerce.string().optional(),
  "clinicId": coerce.string().optional(),
  "branchId": coerce.string().optional(),
  "specializationId": coerce.string().optional(),
  "page": coerce.number().int().min(1).default(listPublicDoctorsQueryPageDefault),
  "pageSize": coerce.number().int().min(1).max(listPublicDoctorsQueryPageSizeMax).default(listPublicDoctorsQueryPageSizeDefault)
});
var listPublicDoctorsResponseOneTotalMin = 0;
var ListPublicDoctorsResponse = objectType({
  "total": numberType().int().min(listPublicDoctorsResponseOneTotalMin),
  "page": numberType().int(),
  "pageSize": numberType().int(),
  "totalPages": numberType().int().optional()
}).and(objectType({
  "items": arrayType(objectType({
    "averageConsultationMinutes": numberType().nullish().describe("Actual mean of valid completed consultation timestamps"),
    "expectedDurationMinutes": numberType().int().nullish().describe("Explicit clinic duration configuration"),
    "id": stringType(),
    "fullName": stringType(),
    "photoUrl": stringType().optional(),
    "specializationName": stringType().optional(),
    "qualificationNames": arrayType(stringType()).optional(),
    "about": stringType().optional(),
    "experienceYears": numberType().int().optional(),
    "consultationFee": numberType().optional(),
    "clinicIds": arrayType(stringType()),
    "branchIds": arrayType(stringType())
  }))
}));
var GetPublicAvailabilityQueryParams = objectType({
  "sessionId": coerce.string().optional(),
  "startTime": coerce.string().optional(),
  "doctorId": coerce.string(),
  "branchId": coerce.string(),
  "date": dateType()
});
var GetPublicAvailabilityResponse = objectType({
  "dateFormat": enumType(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": enumType(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "sessionId": stringType().nullish(),
  "doctorId": stringType(),
  "clinicId": stringType(),
  "branchId": stringType(),
  "date": coerce.date(),
  "available": booleanType(),
  "reason": stringType().nullish(),
  "startTime": stringType().nullish(),
  "endTime": stringType().nullish(),
  "breakStart": stringType().nullish(),
  "breakEnd": stringType().nullish(),
  "timezone": stringType().optional(),
  "maxTokens": numberType().int(),
  "bookedTokens": numberType().int(),
  "remainingTokens": numberType().int(),
  "consultationMinutes": numberType().int().optional(),
  "tokenPrefix": stringType().optional(),
  "queueMode": enumType(["mixed", "appointmentsOnly", "walkInsOnly"]).optional(),
  "queueOpenTime": stringType().optional(),
  "queueCloseTime": stringType().optional()
});
var GetPublicDisplayParams = objectType({
  "reference": coerce.string()
});
var GetPublicDisplayResponse = objectType({
  "dateFormat": enumType(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": enumType(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "clinic": objectType({
    "name": stringType()
  }),
  "branch": objectType({
    "name": stringType(),
    "address": stringType().nullable(),
    "city": stringType().nullable(),
    "timezone": stringType()
  }),
  "date": coerce.date(),
  "updatedAt": coerce.date(),
  "sessions": arrayType(objectType({
    "dateFormat": enumType(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": enumType(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "sessionId": stringType().nullish(),
    "presence": enumType(["available", "onBreak", "away"]).optional(),
    "doctorId": stringType(),
    "doctorName": stringType(),
    "startTime": stringType().nullable(),
    "endTime": stringType().nullable(),
    "currentToken": stringType().nullable(),
    "currentStatus": unionType([literalType("called"), literalType("inConsultation"), literalType(null)]).nullable(),
    "nextToken": stringType().nullable(),
    "waitingTokens": arrayType(stringType()),
    "waitingCount": numberType().int(),
    "completedCount": numberType().int()
  }))
});
var ResolveQrParams = objectType({
  "reference": coerce.string()
});
var ResolveQrResponse = objectType({
  "dateFormat": enumType(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": enumType(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "reference": stringType(),
  "clinicId": stringType(),
  "clinicName": stringType(),
  "clinicAddress": stringType().nullish(),
  "branchAddress": stringType().nullish(),
  "branchCity": stringType().nullish(),
  "branchTimezone": stringType().nullish(),
  "branchId": stringType().nullish(),
  "branchName": stringType().nullish(),
  "doctorId": stringType().nullish(),
  "doctorName": stringType().nullish()
});
var listClinicsQueryPageDefault = 1;
var listClinicsQueryPageSizeDefault = 20;
var listClinicsQueryPageSizeMax = 100;
var ListClinicsQueryParams = objectType({
  "search": coerce.string().optional(),
  "status": enumType(["active", "inactive"]).optional(),
  "adminId": coerce.string().optional(),
  "city": coerce.string().optional(),
  "page": coerce.number().int().min(1).default(listClinicsQueryPageDefault),
  "pageSize": coerce.number().int().min(1).max(listClinicsQueryPageSizeMax).default(listClinicsQueryPageSizeDefault),
  "sort": coerce.string().optional().describe("Allowlisted field with optional minus prefix for descending order")
});
var listClinicsResponseOneTotalMin = 0;
var listClinicsResponseTwoItemsItemOneSlugMin = 3;
var listClinicsResponseTwoItemsItemOneSlugMax = 63;
var listClinicsResponseTwoItemsItemOneReferralCodeMax = 100;
var ListClinicsResponse = objectType({
  "total": numberType().int().min(listClinicsResponseOneTotalMin),
  "page": numberType().int(),
  "pageSize": numberType().int(),
  "totalPages": numberType().int().optional()
}).and(objectType({
  "items": arrayType(objectType({
    "dateFormat": enumType(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": enumType(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "slug": stringType().min(listClinicsResponseTwoItemsItemOneSlugMin).max(listClinicsResponseTwoItemsItemOneSlugMax).optional(),
    "specialityIds": arrayType(stringType()).optional(),
    "referralCode": stringType().max(listClinicsResponseTwoItemsItemOneReferralCodeMax).nullish(),
    "adminId": stringType().describe("Super admins may select the owning clinic administrator; other roles are assigned by the server."),
    "name": stringType().min(1),
    "address": stringType(),
    "country": stringType().optional(),
    "state": stringType().optional(),
    "city": stringType().optional(),
    "area": stringType().optional(),
    "pincode": stringType().optional(),
    "phone": stringType().nullish(),
    "email": stringType().email().nullish(),
    "description": stringType().optional(),
    "clinicTypeId": stringType().optional(),
    "categoryId": stringType().nullish(),
    "status": enumType(["active", "inactive"])
  }).and(objectType({
    "id": stringType(),
    "code": stringType(),
    "adminName": stringType(),
    "createdAt": coerce.date().nullable(),
    "doctorCount": numberType().int().optional(),
    "branchCount": numberType().int().optional()
  })))
}));
var createClinicBodySlugMin = 3;
var createClinicBodySlugMax = 63;
var createClinicBodyReferralCodeMax = 100;
var CreateClinicBody = objectType({
  "dateFormat": enumType(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": enumType(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "slug": stringType().min(createClinicBodySlugMin).max(createClinicBodySlugMax).optional(),
  "specialityIds": arrayType(stringType()).optional(),
  "referralCode": stringType().max(createClinicBodyReferralCodeMax).nullish(),
  "adminId": stringType().optional().describe("Super admins may select the owning clinic administrator; other roles are assigned by the server."),
  "name": stringType().min(1),
  "address": stringType(),
  "country": stringType().optional(),
  "state": stringType().optional(),
  "city": stringType().optional(),
  "area": stringType().optional(),
  "pincode": stringType().optional(),
  "phone": stringType().nullish(),
  "email": stringType().email().nullish(),
  "description": stringType().optional(),
  "clinicTypeId": stringType().optional(),
  "categoryId": stringType().nullish(),
  "status": enumType(["active", "inactive"]).optional()
});
var createClinicResponseOneSlugMin = 3;
var createClinicResponseOneSlugMax = 63;
var createClinicResponseOneReferralCodeMax = 100;
var CreateClinicResponse = objectType({
  "dateFormat": enumType(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": enumType(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "slug": stringType().min(createClinicResponseOneSlugMin).max(createClinicResponseOneSlugMax).optional(),
  "specialityIds": arrayType(stringType()).optional(),
  "referralCode": stringType().max(createClinicResponseOneReferralCodeMax).nullish(),
  "adminId": stringType().describe("Super admins may select the owning clinic administrator; other roles are assigned by the server."),
  "name": stringType().min(1),
  "address": stringType(),
  "country": stringType().optional(),
  "state": stringType().optional(),
  "city": stringType().optional(),
  "area": stringType().optional(),
  "pincode": stringType().optional(),
  "phone": stringType().nullish(),
  "email": stringType().email().nullish(),
  "description": stringType().optional(),
  "clinicTypeId": stringType().optional(),
  "categoryId": stringType().nullish(),
  "status": enumType(["active", "inactive"])
}).and(objectType({
  "id": stringType(),
  "code": stringType(),
  "adminName": stringType(),
  "createdAt": coerce.date().nullable(),
  "doctorCount": numberType().int().optional(),
  "branchCount": numberType().int().optional()
}));
var GetClinicParams = objectType({
  "id": coerce.string()
});
var getClinicResponseOneSlugMin = 3;
var getClinicResponseOneSlugMax = 63;
var getClinicResponseOneReferralCodeMax = 100;
var GetClinicResponse = objectType({
  "dateFormat": enumType(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": enumType(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "slug": stringType().min(getClinicResponseOneSlugMin).max(getClinicResponseOneSlugMax).optional(),
  "specialityIds": arrayType(stringType()).optional(),
  "referralCode": stringType().max(getClinicResponseOneReferralCodeMax).nullish(),
  "adminId": stringType().describe("Super admins may select the owning clinic administrator; other roles are assigned by the server."),
  "name": stringType().min(1),
  "address": stringType(),
  "country": stringType().optional(),
  "state": stringType().optional(),
  "city": stringType().optional(),
  "area": stringType().optional(),
  "pincode": stringType().optional(),
  "phone": stringType().nullish(),
  "email": stringType().email().nullish(),
  "description": stringType().optional(),
  "clinicTypeId": stringType().optional(),
  "categoryId": stringType().nullish(),
  "status": enumType(["active", "inactive"])
}).and(objectType({
  "id": stringType(),
  "code": stringType(),
  "adminName": stringType(),
  "createdAt": coerce.date().nullable(),
  "doctorCount": numberType().int().optional(),
  "branchCount": numberType().int().optional()
}));
var UpdateClinicParams = objectType({
  "id": coerce.string()
});
var updateClinicBodySlugMin = 3;
var updateClinicBodySlugMax = 63;
var updateClinicBodyReferralCodeMax = 100;
var UpdateClinicBody = objectType({
  "dateFormat": enumType(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": enumType(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "slug": stringType().min(updateClinicBodySlugMin).max(updateClinicBodySlugMax).optional(),
  "specialityIds": arrayType(stringType()).optional(),
  "referralCode": stringType().max(updateClinicBodyReferralCodeMax).nullish(),
  "adminId": stringType().optional().describe("Super admins may select the owning clinic administrator; other roles are assigned by the server."),
  "name": stringType().min(1),
  "address": stringType(),
  "country": stringType().optional(),
  "state": stringType().optional(),
  "city": stringType().optional(),
  "area": stringType().optional(),
  "pincode": stringType().optional(),
  "phone": stringType().nullish(),
  "email": stringType().email().nullish(),
  "description": stringType().optional(),
  "clinicTypeId": stringType().optional(),
  "categoryId": stringType().nullish(),
  "status": enumType(["active", "inactive"]).optional()
});
var updateClinicResponseOneSlugMin = 3;
var updateClinicResponseOneSlugMax = 63;
var updateClinicResponseOneReferralCodeMax = 100;
var UpdateClinicResponse = objectType({
  "dateFormat": enumType(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": enumType(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "slug": stringType().min(updateClinicResponseOneSlugMin).max(updateClinicResponseOneSlugMax).optional(),
  "specialityIds": arrayType(stringType()).optional(),
  "referralCode": stringType().max(updateClinicResponseOneReferralCodeMax).nullish(),
  "adminId": stringType().describe("Super admins may select the owning clinic administrator; other roles are assigned by the server."),
  "name": stringType().min(1),
  "address": stringType(),
  "country": stringType().optional(),
  "state": stringType().optional(),
  "city": stringType().optional(),
  "area": stringType().optional(),
  "pincode": stringType().optional(),
  "phone": stringType().nullish(),
  "email": stringType().email().nullish(),
  "description": stringType().optional(),
  "clinicTypeId": stringType().optional(),
  "categoryId": stringType().nullish(),
  "status": enumType(["active", "inactive"])
}).and(objectType({
  "id": stringType(),
  "code": stringType(),
  "adminName": stringType(),
  "createdAt": coerce.date().nullable(),
  "doctorCount": numberType().int().optional(),
  "branchCount": numberType().int().optional()
}));
var DeleteClinicParams = objectType({
  "id": coerce.string()
});
var DeleteClinicResponse = voidType();
var listBranchesQueryPageDefault = 1;
var listBranchesQueryPageSizeDefault = 20;
var listBranchesQueryPageSizeMax = 100;
var ListBranchesQueryParams = objectType({
  "doctorId": coerce.string().optional(),
  "clinicId": coerce.string().optional(),
  "search": coerce.string().optional(),
  "status": enumType(["active", "inactive"]).optional(),
  "page": coerce.number().int().min(1).default(listBranchesQueryPageDefault),
  "pageSize": coerce.number().int().min(1).max(listBranchesQueryPageSizeMax).default(listBranchesQueryPageSizeDefault),
  "sort": coerce.string().optional().describe("Allowlisted field with optional minus prefix for descending order")
});
var listBranchesResponseOneTotalMin = 0;
var listBranchesResponseTwoItemsItemOneSlugMin = 3;
var listBranchesResponseTwoItemsItemOneSlugMax = 63;
var listBranchesResponseTwoItemsItemOneOpeningHoursItemDayOfWeekMin = 0;
var listBranchesResponseTwoItemsItemOneOpeningHoursItemDayOfWeekMax = 6;
var listBranchesResponseTwoItemsItemOneOpeningHoursMax = 28;
var listBranchesResponseTwoItemsItemOneTimezoneDefault = `Asia/Kolkata`;
var listBranchesResponseTwoItemsItemTwoLinkedScheduleMaxTokensMax = 1e3;
var listBranchesResponseTwoItemsItemTwoLinkedScheduleConsultationMinutesMax = 240;
var listBranchesResponseTwoItemsItemTwoLinkedScheduleTokenPrefixRegExp = new RegExp("^[A-Za-z0-9]{1,8}$");
var ListBranchesResponse = objectType({
  "total": numberType().int().min(listBranchesResponseOneTotalMin),
  "page": numberType().int(),
  "pageSize": numberType().int(),
  "totalPages": numberType().int().optional()
}).and(objectType({
  "items": arrayType(objectType({
    "slug": stringType().min(listBranchesResponseTwoItemsItemOneSlugMin).max(listBranchesResponseTwoItemsItemOneSlugMax).optional(),
    "email": stringType().email().nullish(),
    "inheritEmail": booleanType().optional(),
    "inheritPhone": booleanType().optional(),
    "openingHours": arrayType(objectType({
      "dayOfWeek": numberType().int().min(listBranchesResponseTwoItemsItemOneOpeningHoursItemDayOfWeekMin).max(listBranchesResponseTwoItemsItemOneOpeningHoursItemDayOfWeekMax),
      "startTime": stringType(),
      "endTime": stringType()
    })).max(listBranchesResponseTwoItemsItemOneOpeningHoursMax).nullish().describe("Null or absent is legacy unrestricted; empty array means closed all days."),
    "clinicId": stringType(),
    "name": stringType().min(1),
    "address": stringType(),
    "city": stringType().optional(),
    "state": stringType().optional(),
    "pincode": stringType().optional(),
    "phone": stringType().nullish(),
    "timezone": stringType().default(listBranchesResponseTwoItemsItemOneTimezoneDefault),
    "status": enumType(["active", "inactive"])
  }).and(objectType({
    "dateFormat": enumType(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": enumType(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "linkedSchedule": objectType({
      "enabled": booleanType(),
      "doctorId": stringType().optional(),
      "maxTokens": numberType().int().min(1).max(listBranchesResponseTwoItemsItemTwoLinkedScheduleMaxTokensMax).optional(),
      "consultationMinutes": numberType().int().min(1).max(listBranchesResponseTwoItemsItemTwoLinkedScheduleConsultationMinutesMax).optional(),
      "tokenPrefix": stringType().regex(listBranchesResponseTwoItemsItemTwoLinkedScheduleTokenPrefixRegExp).optional(),
      "queueMode": enumType(["mixed", "appointmentsOnly", "walkInsOnly"]).optional()
    }).optional(),
    "effectiveEmail": stringType().nullish(),
    "effectivePhone": stringType().nullish(),
    "id": stringType(),
    "code": stringType(),
    "clinicName": stringType().optional(),
    "createdAt": coerce.date().nullable()
  })))
}));
var createBranchBodySlugMin = 3;
var createBranchBodySlugMax = 63;
var createBranchBodyOpeningHoursItemDayOfWeekMin = 0;
var createBranchBodyOpeningHoursItemDayOfWeekMax = 6;
var createBranchBodyOpeningHoursMax = 28;
var createBranchBodyTimezoneDefault = `Asia/Kolkata`;
var CreateBranchBody = objectType({
  "slug": stringType().min(createBranchBodySlugMin).max(createBranchBodySlugMax).optional(),
  "email": stringType().email().nullish(),
  "inheritEmail": booleanType().optional(),
  "inheritPhone": booleanType().optional(),
  "openingHours": arrayType(objectType({
    "dayOfWeek": numberType().int().min(createBranchBodyOpeningHoursItemDayOfWeekMin).max(createBranchBodyOpeningHoursItemDayOfWeekMax),
    "startTime": stringType(),
    "endTime": stringType()
  })).max(createBranchBodyOpeningHoursMax).nullish().describe("Null or absent is legacy unrestricted; empty array means closed all days."),
  "clinicId": stringType(),
  "name": stringType().min(1),
  "address": stringType(),
  "city": stringType().optional(),
  "state": stringType().optional(),
  "pincode": stringType().optional(),
  "phone": stringType().nullish(),
  "timezone": stringType().default(createBranchBodyTimezoneDefault),
  "status": enumType(["active", "inactive"]).optional()
});
var createBranchResponseOneSlugMin = 3;
var createBranchResponseOneSlugMax = 63;
var createBranchResponseOneOpeningHoursItemDayOfWeekMin = 0;
var createBranchResponseOneOpeningHoursItemDayOfWeekMax = 6;
var createBranchResponseOneOpeningHoursMax = 28;
var createBranchResponseOneTimezoneDefault = `Asia/Kolkata`;
var createBranchResponseTwoLinkedScheduleMaxTokensMax = 1e3;
var createBranchResponseTwoLinkedScheduleConsultationMinutesMax = 240;
var createBranchResponseTwoLinkedScheduleTokenPrefixRegExp = new RegExp("^[A-Za-z0-9]{1,8}$");
var CreateBranchResponse = objectType({
  "slug": stringType().min(createBranchResponseOneSlugMin).max(createBranchResponseOneSlugMax).optional(),
  "email": stringType().email().nullish(),
  "inheritEmail": booleanType().optional(),
  "inheritPhone": booleanType().optional(),
  "openingHours": arrayType(objectType({
    "dayOfWeek": numberType().int().min(createBranchResponseOneOpeningHoursItemDayOfWeekMin).max(createBranchResponseOneOpeningHoursItemDayOfWeekMax),
    "startTime": stringType(),
    "endTime": stringType()
  })).max(createBranchResponseOneOpeningHoursMax).nullish().describe("Null or absent is legacy unrestricted; empty array means closed all days."),
  "clinicId": stringType(),
  "name": stringType().min(1),
  "address": stringType(),
  "city": stringType().optional(),
  "state": stringType().optional(),
  "pincode": stringType().optional(),
  "phone": stringType().nullish(),
  "timezone": stringType().default(createBranchResponseOneTimezoneDefault),
  "status": enumType(["active", "inactive"])
}).and(objectType({
  "dateFormat": enumType(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": enumType(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "linkedSchedule": objectType({
    "enabled": booleanType(),
    "doctorId": stringType().optional(),
    "maxTokens": numberType().int().min(1).max(createBranchResponseTwoLinkedScheduleMaxTokensMax).optional(),
    "consultationMinutes": numberType().int().min(1).max(createBranchResponseTwoLinkedScheduleConsultationMinutesMax).optional(),
    "tokenPrefix": stringType().regex(createBranchResponseTwoLinkedScheduleTokenPrefixRegExp).optional(),
    "queueMode": enumType(["mixed", "appointmentsOnly", "walkInsOnly"]).optional()
  }).optional(),
  "effectiveEmail": stringType().nullish(),
  "effectivePhone": stringType().nullish(),
  "id": stringType(),
  "code": stringType(),
  "clinicName": stringType().optional(),
  "createdAt": coerce.date().nullable()
}));
var GetBranchParams = objectType({
  "id": coerce.string()
});
var getBranchResponseOneSlugMin = 3;
var getBranchResponseOneSlugMax = 63;
var getBranchResponseOneOpeningHoursItemDayOfWeekMin = 0;
var getBranchResponseOneOpeningHoursItemDayOfWeekMax = 6;
var getBranchResponseOneOpeningHoursMax = 28;
var getBranchResponseOneTimezoneDefault = `Asia/Kolkata`;
var getBranchResponseTwoLinkedScheduleMaxTokensMax = 1e3;
var getBranchResponseTwoLinkedScheduleConsultationMinutesMax = 240;
var getBranchResponseTwoLinkedScheduleTokenPrefixRegExp = new RegExp("^[A-Za-z0-9]{1,8}$");
var GetBranchResponse = objectType({
  "slug": stringType().min(getBranchResponseOneSlugMin).max(getBranchResponseOneSlugMax).optional(),
  "email": stringType().email().nullish(),
  "inheritEmail": booleanType().optional(),
  "inheritPhone": booleanType().optional(),
  "openingHours": arrayType(objectType({
    "dayOfWeek": numberType().int().min(getBranchResponseOneOpeningHoursItemDayOfWeekMin).max(getBranchResponseOneOpeningHoursItemDayOfWeekMax),
    "startTime": stringType(),
    "endTime": stringType()
  })).max(getBranchResponseOneOpeningHoursMax).nullish().describe("Null or absent is legacy unrestricted; empty array means closed all days."),
  "clinicId": stringType(),
  "name": stringType().min(1),
  "address": stringType(),
  "city": stringType().optional(),
  "state": stringType().optional(),
  "pincode": stringType().optional(),
  "phone": stringType().nullish(),
  "timezone": stringType().default(getBranchResponseOneTimezoneDefault),
  "status": enumType(["active", "inactive"])
}).and(objectType({
  "dateFormat": enumType(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": enumType(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "linkedSchedule": objectType({
    "enabled": booleanType(),
    "doctorId": stringType().optional(),
    "maxTokens": numberType().int().min(1).max(getBranchResponseTwoLinkedScheduleMaxTokensMax).optional(),
    "consultationMinutes": numberType().int().min(1).max(getBranchResponseTwoLinkedScheduleConsultationMinutesMax).optional(),
    "tokenPrefix": stringType().regex(getBranchResponseTwoLinkedScheduleTokenPrefixRegExp).optional(),
    "queueMode": enumType(["mixed", "appointmentsOnly", "walkInsOnly"]).optional()
  }).optional(),
  "effectiveEmail": stringType().nullish(),
  "effectivePhone": stringType().nullish(),
  "id": stringType(),
  "code": stringType(),
  "clinicName": stringType().optional(),
  "createdAt": coerce.date().nullable()
}));
var UpdateBranchParams = objectType({
  "id": coerce.string()
});
var updateBranchBodySlugMin = 3;
var updateBranchBodySlugMax = 63;
var updateBranchBodyOpeningHoursItemDayOfWeekMin = 0;
var updateBranchBodyOpeningHoursItemDayOfWeekMax = 6;
var updateBranchBodyOpeningHoursMax = 28;
var updateBranchBodyTimezoneDefault = `Asia/Kolkata`;
var UpdateBranchBody = objectType({
  "slug": stringType().min(updateBranchBodySlugMin).max(updateBranchBodySlugMax).optional(),
  "email": stringType().email().nullish(),
  "inheritEmail": booleanType().optional(),
  "inheritPhone": booleanType().optional(),
  "openingHours": arrayType(objectType({
    "dayOfWeek": numberType().int().min(updateBranchBodyOpeningHoursItemDayOfWeekMin).max(updateBranchBodyOpeningHoursItemDayOfWeekMax),
    "startTime": stringType(),
    "endTime": stringType()
  })).max(updateBranchBodyOpeningHoursMax).nullish().describe("Null or absent is legacy unrestricted; empty array means closed all days."),
  "clinicId": stringType(),
  "name": stringType().min(1),
  "address": stringType(),
  "city": stringType().optional(),
  "state": stringType().optional(),
  "pincode": stringType().optional(),
  "phone": stringType().nullish(),
  "timezone": stringType().default(updateBranchBodyTimezoneDefault),
  "status": enumType(["active", "inactive"]).optional()
});
var updateBranchResponseOneSlugMin = 3;
var updateBranchResponseOneSlugMax = 63;
var updateBranchResponseOneOpeningHoursItemDayOfWeekMin = 0;
var updateBranchResponseOneOpeningHoursItemDayOfWeekMax = 6;
var updateBranchResponseOneOpeningHoursMax = 28;
var updateBranchResponseOneTimezoneDefault = `Asia/Kolkata`;
var updateBranchResponseTwoLinkedScheduleMaxTokensMax = 1e3;
var updateBranchResponseTwoLinkedScheduleConsultationMinutesMax = 240;
var updateBranchResponseTwoLinkedScheduleTokenPrefixRegExp = new RegExp("^[A-Za-z0-9]{1,8}$");
var UpdateBranchResponse = objectType({
  "slug": stringType().min(updateBranchResponseOneSlugMin).max(updateBranchResponseOneSlugMax).optional(),
  "email": stringType().email().nullish(),
  "inheritEmail": booleanType().optional(),
  "inheritPhone": booleanType().optional(),
  "openingHours": arrayType(objectType({
    "dayOfWeek": numberType().int().min(updateBranchResponseOneOpeningHoursItemDayOfWeekMin).max(updateBranchResponseOneOpeningHoursItemDayOfWeekMax),
    "startTime": stringType(),
    "endTime": stringType()
  })).max(updateBranchResponseOneOpeningHoursMax).nullish().describe("Null or absent is legacy unrestricted; empty array means closed all days."),
  "clinicId": stringType(),
  "name": stringType().min(1),
  "address": stringType(),
  "city": stringType().optional(),
  "state": stringType().optional(),
  "pincode": stringType().optional(),
  "phone": stringType().nullish(),
  "timezone": stringType().default(updateBranchResponseOneTimezoneDefault),
  "status": enumType(["active", "inactive"])
}).and(objectType({
  "dateFormat": enumType(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": enumType(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "linkedSchedule": objectType({
    "enabled": booleanType(),
    "doctorId": stringType().optional(),
    "maxTokens": numberType().int().min(1).max(updateBranchResponseTwoLinkedScheduleMaxTokensMax).optional(),
    "consultationMinutes": numberType().int().min(1).max(updateBranchResponseTwoLinkedScheduleConsultationMinutesMax).optional(),
    "tokenPrefix": stringType().regex(updateBranchResponseTwoLinkedScheduleTokenPrefixRegExp).optional(),
    "queueMode": enumType(["mixed", "appointmentsOnly", "walkInsOnly"]).optional()
  }).optional(),
  "effectiveEmail": stringType().nullish(),
  "effectivePhone": stringType().nullish(),
  "id": stringType(),
  "code": stringType(),
  "clinicName": stringType().optional(),
  "createdAt": coerce.date().nullable()
}));
var DeleteBranchParams = objectType({
  "id": coerce.string()
});
var DeleteBranchResponse = voidType();
var listDoctorsQueryPageDefault = 1;
var listDoctorsQueryPageSizeDefault = 20;
var listDoctorsQueryPageSizeMax = 100;
var ListDoctorsQueryParams = objectType({
  "search": coerce.string().optional(),
  "clinicId": coerce.string().optional(),
  "branchId": coerce.string().optional(),
  "managingAdminId": coerce.string().optional(),
  "status": enumType(["active", "inactive"]).optional(),
  "specializationId": coerce.string().optional(),
  "page": coerce.number().int().min(1).default(listDoctorsQueryPageDefault),
  "pageSize": coerce.number().int().min(1).max(listDoctorsQueryPageSizeMax).default(listDoctorsQueryPageSizeDefault),
  "sort": coerce.string().optional().describe("Allowlisted field with optional minus prefix for descending order")
});
var listDoctorsResponseOneTotalMin = 0;
var listDoctorsResponseTwoItemsItemOneExperienceYearsMin = 0;
var listDoctorsResponseTwoItemsItemOneConsultationFeeMin = 0;
var ListDoctorsResponse = objectType({
  "total": numberType().int().min(listDoctorsResponseOneTotalMin),
  "page": numberType().int(),
  "pageSize": numberType().int(),
  "totalPages": numberType().int().optional()
}).and(objectType({
  "items": arrayType(objectType({
    "ownerAdminId": stringType().describe("Backward-compatible only. If supplied it must match the managing admin derived by the server."),
    "fullName": stringType().min(1),
    "email": stringType().email(),
    "mobile": stringType().optional(),
    "photoUrl": stringType().optional(),
    "gender": stringType().optional(),
    "dateOfBirth": coerce.date().optional(),
    "specializationId": stringType().optional(),
    "qualificationIds": arrayType(stringType()).optional(),
    "registrationNumber": stringType().optional(),
    "experienceYears": numberType().int().min(listDoctorsResponseTwoItemsItemOneExperienceYearsMin).optional(),
    "about": stringType().optional(),
    "consultationFee": numberType().min(listDoctorsResponseTwoItemsItemOneConsultationFeeMin).optional(),
    "languages": arrayType(stringType()).optional(),
    "clinicIds": arrayType(stringType()).min(1).optional().describe("Required by the server for doctor assignment."),
    "branchIds": arrayType(stringType()).optional(),
    "status": enumType(["active", "inactive"])
  }).and(objectType({
    "id": stringType(),
    "userId": stringType(),
    "code": stringType(),
    "managingAdminId": stringType(),
    "managingAdminName": stringType(),
    "invitationStatus": enumType(["sent", "failed", "notRequired"]),
    "createdAt": coerce.date().nullable(),
    "specializationName": stringType().optional(),
    "qualificationNames": arrayType(stringType()).optional()
  })))
}));
var createDoctorBodyExperienceYearsMin = 0;
var createDoctorBodyConsultationFeeMin = 0;
var CreateDoctorBody = objectType({
  "ownerAdminId": stringType().optional().describe("Backward-compatible only. If supplied it must match the managing admin derived by the server."),
  "fullName": stringType().min(1),
  "email": stringType().email(),
  "mobile": stringType().optional(),
  "photoUrl": stringType().optional(),
  "gender": stringType().optional(),
  "dateOfBirth": coerce.date().optional(),
  "specializationId": stringType().optional(),
  "qualificationIds": arrayType(stringType()).optional(),
  "registrationNumber": stringType().optional(),
  "experienceYears": numberType().int().min(createDoctorBodyExperienceYearsMin).optional(),
  "about": stringType().optional(),
  "consultationFee": numberType().min(createDoctorBodyConsultationFeeMin).optional(),
  "languages": arrayType(stringType()).optional(),
  "clinicIds": arrayType(stringType()).min(1).optional().describe("Required by the server for doctor assignment."),
  "branchIds": arrayType(stringType()).optional(),
  "status": enumType(["active", "inactive"]).optional()
});
var createDoctorResponseOneExperienceYearsMin = 0;
var createDoctorResponseOneConsultationFeeMin = 0;
var CreateDoctorResponse = objectType({
  "ownerAdminId": stringType().describe("Backward-compatible only. If supplied it must match the managing admin derived by the server."),
  "fullName": stringType().min(1),
  "email": stringType().email(),
  "mobile": stringType().optional(),
  "photoUrl": stringType().optional(),
  "gender": stringType().optional(),
  "dateOfBirth": coerce.date().optional(),
  "specializationId": stringType().optional(),
  "qualificationIds": arrayType(stringType()).optional(),
  "registrationNumber": stringType().optional(),
  "experienceYears": numberType().int().min(createDoctorResponseOneExperienceYearsMin).optional(),
  "about": stringType().optional(),
  "consultationFee": numberType().min(createDoctorResponseOneConsultationFeeMin).optional(),
  "languages": arrayType(stringType()).optional(),
  "clinicIds": arrayType(stringType()).min(1).optional().describe("Required by the server for doctor assignment."),
  "branchIds": arrayType(stringType()).optional(),
  "status": enumType(["active", "inactive"])
}).and(objectType({
  "id": stringType(),
  "userId": stringType(),
  "code": stringType(),
  "managingAdminId": stringType(),
  "managingAdminName": stringType(),
  "invitationStatus": enumType(["sent", "failed", "notRequired"]),
  "createdAt": coerce.date().nullable(),
  "specializationName": stringType().optional(),
  "qualificationNames": arrayType(stringType()).optional()
}));
var GetDoctorParams = objectType({
  "id": coerce.string()
});
var getDoctorResponseOneExperienceYearsMin = 0;
var getDoctorResponseOneConsultationFeeMin = 0;
var GetDoctorResponse = objectType({
  "ownerAdminId": stringType().describe("Backward-compatible only. If supplied it must match the managing admin derived by the server."),
  "fullName": stringType().min(1),
  "email": stringType().email(),
  "mobile": stringType().optional(),
  "photoUrl": stringType().optional(),
  "gender": stringType().optional(),
  "dateOfBirth": coerce.date().optional(),
  "specializationId": stringType().optional(),
  "qualificationIds": arrayType(stringType()).optional(),
  "registrationNumber": stringType().optional(),
  "experienceYears": numberType().int().min(getDoctorResponseOneExperienceYearsMin).optional(),
  "about": stringType().optional(),
  "consultationFee": numberType().min(getDoctorResponseOneConsultationFeeMin).optional(),
  "languages": arrayType(stringType()).optional(),
  "clinicIds": arrayType(stringType()).min(1).optional().describe("Required by the server for doctor assignment."),
  "branchIds": arrayType(stringType()).optional(),
  "status": enumType(["active", "inactive"])
}).and(objectType({
  "id": stringType(),
  "userId": stringType(),
  "code": stringType(),
  "managingAdminId": stringType(),
  "managingAdminName": stringType(),
  "invitationStatus": enumType(["sent", "failed", "notRequired"]),
  "createdAt": coerce.date().nullable(),
  "specializationName": stringType().optional(),
  "qualificationNames": arrayType(stringType()).optional()
}));
var UpdateDoctorParams = objectType({
  "id": coerce.string()
});
var updateDoctorBodyExperienceYearsMin = 0;
var updateDoctorBodyConsultationFeeMin = 0;
var UpdateDoctorBody = objectType({
  "ownerAdminId": stringType().optional().describe("Backward-compatible only. If supplied it must match the managing admin derived by the server."),
  "fullName": stringType().min(1),
  "email": stringType().email(),
  "mobile": stringType().optional(),
  "photoUrl": stringType().optional(),
  "gender": stringType().optional(),
  "dateOfBirth": coerce.date().optional(),
  "specializationId": stringType().optional(),
  "qualificationIds": arrayType(stringType()).optional(),
  "registrationNumber": stringType().optional(),
  "experienceYears": numberType().int().min(updateDoctorBodyExperienceYearsMin).optional(),
  "about": stringType().optional(),
  "consultationFee": numberType().min(updateDoctorBodyConsultationFeeMin).optional(),
  "languages": arrayType(stringType()).optional(),
  "clinicIds": arrayType(stringType()).min(1).optional().describe("Required by the server for doctor assignment."),
  "branchIds": arrayType(stringType()).optional(),
  "status": enumType(["active", "inactive"]).optional()
});
var updateDoctorResponseOneExperienceYearsMin = 0;
var updateDoctorResponseOneConsultationFeeMin = 0;
var UpdateDoctorResponse = objectType({
  "ownerAdminId": stringType().describe("Backward-compatible only. If supplied it must match the managing admin derived by the server."),
  "fullName": stringType().min(1),
  "email": stringType().email(),
  "mobile": stringType().optional(),
  "photoUrl": stringType().optional(),
  "gender": stringType().optional(),
  "dateOfBirth": coerce.date().optional(),
  "specializationId": stringType().optional(),
  "qualificationIds": arrayType(stringType()).optional(),
  "registrationNumber": stringType().optional(),
  "experienceYears": numberType().int().min(updateDoctorResponseOneExperienceYearsMin).optional(),
  "about": stringType().optional(),
  "consultationFee": numberType().min(updateDoctorResponseOneConsultationFeeMin).optional(),
  "languages": arrayType(stringType()).optional(),
  "clinicIds": arrayType(stringType()).min(1).optional().describe("Required by the server for doctor assignment."),
  "branchIds": arrayType(stringType()).optional(),
  "status": enumType(["active", "inactive"])
}).and(objectType({
  "id": stringType(),
  "userId": stringType(),
  "code": stringType(),
  "managingAdminId": stringType(),
  "managingAdminName": stringType(),
  "invitationStatus": enumType(["sent", "failed", "notRequired"]),
  "createdAt": coerce.date().nullable(),
  "specializationName": stringType().optional(),
  "qualificationNames": arrayType(stringType()).optional()
}));
var DeleteDoctorParams = objectType({
  "id": coerce.string()
});
var DeleteDoctorResponse = voidType();
var listUsersQueryPageDefault = 1;
var listUsersQueryPageSizeDefault = 20;
var listUsersQueryPageSizeMax = 100;
var ListUsersQueryParams = objectType({
  "linkedOnly": coerce.boolean().optional(),
  "search": coerce.string().optional(),
  "role": enumType(["superAdmin", "clinicAdmin", "doctor", "receptionist", "patient"]).optional(),
  "clinicId": coerce.string().optional(),
  "branchId": coerce.string().optional(),
  "managingAdminId": coerce.string().optional(),
  "status": enumType(["active", "inactive"]).optional(),
  "page": coerce.number().int().min(1).default(listUsersQueryPageDefault),
  "pageSize": coerce.number().int().min(1).max(listUsersQueryPageSizeMax).default(listUsersQueryPageSizeDefault),
  "sort": coerce.string().optional().describe("Allowlisted field with optional minus prefix for descending order")
});
var listUsersResponseOneTotalMin = 0;
var ListUsersResponse = objectType({
  "total": numberType().int().min(listUsersResponseOneTotalMin),
  "page": numberType().int(),
  "pageSize": numberType().int(),
  "totalPages": numberType().int().optional()
}).and(objectType({
  "items": arrayType(objectType({
    "fullName": stringType().min(1),
    "email": stringType().email(),
    "mobile": stringType().optional(),
    "role": enumType(["superAdmin", "clinicAdmin", "doctor", "receptionist", "patient"]),
    "status": enumType(["active", "inactive"]),
    "clinicIds": arrayType(stringType()).min(1).describe("Required by the server for clinic-scoped roles."),
    "branchIds": arrayType(stringType()),
    "managingAdminId": stringType().describe("Backward-compatible only. If supplied it must match the managing admin derived by the server.")
  }).and(objectType({
    "id": stringType(),
    "managingAdminId": stringType().nullable(),
    "managingAdminName": stringType().nullable(),
    "invitationStatus": enumType(["sent", "failed", "notRequired"]),
    "passwordEnabled": booleanType().optional().describe("Whether this staff record has a local password configured."),
    "createdAt": coerce.date().nullable(),
    "lastLoginAt": coerce.date().nullish()
  })))
}));
var CreateUserBody = objectType({
  "fullName": stringType().min(1),
  "email": stringType().email(),
  "mobile": stringType().optional(),
  "role": enumType(["superAdmin", "clinicAdmin", "doctor", "receptionist", "patient"]),
  "status": enumType(["active", "inactive"]).optional(),
  "clinicIds": arrayType(stringType()).min(1).optional().describe("Required by the server for clinic-scoped roles."),
  "branchIds": arrayType(stringType()).optional(),
  "managingAdminId": stringType().optional().describe("Backward-compatible only. If supplied it must match the managing admin derived by the server.")
});
var CreateUserResponse = objectType({
  "fullName": stringType().min(1),
  "email": stringType().email(),
  "mobile": stringType().optional(),
  "role": enumType(["superAdmin", "clinicAdmin", "doctor", "receptionist", "patient"]),
  "status": enumType(["active", "inactive"]),
  "clinicIds": arrayType(stringType()).min(1).describe("Required by the server for clinic-scoped roles."),
  "branchIds": arrayType(stringType()),
  "managingAdminId": stringType().describe("Backward-compatible only. If supplied it must match the managing admin derived by the server.")
}).and(objectType({
  "id": stringType(),
  "managingAdminId": stringType().nullable(),
  "managingAdminName": stringType().nullable(),
  "invitationStatus": enumType(["sent", "failed", "notRequired"]),
  "passwordEnabled": booleanType().optional().describe("Whether this staff record has a local password configured."),
  "createdAt": coerce.date().nullable(),
  "lastLoginAt": coerce.date().nullish()
}));
var onboardClinicAdminBodyBranchesItemSlugMin = 3;
var onboardClinicAdminBodyBranchesItemSlugMax = 63;
var onboardClinicAdminBodyBranchesItemOpeningHoursItemDayOfWeekMin = 0;
var onboardClinicAdminBodyBranchesItemOpeningHoursItemDayOfWeekMax = 6;
var onboardClinicAdminBodyBranchesItemOpeningHoursMax = 28;
var onboardClinicAdminBodyBranchesItemLinkedScheduleMaxTokensMax = 1e3;
var onboardClinicAdminBodyBranchesItemLinkedScheduleConsultationMinutesMax = 240;
var onboardClinicAdminBodyBranchesItemLinkedScheduleTokenPrefixRegExp = new RegExp("^[A-Za-z0-9]{1,8}$");
var onboardClinicAdminBodyBranchesMax = 30;
var onboardClinicAdminBodyPoliciesBookingHorizonDaysMax = 365;
var onboardClinicAdminBodyPoliciesCancellationCutoffMinutesMin = 0;
var onboardClinicAdminBodyPoliciesCancellationCutoffMinutesMax = 10080;
var onboardClinicAdminBodyOwnerScheduleMaxTokensMax = 1e3;
var onboardClinicAdminBodyOwnerScheduleConsultationMinutesMax = 240;
var onboardClinicAdminBodyOwnerScheduleTokenPrefixRegExp = new RegExp("^[A-Za-z0-9]{1,8}$");
var onboardClinicAdminBodyClinicSlugMin = 3;
var onboardClinicAdminBodyClinicSlugMax = 63;
var onboardClinicAdminBodyClinicReferralCodeMax = 100;
var onboardClinicAdminBodyClinicTimezoneDefault = `Asia/Kolkata`;
var OnboardClinicAdminBody = objectType({
  "branches": arrayType(objectType({
    "id": stringType().optional(),
    "name": stringType().min(1),
    "address": stringType(),
    "city": stringType().optional(),
    "timezone": stringType().optional(),
    "email": stringType().email().nullish(),
    "phone": stringType().nullish(),
    "inheritEmail": booleanType().optional(),
    "inheritPhone": booleanType().optional(),
    "slug": stringType().min(onboardClinicAdminBodyBranchesItemSlugMin).max(onboardClinicAdminBodyBranchesItemSlugMax).optional(),
    "openingHours": arrayType(objectType({
      "dayOfWeek": numberType().int().min(onboardClinicAdminBodyBranchesItemOpeningHoursItemDayOfWeekMin).max(onboardClinicAdminBodyBranchesItemOpeningHoursItemDayOfWeekMax),
      "startTime": stringType(),
      "endTime": stringType()
    })).max(onboardClinicAdminBodyBranchesItemOpeningHoursMax).nullish().describe("Null or absent preserves legacy unrestricted hours. An explicit empty array closes all days."),
    "linkedSchedule": objectType({
      "enabled": booleanType(),
      "doctorId": stringType().optional(),
      "maxTokens": numberType().int().min(1).max(onboardClinicAdminBodyBranchesItemLinkedScheduleMaxTokensMax).optional(),
      "consultationMinutes": numberType().int().min(1).max(onboardClinicAdminBodyBranchesItemLinkedScheduleConsultationMinutesMax).optional(),
      "tokenPrefix": stringType().regex(onboardClinicAdminBodyBranchesItemLinkedScheduleTokenPrefixRegExp).optional(),
      "queueMode": enumType(["mixed", "appointmentsOnly", "walkInsOnly"]).optional()
    }).optional()
  })).max(onboardClinicAdminBodyBranchesMax).optional(),
  "policies": objectType({
    "bookingHorizonDays": numberType().int().min(1).max(onboardClinicAdminBodyPoliciesBookingHorizonDaysMax).optional(),
    "cancellationCutoffMinutes": numberType().int().min(onboardClinicAdminBodyPoliciesCancellationCutoffMinutesMin).max(onboardClinicAdminBodyPoliciesCancellationCutoffMinutesMax).optional()
  }).optional(),
  "ownDoctor": booleanType().optional(),
  "ownerSchedule": objectType({
    "maxTokens": numberType().int().min(1).max(onboardClinicAdminBodyOwnerScheduleMaxTokensMax),
    "consultationMinutes": numberType().int().min(1).max(onboardClinicAdminBodyOwnerScheduleConsultationMinutesMax),
    "tokenPrefix": stringType().regex(onboardClinicAdminBodyOwnerScheduleTokenPrefixRegExp),
    "queueMode": enumType(["mixed", "appointmentsOnly", "walkInsOnly"])
  }).optional(),
  "specializationId": stringType().optional(),
  "qualificationIds": arrayType(stringType()).optional(),
  "admin": objectType({
    "fullName": stringType().min(1),
    "email": stringType().email(),
    "mobile": stringType().optional()
  }),
  "clinic": objectType({
    "dateFormat": enumType(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": enumType(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "slug": stringType().min(onboardClinicAdminBodyClinicSlugMin).max(onboardClinicAdminBodyClinicSlugMax).optional(),
    "categoryId": stringType().optional(),
    "specialityIds": arrayType(stringType()).optional(),
    "referralCode": stringType().max(onboardClinicAdminBodyClinicReferralCodeMax).nullish(),
    "name": stringType().min(1),
    "code": stringType().optional(),
    "phone": stringType().optional(),
    "email": stringType().email().optional(),
    "address": stringType(),
    "city": stringType().optional(),
    "state": stringType().optional(),
    "pincode": stringType().optional(),
    "timezone": stringType().default(onboardClinicAdminBodyClinicTimezoneDefault)
  })
});
var onboardClinicAdminResponseBranchesItemOneSlugMin = 3;
var onboardClinicAdminResponseBranchesItemOneSlugMax = 63;
var onboardClinicAdminResponseBranchesItemOneOpeningHoursItemDayOfWeekMin = 0;
var onboardClinicAdminResponseBranchesItemOneOpeningHoursItemDayOfWeekMax = 6;
var onboardClinicAdminResponseBranchesItemOneOpeningHoursMax = 28;
var onboardClinicAdminResponseBranchesItemOneTimezoneDefault = `Asia/Kolkata`;
var onboardClinicAdminResponseBranchesItemTwoLinkedScheduleMaxTokensMax = 1e3;
var onboardClinicAdminResponseBranchesItemTwoLinkedScheduleConsultationMinutesMax = 240;
var onboardClinicAdminResponseBranchesItemTwoLinkedScheduleTokenPrefixRegExp = new RegExp("^[A-Za-z0-9]{1,8}$");
var onboardClinicAdminResponseClinicOneSlugMin = 3;
var onboardClinicAdminResponseClinicOneSlugMax = 63;
var onboardClinicAdminResponseClinicOneReferralCodeMax = 100;
var OnboardClinicAdminResponse = objectType({
  "branches": arrayType(objectType({
    "slug": stringType().min(onboardClinicAdminResponseBranchesItemOneSlugMin).max(onboardClinicAdminResponseBranchesItemOneSlugMax).optional(),
    "email": stringType().email().nullish(),
    "inheritEmail": booleanType().optional(),
    "inheritPhone": booleanType().optional(),
    "openingHours": arrayType(objectType({
      "dayOfWeek": numberType().int().min(onboardClinicAdminResponseBranchesItemOneOpeningHoursItemDayOfWeekMin).max(onboardClinicAdminResponseBranchesItemOneOpeningHoursItemDayOfWeekMax),
      "startTime": stringType(),
      "endTime": stringType()
    })).max(onboardClinicAdminResponseBranchesItemOneOpeningHoursMax).nullish().describe("Null or absent is legacy unrestricted; empty array means closed all days."),
    "clinicId": stringType(),
    "name": stringType().min(1),
    "address": stringType(),
    "city": stringType().optional(),
    "state": stringType().optional(),
    "pincode": stringType().optional(),
    "phone": stringType().nullish(),
    "timezone": stringType().default(onboardClinicAdminResponseBranchesItemOneTimezoneDefault),
    "status": enumType(["active", "inactive"])
  }).and(objectType({
    "dateFormat": enumType(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": enumType(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "linkedSchedule": objectType({
      "enabled": booleanType(),
      "doctorId": stringType().optional(),
      "maxTokens": numberType().int().min(1).max(onboardClinicAdminResponseBranchesItemTwoLinkedScheduleMaxTokensMax).optional(),
      "consultationMinutes": numberType().int().min(1).max(onboardClinicAdminResponseBranchesItemTwoLinkedScheduleConsultationMinutesMax).optional(),
      "tokenPrefix": stringType().regex(onboardClinicAdminResponseBranchesItemTwoLinkedScheduleTokenPrefixRegExp).optional(),
      "queueMode": enumType(["mixed", "appointmentsOnly", "walkInsOnly"]).optional()
    }).optional(),
    "effectiveEmail": stringType().nullish(),
    "effectivePhone": stringType().nullish(),
    "id": stringType(),
    "code": stringType(),
    "clinicName": stringType().optional(),
    "createdAt": coerce.date().nullable()
  }))).optional(),
  "doctorId": stringType().nullish(),
  "admin": objectType({
    "fullName": stringType().min(1),
    "email": stringType().email(),
    "mobile": stringType().optional(),
    "role": enumType(["superAdmin", "clinicAdmin", "doctor", "receptionist", "patient"]),
    "status": enumType(["active", "inactive"]),
    "clinicIds": arrayType(stringType()).min(1).describe("Required by the server for clinic-scoped roles."),
    "branchIds": arrayType(stringType()),
    "managingAdminId": stringType().describe("Backward-compatible only. If supplied it must match the managing admin derived by the server.")
  }).and(objectType({
    "id": stringType(),
    "managingAdminId": stringType().nullable(),
    "managingAdminName": stringType().nullable(),
    "invitationStatus": enumType(["sent", "failed", "notRequired"]),
    "passwordEnabled": booleanType().optional().describe("Whether this staff record has a local password configured."),
    "createdAt": coerce.date().nullable(),
    "lastLoginAt": coerce.date().nullish()
  })),
  "clinic": objectType({
    "dateFormat": enumType(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": enumType(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "slug": stringType().min(onboardClinicAdminResponseClinicOneSlugMin).max(onboardClinicAdminResponseClinicOneSlugMax).optional(),
    "specialityIds": arrayType(stringType()).optional(),
    "referralCode": stringType().max(onboardClinicAdminResponseClinicOneReferralCodeMax).nullish(),
    "adminId": stringType().describe("Super admins may select the owning clinic administrator; other roles are assigned by the server."),
    "name": stringType().min(1),
    "address": stringType(),
    "country": stringType().optional(),
    "state": stringType().optional(),
    "city": stringType().optional(),
    "area": stringType().optional(),
    "pincode": stringType().optional(),
    "phone": stringType().nullish(),
    "email": stringType().email().nullish(),
    "description": stringType().optional(),
    "clinicTypeId": stringType().optional(),
    "categoryId": stringType().nullish(),
    "status": enumType(["active", "inactive"])
  }).and(objectType({
    "id": stringType(),
    "code": stringType(),
    "adminName": stringType(),
    "createdAt": coerce.date().nullable(),
    "doctorCount": numberType().int().optional(),
    "branchCount": numberType().int().optional()
  }))
});
var GetUserParams = objectType({
  "id": coerce.string()
});
var GetUserResponse = objectType({
  "fullName": stringType().min(1),
  "email": stringType().email(),
  "mobile": stringType().optional(),
  "role": enumType(["superAdmin", "clinicAdmin", "doctor", "receptionist", "patient"]),
  "status": enumType(["active", "inactive"]),
  "clinicIds": arrayType(stringType()).min(1).describe("Required by the server for clinic-scoped roles."),
  "branchIds": arrayType(stringType()),
  "managingAdminId": stringType().describe("Backward-compatible only. If supplied it must match the managing admin derived by the server.")
}).and(objectType({
  "id": stringType(),
  "managingAdminId": stringType().nullable(),
  "managingAdminName": stringType().nullable(),
  "invitationStatus": enumType(["sent", "failed", "notRequired"]),
  "passwordEnabled": booleanType().optional().describe("Whether this staff record has a local password configured."),
  "createdAt": coerce.date().nullable(),
  "lastLoginAt": coerce.date().nullish()
}));
var UpdateUserParams = objectType({
  "id": coerce.string()
});
var UpdateUserBody = objectType({
  "fullName": stringType().min(1),
  "email": stringType().email(),
  "mobile": stringType().optional(),
  "role": enumType(["superAdmin", "clinicAdmin", "doctor", "receptionist", "patient"]),
  "status": enumType(["active", "inactive"]).optional(),
  "clinicIds": arrayType(stringType()).min(1).optional().describe("Required by the server for clinic-scoped roles."),
  "branchIds": arrayType(stringType()).optional(),
  "managingAdminId": stringType().optional().describe("Backward-compatible only. If supplied it must match the managing admin derived by the server.")
});
var UpdateUserResponse = objectType({
  "fullName": stringType().min(1),
  "email": stringType().email(),
  "mobile": stringType().optional(),
  "role": enumType(["superAdmin", "clinicAdmin", "doctor", "receptionist", "patient"]),
  "status": enumType(["active", "inactive"]),
  "clinicIds": arrayType(stringType()).min(1).describe("Required by the server for clinic-scoped roles."),
  "branchIds": arrayType(stringType()),
  "managingAdminId": stringType().describe("Backward-compatible only. If supplied it must match the managing admin derived by the server.")
}).and(objectType({
  "id": stringType(),
  "managingAdminId": stringType().nullable(),
  "managingAdminName": stringType().nullable(),
  "invitationStatus": enumType(["sent", "failed", "notRequired"]),
  "passwordEnabled": booleanType().optional().describe("Whether this staff record has a local password configured."),
  "createdAt": coerce.date().nullable(),
  "lastLoginAt": coerce.date().nullish()
}));
var DeleteUserParams = objectType({
  "id": coerce.string()
});
var DeleteUserResponse = voidType();
var RequestUserPasswordResetParams = objectType({
  "id": coerce.string()
});
var RequestUserPasswordResetResponse = objectType({
  "message": stringType()
});
var ResendUserInvitationParams = objectType({
  "id": coerce.string()
});
var ResendUserInvitationResponse = objectType({
  "fullName": stringType().min(1),
  "email": stringType().email(),
  "mobile": stringType().optional(),
  "role": enumType(["superAdmin", "clinicAdmin", "doctor", "receptionist", "patient"]),
  "status": enumType(["active", "inactive"]),
  "clinicIds": arrayType(stringType()).min(1).describe("Required by the server for clinic-scoped roles."),
  "branchIds": arrayType(stringType()),
  "managingAdminId": stringType().describe("Backward-compatible only. If supplied it must match the managing admin derived by the server.")
}).and(objectType({
  "id": stringType(),
  "managingAdminId": stringType().nullable(),
  "managingAdminName": stringType().nullable(),
  "invitationStatus": enumType(["sent", "failed", "notRequired"]),
  "passwordEnabled": booleanType().optional().describe("Whether this staff record has a local password configured."),
  "createdAt": coerce.date().nullable(),
  "lastLoginAt": coerce.date().nullish()
}));
var getStaffAssignmentOptionsQuerySortDefault = `name`;
var getStaffAssignmentOptionsQueryPageDefault = 1;
var getStaffAssignmentOptionsQueryPageSizeDefault = 20;
var getStaffAssignmentOptionsQueryPageSizeMax = 100;
var getStaffAssignmentOptionsQuerySelectedIdsMax = 1e4;
var GetStaffAssignmentOptionsQueryParams = objectType({
  "targetRole": enumType(["doctor", "receptionist"]),
  "sort": enumType(["name", "-name", "createdAt", "-createdAt"]).default(getStaffAssignmentOptionsQuerySortDefault).describe("Server ordering within each authorized clinic and branch catalog. ID in the selected direction breaks ties."),
  "doctorId": coerce.string().optional().describe("Existing doctor being edited."),
  "userId": coerce.string().optional().describe("Existing receptionist being edited."),
  "managingAdminId": coerce.string().optional().describe("Narrows the catalog owner; cannot override an actor or edited staff owner."),
  "search": coerce.string().optional(),
  "page": coerce.number().int().min(1).default(getStaffAssignmentOptionsQueryPageDefault),
  "pageSize": coerce.number().int().min(1).max(getStaffAssignmentOptionsQueryPageSizeMax).default(getStaffAssignmentOptionsQueryPageSizeDefault),
  "clinicId": coerce.string().optional(),
  "branchId": coerce.string().optional(),
  "selectedIds": coerce.string().max(getStaffAssignmentOptionsQuerySelectedIdsMax).optional().describe("Comma-separated IDs to resolve within the authorized catalog (maximum 100).")
});
var getStaffAssignmentOptionsResponseClinicsItemOneSlugMin = 3;
var getStaffAssignmentOptionsResponseClinicsItemOneSlugMax = 63;
var getStaffAssignmentOptionsResponseClinicsItemOneReferralCodeMax = 100;
var getStaffAssignmentOptionsResponseBranchesItemOneSlugMin = 3;
var getStaffAssignmentOptionsResponseBranchesItemOneSlugMax = 63;
var getStaffAssignmentOptionsResponseBranchesItemOneOpeningHoursItemDayOfWeekMin = 0;
var getStaffAssignmentOptionsResponseBranchesItemOneOpeningHoursItemDayOfWeekMax = 6;
var getStaffAssignmentOptionsResponseBranchesItemOneOpeningHoursMax = 28;
var getStaffAssignmentOptionsResponseBranchesItemOneTimezoneDefault = `Asia/Kolkata`;
var getStaffAssignmentOptionsResponseBranchesItemTwoLinkedScheduleMaxTokensMax = 1e3;
var getStaffAssignmentOptionsResponseBranchesItemTwoLinkedScheduleConsultationMinutesMax = 240;
var getStaffAssignmentOptionsResponseBranchesItemTwoLinkedScheduleTokenPrefixRegExp = new RegExp("^[A-Za-z0-9]{1,8}$");
var getStaffAssignmentOptionsResponsePaginationClinicsTotalMin = 0;
var getStaffAssignmentOptionsResponsePaginationBranchesTotalMin = 0;
var GetStaffAssignmentOptionsResponse = objectType({
  "clinics": arrayType(objectType({
    "dateFormat": enumType(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": enumType(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "slug": stringType().min(getStaffAssignmentOptionsResponseClinicsItemOneSlugMin).max(getStaffAssignmentOptionsResponseClinicsItemOneSlugMax).optional(),
    "specialityIds": arrayType(stringType()).optional(),
    "referralCode": stringType().max(getStaffAssignmentOptionsResponseClinicsItemOneReferralCodeMax).nullish(),
    "adminId": stringType().describe("Super admins may select the owning clinic administrator; other roles are assigned by the server."),
    "name": stringType().min(1),
    "address": stringType(),
    "country": stringType().optional(),
    "state": stringType().optional(),
    "city": stringType().optional(),
    "area": stringType().optional(),
    "pincode": stringType().optional(),
    "phone": stringType().nullish(),
    "email": stringType().email().nullish(),
    "description": stringType().optional(),
    "clinicTypeId": stringType().optional(),
    "categoryId": stringType().nullish(),
    "status": enumType(["active", "inactive"])
  }).and(objectType({
    "id": stringType(),
    "code": stringType(),
    "adminName": stringType(),
    "createdAt": coerce.date().nullable(),
    "doctorCount": numberType().int().optional(),
    "branchCount": numberType().int().optional()
  }))),
  "branches": arrayType(objectType({
    "slug": stringType().min(getStaffAssignmentOptionsResponseBranchesItemOneSlugMin).max(getStaffAssignmentOptionsResponseBranchesItemOneSlugMax).optional(),
    "email": stringType().email().nullish(),
    "inheritEmail": booleanType().optional(),
    "inheritPhone": booleanType().optional(),
    "openingHours": arrayType(objectType({
      "dayOfWeek": numberType().int().min(getStaffAssignmentOptionsResponseBranchesItemOneOpeningHoursItemDayOfWeekMin).max(getStaffAssignmentOptionsResponseBranchesItemOneOpeningHoursItemDayOfWeekMax),
      "startTime": stringType(),
      "endTime": stringType()
    })).max(getStaffAssignmentOptionsResponseBranchesItemOneOpeningHoursMax).nullish().describe("Null or absent is legacy unrestricted; empty array means closed all days."),
    "clinicId": stringType(),
    "name": stringType().min(1),
    "address": stringType(),
    "city": stringType().optional(),
    "state": stringType().optional(),
    "pincode": stringType().optional(),
    "phone": stringType().nullish(),
    "timezone": stringType().default(getStaffAssignmentOptionsResponseBranchesItemOneTimezoneDefault),
    "status": enumType(["active", "inactive"])
  }).and(objectType({
    "dateFormat": enumType(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": enumType(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "linkedSchedule": objectType({
      "enabled": booleanType(),
      "doctorId": stringType().optional(),
      "maxTokens": numberType().int().min(1).max(getStaffAssignmentOptionsResponseBranchesItemTwoLinkedScheduleMaxTokensMax).optional(),
      "consultationMinutes": numberType().int().min(1).max(getStaffAssignmentOptionsResponseBranchesItemTwoLinkedScheduleConsultationMinutesMax).optional(),
      "tokenPrefix": stringType().regex(getStaffAssignmentOptionsResponseBranchesItemTwoLinkedScheduleTokenPrefixRegExp).optional(),
      "queueMode": enumType(["mixed", "appointmentsOnly", "walkInsOnly"]).optional()
    }).optional(),
    "effectiveEmail": stringType().nullish(),
    "effectivePhone": stringType().nullish(),
    "id": stringType(),
    "code": stringType(),
    "clinicName": stringType().optional(),
    "createdAt": coerce.date().nullable()
  }))),
  "managingAdmins": arrayType(objectType({
    "id": stringType(),
    "fullName": stringType()
  })),
  "pagination": objectType({
    "clinics": objectType({
      "total": numberType().int().min(getStaffAssignmentOptionsResponsePaginationClinicsTotalMin),
      "page": numberType().int(),
      "pageSize": numberType().int(),
      "totalPages": numberType().int().optional()
    }).optional(),
    "branches": objectType({
      "total": numberType().int().min(getStaffAssignmentOptionsResponsePaginationBranchesTotalMin),
      "page": numberType().int(),
      "pageSize": numberType().int(),
      "totalPages": numberType().int().optional()
    }).optional()
  }).optional()
});
var listPatientsQueryPageDefault = 1;
var listPatientsQueryPageSizeDefault = 20;
var listPatientsQueryPageSizeMax = 100;
var ListPatientsQueryParams = objectType({
  "search": coerce.string().optional(),
  "clinicId": coerce.string().optional(),
  "branchId": coerce.string().optional(),
  "status": enumType(["active", "inactive"]).optional(),
  "from": dateType().optional(),
  "to": dateType().optional(),
  "gender": coerce.string().optional(),
  "page": coerce.number().int().min(1).default(listPatientsQueryPageDefault),
  "pageSize": coerce.number().int().min(1).max(listPatientsQueryPageSizeMax).default(listPatientsQueryPageSizeDefault),
  "sort": coerce.string().optional().describe("Allowlisted field with optional minus prefix for descending order")
});
var listPatientsResponseOneTotalMin = 0;
var listPatientsResponseTwoItemsItemOneAgeMin = 0;
var listPatientsResponseTwoItemsItemOneAgeMax = 130;
var ListPatientsResponse = objectType({
  "total": numberType().int().min(listPatientsResponseOneTotalMin),
  "page": numberType().int(),
  "pageSize": numberType().int(),
  "totalPages": numberType().int().optional()
}).and(objectType({
  "items": arrayType(objectType({
    "fullName": stringType().min(1),
    "mobile": stringType().nullish(),
    "email": stringType().email().nullish(),
    "dateOfBirth": coerce.date().optional(),
    "age": numberType().int().min(listPatientsResponseTwoItemsItemOneAgeMin).max(listPatientsResponseTwoItemsItemOneAgeMax).optional(),
    "gender": stringType().optional(),
    "address": stringType().optional(),
    "emergencyContactName": stringType().optional(),
    "emergencyContactPhone": stringType().optional(),
    "clinicId": stringType().optional(),
    "branchId": stringType().optional(),
    "status": enumType(["active", "inactive"]).optional()
  }).and(objectType({
    "id": stringType(),
    "code": stringType(),
    "userId": stringType().nullish(),
    "mobileVerified": booleanType(),
    "createdAt": coerce.date()
  })))
}));
var createPatientBodyAgeMin = 0;
var createPatientBodyAgeMax = 130;
var CreatePatientBody = objectType({
  "fullName": stringType().min(1),
  "mobile": stringType().nullish(),
  "email": stringType().email().nullish(),
  "dateOfBirth": coerce.date().optional(),
  "age": numberType().int().min(createPatientBodyAgeMin).max(createPatientBodyAgeMax).optional(),
  "gender": stringType().optional(),
  "address": stringType().optional(),
  "emergencyContactName": stringType().optional(),
  "emergencyContactPhone": stringType().optional(),
  "clinicId": stringType().optional(),
  "branchId": stringType().optional(),
  "status": enumType(["active", "inactive"]).optional()
});
var createPatientResponseOneAgeMin = 0;
var createPatientResponseOneAgeMax = 130;
var CreatePatientResponse = objectType({
  "fullName": stringType().min(1),
  "mobile": stringType().nullish(),
  "email": stringType().email().nullish(),
  "dateOfBirth": coerce.date().optional(),
  "age": numberType().int().min(createPatientResponseOneAgeMin).max(createPatientResponseOneAgeMax).optional(),
  "gender": stringType().optional(),
  "address": stringType().optional(),
  "emergencyContactName": stringType().optional(),
  "emergencyContactPhone": stringType().optional(),
  "clinicId": stringType().optional(),
  "branchId": stringType().optional(),
  "status": enumType(["active", "inactive"]).optional()
}).and(objectType({
  "id": stringType(),
  "code": stringType(),
  "userId": stringType().nullish(),
  "mobileVerified": booleanType(),
  "createdAt": coerce.date()
}));
var GetPatientParams = objectType({
  "id": coerce.string()
});
var getPatientResponseOneAgeMin = 0;
var getPatientResponseOneAgeMax = 130;
var GetPatientResponse = objectType({
  "fullName": stringType().min(1),
  "mobile": stringType().nullish(),
  "email": stringType().email().nullish(),
  "dateOfBirth": coerce.date().optional(),
  "age": numberType().int().min(getPatientResponseOneAgeMin).max(getPatientResponseOneAgeMax).optional(),
  "gender": stringType().optional(),
  "address": stringType().optional(),
  "emergencyContactName": stringType().optional(),
  "emergencyContactPhone": stringType().optional(),
  "clinicId": stringType().optional(),
  "branchId": stringType().optional(),
  "status": enumType(["active", "inactive"]).optional()
}).and(objectType({
  "id": stringType(),
  "code": stringType(),
  "userId": stringType().nullish(),
  "mobileVerified": booleanType(),
  "createdAt": coerce.date()
}));
var UpdatePatientParams = objectType({
  "id": coerce.string()
});
var updatePatientBodyAgeMin = 0;
var updatePatientBodyAgeMax = 130;
var UpdatePatientBody = objectType({
  "fullName": stringType().min(1),
  "mobile": stringType().nullish(),
  "email": stringType().email().nullish(),
  "dateOfBirth": coerce.date().optional(),
  "age": numberType().int().min(updatePatientBodyAgeMin).max(updatePatientBodyAgeMax).optional(),
  "gender": stringType().optional(),
  "address": stringType().optional(),
  "emergencyContactName": stringType().optional(),
  "emergencyContactPhone": stringType().optional(),
  "clinicId": stringType().optional(),
  "branchId": stringType().optional(),
  "status": enumType(["active", "inactive"]).optional()
});
var updatePatientResponseOneAgeMin = 0;
var updatePatientResponseOneAgeMax = 130;
var UpdatePatientResponse = objectType({
  "fullName": stringType().min(1),
  "mobile": stringType().nullish(),
  "email": stringType().email().nullish(),
  "dateOfBirth": coerce.date().optional(),
  "age": numberType().int().min(updatePatientResponseOneAgeMin).max(updatePatientResponseOneAgeMax).optional(),
  "gender": stringType().optional(),
  "address": stringType().optional(),
  "emergencyContactName": stringType().optional(),
  "emergencyContactPhone": stringType().optional(),
  "clinicId": stringType().optional(),
  "branchId": stringType().optional(),
  "status": enumType(["active", "inactive"]).optional()
}).and(objectType({
  "id": stringType(),
  "code": stringType(),
  "userId": stringType().nullish(),
  "mobileVerified": booleanType(),
  "createdAt": coerce.date()
}));
var DeletePatientParams = objectType({
  "id": coerce.string()
});
var DeletePatientResponse = voidType();
var listMastersQueryPageDefault = 1;
var listMastersQueryPageSizeDefault = 20;
var listMastersQueryPageSizeMax = 100;
var ListMastersQueryParams = objectType({
  "category": coerce.string().optional(),
  "parentId": coerce.string().optional(),
  "search": coerce.string().optional(),
  "status": enumType(["active", "inactive"]).optional(),
  "page": coerce.number().int().min(1).default(listMastersQueryPageDefault),
  "pageSize": coerce.number().int().min(1).max(listMastersQueryPageSizeMax).default(listMastersQueryPageSizeDefault),
  "sort": coerce.string().optional().describe("Allowlisted field with optional minus prefix for descending order")
});
var listMastersResponseOneTotalMin = 0;
var ListMastersResponse = objectType({
  "total": numberType().int().min(listMastersResponseOneTotalMin),
  "page": numberType().int(),
  "pageSize": numberType().int(),
  "totalPages": numberType().int().optional()
}).and(objectType({
  "items": arrayType(objectType({
    "category": enumType(["country", "state", "city", "area", "pincode", "clinicType", "clinicCategory", "clinicStatus", "specialization", "qualification", "department", "consultationType", "appointmentStatus", "appointmentType", "bookingSource", "cancellationReason", "queueStatus", "tokenPrefix", "queueType", "queuePriority", "userRole", "userStatus"]),
    "name": stringType().min(1),
    "code": stringType().min(1),
    "parentId": stringType().nullish(),
    "sortOrder": numberType().int().optional(),
    "status": enumType(["active", "inactive"])
  }).and(objectType({
    "id": stringType()
  })))
}));
var CreateMasterBody = objectType({
  "category": enumType(["country", "state", "city", "area", "pincode", "clinicType", "clinicCategory", "clinicStatus", "specialization", "qualification", "department", "consultationType", "appointmentStatus", "appointmentType", "bookingSource", "cancellationReason", "queueStatus", "tokenPrefix", "queueType", "queuePriority", "userRole", "userStatus"]),
  "name": stringType().min(1),
  "code": stringType().min(1),
  "parentId": stringType().nullish(),
  "sortOrder": numberType().int().optional(),
  "status": enumType(["active", "inactive"]).optional()
});
var CreateMasterResponse = objectType({
  "category": enumType(["country", "state", "city", "area", "pincode", "clinicType", "clinicCategory", "clinicStatus", "specialization", "qualification", "department", "consultationType", "appointmentStatus", "appointmentType", "bookingSource", "cancellationReason", "queueStatus", "tokenPrefix", "queueType", "queuePriority", "userRole", "userStatus"]),
  "name": stringType().min(1),
  "code": stringType().min(1),
  "parentId": stringType().nullish(),
  "sortOrder": numberType().int().optional(),
  "status": enumType(["active", "inactive"])
}).and(objectType({
  "id": stringType()
}));
var GetMasterParams = objectType({
  "id": coerce.string()
});
var GetMasterResponse = objectType({
  "category": enumType(["country", "state", "city", "area", "pincode", "clinicType", "clinicCategory", "clinicStatus", "specialization", "qualification", "department", "consultationType", "appointmentStatus", "appointmentType", "bookingSource", "cancellationReason", "queueStatus", "tokenPrefix", "queueType", "queuePriority", "userRole", "userStatus"]),
  "name": stringType().min(1),
  "code": stringType().min(1),
  "parentId": stringType().nullish(),
  "sortOrder": numberType().int().optional(),
  "status": enumType(["active", "inactive"])
}).and(objectType({
  "id": stringType()
}));
var UpdateMasterParams = objectType({
  "id": coerce.string()
});
var UpdateMasterBody = objectType({
  "category": enumType(["country", "state", "city", "area", "pincode", "clinicType", "clinicCategory", "clinicStatus", "specialization", "qualification", "department", "consultationType", "appointmentStatus", "appointmentType", "bookingSource", "cancellationReason", "queueStatus", "tokenPrefix", "queueType", "queuePriority", "userRole", "userStatus"]),
  "name": stringType().min(1),
  "code": stringType().min(1),
  "parentId": stringType().nullish(),
  "sortOrder": numberType().int().optional(),
  "status": enumType(["active", "inactive"]).optional()
});
var UpdateMasterResponse = objectType({
  "category": enumType(["country", "state", "city", "area", "pincode", "clinicType", "clinicCategory", "clinicStatus", "specialization", "qualification", "department", "consultationType", "appointmentStatus", "appointmentType", "bookingSource", "cancellationReason", "queueStatus", "tokenPrefix", "queueType", "queuePriority", "userRole", "userStatus"]),
  "name": stringType().min(1),
  "code": stringType().min(1),
  "parentId": stringType().nullish(),
  "sortOrder": numberType().int().optional(),
  "status": enumType(["active", "inactive"])
}).and(objectType({
  "id": stringType()
}));
var DeleteMasterParams = objectType({
  "id": coerce.string()
});
var DeleteMasterResponse = voidType();
var listSchedulesQueryDayOfWeekMin = 0;
var listSchedulesQueryDayOfWeekMax = 6;
var listSchedulesQueryWeekdayMin = 0;
var listSchedulesQueryWeekdayMax = 6;
var listSchedulesQueryPageDefault = 1;
var listSchedulesQueryPageSizeDefault = 20;
var listSchedulesQueryPageSizeMax = 100;
var ListSchedulesQueryParams = objectType({
  "search": coerce.string().optional(),
  "sort": coerce.string().optional().describe("Allowlisted field with optional minus prefix for descending order"),
  "dayOfWeek": coerce.number().int().min(listSchedulesQueryDayOfWeekMin).max(listSchedulesQueryDayOfWeekMax).optional(),
  "weekday": coerce.number().int().min(listSchedulesQueryWeekdayMin).max(listSchedulesQueryWeekdayMax).optional().describe("Alias for dayOfWeek"),
  "doctorId": coerce.string().optional(),
  "clinicId": coerce.string().optional(),
  "branchId": coerce.string().optional(),
  "page": coerce.number().int().min(1).default(listSchedulesQueryPageDefault),
  "pageSize": coerce.number().int().min(1).max(listSchedulesQueryPageSizeMax).default(listSchedulesQueryPageSizeDefault)
});
var listSchedulesResponseOneTotalMin = 0;
var listSchedulesResponseTwoItemsItemOneDayOfWeekMin = 0;
var listSchedulesResponseTwoItemsItemOneDayOfWeekMax = 6;
var listSchedulesResponseTwoItemsItemOneStartTimeRegExp = new RegExp("^[0-2][0-9]:[0-5][0-9]$");
var listSchedulesResponseTwoItemsItemOneTimezoneDefault = `Asia/Kolkata`;
var listSchedulesResponseTwoItemsItemOneTokenPrefixMax = 8;
var listSchedulesResponseTwoItemsItemOneBufferMinutesDefault = 0;
var listSchedulesResponseTwoItemsItemOneBufferMinutesMin = 0;
var listSchedulesResponseTwoItemsItemOneQueueModeDefault = `mixed`;
var ListSchedulesResponse = objectType({
  "total": numberType().int().min(listSchedulesResponseOneTotalMin),
  "page": numberType().int(),
  "pageSize": numberType().int(),
  "totalPages": numberType().int().optional()
}).and(objectType({
  "items": arrayType(objectType({
    "doctorId": stringType(),
    "clinicId": stringType(),
    "branchId": stringType(),
    "dayOfWeek": numberType().int().min(listSchedulesResponseTwoItemsItemOneDayOfWeekMin).max(listSchedulesResponseTwoItemsItemOneDayOfWeekMax).describe("Sunday is 0"),
    "isOpen": booleanType(),
    "startTime": stringType().regex(listSchedulesResponseTwoItemsItemOneStartTimeRegExp),
    "endTime": stringType(),
    "breakStart": stringType().nullish(),
    "breakEnd": stringType().nullish(),
    "timezone": stringType().default(listSchedulesResponseTwoItemsItemOneTimezoneDefault),
    "tokenPrefix": stringType().min(1).max(listSchedulesResponseTwoItemsItemOneTokenPrefixMax),
    "maxTokens": numberType().int().min(1),
    "consultationMinutes": numberType().int().min(1),
    "bufferMinutes": numberType().int().min(listSchedulesResponseTwoItemsItemOneBufferMinutesMin).default(listSchedulesResponseTwoItemsItemOneBufferMinutesDefault),
    "queueMode": enumType(["mixed", "appointmentsOnly", "walkInsOnly"]).default(listSchedulesResponseTwoItemsItemOneQueueModeDefault),
    "queueOpenTime": stringType().optional(),
    "queueCloseTime": stringType().optional()
  }).and(objectType({
    "dateFormat": enumType(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": enumType(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "id": stringType(),
    "doctorName": stringType().optional(),
    "clinicName": stringType().optional(),
    "branchName": stringType().optional()
  })))
}));
var createScheduleBodyDayOfWeekMin = 0;
var createScheduleBodyDayOfWeekMax = 6;
var createScheduleBodyStartTimeRegExp = new RegExp("^[0-2][0-9]:[0-5][0-9]$");
var createScheduleBodyTimezoneDefault = `Asia/Kolkata`;
var createScheduleBodyTokenPrefixMax = 8;
var createScheduleBodyBufferMinutesDefault = 0;
var createScheduleBodyBufferMinutesMin = 0;
var createScheduleBodyQueueModeDefault = `mixed`;
var CreateScheduleBody = objectType({
  "doctorId": stringType(),
  "clinicId": stringType(),
  "branchId": stringType(),
  "dayOfWeek": numberType().int().min(createScheduleBodyDayOfWeekMin).max(createScheduleBodyDayOfWeekMax).describe("Sunday is 0"),
  "isOpen": booleanType(),
  "startTime": stringType().regex(createScheduleBodyStartTimeRegExp),
  "endTime": stringType(),
  "breakStart": stringType().nullish(),
  "breakEnd": stringType().nullish(),
  "timezone": stringType().default(createScheduleBodyTimezoneDefault),
  "tokenPrefix": stringType().min(1).max(createScheduleBodyTokenPrefixMax),
  "maxTokens": numberType().int().min(1),
  "consultationMinutes": numberType().int().min(1),
  "bufferMinutes": numberType().int().min(createScheduleBodyBufferMinutesMin).default(createScheduleBodyBufferMinutesDefault),
  "queueMode": enumType(["mixed", "appointmentsOnly", "walkInsOnly"]).default(createScheduleBodyQueueModeDefault),
  "queueOpenTime": stringType().optional(),
  "queueCloseTime": stringType().optional()
});
var createScheduleResponseOneDayOfWeekMin = 0;
var createScheduleResponseOneDayOfWeekMax = 6;
var createScheduleResponseOneStartTimeRegExp = new RegExp("^[0-2][0-9]:[0-5][0-9]$");
var createScheduleResponseOneTimezoneDefault = `Asia/Kolkata`;
var createScheduleResponseOneTokenPrefixMax = 8;
var createScheduleResponseOneBufferMinutesDefault = 0;
var createScheduleResponseOneBufferMinutesMin = 0;
var createScheduleResponseOneQueueModeDefault = `mixed`;
var CreateScheduleResponse = objectType({
  "doctorId": stringType(),
  "clinicId": stringType(),
  "branchId": stringType(),
  "dayOfWeek": numberType().int().min(createScheduleResponseOneDayOfWeekMin).max(createScheduleResponseOneDayOfWeekMax).describe("Sunday is 0"),
  "isOpen": booleanType(),
  "startTime": stringType().regex(createScheduleResponseOneStartTimeRegExp),
  "endTime": stringType(),
  "breakStart": stringType().nullish(),
  "breakEnd": stringType().nullish(),
  "timezone": stringType().default(createScheduleResponseOneTimezoneDefault),
  "tokenPrefix": stringType().min(1).max(createScheduleResponseOneTokenPrefixMax),
  "maxTokens": numberType().int().min(1),
  "consultationMinutes": numberType().int().min(1),
  "bufferMinutes": numberType().int().min(createScheduleResponseOneBufferMinutesMin).default(createScheduleResponseOneBufferMinutesDefault),
  "queueMode": enumType(["mixed", "appointmentsOnly", "walkInsOnly"]).default(createScheduleResponseOneQueueModeDefault),
  "queueOpenTime": stringType().optional(),
  "queueCloseTime": stringType().optional()
}).and(objectType({
  "dateFormat": enumType(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": enumType(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "id": stringType(),
  "doctorName": stringType().optional(),
  "clinicName": stringType().optional(),
  "branchName": stringType().optional()
}));
var UpdateScheduleParams = objectType({
  "id": coerce.string()
});
var updateScheduleBodyDayOfWeekMin = 0;
var updateScheduleBodyDayOfWeekMax = 6;
var updateScheduleBodyStartTimeRegExp = new RegExp("^[0-2][0-9]:[0-5][0-9]$");
var updateScheduleBodyTimezoneDefault = `Asia/Kolkata`;
var updateScheduleBodyTokenPrefixMax = 8;
var updateScheduleBodyBufferMinutesDefault = 0;
var updateScheduleBodyBufferMinutesMin = 0;
var updateScheduleBodyQueueModeDefault = `mixed`;
var UpdateScheduleBody = objectType({
  "doctorId": stringType(),
  "clinicId": stringType(),
  "branchId": stringType(),
  "dayOfWeek": numberType().int().min(updateScheduleBodyDayOfWeekMin).max(updateScheduleBodyDayOfWeekMax).describe("Sunday is 0"),
  "isOpen": booleanType(),
  "startTime": stringType().regex(updateScheduleBodyStartTimeRegExp),
  "endTime": stringType(),
  "breakStart": stringType().nullish(),
  "breakEnd": stringType().nullish(),
  "timezone": stringType().default(updateScheduleBodyTimezoneDefault),
  "tokenPrefix": stringType().min(1).max(updateScheduleBodyTokenPrefixMax),
  "maxTokens": numberType().int().min(1),
  "consultationMinutes": numberType().int().min(1),
  "bufferMinutes": numberType().int().min(updateScheduleBodyBufferMinutesMin).default(updateScheduleBodyBufferMinutesDefault),
  "queueMode": enumType(["mixed", "appointmentsOnly", "walkInsOnly"]).default(updateScheduleBodyQueueModeDefault),
  "queueOpenTime": stringType().optional(),
  "queueCloseTime": stringType().optional()
});
var updateScheduleResponseOneDayOfWeekMin = 0;
var updateScheduleResponseOneDayOfWeekMax = 6;
var updateScheduleResponseOneStartTimeRegExp = new RegExp("^[0-2][0-9]:[0-5][0-9]$");
var updateScheduleResponseOneTimezoneDefault = `Asia/Kolkata`;
var updateScheduleResponseOneTokenPrefixMax = 8;
var updateScheduleResponseOneBufferMinutesDefault = 0;
var updateScheduleResponseOneBufferMinutesMin = 0;
var updateScheduleResponseOneQueueModeDefault = `mixed`;
var UpdateScheduleResponse = objectType({
  "doctorId": stringType(),
  "clinicId": stringType(),
  "branchId": stringType(),
  "dayOfWeek": numberType().int().min(updateScheduleResponseOneDayOfWeekMin).max(updateScheduleResponseOneDayOfWeekMax).describe("Sunday is 0"),
  "isOpen": booleanType(),
  "startTime": stringType().regex(updateScheduleResponseOneStartTimeRegExp),
  "endTime": stringType(),
  "breakStart": stringType().nullish(),
  "breakEnd": stringType().nullish(),
  "timezone": stringType().default(updateScheduleResponseOneTimezoneDefault),
  "tokenPrefix": stringType().min(1).max(updateScheduleResponseOneTokenPrefixMax),
  "maxTokens": numberType().int().min(1),
  "consultationMinutes": numberType().int().min(1),
  "bufferMinutes": numberType().int().min(updateScheduleResponseOneBufferMinutesMin).default(updateScheduleResponseOneBufferMinutesDefault),
  "queueMode": enumType(["mixed", "appointmentsOnly", "walkInsOnly"]).default(updateScheduleResponseOneQueueModeDefault),
  "queueOpenTime": stringType().optional(),
  "queueCloseTime": stringType().optional()
}).and(objectType({
  "dateFormat": enumType(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": enumType(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "id": stringType(),
  "doctorName": stringType().optional(),
  "clinicName": stringType().optional(),
  "branchName": stringType().optional()
}));
var DeleteScheduleParams = objectType({
  "id": coerce.string()
});
var DeleteScheduleResponse = voidType();
var listAvailabilityExceptionsQueryPageDefault = 1;
var listAvailabilityExceptionsQueryPageSizeDefault = 20;
var listAvailabilityExceptionsQueryPageSizeMax = 100;
var ListAvailabilityExceptionsQueryParams = objectType({
  "search": coerce.string().optional(),
  "sort": coerce.string().optional().describe("Allowlisted field with optional minus prefix for descending order"),
  "date": dateType().optional(),
  "doctorId": coerce.string().optional(),
  "branchId": coerce.string().optional(),
  "from": dateType().optional(),
  "to": dateType().optional(),
  "page": coerce.number().int().min(1).default(listAvailabilityExceptionsQueryPageDefault),
  "pageSize": coerce.number().int().min(1).max(listAvailabilityExceptionsQueryPageSizeMax).default(listAvailabilityExceptionsQueryPageSizeDefault)
});
var listAvailabilityExceptionsResponseOneTotalMin = 0;
var ListAvailabilityExceptionsResponse = objectType({
  "total": numberType().int().min(listAvailabilityExceptionsResponseOneTotalMin),
  "page": numberType().int(),
  "pageSize": numberType().int(),
  "totalPages": numberType().int().optional()
}).and(objectType({
  "items": arrayType(objectType({
    "sessionId": stringType().optional(),
    "doctorId": stringType(),
    "branchId": stringType(),
    "date": coerce.date(),
    "isClosed": booleanType(),
    "reason": stringType(),
    "startTime": stringType().nullish(),
    "endTime": stringType().nullish(),
    "breakStart": stringType().nullish(),
    "breakEnd": stringType().nullish(),
    "maxTokens": numberType().int().min(1).nullish()
  }).and(objectType({
    "id": stringType()
  })))
}));
var CreateAvailabilityExceptionBody = objectType({
  "sessionId": stringType().optional(),
  "doctorId": stringType(),
  "branchId": stringType(),
  "date": coerce.date(),
  "isClosed": booleanType(),
  "reason": stringType(),
  "startTime": stringType().nullish(),
  "endTime": stringType().nullish(),
  "breakStart": stringType().nullish(),
  "breakEnd": stringType().nullish(),
  "maxTokens": numberType().int().min(1).nullish()
});
var CreateAvailabilityExceptionResponse = objectType({
  "sessionId": stringType().optional(),
  "doctorId": stringType(),
  "branchId": stringType(),
  "date": coerce.date(),
  "isClosed": booleanType(),
  "reason": stringType(),
  "startTime": stringType().nullish(),
  "endTime": stringType().nullish(),
  "breakStart": stringType().nullish(),
  "breakEnd": stringType().nullish(),
  "maxTokens": numberType().int().min(1).nullish()
}).and(objectType({
  "id": stringType()
}));
var UpdateAvailabilityExceptionParams = objectType({
  "id": coerce.string()
});
var UpdateAvailabilityExceptionBody = objectType({
  "sessionId": stringType().optional(),
  "doctorId": stringType(),
  "branchId": stringType(),
  "date": coerce.date(),
  "isClosed": booleanType(),
  "reason": stringType(),
  "startTime": stringType().nullish(),
  "endTime": stringType().nullish(),
  "breakStart": stringType().nullish(),
  "breakEnd": stringType().nullish(),
  "maxTokens": numberType().int().min(1).nullish()
});
var UpdateAvailabilityExceptionResponse = objectType({
  "sessionId": stringType().optional(),
  "doctorId": stringType(),
  "branchId": stringType(),
  "date": coerce.date(),
  "isClosed": booleanType(),
  "reason": stringType(),
  "startTime": stringType().nullish(),
  "endTime": stringType().nullish(),
  "breakStart": stringType().nullish(),
  "breakEnd": stringType().nullish(),
  "maxTokens": numberType().int().min(1).nullish()
}).and(objectType({
  "id": stringType()
}));
var DeleteAvailabilityExceptionParams = objectType({
  "id": coerce.string()
});
var DeleteAvailabilityExceptionResponse = voidType();
var listAppointmentsQueryPageDefault = 1;
var listAppointmentsQueryPageSizeDefault = 20;
var listAppointmentsQueryPageSizeMax = 100;
var ListAppointmentsQueryParams = objectType({
  "sessionId": coerce.string().optional(),
  "startTime": coerce.string().optional(),
  "statusGroup": enumType(["active", "waiting", "absent", "completed", "cancelled", "all"]).optional().describe("Server-side group filter applied before pagination; intersects with status when both supplied"),
  "search": coerce.string().optional(),
  "clinicId": coerce.string().optional(),
  "branchId": coerce.string().optional(),
  "doctorId": coerce.string().optional(),
  "patientId": coerce.string().optional(),
  "date": dateType().optional(),
  "from": dateType().optional(),
  "to": dateType().optional(),
  "status": enumType(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]).optional(),
  "source": enumType(["online", "walkIn", "phone", "qr"]).optional(),
  "page": coerce.number().int().min(1).default(listAppointmentsQueryPageDefault),
  "pageSize": coerce.number().int().min(1).max(listAppointmentsQueryPageSizeMax).default(listAppointmentsQueryPageSizeDefault),
  "sort": coerce.string().optional().describe("Allowlisted field with optional minus prefix for descending order")
});
var listAppointmentsResponseOneTotalMin = 0;
var listAppointmentsResponseTwoItemsItemOneNotesMax = 1e3;
var ListAppointmentsResponse = objectType({
  "total": numberType().int().min(listAppointmentsResponseOneTotalMin),
  "page": numberType().int(),
  "pageSize": numberType().int(),
  "totalPages": numberType().int().optional()
}).and(objectType({
  "statusCounts": objectType({
    "active": numberType().int().optional(),
    "waiting": numberType().int().optional(),
    "absent": numberType().int().optional(),
    "completed": numberType().int().optional(),
    "cancelled": numberType().int().optional(),
    "all": numberType().int().optional()
  }).optional(),
  "items": arrayType(objectType({
    "sessionId": stringType().optional(),
    "startTime": stringType().optional(),
    "patientId": stringType(),
    "doctorId": stringType(),
    "clinicId": stringType(),
    "branchId": stringType(),
    "date": coerce.date(),
    "source": enumType(["online", "walkIn", "phone", "qr"]),
    "appointmentTypeId": stringType().optional(),
    "consultationTypeId": stringType().optional(),
    "qrReference": stringType().optional(),
    "requestId": stringType().optional().describe("Client-generated idempotency key"),
    "termsAccepted": booleanType().optional(),
    "notes": stringType().max(listAppointmentsResponseTwoItemsItemOneNotesMax).optional()
  }).and(objectType({
    "confirmationEmail": enumType(["provider_accepted", "unavailable", "disabled", "no_recipient", "not_attempted"]).optional().describe("Booking confirmation email attempt outcome. Provider acceptance is not proof of inbox delivery."),
    "dateFormat": enumType(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": enumType(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "id": stringType(),
    "reference": stringType(),
    "token": stringType(),
    "tokenNumber": numberType().int().optional(),
    "queueRank": numberType().optional(),
    "revision": numberType().int().optional(),
    "expectedDurationMinutes": numberType().int().nullish(),
    "status": enumType(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
    "patientName": stringType(),
    "patientCode": stringType().optional(),
    "doctorName": stringType(),
    "clinicName": stringType(),
    "branchName": stringType(),
    "branchAddress": stringType().nullish().describe("Booking branch address snapshot; for legacy bookings the current branch address is resolved."),
    "timezone": stringType().nullish().describe("Time zone for the consulting session range."),
    "startTime": stringType().optional(),
    "endTime": stringType().optional(),
    "createdAt": coerce.date(),
    "checkedInAt": coerce.date().nullish(),
    "calledAt": coerce.date().nullish(),
    "consultationStartedAt": coerce.date().nullish(),
    "completedAt": coerce.date().nullish(),
    "allowedActions": arrayType(enumType(["checkIn", "enqueue", "call", "start", "complete", "noShow", "requeue", "cancel"])),
    "history": arrayType(objectType({
      "status": enumType(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
      "occurredAt": coerce.date(),
      "reason": stringType().optional(),
      "action": stringType().optional(),
      "position": numberType().int().optional(),
      "from": objectType({
        "doctorId": stringType().optional(),
        "branchId": stringType().optional(),
        "date": coerce.date().optional(),
        "token": stringType().optional(),
        "tokenNumber": numberType().int().optional()
      }).optional(),
      "to": objectType({
        "doctorId": stringType().optional(),
        "branchId": stringType().optional(),
        "date": coerce.date().optional(),
        "token": stringType().optional(),
        "tokenNumber": numberType().int().optional()
      }).optional()
    })).optional()
  })))
}));
var createAppointmentBodyNotesMax = 1e3;
var CreateAppointmentBody = objectType({
  "sessionId": stringType().optional(),
  "startTime": stringType().optional(),
  "patientId": stringType(),
  "doctorId": stringType(),
  "clinicId": stringType(),
  "branchId": stringType(),
  "date": coerce.date(),
  "source": enumType(["online", "walkIn", "phone", "qr"]),
  "appointmentTypeId": stringType().optional(),
  "consultationTypeId": stringType().optional(),
  "qrReference": stringType().optional(),
  "requestId": stringType().optional().describe("Client-generated idempotency key"),
  "termsAccepted": booleanType().optional(),
  "notes": stringType().max(createAppointmentBodyNotesMax).optional()
});
var createAppointmentResponseOneNotesMax = 1e3;
var CreateAppointmentResponse = objectType({
  "sessionId": stringType().optional(),
  "startTime": stringType().optional(),
  "patientId": stringType(),
  "doctorId": stringType(),
  "clinicId": stringType(),
  "branchId": stringType(),
  "date": coerce.date(),
  "source": enumType(["online", "walkIn", "phone", "qr"]),
  "appointmentTypeId": stringType().optional(),
  "consultationTypeId": stringType().optional(),
  "qrReference": stringType().optional(),
  "requestId": stringType().optional().describe("Client-generated idempotency key"),
  "termsAccepted": booleanType().optional(),
  "notes": stringType().max(createAppointmentResponseOneNotesMax).optional()
}).and(objectType({
  "confirmationEmail": enumType(["provider_accepted", "unavailable", "disabled", "no_recipient", "not_attempted"]).optional().describe("Booking confirmation email attempt outcome. Provider acceptance is not proof of inbox delivery."),
  "dateFormat": enumType(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": enumType(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "id": stringType(),
  "reference": stringType(),
  "token": stringType(),
  "tokenNumber": numberType().int().optional(),
  "queueRank": numberType().optional(),
  "revision": numberType().int().optional(),
  "expectedDurationMinutes": numberType().int().nullish(),
  "status": enumType(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
  "patientName": stringType(),
  "patientCode": stringType().optional(),
  "doctorName": stringType(),
  "clinicName": stringType(),
  "branchName": stringType(),
  "branchAddress": stringType().nullish().describe("Booking branch address snapshot; for legacy bookings the current branch address is resolved."),
  "timezone": stringType().nullish().describe("Time zone for the consulting session range."),
  "startTime": stringType().optional(),
  "endTime": stringType().optional(),
  "createdAt": coerce.date(),
  "checkedInAt": coerce.date().nullish(),
  "calledAt": coerce.date().nullish(),
  "consultationStartedAt": coerce.date().nullish(),
  "completedAt": coerce.date().nullish(),
  "allowedActions": arrayType(enumType(["checkIn", "enqueue", "call", "start", "complete", "noShow", "requeue", "cancel"])),
  "history": arrayType(objectType({
    "status": enumType(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
    "occurredAt": coerce.date(),
    "reason": stringType().optional(),
    "action": stringType().optional(),
    "position": numberType().int().optional(),
    "from": objectType({
      "doctorId": stringType().optional(),
      "branchId": stringType().optional(),
      "date": coerce.date().optional(),
      "token": stringType().optional(),
      "tokenNumber": numberType().int().optional()
    }).optional(),
    "to": objectType({
      "doctorId": stringType().optional(),
      "branchId": stringType().optional(),
      "date": coerce.date().optional(),
      "token": stringType().optional(),
      "tokenNumber": numberType().int().optional()
    }).optional()
  })).optional()
}));
var GetAppointmentParams = objectType({
  "id": coerce.string()
});
var getAppointmentResponseOneNotesMax = 1e3;
var GetAppointmentResponse = objectType({
  "sessionId": stringType().optional(),
  "startTime": stringType().optional(),
  "patientId": stringType(),
  "doctorId": stringType(),
  "clinicId": stringType(),
  "branchId": stringType(),
  "date": coerce.date(),
  "source": enumType(["online", "walkIn", "phone", "qr"]),
  "appointmentTypeId": stringType().optional(),
  "consultationTypeId": stringType().optional(),
  "qrReference": stringType().optional(),
  "requestId": stringType().optional().describe("Client-generated idempotency key"),
  "termsAccepted": booleanType().optional(),
  "notes": stringType().max(getAppointmentResponseOneNotesMax).optional()
}).and(objectType({
  "confirmationEmail": enumType(["provider_accepted", "unavailable", "disabled", "no_recipient", "not_attempted"]).optional().describe("Booking confirmation email attempt outcome. Provider acceptance is not proof of inbox delivery."),
  "dateFormat": enumType(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": enumType(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "id": stringType(),
  "reference": stringType(),
  "token": stringType(),
  "tokenNumber": numberType().int().optional(),
  "queueRank": numberType().optional(),
  "revision": numberType().int().optional(),
  "expectedDurationMinutes": numberType().int().nullish(),
  "status": enumType(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
  "patientName": stringType(),
  "patientCode": stringType().optional(),
  "doctorName": stringType(),
  "clinicName": stringType(),
  "branchName": stringType(),
  "branchAddress": stringType().nullish().describe("Booking branch address snapshot; for legacy bookings the current branch address is resolved."),
  "timezone": stringType().nullish().describe("Time zone for the consulting session range."),
  "startTime": stringType().optional(),
  "endTime": stringType().optional(),
  "createdAt": coerce.date(),
  "checkedInAt": coerce.date().nullish(),
  "calledAt": coerce.date().nullish(),
  "consultationStartedAt": coerce.date().nullish(),
  "completedAt": coerce.date().nullish(),
  "allowedActions": arrayType(enumType(["checkIn", "enqueue", "call", "start", "complete", "noShow", "requeue", "cancel"])),
  "history": arrayType(objectType({
    "status": enumType(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
    "occurredAt": coerce.date(),
    "reason": stringType().optional(),
    "action": stringType().optional(),
    "position": numberType().int().optional(),
    "from": objectType({
      "doctorId": stringType().optional(),
      "branchId": stringType().optional(),
      "date": coerce.date().optional(),
      "token": stringType().optional(),
      "tokenNumber": numberType().int().optional()
    }).optional(),
    "to": objectType({
      "doctorId": stringType().optional(),
      "branchId": stringType().optional(),
      "date": coerce.date().optional(),
      "token": stringType().optional(),
      "tokenNumber": numberType().int().optional()
    }).optional()
  })).optional()
}));
var GetAppointmentQrParams = objectType({
  "id": coerce.string()
});
var GetAppointmentQrResponse = objectType({
  "appointmentId": stringType(),
  "payload": stringType(),
  "checkInUrl": stringType()
});
var ResolveAppointmentQrBody = objectType({
  "payload": stringType().min(1)
});
var resolveAppointmentQrResponseAppointmentOneNotesMax = 1e3;
var ResolveAppointmentQrResponse = objectType({
  "appointment": objectType({
    "sessionId": stringType().optional(),
    "startTime": stringType().optional(),
    "patientId": stringType(),
    "doctorId": stringType(),
    "clinicId": stringType(),
    "branchId": stringType(),
    "date": coerce.date(),
    "source": enumType(["online", "walkIn", "phone", "qr"]),
    "appointmentTypeId": stringType().optional(),
    "consultationTypeId": stringType().optional(),
    "qrReference": stringType().optional(),
    "requestId": stringType().optional().describe("Client-generated idempotency key"),
    "termsAccepted": booleanType().optional(),
    "notes": stringType().max(resolveAppointmentQrResponseAppointmentOneNotesMax).optional()
  }).and(objectType({
    "confirmationEmail": enumType(["provider_accepted", "unavailable", "disabled", "no_recipient", "not_attempted"]).optional().describe("Booking confirmation email attempt outcome. Provider acceptance is not proof of inbox delivery."),
    "dateFormat": enumType(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": enumType(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "id": stringType(),
    "reference": stringType(),
    "token": stringType(),
    "tokenNumber": numberType().int().optional(),
    "queueRank": numberType().optional(),
    "revision": numberType().int().optional(),
    "expectedDurationMinutes": numberType().int().nullish(),
    "status": enumType(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
    "patientName": stringType(),
    "patientCode": stringType().optional(),
    "doctorName": stringType(),
    "clinicName": stringType(),
    "branchName": stringType(),
    "branchAddress": stringType().nullish().describe("Booking branch address snapshot; for legacy bookings the current branch address is resolved."),
    "timezone": stringType().nullish().describe("Time zone for the consulting session range."),
    "startTime": stringType().optional(),
    "endTime": stringType().optional(),
    "createdAt": coerce.date(),
    "checkedInAt": coerce.date().nullish(),
    "calledAt": coerce.date().nullish(),
    "consultationStartedAt": coerce.date().nullish(),
    "completedAt": coerce.date().nullish(),
    "allowedActions": arrayType(enumType(["checkIn", "enqueue", "call", "start", "complete", "noShow", "requeue", "cancel"])),
    "history": arrayType(objectType({
      "status": enumType(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
      "occurredAt": coerce.date(),
      "reason": stringType().optional(),
      "action": stringType().optional(),
      "position": numberType().int().optional(),
      "from": objectType({
        "doctorId": stringType().optional(),
        "branchId": stringType().optional(),
        "date": coerce.date().optional(),
        "token": stringType().optional(),
        "tokenNumber": numberType().int().optional()
      }).optional(),
      "to": objectType({
        "doctorId": stringType().optional(),
        "branchId": stringType().optional(),
        "date": coerce.date().optional(),
        "token": stringType().optional(),
        "tokenNumber": numberType().int().optional()
      }).optional()
    })).optional()
  })),
  "eligible": booleanType(),
  "alreadyCheckedIn": booleanType(),
  "message": stringType()
});
var CheckInAppointmentQrBody = objectType({
  "payload": stringType().min(1)
});
var checkInAppointmentQrResponseAppointmentOneNotesMax = 1e3;
var CheckInAppointmentQrResponse = objectType({
  "appointment": objectType({
    "sessionId": stringType().optional(),
    "startTime": stringType().optional(),
    "patientId": stringType(),
    "doctorId": stringType(),
    "clinicId": stringType(),
    "branchId": stringType(),
    "date": coerce.date(),
    "source": enumType(["online", "walkIn", "phone", "qr"]),
    "appointmentTypeId": stringType().optional(),
    "consultationTypeId": stringType().optional(),
    "qrReference": stringType().optional(),
    "requestId": stringType().optional().describe("Client-generated idempotency key"),
    "termsAccepted": booleanType().optional(),
    "notes": stringType().max(checkInAppointmentQrResponseAppointmentOneNotesMax).optional()
  }).and(objectType({
    "confirmationEmail": enumType(["provider_accepted", "unavailable", "disabled", "no_recipient", "not_attempted"]).optional().describe("Booking confirmation email attempt outcome. Provider acceptance is not proof of inbox delivery."),
    "dateFormat": enumType(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": enumType(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "id": stringType(),
    "reference": stringType(),
    "token": stringType(),
    "tokenNumber": numberType().int().optional(),
    "queueRank": numberType().optional(),
    "revision": numberType().int().optional(),
    "expectedDurationMinutes": numberType().int().nullish(),
    "status": enumType(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
    "patientName": stringType(),
    "patientCode": stringType().optional(),
    "doctorName": stringType(),
    "clinicName": stringType(),
    "branchName": stringType(),
    "branchAddress": stringType().nullish().describe("Booking branch address snapshot; for legacy bookings the current branch address is resolved."),
    "timezone": stringType().nullish().describe("Time zone for the consulting session range."),
    "startTime": stringType().optional(),
    "endTime": stringType().optional(),
    "createdAt": coerce.date(),
    "checkedInAt": coerce.date().nullish(),
    "calledAt": coerce.date().nullish(),
    "consultationStartedAt": coerce.date().nullish(),
    "completedAt": coerce.date().nullish(),
    "allowedActions": arrayType(enumType(["checkIn", "enqueue", "call", "start", "complete", "noShow", "requeue", "cancel"])),
    "history": arrayType(objectType({
      "status": enumType(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
      "occurredAt": coerce.date(),
      "reason": stringType().optional(),
      "action": stringType().optional(),
      "position": numberType().int().optional(),
      "from": objectType({
        "doctorId": stringType().optional(),
        "branchId": stringType().optional(),
        "date": coerce.date().optional(),
        "token": stringType().optional(),
        "tokenNumber": numberType().int().optional()
      }).optional(),
      "to": objectType({
        "doctorId": stringType().optional(),
        "branchId": stringType().optional(),
        "date": coerce.date().optional(),
        "token": stringType().optional(),
        "tokenNumber": numberType().int().optional()
      }).optional()
    })).optional()
  })),
  "alreadyCheckedIn": booleanType(),
  "message": stringType()
});
var GetDoctorDurationParams = objectType({
  "id": coerce.string(),
  "clinicId": coerce.string()
});
var GetDoctorDurationResponse = objectType({
  "doctorId": stringType(),
  "clinicId": stringType(),
  "expectedDurationMinutes": numberType().int().nullable().describe("Existing legacy durations are retained; new selections must be 20/30/60.")
});
var UpdateDoctorDurationParams = objectType({
  "id": coerce.string(),
  "clinicId": coerce.string()
});
var UpdateDoctorDurationBody = objectType({
  "sessionId": stringType().optional(),
  "startTime": stringType().optional(),
  "clinicId": stringType(),
  "expectedDurationMinutes": unionType([literalType(20), literalType(30), literalType(60)]),
  "effect": enumType(["futureOnly", "runningSession"]).describe("Both choices update sessions that have not started"),
  "branchId": stringType().optional(),
  "date": coerce.date().optional(),
  "confirmRunningSession": booleanType().optional(),
  "expectedQueueVersion": stringType().optional()
});
var UpdateDoctorDurationResponse = objectType({
  "doctorId": stringType(),
  "clinicId": stringType(),
  "expectedDurationMinutes": numberType().int().nullable().describe("Existing legacy durations are retained; new selections must be 20/30/60.")
});
var RescheduleAppointmentParams = objectType({
  "id": coerce.string()
});
var rescheduleAppointmentBodyExpectedRevisionMin = 0;
var RescheduleAppointmentBody = objectType({
  "sessionId": stringType().optional(),
  "startTime": stringType().optional(),
  "doctorId": stringType(),
  "branchId": stringType(),
  "date": coerce.date(),
  "expectedRevision": numberType().int().min(rescheduleAppointmentBodyExpectedRevisionMin),
  "reason": stringType().optional()
});
var rescheduleAppointmentResponseOneNotesMax = 1e3;
var RescheduleAppointmentResponse = objectType({
  "sessionId": stringType().optional(),
  "startTime": stringType().optional(),
  "patientId": stringType(),
  "doctorId": stringType(),
  "clinicId": stringType(),
  "branchId": stringType(),
  "date": coerce.date(),
  "source": enumType(["online", "walkIn", "phone", "qr"]),
  "appointmentTypeId": stringType().optional(),
  "consultationTypeId": stringType().optional(),
  "qrReference": stringType().optional(),
  "requestId": stringType().optional().describe("Client-generated idempotency key"),
  "termsAccepted": booleanType().optional(),
  "notes": stringType().max(rescheduleAppointmentResponseOneNotesMax).optional()
}).and(objectType({
  "confirmationEmail": enumType(["provider_accepted", "unavailable", "disabled", "no_recipient", "not_attempted"]).optional().describe("Booking confirmation email attempt outcome. Provider acceptance is not proof of inbox delivery."),
  "dateFormat": enumType(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": enumType(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "id": stringType(),
  "reference": stringType(),
  "token": stringType(),
  "tokenNumber": numberType().int().optional(),
  "queueRank": numberType().optional(),
  "revision": numberType().int().optional(),
  "expectedDurationMinutes": numberType().int().nullish(),
  "status": enumType(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
  "patientName": stringType(),
  "patientCode": stringType().optional(),
  "doctorName": stringType(),
  "clinicName": stringType(),
  "branchName": stringType(),
  "branchAddress": stringType().nullish().describe("Booking branch address snapshot; for legacy bookings the current branch address is resolved."),
  "timezone": stringType().nullish().describe("Time zone for the consulting session range."),
  "startTime": stringType().optional(),
  "endTime": stringType().optional(),
  "createdAt": coerce.date(),
  "checkedInAt": coerce.date().nullish(),
  "calledAt": coerce.date().nullish(),
  "consultationStartedAt": coerce.date().nullish(),
  "completedAt": coerce.date().nullish(),
  "allowedActions": arrayType(enumType(["checkIn", "enqueue", "call", "start", "complete", "noShow", "requeue", "cancel"])),
  "history": arrayType(objectType({
    "status": enumType(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
    "occurredAt": coerce.date(),
    "reason": stringType().optional(),
    "action": stringType().optional(),
    "position": numberType().int().optional(),
    "from": objectType({
      "doctorId": stringType().optional(),
      "branchId": stringType().optional(),
      "date": coerce.date().optional(),
      "token": stringType().optional(),
      "tokenNumber": numberType().int().optional()
    }).optional(),
    "to": objectType({
      "doctorId": stringType().optional(),
      "branchId": stringType().optional(),
      "date": coerce.date().optional(),
      "token": stringType().optional(),
      "tokenNumber": numberType().int().optional()
    }).optional()
  })).optional()
}));
var TransitionAppointmentParams = objectType({
  "id": coerce.string()
});
var transitionAppointmentBodyExpectedRevisionMin = 0;
var TransitionAppointmentBody = objectType({
  "action": enumType(["checkIn", "enqueue", "call", "start", "complete", "noShow", "requeue", "cancel"]),
  "reason": stringType().optional(),
  "cancellationReasonId": stringType().optional(),
  "expectedStatus": enumType(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]).optional(),
  "expectedRevision": numberType().int().min(transitionAppointmentBodyExpectedRevisionMin).optional(),
  "expectedQueueVersion": stringType().optional(),
  "position": numberType().int().min(1).optional().describe("Required for requeue. One-based position among pending reservations; current consultation is never displaced.")
});
var transitionAppointmentResponseOneNotesMax = 1e3;
var TransitionAppointmentResponse = objectType({
  "sessionId": stringType().optional(),
  "startTime": stringType().optional(),
  "patientId": stringType(),
  "doctorId": stringType(),
  "clinicId": stringType(),
  "branchId": stringType(),
  "date": coerce.date(),
  "source": enumType(["online", "walkIn", "phone", "qr"]),
  "appointmentTypeId": stringType().optional(),
  "consultationTypeId": stringType().optional(),
  "qrReference": stringType().optional(),
  "requestId": stringType().optional().describe("Client-generated idempotency key"),
  "termsAccepted": booleanType().optional(),
  "notes": stringType().max(transitionAppointmentResponseOneNotesMax).optional()
}).and(objectType({
  "confirmationEmail": enumType(["provider_accepted", "unavailable", "disabled", "no_recipient", "not_attempted"]).optional().describe("Booking confirmation email attempt outcome. Provider acceptance is not proof of inbox delivery."),
  "dateFormat": enumType(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": enumType(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "id": stringType(),
  "reference": stringType(),
  "token": stringType(),
  "tokenNumber": numberType().int().optional(),
  "queueRank": numberType().optional(),
  "revision": numberType().int().optional(),
  "expectedDurationMinutes": numberType().int().nullish(),
  "status": enumType(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
  "patientName": stringType(),
  "patientCode": stringType().optional(),
  "doctorName": stringType(),
  "clinicName": stringType(),
  "branchName": stringType(),
  "branchAddress": stringType().nullish().describe("Booking branch address snapshot; for legacy bookings the current branch address is resolved."),
  "timezone": stringType().nullish().describe("Time zone for the consulting session range."),
  "startTime": stringType().optional(),
  "endTime": stringType().optional(),
  "createdAt": coerce.date(),
  "checkedInAt": coerce.date().nullish(),
  "calledAt": coerce.date().nullish(),
  "consultationStartedAt": coerce.date().nullish(),
  "completedAt": coerce.date().nullish(),
  "allowedActions": arrayType(enumType(["checkIn", "enqueue", "call", "start", "complete", "noShow", "requeue", "cancel"])),
  "history": arrayType(objectType({
    "status": enumType(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
    "occurredAt": coerce.date(),
    "reason": stringType().optional(),
    "action": stringType().optional(),
    "position": numberType().int().optional(),
    "from": objectType({
      "doctorId": stringType().optional(),
      "branchId": stringType().optional(),
      "date": coerce.date().optional(),
      "token": stringType().optional(),
      "tokenNumber": numberType().int().optional()
    }).optional(),
    "to": objectType({
      "doctorId": stringType().optional(),
      "branchId": stringType().optional(),
      "date": coerce.date().optional(),
      "token": stringType().optional(),
      "tokenNumber": numberType().int().optional()
    }).optional()
  })).optional()
}));
var getQueueQueryPageSizeMax = 100;
var getQueueQuerySearchMax = 200;
var GetQueueQueryParams = objectType({
  "sessionId": coerce.string().optional(),
  "startTime": coerce.string().optional(),
  "doctorId": coerce.string(),
  "branchId": coerce.string(),
  "date": dateType(),
  "appointmentId": coerce.string().optional(),
  "page": coerce.number().int().min(1).optional().describe("Explicit staff listing page; omit both pagination parameters for legacy full-list compatibility"),
  "pageSize": coerce.number().int().min(1).max(getQueueQueryPageSizeMax).optional().describe("Explicit staff listing page size; omitted pagination parameters must not be default-injected by clients"),
  "search": coerce.string().max(getQueueQuerySearchMax).optional().describe("Staff-only listing search applied before pagination"),
  "sort": coerce.string().optional().describe("Staff-only allowlisted listing sort with optional minus prefix"),
  "status": enumType(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]).optional(),
  "statusGroup": enumType(["active", "waiting", "absent", "completed", "cancelled", "all"]).optional().describe("Server-side group filter applied before pagination; intersects with status when both supplied")
});
var getQueueResponseEntriesItemOneNotesMax = 1e3;
var GetQueueResponse = objectType({
  "filteredTotal": numberType().optional().describe("Staff-only count after listing filters; omitted for patients."),
  "dateFormat": enumType(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": enumType(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "sessionId": stringType().nullish(),
  "startTime": stringType().nullish(),
  "presence": objectType({
    "branchId": stringType(),
    "date": coerce.date(),
    "sessionId": stringType().optional(),
    "startTime": stringType().optional(),
    "status": enumType(["available", "onBreak", "away"])
  }).and(objectType({
    "doctorId": stringType(),
    "updatedAt": coerce.date().nullable()
  })).optional(),
  "page": numberType().int().optional(),
  "pageSize": numberType().int().optional(),
  "totalPages": numberType().int().optional(),
  "entriesTotal": numberType().int().optional(),
  "doctorId": stringType(),
  "branchId": stringType(),
  "date": coerce.date(),
  "currentToken": stringType().nullable(),
  "nextToken": stringType().nullable(),
  "waiting": numberType().int(),
  "reserved": numberType().int().optional().describe("All pending booked"),
  "arrived": numberType().int().optional().describe("Checked-in"),
  "queueVersion": stringType().optional(),
  "expectedDurationMinutes": numberType().int().nullish(),
  "blockedByAbsentReservation": booleanType().optional(),
  "inConsultation": numberType().int(),
  "completed": numberType().int(),
  "noShow": numberType().int(),
  "total": numberType().int(),
  "ownEntry": unionType([objectType({
    "dateFormat": enumType(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": enumType(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "appointmentId": stringType(),
    "token": stringType(),
    "status": enumType(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
    "patientsAhead": numberType().int(),
    "estimatedWaitMinutes": numberType().int().nullable()
  }), nullType()]).optional(),
  "entries": arrayType(objectType({
    "sessionId": stringType().optional(),
    "startTime": stringType().optional(),
    "patientId": stringType(),
    "doctorId": stringType(),
    "clinicId": stringType(),
    "branchId": stringType(),
    "date": coerce.date(),
    "source": enumType(["online", "walkIn", "phone", "qr"]),
    "appointmentTypeId": stringType().optional(),
    "consultationTypeId": stringType().optional(),
    "qrReference": stringType().optional(),
    "requestId": stringType().optional().describe("Client-generated idempotency key"),
    "termsAccepted": booleanType().optional(),
    "notes": stringType().max(getQueueResponseEntriesItemOneNotesMax).optional()
  }).and(objectType({
    "confirmationEmail": enumType(["provider_accepted", "unavailable", "disabled", "no_recipient", "not_attempted"]).optional().describe("Booking confirmation email attempt outcome. Provider acceptance is not proof of inbox delivery."),
    "dateFormat": enumType(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": enumType(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "id": stringType(),
    "reference": stringType(),
    "token": stringType(),
    "tokenNumber": numberType().int().optional(),
    "queueRank": numberType().optional(),
    "revision": numberType().int().optional(),
    "expectedDurationMinutes": numberType().int().nullish(),
    "status": enumType(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
    "patientName": stringType(),
    "patientCode": stringType().optional(),
    "doctorName": stringType(),
    "clinicName": stringType(),
    "branchName": stringType(),
    "branchAddress": stringType().nullish().describe("Booking branch address snapshot; for legacy bookings the current branch address is resolved."),
    "timezone": stringType().nullish().describe("Time zone for the consulting session range."),
    "startTime": stringType().optional(),
    "endTime": stringType().optional(),
    "createdAt": coerce.date(),
    "checkedInAt": coerce.date().nullish(),
    "calledAt": coerce.date().nullish(),
    "consultationStartedAt": coerce.date().nullish(),
    "completedAt": coerce.date().nullish(),
    "allowedActions": arrayType(enumType(["checkIn", "enqueue", "call", "start", "complete", "noShow", "requeue", "cancel"])),
    "history": arrayType(objectType({
      "status": enumType(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
      "occurredAt": coerce.date(),
      "reason": stringType().optional(),
      "action": stringType().optional(),
      "position": numberType().int().optional(),
      "from": objectType({
        "doctorId": stringType().optional(),
        "branchId": stringType().optional(),
        "date": coerce.date().optional(),
        "token": stringType().optional(),
        "tokenNumber": numberType().int().optional()
      }).optional(),
      "to": objectType({
        "doctorId": stringType().optional(),
        "branchId": stringType().optional(),
        "date": coerce.date().optional(),
        "token": stringType().optional(),
        "tokenNumber": numberType().int().optional()
      }).optional()
    })).optional()
  }))).optional().describe("Omitted for patients"),
  "statusCounts": objectType({
    "active": numberType().int().optional(),
    "waiting": numberType().int().optional(),
    "absent": numberType().int().optional(),
    "completed": numberType().int().optional(),
    "cancelled": numberType().int().optional(),
    "all": numberType().int().optional()
  }).optional(),
  "pollIntervalSeconds": literalType(30),
  "updatedAt": coerce.date()
});
var CallNextBody = objectType({
  "sessionId": stringType().optional(),
  "startTime": stringType().optional(),
  "doctorId": stringType(),
  "branchId": stringType(),
  "date": coerce.date()
});
var callNextResponseAppointmentOneOneNotesMax = 1e3;
var CallNextResponse = objectType({
  "appointment": unionType([objectType({
    "sessionId": stringType().optional(),
    "startTime": stringType().optional(),
    "patientId": stringType(),
    "doctorId": stringType(),
    "clinicId": stringType(),
    "branchId": stringType(),
    "date": coerce.date(),
    "source": enumType(["online", "walkIn", "phone", "qr"]),
    "appointmentTypeId": stringType().optional(),
    "consultationTypeId": stringType().optional(),
    "qrReference": stringType().optional(),
    "requestId": stringType().optional().describe("Client-generated idempotency key"),
    "termsAccepted": booleanType().optional(),
    "notes": stringType().max(callNextResponseAppointmentOneOneNotesMax).optional()
  }).and(objectType({
    "confirmationEmail": enumType(["provider_accepted", "unavailable", "disabled", "no_recipient", "not_attempted"]).optional().describe("Booking confirmation email attempt outcome. Provider acceptance is not proof of inbox delivery."),
    "dateFormat": enumType(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": enumType(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "id": stringType(),
    "reference": stringType(),
    "token": stringType(),
    "tokenNumber": numberType().int().optional(),
    "queueRank": numberType().optional(),
    "revision": numberType().int().optional(),
    "expectedDurationMinutes": numberType().int().nullish(),
    "status": enumType(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
    "patientName": stringType(),
    "patientCode": stringType().optional(),
    "doctorName": stringType(),
    "clinicName": stringType(),
    "branchName": stringType(),
    "branchAddress": stringType().nullish().describe("Booking branch address snapshot; for legacy bookings the current branch address is resolved."),
    "timezone": stringType().nullish().describe("Time zone for the consulting session range."),
    "startTime": stringType().optional(),
    "endTime": stringType().optional(),
    "createdAt": coerce.date(),
    "checkedInAt": coerce.date().nullish(),
    "calledAt": coerce.date().nullish(),
    "consultationStartedAt": coerce.date().nullish(),
    "completedAt": coerce.date().nullish(),
    "allowedActions": arrayType(enumType(["checkIn", "enqueue", "call", "start", "complete", "noShow", "requeue", "cancel"])),
    "history": arrayType(objectType({
      "status": enumType(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
      "occurredAt": coerce.date(),
      "reason": stringType().optional(),
      "action": stringType().optional(),
      "position": numberType().int().optional(),
      "from": objectType({
        "doctorId": stringType().optional(),
        "branchId": stringType().optional(),
        "date": coerce.date().optional(),
        "token": stringType().optional(),
        "tokenNumber": numberType().int().optional()
      }).optional(),
      "to": objectType({
        "doctorId": stringType().optional(),
        "branchId": stringType().optional(),
        "date": coerce.date().optional(),
        "token": stringType().optional(),
        "tokenNumber": numberType().int().optional()
      }).optional()
    })).optional()
  })), nullType()])
});
var listQrsQueryPageDefault = 1;
var listQrsQueryPageSizeDefault = 20;
var listQrsQueryPageSizeMax = 100;
var ListQrsQueryParams = objectType({
  "search": coerce.string().optional(),
  "sort": coerce.string().optional().describe("Allowlisted field with optional minus prefix for descending order"),
  "clinicId": coerce.string().optional(),
  "branchId": coerce.string().optional(),
  "doctorId": coerce.string().optional(),
  "status": enumType(["active", "inactive"]).optional(),
  "page": coerce.number().int().min(1).default(listQrsQueryPageDefault),
  "pageSize": coerce.number().int().min(1).max(listQrsQueryPageSizeMax).default(listQrsQueryPageSizeDefault)
});
var listQrsResponseOneTotalMin = 0;
var ListQrsResponse = objectType({
  "total": numberType().int().min(listQrsResponseOneTotalMin),
  "page": numberType().int(),
  "pageSize": numberType().int(),
  "totalPages": numberType().int().optional()
}).and(objectType({
  "items": arrayType(objectType({
    "name": stringType(),
    "clinicId": stringType(),
    "branchId": stringType().nullish(),
    "doctorId": stringType().nullish(),
    "status": enumType(["active", "inactive"])
  }).and(objectType({
    "id": stringType(),
    "reference": stringType(),
    "bookingUrl": stringType(),
    "createdAt": coerce.date()
  })))
}));
var CreateQrBody = objectType({
  "name": stringType(),
  "clinicId": stringType(),
  "branchId": stringType().nullish(),
  "doctorId": stringType().nullish(),
  "status": enumType(["active", "inactive"]).optional()
});
var CreateQrResponse = objectType({
  "name": stringType(),
  "clinicId": stringType(),
  "branchId": stringType().nullish(),
  "doctorId": stringType().nullish(),
  "status": enumType(["active", "inactive"])
}).and(objectType({
  "id": stringType(),
  "reference": stringType(),
  "bookingUrl": stringType(),
  "createdAt": coerce.date()
}));
var GetQrParams = objectType({
  "id": coerce.string()
});
var GetQrResponse = objectType({
  "name": stringType(),
  "clinicId": stringType(),
  "branchId": stringType().nullish(),
  "doctorId": stringType().nullish(),
  "status": enumType(["active", "inactive"])
}).and(objectType({
  "id": stringType(),
  "reference": stringType(),
  "bookingUrl": stringType(),
  "createdAt": coerce.date()
}));
var UpdateQrParams = objectType({
  "id": coerce.string()
});
var UpdateQrBody = objectType({
  "name": stringType(),
  "clinicId": stringType(),
  "branchId": stringType().nullish(),
  "doctorId": stringType().nullish(),
  "status": enumType(["active", "inactive"]).optional()
});
var UpdateQrResponse = objectType({
  "name": stringType(),
  "clinicId": stringType(),
  "branchId": stringType().nullish(),
  "doctorId": stringType().nullish(),
  "status": enumType(["active", "inactive"])
}).and(objectType({
  "id": stringType(),
  "reference": stringType(),
  "bookingUrl": stringType(),
  "createdAt": coerce.date()
}));
var DeleteQrParams = objectType({
  "id": coerce.string()
});
var DeleteQrResponse = voidType();
var RegenerateQrParams = objectType({
  "id": coerce.string()
});
var RegenerateQrResponse = objectType({
  "name": stringType(),
  "clinicId": stringType(),
  "branchId": stringType().nullish(),
  "doctorId": stringType().nullish(),
  "status": enumType(["active", "inactive"])
}).and(objectType({
  "id": stringType(),
  "reference": stringType(),
  "bookingUrl": stringType(),
  "createdAt": coerce.date()
}));
var GetDashboardQueryParams = objectType({
  "date": dateType().optional(),
  "clinicId": coerce.string().optional(),
  "branchId": coerce.string().optional(),
  "doctorId": coerce.string().optional()
});
var getDashboardResponseRecentAppointmentsItemOneNotesMax = 1e3;
var GetDashboardResponse = objectType({
  "totalDoctors": numberType().int().optional(),
  "totalClinics": numberType().int().optional(),
  "totalBranches": numberType().int().optional(),
  "totalPatients": numberType().int().optional(),
  "todayAppointments": numberType().int(),
  "activeQueues": numberType().int().optional(),
  "waiting": numberType().int(),
  "checkedIn": numberType().int(),
  "completed": numberType().int(),
  "cancelled": numberType().int(),
  "noShow": numberType().int(),
  "averageWaitMinutes": numberType(),
  "currentToken": stringType().nullish(),
  "recentAppointments": arrayType(objectType({
    "sessionId": stringType().optional(),
    "startTime": stringType().optional(),
    "patientId": stringType(),
    "doctorId": stringType(),
    "clinicId": stringType(),
    "branchId": stringType(),
    "date": coerce.date(),
    "source": enumType(["online", "walkIn", "phone", "qr"]),
    "appointmentTypeId": stringType().optional(),
    "consultationTypeId": stringType().optional(),
    "qrReference": stringType().optional(),
    "requestId": stringType().optional().describe("Client-generated idempotency key"),
    "termsAccepted": booleanType().optional(),
    "notes": stringType().max(getDashboardResponseRecentAppointmentsItemOneNotesMax).optional()
  }).and(objectType({
    "confirmationEmail": enumType(["provider_accepted", "unavailable", "disabled", "no_recipient", "not_attempted"]).optional().describe("Booking confirmation email attempt outcome. Provider acceptance is not proof of inbox delivery."),
    "dateFormat": enumType(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": enumType(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "id": stringType(),
    "reference": stringType(),
    "token": stringType(),
    "tokenNumber": numberType().int().optional(),
    "queueRank": numberType().optional(),
    "revision": numberType().int().optional(),
    "expectedDurationMinutes": numberType().int().nullish(),
    "status": enumType(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
    "patientName": stringType(),
    "patientCode": stringType().optional(),
    "doctorName": stringType(),
    "clinicName": stringType(),
    "branchName": stringType(),
    "branchAddress": stringType().nullish().describe("Booking branch address snapshot; for legacy bookings the current branch address is resolved."),
    "timezone": stringType().nullish().describe("Time zone for the consulting session range."),
    "startTime": stringType().optional(),
    "endTime": stringType().optional(),
    "createdAt": coerce.date(),
    "checkedInAt": coerce.date().nullish(),
    "calledAt": coerce.date().nullish(),
    "consultationStartedAt": coerce.date().nullish(),
    "completedAt": coerce.date().nullish(),
    "allowedActions": arrayType(enumType(["checkIn", "enqueue", "call", "start", "complete", "noShow", "requeue", "cancel"])),
    "history": arrayType(objectType({
      "status": enumType(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
      "occurredAt": coerce.date(),
      "reason": stringType().optional(),
      "action": stringType().optional(),
      "position": numberType().int().optional(),
      "from": objectType({
        "doctorId": stringType().optional(),
        "branchId": stringType().optional(),
        "date": coerce.date().optional(),
        "token": stringType().optional(),
        "tokenNumber": numberType().int().optional()
      }).optional(),
      "to": objectType({
        "doctorId": stringType().optional(),
        "branchId": stringType().optional(),
        "date": coerce.date().optional(),
        "token": stringType().optional(),
        "tokenNumber": numberType().int().optional()
      }).optional()
    })).optional()
  }))).optional(),
  "recentActivity": arrayType(objectType({
    "id": stringType(),
    "actorId": stringType(),
    "actorName": stringType().optional(),
    "actorRole": enumType(["superAdmin", "clinicAdmin", "doctor", "receptionist", "patient"]).optional(),
    "action": stringType(),
    "entityType": stringType(),
    "entityId": stringType(),
    "clinicId": stringType().nullish(),
    "summary": stringType(),
    "createdAt": coerce.date()
  })).optional()
});
var getReportsQuerySearchMax = 200;
var getReportsQueryPageDefault = 1;
var getReportsQueryPageSizeDefault = 20;
var getReportsQueryPageSizeMax = 100;
var getReportsQueryGroupByDefault = `date`;
var GetReportsQueryParams = objectType({
  "search": coerce.string().max(getReportsQuerySearchMax).optional().describe("Trimmed report search text"),
  "sort": enumType(["key", "-key", "label", "-label", "appointments", "-appointments", "outcomes", "-outcomes", "other", "-other", "registrations", "-registrations", "waiting", "-waiting", "checkedIn", "-checkedIn", "completed", "-completed", "noShow", "-noShow", "cancelled", "-cancelled", "averageWaitMinutes", "-averageWaitMinutes", "averageConsultationMinutes", "-averageConsultationMinutes"]).optional().describe("Outcomes orders by cancelled then no-show then residual Other counts. Other equals visits minus completed minus cancelled minus no-show. Group key ascending breaks ties."),
  "sessionId": coerce.string().optional(),
  "startTime": coerce.string().optional(),
  "page": coerce.number().int().min(1).default(getReportsQueryPageDefault),
  "pageSize": coerce.number().int().min(1).max(getReportsQueryPageSizeMax).default(getReportsQueryPageSizeDefault),
  "from": dateType().optional(),
  "to": dateType().optional(),
  "clinicId": coerce.string().optional(),
  "branchId": coerce.string().optional(),
  "doctorId": coerce.string().optional(),
  "groupBy": enumType(["clinic", "doctor", "date"]).default(getReportsQueryGroupByDefault)
});
var GetReportsResponse = objectType({
  "page": numberType().int().optional(),
  "pageSize": numberType().int().optional(),
  "totalPages": numberType().int().optional(),
  "total": numberType().int().optional(),
  "from": coerce.date(),
  "to": coerce.date(),
  "groupBy": stringType(),
  "rows": arrayType(objectType({
    "key": stringType(),
    "label": stringType(),
    "appointments": numberType().int(),
    "checkedIn": numberType().int().optional(),
    "waiting": numberType().int().optional(),
    "completed": numberType().int(),
    "cancelled": numberType().int(),
    "noShow": numberType().int(),
    "registrations": numberType().int(),
    "averageWaitMinutes": numberType(),
    "averageConsultationMinutes": numberType().nullish()
  }))
});
var listAuditLogsQueryActivityTypeDefault = `all`;
var listAuditLogsQueryPageDefault = 1;
var listAuditLogsQueryPageSizeDefault = 20;
var listAuditLogsQueryPageSizeMax = 100;
var ListAuditLogsQueryParams = objectType({
  "search": coerce.string().optional(),
  "sort": coerce.string().optional().describe("Allowlisted field with optional minus prefix for descending order"),
  "activityType": enumType(["all", "operational", "security"]).default(listAuditLogsQueryActivityTypeDefault),
  "entityType": coerce.string().optional(),
  "actorId": coerce.string().optional(),
  "clinicId": coerce.string().optional(),
  "from": dateType().optional(),
  "to": dateType().optional(),
  "page": coerce.number().int().min(1).default(listAuditLogsQueryPageDefault),
  "pageSize": coerce.number().int().min(1).max(listAuditLogsQueryPageSizeMax).default(listAuditLogsQueryPageSizeDefault)
});
var listAuditLogsResponseOneTotalMin = 0;
var ListAuditLogsResponse = objectType({
  "total": numberType().int().min(listAuditLogsResponseOneTotalMin),
  "page": numberType().int(),
  "pageSize": numberType().int(),
  "totalPages": numberType().int().optional()
}).and(objectType({
  "items": arrayType(objectType({
    "id": stringType(),
    "actorId": stringType(),
    "actorName": stringType().optional(),
    "actorRole": enumType(["superAdmin", "clinicAdmin", "doctor", "receptionist", "patient"]).optional(),
    "action": stringType(),
    "entityType": stringType(),
    "entityId": stringType(),
    "clinicId": stringType().nullish(),
    "summary": stringType(),
    "createdAt": coerce.date()
  }))
}));
var getSettingsResponseOneCancellationCutoffMinutesMin = 0;
var getSettingsResponseOneOtpExpirySecondsMin = 60;
var getSettingsResponseOneOtpExpirySecondsMax = 900;
var getSettingsResponseOneOtpMaxAttemptsMax = 10;
var getSettingsResponseOneSessionTimeoutMinutesMin = 5;
var GetSettingsResponse = objectType({
  "platformName": stringType(),
  "supportEmail": stringType().email().optional(),
  "supportPhone": stringType().optional(),
  "timezone": stringType().optional(),
  "bookingHorizonDays": numberType().int().min(1).optional(),
  "cancellationCutoffMinutes": numberType().int().min(getSettingsResponseOneCancellationCutoffMinutesMin).optional(),
  "requireMobileVerification": booleanType(),
  "otpExpirySeconds": numberType().int().min(getSettingsResponseOneOtpExpirySecondsMin).max(getSettingsResponseOneOtpExpirySecondsMax).optional(),
  "otpMaxAttempts": numberType().int().min(1).max(getSettingsResponseOneOtpMaxAttemptsMax).optional(),
  "sessionTimeoutMinutes": numberType().int().min(getSettingsResponseOneSessionTimeoutMinutesMin).optional(),
  "notificationsEnabled": booleanType().optional(),
  "logoUrl": stringType().optional(),
  "primaryColor": stringType().optional(),
  "termsUrl": stringType().optional(),
  "privacyUrl": stringType().optional()
}).and(objectType({
  "otpProviderConfigured": booleanType(),
  "queuePollSeconds": literalType(30)
}));
var updateSettingsBodyCancellationCutoffMinutesMin = 0;
var updateSettingsBodyOtpExpirySecondsMin = 60;
var updateSettingsBodyOtpExpirySecondsMax = 900;
var updateSettingsBodyOtpMaxAttemptsMax = 10;
var updateSettingsBodySessionTimeoutMinutesMin = 5;
var UpdateSettingsBody = objectType({
  "platformName": stringType().optional(),
  "supportEmail": stringType().email().optional(),
  "supportPhone": stringType().optional(),
  "timezone": stringType().optional(),
  "bookingHorizonDays": numberType().int().min(1).optional(),
  "cancellationCutoffMinutes": numberType().int().min(updateSettingsBodyCancellationCutoffMinutesMin).optional(),
  "requireMobileVerification": booleanType().optional(),
  "otpExpirySeconds": numberType().int().min(updateSettingsBodyOtpExpirySecondsMin).max(updateSettingsBodyOtpExpirySecondsMax).optional(),
  "otpMaxAttempts": numberType().int().min(1).max(updateSettingsBodyOtpMaxAttemptsMax).optional(),
  "sessionTimeoutMinutes": numberType().int().min(updateSettingsBodySessionTimeoutMinutesMin).optional(),
  "notificationsEnabled": booleanType().optional(),
  "logoUrl": stringType().optional(),
  "primaryColor": stringType().optional(),
  "termsUrl": stringType().optional(),
  "privacyUrl": stringType().optional()
});
var updateSettingsResponseOneCancellationCutoffMinutesMin = 0;
var updateSettingsResponseOneOtpExpirySecondsMin = 60;
var updateSettingsResponseOneOtpExpirySecondsMax = 900;
var updateSettingsResponseOneOtpMaxAttemptsMax = 10;
var updateSettingsResponseOneSessionTimeoutMinutesMin = 5;
var UpdateSettingsResponse = objectType({
  "platformName": stringType(),
  "supportEmail": stringType().email().optional(),
  "supportPhone": stringType().optional(),
  "timezone": stringType().optional(),
  "bookingHorizonDays": numberType().int().min(1).optional(),
  "cancellationCutoffMinutes": numberType().int().min(updateSettingsResponseOneCancellationCutoffMinutesMin).optional(),
  "requireMobileVerification": booleanType(),
  "otpExpirySeconds": numberType().int().min(updateSettingsResponseOneOtpExpirySecondsMin).max(updateSettingsResponseOneOtpExpirySecondsMax).optional(),
  "otpMaxAttempts": numberType().int().min(1).max(updateSettingsResponseOneOtpMaxAttemptsMax).optional(),
  "sessionTimeoutMinutes": numberType().int().min(updateSettingsResponseOneSessionTimeoutMinutesMin).optional(),
  "notificationsEnabled": booleanType().optional(),
  "logoUrl": stringType().optional(),
  "primaryColor": stringType().optional(),
  "termsUrl": stringType().optional(),
  "privacyUrl": stringType().optional()
}).and(objectType({
  "otpProviderConfigured": booleanType(),
  "queuePollSeconds": literalType(30)
}));
var listNotificationsQueryKindDefault = `all`;
var ListNotificationsQueryParams = objectType({
  "kind": enumType(["all", "appointments", "queue", "system"]).default(listNotificationsQueryKindDefault)
});
var ListNotificationsResponse = objectType({
  "items": arrayType(objectType({
    "id": stringType(),
    "kind": enumType(["appointments", "queue", "system"]),
    "title": stringType(),
    "body": stringType().optional(),
    "createdAt": coerce.date(),
    "read": booleanType(),
    "appointmentId": stringType().nullish(),
    "date": stringType().nullish()
  })),
  "unread": numberType().int()
});
var markNotificationsReadBodyIdsItemMax = 120;
var markNotificationsReadBodyIdsMax = 100;
var MarkNotificationsReadBody = objectType({
  "ids": arrayType(stringType().max(markNotificationsReadBodyIdsItemMax)).max(markNotificationsReadBodyIdsMax).optional(),
  "all": booleanType().optional()
});
var MarkNotificationsReadResponse = objectType({
  "unread": numberType().int()
});
var ListWorkspacesResponse = objectType({
  "activeClinicId": stringType().nullish(),
  "switchable": booleanType(),
  "workspaces": arrayType(objectType({
    "id": stringType(),
    "name": stringType()
  }))
});
var SelectWorkspaceBody = objectType({
  "clinicId": stringType().nullable()
});
var SelectWorkspaceResponse = objectType({
  "activeClinicId": stringType().nullish(),
  "switchable": booleanType(),
  "workspaces": arrayType(objectType({
    "id": stringType(),
    "name": stringType()
  }))
});
var ListPatientDocumentsParams = objectType({
  "id": coerce.string()
});
var ListPatientDocumentsResponse = objectType({
  "items": arrayType(objectType({
    "id": stringType(),
    "patientId": stringType(),
    "clinicId": stringType(),
    "clinicName": stringType().optional(),
    "name": stringType(),
    "contentType": stringType(),
    "size": numberType().int(),
    "createdAt": coerce.date(),
    "uploadedByName": stringType().optional()
  })),
  "uploadClinicIds": arrayType(stringType())
});
var UploadPatientDocumentParams = objectType({
  "id": coerce.string()
});
var uploadPatientDocumentQueryNameMax = 160;
var UploadPatientDocumentQueryParams = objectType({
  "name": coerce.string().min(1).max(uploadPatientDocumentQueryNameMax),
  "clinicId": coerce.string().optional()
});
var UploadPatientDocumentResponse = objectType({
  "id": stringType(),
  "patientId": stringType(),
  "clinicId": stringType(),
  "clinicName": stringType().optional(),
  "name": stringType(),
  "contentType": stringType(),
  "size": numberType().int(),
  "createdAt": coerce.date(),
  "uploadedByName": stringType().optional()
});
var DownloadPatientDocumentParams = objectType({
  "id": coerce.string()
});
var DownloadPatientDocumentResponse = unknownType();
var DeletePatientDocumentParams = objectType({
  "id": coerce.string()
});
var DeletePatientDocumentResponse = voidType();
var ListPatientActivityParams = objectType({
  "id": coerce.string()
});
var listPatientActivityQueryPageDefault = 1;
var listPatientActivityQueryPageSizeDefault = 20;
var listPatientActivityQueryPageSizeMax = 100;
var ListPatientActivityQueryParams = objectType({
  "page": coerce.number().int().min(1).default(listPatientActivityQueryPageDefault),
  "pageSize": coerce.number().int().min(1).max(listPatientActivityQueryPageSizeMax).default(listPatientActivityQueryPageSizeDefault)
});
var ListPatientActivityResponse = objectType({
  "items": arrayType(objectType({
    "id": stringType(),
    "appointmentId": stringType(),
    "fromStatus": stringType().nullish(),
    "toStatus": stringType(),
    "occurredAt": coerce.date(),
    "reference": stringType(),
    "doctorName": stringType(),
    "date": stringType(),
    "actorName": stringType().nullish()
  })),
  "total": numberType().int(),
  "page": numberType().int(),
  "pageSize": numberType().int()
});
var GetReportTrendsQueryParams = objectType({
  "from": dateType().optional(),
  "to": dateType().optional(),
  "clinicId": coerce.string().optional(),
  "branchId": coerce.string().optional(),
  "doctorId": coerce.string().optional()
});
var GetReportTrendsResponse = objectType({
  "from": stringType(),
  "to": stringType(),
  "points": arrayType(objectType({
    "date": stringType(),
    "appointments": numberType().int(),
    "completed": numberType().int(),
    "cancelled": numberType().int(),
    "noShow": numberType().int(),
    "waiting": numberType().int()
  }))
});
var searchRecordsQueryQMin = 2;
var searchRecordsQueryQMax = 100;
var SearchRecordsQueryParams = objectType({
  "q": coerce.string().min(searchRecordsQueryQMin).max(searchRecordsQueryQMax)
});
var SearchRecordsResponse = objectType({
  "items": arrayType(objectType({
    "id": stringType(),
    "reference": stringType(),
    "patientName": stringType(),
    "doctorName": stringType(),
    "tokenNumber": numberType().int(),
    "token": stringType().optional(),
    "date": stringType(),
    "status": stringType(),
    "today": booleanType()
  }))
});
var listSavedViewsQueryTableKeyMax = 60;
var ListSavedViewsQueryParams = objectType({
  "tableKey": coerce.string().max(listSavedViewsQueryTableKeyMax)
});
var listSavedViewsResponseItemsItemColumnsOrderItemMax = 60;
var listSavedViewsResponseItemsItemColumnsOrderMax = 40;
var listSavedViewsResponseItemsItemColumnsHiddenItemMax = 60;
var listSavedViewsResponseItemsItemColumnsHiddenMax = 40;
var listSavedViewsResponseItemsItemColumnsPinnedMax = 60;
var ListSavedViewsResponse = objectType({
  "items": arrayType(objectType({
    "id": stringType(),
    "tableKey": stringType(),
    "name": stringType(),
    "filters": recordType(stringType(), stringType()),
    "columns": objectType({
      "order": arrayType(stringType().max(listSavedViewsResponseItemsItemColumnsOrderItemMax)).max(listSavedViewsResponseItemsItemColumnsOrderMax),
      "hidden": arrayType(stringType().max(listSavedViewsResponseItemsItemColumnsHiddenItemMax)).max(listSavedViewsResponseItemsItemColumnsHiddenMax),
      "pinned": stringType().max(listSavedViewsResponseItemsItemColumnsPinnedMax).nullish()
    }).optional(),
    "ownedByMe": booleanType(),
    "shared": booleanType()
  })),
  "canShare": booleanType()
});
var createSavedViewBodyTableKeyMax = 60;
var createSavedViewBodyNameMax = 60;
var createSavedViewBodyFiltersMaxOne = 80;
var createSavedViewBodyColumnsOrderItemMax = 60;
var createSavedViewBodyColumnsOrderMax = 40;
var createSavedViewBodyColumnsHiddenItemMax = 60;
var createSavedViewBodyColumnsHiddenMax = 40;
var createSavedViewBodyColumnsPinnedMax = 60;
var CreateSavedViewBody = objectType({
  "tableKey": stringType().max(createSavedViewBodyTableKeyMax),
  "name": stringType().min(1).max(createSavedViewBodyNameMax),
  "filters": recordType(stringType(), stringType().max(createSavedViewBodyFiltersMaxOne)),
  "columns": objectType({
    "order": arrayType(stringType().max(createSavedViewBodyColumnsOrderItemMax)).max(createSavedViewBodyColumnsOrderMax),
    "hidden": arrayType(stringType().max(createSavedViewBodyColumnsHiddenItemMax)).max(createSavedViewBodyColumnsHiddenMax),
    "pinned": stringType().max(createSavedViewBodyColumnsPinnedMax).nullish()
  }).optional(),
  "shareWithRole": booleanType().optional()
});
var createSavedViewResponseColumnsOrderItemMax = 60;
var createSavedViewResponseColumnsOrderMax = 40;
var createSavedViewResponseColumnsHiddenItemMax = 60;
var createSavedViewResponseColumnsHiddenMax = 40;
var createSavedViewResponseColumnsPinnedMax = 60;
var CreateSavedViewResponse = objectType({
  "id": stringType(),
  "tableKey": stringType(),
  "name": stringType(),
  "filters": recordType(stringType(), stringType()),
  "columns": objectType({
    "order": arrayType(stringType().max(createSavedViewResponseColumnsOrderItemMax)).max(createSavedViewResponseColumnsOrderMax),
    "hidden": arrayType(stringType().max(createSavedViewResponseColumnsHiddenItemMax)).max(createSavedViewResponseColumnsHiddenMax),
    "pinned": stringType().max(createSavedViewResponseColumnsPinnedMax).nullish()
  }).optional(),
  "ownedByMe": booleanType(),
  "shared": booleanType()
});
var DeleteSavedViewParams = objectType({
  "id": coerce.string()
});
var DeleteSavedViewResponse = voidType();

// src/routes/workspace-features.ts
init_auth();
init_http();
init_store();

// src/lib/list-query.ts
init_db2();
init_drizzle_orm();
init_http();
init_queue_order();
init_clinical_membership();
var names = { users: "users", doctors: "doctors", clinics: "clinics", branches: "branches", patients: "patients", masters: "masters", schedules: "schedules", "availability-exceptions": "availability_exceptions", qrs: "qrs", appointments: "appointments", "audit-logs": "audit_logs" };
var raw = sql.raw;
var inList = (value, ids) => ids?.length ? sql`${value} in (${sql.join(ids.map((id2) => sql`${id2}`), raw(","))})` : raw("false");
function operationalScope(user, clinic, branch) {
  if (user.role === "superAdmin") return raw("true");
  return sql`(${inList(clinic, user.clinicIds)} and (${branch} is null or ${!["doctor", "receptionist"].includes(user.role)} or ${inList(branch, user.branchIds)}))`;
}
function links(kind) {
  if (kind === "doctors") return managedDoctorLinks(raw("r.id"));
  return raw(`select a.*, c.data->>'name' as clinic_name, b.data->>'name' as branch_name from assignments a join clinics c on c.id=a.clinic_id left join branches b on b.id=a.branch_id where a.user_id=r.${kind === "doctors" ? "user_id" : "id"} and c.status='active' and (a.branch_id is null or b.status='active')`);
}
function readScope(user, kind) {
  if (user.role === "superAdmin" || kind === "masters") return raw("true");
  if (kind === "users" || kind === "doctors") {
    const assigned = sql`exists(select 1 from (${links(kind)}) l where ${inList(raw("l.clinic_id"), user.clinicIds)})`;
    const branch2 = !["doctor", "receptionist"].includes(user.role) ? raw("true") : sql`exists(select 1 from (${links(kind)}) l where ${inList(raw("l.branch_id"), user.branchIds)})`;
    if (kind === "doctors") return sql`(r.id=${user.doctorId || ""} or (${["clinicAdmin", "doctor", "receptionist"].includes(user.role)} and ${assigned} and ${branch2}))`;
    return sql`(r.id=${user.id} or (r.role='receptionist' and ${["clinicAdmin", "doctor"].includes(user.role)} and r.managing_admin_id=${(user.role === "clinicAdmin" ? user.id : user.managingAdminId) || ""}) or (not (r.role='receptionist' and ${["clinicAdmin", "doctor"].includes(user.role)}) and r.role<>'superAdmin' and ${assigned} and ${branch2}))`;
  }
  if (kind === "patients") {
    if (user.role === "patient") return sql`r.id=${user.patientId || ""}`;
    const ownClinic = user.role === "doctor" ? raw("false") : operationalScope(user, raw("r.clinic_id"), raw("r.branch_id"));
    return sql`(${ownClinic} or exists(select 1 from appointments ap where ap.patient_id=r.id and ${operationalScope(user, raw("ap.clinic_id"), raw("ap.branch_id"))} ${user.role === "doctor" ? sql`and ap.doctor_id=${user.doctorId || ""}` : raw("")}))`;
  }
  if (kind === "clinics") return operationalScope(user, raw("r.id"), raw("null"));
  if (user.role === "patient") return kind === "appointments" ? sql`r.patient_id=${user.patientId || ""}` : raw("false");
  const clinic = kind === "availability-exceptions" ? raw("(select clinic_id from branches where id=r.branch_id)") : raw("r.clinic_id");
  const branch = kind === "branches" ? raw("r.id") : raw("r.branch_id");
  let result = operationalScope(user, clinic, branch);
  if (user.role === "doctor" && ["appointments", "qrs"].includes(kind)) result = sql`${result} and r.doctor_id=${user.doctorId || ""}`;
  if (["schedules", "availability-exceptions"].includes(kind)) result = sql`${result} and ${clinicalMembership(raw("r.doctor_id"), raw("r.branch_id"))}`;
  return result;
}
function documentSql(kind, assignmentDocument) {
  let doc = raw(`coalesce(to_jsonb(r)->'data','{}'::jsonb) || (select jsonb_object_agg((select string_agg(case when n=1 then word else initcap(word) end,'' order by n) from unnest(string_to_array(k,'_')) with ordinality t(word,n)),v) from jsonb_each(to_jsonb(r)-'data'-'password_hash'-'token_hash') e(k,v))`);
  if (kind === "users") doc = sql`(${doc}) - 'passwordHash' - 'password_hash' - 'tokenHash' - 'token_hash' - 'clerkId'`;
  if (["users", "doctors"].includes(kind)) doc = sql`${doc} || ${assignmentDocument || sql`jsonb_build_object('clinicIds',coalesce((select jsonb_agg(distinct l.clinic_id) from (${links(kind)}) l),'[]'::jsonb),'branchIds',coalesce((select jsonb_agg(distinct l.branch_id) filter(where l.branch_id is not null) from (${links(kind)}) l),'[]'::jsonb))`}`;
  if (kind === "doctors") doc = sql`${doc} || (select jsonb_build_object('fullName',u.full_name,'email',u.email,'mobile',coalesce(u.mobile,''),'passwordEnabled',u.password_hash is not null,'managingAdminId',r.owner_admin_id,'managingAdminName',(select full_name from users where id=r.owner_admin_id),'invitationStatus',case when u.password_hash is not null then 'notRequired' else u.invitation_status end,'status',case when u.status<>'active' then 'inactive' else r.status end) from users u where u.id=r.user_id) || jsonb_build_object('specializationName',(select data->>'name' from masters where id=r.specialization_id),'qualificationNames',coalesce((select jsonb_agg(data->>'name') from masters where id in (select jsonb_array_elements_text(coalesce(r.data->'qualificationIds','[]'::jsonb)))),'[]'::jsonb))`;
  if (kind === "users") doc = sql`${doc} || jsonb_build_object('mobile',coalesce(r.mobile,''),'passwordEnabled',r.password_hash is not null,'managingAdminName',(select full_name from users where id=r.managing_admin_id),'invitationStatus',case when r.password_hash is not null then 'notRequired' else r.invitation_status end)`;
  if (kind === "clinics") doc = sql`${doc} || jsonb_build_object('adminName',(select full_name from users where id=r.admin_id))`;
  if (kind === "branches") doc = sql`${doc} || jsonb_build_object('clinicName',(select data->>'name' from clinics where id=r.clinic_id),
    'inheritEmail',coalesce((r.data->>'inheritEmail')::boolean,nullif(r.data->>'email','') is null),
    'inheritPhone',coalesce((r.data->>'inheritPhone')::boolean,nullif(r.data->>'phone','') is null),
    'effectiveEmail',case when coalesce((r.data->>'inheritEmail')::boolean,nullif(r.data->>'email','') is null) then (select data->>'email' from clinics where id=r.clinic_id) else r.data->>'email' end,
    'effectivePhone',case when coalesce((r.data->>'inheritPhone')::boolean,nullif(r.data->>'phone','') is null) then (select data->>'phone' from clinics where id=r.clinic_id) else r.data->>'phone' end)`;
  if (["schedules", "availability-exceptions", "qrs"].includes(kind)) doc = sql`${doc} || jsonb_build_object('doctorName',(select u.full_name from doctors d join users u on u.id=d.user_id where d.id=r.doctor_id),'branchName',(select data->>'name' from branches where id=r.branch_id))`;
  if (kind === "qrs") doc = sql`${doc} || jsonb_build_object('reference',r.public_reference)`;
  if (kind === "audit-logs") doc = sql`${doc} || jsonb_build_object('actorName',(select full_name from users where id=r.actor_id),'actorRole',(select role from users where id=r.actor_id))`;
  return doc;
}
function filterSql(q) {
  const filters = [raw("true")];
  const weekday = q.dayOfWeek ?? q.weekday;
  if (weekday !== void 0) {
    assert(Number.isInteger(Number(weekday)) && Number(weekday) >= 0 && Number(weekday) <= 6, 400, "Invalid weekday");
    filters.push(sql`doc->>'dayOfWeek'=${String(weekday)}`);
  }
  if (q.linkedOnly === true) filters.push(sql`doc->>'passwordEnabled'='true'`);
  if (q.statusGroup && q.statusGroup !== "all") {
    assert(statusGroups[q.statusGroup], 400, "Invalid status group");
    filters.push(inList(raw("doc->>'status'"), statusGroups[q.statusGroup]));
  }
  for (const key2 of ["clinicId", "branchId", "doctorId", "patientId", "adminId", "managingAdminId", "status", "role", "category", "parentId", "gender", "city", "specializationId", "source", "entityType", "actorId", "date", "sessionId", "startTime"]) {
    if (q[key2] !== void 0) filters.push(sql`(doc->>${key2}=${q[key2]} or coalesce(doc->${key2 === "clinicId" ? "clinicIds" : key2 === "branchId" ? "branchIds" : "__none"},'[]'::jsonb) ? ${q[key2]})`);
  }
  if (q.search) filters.push(sql`exists(select 1 from jsonb_each_text(doc) e where e.key in ('name','fullName','email','mobile','code','reference','token','patientName','doctorName','summary','specializationName') and e.value ilike ${"%" + String(q.search).replace(/[\\%_]/g, "\\$&") + "%"})`);
  if (q.from) filters.push(sql`coalesce(doc->>'date',left(doc->>'createdAt',10))>=${q.from}`);
  if (q.to) filters.push(sql`coalesce(doc->>'date',left(doc->>'createdAt',10))<=${q.to}`);
  const security = sql`doc->>'action' in ('verifyStaffPassword','recoveryInstructions','invitationResent','invitationNotRequired','invitationFailed')`;
  if (q.activityType === "operational") filters.push(sql`not (${security})`);
  if (q.activityType === "security") filters.push(security);
  if (q.selectedIds) {
    const ids = String(q.selectedIds).split(",");
    assert(ids.length <= 100, 400, "At most 100 selected IDs may be resolved");
    filters.push(inList(raw("doc->>'id'"), ids));
  }
  return sql.join(filters, raw(" and "));
}
function sourceSql(user, kind, extra = raw("true")) {
  assert(names[kind], 400, "Unsupported resource");
  if (["users", "doctors"].includes(kind)) {
    const own = kind === "users" ? sql`r.id=${user.id}` : sql`r.id=${user.doctorId || ""}`;
    const peer = kind === "users" ? sql`r.role='receptionist' and ${["clinicAdmin", "doctor"].includes(user.role)} and r.managing_admin_id=${(user.role === "clinicAdmin" ? user.id : user.managingAdminId) || ""}` : raw("false");
    const unrestricted = user.role === "superAdmin" ? raw("true") : sql`(${own} or (${peer}))`;
    const assignmentDocument = sql`jsonb_build_object(
      'clinicIds',coalesce(jsonb_agg(distinct l.clinic_id) filter(where ${unrestricted} or ${inList(raw("l.clinic_id"), user.clinicIds)}),'[]'::jsonb),
      'branchIds',coalesce(jsonb_agg(distinct l.branch_id) filter(where l.branch_id is not null and (${unrestricted} or ${operationalScope(user, raw("l.clinic_id"), raw("l.branch_id"))})),'[]'::jsonb))`;
    return sql`select ${documentSql(kind, raw("assignment_doc.doc"))} as doc from ${raw(names[kind])} r
      cross join lateral (select ${assignmentDocument} as doc from (${links(kind)}) l) assignment_doc
      where (${readScope(user, kind)}) and (${extra})`;
  }
  return sql`select ${documentSql(kind)} as doc from ${raw(names[kind])} r where (${readScope(user, kind)}) and (${extra})`;
}
var metricSql = sql`count(*)::int as appointments,
  count(*) filter(where doc->>'status' in ('booked','checkedIn','waiting'))::int as waiting,
  count(*) filter(where doc->>'status'='inConsultation')::int as "checkedIn",
  count(*) filter(where doc->>'status'='completed')::int as completed,
  count(*) filter(where doc->>'status'='noShow')::int as "noShow",
  count(*) filter(where doc->>'status'='cancelled')::int as cancelled,
  coalesce(avg((doc->>'waitMinutes')::numeric),0)::float as "averageWaitMinutes",
  avg(case when doc->>'status'='completed'
    and doc->>'consultationStartedAt' ~ '^\\d{4}-\\d{2}-\\d{2}T'
    and doc->>'completedAt' ~ '^\\d{4}-\\d{2}-\\d{2}T'
    and (doc->>'completedAt')::timestamptz >= (doc->>'consultationStartedAt')::timestamptz
    then extract(epoch from ((doc->>'completedAt')::timestamptz - (doc->>'consultationStartedAt')::timestamptz))/60 end)::float as "averageConsultationMinutes"`;
async function queryMetrics(user, q) {
  const result = await db.execute(sql`with visible as (${sourceSql(user, "appointments")}) select ${metricSql},
    count(distinct (doc->>'doctorId',doc->>'branchId',doc->>'date',doc->>'startTime')) filter(where doc->>'status' in ('booked','checkedIn','waiting','called','inConsultation'))::int as "activeQueues",
    min(doc->>'token') filter(where doc->>'status' in ('called','inConsultation')) as "currentToken"
    from visible where ${filterSql(q)}`);
  return result.rows[0];
}
function pageParams(q) {
  const page = Number(q.page || 1), pageSize = Number(q.pageSize || 20);
  assert(Number.isInteger(page) && page > 0 && Number.isInteger(pageSize) && pageSize > 0 && pageSize <= 100, 400, "Invalid pagination");
  return { page, pageSize };
}
var statusCountsSql = sql`jsonb_build_object(
  'all', count(*)::int,
  ${sql.join(Object.entries(statusGroups).map(([group, statuses]) => sql`${group}::text, count(*) filter(where ${inList(raw("doc->>'status'"), statuses)})::int`), raw(","))})`;
async function queryPage(user, kind, q = {}, extra, conn = db, withStatusCounts = false) {
  assert(!withStatusCounts || kind === "appointments" && user.role !== "patient", 400, "Status counts require staff appointments");
  const { page, pageSize } = pageParams(q), sort = q.sort || "-createdAt", key2 = sort.replace(/^-/, "");
  assert(["createdAt", "name", "fullName", "date", "status", "code", "tokenNumber", "sortOrder", "email", "waitingAt"].includes(key2), 400, "Unsupported sort field");
  const direction = raw(sort.startsWith("-") ? "desc" : "asc");
  const value = key2 === "waitingAt" ? sql`coalesce(doc->>'waitingAt',doc->>'createdAt')` : ["tokenNumber", "sortOrder"].includes(key2) ? sql`nullif(doc->>${key2},'')::numeric` : sql`doc->>${key2}`;
  const secondary = key2 === "waitingAt" ? sql`(doc->>'tokenNumber')::int ${direction},` : raw("");
  let effectiveQuery = q;
  if (kind === "branches" && q.doctorId) {
    extra = sql`(${extra || raw("true")}) and ${clinicalMembership(sql`${q.doctorId}`, raw("r.id"))}`;
    effectiveQuery = { ...q, doctorId: void 0 };
  }
  if (kind === "patients" && (q.clinicId || q.branchId)) {
    const registered = sql`${q.clinicId ? sql`r.clinic_id=${q.clinicId}` : raw("true")} and ${q.branchId ? sql`r.branch_id=${q.branchId}` : raw("true")}`;
    const visited = sql`exists(select 1 from appointments ap where ap.patient_id=r.id
      and ${q.clinicId ? sql`ap.clinic_id=${q.clinicId}` : raw("true")}
      and ${q.branchId ? sql`ap.branch_id=${q.branchId}` : raw("true")}
      and ${operationalScope(user, raw("ap.clinic_id"), raw("ap.branch_id"))}
      ${user.role === "doctor" ? sql`and ap.doctor_id=${user.doctorId || ""}` : raw("")})`;
    extra = sql`(${extra || raw("true")}) and ((${registered}) or ${visited})`;
    effectiveQuery = { ...effectiveQuery, clinicId: void 0, branchId: void 0 };
  }
  const source = sourceSql(user, kind, extra), filter = filterSql(effectiveQuery);
  const matching = withStatusCounts ? sql`base_matching as (select doc from visible where ${filterSql({ ...effectiveQuery, status: void 0, statusGroup: void 0 })}), matching as (select doc from base_matching where ${filterSql({ status: effectiveQuery.status, statusGroup: effectiveQuery.statusGroup })})` : sql`matching as (select doc from visible where ${filter})`;
  const result = await conn.execute(sql`with visible as (${source}), ${matching}, page_rows as (select doc from matching order by ${value} ${direction} nulls last, ${secondary} doc->>'id' ${direction} limit ${pageSize} offset ${(page - 1) * pageSize}) select (select count(*)::int from matching) as total, coalesce((select jsonb_agg(doc) from page_rows),'[]'::jsonb) as items ${withStatusCounts ? sql`, (select ${statusCountsSql} from base_matching) as "statusCounts"` : raw("")}`);
  const { items, total, statusCounts } = result.rows[0];
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize), ...withStatusCounts ? { statusCounts } : {} };
}

// src/routes/workspace-features.ts
init_availability();
init_feature_policy();
var workspaceFeaturesRouter = Router();
var statusText = { booked: "Booked", checkedIn: "Checked In", waiting: "Waiting", called: "Called Next", inConsultation: "In Consultation", completed: "Completed", noShow: "Marked Absent", cancelled: "Cancelled" };
async function listNotificationsFor(user) {
  const history = await db.execute(sql`with a as (select doc from (${sourceSql(user, "appointments")}) s)
    select h.id, h.to_status as "toStatus", h.created_at as "createdAt", ap.id as "appointmentId", ap.date, ap.token_number as token,
      ap.data->>'reference' as reference, coalesce(p.data->>'fullName', pu.full_name) as patient, du.full_name as doctor,
      (nr.notification_id is not null) as read
    from appointment_history h join a on a.doc->>'id' = h.appointment_id
    join appointments ap on ap.id = h.appointment_id
    left join patients p on p.id = ap.patient_id left join users pu on pu.id = p.user_id
    left join doctors d on d.id = ap.doctor_id left join users du on du.id = d.user_id
    left join notification_reads nr on nr.user_id = ${user.id} and nr.notification_id = 'h:' || h.id
    where h.created_at > now() - interval '30 days' and h.actor_id <> ${user.id}
    order by h.created_at desc limit 60`);
  const items = history.rows.map((r) => ({
    id: `h:${r.id}`,
    kind: notificationKind(r.toStatus),
    createdAt: new Date(r.createdAt).toISOString(),
    read: !!r.read,
    title: `${statusText[r.toStatus] || r.toStatus} \xB7 Token ${r.token}`,
    body: user.role === "patient" ? `Your visit with ${r.doctor || "your doctor"} (Ref ${r.reference || "-"})` : `${r.patient || "Patient"} with ${r.doctor || "doctor"} \xB7 Ref ${r.reference || "-"}`,
    appointmentId: r.appointmentId,
    date: r.date
  }));
  if (user.role === "superAdmin" || user.role === "clinicAdmin") {
    const scopeSql = user.role === "superAdmin" ? sql`true` : user.clinicIds.length ? sql`l.clinic_id in (${sql.join(user.clinicIds.map((c) => sql`${c}`), sql`, `)})` : sql`false`;
    const system = await db.execute(sql`select l.id, l.summary, l.action, l.entity_type as "entityType", l.created_at as "createdAt", u.full_name as actor,
        (nr.notification_id is not null) as read
      from audit_logs l left join users u on u.id = l.actor_id
      left join notification_reads nr on nr.user_id = ${user.id} and nr.notification_id = 'a:' || l.id
      where ${scopeSql} and l.created_at > now() - interval '30 days' and l.actor_id is distinct from ${user.id}
        and l.entity_type not in ('appointments', 'auth_sessions', 'patient_documents')
      order by l.created_at desc limit 30`);
    items.push(...system.rows.map((r) => ({ id: `a:${r.id}`, kind: "system", title: r.summary, body: r.actor ? `By ${r.actor}` : void 0, createdAt: new Date(r.createdAt).toISOString(), read: !!r.read, appointmentId: null, date: null })));
  }
  items.sort((x, y) => y.createdAt.localeCompare(x.createdAt));
  return items;
}
workspaceFeaturesRouter.get("/notifications", async (req, res) => {
  const user = await requireUser(req), q = query(ListNotificationsQueryParams, req);
  const items = await listNotificationsFor(user);
  res.json({ items: q.kind && q.kind !== "all" ? items.filter((n2) => n2.kind === q.kind) : items, unread: items.filter((n2) => !n2.read).length });
});
workspaceFeaturesRouter.post("/notifications/read", async (req, res) => {
  const user = await requireUser(req), body = parse(MarkNotificationsReadBody, req.body);
  const items = await listNotificationsFor(user);
  const visible = new Set(items.map((n2) => n2.id));
  const ids = body.all ? [...visible] : (body.ids || []).filter((id2) => visible.has(id2));
  if (ids.length) await db.insert(notificationReads).values(ids.map((notificationId) => ({ userId: user.id, notificationId }))).onConflictDoNothing();
  res.json({ unread: items.filter((n2) => !n2.read && !ids.includes(n2.id)).length });
});
async function workspaceList(user) {
  const full = await findUser(user.id);
  const ids = full?.clinicIds || [];
  const switchable = !["superAdmin", "patient"].includes(user.role) && ids.length > 1;
  const rows = ids.length ? await db.select().from(clinics).where(inArray(clinics.id, ids)) : [];
  return { activeClinicId: user.activeClinicId ?? null, switchable, workspaces: rows.map((c) => ({ id: c.id, name: String(c.data?.name || "Clinic") })).sort((a, b) => a.name.localeCompare(b.name)) };
}
workspaceFeaturesRouter.get("/workspaces", async (req, res) => {
  res.json(await workspaceList(await requireUser(req)));
});
workspaceFeaturesRouter.put("/workspaces/active", async (req, res) => {
  const user = await requireUser(req), body = parse(SelectWorkspaceBody, req.body);
  const full = await findUser(user.id);
  assert(!["superAdmin", "patient"].includes(user.role) && (full?.clinicIds.length || 0) > 1, 403, "Workspace switching is not available for this account");
  if (body.clinicId) assert(full.clinicIds.includes(body.clinicId), 403, "You are not assigned to that clinic");
  await db.transaction(async (tx) => {
    if (body.clinicId) await tx.insert(settings).values({ id: `workspace:${user.id}`, data: { clinicId: body.clinicId } }).onConflictDoUpdate({ target: settings.id, set: { data: { clinicId: body.clinicId } } });
    else await tx.delete(settings).where(eq(settings.id, `workspace:${user.id}`));
    await audit(user, "switchWorkspace", "users", { id: user.id, clinicId: body.clinicId || null }, tx);
  });
  res.json(await workspaceList({ ...user, activeClinicId: body.clinicId || null }));
});
workspaceFeaturesRouter.get("/search/records", async (req, res) => {
  const user = await requireUser(req), q = query(SearchRecordsQueryParams, req);
  const term = q.q.trim();
  assert(term.length >= 2, 400, "Enter at least 2 characters");
  const like2 = `%${term.replace(/[\\%_]/g, "\\$&")}%`, token = /^\d{1,6}$/.test(term) ? Number(term) : -1;
  const today = localNow((await getSettings()).timezone).date;
  const result = await db.execute(sql`with a as (select doc from (${sourceSql(user, "appointments")}) s)
    select ap.id, ap.data->>'reference' as reference, ap.token_number as "tokenNumber", ap.data->>'token' as token, ap.date, ap.status,
      coalesce(p.data->>'fullName', pu.full_name, '') as "patientName", coalesce(du.full_name, '') as "doctorName"
    from a join appointments ap on ap.id = a.doc->>'id'
    left join patients p on p.id = ap.patient_id left join users pu on pu.id = p.user_id
    left join doctors d on d.id = ap.doctor_id left join users du on du.id = d.user_id
    where ap.data->>'reference' ilike ${like2} or ap.token_number = ${token} or coalesce(p.data->>'fullName', pu.full_name) ilike ${like2}
    order by (ap.date = ${today}) desc, ap.date desc, ap.token_number limit 10`);
  res.json({ items: result.rows.map((r) => ({ ...r, reference: r.reference || "", token: r.token || void 0, today: r.date === today })) });
});
var viewOut = (v, user) => ({ id: v.id, tableKey: v.tableKey, name: v.name, filters: v.data?.filters || {}, columns: v.data?.columns, ownedByMe: v.userId === user.id, shared: !!v.sharedRole });
workspaceFeaturesRouter.get("/saved-views", async (req, res) => {
  const user = await requireUser(req), q = query(ListSavedViewsQueryParams, req);
  const own = await db.select().from(savedViews).where(and(eq(savedViews.userId, user.id), eq(savedViews.tableKey, q.tableKey)));
  const shared = (await db.select().from(savedViews).where(and(eq(savedViews.sharedRole, user.role), eq(savedViews.tableKey, q.tableKey)))).filter((v) => v.userId !== user.id && (user.role === "superAdmin" || (v.clinicIds || []).some((c) => user.clinicIds.includes(c))));
  res.json({ items: [...own, ...shared].sort((a, b) => a.name.localeCompare(b.name)).map((v) => viewOut(v, user)), canShare: SHARE_ROLES.has(user.role) });
});
workspaceFeaturesRouter.post("/saved-views", async (req, res) => {
  const user = await requireUser(req), body = parse(CreateSavedViewBody, req.body);
  let clean;
  try {
    clean = sanitizeSavedView(body);
  } catch (e) {
    assert(false, 400, e.message);
  }
  const share = !!body.shareWithRole;
  assert(!share || SHARE_ROLES.has(user.role), 403, "Your role cannot share views");
  const existing = await db.select().from(savedViews).where(and(eq(savedViews.userId, user.id), eq(savedViews.tableKey, clean.tableKey)));
  assert(existing.length < 30, 400, "Delete an older view first (30 per list)");
  const same = existing.find((v) => v.name === clean.name);
  const row = { id: same?.id || uid(), userId: user.id, tableKey: clean.tableKey, name: clean.name, data: { filters: clean.filters, columns: clean.columns }, sharedRole: share ? user.role : null, clinicIds: share ? user.clinicIds : [] };
  await db.insert(savedViews).values(row).onConflictDoUpdate({ target: savedViews.id, set: { data: row.data, sharedRole: row.sharedRole, clinicIds: row.clinicIds } });
  res.status(201).json(viewOut(row, user));
});
workspaceFeaturesRouter.delete("/saved-views/:id", async (req, res) => {
  const user = await requireUser(req);
  const [row] = await db.select().from(savedViews).where(eq(savedViews.id, String(req.params.id)));
  assert(row && row.userId === user.id, 404, "View not found");
  await db.delete(savedViews).where(eq(savedViews.id, row.id));
  res.status(204).end();
});

// src/routes/patient-records.ts
init_db2();
init_drizzle_orm();
import { Router as Router2, raw as raw2 } from "express";
init_auth();
init_http();
init_store();

// src/lib/native-auth.ts
init_drizzle_orm();
init_db2();
init_http();
import { createHash, createHmac, randomBytes as randomBytes2, randomInt, timingSafeEqual } from "node:crypto";
import argon2 from "argon2";

// src/lib/auth-config.ts
init_http();
var SESSION_AGE_SECONDS = 12 * 60 * 60;
var SESSION_AGE = SESSION_AGE_SECONDS * 1e3;

// src/lib/native-auth.ts
var digest = (raw3) => createHash("sha256").update(raw3).digest("hex");
async function consumeRateLimit(key2, max, windowMs = 6e5) {
  if (randomBytes2(1)[0] === 0)
    await db.delete(authRateLimits).where(lt(authRateLimits.expiresAt, /* @__PURE__ */ new Date()));
  const hash = digest(key2);
  await db.transaction(async (tx) => {
    const result = await tx.execute(sql`insert into auth_rate_limits ("key",attempts,expires_at)
      values (${hash},1,now() + (${windowMs} * interval '1 millisecond'))
      on conflict ("key") do update
      set attempts=case when auth_rate_limits.expires_at<now() then 1 else auth_rate_limits.attempts+1 end,
          expires_at=case when auth_rate_limits.expires_at<now() then now() + (${windowMs} * interval '1 millisecond') else auth_rate_limits.expires_at end
      returning attempts`);
    if (Number(result.rows[0]?.attempts) > max) throw new HttpError(429, "Too many attempts; please try later", "RATE_LIMITED");
  });
}

// src/routes/patient-records.ts
init_permission_policy();
init_feature_policy();

// memory-storage:storage
var n = 0;
async function saveDocument(bytes) {
  const key2 = "mem-" + ++n;
  globalThis.__featureBlobs.set(key2, Buffer.from(bytes));
  return { provider: "memory", key: key2 };
}
async function readDocument(_p, key2) {
  const b = globalThis.__featureBlobs.get(key2);
  if (!b) throw Object.assign(new Error("gone"), { status: 404 });
  return b;
}
async function removeDocument(_p, key2) {
  globalThis.__featureBlobs.delete(key2);
}

// src/routes/patient-records.ts
var patientRecordsRouter = Router2();
var STAFF = ["superAdmin", "clinicAdmin", "doctor", "receptionist"];
async function readablePatient(user, id2) {
  const [row] = await db.select().from(patients).where(eq(patients.id, id2));
  assert(row && await canRead(user, "patients", row), 404, "Patient not found");
  return row;
}
async function documentClinics(user, patient) {
  if (!STAFF.includes(user.role)) return [];
  const visits = await db.select({ clinicId: appointments.clinicId, doctorId: appointments.doctorId }).from(appointments).where(eq(appointments.patientId, patient.id));
  const ids = /* @__PURE__ */ new Set([...patient.clinicId && user.role !== "doctor" ? [patient.clinicId] : [], ...visits.filter((v) => user.role !== "doctor" || v.doctorId === user.doctorId).map((v) => v.clinicId)]);
  return [...ids].filter((c) => user.role === "superAdmin" || user.clinicIds.includes(c));
}
var visibleClinic = (user, clinicId) => user.role === "superAdmin" || user.role === "patient" || user.clinicIds.includes(clinicId);
patientRecordsRouter.get("/patients/:id/documents", async (req, res) => {
  const user = await requireUser(req), patient = await readablePatient(user, String(req.params.id));
  const rows = await db.select({ d: patientDocuments, uploader: users.fullName, clinic: clinics.data }).from(patientDocuments).leftJoin(users, eq(users.id, patientDocuments.uploadedBy)).leftJoin(clinics, eq(clinics.id, patientDocuments.clinicId)).where(and(eq(patientDocuments.patientId, patient.id), eq(patientDocuments.status, "active")));
  const items = rows.filter((r) => visibleClinic(user, r.d.clinicId)).sort((a, b) => +b.d.createdAt - +a.d.createdAt).map((r) => ({
    id: r.d.id,
    patientId: r.d.patientId,
    clinicId: r.d.clinicId,
    clinicName: r.clinic?.name,
    name: r.d.name,
    contentType: r.d.contentType,
    size: r.d.size,
    createdAt: r.d.createdAt.toISOString(),
    uploadedByName: r.uploader || void 0
  }));
  res.json({ items, uploadClinicIds: await documentClinics(user, patient) });
});
patientRecordsRouter.post("/patients/:id/documents", async (req, _res, next) => {
  const user = await requireUser(req);
  assert(STAFF.includes(user.role), 403, "Your role cannot upload patient documents");
  next();
}, raw2({ type: () => true, limit: DOCUMENT_MAX_BYTES }), async (req, res) => {
  const user = await requireUser(req), patient = await readablePatient(user, String(req.params.id));
  const q = query(UploadPatientDocumentQueryParams, req);
  const allowed = await documentClinics(user, patient);
  const clinicId = q.clinicId || allowed[0];
  assert(clinicId && allowed.includes(clinicId), 403, "You cannot add documents for this patient in that clinic");
  assert(Buffer.isBuffer(req.body) && req.body.length > 0, 400, "Choose a file to upload");
  const type = sniffDocument(req.body);
  assert(type, 400, "Upload a PDF, PNG, JPEG, WebP or plain text file up to 10 MB");
  await consumeRateLimit(`document-upload:${user.id}`, 30, 9e5);
  const stored = await saveDocument(req.body, type);
  const row = { id: uid(), patientId: patient.id, clinicId, uploadedBy: user.id, name: safeDocumentName(q.name), contentType: type, size: req.body.length, provider: stored.provider, storageKey: stored.key };
  try {
    await db.transaction(async (tx) => {
      await tx.insert(patientDocuments).values(row);
      await audit(user, "uploadDocument", "patient_documents", { id: row.id, clinicId }, tx);
    });
  } catch (error) {
    await removeDocument(stored.provider, stored.key);
    throw error;
  }
  res.status(201).json({ id: row.id, patientId: row.patientId, clinicId, name: row.name, contentType: row.contentType, size: row.size, createdAt: (/* @__PURE__ */ new Date()).toISOString(), uploadedByName: user.fullName });
});
async function authorizedDocument(user, id2) {
  const [doc] = await db.select().from(patientDocuments).where(eq(patientDocuments.id, id2));
  assert(doc && doc.status === "active" && visibleClinic(user, doc.clinicId), 404, "Document not found");
  await readablePatient(user, doc.patientId);
  return doc;
}
patientRecordsRouter.get("/patient-documents/:id", async (req, res) => {
  const user = await requireUser(req), doc = await authorizedDocument(user, String(req.params.id));
  const bytes = await readDocument(doc.provider, doc.storageKey);
  await audit(user, "downloadDocument", "patient_documents", { id: doc.id, clinicId: doc.clinicId });
  res.set({
    "Content-Type": doc.contentType,
    "Content-Length": String(bytes.length),
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-store",
    "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(doc.name)}`
  });
  res.send(bytes);
});
patientRecordsRouter.delete("/patient-documents/:id", async (req, res) => {
  const user = await requireUser(req), doc = await authorizedDocument(user, String(req.params.id));
  assert(["superAdmin", "clinicAdmin"].includes(user.role) || doc.uploadedBy === user.id, 403, "Only the uploader or a clinic administrator can delete this document");
  await db.transaction(async (tx) => {
    await tx.update(patientDocuments).set({ status: "deleted", deletedAt: /* @__PURE__ */ new Date() }).where(eq(patientDocuments.id, doc.id));
    await audit(user, "deleteDocument", "patient_documents", { id: doc.id, clinicId: doc.clinicId }, tx);
  });
  await removeDocument(doc.provider, doc.storageKey);
  res.status(204).end();
});
patientRecordsRouter.get("/patients/:id/activity", async (req, res) => {
  const user = await requireUser(req), patient = await readablePatient(user, String(req.params.id));
  await enforcePermissionPolicy(user, { method: "GET", path: "/appointments" });
  const q = query(ListPatientActivityQueryParams, req), { page, pageSize } = pageParams(q);
  const base = sql`from appointment_history h join (${sourceSql(user, "appointments", sql`r.patient_id = ${patient.id}`)}) a on a.doc->>'id' = h.appointment_id
    join appointments ap on ap.id = h.appointment_id left join doctors d on d.id = ap.doctor_id left join users du on du.id = d.user_id left join users au on au.id = h.actor_id`;
  const [count] = (await db.execute(sql`select count(*)::int as total ${base}`)).rows;
  const rows = await db.execute(sql`select h.id, h.appointment_id as "appointmentId", h.from_status as "fromStatus", h.to_status as "toStatus", h.created_at as "occurredAt",
      coalesce(ap.data->>'reference','') as reference, coalesce(du.full_name,'') as "doctorName", ap.date,
      case when ${user.role === "patient"} then null else au.full_name end as "actorName"
    ${base} order by h.created_at desc, h.id limit ${pageSize} offset ${(page - 1) * pageSize}`);
  res.json({ items: rows.rows.map((r) => ({ ...r, occurredAt: new Date(r.occurredAt).toISOString() })), total: count.total, page, pageSize });
});

// src/routes/reporting.ts
init_db2();
import { Router as Router3 } from "express";
init_auth();
init_http();
init_store();
init_appointments();
init_availability();
init_drizzle_orm();

// src/lib/report-order.ts
init_drizzle_orm();
init_zod();
var fields = ["key", "label", "appointments", "outcomes", "other", "registrations", "waiting", "checkedIn", "completed", "noShow", "cancelled", "averageWaitMinutes", "averageConsultationMinutes"];
var reportListControls = external_exports.object({
  search: external_exports.string().trim().max(200).optional(),
  sort: external_exports.string().refine((value) => fields.includes(value.replace(/^-/, "")), "Unsupported report sort field").optional()
});
function reportOrder(sort = "key") {
  reportListControls.parse({ sort });
  const key2 = sort.replace(/^-/, "");
  const direction = sort.startsWith("-") ? sql`desc` : sql`asc`;
  const other = sql`(appointments - completed - cancelled - "noShow")`;
  const values = key2 === "outcomes" ? [sql.identifier("cancelled"), sql.identifier("noShow"), other] : [key2 === "other" ? other : sql.identifier(key2)];
  return sql`${sql.join(values.map((value) => sql`${value} ${direction} nulls last`), sql`, `)}, key asc`;
}

// src/routes/reporting.ts
var reportingRouter = Router3();
async function authorizeReportContext(user, q) {
  if (user.role === "patient") {
    if (q.clinicId || q.branchId || q.doctorId) {
      const own = await queryPage(user, "appointments", { ...q, date: void 0, pageSize: 1 });
      assert(own.total, 403, "Dashboard context outside your scope");
    }
    return;
  }
  let clinicId = q.clinicId;
  if (q.branchId) {
    const branch = await one(branches, q.branchId);
    assert(!clinicId || branch.clinicId === clinicId, 400, "This branch does not belong to the selected clinic");
    clinicId = branch.clinicId;
  }
  if (clinicId) {
    await one(clinics, clinicId);
    assert(scope(user, clinicId, q.branchId), 403, "Dashboard context outside your scope");
  }
  if (q.doctorId) {
    const doctor = (await queryPage(user, "doctors", { selectedIds: q.doctorId, pageSize: 1 })).items[0];
    assert(doctor, 403, "Doctor outside your scope");
    if (q.branchId) assert(doctor.branchIds.includes(q.branchId), 400, "This doctor is not assigned to the selected branch");
    else if (clinicId) assert(doctor.clinicIds.includes(clinicId), 400, "This doctor is not assigned to the selected clinic");
  }
}
reportingRouter.get("/dashboard", async (req, res) => {
  const user = await requireUser(req), q = query(GetDashboardQueryParams, req), config = await getSettings();
  await authorizeReportContext(user, q);
  q.date ||= localNow(config.timezone).date;
  const stats = await queryMetrics(user, q);
  const recent = await queryPage(user, "appointments", { ...q, pageSize: 8, sort: "-createdAt" });
  const counts = {};
  for (const [kind, table, key2] of [["doctors", doctors, "totalDoctors"], ["clinics", clinics, "totalClinics"], ["branches", branches, "totalBranches"], ["patients", patients, "totalPatients"]]) {
    const filters = { status: "active", clinicId: q.clinicId, branchId: q.branchId, pageSize: 1 };
    if (kind === "clinics") {
      delete filters.clinicId;
      delete filters.branchId;
    }
    if (kind === "branches") delete filters.branchId;
    let extra = sql`true`;
    if (kind === "clinics" && q.clinicId) extra = sql`r.id=${q.clinicId}`;
    if (kind === "branches" && q.branchId) extra = sql`r.id=${q.branchId}`;
    if (kind === "doctors" && q.doctorId) extra = sql`r.id=${q.doctorId}`;
    if (kind === "patients" && q.doctorId) extra = sql`r.id in (select doc->>'patientId' from (${sourceSql(user, "appointments")}) v where ${filterSql(q)})`;
    counts[key2] = (await queryPage(user, kind, filters, extra)).total;
  }
  const recentActivity = ["superAdmin", "clinicAdmin"].includes(user.role) ? (await queryPage(user, "audit-logs", { clinicId: q.clinicId, branchId: q.branchId, activityType: "operational", pageSize: 8 })).items : [];
  res.json({ ...counts, ...stats, todayAppointments: stats.appointments, recentAppointments: await appointmentViews(recent.items, user), recentActivity });
});
reportingRouter.get("/reports", async (req, res) => {
  const user = await requireUser(req);
  roles(user, ["superAdmin", "clinicAdmin", "doctor", "receptionist"]);
  const q = { ...query(GetReportsQueryParams, req), ...query(reportListControls, req) }, config = await getSettings(), today = localNow(config.timezone).date;
  await authorizeReportContext(user, q);
  q.from ||= today.slice(0, 7) + "-01";
  q.to ||= today;
  assert(q.from <= q.to, 400, "Invalid report date range");
  const groupBy = q.groupBy || "date", { page, pageSize } = pageParams(q);
  const group = groupBy === "date" ? sql`doc->>'date'` : sql`doc->>${groupBy + "Id"}`;
  const registrationGroup = groupBy === "date" ? sql`left(doc->>'createdAt',10)` : sql`doc->>'clinicId'`;
  const search = q.search ? `%${q.search.replace(/[\\%_]/g, "\\$&")}%` : null;
  const searchPredicate = search ? sql`(key ilike ${search} or label ilike ${search})` : sql`true`;
  const order = reportOrder(q.sort);
  const result = await db.execute(sql`with appointments_scoped as (${sourceSql(user, "appointments")}),
    records as (select doc from appointments_scoped where ${filterSql({ ...q, search: void 0 })}),
    patients_scoped as (${sourceSql(user, "patients")}),
    registrations as (select doc from patients_scoped where ${filterSql({ from: q.from, to: q.to, clinicId: q.clinicId, branchId: q.branchId })}),
     grouped as (select ${group} as key, coalesce(min(doc->>${groupBy + "Name"}),min(${group})) as label, ${metricSql} from records group by 1),
    keys as (select key from grouped union select ${registrationGroup} from registrations where ${groupBy !== "doctor"} and ${registrationGroup} is not null),
    results as (select k.key, coalesce(g.label,k.key) as label, coalesce(g.appointments,0) as appointments, coalesce(g.waiting,0) as waiting, coalesce(g."checkedIn",0) as "checkedIn", coalesce(g.completed,0) as completed, coalesce(g."noShow",0) as "noShow", coalesce(g.cancelled,0) as cancelled, coalesce(g."averageWaitMinutes",0) as "averageWaitMinutes", g."averageConsultationMinutes",
      (select count(*)::int from registrations p where ${groupBy === "doctor" ? sql`exists(select 1 from records a where a.doc->>'doctorId'=k.key and a.doc->>'patientId'=p.doc->>'id')` : groupBy === "date" ? sql`left(p.doc->>'createdAt',10)=k.key` : sql`p.doc->>'clinicId'=k.key`}) as registrations
      from keys k left join grouped g using(key)),
    filtered_results as (select * from results where ${searchPredicate}),
     page_rows as (select * from filtered_results order by ${order} limit ${pageSize} offset ${(page - 1) * pageSize})
    select (select count(*)::int from filtered_results) as total, coalesce((select jsonb_agg(to_jsonb(p)) from page_rows p),'[]'::jsonb) as rows`);
  const { rows, total } = result.rows[0];
  res.json({ from: q.from, to: q.to, groupBy, rows, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
});
reportingRouter.get("/reports/trends", async (req, res) => {
  const user = await requireUser(req);
  roles(user, ["superAdmin", "clinicAdmin", "doctor", "receptionist"]);
  const q = query(GetReportTrendsQueryParams, req), today = localNow((await getSettings()).timezone).date;
  await authorizeReportContext(user, q);
  q.from ||= today.slice(0, 7) + "-01";
  q.to ||= today;
  assert(q.from <= q.to, 400, "Invalid report date range");
  assert((Date.parse(q.to) - Date.parse(q.from)) / 864e5 <= 366, 400, "Trend range is limited to one year");
  const result = await db.execute(sql`with records as (select doc from (${sourceSql(user, "appointments")}) s where ${filterSql({ from: q.from, to: q.to, clinicId: q.clinicId, branchId: q.branchId, doctorId: q.doctorId })}),
    grouped as (select doc->>'date' as date, ${metricSql} from records group by 1)
    select to_char(d, 'YYYY-MM-DD') as date, coalesce(g.appointments,0) as appointments, coalesce(g.completed,0) as completed, coalesce(g.cancelled,0) as cancelled, coalesce(g."noShow",0) as "noShow", coalesce(g.waiting,0) as waiting
    from generate_series(${q.from}::date, ${q.to}::date, interval '1 day') d left join grouped g on g.date = to_char(d, 'YYYY-MM-DD') order by 1`);
  res.json({ from: q.from, to: q.to, points: result.rows });
});
reportingRouter.get("/audit-logs", async (req, res) => {
  const user = await requireUser(req);
  roles(user, ["superAdmin", "clinicAdmin"]);
  const q = query(ListAuditLogsQueryParams, req);
  await authorizeReportContext(user, q);
  res.json(await queryPage(user, "audit-logs", q));
});
reportingRouter.get("/settings", async (req, res) => {
  await requireUser(req);
  res.json(await getSettings());
});
reportingRouter.patch("/settings", async (req, res) => {
  const user = await requireUser(req);
  roles(user, ["superAdmin"]);
  const body = parse(UpdateSettingsBody, req.body);
  if (body.timezone) localNow(body.timezone);
  await db.transaction(async (tx) => {
    const config = { ...await getSettings(tx), ...body };
    delete config.otpProviderConfigured;
    await tx.insert(settings).values({ id: "platform", data: config }).onConflictDoUpdate({ target: settings.id, set: { data: config } });
    await audit(user, "update", "settings", { id: "platform" }, tx);
  });
  res.json(await getSettings());
});

// <stdin>
init_http();
function createApp() {
  const app = express();
  app.use((req, _res, next) => {
    const id2 = req.get("x-test-user");
    if (id2) {
      req.authUserId = id2;
      req.authSessionHash = "test-session-" + id2;
    }
    next();
  });
  app.use(express.json());
  app.use("/api", workspaceFeaturesRouter, patientRecordsRouter, reportingRouter);
  app.use(errors);
  return app;
}
export {
  createApp
};
