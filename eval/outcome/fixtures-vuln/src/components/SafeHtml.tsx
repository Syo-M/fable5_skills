import DOMPurify from "isomorphic-dompurify";

type Props = { html: string };

// Renders trusted-ish HTML after sanitization with the shared hardened config.
export function SafeHtml({ html }: Props) {
  const clean = DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
  return <div dangerouslySetInnerHTML={{ __html: clean }} />;
}
