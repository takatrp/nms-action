import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const root=resolve('dist'); const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
const port=Number(process.argv[2]||4173);
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid local port');
http.createServer(async(req,res)=>{try{const path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(path!==root&&!path.startsWith(root+sep))throw Error();const file=path===root?resolve(root,'index.html'):path;const content=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)]||'text/plain','Cache-Control':'no-store'});res.end(content);}catch{res.writeHead(404);res.end('Not found');}}).listen(port,'127.0.0.1',()=>console.log(`http://127.0.0.1:${port}`));
