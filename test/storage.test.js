import test from 'node:test';
import assert from 'node:assert/strict';
import {saveState} from '../src/storage.js';
import {initialState} from '../src/core.js';
function harness(){let state=initialState(),raw=null,persisted=null,queue=Promise.resolve();const storage={getItem:()=>persisted,setItem:(_k,v)=>{persisted=v;}};const locks={request:(_k,fn)=>{const result=queue.then(fn);queue=result.catch(()=>{});return result;}};return {getState:()=>state,setState:v=>state=v,getRaw:()=>raw,setRaw:v=>raw=v,storage,locks,key:'test',outside:v=>persisted=v};}
test('同じタブで続けて行う変更はロック内の最新状態へ適用し失わない',async()=>{const h=harness();await Promise.all([saveState({...h,next:s=>s.scopes[0].baselineOffices=100}),saveState({...h,next:s=>s.scopes[0].targetOffices=110})]);assert.equal(h.getState().scopes[0].baselineOffices,100);assert.equal(h.getState().scopes[0].targetOffices,110);});
test('別タブの更新を認めた場合は古い状態を保存せず拒否する',async()=>{const h=harness();h.outside('別タブのデータ');await assert.rejects(saveState({...h,next:s=>s.scopes[0].targetOffices=10}),/別タブ/);assert.equal(h.getState().scopes[0].targetOffices,null);});
test('容量不足等の保存失敗は表示状態と保存版を更新しない',async()=>{const h=harness();h.storage.setItem=()=>{throw Error('quota');};await assert.rejects(saveState({...h,next:s=>s.scopes[0].targetOffices=10}),/保存できません/);assert.equal(h.getState().scopes[0].targetOffices,null);assert.equal(h.getRaw(),null);});
test('復旧・全体置換でも確認後に別タブが変更したデータは消さない',async()=>{const h=harness();h.outside('他方で復旧済み');await assert.rejects(saveState({...h,next:initialState(),force:true,blocked:true}),/別タブ/);});
test('破損したインポート状態では現在の保存データを変更しない',async()=>{const h=harness();await saveState({...h,next:s=>s.scopes[0].targetOffices=10});const before=h.getRaw();await assert.rejects(saveState({...h,next:{app:'wrong'}}));assert.equal(h.getRaw(),before);});
