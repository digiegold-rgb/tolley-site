import {createHash} from 'node:crypto';

export const OWNER = 'treasure_hauls';
export const defaults = {
  dmEnabled:true, repliesEnabled:true, announcementsEnabled:true,
  announcementMin:360, announcementMax:600, dmDelay:45, dmCooldownDays:30,
  announcements:[
    'Thanks for hanging out with us! Have a request for an upcoming show? Drop it in chat — we would love to hear it!',
    'Welcome to everyone joining us! Feel free to ask questions about the items we are showing.',
    'Anything you would like a closer look at? Let us know in chat!'
  ], faqs:[], excludedUsers:[], testUsers:[]
};
export const normalizeUser=s=>String(s||'').trim().replace(/^@/,'').toLowerCase();
export const validUser=s=>/^[a-z0-9_.-]{1,60}$/.test(s);
export const hash=(...parts)=>createHash('sha256').update(JSON.stringify(parts)).digest('hex');
export function showId(url){
  try {const u=new URL(url);return u.protocol==='https:'&&['www.whatnot.com','whatnot.com'].includes(u.hostname)&&/^\/(?:[a-z]{2}-[A-Z]{2}\/)?(?:dashboard\/)?live\/([a-f0-9-]{36})\/?$/.test(u.pathname)?u.pathname.match(/live\/([a-f0-9-]{36})/)[1]:null;}catch{return null;}
}
export function validateShowUrl(url){
  const u=new URL(String(url));
  if(u.protocol!=='https:'||!['www.whatnot.com','whatnot.com'].includes(u.hostname)||u.username||u.password||u.port||(!showId(url)&&!/^\/s\/[A-Za-z0-9]+\/?$/.test(u.pathname)))throw Error('Enter a Whatnot show link.');
  return u.href;
}
export function settings(input){
  const c={...defaults,...input};
  for(const k of ['dmEnabled','repliesEnabled','announcementsEnabled'])if(typeof c[k]!=='boolean')throw Error(`Invalid ${k}`);
  for(const [k,min,max] of [['announcementMin',180,3600],['announcementMax',180,7200],['dmDelay',15,600],['dmCooldownDays',1,365]])if(!Number.isInteger(c[k])||c[k]<min||c[k]>max)throw Error(`Invalid ${k}`);
  if(c.announcementMax<c.announcementMin)throw Error('Maximum interval must be at least the minimum.');
  if(!Array.isArray(c.announcements)||c.announcements.length>20)throw Error('Use up to 20 announcements.');
  c.announcements=c.announcements.map(s=>cleanMessage(s,350));
  if(!Array.isArray(c.faqs)||c.faqs.length>40)throw Error('Use up to 40 answers.');
  c.faqs=c.faqs.map(f=>{
    if(!Array.isArray(f.keywords)||!f.keywords.length||f.keywords.length>8)throw Error('Each answer needs 1–8 matching words.');
    const keywords=f.keywords.map(k=>String(k).trim().toLowerCase());
    if(keywords.some(k=>!k||k.length>60))throw Error('Invalid matching words.');
    return {keywords,answer:cleanMessage(f.answer,300)};
  });
  for(const k of ['excludedUsers','testUsers']){
    if(!Array.isArray(c[k])||c[k].length>200)throw Error(`Invalid ${k}`);
    c[k]=[...new Set(c[k].map(normalizeUser))];
    if(c[k].some(u=>!validUser(u)))throw Error('Invalid username.');
  }
  return Object.fromEntries(Object.keys(defaults).map(k=>[k,c[k]]));
}
export function cleanMessage(s,max=500){
  if(typeof s!=='string'||!s.trim()||s.length>max||/[\x00-\x08\x0b-\x1f]/.test(s))throw Error(`Message must contain 1–${max} characters.`);
  return s.trim();
}
export function isOptOut(text){return /\b(stop|don'?t|do not|no more|quit)\b.{0,35}\b(dm|dms|messages?|messaging|contact|bot)\b|\bunsubscribe\b/i.test(text);}
export function substantive(text){return typeof text==='string'&&(text.trim().length>=3||/^hi$/i.test(text.trim()))&&/[a-z]{2}/i.test(text)&&!isOptOut(text)&&!/^\s*(?:joined|neemt deel|entered|followed|volgt)\b/i.test(text)&&!/^\s*[!/]/.test(text);}
export function topic(text){
  const topics=[[/\b(vintage|antique) cameras?\b/i,'vintage cameras'],[/\bcameras?\b/i,'cameras'],[/\b(computers?|pc|corsair)\b/i,'computers'],[/\b(ice makers?|opal|nugget ice)\b/i,'ice makers'],[/\b(apple pencils?|ipads?)\b/i,'Apple accessories'],[/\b(speakers?|steelseries|steel series)\b/i,'speakers'],[/\b(toys?|dinosaurs?)\b/i,'toys'],[/\b(vintage|antiques?)\b/i,'vintage finds']];
  return topics.find(([r])=>r.test(text))?.[1]||null;
}
export function thankYou(username,text){
  const t=topic(text);
  return `Thanks for ${t?`chatting with us about ${t}`:'saying hi and spending time with us'}, @${username}! We really appreciate your support. Any requests for a future show? We'd love to hear them!`;
}
export function publicReply(username,text,config){
  if(isOptOut(text))return null;
  const q=/\?|\b(what|when|where|how|can|does|is it|do you)\b/i.test(text);
  if(q){
    const normalized=text.toLowerCase();
    const matches=config.faqs.filter(f=>f.keywords.every(k=>normalized.includes(k)));
    // Ambiguous matches stay with the host instead of choosing a possibly wrong fact.
    if(matches.length===1)return {text:`@${username} ${matches[0].answer}`,reason:'Owner-supplied answer'};
    return null;
  }
  if(/\b(hi|hello|hey|good evening|good morning|great to be here)\b/i.test(text))return {text:`Welcome, @${username}! Thanks for joining us — let us know if there is anything you would like a closer look at.`,reason:'Viewer greeting'};
  return null;
}
export function eligible(user,config){return validUser(user)&&user!==OWNER&&!config.excludedUsers.includes(user)&&(!config.testUsers.length||config.testUsers.includes(user));}
export function randomDelay(config,random=Math.random){return (config.announcementMin+Math.floor(random()*(config.announcementMax-config.announcementMin+1)))*1000;}
