import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MathView from 'react-native-math-view';
import CodeBlock from './CodeBlock';

const MathMessage = ({ text }) => {
  // Split text to handle both math and code blocks
  const parts = text.split(/(\$\$[^$]+\$\$|```\w+\n[\s\S]+?\n```)/g);

  return (
    <View style={styles.container}>
      {parts.map((part, index) => {
        if (part.startsWith('$$') && part.endsWith('$$')) {
          // Math formula
          const formula = part.slice(2, -2);
          return (
            <MathView
              key={index}
              math={formula}
              style={styles.mathView}
            />
          );
        } else if (part.startsWith('```') && part.endsWith('```')) {
          // Code block
          const [firstLine, ...rest] = part.split('\n');
          const language = firstLine.slice(3).trim();
          const code = rest.slice(0, -1).join('\n');
          return (
            <CodeBlock
              key={index}
              code={code}
              language={language}
            />
          );
        } else {
          // Regular text
          return <Text key={index} style={styles.text}>{part}</Text>;
        }
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  mathView: {
    backgroundColor: 'transparent',
    marginVertical: 4,
  },
  text: {
    fontSize: 16,
    color: '#333',
  },
});

export default MathMessage;
