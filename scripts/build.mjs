import {mkdir,copyFile} from 'node:fs/promises';
await mkdir('dist/src',{recursive:true});
for(const p of ['index.html','src/app.js','src/demo.js','src/core.js','src/tactics.js','src/frictions.js','src/storage.js','src/forms.js','src/styles.css'])await copyFile(p,'dist/'+p);
await copyFile('.nojekyll','dist/.nojekyll');
console.log('Built static app in dist/ (explicit public file list)');

