import {spawn} from 'node:child_process';
import {mkdir,writeFile,stat,rm} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';

process.umask(0o077);
const state='/home/jelly/.local/state/tolley-security';
const stamp=new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8);
const dir=path.join(state,stamp);
await mkdir(dir,{recursive:true,mode:0o700});
const url=new URL(process.env.DIRECT_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL);
const envFile=path.join(dir,'pg.env');
await writeFile(envFile,[
  'PGHOST='+url.hostname,'PGPORT='+(url.port||'5432'),'PGUSER='+decodeURIComponent(url.username),
  'PGPASSWORD='+decodeURIComponent(url.password),'PGDATABASE='+url.pathname.slice(1),'PGSSLMODE=require',
].join('\n')+'\n',{mode:0o600});
async function run(command,args) {
 return new Promise((resolve,reject)=>{
  const child=spawn(command,args,{stdio:['ignore','inherit','inherit']});
  child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(command+' exited '+code)));
 });
}
try {
 await run('docker',['run','--rm','--network','host','--env-file',envFile,
  '--mount','type=bind,src='+dir+',dst=/backup','postgres:17',
  'pg_dump','--format=custom','--no-owner','--no-acl','--file=/backup/database.dump']);
 await run('tar',['-czf',path.join(dir,'spark-config.tar.gz'),'-C','/home/jelly',
  '.cloudflared/config-research.yml','.config/systemd/user','.config/rclone/rclone.conf',
  '.config/tolley-security/production.env']);
 const bytes=(await stat(path.join(dir,'database.dump'))).size;
 if(bytes<1000)throw new Error('Backup unexpectedly small');
 await writeFile(path.join(dir,'manifest.json'),JSON.stringify({createdAt:new Date().toISOString(),
  databaseBytes:bytes,format:'PostgreSQL custom dump',destination:'gcs-crypt:tolley-backups/'+stamp,
  scope:'Production database and Spark service/tunnel/app configuration; generated media excluded'},null,2));
 await run('rclone',['copy',dir,'gcs-crypt:tolley-backups/'+stamp,'--exclude','pg.env','--transfers','2']);
 await writeFile(path.join(state,'latest.json'),JSON.stringify({stamp,dir,bytes,uploadedAt:new Date().toISOString()}));
 console.log(JSON.stringify({backup:stamp,bytes,encryptedRemote:'gcs-crypt:tolley-backups/'+stamp}));
}finally{await rm(envFile,{force:true});}
