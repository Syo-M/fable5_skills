import { useState } from 'react';

type Props = { onSubmit: (email: string, password: string) => void };

export function LoginForm({ onSubmit }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes('@')) {
      setError('Invalid email address');
      return;
    }
    if (password.length < 8) {
      setError('Password is too short');
      return;
    }
    setError(null);
    onSubmit(email, password);
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        メールアドレス
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label>
        パスワード
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      {error && <p role="alert">{error}</p>}
      <button type="submit">ログイン</button>
    </form>
  );
}
