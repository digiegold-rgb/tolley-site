import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,chmodSync} from 'node:fs';
import {dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {defaults,settings,hash} from './core.mjs';

export class Store {
  constructor(path){
    if(path!==':memory:')mkdirSync(dirname(path),{recursive:true,mode:0o700});
    this.db=new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
      CREATE TABLE IF NOT EXISTS config(key TEXT PRIMARY KEY,value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,show TEXT,user TEXT,text TEXT,observed INTEGER,baseline INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS messages(id TEXT PRIMARY KEY,dedupe TEXT UNIQUE,show TEXT,kind TEXT,user TEXT,text TEXT,reason TEXT,status TEXT,created INTEGER,updated INTEGER,error TEXT);
      CREATE TABLE IF NOT EXISTS optouts(user TEXT PRIMARY KEY,created INTEGER);
      CREATE INDEX IF NOT EXISTS message_recipient ON messages(kind,user,created);
      CREATE INDEX IF NOT EXISTS event_show ON events(show,observed);
    `);
    if(path!==':memory:')chmodSync(path,0o600);
    this.db.prepare("UPDATE messages SET status='uncertain',error='Worker restarted after reserving this send; no automatic retry.' WHERE status='sending'").run();
  }
  config(){const row=this.db.prepare("SELECT value FROM config WHERE key='settings'").get();return settings(row?JSON.parse(row.value):defaults);}
  configure(value){const c=settings(value);this.db.prepare("INSERT OR REPLACE INTO config VALUES('settings',?)").run(JSON.stringify(c));return c;}
  verifyFacts(show){this.db.prepare("INSERT OR REPLACE INTO config VALUES('facts-show',?)").run(show||'');}
  factsShow(){return this.db.prepare("SELECT value FROM config WHERE key='facts-show'").get()?.value||'';}
  optouts(){return this.db.prepare('SELECT user FROM optouts ORDER BY created DESC LIMIT 1000').all().map(r=>r.user);}
  event(show,user,text,now,baseline=false){const id=hash(show,user,text);const r=this.db.prepare('INSERT OR IGNORE INTO events VALUES(?,?,?,?,?,?)').run(id,show,user,text,now,+baseline);return r.changes?{id,show,user,text,observed:now,baseline:+baseline}:null;}
  events(show){return this.db.prepare('SELECT * FROM events WHERE show=? ORDER BY observed DESC LIMIT 100').all(show||'');}
  optOut(user,now){this.db.prepare('INSERT OR IGNORE INTO optouts VALUES(?,?)').run(user,now);}
  optedOut(user){return !!this.db.prepare('SELECT 1 FROM optouts WHERE user=?').get(user);}
  reserve(m,now){
    const id=randomUUID();
    const r=this.db.prepare("INSERT OR IGNORE INTO messages VALUES(?,?,?,?,?,?,?,?,?,?,?)").run(id,m.dedupe,m.show,m.kind,m.user||'',m.text,m.reason||'','sending',now,now,'');
    return r.changes?id:null;
  }
  finish(id,status,error='',now=Date.now()){this.db.prepare('UPDATE messages SET status=?,error=?,updated=? WHERE id=?').run(status,error.slice(0,400),now,id);}
  recent(kind,user,since){return this.db.prepare('SELECT 1 FROM messages WHERE kind=? AND user=? AND created>=? LIMIT 1').get(kind,user,since);}
  last(kind){return this.db.prepare('SELECT max(created) AS at FROM messages WHERE kind=?').get(kind).at||0;}
  count(kind,since){return this.db.prepare('SELECT count(*) AS n FROM messages WHERE kind=? AND created>=?').get(kind,since).n;}
  has(dedupe){return !!this.db.prepare('SELECT 1 FROM messages WHERE dedupe=?').get(dedupe);}
  history(){return this.db.prepare('SELECT * FROM messages ORDER BY created DESC LIMIT 100').all();}
  close(){this.db.close();}
}
