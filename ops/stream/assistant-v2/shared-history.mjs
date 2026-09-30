import {DatabaseSync} from 'node:sqlite';
import {Store} from './store.mjs';

/** Separate V2 settings/events; shared outgoing history and opt-outs only.
 * V1 code, settings, browser and service are never changed by this store.
 */
export class SharedStore extends Store {
  constructor(path,legacyPath){super(path);this.legacy=new DatabaseSync(legacyPath);this.legacy.exec('PRAGMA busy_timeout=3000');for(const m of this.db.prepare("SELECT id FROM messages WHERE status='uncertain'").all())this.legacy.prepare("UPDATE messages SET status='uncertain',error='V2 worker restarted; no retry' WHERE id=? AND status='sending' AND reason LIKE '[Inventory V2] %'").run(m.id);}
  optedOut(user){return super.optedOut(user)||!!this.legacy.prepare('SELECT 1 FROM optouts WHERE user=?').get(user);}
  optouts(){return [...new Set([...super.optouts(),...this.legacy.prepare('SELECT user FROM optouts').all().map(r=>r.user)])];}
  optOut(user,now){super.optOut(user,now);this.legacy.prepare('INSERT OR IGNORE INTO optouts VALUES(?,?)').run(user,now);}
  recent(kind,user,since){return super.recent(kind,user,since)||this.legacy.prepare('SELECT 1 FROM messages WHERE kind=? AND user=? AND created>=? LIMIT 1').get(kind,user,since);}
  last(kind){return Math.max(super.last(kind),this.legacy.prepare('SELECT max(created) AS at FROM messages WHERE kind=?').get(kind).at||0);}
  count(kind,since){const ids=new Set(this.db.prepare('SELECT dedupe FROM messages WHERE kind=? AND created>=?').all(kind,since).map(m=>m.dedupe));for(const m of this.legacy.prepare('SELECT dedupe FROM messages WHERE kind=? AND created>=?').all(kind,since))ids.add(m.dedupe);return ids.size;}
  has(dedupe){return super.has(dedupe)||!!this.legacy.prepare('SELECT 1 FROM messages WHERE dedupe=?').get(dedupe);}
  reserve(m,now){
    if(this.has(m.dedupe))return null;
    const id=super.reserve(m,now);if(!id)return null;
    try{
      const r=this.legacy.prepare('INSERT OR IGNORE INTO messages VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(id,m.dedupe,m.show,m.kind,m.user||'',m.text,'[Inventory V2] '+m.reason,'sending',now,now,'');
      if(!r.changes){super.finish(id,'cancelled','Duplicate detected in Classic history',now);return null;}
    }catch{super.finish(id,'uncertain','Shared history unavailable; no send attempted',now);throw Error('Shared message history unavailable; sending paused');}
    return id;
  }
  finish(id,status,error='',now=Date.now()){
    super.finish(id,status,error,now);
    this.legacy.prepare('UPDATE messages SET status=?,error=?,updated=? WHERE id=?').run(status,error.slice(0,400),now,id);
  }
  close(){this.legacy.close();super.close();}
}
