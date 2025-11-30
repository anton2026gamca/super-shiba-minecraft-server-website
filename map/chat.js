const chatMessagesContainer = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const chatSendBtn = document.getElementById('chat-send');
const chatHistoryBtn = document.getElementById('chat-history-btn');
const chatHistoryModal = document.getElementById('chat-history-modal');
const chatHistoryClose = document.getElementById('chat-history-close');
const chatHistoryMessages = document.getElementById('chat-history-messages');
const chatHistoryInput = document.getElementById('chat-history-input');
const chatHistorySendBtn = document.getElementById('chat-history-send');

let chatMessages = [];
let chatUpdateTimestamp = 0;
let lastDisplayedMessageId = 0;
let messageTimeouts = new Map();
let isHistoryOpen = false;

function initChat(iframe, currentWorldNameGetter) {
  updateChat(iframe, currentWorldNameGetter);
  setInterval(() => updateChat(iframe, currentWorldNameGetter), 1000);
  
  if (chatSendBtn) {
    chatSendBtn.addEventListener('click', sendChatMessage);
  }
  
  if (chatInput) {
    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        sendChatMessage();
      }
    });
  }
  
  if (chatHistoryBtn) {
    chatHistoryBtn.addEventListener('click', openChatHistory);
  }
  
  if (chatHistoryClose) {
    chatHistoryClose.addEventListener('click', closeChatHistory);
  }
  
  if (chatHistoryModal) {
    chatHistoryModal.addEventListener('click', (e) => {
      if (e.target === chatHistoryModal) {
        closeChatHistory();
      }
    });
  }
  
  if (chatHistorySendBtn) {
    chatHistorySendBtn.addEventListener('click', sendChatMessage);
  }
  
  if (chatHistoryInput) {
    chatHistoryInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        sendChatMessage();
      }
    });
  }
}

function updateChat(iframe, currentWorldNameGetter) {
  try {
    const iframeWindow = iframe.contentWindow;
    if (iframeWindow.dynmap && iframeWindow.dynmap.chat) {
      const dynmapChat = iframeWindow.dynmap.chat;
      if (dynmapChat.length > chatMessages.length) {
        chatMessages = [...dynmapChat];
        displayChatMessages();
        return;
      }
    }
  } catch (e) {
    console.debug('Cannot access iframe chat:', e);
  }
  
  const timestamp = Date.now();
  const currentWorldName = currentWorldNameGetter();
  fetch(`dynmap/up/world/${currentWorldName || 'world'}/${chatUpdateTimestamp}`)
    .then(response => {
      if (!response.ok) throw new Error('API response not ok');
      return response.json();
    })
    .then(data => {
      chatUpdateTimestamp = data.timestamp || timestamp;
      
      if (data.updates && Array.isArray(data.updates)) {
        let newMessagesAdded = false;
        data.updates.forEach(update => {
          if (update.type === 'chat') {
            const msgTimestamp = update.timestamp || Date.now();
            const exists = chatMessages.some(msg => 
              msg.timestamp === msgTimestamp && 
              msg.message === update.message &&
              msg.playerName === (update.playerName || update.source)
            );
            
            if (!exists) {
              chatMessages.push({
                playerName: update.playerName || update.source || 'Server',
                message: update.message || '',
                timestamp: msgTimestamp,
                account: update.account
              });
              newMessagesAdded = true;
            }
          }
        });
        
        if (newMessagesAdded) {
          if (chatMessages.length > 100) {
            chatMessages = chatMessages.slice(-100);
          }
          displayChatMessages();
        }
      }
    })
    .catch(err => {
      console.debug('Error fetching chat updates:', err);
    });
}

