import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, Dimensions } from 'react-native';
import { collection, query, getDocs } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { MOODS, WEATHER } from '../../models/JournalEntry';
import moment from 'moment';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import { Ionicons } from '@expo/vector-icons';

const TABS = ['Mood', 'Words', 'Tags', 'Weather'];
const screenWidth = Dimensions.get('window').width;

export default function JournalAnalytics() {
  const [activeTab, setActiveTab] = useState('Mood');
  const [journalData, setJournalData] = useState(null);
  const [selectedDataPoint, setSelectedDataPoint] = useState(null);

  useEffect(() => {
    loadJournalData();
  }, []);

  const loadJournalData = async () => {
    try {
      const user = auth.currentUser;
      const journalsRef = collection(db, 'users', user.uid, 'journals');
      const snapshot = await getDocs(journalsRef);
      
      const entries = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate()
      }));

      processData(entries);
    } catch (error) {
      console.error('Error loading journal data:', error);
    }
  };

  const processData = (entries) => {
    // Process mood trends over time
    const moodData = {};
    const wordData = {};
    const tagFrequency = {};
    const weatherMoodData = {};

    entries.forEach(entry => {
      // Mood trends
      const month = moment(entry.createdAt).format('MMM');
      moodData[month] = moodData[month] || {};
      moodData[month][entry.mood] = (moodData[month][entry.mood] || 0) + 1;

      // Word count stats
      const day = moment(entry.createdAt).format('MMM D');
      const wordCount = entry.content?.split(/\s+/).filter(Boolean).length || 0;
      wordData[day] = (wordData[day] || 0) + wordCount;

      // Tag frequency
      entry.tags?.forEach(tag => {
        tagFrequency[tag] = (tagFrequency[tag] || 0) + 1;
      });

      // Weather impact on mood
      const weatherMood = `${entry.weather}-${entry.mood}`;
      weatherMoodData[weatherMood] = (weatherMoodData[weatherMood] || 0) + 1;
    });

    setJournalData({ moodData, wordData, tagFrequency, weatherMoodData });
  };

  const renderMoodChart = () => {
    if (!journalData?.moodData) return null;

    const datasets = Object.keys(MOODS).map(mood => ({
      data: Object.values(journalData.moodData).map(monthData => monthData[mood] || 0),
      color: () => getMoodColor(mood),
      label: mood
    }));

    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Mood Trends</Text>
        <LineChart
          data={{
            labels: Object.keys(journalData.moodData),
            datasets: datasets
          }}
          width={screenWidth - 40}
          height={220}
          chartConfig={{
            backgroundColor: '#fff',
            backgroundGradientFrom: '#fff',
            backgroundGradientTo: '#fff',
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
          }}
          bezier
          onDataPointClick={({ value, dataset, getColor }) => {
            setSelectedDataPoint({
              value,
              label: dataset.label,
              color: getColor(1)
            });
          }}
        />
        {selectedDataPoint && (
          <View style={styles.dataPointInfo}>
            <Text style={styles.dataPointText}>
              {selectedDataPoint.label}: {selectedDataPoint.value} entries
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderWordChart = () => {
    if (!journalData?.wordData) return null;

    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Word Count Stats</Text>
        <BarChart
          data={{
            labels: Object.keys(journalData.wordData).slice(-7),
            datasets: [{
              data: Object.values(journalData.wordData).slice(-7)
            }]
          }}
          width={screenWidth - 40}
          height={220}
          chartConfig={{
            backgroundColor: '#fff',
            backgroundGradientFrom: '#fff',
            backgroundGradientTo: '#fff',
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
          }}
          onDataPointClick={({ value }) => {
            setSelectedDataPoint({
              value,
              label: 'Words'
            });
          }}
        />
      </View>
    );
  };

  const renderTagCloud = () => {
    if (!journalData?.tagFrequency) return null;

    const maxFrequency = Math.max(...Object.values(journalData.tagFrequency));
    
    return (
      <View style={styles.tagCloudContainer}>
        <Text style={styles.chartTitle}>Most Used Tags</Text>
        <View style={styles.tagCloud}>
          {Object.entries(journalData.tagFrequency).map(([tag, frequency]) => (
            <TouchableOpacity
              key={tag}
              style={[
                styles.tagBubble,
                {
                  transform: [{ scale: 0.5 + (frequency / maxFrequency) }]
                }
              ]}
              onPress={() => setSelectedDataPoint({
                label: tag,
                value: frequency
              })}
            >
              <Text style={styles.tagBubbleText}>#{tag}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const renderWeatherChart = () => {
    if (!journalData?.weatherMoodData) return null;

    const weatherData = Object.entries(journalData.weatherMoodData).map(([key, value]) => {
      const [weather, mood] = key.split('-');
      return {
        name: `${WEATHER[weather]?.emoji} ${MOODS[mood]?.emoji}`,
        population: value,
        color: getMoodColor(mood),
        legendFontColor: '#7F7F7F',
      };
    });

    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Weather Impact on Mood</Text>
        <PieChart
          data={weatherData}
          width={screenWidth - 40}
          height={220}
          chartConfig={{
            color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
          }}
          accessor="population"
          backgroundColor="transparent"
          paddingLeft="15"
          onDataPointClick={({ value, label }) => {
            setSelectedDataPoint({ value, label });
          }}
        />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabBar}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab}
            style={[
              styles.tab,
              activeTab === tab && styles.activeTab
            ]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[
              styles.tabText,
              activeTab === tab && styles.activeTabText
            ]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.content}>
        {activeTab === 'Mood' && renderMoodChart()}
        {activeTab === 'Words' && renderWordChart()}
        {activeTab === 'Tags' && renderTagCloud()}
        {activeTab === 'Weather' && renderWeatherChart()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tab: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
  },
  tabText: {
    color: '#666',
    fontSize: 14,
  },
  activeTabText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  chartContainer: {
    marginBottom: 30,
    alignItems: 'center',
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    color: '#333',
  },
  dataPointInfo: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  dataPointText: {
    fontSize: 14,
    color: '#333',
  },
  tagCloudContainer: {
    marginBottom: 30,
  },
  tagCloud: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    padding: 10,
  },
  tagBubble: {
    backgroundColor: '#e3f2fd',
    borderRadius: 20,
    padding: 10,
    margin: 5,
  },
  tagBubbleText: {
    color: '#007AFF',
    fontSize: 14,
  },
});

const getMoodColor = (mood) => {
  const colors = {
    HAPPY: '#4CAF50',
    SAD: '#2196F3',
    ANGRY: '#F44336',
    CALM: '#9C27B0',
    EXCITED: '#FF9800',
    TIRED: '#795548',
    NEUTRAL: '#607D8B'
  };
  return colors[mood] || '#607D8B';
};
