/** Where the shared connection currently stands. */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { socketUrl } from '../lib/runtime';

export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export interface SocketContextValue {
  /** null until the user is authenticated and the client has been created. */
  socket: Socket | null;
  connection: ConnectionState;
}

const SocketContext = createContext<SocketContextValue | null>(null);

export const useSocket = (): SocketContextValue => {
  const context = useContext(SocketContext);
  if (!context) throw new Error('useSocket must be used within SocketProvider');
  return context;
};

// Share one authenticated connection across the dashboard. Opening one socket
// in the layout and another in every page doubled traffic and event fan-out.
export const SocketProvider = ({ children }: { children: ReactNode }) => {
  const { user, isAuthenticated } = useAuth();
  const userId = user?._id;
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connection, setConnection] = useState<ConnectionState>('idle');
  const [browserOnline, setBrowserOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    if (!isAuthenticated || !userId) {
      setSocket(null);
      setConnection('idle');
      return undefined;
    }

    setConnection('connecting');
    let client: Socket | null = null;
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const onConnect = () => setConnection('connected');
    const onDisconnect = (reason: string) => {
      if (reason !== 'io client disconnect') setConnection('disconnected');
    };
    const onReconnectAttempt = () => setConnection('reconnecting');
    // Socket.IO learns about a lost network only after its heartbeat times
    // out. The browser already knows immediately, so reflect that state in
    // the shell and ask the shared socket to reconnect as soon as the network
    // returns.
    const onOffline = () => {
      setBrowserOnline(false);
      setConnection('disconnected');
    };
    const onOnline = () => {
      setBrowserOnline(true);
      if (client?.connected) setConnection('connected');
      else {
        setConnection('reconnecting');
        client?.connect();
      }
    };
    // A refusal from the server's middleware is not retried by the client on
    // its own. Too many handshakes from this address is temporary, so try
    // again after a while (backend/src/socket/auth.ts).
    const onConnectError = (error: Error) => {
      setConnection('disconnected');
      if (error?.message !== 'RATE_LIMITED') return;
      clearTimeout(retry);
      retry = setTimeout(() => client?.connect(), 5000 + Math.random() * 10000);
    };

    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);

    void import('socket.io-client')
      .then(({ io }) => {
        if (cancelled) return;
        client = io(socketUrl('/admin'), {
          // El sıkışması oturum çerezini taşır; token'ı okuyup göndermeye gerek yok.
          withCredentials: true,
          transports: ['websocket', 'polling'],
          reconnection: true,
          // 1 s to 30 s with jitter, like the widget (PERF-06).
          reconnectionDelay: 1000,
          reconnectionDelayMax: 30000,
          randomizationFactor: 0.5,
          timeout: 15000
        });
        client.on('connect', onConnect);
        client.on('disconnect', onDisconnect);
        client.on('connect_error', onConnectError);
        client.io.on('reconnect_attempt', onReconnectAttempt);
        setSocket(client);
      })
      .catch(() => {
        if (!cancelled) setConnection('disconnected');
      });

    return () => {
      cancelled = true;
      client?.off('connect', onConnect);
      client?.off('disconnect', onDisconnect);
      client?.off('connect_error', onConnectError);
      client?.io.off('reconnect_attempt', onReconnectAttempt);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
      clearTimeout(retry);
      client?.close();
      setSocket((current) => (current === client ? null : current));
    };
  }, [isAuthenticated, userId]);

  // A late socket event must not hide the browser's authoritative offline
  // signal while a transport is still winding down.
  const visibleConnection = browserOnline ? connection : 'disconnected';
  const value = useMemo<SocketContextValue>(
    () => ({ socket, connection: visibleConnection }),
    [socket, visibleConnection]
  );
  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};
