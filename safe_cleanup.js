const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(file => {
    let filepath = path.join(dir, file);
    try {
      let stat = fs.statSync(filepath);
      if (stat.isDirectory()) {
        if (!['node_modules', '.git', 'build', 'dist', 'public', 'assets'].includes(file)) {
          walk(filepath, callback);
        }
      } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
        callback(filepath);
      }
    } catch (e) { }
  });
}

function processFile(filepath) {
  let content = fs.readFileSync(filepath, 'utf8');
  let original = content;

  // 1. Remove comments safely by preserving strings
  // Regex matches strings (group 1) OR comments (group 2)
  // Strings handle escaped characters as well.
  const commentRegex = /(["'`])(?:\\.|[^\\])*?\1|(\/\/.*|\/\*[\s\S]*?\*\/)/g;
  content = content.replace(commentRegex, (match, quote, comment) => {
    if (comment) {
      return ''; // remove comment
    }
    return match; // preserve string
  });

  // 2. Remove console statements (simple approach for single-line and moderately multi-line)
  // Preserving strings to avoid matching console.log inside a string
  const consoleRegex = /(["'`])(?:\\.|[^\\])*?\1|(^[ \t]*console\.(log|error|warn|info|debug|dir|table)\s*\([^;]*\);?[ \t]*$\r?\n?)/gm;
  content = content.replace(consoleRegex, (match, quote, consoleMatch) => {
    if (consoleMatch) {
      return ''; // remove console statement + newline
    }
    return match; // preserve string
  });
  
  // also catch inline console logs e.g. `foo(); console.log(bar);`
  const inlineConsoleRegex = /(["'`])(?:\\.|[^\\])*?\1|(console\.(log|error|warn|info|debug|dir|table)\s*\([^;]*\);?)/g;
  content = content.replace(inlineConsoleRegex, (match, quote, consoleMatch) => {
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

['backend', 'admin-panel'].forEach(dir => {
  let fullPath = path.join('c:/Users/Lenovo/Desktop/support_chat_app', dir);
  walk(fullPath, processFile);
});

console.log("Safe cleanup complete!");
