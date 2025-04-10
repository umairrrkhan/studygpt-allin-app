import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../firebase';
import { collection, query, orderBy, getDocs, addDoc, doc, setDoc, deleteDoc, onSnapshot, writeBatch, updateDoc, limit } from 'firebase/firestore';
import moment from 'moment';
import Animated, { 
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import Modal from 'react-native-modal';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

const ChatDrawer = ({ onChatSelect, navigation, isOpen, onToggleDrawer }) => {
  const [chats, setChats] = useState([]);
  const user = auth.currentUser;
  const drawerAnimation = useSharedValue(-300);
  const [selectedChat, setSelectedChat] = useState(null);
  const [isOptionsModalVisible, setIsOptionsModalVisible] = useState(false);
  const [optionsPosition, setOptionsPosition] = useState({ x: 0, y: 0 });
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const scrollViewRef = useRef(null);
  const [isScrolling, setIsScrolling] = useState(false);

  // Update animation effect for smoother transition
  useEffect(() => {
    drawerAnimation.value = withSpring(isOpen ? 0 : -300, {
      damping: 20,
      stiffness: 150,
      mass: 0.5,
    });
  }, [isOpen]);

  // Create animated style
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: drawerAnimation.value }],
  }));

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const chatsRef = collection(db, 'users', user.uid, 'chats');
    const q = query(chatsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const chatsPromises = snapshot.docs.map(async (chatDoc) => {
        const chatData = chatDoc.data();
        
        // Get first message to use as title if not already set
        if (!chatData.title) {
          const messagesRef = collection(db, 'users', user.uid, 'chats', chatDoc.id, 'messages');
          const messagesQuery = query(messagesRef, orderBy('timestamp', 'asc'), limit(1));
          const messageSnap = await getDocs(messagesQuery);
          
          if (!messageSnap.empty) {
            const firstMessage = messageSnap.docs[0].data();
            // Create title from first message, limit to 30 chars
            let autoTitle = firstMessage.text.trim().substring(0, 30);
            if (firstMessage.text.length > 30) autoTitle += '...';
            
            // Update chat document with auto-generated title
            await updateDoc(doc(db, 'users', user.uid, 'chats', chatDoc.id), {
              title: autoTitle
            });
            chatData.title = autoTitle;
          }
        }

        return {
          id: chatDoc.id,
          ...chatData,
          createdAt: chatData.createdAt || new Date()
        };
      });

      const chatsWithTitles = await Promise.all(chatsPromises);
      setChats(chatsWithTitles);
    });

    return () => unsubscribe();
  }, []);

  const handleNewChat = async () => {
    try {
      onToggleDrawer(); // Close drawer when creating new chat
      navigation.navigate('Home', { 
        isNewChat: true,
        shouldShowHeader: true,
        title: 'New Chat'
      });
    } catch (error) {
      console.error('Error creating new chat:', error);
      Alert.alert('Error', 'Failed to create new chat');
    }
  };

  const handleArchiveChat = async (chatId, chat) => {
    try {
      const user = auth.currentUser;
      if (!user) {
        Alert.alert('Error', 'You must be logged in to archive chats');
        return;
      }

      // First, create the archived chat document
      await setDoc(doc(db, 'userChats', user.uid, 'archived', chatId), {
        ...chat,
        archivedAt: new Date(),
        userId: user.uid // Add user ID for security rules
      });

      console.log('Created archived chat document'); // Debug log

      // Then delete from active chats
      await deleteDoc(doc(db, 'userChats', user.uid, 'chats', chatId));
      console.log('Deleted from active chats'); // Debug log

      // Update local state
      setChats((prevChats) => {
        const newChats = prevChats.filter((c) => c.id !== chatId);
        console.log('Updated local state, remaining chats:', newChats.length); // Debug log
        return newChats;
      });

      // Show success message
      Alert.alert('Success', 'Chat archived successfully');

      // Close drawer if it's open
      if (isOpen) {
        onToggleDrawer(); // Close drawer after archiving
      }
    } catch (error) {
      console.error('Error archiving chat:', error);
      Alert.alert(
        'Error',
        'Failed to archive chat. Please try again.\n' + error.message
      );
    }
  };

  const handleLongPress = (chat, event) => {
    const { pageY } = event.nativeEvent;
    // Set position above the pressed item
    setMenuPosition({ y: pageY - 150 }); // Adjust this value to position menu above
    setSelectedChat(chat);
  };

  const confirmDelete = (chat) => {
    Alert.alert(
      'Delete Chat',
      'Are you sure you want to delete this chat?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => handleDeleteChat(chat)
        }
      ]
    );
  };

  const handleDeleteChat = async (chat) => {
    try {
      if (!chat) return;
      const user = auth.currentUser;
      if (!user) return;

      // Remove from local state first for instant UI update
      setChats(prevChats => prevChats.filter(c => c.id !== chat.id));
      setSelectedChat(null);

      // Update paths to match the correct structure
      const batch = writeBatch(db);
      const chatRef = doc(db, 'users', user.uid, 'chats', chat.id);
      batch.delete(chatRef);

      // Update messages path
      const messagesRef = collection(db, 'users', user.uid, 'chats', chat.id, 'messages');
      const messagesSnap = await getDocs(messagesRef);
      
      messagesSnap.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit().catch(console.error);

    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  const handleSaveAsPDF = async (chat) => {
    try {
      const user = auth.currentUser;
      if (!user || !chat) return;

      // Show loading alert
      Alert.alert('Processing', 'Generating PDF...');

      // Update messages path to match correct structure
      const messagesRef = collection(db, 'users', user.uid, 'chats', chat.id, 'messages');
      const messagesSnapshot = await getDocs(query(messagesRef, orderBy('timestamp', 'asc')));
      
      const htmlContent = `
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              .message { margin: 10px 0; padding: 10px; border-radius: 5px; }
              .user { background: #DCF8C6; margin-left: 20%; }
              .ai { background: #E8E8E8; margin-right: 20%; }
              .timestamp { color: #666; font-size: 12px; margin-top: 5px; }
            </style>
          </head>
          <body>
            <h2>${chat.title || 'Chat History'}</h2>
            ${messagesSnapshot.docs.map(doc => {
              const msg = doc.data();
              const timestamp = msg.timestamp?.toDate?.() || new Date();
              const timeStr = moment(timestamp).format('MMM D, YYYY h:mm A');
              return `
                <div class="message ${msg.sender === 'user' ? 'user' : 'ai'}">
                  <div>${msg.text}</div>
                  <div class="timestamp">${timeStr}</div>
                </div>
              `;
            }).join('')}
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false
      });

      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Save ${chat.title || 'Chat'} History`
      });

    } catch (error) {
      console.error('Error saving as PDF:', error);
      Alert.alert('Error', 'Failed to save chat as PDF');
    }
  };

  const groupChats = (chats) => {
    if (!Array.isArray(chats)) return { today: [], yesterday: [], older: [] };
  
    const today = moment().startOf('day');
    const yesterday = moment().subtract(1, 'days').startOf('day');
  
    return chats.reduce((groups, chat) => {
      if (!chat.createdAt) {
        groups.today.push(chat);
        return groups;
      }
  
      // Safely handle the timestamp
      const chatDate = chat.createdAt?.toDate ? 
        moment(chat.createdAt.toDate()) : 
        moment(chat.createdAt);
  
      if (chatDate.isSame(today, 'day')) {
        groups.today.push(chat);
      } else if (chatDate.isSame(yesterday, 'day')) {
        groups.yesterday.push(chat);
      } else {
        groups.older.push(chat);
      }
      
      return groups;
    }, { today: [], yesterday: [], older: [] });
  };
  
  const formatChatTime = (timestamp) => {
    if (!timestamp) return '';
    try {
      if (timestamp.toDate) {
        return moment(timestamp.toDate()).format('h:mm A');
      }
      return moment(timestamp).format('h:mm A');
    } catch (error) {
      console.error('Error formatting time:', error);
      return '';
    }
  };
  
  const renderChatGroup = (chats, title) => {
    if (!chats || chats.length === 0) return null;
  
    return (
      <View style={styles.chatGroupContainer}>
        <Text style={styles.timeGroupHeader}>{title}</Text>
        {chats.map(chat => (
          <View key={chat.id} style={[styles.chatItemContainer]}>
            <TouchableOpacity 
              style={styles.chatItem}
              onPress={() => onChatSelect(chat.id)}
            >
              <Ionicons name="chatbubble-outline" size={20} color="#666" />
              <View style={styles.chatInfo}>
                <Text style={styles.chatTitle} numberOfLines={1}>
                  {chat.title || 'New Chat'}
                </Text>
                <Text style={styles.chatTime}>
                  {formatChatTime(chat.createdAt)}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuButton}
              onPress={(event) => {
                const { pageY } = event.nativeEvent;
                setMenuPosition({ y: pageY - 150 });
                setSelectedChat(chat);
              }}
            >
              <Ionicons name="ellipsis-vertical" size={20} color="#666" />
            </TouchableOpacity>
          </View>
        ))}
      </View>
    );
  };

  const handleSettingsPress = () => {
    navigation.navigate('Settings');
  };

  const OptionsMenu = ({ chat, position }) => {
    if (!chat) return null;

    return (
      <View 
        style={[
          styles.optionsMenuContainer,
          {
            top: position.y,
            left: 50,
            position: 'absolute',
          }
        ]}
      >
        <View style={styles.optionsMenu}>
          <TouchableOpacity 
            style={styles.optionItem}
            onPress={() => {
              handleSaveAsPDF(chat);
              setSelectedChat(null);
            }}
          >
            <Ionicons name="document-text-outline" size={20} color="#007AFF" />
            <Text style={styles.optionText}>Save as PDF</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.optionItem}
            onPress={() => {
              handleArchiveChat(chat.id, chat);
              setSelectedChat(null);
            }}
          >
            <Ionicons name="archive-outline" size={20} color="#007AFF" />
            <Text style={styles.optionText}>Archive Chat</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.optionItem, styles.deleteOption]}
            onPress={() => {
              confirmDelete(chat);
              setSelectedChat(null);
            }}
          >
            <Ionicons name="trash-outline" size={20} color="#FF3B30" />
            <Text style={[styles.optionText, { color: '#FF3B30' }]}>Delete Chat</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <>
      {isOpen && (
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={() => {
            setSelectedChat(null); // Close options menu
            onToggleDrawer(); // Close drawer
          }}
        />
      )}

      <Animated.View 
        style={[
          styles.drawer,
          animatedStyle
        ]}
      >
        <View style={styles.profileSection}>
          <TouchableOpacity 
            style={styles.profile}
            onPress={() => navigation.navigate('UserProfile')}
          >
            <View style={styles.profileIcon}>
              <Ionicons name="person-circle" size={32} color="#007AFF" />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName} numberOfLines={1}>
                {user?.displayName || 'User'}
              </Text>
              <Text style={styles.profileEmail} numberOfLines={1}>
                {user?.email}
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.settingsButton}
            onPress={handleSettingsPress}
          >
            <Ionicons name="settings-outline" size={22} color="#333" />
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scrollViewRef}
          style={styles.chatList}
          showsVerticalScrollIndicator={true}
          scrollEventThrottle={16}
          onScrollBeginDrag={() => setIsScrolling(true)}
          onScrollEndDrag={() => setIsScrolling(false)}
          onMomentumScrollEnd={() => setIsScrolling(false)}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.fixedButtons}>
            <TouchableOpacity style={styles.newChat} onPress={handleNewChat}>
              <Ionicons name="add-circle-outline" size={24} color="#333" />
              <Text style={styles.newChatText}>New Chat</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.newChat}
              onPress={() => navigation.navigate('Projects')}
            >
              <Ionicons name="folder-outline" size={24} color="#333" />
              <Text style={styles.newChatText}>Projects</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.newChat} 
              onPress={() => navigation.navigate('Features')}
            >
              <Ionicons name="apps-outline" size={24} color="#333" />
              <Text style={styles.newChatText}>Features</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.chatGroups}>
            {(() => {
              const groups = groupChats(chats);
              return (
                <>
                  {renderChatGroup(groups.today, 'Today')}
                  {renderChatGroup(groups.yesterday, 'Yesterday')}
                  {renderChatGroup(groups.older, 'Older')}
                </>
              );
            })()}
          </View>
        </ScrollView>
        
        {/* Add backdrop for options menu */}
        {selectedChat && (
          <>
            <TouchableOpacity
              style={styles.optionsBackdrop}
              activeOpacity={1}
              onPress={() => setSelectedChat(null)}
            />
            <OptionsMenu chat={selectedChat} position={menuPosition} />
          </>
        )}
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 98,
  },
  drawer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 300,
    backgroundColor: '#fff',
    borderRightWidth: 1,
    borderRightColor: '#eee',
    zIndex: 99,
    shadowColor: "#000",
    shadowOffset: {
      width: 2,
      height: 0,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingTop: 20, // Adjusted paddingTop to reduce space
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  profile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileIcon: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: '#e3f2fd',
  },
  profileInfo: {
    flex: 1,
    marginLeft: 8,
    marginRight: 8,
  },
  profileName: {
    fontSize: 14,
    fontWeight: '600',
  },
  profileEmail: {
    fontSize: 11,
    color: '#666',
  },
  settingsButton: {
    padding: 6,
  },
  chatList: {
    flex: 1,
  },
  newChat: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  newChatText: {
    marginLeft: 12,
    fontSize: 16,
  },
  chatItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    justifyContent: 'space-between', // Add this
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  chatTitle: {
    marginLeft: 12,
    fontSize: 14,
    flex: 1,
    color: '#333',
  },
  chatOptions: {
    padding: 8,
  },
  timeGroupHeader: {
    padding: 10,
    paddingLeft: 15,
    backgroundColor: '#f5f5f5',
    fontWeight: 'bold',
    color: '#666',
    position: 'sticky',
    top: 0,
    zIndex: 1,
  },
  chatInfo: {
    flex: 1,
    marginLeft: 12,
  },
  chatTime: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  chatTitle: {
    fontSize: 14,
    color: '#333',
  },
  archiveButton: {
    padding: 10,
    marginLeft: 10,
  },
  optionsBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  
  optionsMenu: {
    backgroundColor: 'white',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    position: 'absolute',
    right: 16, // Position menu to the right
    width: 180,
  },
  
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  
  menuButton: {
    padding: 8,
    marginLeft: 8,
  },
  
  deleteOption: {
    borderBottomWidth: 0,
  },
  optionsMenuContainer: {
    position: 'absolute',
    zIndex: 1000,
    width: 200,
    // Remove any top/bottom margin or padding
  },
  scrollContent: {
    flexGrow: 1,
  },

  fixedButtons: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },

  chatGroups: {
    flexGrow: 1,
  },

  chatGroupContainer: {
    marginBottom: 8,
  },

  lastChatItem: {
    marginBottom: 20, // Add extra padding at bottom
  },
});

export default ChatDrawer;
