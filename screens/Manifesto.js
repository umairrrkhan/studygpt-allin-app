import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  ScrollView,
  TextInput,
  Alert,
  Animated,
  Platform,
  Keyboard 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveManifestoItem, getManifestoItems, deleteManifestoItem } from '../services/manifestoManager';

// Better organized constants with clear categories
const TYPES = {
  PERSONAL: {
    id: 'personal',
    name: 'Personal Growth',
    color: '#FF6B6B',
    icon: 'person'
  },
  CAREER: {
    id: 'career',
    name: 'Career',
    color: '#4ECDC4',
    icon: 'briefcase'
  },
  LEARNING: {
    id: 'learning',
    name: 'Learning',
    color: '#45B7D1',
    icon: 'book'
  },
  PROJECT: {
    id: 'project',
    name: 'Projects',
    color: '#96CEB4',
    icon: 'build'
  }
};

const TAGS = [
  { id: 'urgent', name: 'Urgent', color: '#FF4757' },
  { id: 'important', name: 'Important', color: '#2ED573' },
  { id: 'inProgress', name: 'In Progress', color: '#1E90FF' },
  { id: 'longTerm', name: 'Long Term', color: '#5352ED' },
  { id: 'shortTerm', name: 'Short Term', color: '#FF6348' },
  { id: 'critical', name: 'Critical', color: '#FF4757' },
  { id: 'pending', name: 'Pending', color: '#747D8C' },
  { id: 'completed', name: 'Completed', color: '#2ED573' }
];

