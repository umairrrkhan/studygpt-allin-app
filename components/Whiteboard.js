import React, { useRef, useState } from 'react';
import { View, StyleSheet, PanResponder } from 'react-native';
import { Svg, Path } from 'react-native-svg';

export default function Whiteboard() {
  const [paths, setPaths] = useState([]);
  const [currentPath, setCurrentPath] = useState('');
  
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => {
        const { locationX, locationY } = event.nativeEvent;
        setCurrentPath(`M ${locationX} ${locationY}`);
      },
      onPanResponderMove: (event) => {
        const { locationX, locationY } = event.nativeEvent;
        setCurrentPath(prevPath => `${prevPath} L ${locationX} ${locationY}`);
      },
      onPanResponderRelease: () => {
        setPaths(prevPaths => [...prevPaths, currentPath]);
        setCurrentPath('');
      },
    })
  ).current;

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <Svg style={styles.svg}>
        {paths.map((path, index) => (
          <Path
            key={index}
            d={path}
            stroke="black"
            strokeWidth="2"
            fill="none"
          />
        ))}
        {currentPath ? (
          <Path
            d={currentPath}
            stroke="black"
            strokeWidth="2"
            fill="none"
          />
        ) : null}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  svg: {
    flex: 1,
    backgroundColor: '#fff',
  },
});
