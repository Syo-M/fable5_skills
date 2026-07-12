// Link preview: fetches a URL supplied by the client and returns the HTML title
export async function POST(req: Request) {
  const { url } = await req.json();
  const res = await fetch(url);
  const html = await res.text();
  const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "";
  return Response.json({ title });
}
