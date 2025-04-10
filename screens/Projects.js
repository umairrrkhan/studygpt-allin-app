import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView,
  Alert,
  TextInput,
  Modal,
  FlatList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, orderBy, getDocs, addDoc, doc, updateDoc, deleteDoc, where, writeBatch } from 'firebase/firestore';
import { db, auth } from '../firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Projects({ navigation }) {
  const [projects, setProjects] = useState([]);
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSelectingChats, setIsSelectingChats] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [availableChats, setAvailableChats] = useState([]);
  const [selectedChats, setSelectedChats] = useState([]);
  const [isOptionsVisible, setIsOptionsVisible] = useState(false);
  const [selectedProjectForOptions, setSelectedProjectForOptions] = useState(null);

  // Load cached projects immediately on mount
  useEffect(() => {
    loadCachedProjects();
    loadProjects();
  }, []);

  const loadCachedProjects = async () => {
    try {
      const cachedData = await AsyncStorage.getItem('@projects');
      if (cachedData) {
        const { projects: cachedProjects, timestamp } = JSON.parse(cachedData);
        // Check if cache is less than 1 hour old
        if (Date.now() - timestamp < 3600000) {
          setProjects(cachedProjects);
          setIsLoading(false);
        }
      }
    } catch (error) {
      console.error('Error loading cached projects:', error);
    }
  };

  const loadProjects = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const projectsRef = collection(db, 'users', user.uid, 'projects');
      const projectsSnap = await getDocs(query(projectsRef, orderBy('createdAt', 'desc')));
      
      const projectsList = projectsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Update state
      setProjects(projectsList);
      setIsLoading(false);

      // Cache the new data
      await AsyncStorage.setItem('@projects', JSON.stringify({
        projects: projectsList,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Error loading projects:', error);
      Alert.alert('Error', 'Failed to load projects');
    }
  };

  // Load available chats that aren't in any project
  const loadAvailableChats = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const chatsRef = collection(db, 'users', user.uid, 'chats');
      const q = query(chatsRef, orderBy('lastMessageTime', 'desc'));
      const snapshot = await getDocs(q);
      
      const chatsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        isSelected: false
      }));

      setAvailableChats(chatsList);
    } catch (error) {
      console.error('Error loading chats:', error);
      Alert.alert('Error', 'Failed to load chats');
    }
  };

  const handleCreateProject = async () => {
    try {
      if (!newProjectName.trim()) {
        Alert.alert('Error', 'Please enter a project name');
        return;
      }

      const user = auth.currentUser;
      if (!user) return;

      // Create new project object
      const newProject = {
        name: newProjectName.trim(),
        createdAt: new Date(),
        chatCount: 0
      };

      // Optimistically update UI
      const optimisticId = Date.now().toString(); // Temporary ID
      const optimisticProject = { id: optimisticId, ...newProject };
      setProjects(prevProjects => [optimisticProject, ...prevProjects]);

      // Save to Firebase
      const projectsRef = collection(db, 'users', user.uid, 'projects');
      const docRef = await addDoc(projectsRef, newProject);

      // Update local state with real ID
      setProjects(prevProjects => 
        prevProjects.map(p => 
          p.id === optimisticId ? { ...p, id: docRef.id } : p
        )
      );

      // Update cache
      const updatedProjects = projects.map(p => 
        p.id === optimisticId ? { ...p, id: docRef.id } : p
      );
      await AsyncStorage.setItem('@projects', JSON.stringify({
        projects: updatedProjects,
        timestamp: Date.now()
      }));

      setNewProjectName('');
      setIsAddingProject(false);
    } catch (error) {
      console.error('Error creating project:', error);
      Alert.alert('Error', 'Failed to create project');
      // Revert optimistic update on error
      loadProjects();
    }
  };

  const handleAddChatsToProject = (project) => {
    setSelectedProject(project);
    setSelectedChats([]);
    loadAvailableChats();
    setIsSelectingChats(true);
  };

  const handleChatSelection = (chat) => {
    setAvailableChats(prev => 
      prev.map(c => 
        c.id === chat.id ? { ...c, isSelected: !c.isSelected } : c
      )
    );
  };

  const handleConfirmSelection = async () => {
    try {
      const user = auth.currentUser;
      const selectedChatIds = availableChats.filter(c => c.isSelected).map(c => c.id);
      
      if (selectedChatIds.length === 0) {
        Alert.alert('Error', 'Please select at least one chat');
        return;
      }

      // Update each selected chat with project ID
      for (const chatId of selectedChatIds) {
        await updateDoc(doc(db, 'users', user.uid, 'chats', chatId), {
          projectId: selectedProject.id
        });
      }

      // Update project chat count
      await updateDoc(doc(db, 'users', user.uid, 'projects', selectedProject.id), {
        chatCount: selectedChatIds.length
      });

      setIsSelectingChats(false);
      loadProjects();
      Alert.alert('Success', 'Chats added to project successfully');

    } catch (error) {
      console.error('Error adding chats to project:', error);
      Alert.alert('Error', 'Failed to add chats to project');
    }
  };

  const handleDeleteProject = async (project) => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      Alert.alert(
        'Delete Project',
        'Are you sure you want to delete this project? All chats will be unlinked but not deleted.',
        [
          {
            text: 'Cancel',
            style: 'cancel'
          },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                const batch = writeBatch(db);

                // Get all chats in this project
                const chatsRef = collection(db, 'users', user.uid, 'chats');
                const q = query(chatsRef, where('projectId', '==', project.id));
                const chatsSnapshot = await getDocs(q);

                // Unlink chats from project
                chatsSnapshot.docs.forEach(chatDoc => {
                  batch.update(doc(db, 'users', user.uid, 'chats', chatDoc.id), {
                    projectId: null
                  });
                });

                // Delete project document
                batch.delete(doc(db, 'users', user.uid, 'projects', project.id));

                // Commit all changes
                await batch.commit();

                // Update local state
                setProjects(prev => prev.filter(p => p.id !== project.id));

                // Update cache
                const updatedProjects = projects.filter(p => p.id !== project.id);
                await AsyncStorage.setItem('@projects', JSON.stringify({
                  projects: updatedProjects,
                  timestamp: Date.now()
                }));

                setIsOptionsVisible(false);
                Alert.alert('Success', 'Project deleted successfully');
              } catch (error) {
                console.error('Error deleting project:', error);
                Alert.alert('Error', 'Failed to delete project');
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Delete project error:', error);
      Alert.alert('Error', 'Failed to delete project');
    }
  };

  const handleProjectPress = (project) => {
    navigation.navigate('ProjectDetail', { project });
  };

  const handleViewProject = (project) => {
    navigation.navigate('ProjectDetail', { projectId: project.id });
  };

  const renderProjectItem = (project) => (
    <View key={project.id} style={styles.projectItem}>
      <TouchableOpacity 
        style={styles.projectInfo}
        onPress={() => handleViewProject(project)}
      >
        <Ionicons name="folder-outline" size={24} color="#007AFF" />
        <View style={styles.projectTexts}>
          <Text style={styles.projectName}>{project.name}</Text>
          <Text style={styles.chatCount}>
            {project.chatCount || 0} chats
          </Text>
        </View>
      </TouchableOpacity>
      
      <View style={styles.projectActions}>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => handleAddChatsToProject(project)}
        >
          <Ionicons name="add" size={24} color="#007AFF" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.optionsButton}
          onPress={() => {
            setSelectedProjectForOptions(project);
            setIsOptionsVisible(true);
          }}
        >
          <Ionicons name="ellipsis-vertical" size={20} color="#666" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView style={styles.projectList}>
        <TouchableOpacity 
          style={styles.createButton}
          onPress={() => setIsAddingProject(true)}
        >
          <Ionicons name="add-circle-outline" size={24} color="#007AFF" />
          <Text style={styles.createButtonText}>Create New Project</Text>
        </TouchableOpacity>

        {projects.map(project => renderProjectItem(project))}
      </ScrollView>

      {/* Add Project Modal */}
      {isAddingProject && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create New Project</Text>
            <TextInput
              style={styles.input}
              value={newProjectName}
              onChangeText={setNewProjectName}
              placeholder="Project Name"
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalButton}
                onPress={() => setIsAddingProject(false)}
              >
                <Text style={[styles.modalButtonText, { color: '#666' }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.createModalButton]}
                onPress={handleCreateProject}
              >
                <Text style={[styles.modalButtonText, { color: '#007AFF' }]}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Select Chats Modal */}
      <Modal
        visible={isSelectingChats}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Chats to Project</Text>
            <FlatList
              data={availableChats}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.chatItem,
                    item.isSelected && styles.selectedChat
                  ]}
                  onPress={() => handleChatSelection(item)}
                >
                  <Text style={styles.chatTitle}>{item.title || 'Untitled Chat'}</Text>
                  {item.isSelected && (
                    <Ionicons name="checkmark-circle" size={24} color="#007AFF" />
                  )}
                </TouchableOpacity>
              )}
              keyExtractor={item => item.id}
              style={styles.chatList}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalButton}
                onPress={() => setIsSelectingChats(false)}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.createModalButton]}
                onPress={handleConfirmSelection}
              >
                <Text style={[styles.buttonText, { color: '#007AFF' }]}>Add Selected</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Project Options Modal */}
      <Modal
        visible={isOptionsVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsOptionsVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsOptionsVisible(false)}
        >
          <View style={styles.optionsContainer}>
            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => {
                setIsOptionsVisible(false);
                handleDeleteProject(selectedProjectForOptions);
              }}
            >
              <Ionicons name="trash-outline" size={24} color="#FF3B30" />
              <Text style={[styles.optionText, { color: '#FF3B30' }]}>Delete Project</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  projectList: {
    flex: 1,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  createButtonText: {
    marginLeft: 10,
    fontSize: 16,
    color: '#007AFF',
  },
  projectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  projectInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  projectTexts: {
    marginLeft: 10,
  },
  projectName: {
    fontSize: 16,
    color: '#333',
  },
  chatCount: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  addButton: {
    padding: 10,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    width: '90%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    marginBottom: 15,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modalButton: {
    padding: 10,
    marginLeft: 10,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  createModalButton: {
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
  },
  chatList: {
    maxHeight: 400,
    marginBottom: 15,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  selectedChat: {
    backgroundColor: '#f0f8ff',
  },
  chatTitle: {
    fontSize: 16,
    color: '#333',
  },
  projectActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionsButton: {
    padding: 10,
    marginLeft: 5,
  },
  optionsContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  optionText: {
    marginLeft: 10,
    fontSize: 16,
    fontWeight: '500',
  },
});
