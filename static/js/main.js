// main.js
import { initChatUI, appendUserMessage } from './chatUI.js';
import { sendMessageStream, sendOptionMessage } from './streamHandler.js';
import { initFeedback } from './feedback.js';

// Wait for DOM to load
window.addEventListener("DOMContentLoaded", () => {
  // Initialize chat UI (shows welcome message)
  initChatUI();

  // Initialize feedback modal functionality
  initFeedback();

  // Bind send button to streaming message function
  const sendButton = document.getElementById("send-button");
  sendButton.addEventListener("click", sendMessageStream);

  // Bind Enter key on the input
  const userInput = document.getElementById("user-input");
  userInput.addEventListener("keypress", (event) => {
    if (event.key === "Enter") {
      sendMessageStream();
    }
  });

  // Bind option-boxes: when clicked, send the option text as a query
  document.querySelectorAll('.option-box').forEach(box => {
    box.addEventListener('click', () => {
      const message = box.innerText.trim();
      sendOptionMessage(message);
    });
  });
});

// After DOM is loaded
window.addEventListener("DOMContentLoaded", () => {
  const userInput = document.getElementById("user-input");
  userInput.addEventListener("keypress", (event) => {
    if (event.key === "Enter") {
      sendMessageStream();
    }
  });
});