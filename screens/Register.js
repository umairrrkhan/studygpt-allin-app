import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  TextInput, 
  Button, 
  ScrollView, 
  Alert,
  TouchableOpacity,
  Modal,
  View,
  Dimensions
} from 'react-native';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

export default function Register({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  const checkIfFreeAccess = async (identifier) => {
    try {
      const freeAccessDoc = await getDoc(doc(db, 'freeAccess', 'freeAccess'));
      if (freeAccessDoc.exists()) {
        const freeAccessData = freeAccessDoc.data();
        // Check both email and phone lists
        return freeAccessData.identifiers.includes(identifier.toLowerCase());
      }
      return false;
    } catch (error) {
      console.log('Free access check error:', error);
      return false;
    }
  };

  const getSystemMessageLimit = async () => {
    try {
      const configDoc = await getDoc(doc(db, 'system', 'config'));
      if (configDoc.exists()) {
        return configDoc.data().messageLimit || 99;
      }
      return 99;
    } catch (error) {
      console.error('Error fetching system message limit:', error);
      return 99;
    }
  };

  const handleRegister = async () => {
    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords don't match!");
      return;
    }

    if (!email.trim()) {
      Alert.alert("Error", "Please enter email or phone number");
      return;
    }

    try {
      const hasFreeAccess = await checkIfFreeAccess(email);
      const systemMessageLimit = await getSystemMessageLimit();

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Create the user document with identifier
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        identifier: email.toLowerCase(), // Store as identifier instead of email
        password: password,
        hasFreePlan: hasFreeAccess,
        messageCount: 0,
        messageLimit: hasFreeAccess ? systemMessageLimit : 0,
        createdAt: new Date(),
        loginType: email.includes('@') ? 'email' : 'phone' // Track login type
      }, { merge: true });

    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Registration failed. Please try again.');
    }
  };

  const TermsModal = ({ visible, onClose, isPrivacy = false }) => (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>
            {isPrivacy ? 'Privacy Policy' : 'Terms & Conditions'}
          </Text>
          <ScrollView style={styles.modalScroll}>
            {isPrivacy ? (
              <Text style={styles.modalText}>
                Last Updated: {new Date().toLocaleDateString()}
                {'\n\n'}
                1. Data Collection and Usage
                {'\n'}
                We collect and process your personal information to provide our AI chat services. This includes:
                - Email address
                - Chat history
                - Usage patterns
                - Device information
                {'\n\n'}
                2. AI Learning
                {'\n'}
                Your interactions may be used to improve our AI systems. All data is anonymized and secured.
                {'\n\n'}
                3. Data Security
                {'\n'}
                We implement industry-standard security measures to protect your information.
                {'\n\n'}
                4. Third-Party Services
                {'\n'}
                We use Firebase for authentication and data storage, subject to Google's privacy policies.
                {'\n\n'}
                5. Your Rights
                {'\n'}
                You can request data deletion or export at any time.
                {'\n\n'}
                // ...more privacy details...
              </Text>
            ) : (
              <Text style={styles.modalText}>
                Last Updated: {new Date().toLocaleDateString()}
                {'\n\n'}
                1. Service Usage
                {'\n'}
                - Must be 13 years or older
                - Responsible for maintaining account security
                - No illegal or harmful content
                {'\n\n'}
                2. AI Interaction Guidelines
                {'\n'}
                - No malicious prompts or harmful content generation
                - No attempt to manipulate or deceive the AI system
                - No unauthorized automated access
                {'\n\n'}
                3. Content Rights
                {'\n'}
                - You retain rights to your input
                - AI-generated content is subject to our license terms
                {'\n\n'}
                4. Service Limitations
                {'\n'}
                - We reserve the right to limit or terminate access
                - No guarantee of AI accuracy or availability
                {'\n\n'}
                5. Liability
                {'\n'}
                - Service provided "as is"
                - No warranty for AI-generated content
                - Not liable for any damages or losses
                {'\n\n'}
                // ...more terms details...
              </Text>
            )}
          </ScrollView>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Create Account</Text>
      <TextInput
        style={styles.input}
        placeholder="Email or Phone Number" // Changed placeholder text
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
      <TextInput
        style={styles.input}
        placeholder="Confirm Password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
      />
      <View style={styles.termsContainer}>
        <Text style={styles.termsText}>
          By registering, you agree to our{' '}
          <Text style={styles.termsLink} onPress={() => setShowTerms(true)}>
            Terms & Conditions
          </Text>
          {' '}and{' '}
          <Text style={styles.termsLink} onPress={() => setShowPrivacy(true)}>
            Privacy Policy
          </Text>
        </Text>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title="Register" onPress={handleRegister} />
      <TouchableOpacity onPress={() => navigation.navigate('Login')}>
        <Text style={styles.link}>Already have an account? Login</Text>
      </TouchableOpacity>
      <TermsModal visible={showTerms} onClose={() => setShowTerms(false)} />
      <TermsModal visible={showPrivacy} onClose={() => setShowPrivacy(false)} isPrivacy />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
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
  termsContainer: {
    marginVertical: 15,
    paddingHorizontal: 20,
  },
  termsText: {
    textAlign: 'center',
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  termsLink: {
    color: '#007AFF',
    textDecorationLine: 'underline',
  },
  terms: {
    fontSize: 12,
    color: 'gray',
    marginBottom: 15,
    textAlign: 'center',
  },
  error: {
    color: 'red',
    marginBottom: 10,
  },
  link: {
    color: 'blue',
    textAlign: 'center',
    marginTop: 15,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    width: Dimensions.get('window').width * 0.9,
    maxHeight: Dimensions.get('window').height * 0.8,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalScroll: {
    marginBottom: 20,
  },
  modalText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
  },
  closeButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  }
});
