type Props = { authorName: string; bodyHtml: string };

// Renders a user comment. bodyHtml comes from the comment form.
export function Comment({ authorName, bodyHtml }: Props) {
  return (
    <article>
      <h3>{authorName}</h3>
      <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
    </article>
  );
}