export default function Manifesto() {
  const [items, setItems] = useState([]);
  const [inputText, setInputText] = useState('');
  const [selectedType, setSelectedType] = useState(TYPES.PERSONAL.id);
  const [selectedTags, setSelectedTags] = useState([]);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const scrollViewRef = useRef(null);
  const newItemAnimation = useRef(new Animated.Value(0)).current;

  // Load saved items on mount
  useEffect(() => {
    loadManifestoItems();
    
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => setKeyboardVisible(false)
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  const loadManifestoItems = async () => {
    const items = await getManifestoItems();
    setItems(items);
  };

  const handleAddItem = async () => {
    if (!inputText.trim()) return;

    const newItem = {
      text: inputText.trim(),
      type: selectedType,
      tags: selectedTags,
      createdAt: new Date().toISOString()
    };

    const result = await saveManifestoItem(newItem);
    if (result.success) {
      setInputText('');
      setSelectedTags([]);
      await loadManifestoItems();
    }
  };

  const handleDeleteItem = useCallback(async (id) => {
    Alert.alert(
      'Delete Item',
      'Are you sure you want to delete this item?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await deleteManifestoItem(id);
              if (result.success) {
                // Refresh the items list
                await loadManifestoItems();
              } else {
                Alert.alert('Error', 'Failed to delete item');
              }
            } catch (error) {
              console.error('Delete error:', error);
              Alert.alert('Error', 'Failed to delete item');
            }
          }
        }
      ]
    );
  }, []);

  const toggleTag = useCallback((tagId) => {
    setSelectedTags(prev => {
      const isSelected = prev.includes(tagId);
      if (isSelected) {
        return prev.filter(id => id !== tagId);
      }
      // Limit to 3 tags maximum
      if (prev.length >= 3) {
        Alert.alert('Limit Reached', 'You can select up to 3 tags');
        return prev;
      }
      return [...prev, tagId];
    });
  }, []);

  const renderTypeSelector = () => (
    <View style={styles.typeSelectorContainer}>
      <Text style={styles.sectionTitle}>Category</Text>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.typeSelector}
      >
        {Object.values(TYPES).map(type => (
          <TouchableOpacity
            key={type.id}
            style={[
              styles.typeButton,
              { backgroundColor: type.color },
              selectedType === type.id && styles.selectedType
            ]}
            onPress={() => setSelectedType(type.id)}
            activeOpacity={0.7}
          >
            <Ionicons name={type.icon} size={20} color="#fff" />
            <Text style={styles.typeText}>{type.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderTagSelector = () => (
    <View style={styles.tagSelectorContainer}>
      <Text style={styles.sectionTitle}>Tags (max 3)</Text>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.tagSelector}
      >
        {TAGS.map(tag => (
          <TouchableOpacity
            key={tag.id}
            style={[
              styles.tagButton,
              { backgroundColor: tag.color },
              selectedTags.includes(tag.id) && styles.selectedTag
            ]}
            onPress={() => toggleTag(tag.id)}
            activeOpacity={0.7}
          >
            <Text style={styles.tagText}>{tag.name}</Text>
            {selectedTags.includes(tag.id) && (
              <Ionicons name="checkmark-circle" size={16} color="#fff" style={styles.tagIcon} />
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderItems = () => (
    <ScrollView 
      ref={scrollViewRef}
      style={styles.itemsList}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.itemsListContent}
    >
      {items.map((item, index) => {
        const type = Object.values(TYPES).find(t => t.id === item.type);
        return (
          <Animated.View 
            key={item.id}
            style={[
              styles.itemCard,
              {
                transform: [{
                  scale: index === 0 ? newItemAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.02]
                  }) : 1
                }]
              }
            ]}
          >
            <View style={[styles.itemHeader, { backgroundColor: type?.color + '20' }]}>
              <Ionicons name={type?.icon} size={20} color={type?.color} />
              <Text style={styles.itemType}>{type?.name}</Text>
              <TouchableOpacity 
                onPress={() => handleDeleteItem(item.id)}
                style={styles.deleteButton}
              >
                <Ionicons name="trash-outline" size={20} color="#FF4757" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.itemText}>{item.text}</Text>
            
            <View style={styles.itemTags}>
              {item.tags.map(tagId => {
                const tag = TAGS.find(t => t.id === tagId);
                return tag ? (
                  <View 
                    key={tagId} 
                    style={[styles.itemTag, { backgroundColor: tag.color }]}
                  >
                    <Text style={styles.itemTagText}>{tag.name}</Text>
                  </View>
                ) : null;
              })}
            </View>
          </Animated.View>
        );
      })}
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      
      {renderTypeSelector()}
      {renderTagSelector()}

      <View style={[styles.inputSection, isKeyboardVisible && styles.inputSectionKeyboard]}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="What's your next goal?"
          placeholderTextColor="#666"
          multiline
          maxLength={200}
        />
        <TouchableOpacity
          style={[
            styles.addButton,
            (!inputText.trim() || selectedTags.length === 0) && styles.addButtonDisabled
          ]}
          onPress={handleAddItem}
          disabled={!inputText.trim() || selectedTags.length === 0}
        >
          <Ionicons name="add-circle" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {renderItems()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 20,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  typeSelectorContainer: {
    marginBottom: 16,
  },
  typeSelector: {
    flexGrow: 0,
  },
  typeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  selectedType: {
    transform: [{ scale: 0.95 }],
  },
  typeText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
  tagSelectorContainer: {
    marginBottom: 16,
  },
  tagSelector: {
    flexGrow: 0,
  },
  tagButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginRight: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  selectedTag: {
    transform: [{ scale: 0.95 }],
  },
  tagText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  tagIcon: {
    marginLeft: 4,
  },
  inputSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingTop: 25,
    paddingBottom:30,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  inputSectionKeyboard: {
    paddingBottom: Platform.OS === 'ios' ? 20 : 0,
  },
  input: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
    fontSize: 16,
    color: '#333',
    minHeight: 45,
    maxHeight: 100,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  addButton: {
    backgroundColor: '#2196F3',
    width: 45,
    height: 45,
    borderRadius: 22.5,
    justifyContent: 'center',
    alignItems: 'center',
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
  addButtonDisabled: {
    backgroundColor: '#bdbdbd',
  },
  itemsList: {
    flex: 1,
  },
  itemsListContent: {
    paddingBottom: 20,
  },
  itemCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  itemType: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
    color: '#333',
  },
  deleteButton: {
    padding: 4,
  },
  itemText: {
    fontSize: 16,
    color: '#333',
    padding: 12,
    lineHeight: 24,
  },
  itemTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    paddingTop: 0,
  },
  itemTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
    marginTop: 6,
  },
  itemTagText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
});
