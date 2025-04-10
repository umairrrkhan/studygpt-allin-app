import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import CodeOutputModal from './CodeOutputModal';
import { executeCode } from '../services/codeExecutor';

const CodeBlock = ({ code, language }) => {
  const [isOutputVisible, setIsOutputVisible] = useState(false);
  const [output, setOutput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleRun = async () => {
    setIsLoading(true);
    setOutput(''); // Clear previous output
    try {
      const result = await executeCode(code, language);
      setOutput(result);
      setIsOutputVisible(true);
    } catch (error) {
      setOutput(`Execution Error: ${error.message}\nPlease check your code and try again.`);
      setIsOutputVisible(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.codeHeader}>
        <Text style={styles.language}>{language}</Text>
        <TouchableOpacity 
          style={[styles.runButton, isLoading && styles.runButtonDisabled]}
          onPress={handleRun}
          disabled={isLoading}
        >
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.runButtonText}>Running...</Text>
            </View>
          ) : (
            <View style={styles.buttonContent}>
              <Ionicons name="play" size={16} color="#fff" />
              <Text style={styles.runButtonText}>Run</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
      <View style={styles.codeContent}>
        <Text style={styles.codeText}>{code}</Text>
      </View>

      <CodeOutputModal
        isVisible={isOutputVisible}
        output={output}
        onClose={() => setIsOutputVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#1e1e1e',
  },
  codeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#2d2d2d',
  },
  language: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  runButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0078d4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  runButtonDisabled: {
    opacity: 0.6,
  },
  runButtonText: {
    color: '#fff',
    marginLeft: 4,
    fontSize: 12,
    fontWeight: 'bold',
  },
  codeContent: {
    padding: 12,
  },
  codeText: {
    color: '#fff',
    fontFamily: 'monospace',
    fontSize: 14,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

export default CodeBlock;
