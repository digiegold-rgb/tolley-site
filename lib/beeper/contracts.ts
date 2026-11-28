import { z } from 'zod';
export const accountID = 'facebookgo.534686507';
const short = z.string().max(300);
export const messageSchema = z.object({ id: short, text: z.string().max(10000), at: z.string().datetime({ offset: true }), outgoing: z.boolean(), deleted: z.boolean().default(false), type: short.default('TEXT') });
export const chatSchema = z.object({ id: short.min(1), accountID: z.literal(accountID), title: short, listing: short, stage: z.number().int().min(0).max(2), paused: z.boolean(), reason: z.string().max(200).nullable(), lastActivity: z.string().datetime({ offset: true }), messages: z.array(messageSchema).max(100), hasMore: z.boolean(), needsReview: z.boolean() });
export const snapshotSchema = z.object({ type: z.literal('snapshot'), paused: z.boolean(), healthy: z.boolean(), error: z.string().max(300), chats: z.array(chatSchema).max(200) });
export const commandSchema = z.object({ requestId: z.string().uuid(), action: z.enum(['pause','resume','listing-pause','listing-resume','send']), chatId: short.optional(), text: z.string().trim().min(1).max(4000).optional(), expectedMessageId: short.optional() }).superRefine((c,ctx) => {
 if ((c.action==='send'||c.action.startsWith('listing-'))&&!c.chatId) ctx.addIssue({code:'custom',message:'Conversation required'});
 if(c.action==='send'&&(!c.text||!c.expectedMessageId))ctx.addIssue({code:'custom',message:'Message and latest conversation ID required'});
});
export const noteSchema = z.object({ action: z.literal('save'), chatId: short.min(1), business: z.enum(['sales','realestate','cleanouts']), notes: z.string().max(10000), draft: z.string().max(4000), followUpAt: z.string().datetime({offset:true}).nullable(), closed: z.boolean(), customerId: short.nullable() });
export const ackSchema = z.object({ type:z.literal('ack'), id:z.string().uuid(), status:z.enum(['done','error','uncertain']), detail:z.string().max(300) });
export type Chat = z.infer<typeof chatSchema>;
export type Note = z.infer<typeof noteSchema>;
export type Command = z.infer<typeof commandSchema> & { id:string; status:string; createdAt:string; detail?:string; listing?:string };
export type Inbox = { state: { paused:boolean; healthy:boolean; error:string; syncedAt:string } | null; chats:(Chat & {note:Note|null;syncedAt:string})[]; commands:Command[] };
