import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import Cookies from 'js-cookie';

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const token = Cookies.get('auth_token');
    
    if (token && !socketRef.current) {
      socketRef.current = io('http://localhost:3001', {
        auth: {
          token,
        },
      });

      socketRef.current.on('connect', () => {
        console.log('Socket connected');
      });

      socketRef.current.on('disconnect', () => {
        console.log('Socket disconnected');
      });
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  const joinRoom = (accountId: number) => {
    if (socketRef.current) {
      socketRef.current.emit('join_room', { accountId });
    }
  };

  const leaveRoom = (accountId: number) => {
    if (socketRef.current) {
      socketRef.current.emit('leave_room', { accountId });
    }
  };

  return {
    socket: socketRef.current,
    joinRoom,
    leaveRoom,
  };
}