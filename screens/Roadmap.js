import React, { useState, useCallback, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  ScrollView, 
  Modal,
  TextInput,
  Alert,
  Dimensions,
  Platform,
  RefreshControl // Add this import
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path, Circle } from 'react-native-svg';
import { saveRoadmap, getRoadmaps, deleteRoadmap } from '../services/roadmapManager';
import { PanGestureHandler } from 'react-native-gesture-handler';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withSpring 
} from 'react-native-reanimated';
import moment from 'moment'; // Add this import
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

const CARD_COLORS = [
  { bg: '#FF6B6B', accent: '#FFE8E8' },
  { bg: '#4ECDC4', accent: '#E8F8F7' },
  { bg: '#45B7D1', accent: '#E8F6FA' },
  { bg: '#96CEB4', accent: '#EEF6F1' },
  { bg: '#FFBE0B', accent: '#FFF6E5' },
  { bg: '#9D4EDD', accent: '#F3E8FF' },
  { bg: '#3A86FF', accent: '#E8F1FF' },
  { bg: '#38B000', accent: '#E8FFE8' }
];

const generateFlowPath = (steps) => {
  const screenWidth = Dimensions.get('window').width - 40;
  const nodeSpacing = Math.max(120, steps.reduce((max, step) => 
    Math.max(max, Math.ceil(step.length / 20) * 40), 120)); // Dynamic spacing based on text length
  const paths = [];
  const nodes = [];

  steps.forEach((step, index) => {
    // Calculate dynamic positions based on text length
    const y = 100 + (index * nodeSpacing);
    const baseX = screenWidth / 2;
    
    // Smoother wave pattern for better distribution
    const amplitude = Math.min(screenWidth / 4, 100); // Limit amplitude
    const offsetX = Math.sin(index * 0.8) * amplitude;
    const x = baseX + offsetX;

    nodes.push({
      id: index,
      x,
      y,
      text: step,
      completed: false,
      textWidth: Math.min(screenWidth * 0.6, step.length * 8), // Estimate text width
    });

    if (index > 0) {
      const prevNode = nodes[index - 1];
      // Smoother curve control points
      const midY = (prevNode.y + y) / 2;
      paths.push({
        id: `path-${index}`,
        d: `M ${prevNode.x} ${prevNode.y} 
            Q ${prevNode.x} ${midY}, ${(prevNode.x + x) / 2} ${midY} 
            T ${x} ${y}`,
      });
    }
  });

  return { nodes, paths };
};

const MAX_STEPS = 20; // Maximum number of steps allowed
const MIN_STEPS = 3;  // Minimum number of steps required

