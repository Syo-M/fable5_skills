type Props = { label: string; onClick: () => void };
export function Button({ label, onClick }: Props) {
  return (
    <button
      className="rounded bg-brand px-4 py-2 text-white hover:bg-brand-dark"
      onClick={onClick}
    >
      {label}
    </button>
  );
}
