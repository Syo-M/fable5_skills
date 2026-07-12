// Formats an authorization header value for the internal API client.
export function authorize(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}
