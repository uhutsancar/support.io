/** What every consumer of useAuth() gets. */
import { createContext, useContext, useState, useEffect } from 'react';
import { hasSession, purgeLegacyStorage } from '../lib/session';
import type { ReactNode } from 'react';
import { authAPI, isPendingSecondStep } from '../services/api';
import type { AuthResponse, LoginResponse, RegisterPayload } from '../services/api';
import type { CurrentUser } from '../types/api';

export interface AuthContextValue {
  user: CurrentUser | null;
  loading: boolean;
  /** A session, or a pending second step (two-step sign-in). */
  login(email: string, password: string): Promise<LoginResponse>;
  /** Trades the pending token and a code for the session. */
  loginSecondStep(data: {
    mfaToken: string;
    code?: string;
    recoveryCode?: string;
  }): Promise<AuthResponse>;
  /** E-mail first: mails the link and starts no session. */
  register(data: RegisterPayload): Promise<void>;
  /** Takes over a session the server just started (verification link). */
  signedIn(data: AuthResponse): void;
  logout(): Promise<void>;
  /** Updates fields on the signed-in user without reloading the app. */
  patchUser(updates: Partial<CurrentUser>): void;
  /** Re-reads the session from the server, e.g. after accepting an invitation. */
  refresh(): Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);
export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    checkAuth();
  }, []);
  // Oturumun hiçbir parçası tarayıcıda kalıcı olarak tutulmuyor: token
  // httpOnly çerezde (JavaScript göremez), profil yalnızca bu bileşenin
  // belleğinde ve her açılışta sunucudan geliyor. Ayrıntı: lib/session.ts
  const toCurrentUser = (u: CurrentUser): CurrentUser => (u.id && !u._id ? { ...u, _id: u.id } : u);

  const checkAuth = async () => {
    purgeLegacyStorage();
    // CSRF eşi yoksa oturum çerezi de yoktur; sunucuya boşuna gidilmez.
    if (!hasSession()) {
      setLoading(false);
      return;
    }
    try {
      const response = await authAPI.me();
      setUser(toCurrentUser(response.data.user));
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };
  const login = async (email: string, password: string) => {
    const response = await authAPI.login({ email, password });
    if (!isPendingSecondStep(response.data)) setUser(toCurrentUser(response.data.user));
    return response.data;
  };
  const loginSecondStep = async (data: {
    mfaToken: string;
    code?: string;
    recoveryCode?: string;
  }) => {
    const response = await authAPI.loginSecondStep(data);
    setUser(toCurrentUser(response.data.user));
    return response.data;
  };
  const register = async (data: RegisterPayload) => {
    await authAPI.register(data);
  };
  const signedIn = (data: AuthResponse) => setUser(toCurrentUser(data.user));
  const logout = async () => {
    try {
      await authAPI.logout();
    } catch {
      // Sunucuya ulaşılamasa bile bu sekmedeki oturum durumu temizlenir;
      // çerez zaten sunucunun işi.
    }
    purgeLegacyStorage();
    setUser(null);
  };
  /**
   * Oturumdaki kullanicinin alanlarini yerinde gunceller.
   *
   * Bunun olmamasi, DashboardLayout'ta durum degistirmenin
   * `window.location.reload()` ile yapilmasina sebep oluyordu: tum uygulama
   * bastan yukleniyor, acik konusma ve soket baglantisi kopuyordu.
   */
  const patchUser = (updates: Partial<CurrentUser>) => {
    setUser((current) => {
      if (!current) return current;
      return { ...current, ...updates };
    });
  };

  const value: AuthContextValue = {
    user,
    loading,
    login,
    loginSecondStep,
    register,
    signedIn,
    logout,
    patchUser,
    refresh: checkAuth,
    isAuthenticated: !!user
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
