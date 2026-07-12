// Users API — update profile
export async function POST(req: Request) {
  const body = await req.json();
  // update the user record with whatever the client sent
  const updated = await saveUser(body.id, body);
  return Response.json(updated);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  // fetch any user's profile by id from the query string
  const user = await loadUser(id ?? "");
  return Response.json(user);
}

declare function saveUser(id: string, data: unknown): Promise<unknown>;
declare function loadUser(id: string): Promise<unknown>;
