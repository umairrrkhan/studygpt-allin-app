import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LOCAL_STORAGE_KEY = '@attachments';
const LOCAL_ATTACHMENT_DIR = `${FileSystem.documentDirectory}attachments/`;

export const initializeLocalStorage = async () => {
  try {
    const dirInfo = await FileSystem.getInfoAsync(LOCAL_ATTACHMENT_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(LOCAL_ATTACHMENT_DIR, { intermediates: true });
    }
  } catch (error) {
    console.error('Failed to initialize local storage:', error);
  }
};

export const saveAttachmentLocally = async (file, chatId) => {
  try {
    const timestamp = Date.now();
    const fileName = `${timestamp}-${Math.random().toString(36).substring(7)}`;
    const extension = file.uri?.split('.').pop() || (file.type === 'application/pdf' ? 'pdf' : 'jpg');
    const localPath = `${LOCAL_ATTACHMENT_DIR}${fileName}.${extension}`;

    // Copy file to local storage
    await FileSystem.copyAsync({
      from: file.uri,
      to: localPath
    });

    // Save metadata
    const metadata = {
      uri: localPath,
      type: file.type || (extension === 'pdf' ? 'application/pdf' : 'image/jpeg'),
      name: file.name || `${fileName}.${extension}`,
      timestamp,
      chatId
    };

    // Store metadata in AsyncStorage
    const existingData = await AsyncStorage.getItem(LOCAL_STORAGE_KEY);
    const attachments = existingData ? JSON.parse(existingData) : {};
    if (!attachments[chatId]) {
      attachments[chatId] = [];
    }
    attachments[chatId].push(metadata);
    await AsyncStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(attachments));

    return metadata;
  } catch (error) {
    console.error('Failed to save attachment locally:', error);
    throw error;
  }
};

export const getLocalAttachments = async (chatId) => {
  try {
    const data = await AsyncStorage.getItem(LOCAL_STORAGE_KEY);
    if (!data) return [];
    const attachments = JSON.parse(data);
    return attachments[chatId] || [];
  } catch (error) {
    console.error('Failed to get local attachments:', error);
    return [];
  }
};

export const deleteLocalAttachment = async (uri, chatId) => {
  try {
    // Delete file
    await FileSystem.deleteAsync(uri);

    // Update metadata
    const data = await AsyncStorage.getItem(LOCAL_STORAGE_KEY);
    if (data) {
      const attachments = JSON.parse(data);
      if (attachments[chatId]) {
        attachments[chatId] = attachments[chatId].filter(att => att.uri !== uri);
        await AsyncStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(attachments));
      }
    }
  } catch (error) {
    console.error('Failed to delete local attachment:', error);
    throw error;
  }
};
