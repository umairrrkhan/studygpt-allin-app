const executeCode = async (code, language) => {
  try {
    switch (language.toLowerCase()) {
      case 'html':
      case 'css':
      case 'javascript':
        // For web languages, return the code directly for WebView rendering
        return {
          type: 'web',
          output: code,
          language
        };
      
      case 'python':
        return {
          type: 'terminal',
          output: executePythonLike(code)
        };
        
      default:
        return {
          type: 'terminal',
          output: `Error: Language '${language}' is not supported.\nOnly HTML, CSS, JavaScript, and Python-like syntax are supported.`
        };
    }
  } catch (error) {
    console.error('Code execution error:', error);
    return {
      type: 'terminal',
      output: `Error: ${error.message}`
    };
  }
};

const executeJavaScript = (code) => {
  try {
    // Create a safe context for evaluation
    const console = {
      log: (...args) => output.push(args.join(' ')),
      error: (...args) => output.push('Error: ' + args.join(' ')),
      warn: (...args) => output.push('Warning: ' + args.join(' ')),
    };
    
    const output = [];
    const safeCode = `
      try {
        ${code}
      } catch(e) {
        console.error(e.message);
      }
    `;

    // Execute in isolated scope
    const fn = new Function('console', safeCode);
    fn(console);

    return output.join('\n') || 'Code executed successfully (no output)';
  } catch (error) {
    throw new Error('JavaScript execution failed: ' + error.message);
  }
};

const executePythonLike = (code) => {
  try {
    let output = [];
    const print = (...args) => output.push(args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' '));
    
    // Enhanced Python built-in functions
    const pythonBuiltins = {
      len: (arr) => Array.isArray(arr) ? arr.length : String(arr).length,
      range: (start, end, step = 1) => {
        if (end === undefined) {
          end = start;
          start = 0;
        }
        const length = Math.ceil((end - start) / step);
        return Array.from({ length }, (_, i) => start + (i * step));
      },
      str: (val) => String(val),
      int: (val) => parseInt(val) || 0,
      float: (val) => parseFloat(val) || 0.0,
      list: (val) => Array.from(val || []),
      sum: (arr) => arr.reduce((a, b) => a + b, 0),
      max: (...args) => Math.max(...(Array.isArray(args[0]) ? args[0] : args)),
      min: (...args) => Math.min(...(Array.isArray(args[0]) ? args[0] : args)),
      abs: (num) => Math.abs(num),
      round: (num, precision = 0) => Number(Math.round(num + 'e' + precision) + 'e-' + precision),
    };

    // Normalize line endings and clean whitespace
    code = code
      .replace(/\r\n/g, '\n')
      .replace(/^\s+|\s+$/g, '');

    // Convert Python-style indentation to brackets
    const lines = code.split('\n');
    let currentIndent = 0;
    let blockStack = [];
    let processedCode = lines.map(line => {
      const indent = line.match(/^\s*/)[0].length;
      const content = line.trim();
      
      if (!content) return '';
      
      if (indent > currentIndent) {
        currentIndent = indent;
        return content;
      }
      
      if (indent < currentIndent) {
        const closeBrackets = '}'.repeat((currentIndent - indent) / 2);
        currentIndent = indent;
        return closeBrackets + content;
      }
      
      return content;
    }).join('\n');

    // Handle Python syntax
    let jsCode = processedCode
      // Handle function definitions
      .replace(/def\s+(\w+)\s*\((.*?)\)\s*:/g, (_, name, params) => {
        const cleanParams = params.split(',')
          .map(p => p.trim())
          .filter(p => p)
          .join(', ');
        return `async function ${name}(${cleanParams}) {`;
      })
      // Handle print statements
      .replace(/print\s*\((.*?)\)/g, (_, content) => {
        if (!content.trim()) return 'print("")';
        return `print(${content})`;
      })
      // Handle string formatting
      .replace(/f(['"](.*?)['"])/g, (_, __, content) => {
        return '`' + content.replace(/\{(.*?)\}/g, '${$1}') + '`';
      })
      // Handle Python syntax elements
      .replace(/elif/g, 'else if')
      .replace(/:\s*$/gm, ' {')
      // Handle list comprehensions
      .replace(/\[(.*?) for (.*?) in (.*?)]/g, '($3).map($2 => $1)')
      // Handle basic operators
      .replace(/\/\//g, 'Math.floor(/)')
      .replace(/\*\*/g, 'Math.pow')
      // Clean up any remaining colons
      .replace(/:\s*{/g, ' {')
      // Handle comments
      .replace(/#(.*?)$/gm, '//$1');

    // Create safe execution context
    const context = {
      print,
      ...pythonBuiltins,
      console: { log: print, error: print }
    };

    // Execute with proper error handling
    const wrappedCode = `
      async function __pythonMain__() {
        try {
          ${jsCode}
        } catch (error) {
          print('Error:', error.message);
        }
      }
      __pythonMain__().catch(error => print('Runtime Error:', error.message));
    `;

    const fn = new Function(...Object.keys(context), wrappedCode);
    fn(...Object.values(context));

    return output.join('\n') || 'Code executed successfully (no output)';
  } catch (error) {
    console.error('Python execution error:', error);
    return `Error: ${error.message}`;
  }
};

export { executeCode };