function displayChatMessages() {
  if (!chatMessagesContainer) return;
  
  const recentMessages = chatMessages.slice(-5);
  
  recentMessages.forEach((msg) => {
    if (msg.timestamp <= lastDisplayedMessageId) {
      return;
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message';
    messageDiv.dataset.timestamp = msg.timestamp;
    
    if (msg.playerName === 'Server' || msg.playerName === 'System' || !msg.playerName) {
      messageDiv.innerHTML = `<span class="chat-message-system">${escapeHtml(msg.message)}</span>`;
    } else {
      messageDiv.innerHTML = `<span class="chat-message-player">${escapeHtml(msg.playerName)}:</span> <span class="chat-message-text">${escapeHtml(msg.message)}</span>`;
    }
    
    chatMessagesContainer.appendChild(messageDiv);
    lastDisplayedMessageId = msg.timestamp;
    
    const timeout = setTimeout(() => {
      messageDiv.classList.add('fading');
      setTimeout(() => {
        if (messageDiv.parentNode) {
          messageDiv.remove();
        }
        messageTimeouts.delete(msg.timestamp);
      }, 500);
    }, 8000);
    
    messageTimeouts.set(msg.timestamp, timeout);
  });
  
  if (isHistoryOpen) {
    updateChatHistory();
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function sendChatMessage() {
  let focusedChatInput;
  let focusedChatSendBtn;
  if (isHistoryOpen) {
    focusedChatInput = chatHistoryInput;
    focusedChatSendBtn = chatHistorySendBtn;
  } else {
    focusedChatInput = chatInput;
    focusedChatSendBtn = chatSendBtn;
  }
  const message = focusedChatInput.value.trim();
  if (!message) return;

  focusedChatInput.disabled = true;
  if (focusedChatSendBtn) focusedChatSendBtn.disabled = true;

  fetch('dynmap/up/sendmessage', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'WebUser',
      message: message
    })
  })
    .then(response => {
      if (!response.ok) {
        const formData = new FormData();
        formData.append('name', 'WebUser');
        formData.append('message', message);
        
        return fetch('dynmap/up/sendmessage', {
          method: 'POST',
          body: formData
        });
      }
      return response;
    })
    .then(response => response.json())
    .then(data => {
      if (data.error === 'none' || !data.error) {
        focusedChatInput.value = '';
        displayChatMessages();
      } else {
        console.error('Error sending message:', data.error);
        showChatError('Error sending message: ' + data.error);
      }
    })
    .catch(err => {
      console.error('Error sending message:', err);
      showChatError('Error sending message: ' + err.message);
    })
    .finally(() => {
      focusedChatInput.disabled = false;
      if (focusedChatSendBtn) focusedChatSendBtn.disabled = false;
      focusedChatInput.focus();
    });
}

function showChatError(errorMsg) {
  const errorMessage = {
    playerName: 'System',
    message: errorMsg,
    timestamp: Date.now()
  };
  chatMessages.push(errorMessage);
  displayChatMessages();
}

function openChatHistory() {
  if (!chatHistoryModal || !chatHistoryMessages) return;
  
  isHistoryOpen = true;
  updateChatHistory();
  chatHistoryModal.style.display = 'flex';
  
  if (chatHistoryInput) {
    chatHistoryInput.focus();
  }
}

function updateChatHistory() {
  if (!chatHistoryMessages) return;
  
  const wasScrolledToBottom = chatHistoryMessages.scrollHeight - chatHistoryMessages.scrollTop <= chatHistoryMessages.clientHeight + 50;
  
  chatHistoryMessages.innerHTML = '';
  
  if (chatMessages.length === 0) {
    const emptyMsg = document.createElement('div');
    emptyMsg.className = 'chat-history-empty';
    emptyMsg.textContent = 'No messages yet...';
    chatHistoryMessages.appendChild(emptyMsg);
  } else {
    chatMessages.forEach(msg => {
      const messageDiv = document.createElement('div');
      messageDiv.className = 'chat-message';
      
      const time = new Date(msg.timestamp);
      const timeStr = time.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      
      if (msg.playerName === 'Server' || msg.playerName === 'System' || !msg.playerName) {
        messageDiv.innerHTML = `
          <span class="chat-message-time">[${timeStr}]</span>
          <span class="chat-message-system">${escapeHtml(msg.message)}</span>
        `;
      } else {
        messageDiv.innerHTML = `
          <span class="chat-message-time">[${timeStr}]</span>
          <span class="chat-message-player">${escapeHtml(msg.playerName)}:</span>
          <span class="chat-message-text">${escapeHtml(msg.message)}</span>
        `;
      }
      
      chatHistoryMessages.appendChild(messageDiv);
    });
    
    if (wasScrolledToBottom) {
      chatHistoryMessages.scrollTop = chatHistoryMessages.scrollHeight;
    }
  }
}

function closeChatHistory() {
  if (chatHistoryModal) {
    isHistoryOpen = false;
    chatHistoryModal.style.display = 'none';
  }
}
