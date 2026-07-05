import fs from 'fs';
const filepath = process.argv[2];
let content = fs.readFileSync(filepath, 'utf8');
content = content.replace(/\\\$/g, '$');
content = content.replace(/\\`/g, '`');
fs.writeFileSync(filepath, content);
