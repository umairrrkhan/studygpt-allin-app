import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import Modal from 'react-native-modal';
import { Ionicons } from '@expo/vector-icons';
import WebCodeRunner from './WebCodeRunner';

const CodeOutputModal = ({ isVisible, output, language, onClose }) => {
  const renderOutput = () => {
    if (output?.type === 'web') {
      let html = '', css = '', javascript = '';
      
      switch (output.language.toLowerCase()) {
        case 'html':
          html = output.output;
          break;
        case 'css':
          css = output.output;
          break;
        case 'javascript':
          javascript = output.output;
          break;
      }

      return (
        <View style={styles.webContainer}>
          <WebCodeRunner html={html} css={css} javascript={javascript} />
        </View>
      );
    }

    return (
      <ScrollView style={styles.content}>
        <Text style={styles.output}>{output?.output || output}</Text>
      </ScrollView>
    );
  };

  return (
    <Modal
      isVisible={isVisible}
      onBackdropPress={onClose}
      style={styles.modal}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Output</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
        </View>
        {renderOutput()}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modal: {
    margin: 0,
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '80%',
    minHeight: 500, // Add minimum height
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  content: {
    padding: 16,
    maxHeight: 300,
  },
  output: {
    fontFamily: 'monospace',
    fontSize: 14,
    color: '#333',
  },
  webContainer: {
    height: 400,
    marginHorizontal: 8,
    marginVertical: 8,
  },
});

export default CodeOutputModal;
