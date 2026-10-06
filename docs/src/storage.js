import {validateState,serializeBackup} from './core.js';
export async function saveState({next,force=false,blocked=false,getState,setState,getRaw,setRaw,storage,locks,key}) {
 if(blocked&&!force)throw Error('保存データの復旧が必要です');
 if(!locks)throw Error('排他保存に対応した最新版ブラウザで開いてください');
 const mutation=typeof next==='function',expectedRaw=getRaw();
 return locks.request('nms-action-store-v1',async()=>{
  const current=storage.getItem(key);
  if(current!==(mutation?getRaw():expectedRaw))throw Error('別タブでデータが更新されました。再読み込みしてから操作してください');
  const draft=mutation?structuredClone(getState()):next;
  if(mutation)next(draft);
  const normalized=validateState(draft),raw=JSON.stringify(normalized);
  // Keep every newly saved state within the same UTF-8 limit as its backup.
  serializeBackup(normalized);
  try{storage.setItem(key,raw);}catch{throw Error('端末に保存できません。容量・ブラウザ設定を確認し、バックアップを保存してください');}
  setState(normalized);setRaw(raw);
  return normalized;
 });
}
