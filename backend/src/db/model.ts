// Relational model runtime.
//
// Each file under src/models declares its table, columns, child tables and
// references here. The runtime turns the declaration into real SQL: filters
// become indexed WHERE clauses, embedded arrays become joins against their own
// tables, and references are resolved with one batched query per path instead of
// one query per row.

// ---------------------------------------------------------------------------
// declaration types
//
// These describe what a file under src/models passes to defineModel. They are
// the contract between a model declaration and this runtime.
// ---------------------------------------------------------------------------

/** The storage kinds a column can declare. */
import type { PoolClient } from 'pg';
import { query, withTransaction, getPool } from './pool';
import { generateId, toId } from './objectId';

export type FieldType = 'id' | 'string' | 'number' | 'boolean' | 'date' | 'json' | 'stringArray';

export interface FieldDef {
  /** Physical column name; defaults to the field name. */
  column?: string;
  /** Storage kind; defaults to 'string'. */
  type?: FieldType;
  /** Target model name for an 'id' column. */
  ref?: string;
  /** Target model names when the column can point at more than one table. */
  refAny?: string[];
  required?: boolean;
  enum?: readonly unknown[];
  min?: number;
  max?: number;
  lowercase?: boolean;
  trim?: boolean;
  /** Alternative key accepted on input. */
  alias?: string;
  /** A literal, or a factory called with the document as `this`. */
  default?: unknown;
}

/** A field definition after the constructor has filled in column and type. */
interface ResolvedFieldDef extends FieldDef {
  column: string;
  type: FieldType;
}

/** An embedded array, stored in its own table keyed back to the parent row. */
export interface ChildDef {
  table: string;
  parentKey: string;
  /** For scalar children: the single column holding each value. */
  valueColumn?: string;
  /** True when each row is one value rather than an object. */
  scalar?: boolean;
  /** True when each row carries its own id. */
  ownId?: boolean;
  orderBy?: string;
  /** Target model for a scalar child of ids. */
  ref?: string;
  fields?: Record<string, ChildFieldDef>;
}

/** A child column. Unlike a top level field it must name its column. */
export interface ChildFieldDef extends FieldDef {
  column: string;
}

export interface TextSearchDef {
  column: string;
  config: string;
}

export interface ModelHooks {
  preSave?: (this: AnyDoc) => Promise<void> | void;
}

export interface ModelOptions {
  /** Include virtuals (and an `id` alias) in toObject() output. */
  virtuals?: boolean;
}

export interface ModelConfig {
  name: string;
  table: string;
  fields: Record<string, FieldDef>;
  children?: Record<string, ChildDef>;
  virtuals?: Record<string, (this: AnyDoc) => unknown>;
  methods?: Record<string, (this: AnyDoc, ...args: any[]) => any>;
  statics?: Record<string, (...args: any[]) => any>;
  hooks?: ModelHooks;
  textSearch?: TextSearchDef;
  /** Defaults to true; false drops the created_at / updated_at columns. */
  timestamps?: boolean;
  options?: ModelOptions;
}

// ---------------------------------------------------------------------------
// query types
// ---------------------------------------------------------------------------

/**
 * A filter in the Mongo-like dialect this runtime compiles to SQL: field paths
 * mapped to a value, to a { $gt, $in, $ne, ... } condition, or the top level
 * $or / $and / $text operators.
 */
export type Filter = Record<string, any>;

/** An update document: $set / $inc / $addToSet / $pull / $unset, or bare fields. */
export type UpdateSpec = Record<string, any>;

/** A projection, in any of the three shapes the callers use. */
export type Projection = string | string[] | Record<string, unknown> | null | undefined;

interface ParsedProjection {
  include: string[];
  exclude: string[];
}

export interface PopulateSpec {
  path: string;
  select?: Projection;
}

export interface UpdateResult {
  matchedCount: number;
  modifiedCount: number;
  acknowledged: boolean;
}

export interface DeleteResult {
  deletedCount: number;
  acknowledged: boolean;
}

interface ColumnTarget {
  def: ResolvedFieldDef;
  jsonPath?: string[];
}

interface ChildTarget {
  child: ChildDef;
  field: ChildFieldDef | null;
}

interface QueryChain {
  select: Projection;
  populate: PopulateSpec[];
  lean: boolean;
}

/**
 * A foreign-key column.
 *
 * Unpopulated the property holds the 24-character id string; after
 * `.populate(path)` the very same property holds the referenced document, or a
 * projection of it. Both shapes are read at the same call sites — a route
 * populates `department` and then reads `conversation.department.sla` — so the
 * property stays deliberately open rather than forcing a narrowing cast into
 * every caller. The type argument records which model it points at.
 */
export type Ref<TModel = unknown> = any;

/** A row as it comes back from the driver. */
type Row = Record<string, any>;

/** The document type used inside the runtime, where fields are addressed by name. */
type AnyDoc = Document & Record<string, any>;

/** The three shapes runQuery can be asked for. */
export type QueryOp = 'find' | 'findOne' | 'count';

interface ParsedUpdate {
  set: Record<string, any>;
  inc: Record<string, any>;
  addToSet: Record<string, any>;
  pull: Record<string, any>;
}

interface JsonPatch {
  kind: 'set' | 'inc';
  path: string[];
  value: unknown;
}

export interface UpdateOptions {
  /** `false` suppresses the returned document. */
  new?: boolean;
  upsert?: boolean;
}

/** A hydrated document: the declared fields plus the document API. */
export type Doc<TFields> = Document & TFields;

/**
 * What a caller may pass when creating a document.
 *
 * Nested json columns are merged into their declared defaults by the runtime
 * (see mergeDefaults), so a caller that sets one key of `widgetSettings` really
 * does get the rest filled in. The input type says so.
 */
export type DeepPartial<T> =
  T extends Date ? T
  : T extends (infer TItem)[] ? DeepPartial<TItem>[]
  : T extends object ? { [K in keyof T]?: DeepPartial<T[K]> }
  : T;

export type CreateInput<TFields> = DeepPartial<TFields> & Record<string, any>;

/** The plain-object form `.lean()` produces: the data without the document API. */
export type Plain<TDoc> = TDoc extends Document
  ? Omit<
      TDoc,
      'save' | 'toObject' | 'toJSON' | 'populate' | 'deleteOne' | 'isModified'
      | '$model' | '$isNew' | '$snapshot' | '$populated' | '$id'
    > & Record<string, any>
  : TDoc;

/** Applies Plain through the array / nullable shapes a query can resolve to. */
export type LeanOf<TResult> = TResult extends (infer TItem)[] ? Plain<TItem>[] : Plain<TResult>;

/**
 * What `defineModel` hands back: constructible, plus every static the routes
 * and services call. `TFields` is the declared document shape, `TStatics` the
 * extra statics a model adds.
 */
export type Model<TFields = Record<string, unknown>, TStatics = Record<string, never>> = TStatics & {
  new (data?: CreateInput<TFields>): Doc<TFields>;
  (data?: CreateInput<TFields>): Doc<TFields>;

  modelName: string;
  table: string;
  $model: ModelRuntime;

  find(filter?: Filter | null, projection?: Projection): Query<Doc<TFields>[]>;
  findOne(filter?: Filter | null, projection?: Projection): Query<Doc<TFields> | null>;
  findById(id: unknown, projection?: Projection): Query<Doc<TFields> | null>;
  countDocuments(filter?: Filter | null): Query<number>;
  estimatedDocumentCount(): Query<number>;

  create(data: CreateInput<TFields>[]): Promise<Doc<TFields>[]>;
  create(data: CreateInput<TFields>): Promise<Doc<TFields>>;

  findOneAndUpdate(filter: Filter, update: UpdateSpec, options?: UpdateOptions): DeferredQuery<Doc<TFields> | null>;
  findByIdAndUpdate(id: unknown, update: UpdateSpec, options?: UpdateOptions): DeferredQuery<Doc<TFields> | null>;
  updateMany(filter: Filter, update: UpdateSpec): Promise<UpdateResult>;
  updateOne(filter: Filter, update: UpdateSpec): Promise<UpdateResult>;

  findOneAndDelete(filter: Filter): DeferredQuery<Doc<TFields> | null>;
  findByIdAndDelete(id: unknown): DeferredQuery<Doc<TFields> | null>;
  deleteMany(filter: Filter): Promise<DeleteResult>;
  deleteOne(filter: Filter): Promise<DeleteResult>;
};

