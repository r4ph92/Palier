import { sql, type AnyColumn, type SQL } from 'drizzle-orm';

// canonicalSpotNumber in SQL, shared by the spot lookup and its index so the planner can use one for the other.
export function canonicalNumberOf(number: AnyColumn): SQL {
  return sql`upper(regexp_replace(${number}, '[[:space:]–—-]', '', 'g'))`;
}
