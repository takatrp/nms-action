import test from 'node:test';
import assert from 'node:assert/strict';
import {BACKUP_MAX_BYTES,initialState,validateState,parseBackup,parseStoredState,serializeBackup} from '../src/core.js';
import {saveState} from '../src/storage.js';

const exportedAt='2026-10-06T02:00:00.000Z';
const bytes=text=>Buffer.byteLength(text,'utf8');

function paddedInput(targetBytes,character='あ') {
  const state={...initialState(),padding:''};
  const remaining=targetBytes-bytes(JSON.stringify(state));
  const count=Math.floor(remaining/bytes(character));
  state.padding=character.repeat(count)+'x'.repeat(remaining-count*bytes(character));
  const text=JSON.stringify(state);
  assert.equal(bytes(text),targetBytes);
  return text;
}

function stateAtBackupBytes(targetBytes,character='あ') {
  const state=initialState();
  state.reviews=Array.from({length:1200},(_,i)=>({id:`review-${i}`,scopeId:'scope-main',candidateId:'',date:'2026-10-01',title:`振り返り${i}`,owner:'',plan:'',actual:'',learning:'',nextAction:'',dueDate:''}));
  let remaining=targetBytes-bytes(JSON.stringify({...state,exportedAt},null,2));
  assert.ok(remaining>=0);
  for(const review of state.reviews) {
    const count=Math.min(Math.floor(2000/character.length),Math.floor(remaining/bytes(character)));
    review.plan=character.repeat(count);
    remaining-=count*bytes(character);
    const tail=Math.min(2000-review.plan.length,remaining);
    review.plan+='x'.repeat(tail);
    remaining-=tail;
    if(!remaining)break;
  }
  assert.equal(remaining,0);
  assert.equal(bytes(JSON.stringify({...state,exportedAt},null,2)),targetBytes);
  return state;
}

test('JSON入力はUTF-8実バイト数の上限直前・上限・1バイト超を区別する',()=>{
  for(const character of ['あ','😀']) {
    for(const size of [BACKUP_MAX_BYTES-1,BACKUP_MAX_BYTES])assert.deepEqual(parseBackup(paddedInput(size,character)),validateState(initialState()));
    const oversized=paddedInput(BACKUP_MAX_BYTES+1,character);
    assert.ok(oversized.length<BACKUP_MAX_BYTES);
    assert.throws(()=>parseBackup(oversized),/5MB（5,000,000バイト）/);
  }
});

test('日本語を含む上限直前・上限の出力はそのまま同アプリに復元できる',()=>{
  for(const size of [BACKUP_MAX_BYTES-1,BACKUP_MAX_BYTES]) {
    const state=stateAtBackupBytes(size);
    const text=serializeBackup(state,exportedAt);
    assert.equal(bytes(text),size);
    assert.deepEqual(parseBackup(text),validateState(state));
  }
});

test('出力が1バイト超過した場合は拒否して入力データを変更しない',()=>{
  const state=stateAtBackupBytes(BACKUP_MAX_BYTES+1);
  const before=JSON.stringify(state);
  assert.throws(()=>serializeBackup(state,exportedAt),/5MB（5,000,000バイト）/);
  assert.equal(JSON.stringify(state),before);
});

test('既存の大きな端末データは形式検証して読み込み容量だけで破損扱いしない',()=>{
  const state=stateAtBackupBytes(BACKUP_MAX_BYTES+1_000_000);
  const raw=JSON.stringify(state);
  assert.ok(bytes(raw)>BACKUP_MAX_BYTES);
  assert.ok(raw.length<BACKUP_MAX_BYTES);
  const restored=parseStoredState(raw);
  assert.deepEqual(restored,validateState(state));
  assert.throws(()=>serializeBackup(restored,exportedAt),/5MB（5,000,000バイト）/);
  assert.throws(()=>parseStoredState(JSON.stringify({...state,version:999})),/バージョン1/);
});

test('バックアップに戻せない変更・全体置換では保存版と表示状態を維持する',async()=>{
  let state=initialState(),raw=null,persisted=null,writes=0;
  const options={getState:()=>state,setState:value=>state=value,getRaw:()=>raw,setRaw:value=>raw=value,storage:{getItem:()=>persisted,setItem:(_key,value)=>{persisted=value;writes++;}},locks:{request:async(_key,fn)=>fn()},key:'backup-limit'};
  await saveState({...options,next:state});
  const before={state:structuredClone(state),raw,persisted,writes};
  const oversized=stateAtBackupBytes(BACKUP_MAX_BYTES+1);
  // The compact input fits the file limit, but its full backup does not.
  assert.ok(bytes(JSON.stringify(oversized))<BACKUP_MAX_BYTES);
  for(const next of [oversized,draft=>{draft.reviews=structuredClone(oversized.reviews);}]) {
    await assert.rejects(saveState({...options,next}),/5MB（5,000,000バイト）/);
    assert.deepEqual({state,raw,persisted,writes},before);
  }
});