const registry = new Map<string, ModelRuntime>();

// Column and table names are emitted through this helper so that identifiers
// which collide with SQL keywords (for example "window" or "timestamp") stay
// valid.
function ident(identifier: string): string {
  return '"' + String(identifier).replace(/"/g, '""') + '"';
}

// ---------------------------------------------------------------------------
// small helpers
// ---------------------------------------------------------------------------

function deepClone<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return new Date(value.getTime()) as unknown as T;
  if (Array.isArray(value)) return value.map((item) => deepClone(item)) as unknown as T;
  const source = value as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(source)) out[key] = deepClone(source[key]);
  return out as unknown as T;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a instanceof Date || b instanceof Date) {
    const at = a instanceof Date ? a.getTime() : a;
    const bt = b instanceof Date ? b.getTime() : b;
    return at === bt;
  }
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const ak = Object.keys(left);
  const bk = Object.keys(right);
  if (ak.length !== bk.length) return false;
  return ak.every((k) => deepEqual(left[k], right[k]));
}

function isPlainObject(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);
}

// Merges a partial object into a default object without dropping keys the
// caller did not mention, mirroring how Mongoose filled nested defaults in.
function mergeDefaults(defaults: unknown, value: unknown): unknown {
  if (!isPlainObject(defaults)) return value === undefined ? defaults : value;
  const base = deepClone(defaults);
  if (!isPlainObject(value)) return value === undefined ? base : value;
  for (const key of Object.keys(value)) {
    base[key] = isPlainObject(base[key]) ? mergeDefaults(base[key], value[key]) : value[key];
  }
  return base;
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// ---------------------------------------------------------------------------
// value conversion
// ---------------------------------------------------------------------------

function toDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  const d = new Date(value as string | number);
  return isNaN(d.getTime()) ? null : d;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isNaN(n) ? null : n;
}

// Converts a raw database value into what the application expects to read.
function fromColumn(def: FieldDef, value: unknown): unknown {
  if (value === null || value === undefined) return null;
  switch (def.type) {
    case 'number': return toNumber(value);
    case 'boolean': return value === true || value === 't' || value === 'true';
    case 'date': return toDate(value);
    case 'json': return value;
    case 'stringArray': return Array.isArray(value) ? value : [];
    default: return value;
  }
}

// Converts an application value into what the driver should bind.
function toColumn(def: FieldDef, value: unknown): unknown {
  if (value === undefined) return null;
  switch (def.type) {
    case 'id': {
      const id = toId(value);
      return id === '' ? null : id;
    }
    case 'number': return toNumber(value);
    case 'boolean': {
      if (value === null) return null;
      return Boolean(value);
    }
    case 'date': return toDate(value);
    case 'json': return value === null ? null : JSON.stringify(value);
    case 'stringArray': {
      if (value === null) return [];
      const arr = Array.isArray(value) ? value : [value];
      return arr.filter((v) => v !== null && v !== undefined).map((v) => String(v));
    }
    case 'string': {
      if (value === null) return null;
      return typeof value === 'string' ? value : String(value);
    }
    default: return value === null ? null : value;
  }
}

// Applies the declared `lowercase` / `trim` transforms.
function applySetters(def: FieldDef, value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (def.type === 'stringArray') {
    const arr = Array.isArray(value) ? value : [value];
    return arr
      .filter((v) => v !== null && v !== undefined)
      .map((v) => {
        let s = String(v);
        if (def.trim) s = s.trim();
        if (def.lowercase) s = s.toLowerCase();
        return s;
      });
  }
  if (typeof value !== 'string') return value;
  let out = value;
  if (def.trim) out = out.trim();
  if (def.lowercase) out = out.toLowerCase();
  return out;
}

// ---------------------------------------------------------------------------
// full text search
// ---------------------------------------------------------------------------

// MongoDB's $text matched documents containing ANY of the search terms. The
// equivalent tsquery therefore ORs the terms rather than ANDing them the way
// plainto_tsquery would.
function buildTsQueryTerms(search: unknown): string[] {
  if (typeof search !== 'string') return [];
  return search
    .split(/[^\p{L}\p{N}]+/u)
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0);
}

// ---------------------------------------------------------------------------
// filter compilation
// ---------------------------------------------------------------------------

class SqlBuilder {
  params: unknown[];

  constructor() {
    this.params = [];
  }

  bind(value: unknown): string {
    this.params.push(value);
    return `$${this.params.length}`;
  }
}

const COMPARATORS: Record<string, string> = { $gt: '>', $gte: '>=', $lt: '<', $lte: '<=' };

class FilterCompiler {
  model: ModelRuntime;
  builder: SqlBuilder;
  alias: string;

  constructor(model: ModelRuntime, builder: SqlBuilder, alias: string) {
    this.model = model;
    this.builder = builder;
    this.alias = alias;
  }

  compile(filter: Filter | null | undefined): string {
    const clauses = this.compileObject(filter || {});
    return clauses.length ? clauses.join(' AND ') : 'TRUE';
  }

  compileObject(filter: Filter): string[] {
    const clauses: string[] = [];
    for (const [key, value] of Object.entries(filter)) {
      // An undefined condition used to be skipped, the way Mongoose strips
      // undefined keys. That turned `findOne({ _id: undefined, isActive: true })`
      // into "the first active row": a token without a userId authenticated as
      // whichever user the database returned first. A missing value in a filter
      // is always a caller bug, and dropping it widens the query in exactly the
      // direction that leaks data — so it now fails loudly instead. Callers
      // with genuinely optional filters add the key only when they have a value.
      if (value === undefined) {
        throw new Error(`${this.model.modelName} filter: "${key}" is undefined`);
      }

      if (key === '$or' || key === '$and') {
        const parts = ((value || []) as Filter[])
          .map((sub) => {
            const inner = this.compileObject(sub);
            return inner.length ? `(${inner.join(' AND ')})` : null;
          })
          .filter(Boolean);
        if (!parts.length) continue;
        clauses.push(`(${parts.join(key === '$or' ? ' OR ' : ' AND ')})`);
        continue;
      }

      if (key === '$text') {
        clauses.push(this.compileText(value));
        continue;
      }

      if (key === '$expr' || key === '$where') {
        throw new Error(`Unsupported filter operator: ${key}`);
      }

      clauses.push(this.compileField(key, value));
    }
    return clauses.filter(Boolean);
  }

  compileText(value: { $search?: unknown } | null | undefined): string {
    const spec = this.model.textSearch;
    if (!spec) throw new Error(`Model ${this.model.modelName} has no text search column`);
    const terms = buildTsQueryTerms(value && value.$search);
    if (!terms.length) return 'FALSE';
    const p = this.builder.bind(terms.join(' | '));
    return `${this.alias}.${ident(spec.column)} @@ to_tsquery('${spec.config}', ${p})`;
  }

  // Resolves a filter path to a SQL expression, handling plain columns, JSON
  // paths inside an embedded object and arrays that live in a child table.
  compileField(path: string, condition: unknown): string {
    const child = this.model.resolveChildPath(path);
    if (child) return this.compileChild(child, condition);

    const target = this.model.resolveColumnPath(path);
    if (!target) throw new Error(`Unknown field "${path}" on model ${this.model.modelName}`);

    if (target.jsonPath) return this.compileJsonPath(target as ColumnTarget & { jsonPath: string[] }, condition);
    return this.compileColumn(target.def, `${this.alias}.${ident(target.def.column)}`, condition);
  }

