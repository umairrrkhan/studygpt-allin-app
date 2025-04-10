import React, { useState } from 'react';
import { 
  StyleSheet, 
  View, 
  TouchableOpacity, 
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function Whiteboard({ isFloating }) {
  const [paths, setPaths] = useState([]);
  const [currentPath, setCurrentPath] = useState('');
  const [currentColor, setCurrentColor] = useState('#000000');

  const gesture = Gesture.Pan()
    .runOnJS(true)
    .onBegin((e) => {
      setCurrentPath(`M ${e.x} ${e.y}`);
    })
    .onUpdate((e) => {
      setCurrentPath(prev => `${prev} L ${e.x} ${e.y}`);
    })
    .onEnd(() => {
      if (currentPath) {
        setPaths(prev => [...prev, { d: currentPath, color: currentColor }]);
        setCurrentPath('');
      }
    });

  const clearBoard = () => {
    setPaths([]);
    setCurrentPath('');
  };

  return (
    <View style={[
      styles.container,
      isFloating && styles.floatingContainer
    ]}>
      <View style={styles.toolbar}>
        <View style={styles.colorTools}>
          <TouchableOpacity 
            style={[styles.colorButton, currentColor === '#000000' && styles.selectedColor]} 
            onPress={() => setCurrentColor('#000000')}
          >
            <Ionicons name="ellipse" size={24} color="#000000" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.colorButton, currentColor === '#FF0000' && styles.selectedColor]} 
            onPress={() => setCurrentColor('#FF0000')}
          >
            <Ionicons name="ellipse" size={24} color="#FF0000" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={styles.clearButton} 
          onPress={clearBoard}
        >
          <Ionicons name="trash-outline" size={24} color="#FF3B30" />
        </TouchableOpacity>
      </View>

      <GestureDetector gesture={gesture}>
        <View style={styles.drawingArea}>
          <Svg height="100%" width="100%" style={styles.svg}>
            {paths.map((path, index) => (
              <Path
                key={index}
                d={path.d}
                stroke={path.color}
                strokeWidth={3}
                fill="none"
              />
            ))}
            {currentPath ? (
              <Path
                d={currentPath}
                stroke={currentColor}
                strokeWidth={3}
                fill="none"
              />
            ) : null}
          </Svg>
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  toolbar: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    zIndex: 1,
  },
  colorTools: {
    flexDirection: 'row',
    gap: 16,
  },
  colorButton: {
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedColor: {
    borderColor: '#007AFF',
  },
  clearButton: {
    padding: 8,
  },
  drawingArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  svg: {
    flex: 1,
  },
  floatingContainer: {
    backgroundColor: '#fff',
    height: '100%',
  },
});
