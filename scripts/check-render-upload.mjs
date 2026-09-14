// The renderer runs these scripts outside Next, so tsconfig.build excludes them.
// Parse them explicitly before every release: one missing brace can strand every output.
import { readFileSync } from 'node:fs';
import ts from 'typescript';
let failed = false;
for (const file of ['scripts/vater-blob-upload.ts', 'scripts/lib/blob-put.ts']) {
  const result = ts.transpileModule(readFileSync(file, 'utf8'), {
    fileName: file, reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  });
  for (const diagnostic of result.diagnostics ?? []) {
    if (diagnostic.category !== ts.DiagnosticCategory.Error) continue;
    failed = true;
    console.error(ts.formatDiagnosticsWithColorAndContext([diagnostic], {
      getCanonicalFileName: name => name, getCurrentDirectory: () => process.cwd(), getNewLine: () => '\n',
    }));
  }
}
if (failed) process.exitCode = 1;
else console.log('Render upload scripts: syntax valid.');
