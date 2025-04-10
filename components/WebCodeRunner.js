import React, { useState, useEffect } from 'react';
import { WebView } from 'react-native-webview';
import { View, StyleSheet, ActivityIndicator, Text, Dimensions } from 'react-native';

const WebCodeRunner = ({ html, css, javascript }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setIsLoading(true);
    setError(null);

    const timer = setTimeout(() => {
      setError('Timeout: The code took too long to execute.');
      setIsLoading(false);
    }, 15000); // 15 seconds timeout

    return () => clearTimeout(timer);
  }, [html, css, javascript]);

  const handleLoadEnd = () => {
    setIsLoading(false);
  };

  const handleWebViewMessage = (event) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      if (message.type === 'error') {
        setError(message.message);
        setIsLoading(false);
      }
    } catch (e) {
      console.error("Failed to parse message from WebView", e);
    }
  };

  const source = {
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
        <style>
          body {
            margin: 0;
            padding: 8px;
            font-family: -apple-system, system-ui, sans-serif;
            background: white;
          }
          #content {
            min-height: 100px;
            border: 1px solid #eee;
            padding: 10px;
            margin-bottom: 10px;
          }
          #output {
            background: #f5f5f5;
            padding: 10px;
            border-radius: 4px;
            font-family: monospace;
            white-space: pre-wrap;
            margin-top: 10px;
            border: 1px solid #ddd;
          }
          ${css || ''}
        </style>
      </head>
      <body>
        <div id="content">
          ${html || '<div style="color: #666;">No content</div>'}
        </div>
        <div id="output"></div>
        <script>
          document.addEventListener('DOMContentLoaded', function() {
            const output = document.getElementById('output');
            window.console = {
              log: function(...args) {
                if (output) {
                  const line = document.createElement('div');
                  line.textContent = args.join(' ');
                  output.appendChild(line);
                }
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'log',
                  message: args.join(' ')
                }));
              },
              error: function(...args) {
                if (output) {
                  const line = document.createElement('div');
                  line.style.color = 'red';
                  line.textContent = 'Error: ' + args.join(' ');
                  output.appendChild(line);
                }
              }
            };

            try {
              ${javascript || ''}
            } catch(e) {
              console.error(e.message);
            }
          });
        </script>
      </body>
      </html>
    `
  };

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Error: {error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007BFF" />
        </View>
      )}
      <WebView
        style={styles.webview}
        originWhitelist={['*']}
        source={source}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        onLoadEnd={handleLoadEnd}
        onMessage={handleWebViewMessage}
        scrollEnabled={true}
        showsVerticalScrollIndicator={true}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.warn('WebView error:', nativeEvent);
        }}
        startInLoadingState={true}
        onNavigationStateChange={(navState) => {
          console.log('Navigation state:', navState);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 400, // Fixed height instead of flex
    backgroundColor: '#ffffff',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#eee',
  },
  webview: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
    zIndex: 10,
  },
  errorContainer: {
    padding: 20,
    backgroundColor: '#ffebee',
  },
  errorText: {
    color: '#d32f2f',
    fontSize: 14,
    textAlign: 'center',
  },
});

export default WebCodeRunner;
