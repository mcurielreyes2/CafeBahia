// streamHandler.js
import { appendUserMessage, appendAssistantMessage } from './chatUI.js';

let abortController = null;

/**
 * Optionally fixes double-escaped math delimiters.
 */
function fixMathDelimiters(text) {
  return text
    .replace(/\\\\\(/g, '\\(')
    .replace(/\\\\\)/g, '\\)')
    .replace(/\\\\\[/g, '\\[')
    .replace(/\\\\\]/g, '\\]');
}

/**
 * Gradually appends pending text to the target element.
 * pendingTextRef is an object: { text: "" }.
 */
function backgroundTyper(element, pendingTextRef, speed = 12) {
  let isTyping = false;
  function typeNextChar() {
    if (pendingTextRef.text.length > 0) {
      const nextChar = pendingTextRef.text.charAt(0);
      pendingTextRef.text = pendingTextRef.text.slice(1);
      element.innerHTML += nextChar;
      setTimeout(typeNextChar, speed);
    } else {
      isTyping = false;
    }
  }
  if (!isTyping) {
    isTyping = true;
    typeNextChar();
  }
}

/**
 * Sends a message to the streaming endpoint (/chat_stream) and processes the streamed response.
 * This function is triggered when the user clicks the send button.
 */
export async function sendMessageStream() {
  const inputField = document.getElementById("user-input");
  const message = inputField.value.trim();
  if (message === "") return;
  inputField.value = "";

  // Hide welcome and options (if visible)
  const welcomeMessageEl = document.querySelector(".welcome-message");
  const optionsContainerEl = document.querySelector(".options-container");
  if (welcomeMessageEl) welcomeMessageEl.style.display = "none";
  if (optionsContainerEl) optionsContainerEl.style.display = "none";

  // Append user message to chat
  appendUserMessage(message);

  // (Optional) You could also check for RAG usage here before streaming...

  // Show typing indicator
  const chatBox = document.getElementById("chat-box");
  const typingIndicator = document.createElement("div");
  typingIndicator.className = "assistant-message";
  typingIndicator.innerHTML =
    '<span class="typing-indicator"></span><span class="typing-indicator"></span><span class="typing-indicator"></span>';
  chatBox.appendChild(typingIndicator);
  chatBox.scrollTop = chatBox.scrollHeight;

  // Use an AbortController if needed
  abortController = new AbortController();
  try {
    const response = await fetch("/chat_stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
      signal: abortController.signal,
    });
    // Remove typing indicator
    if (typingIndicator.parentNode) {
      typingIndicator.parentNode.removeChild(typingIndicator);
    }

    // Prepare assistant message container
    const assistantMessageDiv = appendAssistantMessage();

    if (!response.ok) {
      const errorData = await response.json();
      assistantMessageDiv.innerText = `Error: ${errorData.message}`;
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let pendingTextRef = { text: "" };

    async function readChunk() {
      const { done, value } = await reader.read();
      if (done) {
        // Append any remaining pending text
        if (pendingTextRef.text.length > 0) {
          assistantMessageDiv.innerHTML += pendingTextRef.text;
          pendingTextRef.text = "";
        }
        // When streaming is complete, trigger MathJax for the entire container
        if (window.MathJax) {
          console.log("Final chunk complete. Triggering MathJax.typesetPromise on assistantMessageDiv.");
          window.MathJax.typesetPromise([assistantMessageDiv])
            .then(() => console.log("MathJax re-typeset successfully after final chunk."))
            .catch(err => console.error("MathJax typeset error:", err));
        }
        return;
      }

      let chunkText = decoder.decode(value, { stream: true });
      chunkText = fixMathDelimiters(chunkText);
      // Accumulate text
      pendingTextRef.text += chunkText;
      // Gradually append the new text
      backgroundTyper(assistantMessageDiv, pendingTextRef, 12);
      chatBox.scrollTop = chatBox.scrollHeight;
      readChunk();
    }
    readChunk();

  } catch (err) {
    if (typingIndicator.parentNode) {
      typingIndicator.parentNode.removeChild(typingIndicator);
    }
    const errorMessageDiv = appendAssistantMessage(`Request error: ${err}`);
    console.error("Streaming error:", err);
  }
}

/**
 * Similar to sendMessageStream, but triggers when an option-box is clicked.
 */
export async function sendOptionMessage(message) {
  // Hide welcome and options
  const welcomeMessageEl = document.querySelector(".welcome-message");
  const optionsContainerEl = document.querySelector(".options-container");
  if (welcomeMessageEl) welcomeMessageEl.style.display = "none";
  if (optionsContainerEl) optionsContainerEl.style.display = "none";

  // Append user message to chat
  appendUserMessage(message);

  // Check if backend will use RAG
  let isRag = false;
  try {
    const ragResp = await fetch("/check_rag", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message })
    });
    const ragData = await ragResp.json();
    isRag = ragData.is_rag;
  } catch (err) {
    console.error("Error checking RAG:", err);
  }

  let ragMessageDiv = null;
  if (isRag) {
    ragMessageDiv = document.createElement("div");
    ragMessageDiv.className = "assistant-message rag-status-blink";
    ragMessageDiv.innerText = "Buscando información en los documentos de referencia...";
    document.getElementById("chat-box").appendChild(ragMessageDiv);
  }

  // Show typing indicator
  const chatBox = document.getElementById("chat-box");
  const typingIndicator = document.createElement("div");
  typingIndicator.className = "assistant-message";
  typingIndicator.innerHTML = '<span class="typing-indicator"></span><span class="typing-indicator"></span><span class="typing-indicator"></span>';
  chatBox.appendChild(typingIndicator);
  chatBox.scrollTop = chatBox.scrollHeight;

  try {
    const response = await fetch("/chat_stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });

    if (typingIndicator.parentNode) {
      typingIndicator.parentNode.removeChild(typingIndicator);
    }
    if (ragMessageDiv && ragMessageDiv.parentNode) {
      ragMessageDiv.parentNode.removeChild(ragMessageDiv);
    }

    const assistantMessageDiv = appendAssistantMessage();

    if (!response.ok) {
      const errorData = await response.json();
      assistantMessageDiv.innerText = `Error: ${errorData.message}`;
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let pendingTextRef = { text: "" };

    async function readChunk() {
      const { done, value } = await reader.read();
      if (done) {
        if (pendingTextRef.text.length > 0) {
          assistantMessageDiv.innerHTML += pendingTextRef.text;
          pendingTextRef.text = "";
        }
        if (window.MathJax) {
          console.log("Final chunk complete for option message. Triggering MathJax.typesetPromise on assistantMessageDiv.");
          window.MathJax.typesetPromise([assistantMessageDiv])
            .then(() => console.log("MathJax re-typeset successfully after final chunk (option message)."))
            .catch(err => console.error("MathJax typeset error:", err));
        }
        return;
      }

      let chunkText = decoder.decode(value, { stream: true });
      chunkText = fixMathDelimiters(chunkText);
      pendingTextRef.text += chunkText;
      backgroundTyper(assistantMessageDiv, pendingTextRef, 12);
      chatBox.scrollTop = chatBox.scrollHeight;
      readChunk();
    }
    readChunk();

  } catch (err) {
    if (typingIndicator.parentNode) {
      typingIndicator.parentNode.removeChild(typingIndicator);
    }
    if (ragMessageDiv && ragMessageDiv.parentNode) {
      ragMessageDiv.parentNode.removeChild(ragMessageDiv);
    }
    appendAssistantMessage(`Error: ${err}`);
    console.error("Error in sendOptionMessage:", err);
  }
}
