const fs = require('fs');
const parser = require('@babel/parser');
const code = fs.readFileSync('src/pages/CheckInPage.jsx', 'utf8');
const lines = code.split(/\r?\n/);
for (let n = 50; n <= lines.length; n += 50) {
  const slice = lines.slice(0, n).join('\n');
  try {
    parser.parse(slice, { sourceType: 'module', plugins: ['jsx'] });
    console.log('ok up to', n);
  } catch (e) {
    console.error('fail at', n, e.message, e.loc);
    break;
  }
}
