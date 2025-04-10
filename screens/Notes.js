import React, { useState, useCallback, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  TextInput, 
  ScrollView, 
  Alert,
  Animated,
  Platform,
  ActivityIndicator 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveNote, getNotes, deleteNote } from '../services/notesManager';
import { auth } from '../firebase';

const NOTE_COLORS = ['#FFB6C1', '#FFE4B5', '#98FB98', '#87CEEB', '#DDA0DD', '#F0E68C'];

export default function Notes({ navigation }) {
  const [notes, setNotes] = useState([]);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [selectedColor, setSelectedColor] = useState(NOTE_COLORS[0]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadNotes();
  }, []);

  useEffect(() => {
    // Set up the header button
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => setIsAddingNote(true)}
        >
          <Ionicons name="add-circle" size={28} color="#007AFF" />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  const loadNotes = async () => {
    setIsLoading(true);
    const user = auth.currentUser;
    if (!user) return;

    const userNotes = await getNotes(user.uid);
    setNotes(userNotes);
    setIsLoading(false);
  };

  const addNote = async () => {
    if (!newNoteText.trim()) return;

    const user = auth.currentUser;
    if (!user) return;

    const newNote = {
      text: newNoteText.trim(),
      color: selectedColor,
      rotation: Math.random() * 10 - 5
    };

    const result = await saveNote(user.uid, newNote);
    if (result.success) {
      setNewNoteText('');
      setIsAddingNote(false);
      loadNotes(); // Refresh notes
    }
  };

  const handleDeleteNote = async (id) => {
    const user = auth.currentUser;
    if (!user) return;

    Alert.alert(
      'Delete Note',
      'Are you sure you want to delete this note?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteNote(user.uid, id);
            loadNotes(); // Refresh notes
          }
        }
      ]
    );
  };

  const renderColorPicker = () => (
    <View style={styles.colorPicker}>
      {NOTE_COLORS.map(color => (
        <TouchableOpacity
          key={color}
          style={[
            styles.colorOption,
            { backgroundColor: color },
            selectedColor === color && styles.selectedColor
          ]}
          onPress={() => setSelectedColor(color)}
        />
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <>
          <ScrollView 
            style={styles.notesContainer} 
            contentContainerStyle={[
              styles.notesGrid,
              notes.length === 0 && styles.emptyNotesContainer
            ]}
          >
            {notes.length === 0 ? (
              <View style={styles.emptyStateContainer}>
                <Ionicons name="document-text-outline" size={64} color="#ccc" />
                <Text style={styles.emptyStateText}>No notes yet</Text>
                <TouchableOpacity 
                  style={styles.createFirstNoteButton}
                  onPress={() => setIsAddingNote(true)}
                >
                  <Text style={styles.createFirstNoteText}>Create Your First Note</Text>
                </TouchableOpacity>
              </View>
            ) : (
              notes.map(note => (
                <Animated.View
                  key={note.id}
                  style={[
                    styles.note,
                    {
                      backgroundColor: note.color || NOTE_COLORS[0],
                      transform: [{ rotate: `${note.rotation || 0}deg` }]
                    }
                  ]}
                >
                  <TouchableOpacity
                    style={styles.deleteNote}
                    onPress={() => handleDeleteNote(note.id)}
                  >
                    <Ionicons name="close-circle" size={20} color="#FF3B30" />
                  </TouchableOpacity>
                  <Text style={styles.noteText}>{note.text}</Text>
                  <View style={styles.noteShadow} />
                  <View style={styles.notePin} />
                </Animated.View>
              ))
            )}
          </ScrollView>

          {/* Modal for adding note */}
          {isAddingNote && (
            <View style={styles.addNoteContainer}>
              <TouchableOpacity
                style={styles.modalBackdrop}
                activeOpacity={1}
                onPress={() => setIsAddingNote(false)}
              />
              <View style={[styles.noteInput, { backgroundColor: selectedColor }]}>
                {renderColorPicker()}
                <TextInput
                  style={styles.input}
                  multiline
                  placeholder="Write your note..."
                  value={newNoteText}
                  onChangeText={setNewNoteText}
                  maxLength={200}
                  autoFocus
                />
                <View style={styles.noteActions}>
                  <TouchableOpacity 
                    style={styles.cancelButton} 
                    onPress={() => {
                      setIsAddingNote(false);
                      setNewNoteText('');
                    }}
                  >
                    <Ionicons name="close" size={24} color="#FF3B30" />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[
                      styles.addButton,
                      !newNoteText.trim() && styles.addButtonDisabled
                    ]}
                    onPress={addNote}
                    disabled={!newNoteText.trim()}
                  >
                    <Ionicons 
                      name="checkmark" 
                      size={24} 
                      color={newNoteText.trim() ? "#4CD964" : "#ccc"} 
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f4f4',
  },
  notesContainer: {
    flex: 1,
    padding: 16,
  },
  notesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingBottom: 80,
  },
  note: {
    width: '48%',
    minHeight: 150,
    padding: 16,
    marginBottom: 16,
    borderRadius: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 2, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  noteText: {
    fontSize: 16,
    lineHeight: 22,
    color: '#333',
  },
  noteShadow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  notePin: {
    position: 'absolute',
    top: -10,
    left: '50%',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#666',
    marginLeft: -6,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 2,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  deleteNote: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 1,
  },
  headerButton: {
    marginRight: 15,
    padding: 5,
  },
  addNoteContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  noteInput: {
    width: '90%',
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  input: {
    fontSize: 16,
    minHeight: 100,
    marginTop: 10,
  },
  noteActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
  },
  cancelButton: {
    padding: 8,
    marginRight: 10,
  },
  addButton: {
    padding: 8,
  },
  colorPicker: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  colorOption: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedColor: {
    borderColor: '#007AFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyNotesContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyStateText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 16,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  addButtonDisabled: {
    opacity: 0.5,
  },
  createFirstNoteButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  createFirstNoteText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
