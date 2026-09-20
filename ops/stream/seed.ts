import { prisma } from "../../lib/prisma";
async function main(){
 await prisma.liveSettings.upsert({where:{id:"treasure-hauls"},create:{referralUrl:"https://www.whatnot.com/invite/treasure_hauls",publishingPaused:false,bindings:{facebook:{accountId:"1156652300855210",label:"Ruthann's Treasure Haul"}}},update:{referralUrl:"https://www.whatnot.com/invite/treasure_hauls"}});
 console.log('Verified referral and Facebook binding saved; other accounts remain unbound.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>prisma.$disconnect());
