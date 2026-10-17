/* Shared Projects sync protocol. No browser storage or network side effects. */
(function(root){
  'use strict';
  const clone=v=>structuredClone(v);
  const canonical=v=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v);
  const equal=(a,b)=>canonical(a)===canonical(b);
  const collections=['tasks','captures','milestones','notes','projects'];
  const list=(p,k)=>k==='projects'?(p.projects||[]):(p.records?.[k]||[]);
  function diff(before,after){
    const changes=[];
    for(const collection of collections){
      const old=new Map(list(before,collection).map(r=>[String(r.id),r]));
      for(const record of list(after,collection)){
        const prior=old.get(String(record.id))||null;
        const business=v=>v&&Object.fromEntries(Object.entries(v).filter(([k])=>!['updatedAt','syncStatusRevision'].includes(k)));
        if(!equal(business(prior),business(record)))changes.push({collection,id:String(record.id),before:prior,after:clone(record)});
      }
      // Absence never means delete. Existing soft deletion records carry deletedAt.
    }
    for(const collection of ['projectStatus','preferences']){
      const old=before[collection]||{},next=after[collection]||{};
      for(const field of Object.keys(next))if(!equal(old[field],next[field]))changes.push({collection,id:field,before:{value:old[field]??null},after:{value:next[field]}});
    }
    return changes;
  }
  function overlay(payload,changes){
    const next=clone(payload);
    for(const change of changes){
      if(['preferences','projectStatus'].includes(change.collection)){
        (next[change.collection]??={})[change.id]=change.after.value;continue;
      }
      const rows=change.collection==='projects'?(next.projects??=[]):(next.records[change.collection]??=[]);
      const index=rows.findIndex(r=>String(r.id)===change.id);
      if(index<0){rows.push(clone(change.after));continue;}
      if(!change.before)continue;
      const updated={...rows[index]};
      for(const field of new Set([...Object.keys(change.before),...Object.keys(change.after)])){
        if(equal(change.before[field],change.after[field]))continue;
        if(Object.hasOwn(change.after,field))updated[field]=clone(change.after[field]);else delete updated[field];
      }
      rows[index]=updated;
    }
    return next;
  }
  function operation(owner,changes,previous=[]){
    const id=crypto.randomUUID();
    const ordered=[...previous].sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
    const next=clone(changes);
    for(const change of next){
      if(!change.before||['preferences','projectStatus'].includes(change.collection))continue;
      const prior=[...ordered].reverse().find(op=>!op.conflicts?.length&&op.changes.some(c=>c.collection===change.collection&&c.id===change.id&&(c.before?.status!==c.after.status||c.before?.deletedAt!==c.after.deletedAt)));
      const predecessor=prior?.changes.find(c=>c.collection===change.collection&&c.id===change.id);
      if(predecessor&&equal(predecessor.after.status,change.before.status)&&equal(predecessor.after.completedAt,change.before.completedAt)&&equal(predecessor.after.deletedAt,change.before.deletedAt))change.before.syncStatusRevision=prior.id;
    }
    const latest=ordered.length?Date.parse(ordered.at(-1).createdAt):0;
    return {id,owner,createdAt:new Date(Math.max(Date.now(),latest+1)).toISOString(),changes:next};
  }
  root.ProjectsSyncProtocol={diff,overlay,equal,canonical,operation};
})(globalThis);
