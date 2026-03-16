import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import SmsInbox from "@/components/leads/SmsInbox";

export const revalidate = 300;

/**
 * /leads/sms?key=SYNC_SECRET
 *
 * SMS conversation inbox. Shows all conversations with recent messages.
 */
export default async function SmsPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const params = await searchParams;
  const syncSecret = process.env.SYNC_SECRET;
  if (!syncSecret || params.key !== syncSecret) {
    redirect("/?err=unauthorized");
  }

  const [conversations, stats] = await Promise.all([
    prisma.smsConversation.findMany({
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { lastMessageAt: "desc" },
      take: 50,
    }),
    prisma.smsConversation.groupBy({
      by: ["status"],
      _count: { id: true },
    }),
  ]);

  const totalMessages = await prisma.smsMessage.count();

  const serialized = conversations.map((c) => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    lastMessageAt: c.lastMessageAt?.toISOString() ?? null,
    messages: c.messages.map((m) => ({
      ...m,
      createdAt: m.createdAt.toISOString(),
    })),
  }));

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold text-white mb-2">SMS Inbox</h1>

      <div className="flex flex-wrap gap-4 text-sm text-white/40 mb-6">
        <span>{conversations.length} conversations</span>
        <span>{totalMessages} total messages</span>
        {stats.map((s) => (
          <span key={s.status}>
            {s.status}: {s._count.id}
          </span>
        ))}
      </div>

      <SmsInbox conversations={serialized} />
    </div>
  );
}
