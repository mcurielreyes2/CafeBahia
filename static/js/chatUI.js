// chatUI.js

/**
 * Initializes the chat UI by appending a welcome message.
 */
export function initChatUI() {
  const chatBox = document.getElementById("chat-box");
  const welcomeMessage = document.createElement("div");
  welcomeMessage.className = "assistant-message";
  welcomeMessage.innerText = "Hola, soy un asistente experto en Cafe. ¿En qué puedo ayudarte?";
  chatBox.appendChild(welcomeMessage);
  chatBox.scrollTop = chatBox.scrollHeight;
}

/**
 * Appends a user message to the chat box.
 */
export function appendUserMessage(message) {
  const chatBox = document.getElementById("chat-box");
  const userMessage = document.createElement("div");
  userMessage.className = "user-message";
  userMessage.innerText = message;
  chatBox.appendChild(userMessage);
  chatBox.scrollTop = chatBox.scrollHeight;
}

/**
 * Appends an assistant message container to the chat box.
 * Returns the created element.
 */
export function appendAssistantMessage(htmlText = "") {
  const chatBox = document.getElementById("chat-box");
  const assistantMessage = document.createElement("div");
  assistantMessage.className = "assistant-message";
  assistantMessage.innerHTML = htmlText;
  chatBox.appendChild(assistantMessage);
  chatBox.scrollTop = chatBox.scrollHeight;
  return assistantMessage;
}

/**
 * Returns a new typing indicator element.
 */
export function createTypingIndicator() {
  const indicator = document.createElement("div");
  indicator.className = "assistant-message";
  indicator.innerHTML =
    '<span class="typing-indicator"></span><span class="typing-indicator"></span><span class="typing-indicator"></span>';
  return indicator;
}

/**
 * A simple typewriter effect that gradually adds text to an element.
 */
export function typeWriterEffect(element, text) {
  let index = 0;
  function type() {
    if (index < text.length) {
      element.innerHTML += text.charAt(index);
      index++;
      setTimeout(type, 50);
    } else {
      if (window.MathJax) {
        window.MathJax.typesetPromise([element]).catch(err => console.error("MathJax typeset error:", err));
      }
    }
  }
  type();
}
