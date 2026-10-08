import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as core from '../src/core.js';
import * as demo from '../src/demo.js';
import * as frictions from '../src/frictions.js';
import * as tactics from '../src/tactics.js';
import * as forms from '../src/forms.js';
import {saveState} from '../src/storage.js';
const source=readFileSync(new URL('../src/app.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
function store(entries=[]){const values=new Map(entries),writes=[];return {values,writes,getItem:k=>values.has(k)?values.get(k):null,setItem(k,v){values.set(k,String(v));writes.push([k,String(v)]);},removeItem(k){values.delete(k);writes.push([k,null]);}};}
function queue(){let tail=Promise.resolve();return {request:(_key,fn)=>{const result=tail.then(fn);tail=result.catch(()=>{});return result;}};}
function app(storage,session=store(),locks=queue()){
 const nodes=new Map(),events=new Map();
 const stub=()=>({innerHTML:'',textContent:'',value:'',hidden:false,querySelector:()=>stub(),querySelectorAll:()=>[],addEventListener(){},showModal(){},close(){},click(){},classList:{add(){},remove(){}},dataset:{}});
 const document={querySelector:key=>{if(!nodes.has(key))nodes.set(key,stub());return nodes.get(key);},addEventListener(){}};
 const ctx=vm.createContext({...core,...demo,...frictions,...tactics,...forms,saveState,h:core.escapeHtml,document,window:{addEventListener:(k,f)=>events.set(k,f)},location:{hash:''},localStorage:storage,sessionStorage:session,navigator:{locks},structuredClone,FormData,console,setTimeout:()=>0,clearTimeout(){}});
 vm.runInContext(source,ctx);return {nodes,ctx,events,run:code=>vm.runInContext(code,ctx)};
}
const realRaw=()=>JSON.stringify(core.initialState(),null,2)+'\n';
const fixture=()=>store([[demo.REAL_KEY,realRaw()],['nms-action-scope','scope-main'],['nms-action-stale-days','37']]);
const realSnapshot=s=>JSON.stringify([...s.values].filter(([k])=>!k.startsWith('nms-action-demo-')));
test('架空サンプルは日付・抵抗根拠を検証し、目標数値と正式実績を含まない',()=>{
 const s=demo.createDemoState();assert.deepEqual(core.validateState(s),s);assert.equal(s.events.length,0);
 assert.equal(s.scopes[0].targetOffices,null);assert.equal(s.scopes[0].baselineOffices,null);assert.equal(s.scopes[0].newMembersTarget,null);
 assert.equal(s.candidates.find(c=>c.id==='demo-case-c').visitDate,core.addDays(core.today(),-4));
 assert.equal(s.candidates.find(c=>c.id==='demo-case-e').contactAfterDate,core.addDays(core.today(),14));
 forms.checkFrictionEvidence(s.candidates[1].frictions,core.today());
 assert.ok(s.candidates.every(c=>c.alias.startsWith('デモ')));
});
test('相対日付のリセットは年越し・うるう日でも整合する',()=>{
 const s=demo.createDemoState('2024-03-01');assert.equal(s.candidates[2].visitDate,'2024-02-26');
 const y=demo.createDemoState('2025-01-01');assert.equal(y.scopes[0].baselineDate,'2024-11-02');assert.equal(y.candidates[3].joinedDate,'2024-11-27');
});
test('デモの出力はデモ専用JSONでのみ復元でき通常の旧v1復元にも入らない',()=>{
 const s=demo.createDemoState(),raw=demo.serializeDemo(s);assert.deepEqual(demo.parseDemo(raw,{backup:true}),s);
 assert.equal(JSON.parse(raw).app,demo.DEMO_APP);assert.equal(JSON.parse(raw).demo,true);
 assert.throws(()=>core.parseBackup(raw));assert.throws(()=>core.parseStoredState(raw));
});
test('通常JSON・設定JSON・壊れたデモ・版違いはデモへ入らない',()=>{
 const raw=demo.serializeDemo(demo.createDemoState());
 for(const bad of [core.serializeBackup(core.initialState()),JSON.stringify({app:'nms-action-settings',version:1,scopes:core.initialState().scopes}),'', '{',raw.replace('"version": 1','"version": 999'),raw.replace('"demo": true','"demo": false')])assert.throws(()=>demo.parseDemo(bad,{backup:true}));
});
test('デモ入力サイズもUTF-8の5MB上限で拒否する',()=>assert.throws(()=>demo.parseDemo('あ'.repeat(1_666_667),{backup:true}),/5MB/));
test('デモ開始・編集・設定変更・終了は通常キーの値を一切変えない',async()=>{
 const storage=fixture(),before=realSnapshot(storage),a=app(storage);
 await a.run('switchMode(true)');await a.run("change(s=>s.candidates[0].alias='デモ編集')");
 a.nodes.get('#staleDays').value='44';a.run("actions['stale-save']()");
 a.nodes.get('#scopeSelect').onchange({target:{value:'scope-main'}});
 assert.equal(a.nodes.get('#demoBanner').hidden,false);assert.match(a.nodes.get('#demoBanner').innerHTML,/正式実績/);
 assert.equal(realSnapshot(storage),before);await a.run('switchMode(false)');
 assert.equal(realSnapshot(storage),before);assert.equal(a.run('state.candidates.length'),0);assert.equal(a.run('staleDays'),37);
 assert.equal(a.nodes.get('#demoBanner').hidden,true);
 assert.ok(storage.writes.every(([k])=>k.startsWith('nms-action-demo-')));
});
test('同じタブの再読込はデモ編集とモードを保持し、新規タブは通常から開く',async()=>{
 const storage=fixture(),session=store(),a=app(storage,session);await a.run('switchMode(true)');await a.run("change(s=>s.candidates[0].alias='デモ保存後')");
 const reload=app(storage,session);assert.equal(reload.run('demoMode'),true);assert.equal(reload.run('state.candidates[0].alias'),'デモ保存後');
 const other=app(storage);assert.equal(other.run('demoMode'),false);assert.equal(other.run('state.candidates.length'),0);
});
test('通常データが破損・空文字でもデモを開始・終了して元のバイトを保持する',async()=>{
 for(const raw of ['{','']){const storage=fixture();storage.values.set(demo.REAL_KEY,raw);const a=app(storage);
 assert.equal(a.run('blocked'),true);await a.run('switchMode(true)');assert.equal(a.run('blocked'),false);
 await a.run('switchMode(false)');assert.equal(a.run('blocked'),true);assert.equal(storage.getItem(demo.REAL_KEY),raw);}
});
test('壊れたデモの復旧は通常データへ波及しない',async()=>{
 const storage=fixture(),before=realSnapshot(storage);storage.values.set(demo.DEMO_KEY,'{');const session=store([[demo.MODE_KEY,'1']]),a=app(storage,session);
 assert.equal(a.run('blocked'),true);await assert.rejects(a.run("change(s=>s.candidates.pop())"),/復旧/);
 await a.run('commit(createDemoState(),{force:true})');assert.equal(a.run('blocked'),false);assert.equal(realSnapshot(storage),before);
});
test('モード切替前に待機していた保存は切替後のデータを書かない',async()=>{
 const storage=fixture(),before=realSnapshot(storage);let release;const locks={request:(_key,fn)=>new Promise(resolve=>{release=()=>resolve(fn());})};
 const a=app(storage,store(),locks),pending=a.run("change(s=>s.scopes[0].targetOffices=9)");
 storage.values.set(demo.DEMO_KEY,demo.serializeDemo(demo.createDemoState()));await a.run('switchMode(true)');
 release();await assert.rejects(pending,/モード/);assert.equal(realSnapshot(storage),before);assert.equal(a.run('state.scopes[0].targetOffices'),null);
});
test('別タブのデモ更新を古いタブの保存やリセットで消さない',async()=>{
 const storage=fixture(),s1=store([[demo.MODE_KEY,'1']]),s2=store([[demo.MODE_KEY,'1']]);
 storage.values.set(demo.DEMO_KEY,demo.serializeDemo(demo.createDemoState()));
 const a=app(storage,s1),b=app(storage,s2);await a.run("change(s=>s.candidates[0].alias='デモ別タブ')");
 const raw=storage.getItem(demo.DEMO_KEY);await assert.rejects(b.run("change(s=>s.candidates.pop())"),/別タブ/);
 await assert.rejects(b.run('commit(createDemoState(),{force:true})'),/別タブ/);assert.equal(storage.getItem(demo.DEMO_KEY),raw);
});
test('通常タブの変更とデモタブの変更は相互に競合せず終了時は最新通常版を読む',async()=>{
 const storage=fixture(),a=app(storage),b=app(storage);await a.run('switchMode(true)');
 await b.run('change(s=>s.scopes[0].targetOffices=8)');const latest=storage.getItem(demo.REAL_KEY);
 await a.run("change(s=>s.candidates[0].owner='デモ担当C')");assert.equal(storage.getItem(demo.REAL_KEY),latest);
 await a.run('switchMode(false)');assert.equal(a.run('state.scopes[0].targetOffices'),8);
});
test('保存容量エラーでも通常の値・デモの保存済み状態を保持する',async()=>{
 const storage=fixture(),a=app(storage);await a.run('switchMode(true)');const before=JSON.stringify([...storage.values]),alias=a.run('state.candidates[0].alias');
 storage.setItem=()=>{throw Error('quota');};await assert.rejects(a.run("change(s=>s.candidates[0].alias='デモ失敗')"),/保存できません/);
 assert.equal(a.run('state.candidates[0].alias'),alias);assert.equal(JSON.stringify([...storage.values]),before);
});
test('タブ内モード保存が拒否されたらデモ切替も通常保存への書込みも行わない',async()=>{
 const storage=fixture(),session=store(),a=app(storage,session),before=realSnapshot(storage);
 session.setItem=()=>{throw Error('blocked');};await assert.rejects(a.run('switchMode(true)'),/モードを保存できません/);
 assert.equal(a.run('demoMode'),false);assert.equal(storage.writes.length,0);assert.equal(realSnapshot(storage),before);
});
test('デモのタスク完了は候補段階・入会日・正式実績を変更しない',async()=>{
 const storage=fixture(),a=app(storage);await a.run('switchMode(true)');const before=a.run('JSON.stringify(state.candidates)');
 await a.run('change(s=>s.campaigns[0].tasks[1].done=true)');assert.equal(a.run('JSON.stringify(state.candidates)'),before);assert.equal(a.run('state.events.length'),0);
});
test('ファイル読込中のモード切替は復元確認を開かず取り消す',async()=>{
 const storage=fixture(),a=app(storage);let resolve;const file={size:50,text:()=>new Promise(r=>resolve=r)};
 const pending=a.nodes.get('#importFile').onchange({target:{files:[file]}});await a.run('switchMode(true)');resolve(core.serializeBackup(core.initialState()));await pending;
 assert.equal(a.nodes.get('#confirmDialog').innerHTML,'');assert.match(a.nodes.get('#toast').textContent,/モードが切り替わりました/);
});
test('デモの通常JSON・設定JSON読込は確認前に拒否する',async()=>{
 const storage=fixture(),a=app(storage);await a.run('switchMode(true)');const before=storage.getItem(demo.DEMO_KEY);
 await a.nodes.get('#importFile').onchange({target:{files:[{size:500,text:async()=>core.serializeBackup(core.initialState())}]}});
 assert.match(a.nodes.get('#toast').textContent,/デモ専用JSON/);assert.equal(a.nodes.get('#confirmDialog').innerHTML,'');
 assert.throws(()=>a.run("actions['settings-import']()"),/通常モード/);assert.equal(storage.getItem(demo.DEMO_KEY),before);
});
test('すべてのデモ画面と編集・確認ダイアログにデモ表示が残る',async()=>{
 const a=app(fixture());await a.run('switchMode(true)');
 for(const section of ['overview','candidates','tactics','followups','frictions','reviews','settings']){a.ctx.location.hash='#'+section;a.run('render()');assert.equal(a.nodes.get('#demoBanner').hidden,false);assert.equal(a.nodes.get('#exportBtn').textContent,'デモJSONを保存');}
 a.run("editCandidate('demo-case-b')");assert.match(a.nodes.get('#editor').innerHTML,/【デモ】/);
 a.run("actions['demo-reset']()");assert.match(a.nodes.get('#confirmDialog').innerHTML,/【デモ】/);
 a.run("planSummary('demo-plan-b')");assert.match(a.nodes.get('#editor').innerHTML,/【デモ】/);
});
