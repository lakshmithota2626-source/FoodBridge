import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api/client';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(localStorage.getItem('fb_token')));

  const logout = useCallback(() => { localStorage.removeItem('fb_token'); setUser(null); }, []);

  const refresh = useCallback(async () => {
    const { data } = await api.get('/auth/me');
    setUser(data.user);
    return data.user;
  }, []);

  useEffect(() => {
    if (localStorage.getItem('fb_token')) refresh().catch(logout).finally(() => setLoading(false));
    window.addEventListener('fb:logout', logout);
    return () => window.removeEventListener('fb:logout', logout);
  }, [refresh, logout]);

  const authenticate = async (path, body) => {
    const { data } = await api.post(path, body);
    localStorage.setItem('fb_token', data.token);
    setUser(data.user);
    return data.user;
  };

  const value = useMemo(() => ({
    user, loading, logout, refresh, setUser,
    login: (email, password) => authenticate('/auth/login', { email, password }),
    register: (payload) => authenticate('/auth/register', payload),
  }), [user, loading, logout, refresh]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
