import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, FlatList, TextInput, TouchableOpacity, SafeAreaView, Text, Alert, Clipboard, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ChatDrawer from '../components/ChatDrawer';
import { collection, addDoc, doc, updateDoc, serverTimestamp, onSnapshot, limit, query, orderBy } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { getAIResponse } from '../services/ai';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, interpolate } from 'react-native-reanimated';
import Whiteboard from './Whiteboard';
import { cacheService } from '../services/cacheService';

export default function HomeScreen({ navigation, route }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [currentChatId, setCurrentChatId] = useState(null);
  const [chatTitle, setChatTitle] = useState('');
  const [isAIGenerating, setIsAIGenerating] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isWhiteboardOpen, setIsWhiteboardOpen] = useState(false);
  const whiteboardAnimation = useSharedValue(0);
  const animatedStyles = useAnimatedStyle(() => ({
    opacity: whiteboardAnimation.value,
    transform: [{ translateY: interpolate(whiteboardAnimation.value, [0, 1], [800, 0]) }],
  }));
  const flatListRef = useRef(null);
  const abortControllerRef = useRef(null);
  const [isFirstMessage, setIsFirstMessage] = useState(true); // Not used in the current logic, but kept for potential future use.

  const toggleDrawer = () => { setIsDrawerOpen(!isDrawerOpen); };

  const toggleWhiteboard = () => {
    whiteboardAnimation.value = withSpring(whiteboardAnimation.value === 0 ? 1 : 0, { damping: 15, stiffness: 150 });
    setIsWhiteboardOpen(!isWhiteboardOpen);
  };

  const setupHeader = (title) => {
    navigation.setOptions({
      headerShown: true,
      headerTitle: title || 'Chat',
      headerTitleAlign: 'center',
      headerStyle: { backgroundColor: '#f5f5f5' },
      headerTitleStyle: { fontWeight: 'bold', fontSize: 18 },
      headerLeft: () => (<TouchableOpacity onPress={toggleDrawer}><Ionicons name="menu" size={24} color="#007AFF" /></TouchableOpacity>),
      headerRight: () => (<TouchableOpacity onPress={toggleWhiteboard}><Ionicons name="pencil" size={24} color="#007AFF" /></TouchableOpacity>),
    });
  };

  useEffect(() => {
    if (route.params?.isNewChat) {
      setMessages([]);
      setCurrentChatId(null);
      const newTitle = route.params.title || 'New Chat';
      setChatTitle(newTitle);
      setupHeader(newTitle);
    } else if (route.params?.chatId) {
      loadChat(route.params.chatId);
    } else {
      setupHeader('Chat');
    }
  }, [route.params]);

  useEffect(() => {
    if (!route.params?.chatId && currentChatId) {
      setMessages([]);
      setCurrentChatId(null);
      setChatTitle('');
    }
  }, [route.params?.chatId]);

  useEffect(() => { setupHeader(chatTitle); }, [chatTitle, isDrawerOpen]);


  const loadChat = async (chatId) => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const cachedMessages = await cacheService.get(`@chat_${chatId}`);
      if (cachedMessages) {
        setMessages(cachedMessages);
        console.log("Loaded messages from cache:", cachedMessages);
      }

      const messagesRef = collection(db, 'users', user.uid, 'chats', chatId, 'messages');
      const q = query(messagesRef, orderBy('timestamp', 'asc'), limit(50));

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const newMessages = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate() || new Date(),
        }));

        setMessages(newMessages);
        console.log("onSnapshot triggered, new messages:", newMessages);
        cacheService.set(`@chat_${chatId}`, newMessages);
      });

      return unsubscribe;
    } catch (error) {
      console.error('Error loading chat:', error);
      return () => { };
    }
  };


  useEffect(() => {
    let unsubscribeFunction = null;
    const setupChatListener = async () => {
      if (currentChatId) { unsubscribeFunction = await loadChat(currentChatId); }
    };
    setupChatListener();
    return () => { if (typeof unsubscribeFunction === 'function') { unsubscribeFunction(); } };
  }, [currentChatId]);

  const stopAIResponse = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsAIGenerating(false);
    }
  };
  const handleSend = async () => {
    if (!inputText.trim() || isAIGenerating) return;

    const sanitizedInput = inputText.trim();
    setInputText('');

    const localUserMessage = {
      id: `local-${Date.now()}`,
      text: sanitizedInput,
      sender: 'user',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, localUserMessage]);
    console.log("Added local user message:", localUserMessage);

    try {
      setIsAIGenerating(true);
      abortControllerRef.current = new AbortController();

      let chatId = currentChatId;
      if (!chatId) {
        const chatRef = await addDoc(collection(db, 'users', auth.currentUser.uid, 'chats'), {
          createdAt: serverTimestamp(),
          title: sanitizedInput.substring(0, 30) + (sanitizedInput.length > 30 ? '...' : ''),
          lastMessage: sanitizedInput,
          lastMessageTime: serverTimestamp()
        });
        chatId = chatRef.id;
        setCurrentChatId(chatId);
        setChatTitle(sanitizedInput.substring(0, 30) + (sanitizedInput.length > 30 ? '...' : ''));
      }

      const messageRef = collection(db, 'users', auth.currentUser.uid, 'chats', chatId, 'messages');
      const userMessage = {
        text: sanitizedInput,
        sender: 'user',
        timestamp: serverTimestamp()
      };
      await addDoc(messageRef, userMessage);
      console.log("Added user message to Firestore:", userMessage);

      setMessages(prev => [...prev, { id: 'typing', isTyping: true }]);

      let aiResponse = await getAIResponse(
        sanitizedInput,
        messages.filter(m => m.id !== 'typing'),
        abortControllerRef.current.signal
      );

      setMessages(prev => prev.filter(m => m.id !== 'typing'));

      const localAiMessage = {
        id: `local-ai-${Date.now()}`,
        text: aiResponse,
        sender: 'ai',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, localAiMessage]);
      console.log("Added local AI message:", localAiMessage);


      const aiMessage = {
        text: aiResponse,
        sender: 'ai',
        timestamp: serverTimestamp()
      };
      await addDoc(messageRef, aiMessage);
      console.log("Added AI message to Firestore:", aiMessage);

      await updateDoc(doc(db, 'users', auth.currentUser.uid, 'chats', chatId), {
        lastMessage: aiResponse,
        lastMessageTime: serverTimestamp()
      });

      setTimeout(() => { flatListRef.current?.scrollToEnd({ animated: true }); }, 100);

    } catch (error) {
      console.error('Send error:', error);
      if (error.name !== 'AbortError') {
        Alert.alert('Error', 'Failed to send message. Please try again.');
      }
      setMessages(prev => prev.filter(m => m.id !== localUserMessage.id));
    } finally {
      setIsAIGenerating(false);
      abortControllerRef.current = null;
    }
  };


  const handleChatSelect = (chatId) => { navigation.navigate('Home', { chatId }); };

  const handleTitleChange = async (newTitle) => {
    if (!currentChatId) return;
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid, 'chats', currentChatId), { title: newTitle });
      setChatTitle(newTitle);
    } catch (error) { console.error('Error updating title:', error); }
  };

  const handleCopyToClipboard = (text) => {
    Clipboard.setString(text);
    Alert.alert('Copied to Clipboard', 'The selected text has been copied to your clipboard.');
  };

  const renderMessage = ({ item }) => {
    if (item.isTyping) {
      return (<View style={styles.typingIndicator}><Text style={styles.typingText}>AI is typing</Text></View>);
    }
    if (item.sender === 'user') {
      return (<View style={[styles.message, styles.userMessage]}><Text style={styles.messageText}>{item.text}</Text></View>);
    }
    if (item.sender === 'ai') {
      return (
        <View style={[styles.message, styles.aiMessage]}>
          <Text style={styles.messageText}>{item.text}</Text>
          <TouchableOpacity onPress={() => handleCopyToClipboard(item.text)} style={styles.copyButton}><Text style={styles.copyButtonText}>Copy</Text></TouchableOpacity>
        </View>
      );
    }
    return null;
  };

  const renderEmptyChat = () => {
    if (messages.length === 0 && isFirstMessage) {
      return (<View style={styles.emptyChatContainer}><Text style={styles.emptyChatText}>Start a new conversation!</Text></View>);
    }
    return null;
  };

  return (
    <SafeAreaView style={styles.container}>
      <ChatDrawer onChatSelect={handleChatSelect} navigation={navigation} isOpen={isDrawerOpen} onToggleDrawer={toggleDrawer} />
      {renderEmptyChat()}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.chatContainer}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={null}
      />
      <View style={styles.inputSection}>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type a message..."
            editable={!isAIGenerating}
          />
          <TouchableOpacity
            style={[styles.sendButton, isAIGenerating && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={isAIGenerating}
          >
            <Text style={styles.sendButtonText}>Send</Text>
          </TouchableOpacity>
        </View>
      </View>
      {isWhiteboardOpen && (
        <Animated.View style={[styles.whiteboardWindow, animatedStyles]}>
          <View style={styles.whiteboardHeader}>
            <View style={styles.windowControls}>
              <View style={[styles.windowButton, styles.closeButton]} />
              <View style={[styles.windowButton, styles.minimizeButton]} />
              <View style={[styles.windowButton, styles.maximizeButton]} />
            </View>
            <Text style={styles.whiteboardTitle}>Whiteboard</Text>
            <TouchableOpacity onPress={toggleWhiteboard} style={styles.closeWhiteboard}><Ionicons name="close" size={24} color="#333" /></TouchableOpacity>
          </View>
          <View style={styles.whiteboardContent}><Whiteboard /></View>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  chatContainer: { flexGrow: 1, padding: 10 },
  message: { marginVertical: 5, padding: 10, borderRadius: 10, maxWidth: '80%' },
  userMessage: { alignSelf: 'flex-end', backgroundColor: '#DCF8C6' },
  aiMessage: { alignSelf: 'flex-start', backgroundColor: '#E8E8E8' },
  inputSection: { borderTopWidth: 1, borderTopColor: '#ddd', backgroundColor: '#fff' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', padding: 10 },
  input: { flex: 1, padding: 10, borderWidth: 1, borderColor: '#ddd', borderRadius: 20, backgroundColor: '#fff' },
  sendButton: { marginLeft: 10, backgroundColor: '#007AFF', padding: 10, borderRadius: 20 },
  sendButtonDisabled: { opacity: 0.5 },
  sendButtonText: { color: '#fff', fontWeight: 'bold' },
  emptyChatContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyChatText: { fontSize: 18, color: '#999' },
  copyButton: { marginTop: 5, padding: 4, },
  copyButtonText: { color: '#007AFF', fontSize: 12, },
  whiteboardWindow: { position: 'absolute', top: '10%', left: '5%', right: '5%', bottom: '10%', backgroundColor: '#fff', borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2, }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5, overflow: 'hidden', },
  whiteboardHeader: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#f0f0f0', borderTopLeftRadius: 12, borderTopRightRadius: 12, },
  windowControls: { flexDirection: 'row', alignItems: 'center', marginRight: 15, },
  windowButton: { width: 12, height: 12, borderRadius: 6, marginHorizontal: 4, },
  closeButton: { backgroundColor: '#ff5f57', },
  minimizeButton: { backgroundColor: '#febc2e', },
  maximizeButton: { backgroundColor: '#28c940', },
  whiteboardTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '500', color: '#333', },
  closeWhiteboard: { padding: 4, },
  whiteboardContent: { flex: 1, backgroundColor: '#fff', },
  typingIndicator: { flexDirection: 'row', alignItems: 'center', padding: 8, },
  typingText: { color: '#666', fontSize: 14, marginRight: 8, },
});