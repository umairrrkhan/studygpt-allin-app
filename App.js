import React, { useState, useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from './firebase';
import { getDoc, doc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { Alert } from 'react-native';
import { getMessageLimit } from './services/accessControl';
import Login from './screens/Login';
import Register from './screens/Register';
import HomeScreen from './screens/HomeScreen';
import Settings from './screens/Settings';
import UserProfile from './screens/UserProfile';
import Archive from './screens/Archive';
import LoadingScreen from './screens/LoadingScreen';
import NoAccessScreen from './screens/NoAccessScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Analytics from './screens/Analytics';
import BurnoutRelief from './screens/BurnoutRelief';
import Manifesto from './screens/Manifesto';
import Whiteboard from './screens/Whiteboard';
import Features from './screens/Features';
import Notes from './screens/Notes';
import Roadmap from './screens/Roadmap';
import Projects from './screens/Projects';
import Journal from './screens/Journal/JournalScreen';
import JournalEdit from './screens/Journal/JournalEdit';
import JournalDetail from './screens/Journal/JournalDetail';
import JournalAnalytics from './screens/Journal/JournalAnalytics';
import ProjectDetail from './screens/ProjectDetail';

const Stack = createNativeStackNavigator();

export default function App() {
  const [user, setUser] = useState(null);
  const [hasFreeAccess, setHasFreeAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [accessChecked, setAccessChecked] = useState(false); // Add this state

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

  const getSystemMessageLimit = async () => {
    try {
      const configDoc = await getDoc(doc(db, 'system', 'config'));
      if (configDoc.exists()) {
        return configDoc.data().messageLimit || 99; // Default to 99 if not set
      }
      return 99; // Default value
    } catch (error) {
      console.error('Error fetching system message limit:', error);
      return 99; // Default value on error
    }
  };

  useEffect(() => {
    const initializeApp = async () => {
      try {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
          try {
            if (user) {
              setLoading(true); // Set loading while checking access
              const hasFree = await checkIfFreeAccess(user.email);
              const systemMessageLimit = await getSystemMessageLimit();
              
              if (hasFree) {
                // User has access - setup their account
                await AsyncStorage.setItem('@user', JSON.stringify(user));
                // Clear projects cache on new login
                await AsyncStorage.removeItem('@projects');
                setUser(user);
                setHasFreeAccess(true);

                let userDoc = await getDoc(doc(db, 'users', user.uid));
                if (!userDoc.exists()) {
                  await setDoc(doc(db, 'users', user.uid), {
                    email: user.email.toLowerCase().trim(),
                    password: '',
                    createdAt: new Date(),
                    hasFreePlan: true,
                    messageCount: 0,
                    messageLimit: systemMessageLimit // Use system config value
                  });
                } else {
                  // Update existing user's message limit if needed
                  if (userDoc.data().messageLimit === 0) {
                    await updateDoc(doc(db, 'users', user.uid), {
                      messageLimit: systemMessageLimit
                    });
                  }
                }
              } else {
                // No access - sign them out immediately
                await auth.signOut();
                Alert.alert('Access Required', 'You do not have access to this application. Please contact support.');
              }
            } else {
              // User logged out
              await AsyncStorage.removeItem('@user');
              await AsyncStorage.removeItem('@userData');
              await AsyncStorage.removeItem('@projects'); // Clear projects cache on logout
              setUser(null);
              setHasFreeAccess(false);
            }
          } catch (error) {
            console.error("Auth state change error:", error);
          } finally {
            setLoading(false);
            setAccessChecked(true);
          }
        });

        return unsubscribe;
      } catch (error) {
        console.error("App initialization error:", error);
        setLoading(false);
        setAccessChecked(true);
      }
    };

    initializeApp();
  }, []);

  if (loading || !accessChecked) {
    return <LoadingScreen />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
        <Stack.Navigator 
          screenOptions={{ headerShown: false }}
          initialRouteName="Login"
        >
          {!user ? (
            // Auth screens
            <>
              <Stack.Screen 
                name="Login" 
                component={Login}
                options={{ animationEnabled: false }}
              />
              <Stack.Screen 
                name="Register" 
                component={Register}
                options={{ animationEnabled: false }}
              />
            </>
          ) : (
            // Main app screens
            <>
              {hasFreeAccess ? (
                <>
                  <Stack.Screen 
                    name="Home" 
                    component={HomeScreen}
                    options={{ headerShown: true }}
                  />
                  <Stack.Screen 
                    name="Analytics" 
                    component={Analytics}
                    options={{ 
                      headerShown: true,
                      headerTitle: 'Learning Analytics',
                      headerTitleAlign: 'center'
                    }}
                  />
                  <Stack.Screen 
                    name="Settings" 
                    component={Settings}
                    options={{ 
                      headerShown: true,
                      headerTitle: 'Settings',
                      headerTitleAlign: 'center'
                    }}
                  />
                  <Stack.Screen 
                    name="UserProfile" 
                    component={UserProfile}
                    options={{ headerShown: true }}
                  />
                  <Stack.Screen 
                    name="Archive" 
                    component={Archive}
                    options={{ headerShown: true }}
                  />
                  <Stack.Screen 
                    name="BurnoutRelief" 
                    component={BurnoutRelief}
                    options={{ 
                      headerShown: true,
                      headerTitle: 'Burnout Relief',
                      headerTitleAlign: 'center'
                    }}
                  />
                  <Stack.Screen 
                    name="Manifesto" 
                    component={Manifesto}
                    options={{ 
                      headerShown: true,
                      headerTitle: 'My Manifesto',
                      headerTitleAlign: 'center'
                    }}
                  />
                  <Stack.Screen 
                    name="Whiteboard" 
                    component={Whiteboard}
                    options={{ 
                      headerShown: true,
                      headerTitle: 'Whiteboard',
                      headerTitleAlign: 'center'
                    }}
                  />
                  <Stack.Screen 
                    name="Features" 
                    component={Features}
                    options={{ 
                      headerShown: true,
                      headerTitle: 'Features',
                      headerTitleAlign: 'center'
                    }}
                  />
                  <Stack.Screen 
                    name="Notes" 
                    component={Notes}
                    options={{ 
                      headerShown: true,
                      headerTitle: 'Notes',
                      headerTitleAlign: 'center',
                      animation: 'slide_from_right',
                    }}
                  />
                  <Stack.Screen 
                    name="Roadmap" 
                    component={Roadmap}
                    options={{ 
                      headerShown: true,
                      headerTitle: 'My Roadmaps',
                      headerTitleAlign: 'center'
                    }}
                  />
                  <Stack.Screen 
                    name="Projects" 
                    component={Projects}
                    options={{ 
                      headerShown: true,
                      headerTitle: 'Projects',
                      headerTitleAlign: 'center'
                    }}
                  />
                  <Stack.Screen 
                    name="Journal" 
                    component={Journal}
                    options={{ 
                      headerShown: true,
                      headerTitle: 'Daily Journal',
                      headerTitleAlign: 'center'
                    }}
                  />
                  <Stack.Screen 
                    name="JournalEdit" 
                    component={JournalEdit}
                    options={{ 
                      headerShown: true,
                      headerTitle: 'New Entry',
                      headerTitleAlign: 'center'
                    }}
                  />
                  <Stack.Screen 
                    name="JournalDetail" 
                    component={JournalDetail}
                    options={{ 
                      headerShown: true,
                      headerTitle: 'Entry Details',
                      headerTitleAlign: 'center'
                    }}
                  />
                  <Stack.Screen 
                    name="JournalAnalytics" 
                    component={JournalAnalytics}
                    options={{ 
                      headerShown: true,
                      headerTitle: 'Journal Analytics',
                      headerTitleAlign: 'center'
                    }}
                  />
                  <Stack.Screen 
                    name="ProjectDetail" 
                    component={ProjectDetail}
                    options={({ route }) => ({ 
                      headerShown: true,
                      headerTitle: route.params?.project?.name || 'Project Details',
                      headerTitleAlign: 'center',
                      headerBackTitle: 'Back'
                    })}
                  />
                </>
              ) : (
                <Stack.Screen 
                  name="NoAccess" 
                  component={NoAccessScreen}
                  options={{ animationEnabled: false }}
                />
              )}
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}