export default function Roadmap({ navigation }) {
  const [roadmaps, setRoadmaps] = useState([]);
  const [isAddingRoadmap, setIsAddingRoadmap] = useState(false);
  const [selectedRoadmap, setSelectedRoadmap] = useState(null);
  const [newRoadmapTitle, setNewRoadmapTitle] = useState('');
  const [newRoadmapSteps, setNewRoadmapSteps] = useState(['']);
  const [refreshing, setRefreshing] = useState(false);

  // Setup header button
  React.useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity                                      
          style={styles.headerButton}
          onPress={() => setIsAddingRoadmap(true)}
        >
          <Ionicons name="add-circle" size={28} color="#007AFF" />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  useEffect(() => {
    loadRoadmaps();
  }, []);

  const loadRoadmaps = async () => {
    const data = await getRoadmaps();
    setRoadmaps(data);
  };

  const generateNodes = (steps) => {
    let nodes = [];
    const centerX = Dimensions.get('window').width / 2;
    const startY = 50;
    const endY = 400;
    const stepHeight = (endY - startY) / (steps.length - 1);

    steps.forEach((step, index) => {
      const y = startY + (stepHeight * index);
      const x = centerX + (Math.random() * 60 - 30); // Random offset for organic look
      nodes.push({ x, y, text: step });
    });

    return nodes;
  };

  const saveRoadmapHandler = async () => {
    if (!newRoadmapTitle.trim() || newRoadmapSteps.some(step => !step.trim())) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    const newRoadmap = {
      title: newRoadmapTitle,
      steps: newRoadmapSteps.filter(step => step.trim()),
      color: CARD_COLORS[roadmaps.length % CARD_COLORS.length],
      createdAt: new Date().toISOString(),
      nodes: generateNodes(newRoadmapSteps.filter(step => step.trim()))
    };

    const result = await saveRoadmap(newRoadmap);
    if (result.success) {
      setRoadmaps(prev => [...prev, result.roadmap]);
      setIsAddingRoadmap(false);
      setNewRoadmapTitle('');
      setNewRoadmapSteps(['']);
    }
  };

  const handleDeleteRoadmap = (roadmapId) => {
    Alert.alert(
      "Delete Roadmap",
      "Are you sure you want to delete this roadmap? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const result = await deleteRoadmap(roadmapId);
              if (result.success) {
                setRoadmaps(prev => prev.filter(r => r.id !== roadmapId));
                setSelectedRoadmap(null);
              } else {
                Alert.alert("Error", "Failed to delete roadmap");
              }
            } catch (error) {
              Alert.alert("Error", "Failed to delete roadmap");
            }
          }
        }
      ]
    );
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const data = await getRoadmaps(true); // Force refresh from server
    setRoadmaps(data);
    setRefreshing(false);
  }, []);

  const generatePDFHTML = (roadmap) => {
    const stepsHTML = roadmap.steps.map((step, index) => `
      <div style="
        display: flex;
        margin: 20px 0;
        padding: 15px;
        border-radius: 10px;
        background-color: #f8f8f8;
      ">
        <div style="
          width: 40px;
          height: 40px;
          border-radius: 20px;
          background-color: ${roadmap.color.bg};
          display: flex;
          justify-content: center;
          align-items: center;
          color: #fff;
          font-weight: bold;
          margin-right: 15px;
        ">
          ${index + 1}
        </div>
        <div style="
          flex: 1;
          display: flex;
          align-items: center;
        ">
          ${step}
        </div>
      </div>
    `).join('');

    return `
      <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
            }
            h1 {
              text-align: center;
              color: ${roadmap.color.bg};
            }
          </style>
        </head>
        <body>
          <h1>${roadmap.title}</h1>
          ${stepsHTML}
        </body>
      </html>
    `;
  };

  const handleExportPDF = async (roadmap) => {
    const html = generatePDFHTML(roadmap);
    const { uri } = await Print.printToFileAsync({ html });
    await Sharing.shareAsync(uri);
  };

  const renderRoadmapModal = () => (
    <Modal
      visible={isAddingRoadmap}
      animationType="slide"
      transparent={true}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Create New Roadmap</Text>
          
          <TextInput
            style={styles.titleInput}
            placeholder="Roadmap Title"
            value={newRoadmapTitle}
            onChangeText={setNewRoadmapTitle}
          />

          <View style={styles.stepsHeader}>
            <Text style={styles.stepsLabel}>Steps ({newRoadmapSteps.length}/{MAX_STEPS})</Text>
            {newRoadmapSteps.length < MAX_STEPS && (
              <TouchableOpacity
                style={styles.addStepButton}
                onPress={() => setNewRoadmapSteps([...newRoadmapSteps, ''])}
              >
                <Ionicons name="add-circle" size={24} color="#007AFF" />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView 
            contentContainerStyle={styles.scrollContentContainer} // Changed this line
          >
            {newRoadmapSteps.map((step, index) => (
              <View key={index} style={styles.stepInputContainer}>
                <View style={styles.stepNumberContainer}>
                  <Text style={styles.stepNumber}>{index + 1}</Text>
                </View>
                <TextInput
                  style={styles.stepInput}
                  placeholder={`What's step ${index + 1}?`}
                  value={step}
                  multiline
                  maxLength={100}
                  onChangeText={(text) => {
                    const updatedSteps = [...newRoadmapSteps];
                    updatedSteps[index] = text;
                    setNewRoadmapSteps(updatedSteps);
                  }}
                />
                <TouchableOpacity
                  style={styles.removeStepButton}
                  onPress={() => {
                    if (newRoadmapSteps.length > MIN_STEPS) {
                      const updatedSteps = newRoadmapSteps.filter((_, i) => i !== index);
                      setNewRoadmapSteps(updatedSteps);
                    }
                  }}
                >
                  <Ionicons name="close-circle" size={22} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>

          <View style={styles.modalActions}>
            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={() => {
                setIsAddingRoadmap(false);
                setNewRoadmapTitle('');
                setNewRoadmapSteps(Array(MIN_STEPS).fill(''));
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[
                styles.saveButton,
                (!newRoadmapTitle.trim() || newRoadmapSteps.some(step => !step.trim())) && 
                styles.saveButtonDisabled
              ]}
              onPress={saveRoadmapHandler}
              disabled={!newRoadmapTitle.trim() || newRoadmapSteps.some(step => !step.trim())}
            >
              <Text style={styles.saveButtonText}>Create Roadmap</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderRoadmapView = () => (
    <Modal
      visible={!!selectedRoadmap}
      animationType="slide"
      transparent={true}
    >
      <View style={styles.roadmapViewContainer}>
        <View style={styles.roadmapContent}>
          <View style={styles.modalHeader}>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setSelectedRoadmap(null)}
            >
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.deleteButton}
              onPress={() => selectedRoadmap && handleDeleteRoadmap(selectedRoadmap.id)}
            >
              <Ionicons name="trash-outline" size={24} color="#ff3b30" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.exportButton}
              onPress={() => selectedRoadmap && handleExportPDF(selectedRoadmap)}
            >
              <Ionicons name="download-outline" size={24} color="#007AFF" />
            </TouchableOpacity>
          </View>

          <Text style={styles.roadmapTitle}>{selectedRoadmap?.title}</Text>

          <ScrollView 
            style={styles.roadmapScroll}
            contentContainerStyle={[
              styles.roadmapScrollContent,
              { alignItems: 'center' } // Moved alignItems here
            ]}
            showsVerticalScrollIndicator={true}
          >
            <View style={styles.stepsContainer}>
              {selectedRoadmap?.steps.map((step, index) => (
                <View key={index} style={styles.stepContainer}>
                  <View style={[styles.stepNode, { backgroundColor: selectedRoadmap.color }]}>
                    <Text style={styles.stepNumber}>{index + 1}</Text>
                  </View>
                  <View style={styles.stepContent}>
                    <Text style={styles.stepText}>{step}</Text>
                  </View>
                  {index < selectedRoadmap.steps.length - 1 && (
                    <View 
                      style={[styles.stepConnector, { backgroundColor: selectedRoadmap.color }]} 
                    />
                  )}
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const renderRoadmapCard = (roadmap) => (
    <TouchableOpacity
      key={roadmap.id}
      style={styles.cardContainer}
      onPress={() => setSelectedRoadmap(roadmap)}
      activeOpacity={0.9}
    >
      <View 
        style={[
          styles.roadmapCard, 
          { 
            backgroundColor: CARD_COLORS[roadmaps.indexOf(roadmap) % CARD_COLORS.length].bg,
            borderColor: CARD_COLORS[roadmaps.indexOf(roadmap) % CARD_COLORS.length].accent,
          }
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleContainer}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {roadmap.title}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDeleteRoadmap(roadmap.id)}
          >
            <Ionicons name="trash-outline" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.cardContent}>
          <View style={styles.cardStats}>
            <View style={styles.statItem}>
              <Ionicons name="list" size={16} color="#fff" />
              <Text style={styles.statText}>{roadmap.steps.length} steps</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="time-outline" size={16} color="#fff" />
              <Text style={styles.statText}>
                {moment(roadmap.createdAt).fromNow()}
              </Text>
            </View>
          </View>

          <View style={styles.cardProgress}>
            {roadmap.steps.slice(0, 3).map((_, index) => (
              <View 
                key={index}
                style={[
                  styles.progressDot,
                  { backgroundColor: CARD_COLORS[roadmaps.indexOf(roadmap) % CARD_COLORS.length].accent }
                ]}
              />
            ))}
            {roadmap.steps.length > 3 && (
              <Text style={styles.progressMore}>+{roadmap.steps.length - 3}</Text>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.cardsContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.cardsGrid}>
          {roadmaps.map(renderRoadmapCard)}
        </View>
      </ScrollView>

      {renderRoadmapModal()}
      {renderRoadmapView()}
    </View>
  );
}

const RoadmapNode = ({ node, color, isFirst, isLast }) => {
  const offset = useSharedValue({ x: 0, y: 0 });

  const animatedStyles = useAnimatedStyle(() => ({
    transform: [
      { translateX: offset.value.x },
      { translateY: offset.value.y }
    ]
  }));

  return (
    <PanGestureHandler
      onGestureEvent={(event) => {
        offset.value = {
          x: event.translationX,
          y: event.translationY
        };
      }}
    >
      <Animated.View style={[styles.mindMapNode, animatedStyles]}>
        <View style={[styles.nodeContent, { backgroundColor: color }]}>
          <Text style={styles.nodeText}>{node.text}</Text>
        </View>
        {!isLast && (
          <View style={[styles.connector, { backgroundColor: color }]} />
        )}
      </Animated.View>
    </PanGestureHandler>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  headerButton: {
    marginRight: 15,
    padding: 5,
  },
  cardsContainer: {
    flex: 1,
    padding: 16,
  },
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  roadmapCard: {
    padding: 15,
    borderRadius: 16,
    minHeight: 160,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardTitleContainer: {
    flex: 1,
    marginRight: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
    lineHeight: 24,
  },
  cardContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  cardStats: {
    marginBottom: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  statText: {
    color: '#fff',
    marginLeft: 6,
    fontSize: 14,
    opacity: 0.9,
  },
  cardProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  progressMore: {
    color: '#fff',
    fontSize: 12,
    opacity: 0.8,
    marginLeft: 2,
  },
  deleteButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  cardContainer: {
    width: '48%',
    marginBottom: 16,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    maxHeight: '80%',
  },
  roadmapViewContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  roadmapContent: {
    flex: 1,
    paddingTop: 60,
  },
  roadmapScroll: {
    flex: 1,
  },
  roadmapScrollContent: {
    paddingVertical: 40,
    paddingHorizontal: 20,
    flexGrow: 1
  },
  flowContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
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
  stepTextContainer: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    backgroundColor: '#fff',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  stepText: {
    fontSize: 13,
    color: '#333',
    lineHeight: 18,
  },
  closeButton: {
    padding: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    zIndex: 1,
  },
  roadmapTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
    color: '#333',
  },
  stepsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 5,
  },

  stepInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    padding: 8,
  },

  stepNumberContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },

  stepNumber: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },

  stepInput: {
    flex: 1,
    minHeight: 40,
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },

  removeStepButton: {
    marginLeft: 8,
    padding: 4,
  },

  saveButtonDisabled: {
    opacity: 0.5,
  },
  mindMapContainer: {
    padding: 20,
    alignItems: 'center',
  },

  mindMapNode: {
    marginVertical: 15,
    alignItems: 'center',
  },

  nodeContent: {
    padding: 15,
    borderRadius: 10,
    minWidth: 150,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },

  nodeText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
  },

  connector: {
    width: 2,
    height: 30,
    marginVertical: 5,
  },
  stepsContainer: {
    padding: 20,
    width: '100%', // Add width to ensure proper layout
  },

  stepContainer: {
    marginBottom: 20,
    alignItems: 'center',
  },

  stepNode: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },

  stepNumber: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },

  stepContent: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    width: '90%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },

  stepText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
  },

  stepConnector: {
    width: 2,
    height: 30,
    marginTop: 10,
  },
  scrollContentContainer: {
    padding: 20,
    flexGrow: 1,
  },
  exportButton: {
    padding: 8,
  },
});
