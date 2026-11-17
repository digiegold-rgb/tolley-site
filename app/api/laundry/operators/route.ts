import { actor } from "@/lib/laundry/auth";
import { joinOperator, editOperator } from "@/lib/laundry/store";
import { handle, body } from "@/lib/laundry/http";
export async function POST(req: Request) {
  return handle(async () => {
    const who = await actor(),
      b = await body(req);
    const op = b.id
      ? await editOperator(who, b.id, b)
      : await joinOperator(who, b);
    return { id: op.id };
  });
}
