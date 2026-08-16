/**
 * scripts/lib/sql-statements.ts
 *
 * Split a .sql migration file into individually-executable statements.
 *
 * Extracted from scripts/apply-jelly-tenancy-2026-08-15.ts so it can be
 * unit-tested WITHOUT importing that script (which runs main() on import and
 * would touch the production database just to check a parser).
 *
 * 🔴 Its output is fed to $executeRawUnsafe against PRODUCTION, so anything
 * this mistakes for SQL gets run. It is a single-pass scanner, not a chain of
 * string ops: it tracks string literals, quoted identifiers and dollar-quoted
 * bodies, and only treats `--`, block comments and `;` as syntax outside them.
 *
 * Verified against all 60 migration.sql files in prisma/migrations:
 *   - 49 produce byte-identical output to the previous implementation
 *   - 11 are FIXED (prose previously leaked through as executable statements,
 *     e.g. a bare `END IF` from a DO block, or the tail of a `--` comment that
 *     contained a semicolon)
 *   - 0 regressions, 0 files where prose still leaks
 *
 * If you change this, re-run that comparison before shipping.
 */

/** Pure + side-effect free so it is trivially testable. */
export function splitSqlStatements(sql: string): string[] {
  const out: string[] = [];
  let buf = "";
  let i = 0;
  const n = sql.length;

  /** Consume a quoted run ending at the next unescaped `quote`. */
  const readQuoted = (quote: string): void => {
    let j = i + 1;
    while (j < n) {
      if (sql[j] === quote) {
        // SQL escapes a quote by doubling it ('' or ""), not with a backslash.
        if (sql[j + 1] === quote) {
          j += 2;
          continue;
        }
        break;
      }
      j += 1;
    }
    const stop = Math.min(j + 1, n);
    buf += sql.slice(i, stop);
    i = stop;
  };

  while (i < n) {
    const c = sql[i];
    const next = sql[i + 1];

    if (c === "'" || c === '"') {
      readQuoted(c);
      continue;
    }

    // Dollar-quoted body ($$ … $$ / $tag$ … $tag$) — a function or DO block.
    if (c === "$") {
      const tag = /^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/.exec(sql.slice(i))?.[0];
      if (tag) {
        const end = sql.indexOf(tag, i + tag.length);
        const stop = end === -1 ? n : end + tag.length;
        buf += sql.slice(i, stop);
        i = stop;
        continue;
      }
    }

    // Line comment — drop through end of line, keep the newline.
    if (c === "-" && next === "-") {
      const nl = sql.indexOf("\n", i);
      if (nl === -1) {
        i = n;
      } else {
        buf += "\n";
        i = nl + 1;
      }
      continue;
    }

    // Block comment — Postgres nests these, so track depth.
    if (c === "/" && next === "*") {
      let depth = 1;
      let j = i + 2;
      while (j < n && depth > 0) {
        if (sql[j] === "/" && sql[j + 1] === "*") {
          depth += 1;
          j += 2;
          continue;
        }
        if (sql[j] === "*" && sql[j + 1] === "/") {
          depth -= 1;
          j += 2;
          continue;
        }
        j += 1;
      }
      buf += " ";
      i = j;
      continue;
    }

    if (c === ";") {
      const trimmed = buf.trim();
      if (trimmed) out.push(trimmed);
      buf = "";
      i += 1;
      continue;
    }

    buf += c;
    i += 1;
  }

  const tail = buf.trim();
  if (tail) out.push(tail);
  return out;
}
