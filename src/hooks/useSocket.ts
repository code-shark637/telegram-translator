import { useEffect, useRef, useCallback } from 'react';
import Cookies from 'js-cookie';

export function useSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const messageHandlers = useRef<Set<(data: any) => void>>(new Set());

  useEffect(() => {
    const token = Cookies.get('auth_token');

    if (token && !wsRef.current) {
      const ws = new WebSocket(`ws://localhost:8000/ws?token=${token}`);

      ws.onopen = () => {
        console.log('WebSocket connected');

        const heartbeat = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000);

        ws.addEventListener('close', () => {
          clearInterval(heartbeat);
        });
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          messageHandlers.current.forEach(handler => handler(data));
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        wsRef.current = null;
      };

      wsRef.current = ws;
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  const onMessage = useCallback((handler: (data: any) => void) => {
    messageHandlers.current.add(handler);

    return () => {
      messageHandlers.current.delete(handler);
    };
  }, []);

  const sendMessage = useCallback((data: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  return {
    ws: wsRef.current,
    onMessage,
    sendMessage,
  };
}