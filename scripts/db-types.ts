import type { PGlite } from "@electric-sql/pglite";

/**
 * Génère les types TypeScript du schéma public au format attendu par supabase-js
 * (`Database`), en inspectant une base où les migrations sont appliquées.
 * Remplace `supabase gen types` tant que Docker n'est pas disponible ; les deux sorties
 * sont compatibles.
 */

type ColumnRow = {
  table_name: string;
  column_name: string;
  is_nullable: "YES" | "NO";
  column_default: string | null;
  is_identity: "YES" | "NO";
  identity_generation: "ALWAYS" | "BY DEFAULT" | null;
  is_generated: "ALWAYS" | "NEVER";
  data_type: string;
  udt_name: string;
};

type RelationshipRow = {
  table_name: string;
  foreign_key_name: string;
  columns: string[];
  referenced_relation: string;
  referenced_columns: string[];
  is_one_to_one: boolean;
};

type FunctionRow = {
  name: string;
  argument_names: string[] | null;
  /** i : entrée · o, t : colonne de sortie (returns table) ; vide si tous les arguments sont en entrée. */
  argument_modes: string[];
  argument_types: string[];
  return_type: string;
  returns_set: boolean;
  /** Les N derniers arguments d'entrée ont une valeur par défaut : facultatifs à l'appel. */
  default_count: number;
};

const OUTPUT_MODES = new Set(["o", "t"]);

const STRING_TYPES = new Set([
  "uuid",
  "text",
  "character varying",
  "character",
  "inet",
  "date",
  "timestamp with time zone",
  "timestamp without time zone",
  "time without time zone",
  "interval",
]);
const NUMBER_TYPES = new Set(["smallint", "integer", "bigint", "numeric", "real", "double precision"]);

function tsType(pgType: string, enums: ReadonlySet<string>): string {
  if (pgType.endsWith("[]")) return `${tsType(pgType.slice(0, -2), enums)}[]`;
  if (STRING_TYPES.has(pgType)) return "string";
  if (NUMBER_TYPES.has(pgType)) return "number";
  if (pgType === "boolean") return "boolean";
  if (pgType === "json" || pgType === "jsonb") return "Json";
  if (pgType === "void") return "undefined";
  if (enums.has(pgType)) return `Database["public"]["Enums"]["${pgType}"]`;
  throw new Error(`Type PostgreSQL non pris en charge par le générateur : ${pgType}`);
}

const columnType = (column: ColumnRow, enums: ReadonlySet<string>) =>
  tsType(column.data_type === "USER-DEFINED" ? column.udt_name : column.data_type, enums);

const quote = (values: readonly string[]) => `[${values.map((value) => `"${value}"`).join(", ")}]`;

function renderColumns(columns: readonly ColumnRow[], enums: ReadonlySet<string>, mode: "Row" | "Insert" | "Update") {
  return columns
    .map((column) => {
      const type = columnType(column, enums);
      const nullable = column.is_nullable === "YES" ? `${type} | null` : type;
      const isGeneratedAlways = column.is_generated === "ALWAYS" || column.identity_generation === "ALWAYS";
      if (mode === "Row") return `          ${column.column_name}: ${nullable};`;
      if (isGeneratedAlways) return `          ${column.column_name}?: never;`;
      const isOptional =
        mode === "Update" || column.is_nullable === "YES" || column.column_default !== null || column.is_identity === "YES";
      return `          ${column.column_name}${isOptional ? "?" : ""}: ${nullable};`;
    })
    .join("\n");
}

function renderRelationships(relationships: readonly RelationshipRow[]) {
  if (relationships.length === 0) return "[]";
  const items = relationships.map(
    (relationship) => `          {
            foreignKeyName: "${relationship.foreign_key_name}";
            columns: ${quote(relationship.columns)};
            isOneToOne: ${relationship.is_one_to_one};
            referencedRelation: "${relationship.referenced_relation}";
            referencedColumns: ${quote(relationship.referenced_columns)};
          },`,
  );
  return `[\n${items.join("\n")}\n        ]`;
}

function renderTables(columns: readonly ColumnRow[], relationships: readonly RelationshipRow[], enums: ReadonlySet<string>) {
  const tables = [...new Set(columns.map((column) => column.table_name))].sort();
  return tables
    .map((table) => {
      const tableColumns = columns.filter((column) => column.table_name === table);
      const tableRelationships = relationships.filter((relationship) => relationship.table_name === table);
      return `      ${table}: {
        Row: {
${renderColumns(tableColumns, enums, "Row")}
        };
        Insert: {
${renderColumns(tableColumns, enums, "Insert")}
        };
        Update: {
${renderColumns(tableColumns, enums, "Update")}
        };
        Relationships: ${renderRelationships(tableRelationships)};
      };`;
    })
    .join("\n");
}

