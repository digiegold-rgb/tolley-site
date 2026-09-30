/** Read-only inventory export. No costs, floor prices, customer data or credentials. */
import {createRequire} from 'node:module';
import {mkdir,writeFile,rename} from 'node:fs/promises';
import {homedir} from 'node:os';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const require=createRequire(process.env.ASSISTANT_REPO_PACKAGE||'/home/jelly/tolley-stream-handoff/package.json');

export function projectCatalog(products,lineups,now=Date.now()){
  const text=(s,max=160)=>String(s||'').replace(/https?:\/\/\S+|\b[^\s@]+@[^\s@]+\.[^\s@]+/g,'').replace(/[\x00-\x1f]/g,' ').trim().slice(0,max);
  return {version:2,generatedAt:now,products:products.map(p=>({
    id:p.id,title:text(p.title).replace(/^Continue Delete draft\s*/i,''),brand:text(p.brand,60),
    category:text(p.category,80),condition:text(p.condition,80),status:p.status,
    sold:!!p.soldAt||['sold','archived'].includes(p.status)||p.fbStatus==='sold'||p.listings.some(l=>l.soldAt||l.status==='sold'),
    fbStatus:p.fbStatus,updatedAt:p.updatedAt,verifiedDescription:!!p.verifiedDescription,
    description:p.verifiedDescription?text(p.description,900):'',
    sources:[...new Set(p.listings.map(l=>l.platform))],
  })),lineups:lineups.map(l=>({id:l.id,slug:l.slug,name:text(l.name,120),active:l.active,currentIndex:l.currentIndex,updatedAt:l.updatedAt,
    items:l.items.map(i=>({id:i.id,productId:i.productId,sortOrder:i.sortOrder,sold:!!i.soldAt,quantity:i.quantity}))}))};
}

export async function exportCatalog(){
  const {PrismaClient}=require('@prisma/client');const db=new PrismaClient();
  try{
    const data=await db.$transaction(async tx=>{
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      const products=await tx.product.findMany({select:{id:true,title:true,brand:true,category:true,condition:true,status:true,soldAt:true,fbStatus:true,updatedAt:true,verifiedDescription:true,description:true,listings:{select:{platform:true,status:true,soldAt:true}}}});
      const lineups=await tx.streamLineup.findMany({select:{id:true,slug:true,name:true,active:true,currentIndex:true,updatedAt:true,items:{orderBy:{sortOrder:'asc'},select:{id:true,productId:true,sortOrder:true,soldAt:true,quantity:true}}}});
      return projectCatalog(products,lineups);
    },{timeout:25000});
    const file=process.env.ASSISTANT_CATALOG||join(homedir(),'.local/state/tolley-inventory-assistant/catalog.json');
    await mkdir(dirname(file),{recursive:true,mode:0o700});
    await writeFile(file+'.tmp',JSON.stringify(data),{mode:0o600});await rename(file+'.tmp',file);
    console.log(JSON.stringify({exported:data.products.length,lineups:data.lineups.length,generatedAt:data.generatedAt}));
  }catch{throw Error('Inventory refresh failed; previous snapshot retained and will expire');}
  finally{await db.$disconnect();}
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1])exportCatalog().catch(e=>{console.error(e.message);process.exitCode=1;});
