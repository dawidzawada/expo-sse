import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Platform, Pressable, Text, View } from 'react-native';
import { fetchSSE, SSEHttpError, SSEMessage } from '@dawidzawada/expo-sse';
import { logStyles, logTextStyles, styles } from './styles';

const BASE_URL =
  Platform.OS === 'android' ? 'http://10.0.2.2:3001' : 'http://localhost:3001';

type LogEntry = { type: 'event' | 'info' | 'error'; text: string; ts: string };

export default function App() {
  const [connected, setConnected] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const tokenRef = useRef<string | null>(null);

  const addLog = useCallback((type: LogEntry['type'], text: string) => {
    setLogs((prev) => [
      { type, text, ts: new Date().toLocaleTimeString() },
      ...prev,
    ]);
  }, []);

  const connect = useCallback(async () => {
    const controller = new AbortController();
    abortRef.current = controller;
    setConnected(true);

    try {
      const res = await fetch(`${BASE_URL}/auth`, { method: 'POST' });
      const { token } = await res.json();
      tokenRef.current = token;
      addLog('info', `Authenticated (token: ${token.slice(0, 8)}...)`);
    } catch (e) {
      addLog('error', `Auth failed: ${(e as Error).message}`);
      setConnected(false);
      return;
    }

    fetchSSE(`${BASE_URL}/events`, {
      signal: controller.signal,
      headers: async () => ({
        Authorization: `Bearer ${tokenRef.current}`,
      }),
      onMessage: (msg: SSEMessage) => {
        addLog('event', `[${msg.event}] ${msg.data}`);
      },
      onError: async (error: Error) => {
        if (error instanceof SSEHttpError && error.status === 401) {
          addLog('info', 'Token expired, refreshing...');
          try {
            const res = await fetch(`${BASE_URL}/refresh`, {
              method: 'POST',
            });
            const { token } = await res.json();
            tokenRef.current = token;
            addLog('info', `Token refreshed (${token.slice(0, 8)}...)`);
            return 0;
          } catch (e) {
            addLog('error', `Refresh failed: ${(e as Error).message}`);
          }
        }
        addLog('error', error.message);
      },
      onClose: () => {
        addLog('info', 'Stream closed, reconnecting...');
      },
    }).then(() => {
      setConnected(false);
    });
  }, [addLog]);

  const disconnect = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    tokenRef.current = null;
    setConnected(false);
    addLog('info', 'Disconnected');
  }, [addLog]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View
          style={[
            styles.dot,
            connected ? styles.dotConnected : styles.dotDisconnected,
          ]}
        />
        <Text style={styles.status}>
          {connected ? 'Connected' : 'Disconnected'}
        </Text>
      </View>

      <View style={styles.buttons}>
        <Pressable
          style={[styles.btn, styles.btnConnect]}
          onPress={connect}
          disabled={connected}
        >
          <Text style={styles.btnText}>Connect</Text>
        </Pressable>
        <Pressable
          style={[styles.btn, styles.btnDisconnect]}
          onPress={disconnect}
          disabled={!connected}
        >
          <Text style={styles.btnText}>Disconnect</Text>
        </Pressable>
      </View>

      <FlatList
        data={logs}
        keyExtractor={(_, i) => String(i)}
        style={styles.list}
        renderItem={({ item }) => (
          <View style={[styles.msg, logStyles[item.type]]}>
            <Text style={styles.ts}>{item.ts}</Text>
            <Text style={[styles.logText, logTextStyles[item.type]]}>
              {item.text}
            </Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No logs yet</Text>}
      />
    </View>
  );
}
