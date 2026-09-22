/** Read only Whatnot observations in a dedicated tab of the existing browser.
 * Never copies cookies, requests credentials, sends chat or operates show controls.
 */
import {mkdir,writeFile,rename} from 'node:fs/promises';
import {homedir} from 'node:os';
import {dirname,join} from 'node:path';
import {pathToFileURL} from 'node:url';

export function publicProfile(text, now=Date.now()/1000) {
  if (!text.split(/\r?\n/).some(line=>line.trim()==='treasure_hauls')) return null;
  const number=(pattern)=>{
    const m=text.match(pattern);return m ? Number(m[1].replaceAll(',','')) : null;
  };
  const followers=number(/(?:^|\n|•)\s*([\d,]+)\s+Followers(?:\s|$)/i);
  const sold=number(/(?:^|\n|•)\s*([\d,]+)\s+Sold(?:\s|$)/i);
  if(followers===null && sold===null)return null;
  return {handle:'treasure_hauls',followers,sold,observedAt:now,source:'Whatnot public profile'};
}

async function main(){
  const {chromium}=await import(pathToFileURL(process.env.STREAM_COACH_PLAYWRIGHT || '/home/jelly/tolley-game-release/node_modules/playwright/index.mjs').href);
  const stateFile=process.env.STREAM_COACH_WHATNOT_STATE || join(homedir(),'.local/state/tolley-stream-coach/whatnot.json');
  await mkdir(dirname(stateFile),{recursive:true,mode:0o700});
  let browser,profilePage,sellerPage,lastProfile;
  async function save(state){const temp=stateFile+'.tmp';await writeFile(temp,JSON.stringify(state),{mode:0o600});await rename(temp,stateFile);}
  for(;;){
    const state={checkedAt:Date.now()/1000,publicStatus:'unavailable',sellerStatus:'login_required',profile:lastProfile||null,error:''};
    try{
      if(!browser?.isConnected()){
        browser=await chromium.connectOverCDP(process.env.STREAM_COACH_BROWSER || 'http://127.0.0.1:9223');
        const context=browser.contexts()[0];
        profilePage=await context.newPage();sellerPage=await context.newPage();
      }
      await profilePage.goto('https://www.whatnot.com/user/treasure_hauls',{waitUntil:'domcontentloaded',timeout:30000});
      await profilePage.getByText('treasure_hauls',{exact:true}).first().waitFor({timeout:12000});
      const profile=publicProfile(await profilePage.locator('body').innerText());
      if(!profile)throw Error('Public profile fields not available');
      lastProfile=profile;state.profile=profile;state.publicStatus='connected';
      await sellerPage.goto('https://www.whatnot.com/dashboard/home',{waitUntil:'domcontentloaded',timeout:30000});
      await sellerPage.waitForTimeout(1500);
      const url=new URL(sellerPage.url());
      if(url.hostname!=='www.whatnot.com'||url.pathname.includes('/login')){
        state.sellerStatus='login_required';state.error='Sign into treasure_hauls in the collector browser to connect private seller data.';
      }else{
        const owned=await sellerPage.locator('a[href="/user/treasure_hauls"],a[href="https://www.whatnot.com/user/treasure_hauls"]').count();
        state.sellerStatus=owned?'awaiting_verification':'account_unverified';
        state.error=owned?'Seller login found; order sync awaits a verified data adapter.':'Seller account identity has not been verified.';
      }
    }catch(e){state.error='Whatnot could not be read. Your last timestamped observations remain saved.';state.sellerStatus='unavailable';}
    await save(state);
    await new Promise(resolve=>setTimeout(resolve,180000));
  }
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(()=>{console.error('Whatnot observer stopped');process.exitCode=1;});
