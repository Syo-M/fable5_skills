import styles from './Button.module.css';
type Props = { label: string; onClick: () => void };
export function Button({ label, onClick }: Props) {
  return <button className={styles.root} onClick={onClick}>{label}</button>;
}