function renderFunctions(functions: readonly FunctionRow[], enums: ReadonlySet<string>, tables: ReadonlySet<string>) {
  // « returns setof <table> » : une ligne de la table, comme le générateur de Supabase.
  const returnType = (pgType: string) =>
    tables.has(pgType) ? `Database["public"]["Tables"]["${pgType}"]["Row"]` : tsType(pgType, enums);
  return functions
    .map((fn) => {
      const params = fn.argument_types.map((type, index) => ({
        name: fn.argument_names?.[index] ?? `arg${index}`,
        type: tsType(type, enums),
        isOutput: OUTPUT_MODES.has(fn.argument_modes[index] ?? "i"),
        isOptional: false,
      }));
      const render = (list: typeof params) =>
        list.map((param) => `${param.name}${param.isOptional ? "?" : ""}: ${param.type}`).join("; ");
      const outputs = params.filter((param) => param.isOutput);
      // returns table (…) : un tableau d'objets, comme le générateur de Supabase.
      const returned = outputs.length > 0 ? `{ ${render(outputs)} }` : returnType(fn.return_type);
      const inputs = params
        .filter((param) => !param.isOutput)
        .map((param, index, all) => ({ ...param, isOptional: index >= all.length - fn.default_count }));
      return `      ${fn.name}: {
        Args: ${inputs.length > 0 ? `{ ${render(inputs)} }` : "Record<PropertyKey, never>"};
        Returns: ${returned}${fn.returns_set ? "[]" : ""};
      };`;
    })
    .join("\n");
}

function renderEnums(enumRows: ReadonlyArray<{ name: string; labels: string[] }>) {
  return enumRows
    .map((row) => `      ${row.name}: ${row.labels.map((label) => `"${label}"`).join(" | ")};`)
    .join("\n");
}

const HEADER = `// Généré par \`npm run db:types:local\` à partir de supabase/migrations — ne pas modifier à la main.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
`;

const HELPERS = `
type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"];
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];
`;

export async function renderDatabaseTypes(db: PGlite): Promise<string> {
  const enumRows = (
    await db.query<{ name: string; labels: string[] }>(
      `select t.typname as name, array_agg(e.enumlabel order by e.enumsortorder) as labels
       from pg_type t join pg_enum e on e.enumtypid = t.oid join pg_namespace n on n.oid = t.typnamespace
       where n.nspname = 'public' group by t.typname order by 1`,
    )
  ).rows;
  const enums = new Set(enumRows.map((row) => row.name));

  const columns = (
    await db.query<ColumnRow>(
      `select c.table_name, c.column_name, c.is_nullable, c.column_default, c.is_identity, c.identity_generation,
              c.is_generated, c.data_type, c.udt_name
       from information_schema.columns c
       join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
       where c.table_schema = 'public' and t.table_type = 'BASE TABLE'
       order by c.table_name, c.column_name`,
    )
  ).rows;

  const relationships = (
    await db.query<RelationshipRow>(
      `select rel.relname as table_name, con.conname as foreign_key_name,
              array(select att.attname::text from unnest(con.conkey) with ordinality k(attnum, ord)
                    join pg_attribute att on att.attrelid = con.conrelid and att.attnum = k.attnum order by k.ord) as columns,
              frel.relname as referenced_relation,
              array(select att.attname::text from unnest(con.confkey) with ordinality k(attnum, ord)
                    join pg_attribute att on att.attrelid = con.confrelid and att.attnum = k.attnum order by k.ord) as referenced_columns,
              exists (
                select 1 from pg_index i
                where i.indrelid = con.conrelid and i.indisunique and i.indpred is null
                  and (select array_agg(x order by x) from unnest(string_to_array(i.indkey::text, ' ')::int2[]) x)
                    = (select array_agg(x order by x) from unnest(con.conkey) x)
              ) as is_one_to_one
       from pg_constraint con
       join pg_class rel on rel.oid = con.conrelid
       join pg_class frel on frel.oid = con.confrelid
       join pg_namespace n on n.oid = rel.relnamespace
       join pg_namespace fn on fn.oid = frel.relnamespace
       where con.contype = 'f' and n.nspname = 'public' and fn.nspname = 'public'
       order by rel.relname, con.conname`,
    )
  ).rows;

  const functions = (
    await db.query<FunctionRow>(
      `select p.proname as name, p.proargnames as argument_names,
              coalesce(p.proargmodes::text[], '{}') as argument_modes,
              coalesce((select array_agg(format_type(t, null) order by ord)
                        from unnest(coalesce(p.proallargtypes, p.proargtypes::oid[])) with ordinality u(t, ord)), '{}')
                as argument_types,
              format_type(p.prorettype, null) as return_type, p.proretset as returns_set,
              p.pronargdefaults::int as default_count
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.prokind = 'f'
       order by p.proname`,
    )
  ).rows;

  return `${HEADER}
export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "12";
  };
  public: {
    Tables: {
${renderTables(columns, relationships, enums)}
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
${renderFunctions(functions, enums, new Set(columns.map((column) => column.table_name)))}
    };
    Enums: {
${renderEnums(enumRows)}
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
${HELPERS}`;
}
