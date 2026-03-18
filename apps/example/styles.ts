import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, paddingTop: 60, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  dotConnected: { backgroundColor: '#4CAF50' },
  dotDisconnected: { backgroundColor: '#F44336' },
  status: { fontSize: 16, fontWeight: '600' },
  buttons: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  btn: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center' },
  btnConnect: { backgroundColor: '#4CAF50' },
  btnDisconnect: { backgroundColor: '#F44336' },
  btnText: { color: '#fff', fontWeight: '600' },
  list: { flex: 1 },
  msg: {
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
    borderLeftWidth: 3,
  },
  ts: { fontSize: 10, color: '#999', marginBottom: 2 },
  logText: { fontSize: 13 },
  empty: { textAlign: 'center', color: '#999', marginTop: 24 },
});

export const logStyles = StyleSheet.create({
  event: { backgroundColor: '#f5f5f5', borderLeftColor: '#4CAF50' },
  info: { backgroundColor: '#E3F2FD', borderLeftColor: '#2196F3' },
  error: { backgroundColor: '#FFEBEE', borderLeftColor: '#F44336' },
});

export const logTextStyles = StyleSheet.create({
  event: { color: '#333' },
  info: { color: '#1565C0' },
  error: { color: '#C62828' },
});
