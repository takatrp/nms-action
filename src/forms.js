import {validDate} from './core.js';
// Explicitly edited keys distinguish an omitted field from an intentional clear.
// In particular, unchecked checkboxes have no FormData entry.
export const CANDIDATE_TEXT_KEYS = ['alias','scopeId','owner','helpers','status','stage','stageSince','meetingDate','lastOutcome','lastContactDate','issue','nextAction','dueDate','visitDate','closeVisitDate','joinedDate','buddy','risk','riskReason','contactAfterDate','contactNote'];
const text = (form, key) => String(form.get(key) ?? '').trim();
export function candidateFromForm(candidate, form, editedKeys) {
  const keys = new Set(editedKeys), out = structuredClone(candidate);
  for (const key of CANDIDATE_TEXT_KEYS) if (keys.has(key)) out[key] = text(form, key);
  if (keys.has('segments')) out.segments = form.getAll('segments');
  if (keys.has('contactAllowed')) out.contactAllowed = form.has('contactAllowed');
  out.followups = candidate.followups.map((followup, i) => {
    const next = {...followup};
    for (const [prefix, key] of [['followPlan','plannedDate'],['followDone','completedDate'],['followNote','note']]) {
      if (keys.has(prefix + i)) next[key] = text(form, prefix + i);
    }
    return next;
  });
  return out;
}
export const FRICTION_FIELDS = {Status:'status',Context:'context',Fact:'fact',Answer:'answer',Date:'confirmedDate',By:'confirmedBy',Constraint:'actualConstraint',Action:'agreedAction',Tactic:'tacticId',ReviewDate:'reviewDate',RecheckedDate:'recheckedDate',Result:'reviewResult'};
export function frictionsFromForm(existing, defaults, form, editedKeys) {
  const keys = new Set(editedKeys), out = structuredClone(existing || []);
  for (const fallback of defaults) {
    const kind = fallback.kind;
    if (!Object.keys(FRICTION_FIELDS).some(suffix => keys.has(kind + suffix))) continue;
    const index = out.findIndex(f => f.kind === kind);
    const next = {...fallback, ...(index < 0 ? {} : out[index])};
    // Reuse the displayed stage and known owner only for the category being edited.
    if (!next.context) next.context = fallback.context;
    if (!next.confirmedBy) next.confirmedBy = fallback.confirmedBy;
    for (const [suffix, key] of Object.entries(FRICTION_FIELDS)) if (keys.has(kind + suffix)) next[key] = text(form, kind + suffix);
    if (index < 0) out.push(next); else out[index] = next;
  }
  return out;
}
export function checkFrictionEvidence(frictions, asOf) {
  function fail(kind, suffix, message) {
    const error = new Error(message); error.field = kind + suffix; throw error;
  }
  for (const f of frictions) {
    for (const [key,suffix,label] of [['confirmedDate','Date','本人確認日'],['reviewDate','ReviewDate','再確認予定日'],['recheckedDate','RecheckedDate','再確認の実施日']]) {
      if (f[key] && !validDate(f[key])) fail(f.kind,suffix,`${label}は1900〜2199年の実在する日付で入力してください`);
    }
    if (f.confirmedBy.length > 120) fail(f.kind,'By','確認した担当者は120文字以内で入力してください');
    if (['confirmed','addressed','recheck','resolved'].includes(f.status)) {
      for (const [key,suffix,label] of [['answer','Answer','本人の回答'],['confirmedDate','Date','本人確認日'],['confirmedBy','By','確認した担当者'],['context','Context','確認した段階']]) {
        if (!f[key]?.trim()) fail(f.kind,suffix,`本人確認済みには「${label}」が必要です。確認の根拠を記録してください。`);
      }
    }
    if (f.confirmedDate > asOf) fail(f.kind,'Date','本人確認日に未来日は登録できません');
    if (f.recheckedDate > asOf) fail(f.kind,'RecheckedDate','再確認の実施日に未来日は登録できません');
    if (f.status === 'resolved') {
      if (!f.recheckedDate || f.recheckedDate < f.confirmedDate) fail(f.kind,'RecheckedDate','解消済みには本人確認日以降の再確認日が必要です');
      if (!f.reviewResult.trim()) fail(f.kind,'Result','解消済みには本人と確認した結果を記録してください');
    }
  }
}
export function planFromForm(plan, form, editedKeys) {
  const keys=new Set(editedKeys),out=structuredClone(plan);
  for(const key of ['owner','dueDate','status','metric','reflection','nextAction','nextTacticId']) if(keys.has(key))out[key]=text(form,key);
  for(const key of ['target','actual'])if(keys.has(key))out[key]=form.get(key)===''?null:Number(form.get(key));
  out.tasks=plan.tasks.map((task,i)=>{
    const next={...task};
    for(const [prefix,key] of [['taskTitle','title'],['taskOwner','owner'],['taskDue','dueDate']])if(keys.has(prefix+i))next[key]=text(form,prefix+i);
    if(keys.has('taskDone'+i))next.done=form.has('taskDone'+i);
    return next;
  });
  return out;
}
