import React, { useEffect, useRef, useState } from 'react';
import { SafeAreaView, View, Text, FlatList, TextInput, Button, StyleSheet, TouchableOpacity } from 'react-native';
import { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate } from 'react-native-webrtc';

interface User {
  id: string;
  ip: string;
  isOnline: boolean;
}

interface Message {
  id: string;
  text: string;
  sender: string;
  timestamp: Date;
  isFile?: boolean;
  filename?: string;
}

export default function App() {
  const [sessionId, setSessionId] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [messageInput, setMessageInput] = useState('');
  const ws = useRef<WebSocket | null>(null);
  const peerConns = useRef<Record<string, RTCPeerConnection>>({});
  const dataChannels = useRef<Record<string, any>>({});

  useEffect(() => {
    const id = Math.floor(10000 + Math.random() * 90000).toString();
    setSessionId(id);
    const socket = new WebSocket('wss://rt-share.diesing.pro:3000/');
    ws.current = socket;
    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'join', payload: id }) + '\n');
    };
    socket.onmessage = event => {
      const evt = JSON.parse(event.data);
      if (evt.type === 'join' && evt.status === 'ok') {
        const list: Array<{ id: string; ip: string }> = JSON.parse(evt.data);
        setUsers(list.map(u => ({ ...u, isOnline: true })));
        list.forEach(u => {
          if (u.id !== id) createPeerConnection(u.id, id > u.id);
        });
      } else if (evt.type === 'join' && evt.status === 'userJoin') {
        const userID = evt.data;
        const ip = evt.ip;
        setUsers(prev =>
          prev.some(u => u.id === userID)
            ? prev.map(u => (u.id === userID ? { ...u, isOnline: true, ip } : u))
            : [...prev, { id: userID, ip, isOnline: true }]
        );
        if (userID !== id) createPeerConnection(userID, id > userID);
      } else if (evt.type === 'leave' && evt.status === 'userLeft') {
        const userID = evt.data;
        setUsers(prev => prev.map(u => (u.id === userID ? { ...u, isOnline: false } : u)));
        cleanup(userID);
      } else if (evt.type === 'offer' && evt.status === 'forward') {
        handleOffer(evt.sender, evt.data);
      } else if (evt.type === 'answer' && evt.status === 'forward') {
        handleAnswer(evt.sender, evt.data);
      } else if (evt.type === 'candidate' && evt.status === 'forward') {
        handleCandidate(evt.sender, evt.data);
      }
    };
    return () => {
      socket.close();
    };
  }, []);

  const cleanup = (id: string) => {
    try { dataChannels.current[id]?.close(); } catch {}
    try { peerConns.current[id]?.close(); } catch {}
    delete dataChannels.current[id];
    delete peerConns.current[id];
  };

  const createPeerConnection = (id: string, initiate: boolean) => {
    if (peerConns.current[id]) return;
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
      ],
    });
    peerConns.current[id] = pc;
    pc.onicecandidate = e => {
      if (e.candidate && ws.current) {
        ws.current.send(
          JSON.stringify({ type: 'candidate', payload: id, text: JSON.stringify(e.candidate) }) + '\n'
        );
      }
    };
    pc.ondatachannel = ev => setupDataChannel(id, ev.channel);
    if (initiate) {
      const ch = pc.createDataChannel('chat');
      setupDataChannel(id, ch);
      pc.createOffer()
        .then(o => pc.setLocalDescription(o))
        .then(() => {
          if (ws.current && pc.localDescription) {
            ws.current.send(
              JSON.stringify({ type: 'offer', payload: id, text: JSON.stringify(pc.localDescription) }) + '\n'
            );
          }
        });
    }
  };

  const setupDataChannel = (id: string, ch: any) => {
    dataChannels.current[id] = ch;
    ch.onmessage = e => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'text') {
        const newMessage: Message = {
          id: Date.now().toString(),
          text: msg.text,
          sender: id,
          timestamp: new Date(),
        };
        setMessages(prev => ({ ...prev, [id]: [...(prev[id] || []), newMessage] }));
      }
    };
  };

  const handleOffer = (id: string, data: string) => {
    createPeerConnection(id, false);
    const pc = peerConns.current[id];
    if (!pc) return;
    pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(data))).then(() =>
      pc.createAnswer().then(a => pc.setLocalDescription(a)).then(() => {
        if (ws.current && pc.localDescription) {
          ws.current.send(
            JSON.stringify({ type: 'answer', payload: id, text: JSON.stringify(pc.localDescription) }) + '\n'
          );
        }
      })
    );
  };

  const handleAnswer = (id: string, data: string) => {
    const pc = peerConns.current[id];
    if (pc) pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(data)));
  };

  const handleCandidate = (id: string, data: string) => {
    const pc = peerConns.current[id];
    if (pc) pc.addIceCandidate(new RTCIceCandidate(JSON.parse(data)));
  };

  const sendMessage = () => {
    if (!selectedUser) return;
    const ch = dataChannels.current[selectedUser];
    if (!ch) return;
    ch.send(JSON.stringify({ type: 'text', text: messageInput }));
    const newMessage: Message = {
      id: Date.now().toString(),
      text: messageInput,
      sender: sessionId,
      timestamp: new Date(),
    };
    setMessages(prev => ({ ...prev, [selectedUser]: [...(prev[selectedUser] || []), newMessage] }));
    setMessageInput('');
  };

  const renderUser = ({ item }: { item: User }) => (
    <TouchableOpacity style={styles.user} onPress={() => setSelectedUser(item.id)}>
      <Text style={styles.userText}>{item.id} {item.isOnline ? '' : '(offline)'}</Text>
    </TouchableOpacity>
  );

  const renderMessage = ({ item }: { item: Message }) => (
    <View style={[styles.msg, item.sender === sessionId ? styles.me : styles.other]}>
      <Text>{item.sender === sessionId ? 'Me' : item.sender}: {item.text}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {selectedUser ? (
        <View style={styles.chatContainer}>
          <FlatList
            data={messages[selectedUser] || []}
            keyExtractor={m => m.id}
            renderItem={renderMessage}
            style={styles.msgList}
          />
          <View style={styles.inputRow}>
            <TextInput style={styles.input} value={messageInput} onChangeText={setMessageInput} />
            <Button title="Send" onPress={sendMessage} />
          </View>
          <Button title="Back" onPress={() => setSelectedUser(null)} />
        </View>
      ) : (
        <FlatList data={users.filter(u => u.id !== sessionId)} keyExtractor={u => u.id} renderItem={renderUser} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  user: { padding: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  userText: { fontSize: 16 },
  chatContainer: { flex: 1 },
  msgList: { flex: 1 },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, borderWidth: 1, padding: 8, marginRight: 8 },
  msg: { padding: 8, marginVertical: 4, borderRadius: 4 },
  me: { backgroundColor: '#e6ffee' },
  other: { backgroundColor: '#eeeeff' },
});
