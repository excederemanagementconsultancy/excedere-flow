import {seed,validate} from './model.js';
import {upgradeGuides} from './task-guides.js';
export const STORAGE_KEY='excedere.flow.v1';
// The UI talks to this repository, so a future remote adapter can replace it.
export class LocalRepository {
  constructor(storage=globalThis.localStorage) {this.storage=storage;}
  load() {
    const raw=this.storage.getItem(STORAGE_KEY);
    if(raw!==null) {try{return upgradeGuides(validate(JSON.parse(raw)));}catch{throw Error('Your saved data could not be read. It has been kept intact. Restore a valid backup or export the saved data for recovery.');}}
    const state=upgradeGuides(seed()); this.save(state); return state;
  }
  save(state) {validate(state); this.storage.setItem(STORAGE_KEY,JSON.stringify(state));}
  raw() {return this.storage.getItem(STORAGE_KEY)||'';}
}
