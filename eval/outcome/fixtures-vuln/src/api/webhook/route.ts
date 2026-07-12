// Payment provider webhook receiver
export async function POST(req: Request) {
  const event = await req.json();
  if (event.type === "payment.succeeded") {
    await grantSubscription(event.data.customerId, event.data.plan);
  }
  return new Response("ok");
}

declare function grantSubscription(customerId: string, plan: string): Promise<void>;
