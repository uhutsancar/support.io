// One-off source tidier: strips comments, console statements and runs of blank
// lines from the two workspaces.
//
// Kept as a tool rather than a build step — it rewrites files in place, so it
// is run deliberately: `npx tsx safe_cleanup.ts`.
import fs from 'fs';
import path from 'path';

/** Directories that are generated or vendored and must never be rewritten. */
const SKIP_DIRS = ['node_modules', '.git', 'build', 'dist', 'public', 'assets'];

/** The sources it touches, now that both workspaces are TypeScript. */
const SOURCE_EXTENSIONS = ['.ts', '.tsx'];

function walk(dir: string, callback: (filepath: string) => void): void {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach((file) => {
    const filepath = path.join(dir, file);
    try {
      const stat = fs.statSync(filepath);
      if (stat.isDirectory()) {
        if (!SKIP_DIRS.includes(file)) {
          walk(filepath, callback);
        }
      } else if (SOURCE_EXTENSIONS.some((ext) => file.endsWith(ext))) {
        callback(filepath);
      }
    } catch (e) { }
  });
}

function processFile(filepath: string): void {
  let content = fs.readFileSync(filepath, 'utf8');
  const original = content;

  // 1. Remove comments safely by preserving strings
  // Regex matches strings (group 1) OR comments (group 2)
  // Strings handle escaped characters as well.
  const commentRegex = /(["'`])(?:\\.|[^\\])*?\1|(\/\/.*|\/\*[\s\S]*?\*\/)/g;
  content = content.replace(commentRegex, (match, _quote: string, comment: string) => {
    if (comment) {
      return ''; // remove comment
    }
    return match; // preserve string
  });

  // 2. Remove console statements (simple approach for single-line and moderately multi-line)
  // Preserving strings to avoid matching console.log inside a string
  const consoleRegex = /(["'`])(?:\\.|[^\\])*?\1|(^[ \t]*console\.(log|error|warn|info|debug|dir|table)\s*\([^;]*\);?[ \t]*$\r?\n?)/gm;
  content = content.replace(consoleRegex, (match, _quote: string, consoleMatch: string) => {
    if (consoleMatch) {
      return ''; // remove console statement + newline
    }
    return match; // preserve string
  });

  // also catch inline console logs e.g. `foo(); console.log(bar);`
  const inlineConsoleRegex = /(["'`])(?:\\.|[^\\])*?\1|(console\.(log|error|warn|info|debug|dir|table)\s*\([^;]*\);?)/g;
  content = content.replace(inlineConsoleRegex, (match, _quote: string, consoleMatch: string) => {
    if (consoleMatch) {
      return ''; // remove console statement
    }
    return match; // preserve string
  });

  // 3. Remove multiple empty lines
  content = content.replace(/^\s*[\r\n]{2,}/gm, '\n');

  if (content !== original) {
    fs.writeFileSync(filepath, content, 'utf8');
  }
}

['backend', 'admin-panel'].forEach((dir) => {
  const fullPath = path.join(__dirname, dir);
  walk(fullPath, processFile);
});

console.log('Safe cleanup complete!');