  compileJsonPath(target: ColumnTarget & { jsonPath: string[] }, condition: unknown): string {
    const pathSql = target.jsonPath.map((k) => `'${k.replace(/'/g, "''")}'`).join(' -> ');
    const expr = `(${this.alias}.${ident(target.def.column)} #>> ARRAY[${target.jsonPath
      .map((k) => `'${k.replace(/'/g, "''")}'`)
      .join(', ')}])`;
    void pathSql;
    return this.compileColumn({ type: 'string' }, expr, condition);
  }

  compileColumn(def: FieldDef, expr: string, condition: unknown): string {
    if (condition === null) return `${expr} IS NULL`;

    if (!isPlainObject(condition)) {
      if (condition instanceof RegExp) return this.compileRegex(expr, condition);
      return `${expr} = ${this.builder.bind(toColumn(def, condition))}`;
    }

    const operators = Object.keys(condition).filter((k) => k.startsWith('$'));
    if (!operators.length) {
      // A bare object compared against a JSON column.
      return `${expr} = ${this.builder.bind(toColumn(def, condition))}`;
    }

    const parts: string[] = [];
    for (const op of operators) {
      const value = (condition as Record<string, any>)[op];
      switch (op) {
        case '$eq':
          parts.push(value === null ? `${expr} IS NULL` : `${expr} = ${this.builder.bind(toColumn(def, value))}`);
          break;
        case '$ne':
          parts.push(value === null
            ? `${expr} IS NOT NULL`
            : `(${expr} IS DISTINCT FROM ${this.builder.bind(toColumn(def, value))})`);
          break;
        case '$in': {
          const candidates = (value || []) as unknown[];
          const list = candidates.filter((v) => v !== null && v !== undefined);
          const hasNull = candidates.some((v) => v === null || v === undefined);
          if (!list.length) {
            parts.push(hasNull ? `${expr} IS NULL` : 'FALSE');
          } else {
            const inSql = `${expr} = ANY(${this.builder.bind(list.map((v) => toColumn(def, v)))})`;
            parts.push(hasNull ? `(${inSql} OR ${expr} IS NULL)` : inSql);
          }
          break;
        }
        case '$nin': {
          const list = ((value || []) as unknown[]).filter((v) => v !== null && v !== undefined);
          if (!list.length) parts.push('TRUE');
          else parts.push(`(${expr} <> ALL(${this.builder.bind(list.map((v) => toColumn(def, v)))}) OR ${expr} IS NULL)`);
          break;
        }
        case '$gt': case '$gte': case '$lt': case '$lte':
          parts.push(`${expr} ${COMPARATORS[op]} ${this.builder.bind(toColumn(def, value))}`);
          break;
        case '$exists':
          parts.push(value ? `${expr} IS NOT NULL` : `${expr} IS NULL`);
          break;
        case '$regex':
          parts.push(this.compileRegex(expr, value, condition.$options));
          break;
        case '$options':
          break;
        default:
          throw new Error(`Unsupported operator ${op}`);
      }
    }
    return parts.length ? `(${parts.join(' AND ')})` : 'TRUE';
  }

  compileRegex(expr: string, value: unknown, options?: string): string {
    const source = value instanceof RegExp ? value.source : String(value);
    const flags = value instanceof RegExp ? value.flags : (options || '');
    const operator = flags.includes('i') ? '~*' : '~';
    return `${expr} ${operator} ${this.builder.bind(source)}`;
  }

  // `{ participants: id }`, `{ readBy: { $ne: id } }`, `{ 'members.userId': id }`
  compileChild(resolved: ChildTarget, condition: unknown): string {
    const { child, field } = resolved;
    const sub = `${child.table}`;
    const column = (field ? field.column : child.valueColumn) as string;
    const def: FieldDef = field || { type: 'id' };

    const negate = isPlainObject(condition) && Object.keys(condition).length === 1 && '$ne' in condition;
    const effective = negate ? (condition as Record<string, unknown>).$ne : condition;

    const inner = this.compileColumn(def, `c.${ident(column)}`, negate ? effective : effective);
    const exists = `SELECT 1 FROM ${ident(sub)} c WHERE c.${ident(child.parentKey)} = ${this.alias}.id AND ${inner}`;
    return negate ? `NOT EXISTS (${exists})` : `EXISTS (${exists})`;
  }
}

// ---------------------------------------------------------------------------
// projection
// ---------------------------------------------------------------------------

function parseSelect(select: Projection): ParsedProjection | null {
  if (!select) return null;
  let fields: string[] = [];
  if (typeof select === 'string') fields = select.split(/\s+/).filter(Boolean);
  else if (Array.isArray(select)) fields = select.slice();
  else if (isPlainObject(select)) {
    for (const [k, v] of Object.entries(select)) {
      if (isPlainObject(v) && '$meta' in v) continue;
      fields.push(v ? k : `-${k}`);
    }
  }
  if (!fields.length) return null;
  const exclude = fields.filter((f) => f.startsWith('-')).map((f) => f.slice(1));
  const include = fields.filter((f) => !f.startsWith('-'));
  return { include, exclude };
}

function applyProjection(obj: Row, projection: ParsedProjection | null): Row {
  if (!projection) return obj;
  const { include, exclude } = projection;
  if (include.length) {
    const out: Row = {};
    if (obj._id !== undefined) out._id = obj._id;
    if (obj.id !== undefined) out.id = obj.id;
    for (const key of include) {
      if (obj[key] !== undefined) out[key] = obj[key];
    }
    if (obj.score !== undefined) out.score = obj.score;
    return out;
  }
  const out = { ...obj };
  for (const key of exclude) delete out[key];
  return out;
}

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

export class Document {
  /** Set through defineProperty so they stay non-enumerable. */
  readonly $model!: ModelRuntime;
  $isNew!: boolean;
  $snapshot!: Record<string, any> | null;
  $populated!: Record<string, any>;

  _id!: string;
  createdAt!: Date;
  updatedAt!: Date;
  /** Full-text rank, present only on $text queries. */
  score?: number;

  constructor(model: ModelRuntime, data: Row | null | undefined, isNew: boolean) {
    Object.defineProperty(this, '$model', { value: model, enumerable: false, writable: false });
    Object.defineProperty(this, '$isNew', { value: isNew, enumerable: false, writable: true });
    Object.defineProperty(this, '$snapshot', { value: null, enumerable: false, writable: true });
    Object.defineProperty(this, '$populated', { value: {}, enumerable: false, writable: true });

    if (isNew) {
      model.applyDefaults(this, data || {});
    } else {
      Object.assign(this, data);
      this.$snapshot = model.snapshotOf(this);
    }
  }

  get $id(): string {
    return this._id;
  }

  isModified(path?: string): boolean {
    if (this.$isNew) return true;
    if (!this.$snapshot) return true;
    if (!path) return !deepEqual(this.$snapshot, this.$model.snapshotOf(this as AnyDoc));
    return !deepEqual(this.$snapshot[path], deepClone((this as AnyDoc)[path]));
  }

  toObject(options: { virtuals?: boolean } = {}): Row {
    const model = this.$model;
    const self = this as AnyDoc;
    const out: Row = {};
    out._id = this._id;
    for (const name of model.fieldNames) {
      if (self[name] !== undefined) out[name] = deepClone(self[name]);
    }
    for (const name of model.childNames) {
      if (self[name] !== undefined) out[name] = deepClone(self[name]);
    }
    if (this.createdAt !== undefined) out.createdAt = this.createdAt;
    if (this.updatedAt !== undefined) out.updatedAt = this.updatedAt;
    if (this.score !== undefined) out.score = this.score;

    // Populated paths hold plain objects already; copy them verbatim.
    for (const path of Object.keys(this.$populated)) {
      out[path] = deepClone(this.$populated[path]);
    }

    const wantVirtuals = options.virtuals !== undefined ? options.virtuals : model.options.virtuals;
    if (wantVirtuals) {
      out.id = this._id;
      for (const [name, fn] of Object.entries(model.virtuals)) {
        out[name] = fn.call(self);
      }
    }
    return out;
  }

  toJSON(): Row {
    if (this.$model.methods.toJSON) return this.$model.methods.toJSON.call(this as AnyDoc) as Row;
    return this.toObject();
  }

  async save(): Promise<this> {
    return this.$model.saveDocument(this as AnyDoc) as Promise<this>;
  }

  async populate(path: string, select?: Projection): Promise<this> {
    await this.$model.populateDocuments([this as AnyDoc], [{ path, select }]);
    return this;
  }

  async deleteOne(): Promise<this> {
    await this.$model.deleteOne({ _id: this._id });
    return this;
  }
}

// ---------------------------------------------------------------------------
// Query
// ---------------------------------------------------------------------------

export class Query<TResult = unknown> implements PromiseLike<TResult> {
  model: ModelRuntime;
  op: QueryOp;
  filter: Filter;
  options: { select?: Projection; meta?: unknown };
  _select: Projection;
  _sort: string | Record<string, unknown> | null;
  _limit: number | null;
  _skip: number | null;
  _populate: PopulateSpec[];
  _lean: boolean;
  _meta: unknown;
  private _promise?: Promise<TResult>;

  constructor(
    model: ModelRuntime,
    op: QueryOp,
    filter?: Filter | null,
    options: { select?: Projection; meta?: unknown } = {}
  ) {
    this.model = model;
    this.op = op;
    this.filter = filter || {};
    this.options = options;
    this._select = options.select || null;
    this._sort = null;
    this._limit = null;
    this._skip = null;
    this._populate = [];
    this._lean = false;
    this._meta = options.meta || null;
  }

  select(value: Projection): this { this._select = value; return this; }
  sort(value: string | Record<string, unknown> | null): this { this._sort = value; return this; }
  limit(value: number | string | null): this { this._limit = value === null ? null : parseInt(String(value), 10); return this; }
  skip(value: number | string | null): this { this._skip = value === null ? null : parseInt(String(value), 10); return this; }

  /** Plain objects instead of documents; the shape is otherwise the same. */
  lean(): Query<LeanOf<TResult>> { this._lean = true; return this as unknown as Query<LeanOf<TResult>>; }

  populate(path: string | PopulateSpec | PopulateSpec[], select?: Projection): this {
    if (Array.isArray(path)) this._populate.push(...path);
    else if (isPlainObject(path)) this._populate.push(path as PopulateSpec);
    else this._populate.push({ path: path as string, select });
    return this;
  }

  exec(): Promise<TResult> {
    if (!this._promise) this._promise = this.model.runQuery(this) as Promise<TResult>;
    return this._promise;
  }

  then<TFulfilled = TResult, TRejected = never>(
    onFulfilled?: ((value: TResult) => TFulfilled | PromiseLike<TFulfilled>) | null,
    onRejected?: ((reason: any) => TRejected | PromiseLike<TRejected>) | null
  ): Promise<TFulfilled | TRejected> { return this.exec().then(onFulfilled, onRejected); }
  catch<TRejected = never>(
    onRejected?: ((reason: any) => TRejected | PromiseLike<TRejected>) | null
  ): Promise<TResult | TRejected> { return this.exec().catch(onRejected); }
  finally(onFinally?: (() => void) | null): Promise<TResult> { return this.exec().finally(onFinally); }
}

// findOneAndUpdate / findOneAndDelete return a chainable result rather than a
// bare promise, so callers can keep writing `.populate(...)` / `.select(...)`
// after them and only await at the end.
export class DeferredQuery<TResult = unknown> implements PromiseLike<TResult> {
  private _run: (chain: QueryChain) => Promise<TResult>;
  private _chain: QueryChain;
  private _promise?: Promise<TResult>;

  constructor(run: (chain: QueryChain) => Promise<TResult>) {
    this._run = run;
    this._chain = { select: null, populate: [], lean: false };
  }

  select(value: Projection): this { this._chain.select = value; return this; }
  lean(): DeferredQuery<LeanOf<TResult>> { this._chain.lean = true; return this as unknown as DeferredQuery<LeanOf<TResult>>; }

  populate(pathOrSpec: string | PopulateSpec | PopulateSpec[], select?: Projection): this {
    if (Array.isArray(pathOrSpec)) this._chain.populate.push(...pathOrSpec);
    else if (isPlainObject(pathOrSpec)) this._chain.populate.push(pathOrSpec as PopulateSpec);
    else this._chain.populate.push({ path: pathOrSpec as string, select });
    return this;
  }

  // Accepted and ignored: the result is always a single document.
  sort(): this { return this; }
  limit(): this { return this; }
  skip(): this { return this; }

  exec(): Promise<TResult> {
    if (!this._promise) this._promise = this._run(this._chain);
    return this._promise;
  }

  then<TFulfilled = TResult, TRejected = never>(
    onFulfilled?: ((value: TResult) => TFulfilled | PromiseLike<TFulfilled>) | null,
    onRejected?: ((reason: any) => TRejected | PromiseLike<TRejected>) | null
  ): Promise<TFulfilled | TRejected> { return this.exec().then(onFulfilled, onRejected); }
  catch<TRejected = never>(
    onRejected?: ((reason: any) => TRejected | PromiseLike<TRejected>) | null
  ): Promise<TResult | TRejected> { return this.exec().catch(onRejected); }
  finally(onFinally?: (() => void) | null): Promise<TResult> { return this.exec().finally(onFinally); }
}

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

class ModelRuntime {
  modelName: string;
  table: string;
  fields: Record<string, ResolvedFieldDef>;
  children: Record<string, ChildDef>;
  virtuals: Record<string, (this: AnyDoc) => unknown>;
  methods: Record<string, (this: AnyDoc, ...args: any[]) => any>;
  statics: Record<string, (...args: any[]) => any>;
  hooks: ModelHooks;
  textSearch: TextSearchDef | null;
  timestamps: boolean;
  options: ModelOptions;
  fieldNames: string[];
  childNames: string[];
  columnByField: Map<string, ResolvedFieldDef>;
  Document: new (model: ModelRuntime, data: Row | null | undefined, isNew: boolean) => AnyDoc;

  constructor(config: ModelConfig) {
    this.modelName = config.name;
    this.table = config.table;
    this.fields = config.fields as Record<string, ResolvedFieldDef>;
    this.children = config.children || {};
    this.virtuals = config.virtuals || {};
    this.methods = config.methods || {};
    this.statics = config.statics || {};
    this.hooks = config.hooks || {};
    this.textSearch = config.textSearch || null;
    this.timestamps = config.timestamps !== false;
    this.options = config.options || {};

    this.fieldNames = Object.keys(this.fields);
    this.childNames = Object.keys(this.children);
    this.columnByField = new Map<string, ResolvedFieldDef>();
    for (const [name, def] of Object.entries(this.fields)) {
      def.column = def.column || name;
      def.type = def.type || 'string';
      this.columnByField.set(name, def);
    }
    for (const child of Object.values(this.children)) {
      for (const def of Object.values(child.fields || {})) {
        def.type = def.type || 'string';
      }
    }

    this.Document = class extends Document {} as unknown as typeof this.Document;
    const proto = this.Document.prototype as unknown as Record<string, unknown>;
    for (const [name, fn] of Object.entries(this.methods)) {
      if (name === 'toJSON') continue;
      proto[name] = fn;
    }
    for (const [name, fn] of Object.entries(this.virtuals)) {
      Object.defineProperty(proto, name, { get: fn, configurable: true });
    }
  }

  // -- schema helpers -------------------------------------------------------

  resolveColumnPath(path: string): ColumnTarget | null {
    if (path === '_id' || path === 'id') return { def: { column: 'id', type: 'id' } };
    if (path === 'createdAt') return { def: { column: 'created_at', type: 'date' } };
    if (path === 'updatedAt') return { def: { column: 'updated_at', type: 'date' } };

    const direct = this.fields[path];
    if (direct) return { def: direct };

    const idx = path.indexOf('.');
    if (idx === -1) return null;
    const head = path.slice(0, idx);
    const def = this.fields[head];
    if (!def || def.type !== 'json') return null;
    return { def, jsonPath: path.slice(idx + 1).split('.') };
  }

  resolveChildPath(path: string): ChildTarget | null {
    const [head, ...rest] = path.split('.');
    const child = this.children[head];
    if (!child) return null;
    if (!rest.length) return { child, field: null };
    const field = (child.fields || {})[rest.join('.')];
    if (!field) return null;
    return { child, field };
  }

  // -- defaults / validation ------------------------------------------------

  applyDefaults(doc: AnyDoc, data: Row): void {
    doc._id = data._id ? (toId(data._id) as string) : generateId();

    for (const [name, def] of Object.entries(this.fields)) {
      let value = data[name];
      if (value === undefined && def.alias && data[def.alias] !== undefined) value = data[def.alias];

      if (value === undefined) {
        if (def.default !== undefined) {
          value = typeof def.default === 'function' ? def.default.call(doc) : deepClone(def.default);
        } else if (def.type === 'json') {
          value = null;
        } else if (def.type === 'stringArray') {
          value = [];
        } else {
          value = null;
        }
      } else if (def.type === 'json' && def.default !== undefined && isPlainObject(value)) {
        const base = typeof def.default === 'function' ? def.default.call(doc) : deepClone(def.default);
        value = mergeDefaults(base, value);
      }

      doc[name] = applySetters(def, value);
    }

    for (const [name, child] of Object.entries(this.children)) {
      const raw = data[name];
      doc[name] = Array.isArray(raw) ? raw.map((row) => this.normalizeChildRow(child, row)) : [];
    }

    if (this.timestamps) {
      doc.createdAt = data.createdAt ? (toDate(data.createdAt) as Date) : new Date();
      doc.updatedAt = data.updatedAt ? (toDate(data.updatedAt) as Date) : doc.createdAt;
    }
  }

  normalizeChildRow(child: ChildDef, row: any): any {
    if (child.scalar) return toId(row);
    const out: Row = {};
    if (child.ownId) out._id = row && row._id ? toId(row._id) : generateId();
    for (const [name, def] of Object.entries(child.fields || {})) {
      let value = row ? row[name] : undefined;
      if (value === undefined && def.default !== undefined) {
        value = typeof def.default === 'function' ? def.default() : deepClone(def.default);
      }
      if (value === undefined) value = null;
      out[name] = def.type === 'id' ? toId(value) : applySetters(def, value);
    }
    return out;
  }

  validate(doc: AnyDoc): void {
    for (const [name, def] of Object.entries(this.fields)) this.validateField(name, def, doc[name]);
  }

  /**
   * One field's declared constraints.
   *
   * These used to run only inside validate(), which only save() calls. Every
   * update path — findOneAndUpdate, updateOne, updateMany — wrote the value
   * straight to the column, so an `enum` declared on the model was advisory:
   * `Team.findOneAndUpdate(…, { role: 'owner' })` reached the database, and
   * only the table's CHECK constraint stood between that and owner rights.
   * Updates now go through the same check before any SQL is built.
   */
  validateField(name: string, def: FieldDef, value: unknown): void {
    if (def.required && (value === null || value === undefined || value === '')) {
      throw new ValidationError(`${this.modelName} validation failed: ${name}: Path \`${name}\` is required.`);
    }
    if (def.enum && value !== null && value !== undefined && !def.enum.includes(value)) {
      throw new ValidationError(
        `${this.modelName} validation failed: ${name}: \`${String(value)}\` is not a valid enum value for path \`${name}\`.`
      );
    }
    if (def.min !== undefined && typeof value === 'number' && value < def.min) {
      throw new ValidationError(`${this.modelName} validation failed: ${name}: Path \`${name}\` (${value}) is less than minimum allowed value (${def.min}).`);
    }
    if (def.max !== undefined && typeof value === 'number' && value > def.max) {
      throw new ValidationError(`${this.modelName} validation failed: ${name}: Path \`${name}\` (${value}) is more than maximum allowed value (${def.max}).`);
    }
  }

  snapshotOf(doc: AnyDoc): Record<string, any> {
    const snap: Row = {};
    for (const name of this.fieldNames) snap[name] = deepClone(doc[name]);
    for (const name of this.childNames) snap[name] = deepClone(doc[name]);
    if (this.timestamps) {
      snap.createdAt = doc.createdAt ? new Date(doc.createdAt.getTime ? doc.createdAt.getTime() : doc.createdAt) : null;
    }
    return snap;
  }

  // -- row <-> document -----------------------------------------------------

  hydrate(row: Row): AnyDoc {
    const data: Row = { _id: row.id };
    for (const [name, def] of Object.entries(this.fields)) {
      data[name] = fromColumn(def, row[def.column]);
    }
    if (this.timestamps) {
      data.createdAt = toDate(row.created_at);
      data.updatedAt = toDate(row.updated_at);
    }
    if (row.__score !== undefined && row.__score !== null) data.score = Number(row.__score);
    const doc = new this.Document(this, data, false);
    return doc;
  }

  // -- query execution ------------------------------------------------------

  async runQuery(q: Query<any>): Promise<any> {
    const builder = new SqlBuilder();
    const compiler = new FilterCompiler(this, builder, 't');
    const where = compiler.compile(q.filter);

    if (q.op === 'count') {
      const { rows } = await query<{ c: number }>(
        `SELECT count(*)::int AS c FROM ${ident(this.table)} t WHERE ${where}`,
        builder.params
      );
      return rows[0].c;
    }

    const selectParts: string[] = ['t.*'];
    if (this.textSearch && q.filter && q.filter.$text) {
      const terms = buildTsQueryTerms(q.filter.$text.$search);
      if (terms.length) {
        const p = builder.bind(terms.join(' | '));
        // Scaled so that a single matching term lands near 1, matching the
        // magnitude the code previously compared MongoDB's textScore against.
        selectParts.push(
          `ts_rank_cd(t.${ident(this.textSearch.column)}, to_tsquery('${this.textSearch.config}', ${p}), 0) * 10 AS __score`
        );
      }
    }

    const orderBy = this.buildOrderBy(q, builder);
    let sql = `SELECT ${selectParts.join(', ')} FROM ${ident(this.table)} t WHERE ${where}`;
    if (orderBy) sql += ` ORDER BY ${orderBy}`;

    const limit = q.op === 'findOne' ? 1 : q._limit;
    if (limit !== null && limit !== undefined) sql += ` LIMIT ${parseInt(String(limit), 10)}`;
    if (q._skip) sql += ` OFFSET ${parseInt(String(q._skip), 10)}`;

    const { rows } = await query(sql, builder.params);
    if (!rows.length) return q.op === 'findOne' ? null : [];

    const docs = rows.map((row) => this.hydrate(row));
    const projection = parseSelect(q._select);
    await this.loadChildren(docs, projection);
    if (q._populate.length) await this.populateDocuments(docs, q._populate);

    if (q._lean) {
      const plain = docs.map((d) => applyProjection(d.toObject(), projection));
      return q.op === 'findOne' ? plain[0] : plain;
    }

    if (projection) {
      for (const doc of docs) this.stripToProjection(doc, projection);
    }
    return q.op === 'findOne' ? docs[0] : docs;
  }

  stripToProjection(doc: AnyDoc, projection: ParsedProjection): void {
    const { include, exclude } = projection;
    if (include.length) {
      const keep = new Set(['_id', 'createdAt', 'updatedAt', 'score', ...include]);
      for (const name of [...this.fieldNames, ...this.childNames]) {
        if (!keep.has(name)) delete doc[name];
      }
    } else {
      for (const name of exclude) delete doc[name];
    }
  }

  buildOrderBy(q: Query<any>, builder: SqlBuilder): string | null {
    const sort = q._sort;
    if (!sort) {
      if (q.op === 'findOne' && !q._limit) return null;
      return null;
    }
    const parts: string[] = [];
    const push = (field: string, dir: unknown): void => {
      if (isPlainObject(dir) && '$meta' in dir) {
        if (this.textSearch) parts.push('__score DESC');
        return;
      }
      const target = this.resolveColumnPath(field);
      if (!target) return;
      const direction = Number(dir) < 0 ? 'DESC' : 'ASC';
      if (target.jsonPath) {
        const path = target.jsonPath.map((k) => `'${k.replace(/'/g, "''")}'`).join(', ');
        parts.push(`(t.${ident(target.def.column)} #>> ARRAY[${path}]) ${direction}`);
      } else {
        parts.push(`t.${ident(target.def.column)} ${direction} NULLS LAST`);
      }
    };

    if (typeof sort === 'string') {
      for (const token of sort.split(/\s+/).filter(Boolean)) {
        if (token.startsWith('-')) push(token.slice(1), -1);
        else push(token, 1);
      }
    } else if (isPlainObject(sort)) {
      for (const [field, dir] of Object.entries(sort)) push(field, dir);
    }
    void builder;
    return parts.length ? parts.join(', ') : null;
  }

  // Embedded arrays are fetched with one query per child table for the whole
  // result set, never per row.
  async loadChildren(docs: AnyDoc[], projection: ParsedProjection | null): Promise<void> {
    if (!this.childNames.length || !docs.length) return;
    const ids = docs.map((d) => d._id);
    const byId = new Map(docs.map((d) => [d._id, d]));

    for (const [name, child] of Object.entries(this.children)) {
      if (projection && projection.include.length && !projection.include.includes(name)) {
        for (const doc of docs) doc[name] = undefined;
        continue;
      }
      for (const doc of docs) doc[name] = [];

      const order = child.orderBy ? ` ORDER BY ${child.orderBy}` : '';
      const { rows } = await query(
        `SELECT * FROM ${ident(child.table)} WHERE ${ident(child.parentKey)} = ANY($1)${order}`,
        [ids]
      );

      for (const row of rows) {
        const doc = byId.get(row[child.parentKey]);
        if (!doc) continue;
        if (child.scalar) {
          doc[name].push(row[child.valueColumn as string]);
        } else {
          const item: Row = {};
          if (child.ownId) item._id = row.id;
          for (const [fname, def] of Object.entries(child.fields || {})) {
            item[fname] = fromColumn(def, row[def.column]);
          }
          doc[name].push(item);
        }
      }
      for (const doc of docs) {
        if (doc.$snapshot) doc.$snapshot[name] = deepClone(doc[name]);
      }
    }
  }

  // -- populate -------------------------------------------------------------

  async populateDocuments(docs: AnyDoc[], specs: PopulateSpec[]): Promise<void> {
    for (const spec of specs) {
      if (!spec || !spec.path) continue;
      await this.populatePath(docs, spec.path, spec.select);
    }
  }

  async populatePath(docs: AnyDoc[], path: string, select?: Projection): Promise<void> {
    const [head, ...rest] = path.split('.');
    const child = this.children[head];

    if (child && rest.length) {
      const fieldName = rest.join('.');
      const def = (child.fields || {})[fieldName];
      if (!def || (!def.ref && !def.refAny)) return;
      const ids: string[] = [];
      for (const doc of docs) {
        for (const item of doc[head] || []) {
          if (item && item[fieldName]) ids.push(toId(item[fieldName]) as string);
        }
      }
      const map = await this.fetchRefs(def, ids, select);
      for (const doc of docs) {
        for (const item of doc[head] || []) {
          const key = item && item[fieldName] ? toId(item[fieldName]) : null;
          if (key && map.has(key)) item[fieldName] = map.get(key);
        }
      }
      return;
    }

    if (child && child.scalar && child.ref) {
      const ids: string[] = [];
      for (const doc of docs) for (const v of doc[head] || []) if (v) ids.push(toId(v) as string);
      const map = await this.fetchRefs({ ref: child.ref }, ids, select);
      for (const doc of docs) {
        const list = (doc[head] || []) as unknown[];
        const replaced = list.map((v) => (v && map.has(toId(v) as string) ? map.get(toId(v) as string) : v));
        doc[head] = replaced;
        doc.$populated[head] = replaced;
      }
      return;
    }

    const def = this.fields[head];
    if (!def || (!def.ref && !def.refAny)) return;

    const ids: string[] = [];
    for (const doc of docs) {
      const raw = doc[head];
      if (raw) ids.push(toId(raw) as string);
    }
    const map = await this.fetchRefs(def, ids, select);
    for (const doc of docs) {
      const key = doc[head] ? toId(doc[head]) : null;
      if (key && map.has(key)) {
        doc[head] = map.get(key);
        doc.$populated[head] = doc[head];
      }
    }
  }

  // Loads referenced rows in a single round trip per target table.
  async fetchRefs(def: Pick<FieldDef, 'ref' | 'refAny'>, ids: string[], select?: Projection): Promise<Map<string, Row>> {
    const unique = [...new Set(ids.filter(Boolean))];
    const map = new Map<string, Row>();
    if (!unique.length) return map;

    const targets = (def.refAny ? def.refAny : [def.ref]) as string[];
    const projection = parseSelect(select);

    for (const target of targets) {
      const model = registry.get(target);
      if (!model) continue;
      const missing = unique.filter((id) => !map.has(id));
      if (!missing.length) break;

      const { rows } = await query(`SELECT * FROM ${ident(model.table)} WHERE id = ANY($1)`, [missing]);
      if (!rows.length) continue;

      const docs = rows.map((row) => model.hydrate(row));
      await model.loadChildren(docs, projection);
      for (const doc of docs) {
        map.set(doc._id, applyProjection(doc.toObject(), projection));
      }
    }
    return map;
  }

  // -- writes ---------------------------------------------------------------

  async saveDocument(doc: AnyDoc): Promise<AnyDoc> {
    if (this.hooks.preSave) await this.hooks.preSave.call(doc);
    this.validate(doc);

    if (doc.$isNew) {
      await withTransaction(async (client) => {
        const columns: string[] = ['id'];
        const values: unknown[] = [doc._id];
        for (const [name, def] of Object.entries(this.fields)) {
          columns.push(def.column);
          values.push(toColumn(def, doc[name]));
        }
        if (this.timestamps) {
          columns.push('created_at', 'updated_at');
          values.push(doc.createdAt || new Date(), doc.updatedAt || doc.createdAt || new Date());
        }
        const placeholders = values.map((_, i) => `$${i + 1}`);
        await client.query(
          `INSERT INTO ${ident(this.table)} (${columns.map(ident).join(', ')}) VALUES (${placeholders.join(', ')})`,
          values
        );
        await this.writeChildren(client, doc, null);
      });
      doc.$isNew = false;
      doc.$snapshot = this.snapshotOf(doc);
      return doc;
    }

    const snapshot: Record<string, any> = doc.$snapshot || {};
    const sets: string[] = [];
    const values: unknown[] = [];
    for (const [name, def] of Object.entries(this.fields)) {
      if (deepEqual(snapshot[name], doc[name])) continue;
      values.push(toColumn(def, applySetters(def, doc[name])));
      sets.push(`${ident(def.column)} = $${values.length}`);
    }

    const childrenChanged = this.childNames.some((name) => doc[name] !== undefined && !deepEqual(snapshot[name], doc[name]));

    if (!sets.length && !childrenChanged) return doc;

    await withTransaction(async (client) => {
      if (sets.length) {
        values.push(doc._id);
        await client.query(`UPDATE ${ident(this.table)} SET ${sets.join(', ')} WHERE id = $${values.length}`, values);
      }
      if (childrenChanged) await this.writeChildren(client, doc, snapshot);
    });

    if (this.timestamps) doc.updatedAt = new Date();
    doc.$snapshot = this.snapshotOf(doc);
    return doc;
  }

  async writeChildren(client: PoolClient, doc: AnyDoc, snapshot: Record<string, any> | null): Promise<void> {
    for (const [name, child] of Object.entries(this.children)) {
      const rows = doc[name];
      if (rows === undefined) continue;
      if (snapshot && deepEqual(snapshot[name], rows)) continue;

      await client.query(`DELETE FROM ${ident(child.table)} WHERE ${ident(child.parentKey)} = $1`, [doc._id]);
      if (!rows.length) continue;

      const seen = new Set<unknown>();
      for (const raw of rows) {
        const item = this.normalizeChildRow(child, raw);
        if (child.scalar) {
          if (!item || seen.has(item)) continue;
          seen.add(item);
          await client.query(
            `INSERT INTO ${ident(child.table)} (${ident(child.parentKey)}, ${ident(child.valueColumn as string)}) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [doc._id, item]
          );
          continue;
        }
        const columns: string[] = [child.parentKey];
        const vals: unknown[] = [doc._id];
        if (child.ownId) { columns.push('id'); vals.push(item._id); }
        for (const [fname, def] of Object.entries(child.fields || {})) {
          columns.push(def.column);
          vals.push(toColumn(def, item[fname]));
        }
        await client.query(
          `INSERT INTO ${ident(child.table)} (${columns.map(ident).join(', ')}) VALUES (${vals.map((_, i) => `$${i + 1}`).join(', ')}) ON CONFLICT DO NOTHING`,
          vals
        );
      }
    }
  }

  // Translates $set / $inc / $addToSet / $pull into SQL.
  parseUpdate(update: UpdateSpec | null | undefined): ParsedUpdate {
    const set: Record<string, any> = {};
    const inc: Record<string, any> = {};
    const addToSet: Record<string, any> = {};
    const pull: Record<string, any> = {};

    for (const [key, value] of Object.entries(update || {})) {
      if (key === '$set') Object.assign(set, value);
      else if (key === '$inc') Object.assign(inc, value);
      else if (key === '$addToSet') Object.assign(addToSet, value);
      else if (key === '$pull') Object.assign(pull, value);
      else if (key === '$unset') { for (const k of Object.keys(value as object)) set[k] = null; }
      else if (!key.startsWith('$')) set[key] = value;
      else throw new Error(`Unsupported update operator ${key}`);
    }

    return { set, inc, addToSet, pull };
  }

  touchesChildTables(ops: ParsedUpdate): boolean {
    return Object.keys(ops.addToSet).length > 0 || Object.keys(ops.pull).length > 0;
  }

  // Turns $set / $inc into one assignment per column.
  buildSetClause(ops: ParsedUpdate): { sets: string[]; values: unknown[] } {
    const { set, inc } = ops;

    // A column may be touched by several paths at once — for example
    // $inc on both stats.activeConversations and stats.resolvedConversations.
    // PostgreSQL allows one assignment per column per UPDATE, so every operation
    // on a column is folded into a single expression.
    const values: unknown[] = [];
    const plainAssignments = new Map<string, string>();
    const jsonPatches = new Map<string, JsonPatch[]>();

    const addJsonPatch = (column: string, patch: JsonPatch): void => {
      if (!jsonPatches.has(column)) jsonPatches.set(column, []);
      (jsonPatches.get(column) as JsonPatch[]).push(patch);
    };
    const pathLiteralOf = (segments: string[]): string => segments.map((k) => `'${k.replace(/'/g, "''")}'`).join(', ');

    for (const [path, value] of Object.entries(set)) {
      if (value === undefined) continue;
      const child = this.resolveChildPath(path);
      if (child && !child.field) continue;
      const target = this.resolveColumnPath(path);
      if (!target) continue;
      if (target.jsonPath) {
        addJsonPatch(target.def.column, { kind: 'set', path: target.jsonPath, value });
        continue;
      }
      // The same constraints save() enforces; see validateField.
      if (this.fields[path]) this.validateField(path, target.def, applySetters(target.def, value));
      values.push(toColumn(target.def, applySetters(target.def, value)));
      plainAssignments.set(target.def.column, `$${values.length}`);
    }

    for (const [path, delta] of Object.entries(inc)) {
      const target = this.resolveColumnPath(path);
      if (!target) continue;
      if (target.jsonPath) {
        addJsonPatch(target.def.column, { kind: 'inc', path: target.jsonPath, value: Number(delta) });
        continue;
      }
      values.push(Number(delta));
      const column = ident(target.def.column);
      // Increment whatever the same statement is already assigning, if anything.
      const base = plainAssignments.get(target.def.column) || `coalesce(${column}, 0)`;
      plainAssignments.set(target.def.column, `${base} + $${values.length}`);
    }

    const sets: string[] = [];
    for (const [rawColumn, expression] of plainAssignments.entries()) {
      sets.push(`${ident(rawColumn)} = ${expression}`);
    }

    for (const [rawColumn, patches] of jsonPatches.entries()) {
      const column = ident(rawColumn);
      let expr = `coalesce(${column}, '{}'::jsonb)`;
      for (const patch of patches) {
        const pathLiteral = pathLiteralOf(patch.path);
        if (patch.kind === 'inc') {
          values.push(Number(patch.value));
          expr =
            `jsonb_set(${expr}, ARRAY[${pathLiteral}], ` +
            `to_jsonb(coalesce((${expr} #>> ARRAY[${pathLiteral}])::numeric, 0) + $${values.length}), true)`;
        } else {
          values.push(JSON.stringify(patch.value === undefined ? null : patch.value));
          expr = `jsonb_set(${expr}, ARRAY[${pathLiteral}], $${values.length}::jsonb, true)`;
        }
      }
      sets.push(`${column} = ${expr}`);
    }

    return { sets, values };
  }

  // A single statement for updates that do not touch a child table.
  async updateMatchingReturning(
    filter: Filter,
    ops: ParsedUpdate,
    limit: number | null,
    returning: 'full' | 'id' = 'full'
  ): Promise<Row[]> {
    const { sets, values } = this.buildSetClause(ops);
    if (!sets.length) return [];

    // The filter binds after the SET parameters so the numbering stays in order.
    const builder = new SqlBuilder();
    builder.params = values;
    const compiler = new FilterCompiler(this, builder, 's');
    const where = compiler.compile(filter);
    const limitClause = limit ? ` LIMIT ${parseInt(String(limit), 10)}` : '';

    const sql =
      `UPDATE ${ident(this.table)} AS t SET ${sets.join(', ')} ` +
      `WHERE t.id IN (SELECT s.id FROM ${ident(this.table)} s WHERE ${where}${limitClause}) ` +
      `RETURNING ${returning === 'id' ? 't.id' : 't.*'}`;

    const { rows } = await query(sql, builder.params);
    return rows;
  }

  async applyUpdate(ids: string[], update: UpdateSpec): Promise<void> {
    if (!ids.length) return;
    const ops = this.parseUpdate(update);
    const { addToSet, pull } = ops;
    const { sets, values } = this.buildSetClause(ops);

    await withTransaction(async (client) => {
      if (sets.length) {
        values.push(ids);
        await client.query(`UPDATE ${ident(this.table)} SET ${sets.join(', ')} WHERE id = ANY($${values.length})`, values);
      }

      for (const [path, value] of Object.entries(addToSet)) {
        const child = this.children[path];
        if (!child) continue;
        const entries: unknown[] = isPlainObject(value) && '$each' in value ? value.$each : [value];
        for (const entry of entries) {
          const item = this.normalizeChildRow(child, entry);
          for (const id of ids) {
            if (child.scalar) {
              await client.query(
                `INSERT INTO ${ident(child.table)} (${ident(child.parentKey)}, ${ident(child.valueColumn as string)}) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                [id, item]
              );
              continue;
            }
            const columns: string[] = [child.parentKey];
            const vals: unknown[] = [id];
            if (child.ownId) { columns.push('id'); vals.push(item._id); }
            for (const [fname, def] of Object.entries(child.fields || {})) {
              columns.push(def.column);
              vals.push(toColumn(def, item[fname]));
            }
            await client.query(
              `INSERT INTO ${ident(child.table)} (${columns.map(ident).join(', ')}) VALUES (${vals.map((_, i) => `$${i + 1}`).join(', ')}) ON CONFLICT DO NOTHING`,
              vals
            );
          }
        }
      }

      for (const [path, criteria] of Object.entries(pull)) {
        const child = this.children[path];
        if (!child) continue;
        const conditions: string[] = [`${ident(child.parentKey)} = ANY($1)`];
        const vals: unknown[] = [ids];
        if (child.scalar) {
          vals.push(toId(criteria));
          conditions.push(`${ident(child.valueColumn as string)} = $${vals.length}`);
        } else {
          for (const [fname, fvalue] of Object.entries((criteria || {}) as Record<string, unknown>)) {
            const def = (child.fields || {})[fname];
            if (!def) continue;
            vals.push(toColumn(def, fvalue));
            conditions.push(`${ident(def.column)} = $${vals.length}`);
          }
        }
        await client.query(`DELETE FROM ${ident(child.table)} WHERE ${conditions.join(' AND ')}`, vals);
      }
    });
  }

  // Applies a collected chain (select / populate / lean) to a query.
  applyChain<T>(q: Query<T>, chain: QueryChain): Promise<any> {
    if (chain.select) q.select(chain.select);
    for (const spec of chain.populate) q.populate(spec);
    if (chain.lean) q.lean();
    return q.exec();
  }

  // Builds the document straight from an UPDATE ... RETURNING row.
  async hydrateWithChain(row: Row, chain: QueryChain): Promise<any> {
    const doc = this.hydrate(row);
    const projection = parseSelect(chain.select);
    await this.loadChildren([doc], projection);
    if (chain.populate.length) await this.populateDocuments([doc], chain.populate);
    if (chain.lean) return applyProjection(doc.toObject(), projection);
    if (projection) this.stripToProjection(doc, projection);
    return doc;
  }

  async idsMatching(filter: Filter, limit?: number | null): Promise<string[]> {
    const builder = new SqlBuilder();
    const compiler = new FilterCompiler(this, builder, 't');
    const where = compiler.compile(filter);
    let sql = `SELECT t.id FROM ${ident(this.table)} t WHERE ${where}`;
    if (limit) sql += ` LIMIT ${parseInt(String(limit), 10)}`;
    const { rows } = await query<{ id: string }>(sql, builder.params);
    return rows.map((r) => r.id);
  }

  // -- public API -----------------------------------------------------------

  find(filter?: Filter | null, projection?: Projection): Query<AnyDoc[]> {
    return new Query<AnyDoc[]>(this, 'find', filter, { select: projection });
  }

  findOne(filter?: Filter | null, projection?: Projection): Query<AnyDoc | null> {
    return new Query<AnyDoc | null>(this, 'findOne', filter, { select: projection });
  }

  findById(id: unknown, projection?: Projection): Query<AnyDoc | null> {
    const key = toId(id);
    if (!key) return new Query<AnyDoc | null>(this, 'findOne', { _id: null }, { select: projection });
    return new Query<AnyDoc | null>(this, 'findOne', { _id: key }, { select: projection });
  }

  countDocuments(filter?: Filter | null): Query<number> {
    return new Query<number>(this, 'count', filter);
  }

  estimatedDocumentCount(): Query<number> {
    return new Query<number>(this, 'count', {});
  }

  async create(data: Row | Row[]): Promise<any> {
    if (Array.isArray(data)) {
      const out: AnyDoc[] = [];
      for (const item of data) out.push(await this.create(item));
      return out;
    }
    const doc = new this.Document(this, data, true);
    await this.saveDocument(doc);
    return doc;
  }

  findOneAndUpdate(filter: Filter, update: UpdateSpec, options: UpdateOptions = {}): DeferredQuery<AnyDoc | null> {
    return new DeferredQuery<AnyDoc | null>((chain) => this.runFindOneAndUpdate(filter, update, options, chain));
  }

  async runFindOneAndUpdate(
    filter: Filter,
    update: UpdateSpec,
    options: UpdateOptions,
    chain: QueryChain
  ): Promise<AnyDoc | null> {
    const ops = this.parseUpdate(update);

    if (!this.touchesChildTables(ops)) {
      // One statement does the match and the write together.
      const rows = await this.updateMatchingReturning(filter, ops, 1);
      if (rows.length) return options.new === false ? null : this.hydrateWithChain(rows[0], chain);
    }

    const ids = await this.idsMatching(filter, 1);
    if (ids.length) {
      await this.applyUpdate(ids, update);
      if (options.new === false) return null;
      return this.applyChain(this.findById(ids[0]), chain);
    }

    {
      if (!options.upsert) return null;
      // Seed the new row from the filter's equality conditions, exactly the way
      // an upsert did before.
      const seed: Row = {};
      for (const [key, value] of Object.entries(filter || {})) {
        if (key.startsWith('$') || isPlainObject(value)) continue;
        seed[key === '_id' ? '_id' : key] = value;
      }
      const setPart = update && update.$set ? update.$set : {};
      const plain: Row = {};
      for (const [key, value] of Object.entries(update || {})) {
        if (!key.startsWith('$')) plain[key] = value;
      }
      const doc = new this.Document(this, { ...seed, ...plain, ...setPart }, true);

      if (update && update.$inc) {
        for (const [path, delta] of Object.entries(update.$inc)) {
          const target = this.resolveColumnPath(path);
          if (!target) continue;
          if (target.jsonPath) {
            const jsonFieldName = Object.keys(this.fields).find((n) => this.fields[n].column === target.def.column) as string;
            let cursor = doc[jsonFieldName];
            if (!isPlainObject(cursor)) cursor = {};
            let node = cursor;
            for (let i = 0; i < target.jsonPath.length - 1; i += 1) {
              const k = target.jsonPath[i];
              if (!isPlainObject(node[k])) node[k] = {};
              node = node[k];
            }
            const last = target.jsonPath[target.jsonPath.length - 1];
            node[last] = (Number(node[last]) || 0) + Number(delta);
          } else {
            const fieldName = Object.keys(this.fields).find((n) => this.fields[n].column === target.def.column);
            if (fieldName) doc[fieldName] = (Number(doc[fieldName]) || 0) + Number(delta);
          }
        }
      }
      await this.saveDocument(doc);
      if (options.new === false) return null;
      if (!chain.populate.length && !chain.select && !chain.lean) return doc;
      return this.applyChain(this.findById(doc._id), chain);
    }
  }

  findByIdAndUpdate(id: unknown, update: UpdateSpec, options: UpdateOptions = {}): DeferredQuery<AnyDoc | null> {
    const key = toId(id);
    return new DeferredQuery<AnyDoc | null>((chain) => {
      if (!key) return Promise.resolve(null);
      return this.runFindOneAndUpdate({ _id: key }, update, options, chain);
    });
  }

  async updateMany(filter: Filter, update: UpdateSpec): Promise<UpdateResult> {
    const ops = this.parseUpdate(update);
    if (!this.touchesChildTables(ops)) {
      const rows = await this.updateMatchingReturning(filter, ops, null, 'id');
      return { matchedCount: rows.length, modifiedCount: rows.length, acknowledged: true };
    }
    const ids = await this.idsMatching(filter);
    await this.applyUpdate(ids, update);
    return { matchedCount: ids.length, modifiedCount: ids.length, acknowledged: true };
  }

  async updateOne(filter: Filter, update: UpdateSpec): Promise<UpdateResult> {
    const ops = this.parseUpdate(update);
    if (!this.touchesChildTables(ops)) {
      const rows = await this.updateMatchingReturning(filter, ops, 1, 'id');
      return { matchedCount: rows.length, modifiedCount: rows.length, acknowledged: true };
    }
    const ids = await this.idsMatching(filter, 1);
    await this.applyUpdate(ids, update);
    return { matchedCount: ids.length, modifiedCount: ids.length, acknowledged: true };
  }

  findOneAndDelete(filter: Filter): DeferredQuery<AnyDoc | null> {
    return new DeferredQuery<AnyDoc | null>(async (chain) => {
      const doc = await this.applyChain(this.findOne(filter), chain);
      if (!doc) return null;
      await query(`DELETE FROM ${ident(this.table)} WHERE id = $1`, [doc._id]);
      return doc;
    });
  }

  findByIdAndDelete(id: unknown): DeferredQuery<AnyDoc | null> {
    const key = toId(id);
    return new DeferredQuery<AnyDoc | null>((chain) => {
      if (!key) return Promise.resolve(null);
      return this.findOneAndDelete({ _id: key })
        .populate(chain.populate)
        .select(chain.select)
        .exec();
    });
  }

  async deleteMany(filter: Filter): Promise<DeleteResult> {
    const builder = new SqlBuilder();
    const compiler = new FilterCompiler(this, builder, 't');
    const where = compiler.compile(filter);
    const { rowCount } = await query(`DELETE FROM ${ident(this.table)} t WHERE ${where}`, builder.params);
    return { deletedCount: rowCount ?? 0, acknowledged: true };
  }

  async deleteOne(filter: Filter): Promise<DeleteResult> {
    const ids = await this.idsMatching(filter, 1);
    if (!ids.length) return { deletedCount: 0, acknowledged: true };
    const { rowCount } = await query(`DELETE FROM ${ident(this.table)} WHERE id = $1`, [ids[0]]);
    return { deletedCount: rowCount ?? 0, acknowledged: true };
  }
}

// ---------------------------------------------------------------------------
// factory
// ---------------------------------------------------------------------------

export function defineModel<TFields = Record<string, unknown>, TStatics = Record<string, never>>(
  config: ModelConfig
): Model<TFields, TStatics> {
  const model = new ModelRuntime(config);

  // The exported value is callable with `new Model(data)` while still carrying
  // every static the old Mongoose models exposed.
  function ExportedCtor(this: unknown, data?: Row): AnyDoc {
    if (!(this instanceof ExportedCtor)) return new (ExportedCtor as unknown as new (d?: Row) => AnyDoc)(data);
    return new model.Document(model, data, true);
  }
  const Exported = ExportedCtor as unknown as Record<string, any> & { prototype: unknown };

  Exported.prototype = model.Document.prototype;

  const statics = [
    'find', 'findOne', 'findById', 'countDocuments', 'estimatedDocumentCount', 'create',
    'findOneAndUpdate', 'findByIdAndUpdate', 'updateMany', 'updateOne',
    'findOneAndDelete', 'findByIdAndDelete', 'deleteMany', 'deleteOne'
  ] as const;
  const runtime = model as unknown as Record<string, (...args: any[]) => unknown>;
  for (const name of statics) {
    Exported[name] = runtime[name].bind(model);
  }
  for (const [name, fn] of Object.entries(model.statics)) {
    Exported[name] = fn;
  }

  Exported.modelName = model.modelName;
  Exported.table = model.table;
  Exported.$model = model;

  registry.set(model.modelName, model);
  return Exported as unknown as Model<TFields, TStatics>;
}

export function getModel(name: string): ModelRuntime | undefined {
  return registry.get(name);
}

export { registry, getPool, ModelRuntime };