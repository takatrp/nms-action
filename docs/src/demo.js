import {initialState,validateState,today,addDays,assertBackupSize} from './core.js';
import {TACTICS,createPlan} from './tactics.js';
export const DEMO_APP='nms-action-demo';
export const REAL_KEY='nms-action-data-v1';
export const DEMO_KEY='nms-action-demo-data-v1';
export const MODE_KEY='nms-action-demo-mode-v1';
export const dataKey=demo=>demo?DEMO_KEY:REAL_KEY;
export const preferenceKey=(name,demo)=>demo?'nms-action-demo-'+name:'nms-action-'+name;
export function serializeDemo(state,exportedAt=new Date().toISOString()){
 const text=JSON.stringify({app:DEMO_APP,version:1,demo:true,exportedAt,state:validateState(state)},null,2);
 assertBackupSize(new TextEncoder().encode(text).byteLength);return text;
}
export function parseDemo(text,{backup=false}={}){
 if(typeof text!=='string')throw Error('デモ専用JSONを選んでください');
 if(backup)assertBackupSize(new TextEncoder().encode(text).byteLength);
 const input=JSON.parse(text);
 if(!input||input.app!==DEMO_APP||input.version!==1||input.demo!==true)throw Error('デモではデモ専用JSONだけを復元できます。通常のバックアップ・設定は通常モードで読み込んでください');
 return validateState(input.state);
}
export function createDemoState(asOf=today()){
 const state=initialState(),d=n=>addDays(asOf,n),scopeId=state.scopes[0].id;
 Object.assign(state.scopes[0],{name:'架空のデモ地域',baselineDate:d(-60),dueDate:d(90)});
 const candidate=(id,alias,fields={})=>({id,alias,scopeId,owner:'デモ担当A',helpers:'',segments:[],stage:'K0',stageSince:d(-3),meetingDate:'',lastOutcome:'continue',lastContactDate:d(-3),status:'active',issue:'',nextAction:'本人と希望する進め方を確認する',dueDate:d(0),visitDate:'',closeVisitDate:'',joinedDate:'',buddy:'',risk:'low',riskReason:'',contactAllowed:true,contactAfterDate:'',contactNote:'架空例：本人の希望する方法と時期を確認済み',followups:Array.from({length:3},()=>({plannedDate:'',completedDate:'',note:''})),frictions:[],...fields});
 state.candidates=[
  candidate('demo-case-a','デモ候補A（面談前）',{contactAllowed:false,lastOutcome:'unknown',contactNote:'架空例：連絡可否はまだ未確認。先に確認する'}),
  candidate('demo-case-b','デモ候補B（課題確認）',{stage:'K4',issue:'架空例：準備時間の確保が難しい',nextAction:'合意した短い確認を行う',frictions:[{kind:'effort',status:'confirmed',context:'K4',fact:'架空の本人回答を記録した例',answer:'一度に多くの準備時間は取れません',confirmedDate:d(-2),confirmedBy:'デモ担当A',actualConstraint:'週の予定が埋まっているため準備時間が限られる',agreedAction:'追加費用や支援範囲を確認し、短い一つの確認から試す',recheckedDate:'',tacticId:'P04',reviewDate:d(3),reviewResult:''}]}),
  candidate('demo-case-c','デモ候補C（見学後）',{stage:'K2',visitDate:d(-4),nextAction:'実参加後の本人の感想を聞く',dueDate:d(3)}),
  candidate('demo-case-d','デモ会員D（定着支援）',{stage:'K1',status:'member',joinedDate:d(-35),buddy:'デモ支援担当B',nextAction:'次回支援の内容を本人と調整する',dueDate:d(2),followups:[{plannedDate:d(-28),completedDate:d(-28),note:'架空例：本人と相談内容を確認した'},{plannedDate:d(-5),completedDate:'',note:'架空例：本人の都合に合わせて再調整する'},{plannedDate:d(25),completedDate:'',note:''}]}),
  candidate('demo-case-e','デモ候補E（保留）',{status:'paused',contactAllowed:false,contactAfterDate:d(14),nextAction:'合意日まで連絡を控える',dueDate:d(14),contactNote:'架空例：本人から保留の希望。再開時にも意思を確認する'})
 ];
 const plan=createPlan(state.candidates[1],TACTICS.find(t=>t.id==='P04'),'架空例：本人確認済みの実制約と合意を踏まえた計画',asOf);
 plan.id='demo-plan-b';plan.tasks.forEach((t,i)=>{t.id='demo-task-b-'+i;t.dueDate=d(i===0?0:3);});plan.tasks[0].done=true;
 state.campaigns=[plan];
 state.reviews=[{id:'demo-review-b',scopeId,candidateId:'demo-case-b',date:d(-1),title:'架空例：小さな対応の振り返り',owner:'デモ担当A',plan:'本人の時間制約を確認する',actual:'短い確認から始めることに合意した',learning:'実制約を本人と確かめ、無理に進めない',nextAction:'残る制約と本人の希望を再確認する',dueDate:d(3)}];
 // No goal figures or official results are prefilled. Task completion never creates an event.
 return validateState(state);
}
