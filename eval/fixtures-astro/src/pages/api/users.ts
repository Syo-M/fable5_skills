import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  return Response.json({ id: body.id, name: body.name });
};
