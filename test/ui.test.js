// Template-level tests, not a replacement for actual browser QA.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as demo from '../src/demo.js';
import * as core from '../src/core.js';
import * as frictions from '../src/frictions.js';
import * as tactics from '../src/tactics.js';
import * as forms from '../src/forms.js';
const source=readFileSync(new URL('../src/app.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
function app(){
 const nodes=new Map();
 const stub=()=>({innerHTML:'',querySelector:()=>stub(),querySelectorAll:()=>[],addEventListener(){},showModal(){},close(){},classList:{add(){},remove(){}},dataset:{}});
 const document={querySelector:key=>{if(!nodes.has(key))nodes.set(key,stub());return nodes.get(key);},addEventListener(){}};
 const ctx=vm.createContext({...demo,...core,...frictions,...tactics,...forms,h:core.escapeHtml,document,window:{addEventListener(){}},location:{hash:''},sessionStorage:{getItem:()=>null},localStorage:{getItem:()=>null},navigator:{},structuredClone,FormData,console,setTimeout,clearTimeout});
 vm.runInContext(source,ctx);return {ctx,nodes,run:code=>vm.runInContext(code,ctx)};
}
function controls(html){
 const stack=[],all=[];const voids=new Set(['input','br','hr','img','meta','link']);
 for(const m of html.matchAll(/<\/?([a-z][\w-]*)\b([^>]*)>/gi)){
  const [tag,name,attrs]=m;
  if(tag.startsWith('</')){const index=stack.findLastIndex(x=>x.name===name);if(index>=0)stack.splice(index);continue;}
  const hidden=stack.some(x=>x.hidden)||/\bhidden\b/.test(attrs)||(name==='details'&&!/\bopen\b/.test(attrs));
  if(['input','select','textarea'].includes(name))all.push({name:attrs.match(/\bname="([^"]+)"/)?.[1],visible:!hidden,required:/\brequired\b/.test(attrs)});
  if(!voids.has(name))stack.push({name,hidden});
 }
 return all;
}
test('候補案件は5欄だけを通常表示し全35コントロールを保持する',()=>{const a=app();a.run('editCandidate()');const fields=controls(a.nodes.get('#editor').innerHTML);assert.equal(fields.length,35);assert.deepEqual(fields.filter(f=>f.visible).map(f=>f.name),['alias','owner','stage','nextAction','dueDate']);assert.deepEqual(fields.filter(f=>f.required).map(f=>f.name),['alias']);assert.match(a.nodes.get('#editor').innerHTML,/連絡可否未確認・停止/);});
test('抵抗4分類の全48欄を保持し選択分類の4欄だけを表示する',()=>{const a=app();a.run("state.candidates=[{...newCandidate(),id:'case',alias:'検証',owner:'担当'}];editFrictions('case')");const fields=controls(a.nodes.get('#editor').innerHTML);assert.equal(fields.length,48);assert.equal(fields.filter(f=>f.visible).length,4);assert.ok(fields.filter(f=>f.visible).every(f=>f.name.startsWith('inertia')));});
test('採用要約は入力ゼロ、詳細編集は3欄のみ通常表示する',()=>{const a=app();a.run("state.candidates=[{...newCandidate(),id:'case',alias:'検証',contactAllowed:true}];state.campaigns=[createPlan(state.candidates[0],TACTICS[0],'検証')];planSummary(state.campaigns[0].id)");assert.equal(controls(a.nodes.get('#editor').innerHTML).length,0);assert.match(a.nodes.get('#editor').innerHTML,/次に取り組むこと/);a.run('editPlan(state.campaigns[0].id)');const fields=controls(a.nodes.get('#editor').innerHTML);assert.equal(fields.length,26);assert.deepEqual(fields.filter(f=>f.visible).map(f=>f.name),['owner','dueDate','status']);});
test('ホームは今日の行動を先に表示し分析は閉じた詳細内に置く',()=>{const a=app(),html=a.nodes.get('#main').innerHTML;assert.ok(html.indexOf('今日やること')<html.indexOf('次に取り組む施策'));assert.match(html,/<details class="analytics-details"><summary>目標の進捗/);assert.equal(tactics.TACTICS.length,12);a.run("location.hash='#frictions';render()");assert.match(a.nodes.get('#main').innerHTML,/Nordgren \/ Schonthal/);});
test('ネイティブの不正入力も該当する抵抗分類と詳細を開く',()=>{const a=app(),first={dataset:{frictionPanel:'inertia'},hidden:false},second={dataset:{frictionPanel:'effort'},hidden:true},details={tagName:'DETAILS',open:false,parentElement:second};const field={parentElement:details,closest:()=>second};const form={querySelectorAll:selector=>selector==='[data-friction-panel]'?[first,second]:[]};a.ctx.testForm=form;a.ctx.testField=field;a.run('revealEditorField(testForm,testField)');assert.equal(first.hidden,true);assert.equal(second.hidden,false);assert.equal(details.open,true);assert.ok(source.includes("revealEditorField(e.currentTarget,e.currentTarget.querySelector('input:invalid,select:invalid,textarea:invalid')||e.target)"));});
