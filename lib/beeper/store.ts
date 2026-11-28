import { createHash } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
export const key = (kind:string,id:string) => `beeper:${kind}:${createHash('sha256').update(id).digest('hex')}`;
export const obj = (x:unknown):Record<string,unknown> => x && typeof x==='object'&&!Array.isArray(x)?x as Record<string,unknown>:{};
export async function save(id:string,meta:unknown) {
 const data={meta:meta as Prisma.InputJsonValue,lastAttemptAt:new Date(),lastSuccessAt:new Date(),error:null};
 return prisma.hqSyncState.upsert({where:{id},create:{id,...data},update:data});
}
