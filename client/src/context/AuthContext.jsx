import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setUnauthorizedHandler } from '../services/api';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/auth/me', { silent: true }).then((r) => setUser(r.user || null)).catch(() => setUser(null)).finally(() => setLoading(false));
    setUnauthorizedHandler(() => setUser(null));
  }, []);

  const signIn = useCallback(async (payload) => { const r = await api.post('/auth/signin', payload); setUser(r.user); return r.user; }, []);
  const signUp = useCallback(async (payload) => { const r = await api.post('/auth/signup', payload); setUser(r.user); return r.user; }, []);
  const google = useCallback(async (idToken) => { const r = await api.post('/auth/google', { idToken }); setUser(r.user); return r; }, []);
  const signOut = useCallback(async () => { try { await api.get('/auth/signout'); } finally { setUser(null); } }, []);
  const refresh = useCallback(async () => { const r = await api.get('/auth/me'); setUser(r.user); return r.user; }, []);

  const value = useMemo(() => ({ user, setUser, loading, signIn, signUp, google, signOut, refresh }), [user, loading, signIn, signUp, google, signOut, refresh]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
