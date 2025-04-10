import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, ScrollView, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { LineChart, PieChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import { analyticsService } from '../services/analyticsService';
import { auth } from '../firebase';
import moment from 'moment';

const screenWidth = Dimensions.get('window').width;

const ContributionBox = ({ count }) => {
  // Define color intensity based on activity count
  const getColor = (count) => {
    if (count === 0) return '#ebedf0';
    if (count <= 2) return '#9be9a8';
    if (count <= 5) return '#40c463';
    if (count <= 10) return '#30a14e';
    return '#216e39';
  };

  return (
    <View
      style={[
        styles.contributionBox,
        { backgroundColor: getColor(count) }
      ]}
    />
  );
};

const Analytics = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState(30);
  const [analyticsData, setAnalyticsData] = useState(null);
  const loadingTimeoutRef = useRef(null);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await analyticsService.getChatsAnalytics(timeRange);
      if (!data) throw new Error('No analytics data available');
      
      setAnalyticsData(data);
    } catch (error) {
      console.error('Analytics load error:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, []);

  // Debounce time range changes
  useEffect(() => {
    const handler = setTimeout(() => {
      loadAnalytics();
    }, 300);

    return () => clearTimeout(handler);
  }, [timeRange]);

  const renderError = () => {
    let errorMessage = error;
    let isSetupError = error?.includes('being set up');

    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>
          {isSetupError ? 
            "Analytics system is being initialized. This might take a few minutes." :
            "Unable to load analytics data. Please try again later."}
        </Text>
        {!isSetupError && (
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={loadAnalytics}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderTimeDistribution = () => {
    if (!analyticsData?.timeDistribution) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Study Time Pattern</Text>
        {Object.entries(analyticsData.timeDistribution).map(([time, count]) => (
          <View key={time} style={styles.timeRow}>
            <Text style={styles.timePeriod}>
              {time.charAt(0).toUpperCase() + time.slice(1)}
            </Text>
            <View style={styles.timeBar}>
              <View 
                style={[
                  styles.timeBarFill,
                  { width: `${(count / analyticsData.totalInteractions) * 100}%` }
                ]} 
              />
            </View>
            <Text style={styles.timeCount}>{count}</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderSubjectsChart = () => {
    if (!analyticsData?.subjectDistribution) return null;

    const data = Object.entries(analyticsData.subjectDistribution)
      .sort(([,a], [,b]) => b - a) // Sort by count in descending order
      .slice(0, 5) // Take top 5
      .map(([name, count], index) => ({
        name: name.replace('_', ' ').toUpperCase(),
        count,
        color: `hsl(${index * 72}, 70%, 50%)`
      }));

    if (data.length === 0) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Most Discussed Subjects</Text>
        <View style={styles.chartSection}>
          <PieChart
            data={data}
            width={screenWidth - 40}
            height={180} // Reduced height
            chartConfig={{
              color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
            }}
            accessor="count"
            backgroundColor="transparent"
            paddingLeft="15"
            hasLegend={false}
          />
          <ScrollView style={styles.legendScroll}>
            <View style={styles.legendContainer}>
              {data.map((item, index) => (
                <View key={item.name} style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: item.color }]} />
                  <View style={styles.legendTextContainer}>
                    <Text style={styles.legendName}>{item.name}</Text>
                    <Text style={styles.legendCount}>{item.count} interactions</Text>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>
    );
  };

  const renderActivityHeatmap = () => {
    if (!analyticsData?.dailyActivity) return null;

    // Get last 30 days or 365 days based on timeRange
    const daysToShow = timeRange;
    const today = new Date();
    const data = [];
    
    // Create array of dates
    for (let i = 0; i < daysToShow; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const count = analyticsData.dailyActivity
        .flat()
        .filter(activity => {
          const activityDate = new Date(activity.date);
          return activityDate.toDateString() === date.toDateString();
        })
        .reduce((sum, activity) => sum + activity.count, 0);

      data.unshift({
        date,
        count,
      });
    }

    // Group by weeks if viewing yearly data
    const weeks = timeRange === 365 ? 
      Array.from({ length: 52 }, (_, weekIndex) => {
        return data.slice(weekIndex * 7, (weekIndex + 1) * 7);
      }) :
      Array.from({ length: 5 }, (_, weekIndex) => {
        return data.slice(weekIndex * 7, (weekIndex + 1) * 7);
      });

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Activity Heatmap ({timeRange === 365 ? 'Year' : '30 Days'})
        </Text>
        <View style={styles.heatmapContainer}>
          <View style={styles.daysColumn}>
            {days.map(day => (
              <Text key={day} style={styles.dayLabel}>{day}</Text>
            ))}
          </View>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.heatmapScroll}
          >
            <View style={styles.heatmap}>
              {weeks.map((week, weekIndex) => (
                <View key={weekIndex} style={styles.weekColumn}>
                  {week.map((day, dayIndex) => (
                    <TouchableOpacity 
                      key={dayIndex}
                      onPress={() => {
                        // Show activity details
                        if (day.count > 0) {
                          Alert.alert(
                            'Activity Details',
                            `${moment(day.date).format('MMM D, YYYY')}\n${day.count} interactions`
                          );
                        }
                      }}
                    >
                      <ContributionBox count={day.count} />
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
        
        <View style={styles.heatmapMeta}>
          <View style={styles.heatmapLegend}>
            <Text style={styles.legendText}>Less</Text>
            <ContributionBox count={0} />
            <ContributionBox count={2} />
            <ContributionBox count={5} />
            <ContributionBox count={10} />
            <ContributionBox count={15} />
            <Text style={styles.legendText}>More</Text>
          </View>
          
          <Text style={styles.totalActivity}>
            Total Activity: {data.reduce((sum, day) => sum + day.count, 0)} interactions
          </Text>
        </View>
      </View>
    );
  };

  return (
    <ScrollView 
      style={styles.container}
      showsVerticalScrollIndicator={true}
      contentContainerStyle={styles.contentContainer}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Learning Analytics</Text>
        <View style={styles.timeRangeSelector}>
          {[30, 365].map(days => (
            <TouchableOpacity
              key={days}
              style={[
                styles.timeRangeButton,
                timeRange === days && styles.timeRangeButtonActive
              ]}
              onPress={() => setTimeRange(days)}
            >
              <Text style={[
                styles.timeRangeText,
                timeRange === days && styles.timeRangeTextActive
              ]}>
                {days === 365 ? '1 Year' : '30 Days'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
      ) : error ? (
        renderError()
      ) : (
        <View style={styles.analyticsContent}>
          {renderActivityHeatmap()}
          {renderTimeDistribution()}
          {renderSubjectsChart()}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  timeRangeSelectorContainer: {
    marginBottom: 15,
  },
  timeRangeSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 20,
  },
  timeRangeButton: {
    paddingHorizontal: 12, // Reduced padding
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8, // Reduced margin
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    minWidth: 70, // Ensure minimum width for buttons
  },
  timeRangeButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  timeRangeText: {
    color: '#333',
  },
  timeRangeTextActive: {
    color: '#fff',
  },
  loader: {
    marginTop: 50,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    minHeight: 300, // Set minimum height
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  chartSection: {
    flex: 1,
    minHeight: 400, // Ensure enough space
    paddingBottom: 20, // Add bottom padding
  },
  legendScroll: {
    flex: 1,
    marginTop: 20,
  },
  legendContainer: {
    paddingHorizontal: 10,
    paddingBottom: 20, // Add bottom padding
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  legendTextContainer: {
    flex: 1,
  },
  legendName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  legendCount: {
    fontSize: 12,
    color: '#666',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 5,
  },
  timePeriod: {
    width: 80,
    fontSize: 14,
  },
  timeBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    marginHorizontal: 10,
  },
  timeBarFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 4,
  },
  timeCount: {
    width: 40,
    fontSize: 14,
    textAlign: 'right',
  },
  heatmapContainer: {
    flexDirection: 'row',
    marginVertical: 10,
  },
  daysColumn: {
    marginRight: 4,
    justifyContent: 'space-around',
  },
  dayLabel: {
    fontSize: 10,
    color: '#666',
    height: 15,
  },
  heatmap: {
    flexDirection: 'row',
  },
  weekColumn: {
    marginRight: 5, // More space between columns
  },
  contributionBox: {
    width: 14, // Slightly larger boxes
    height: 14,
    marginVertical: 3,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  heatmapLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  legendText: {
    fontSize: 12,
    color: '#666',
    marginHorizontal: 4,
  },
  errorContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: '#666',
    textAlign: 'center',
    marginBottom: 15,
    paddingHorizontal: 20,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  contentContainer: {
    flexGrow: 1,
    paddingBottom: 100, // Add extra padding at bottom
  },
  analyticsContent: {
    flex: 1,
    paddingBottom: 20, // Add bottom padding for better scrolling
  },
  chartScrollView: {
    maxHeight: 400,
  },
  heatmapScroll: {
    paddingRight: 20,
  },
  heatmapMeta: {
    marginTop: 15,
    alignItems: 'center',
  },
  totalActivity: {
    marginTop: 10,
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
});

export default Analytics;
