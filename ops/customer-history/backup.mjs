// Dedicated customer-history backup. No public uploads or unencrypted remote keys.
import { spawn } from 'node:child_process';
import { mkdir, writeFile, copyFile, stat, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
process.umask(0o077);
const root='/home/jelly/.local/state/tolley-customer-backups';
const stamp=new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8);
const dir=path.join(root,stamp);await mkdir(dir,{recursive:true,mode:0o700});
const url=new URL(process.env.DIRECT_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL);
const envFile=path.join(dir,'pg.env');
await writeFile(envFile,[`PGHOST=${url.hostname}`,`PGPORT=${url.port||5432}`,`PGUSER=${decodeURIComponent(url.username)}`,`PGPASSWORD=${decodeURIComponent(url.password)}`,`PGDATABASE=${url.pathname.slice(1)}`,'PGSSLMODE=require'].join('\n'),{mode:0o600});
const run=(cmd,args)=>new Promise((resolve,reject)=>{const p=spawn(cmd,args,{stdio:['ignore','inherit','inherit']});p.on('error',reject);p.on('exit',code=>code===0?resolve():reject(new Error(cmd+' failed')));});
const tables=['HqCustomer','HqCustomerLink','HqCustomerEvent','HqCustomerAttachment','HqPhoneThread','HqSyncState','ContactReference','VisitorSession','SiteDailyTotal'];
try {
 await run('docker',['run','--rm','--network','host','--env-file',envFile,'--mount',`type=bind,src=${dir},dst=/backup`,'postgres:17','pg_dump','--format=custom','--no-owner','--no-acl','--file=/backup/customers.dump',...tables.flatMap(t=>['--table',`public."${t}"`])]);
 await copyFile('/home/jelly/.config/tolley-customer-sync/env',path.join(dir,'connector.env'));
 const bytes=(await stat(path.join(dir,'customers.dump'))).size;if(bytes<1000)throw new Error('Empty backup');
 await writeFile(path.join(dir,'manifest.json'),JSON.stringify({stamp,bytes,tables,encryptedMedia:true,mediaKeyIncluded:true}));
 await run('rclone',['copy',dir,`gcs-crypt:tolley-backups/customer-history/${stamp}`,'--exclude','pg.env','--transfers','2']);
 await writeFile(path.join(root,'latest.json'),JSON.stringify({stamp,dir,bytes,uploadedAt:new Date().toISOString()}));
 console.log(JSON.stringify({ok:true,stamp,bytes}));
} finally {await rm(envFile,{force:true});}
