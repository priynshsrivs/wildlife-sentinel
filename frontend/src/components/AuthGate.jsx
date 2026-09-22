import { useState } from 'react';
import { API_BASE, apiFetch, setToken } from '../api/client';
export default function AuthGate({ children }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [credential, setCredential] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function login(event) {
    event.preventDefault(); setBusy(true); setToken(credential);
    try {
      const response = await apiFetch(`${API_BASE}/auth/me`);
      if (!response.ok) throw new Error('Invalid access token or server unavailable');
      setCredential(''); setAuthenticated(true);
    } catch (failure) { setToken(''); setError(failure.message); }
    finally { setBusy(false); }
  }
  if (authenticated) return <><button style={{position:'fixed',right:12,bottom:12,zIndex:9999}} onClick={() => {setToken(''); setAuthenticated(false);}}>Sign out</button>{children}</>;
  return <main style={{minHeight:'100vh',background:'#020604',color:'#fff',display:'grid',placeItems:'center'}}>
    <form onSubmit={login} style={{display:'grid',gap:16,width:320}}><h1>Wildlife Sentinel</h1>
      <label htmlFor="access-token">Access token</label><input id="access-token" type="password" autoComplete="off" required value={credential} onChange={e=>setCredential(e.target.value)}/>
      <button disabled={busy}>{busy ? 'Connecting…' : 'Sign in'}</button><p role="alert">{error}</p>
      <small>Use the role token supplied by your administrator. It stays in memory until sign-out or reload.</small>
    </form></main>;
}
