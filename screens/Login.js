import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, TextInput, Button, View, TouchableOpacity } from 'react-native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Login({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    // Check for existing credentials
    const checkCredentials = async () => {
      try {
        const savedEmail = await AsyncStorage.getItem('@userEmail');
        if (savedEmail) {
          setEmail(savedEmail);
        }
      } catch (error) {
        console.error('Error checking saved credentials:', error);
      }
    };

    checkCredentials();
  }, []);

  const checkIfFreeAccess = async (email) => {
    try {
      const freeAccessDoc = await getDoc(doc(db, 'freeAccess', 'freeAccess'));
      if (freeAccessDoc.exists()) {
        const freeAccessData = freeAccessDoc.data();
        // Check if email exists in the array of free access emails
        return freeAccessData.email.includes(email.toLowerCase());
      }
      return false;
    } catch (error) {
      console.log('Free access check error:', error);
      return false;
    }
  };

  const handleLogin = async () => {
    try {
      // Store the login identifier (email or phone)
      await AsyncStorage.setItem('@userIdentifier', email.toLowerCase());
      
      const hasFreeAccess = await checkIfFreeAccess(email);
      await signInWithEmailAndPassword(auth, email, password);
      
    } catch (err) {
      console.error(err);
      setError('Invalid login credentials');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome Back</Text>
      <TextInput
        style={styles.input}
        placeholder="Email or Phone Number"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title="Login" onPress={handleLogin} />
      <TouchableOpacity onPress={() => navigation.navigate('Register')}>
        <Text style={styles.link}>Don't have an account? Register</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    marginBottom: 15,
  },
  error: {
    color: 'red',
    marginBottom: 10,
    textAlign: 'center',
  },
  link: {
    color: 'blue',
    textAlign: 'center',
    marginTop: 15,
  },
});
