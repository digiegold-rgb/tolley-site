import { HqBeeper } from '@/components/hq/hq-beeper';
import { validateWdAdmin } from '@/lib/wd-auth';
import { redirect } from 'next/navigation';
export default async function InboxPage(){
 if(!(await validateWdAdmin()).authed)redirect('/hq');
 return <main style={{maxWidth:1400,margin:'0 auto',padding:'24px 16px'}}><p style={{marginBottom:20}}><a href="/hq?tab=chats">Back to HQ chats</a></p><HqBeeper/></main>;
}
