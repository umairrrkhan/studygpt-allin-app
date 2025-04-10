import { db } from '../firebase';
import { doc, setDoc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';

export const addFreeEmails = async (emailsArray) => {
  try {
    const freeAccessRef = doc(db, 'freeAccess', 'freeEmails');
    const docSnapshot = await getDoc(freeAccessRef);

    if (!docSnapshot.exists()) {
      // Create new document with emails array
      await setDoc(freeAccessRef, {
        emails: emailsArray.map(email => email.toLowerCase())
      });
    } else {
      // Add new emails to existing array
      await updateDoc(freeAccessRef, {
        emails: arrayUnion(...emailsArray.map(email => email.toLowerCase()))
      });
    }
    return true;
  } catch (error) {
    console.error('Error adding free emails:', error);
    return false;
  }
};

// Example usage:
// addFreeEmails([
//   'student1@school.com',
//   'student2@school.com',
//   'teacher1@school.com'
// ]);
