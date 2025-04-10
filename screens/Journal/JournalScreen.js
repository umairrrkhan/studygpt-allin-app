import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, orderBy, onSnapshot, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { MOODS, WEATHER } from '../../models/JournalEntry';
import moment from 'moment';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Menu, Provider } from 'react-native-paper';
import { batchService } from '../../services/batchService';

export default function JournalScreen({ navigation }) {
  const [entries, setEntries] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [filterMood, setFilterMood] = useState(null);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [selectedMoods, setSelectedMoods] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [dateRange, setDateRange] = useState({ start: null, end: null });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerType, setDatePickerType] = useState('start');
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [lastVisible, setLastVisible] = useState(null);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    loadInitialEntries();
  }, []);

  const loadInitialEntries = async () => {
    try {
      setIsLoading(true);
      const user = auth.currentUser;
      if (!user) return;

      const result = await batchService.loadBatch({
        userId: user.uid,
        collectionPath: 'journals',
        cacheKey: `@journals_${user.uid}`
      });

      setEntries(result.items);
      setLastVisible(result.lastVisible);
      setHasMore(result.hasMore);
    } catch (error) {
      console.error('Error loading entries:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMoreEntries = async () => {
    if (!hasMore || isLoading) return;

    try {
      setIsLoading(true);
      const user = auth.currentUser;
      
      const result = await batchService.loadBatch({
        userId: user.uid,
        collectionPath: 'journals',
        lastVisible
      });

      setEntries(prev => [...prev, ...result.items]);
      setLastVisible(result.lastVisible);
      setHasMore(result.hasMore);
    } catch (error) {
      console.error('Error loading more entries:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getFilteredAndSortedEntries = () => {
    let filtered = [...entries];

    if (searchText) {
      filtered = filtered.filter(entry => 
        entry.title?.toLowerCase().includes(searchText.toLowerCase()) ||
        entry.tags?.some(tag => tag.toLowerCase().includes(searchText.toLowerCase()))
      );
    }

    if (selectedMoods.length > 0) {
      filtered = filtered.filter(entry => selectedMoods.includes(entry.mood));
    }

    if (dateRange.start || dateRange.end) {
      filtered = filtered.filter(entry => {
        const entryDate = entry.createdAt?.toDate();
        if (!entryDate) return true;
        
        if (dateRange.start && dateRange.end) {
          return entryDate >= dateRange.start && entryDate <= dateRange.end;
        } else if (dateRange.start) {
          return entryDate >= dateRange.start;
        } else if (dateRange.end) {
          return entryDate <= dateRange.end;
        }
        return true;
      });
    }

    switch (sortBy) {
      case 'oldest':
        filtered.sort((a, b) => a.createdAt?.toDate() - b.createdAt?.toDate());
        break;
      case 'mood':
        filtered.sort((a, b) => (a.mood || '').localeCompare(b.mood || ''));
        break;
      case 'title':
        filtered.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        break;
      default:
        filtered.sort((a, b) => b.createdAt?.toDate() - a.createdAt?.toDate());
    }

    return filtered;
  };

  const handleLongPress = (entry, event) => {
    const { pageX, pageY } = event.nativeEvent;
    setSelectedEntry(entry);
    setMenuPosition({ x: pageX, y: pageY });
    setMenuVisible(true);
  };

  const handlePin = async (entry) => {
    try {
      const user = auth.currentUser;
      await updateDoc(doc(db, 'users', user.uid, 'journals', entry.id), {
        isPinned: !entry.isPinned
      });
    } catch (error) {
      console.error('Error toggling pin:', error);
      Alert.alert('Error', 'Failed to update entry');
    }
  };

  const renderFilters = () => (
    <View style={styles.filtersContainer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {Object.entries(MOODS).map(([key, value]) => (
          <TouchableOpacity
            key={key}
            style={[
              styles.moodFilter,
              selectedMoods.includes(key) && styles.selectedMoodFilter
            ]}
            onPress={() => {
              setSelectedMoods(prev => 
                prev.includes(key) 
                  ? prev.filter(m => m !== key)
                  : [...prev, key]
              );
            }}
          >
            <Text>{value.emoji}</Text>
            <Text style={styles.moodFilterText}>{value.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderEntry = ({ item }) => {
    const wordCount = item.content?.split(/\s+/).filter(Boolean).length || 0;

    return (
      <TouchableOpacity 
        style={[styles.entryCard, item.isPinned && styles.pinnedCard]}
        onPress={() => navigation.navigate('JournalDetail', { entryId: item.id })}
        onLongPress={(event) => handleLongPress(item, event)}
      >
        <View style={styles.entryHeader}>
          {item.isPinned && (
            <Ionicons name="pin" size={16} color="#FF3B30" style={styles.pinIcon} />
          )}
          <Text style={styles.entryTitle}>{item.title}</Text>
        </View>

        <View style={styles.entryMeta}>
          <Text>{MOODS[item.mood]?.emoji}</Text>
          <Text>{WEATHER[item.weather]?.emoji}</Text>
          <Text style={styles.wordCount}>{wordCount} words</Text>
          <Text style={styles.timestamp}>
            {moment(item.createdAt?.toDate()).format('MMM D, YYYY')}
          </Text>
        </View>

        <Text numberOfLines={2} style={styles.preview}>{item.content}</Text>

        {item.tags?.length > 0 && (
          <View style={styles.tagContainer}>
            {item.tags.map(tag => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>#{tag}</Text>
              </View>
            ))}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Provider>
      <View style={styles.container}>
        <View style={styles.header}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search journals..."
            value={searchText}
            onChangeText={setSearchText}
          />
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setShowFilters(!showFilters)}
          >
            <Ionicons name="filter" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Menu
            visible={showSortMenu}
            onDismiss={() => setShowSortMenu(false)}
            anchor={
              <TouchableOpacity
                style={styles.sortButton}
                onPress={() => setShowSortMenu(true)}
              >
                <Ionicons name="swap-vertical" size={24} color="#007AFF" />
              </TouchableOpacity>
            }
          >
            <Menu.Item onPress={() => { setSortBy('newest'); setShowSortMenu(false); }} title="Newest First" />
            <Menu.Item onPress={() => { setSortBy('oldest'); setShowSortMenu(false); }} title="Oldest First" />
            <Menu.Item onPress={() => { setSortBy('mood'); setShowSortMenu(false); }} title="By Mood" />
            <Menu.Item onPress={() => { setSortBy('title'); setShowSortMenu(false); }} title="By Title (A-Z)" />
          </Menu>
          <TouchableOpacity
            style={styles.analyticsButton}
            onPress={() => navigation.navigate('JournalAnalytics')}
          >
            <Ionicons name="analytics" size={24} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.newButton}
            onPress={() => navigation.navigate('JournalEdit')}
          >
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {showFilters && (
          <>
            {renderFilters()}
            <View style={styles.dateFilters}>
              <TouchableOpacity 
                style={styles.dateButton}
                onPress={() => {
                  setDatePickerType('start');
                  setShowDatePicker(true);
                }}
              >
                <Text>Start: {dateRange.start ? moment(dateRange.start).format('MMM D, YYYY') : 'Any'}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.dateButton}
                onPress={() => {
                  setDatePickerType('end');
                  setShowDatePicker(true);
                }}
              >
                <Text>End: {dateRange.end ? moment(dateRange.end).format('MMM D, YYYY') : 'Any'}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        <FlatList
          data={getFilteredAndSortedEntries()}
          renderItem={renderEntry}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          onEndReached={loadMoreEntries}
          onEndReachedThreshold={0.5}
          ListFooterComponent={isLoading && hasMore ? (
            <ActivityIndicator size="small" color="#007AFF" style={styles.loader} />
          ) : null}
        />

        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={menuPosition}
        >
          <Menu.Item 
            onPress={() => {
              navigation.navigate('JournalEdit', { entryId: selectedEntry?.id });
              setMenuVisible(false);
            }} 
            title="Edit"
            icon="pencil"
          />
          <Menu.Item 
            onPress={() => {
              handlePin(selectedEntry);
              setMenuVisible(false);
            }} 
            title={selectedEntry?.isPinned ? "Unpin" : "Pin"}
            icon="pin"
          />
          <Menu.Item 
            onPress={() => {
              Alert.alert(
                'Delete Entry',
                'Are you sure? This cannot be undone.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { 
                    text: 'Delete', 
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        const user = auth.currentUser;
                        await deleteDoc(doc(db, 'users', user.uid, 'journals', selectedEntry.id));
                      } catch (error) {
                        console.error('Error deleting entry:', error);
                        Alert.alert('Error', 'Failed to delete entry');
                      }
                    }
                  }
                ]
              );
              setMenuVisible(false);
            }} 
            title="Delete"
            icon="trash"
          />
        </Menu>

        {showDatePicker && (
          <DateTimePicker
            value={datePickerType === 'start' ? dateRange.start || new Date() : dateRange.end || new Date()}
            mode="date"
            onChange={(event, date) => {
              setShowDatePicker(false);
              if (date) {
                setDateRange(prev => ({
                  ...prev,
                  [datePickerType]: date
                }));
              }
            }}
          />
        )}
      </View>
    </Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    padding: 15,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  searchInput: {
    flex: 1,
    height: 40,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 15,
    marginRight: 10,
  },
  newButton: {
    width: 40,
    height: 40,
    backgroundColor: '#007AFF',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: 15,
  },
  entryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  entryTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  timestamp: {
    fontSize: 12,
    color: '#666',
  },
  entryMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  preview: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  tagText: {
    fontSize: 12,
    color: '#666',
  },
  filtersContainer: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  moodFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: '#f0f0f0',
  },
  selectedMoodFilter: {
    backgroundColor: '#e3f2fd',
  },
  moodFilterText: {
    marginLeft: 4,
    fontSize: 12,
  },
  dateFilters: {
    flexDirection: 'row',
    padding: 10,
    justifyContent: 'space-around',
  },
  dateButton: {
    padding: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  pinnedCard: {
    borderLeftWidth: 3,
    borderLeftColor: '#FF3B30',
  },
  pinIcon: {
    marginRight: 5,
  },
  wordCount: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
  },
  filterButton: {
    padding: 8,
  },
  sortButton: {
    padding: 8,
  },
  analyticsButton: {
    padding: 8,
  },
  loader: {
    marginVertical: 20,
  },
});
