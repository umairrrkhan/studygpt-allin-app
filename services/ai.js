import { GoogleGenerativeAI } from "@google/generative-ai";
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

const API_KEY = "Put ur api key";
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const MAX_CONTEXT_MESSAGES = 5;

export async function getAIResponse(prompt, previousMessages = [], signal) {
  try {
    const user = auth.currentUser;
    if (!user) {
      return "Please sign in to continue.";
    }

    // Safety check for prompt
    const sanitizedPrompt = prompt?.trim() || '';
    if (!sanitizedPrompt) {
      return "I didn't receive a message to respond to.";
    }

    const messageContent = {
      contents: [{
        role: "user",
        parts: [{ text: sanitizedPrompt }]
      }]
    };

    try {
      const result = await model.generateContent(messageContent, { signal });
      
      // Safely extract text from response
      let responseText;
      try {
        responseText = await result?.response?.text();
      } catch (e) {
        console.error('Text extraction error:', e);
        responseText = null;
      }

      // Ensure we have a valid string response
      if (!responseText || typeof responseText !== 'string') {
        return "I apologize, but I couldn't generate a proper response. Please try again.";
      }

      return responseText;

    } catch (error) {
      console.error('Generation error:', error);
      // Return a valid string instead of throwing
      return error.name === 'AbortError' 
        ? "Message generation was stopped."
        : "I encountered an error. Please try again.";
    }
  } catch (error) {
    console.error('AI service error:', error);
    return "Sorry, I'm having trouble right now. Please try again in a moment.";
  }
}
