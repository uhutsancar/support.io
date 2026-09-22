/** Where the shared connection currently stands. */
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { io } from 'socket.io-client';
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
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connection, setConnection] = useState<ConnectionState>('idle');

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setSocket(null);
      setConnection('idle');
      return undefined;
    }

    setConnection('connecting');
    const client = io(socketUrl('/admin'), {
      // El sıkışması oturum çerezini taşır; token'ı okuyup göndermeye gerek yok.
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 800,
      reconnectionDelayMax: 8000,
      randomizationFactor: 0.5,
      timeout: 15000
    });

    const onConnect = () => setConnection('connected');
    const onDisconnect = (reason: string) => {
      if (reason !== 'io client disconnect') setConnection('disconnected');
    };
    const onReconnectAttempt = () => setConnection('reconnecting');
    const onConnectError = () => setConnection('disconnected');

    client.on('connect', onConnect);
    client.on('disconnect', onDisconnect);
    client.on('connect_error', onConnectError);
    client.io.on('reconnect_attempt', onReconnectAttempt);
    setSocket(client);

    return () => {
      client.off('connect', onConnect);
      client.off('disconnect', onDisconnect);
      client.off('connect_error', onConnectError);
      client.io.off('reconnect_attempt', onReconnectAttempt);
      client.close();
      setSocket((current) => (current === client ? null : current));
    };
  }, [isAuthenticated, user?._id]);

  const value = useMemo<SocketContextValue>(() => ({ socket, connection }), [socket, connection]);
  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};
