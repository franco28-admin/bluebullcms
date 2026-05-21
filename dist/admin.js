// ====================================================================
// LOGICA DEL DASHBOARD DE SOPORTE EN TIEMPO REAL - BLUEBULL CMS
// ====================================================================

let supabase = null;
let currentChatId = null;
let chatsData = []; // Caché de chats en local
let unreadCounts = {}; // Trackeo de mensajes no leídos por chatId
let messagesSubscription = null;

// 1. Inicialización Principal
async function init() {
  setupTabs();
  setupLogout();
  
  try {
    // Obtener claves desde la función serverless
    const response = await fetch('/.netlify/functions/config');
    if (!response.ok) throw new Error('No se pudo obtener la configuración de Supabase.');
    const config = await response.json();
    
    // Inicializar Supabase
    supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
    
    // Proteger la ruta: Verificar si el admin está logueado
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      // Redirigir a login si no hay sesión
      window.location.href = 'admin-login.html';
      return;
    }
    
    // Si la sesión es válida, revelar la interfaz
    document.body.style.opacity = '1';
    document.body.style.pointerEvents = 'auto';
    
    // Cargar datos
    await loadChats();
    setupRealtimeSubscription();
    setupSearch();
    setupSendForm();
    setupSettingsForm();
    await updateStats();
    
  } catch (err) {
    document.body.style.opacity = '1';
    document.body.style.pointerEvents = 'auto';
    console.error('Error al inicializar el panel:', err);
    alert(`Error crítico de conexión: ${err.message}\nRevisa que las variables de entorno en Netlify estén bien configuradas.`);
  }
}

// 2. Control de Pestañas (Panes)
function setupTabs() {
  window.switchPane = (paneName) => {
    const tabs = document.querySelectorAll('.nav-tab');
    const paneChats = document.getElementById('pane-chats');
    const paneSettings = document.getElementById('pane-settings');
    
    tabs.forEach(tab => tab.classList.remove('active'));
    
    if (paneName === 'chats') {
      document.getElementById('tab-chats').classList.add('active');
      paneChats.style.display = 'flex';
      paneSettings.style.display = 'none';
    } else if (paneName === 'settings') {
      document.getElementById('tab-settings').classList.add('active');
      paneChats.style.display = 'none';
      paneSettings.style.display = 'block';
      updateStats(); // Recargar métricas al entrar a ajustes
      checkWebhookStatus();
    }
  };
}

// 3. Cerrar Sesión
function setupLogout() {
  const btnLogout = document.getElementById('btn-logout');
  btnLogout.addEventListener('click', async () => {
    try {
      if (supabase) {
        await supabase.auth.signOut();
      }
    } catch (e) {
      console.error('Logout error:', e);
    } finally {
      localStorage.clear();
      window.location.href = 'admin-login.html';
    }
  });
}

// 4. Cargar Chats desde Supabase
async function loadChats() {
  try {
    // Traer todos los chats ordenados por su actualización más reciente
    const { data, error } = await supabase
      .from('chats')
      .select('*')
      .order('updated_at', { ascending: false });
      
    if (error) throw error;
    
    chatsData = data || [];
    await renderChatsList();
  } catch (err) {
    console.error('Error al cargar chats:', err);
    document.getElementById('chat-list').innerHTML = `
      <div class="empty-chats">
        <span style="color: var(--error)">Error al conectar con las tablas. Asegurate de correr el script SQL en Supabase.</span>
      </div>`;
  }
}

// 5. Renderizar Lista de Chats en el Sidebar
async function renderChatsList(filterQuery = '') {
  const listContainer = document.getElementById('chat-list');
  listContainer.innerHTML = '';
  
  const filtered = chatsData.filter(chat => {
    const fullName = `${chat.first_name || ''} ${chat.last_name || ''}`.toLowerCase();
    const username = (chat.username || '').toLowerCase();
    const query = filterQuery.toLowerCase();
    return fullName.includes(query) || username.includes(query);
  });
  
  if (filtered.length === 0) {
    listContainer.innerHTML = `
      <div class="empty-chats">
        <span>No se encontraron conversaciones.</span>
      </div>`;
    return;
  }
  
  for (const chat of filtered) {
    const chatId = chat.id;
    const isSelected = chatId === currentChatId;
    const name = `${chat.first_name || 'Usuario'} ${chat.last_name || ''}`.trim();
    const username = chat.username ? `@${chat.username}` : `ID: ${chatId}`;
    const initials = (chat.first_name ? chat.first_name[0] : 'U').toUpperCase();
    
    // Obtener el último mensaje para la previsualización
    const lastMsg = await fetchLastMessage(chatId);
    const timeText = lastMsg ? formatTime(new Date(lastMsg.created_at)) : '';
    const previewText = lastMsg ? lastMsg.text : 'Sin mensajes';
    
    const unread = unreadCounts[chatId] || 0;
    const badgeHtml = (unread > 0 && !isSelected) ? `<span class="unread-badge">${unread}</span>` : '';
    
    const item = document.createElement('div');
    item.className = `chat-item ${isSelected ? 'active' : ''}`;
    item.dataset.id = chatId;
    item.onclick = () => selectChat(chatId, name, username, initials);
    
    item.innerHTML = `
      <div class="avatar">${initials}</div>
      <div class="chat-info">
        <div class="chat-name-row">
          <span class="chat-name">${name}</span>
          <span class="chat-time">${timeText}</span>
        </div>
        <div class="chat-preview-row">
          <span class="chat-preview">${previewText}</span>
          ${badgeHtml}
        </div>
      </div>
    `;
    listContainer.appendChild(item);
  }
}

// Helper: Traer el último mensaje de un chat
async function fetchLastMessage(chatId) {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: false })
      .limit(1);
      
    if (error) throw error;
    return data && data.length > 0 ? data[0] : null;
  } catch (err) {
    return null;
  }
}

// 6. Seleccionar y Cargar un Chat en Detalle
async function selectChat(chatId, name, subtitle, initials) {
  currentChatId = chatId;
  unreadCounts[chatId] = 0; // Limpiar contador de no leídos
  
  // Actualizar UI del Sidebar
  document.querySelectorAll('.chat-item').forEach(item => {
    item.classList.remove('active');
    if (item.dataset.id == chatId) {
      item.classList.add('active');
      const badge = item.querySelector('.unread-badge');
      if (badge) badge.remove();
    }
  });
  
  // Mostrar pantalla activa
  document.getElementById('chat-welcome').style.display = 'none';
  document.getElementById('chat-active').style.display = 'flex';
  
  // Llenar datos de cabecera
  document.getElementById('active-name').textContent = name;
  document.getElementById('active-username').textContent = subtitle;
  const avatar = document.getElementById('active-avatar');
  avatar.textContent = initials;
  
  // Limpiar historial de chat y cargar mensajes históricos
  const historyContainer = document.getElementById('chat-history');
  historyContainer.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 20px;">Cargando mensajes...</div>';
  
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });
      
    if (error) throw error;
    
    historyContainer.innerHTML = '';
    if (data && data.length > 0) {
      data.forEach(msg => appendMessageBubble(msg));
    } else {
      historyContainer.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 20px;">No hay mensajes en esta conversación.</div>';
    }
    
    scrollToBottom();
    
  } catch (err) {
    console.error('Error al cargar historial de chat:', err);
    historyContainer.innerHTML = '<div style="color: var(--error); text-align: center; padding: 20px;">Error al cargar mensajes.</div>';
  }
}

// 7. Insertar Burbuja de Mensaje en la Interfaz
function appendMessageBubble(msg) {
  const historyContainer = document.getElementById('chat-history');
  
  // Remover el aviso de "No hay mensajes" si existe
  if (historyContainer.querySelector('[style*="color: var(--text-muted)"]')) {
    historyContainer.innerHTML = '';
  }
  
  const isUser = msg.sender === 'user';
  const name = isUser ? document.getElementById('active-name').textContent : 'Admin BlueBull';
  
  const msgEl = document.createElement('div');
  msgEl.className = `message ${isUser ? 'user' : 'admin'}`;
  
  const time = formatTime(new Date(msg.created_at));
  
  msgEl.innerHTML = `
    <span class="msg-sender-name">${isUser ? 'Cliente (Telegram)' : 'Admin BlueBull'}</span>
    <div class="msg-bubble">
      <span>${escapeHtml(msg.text)}</span>
      <span class="msg-time">${time}</span>
    </div>
  `;
  
  historyContainer.appendChild(msgEl);
}

// 8. Suscripción en Tiempo Real con Supabase Realtime
function setupRealtimeSubscription() {
  if (messagesSubscription) {
    messagesSubscription.unsubscribe();
  }
  
  // Suscribirse a las inserciones en la tabla messages
  messagesSubscription = supabase
    .channel('public:messages')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
      const newMsg = payload.new;
      
      // Si el mensaje entrante es del chat actualmente abierto
      if (newMsg.chat_id === currentChatId) {
        appendMessageBubble(newMsg);
        scrollToBottom();
      } else {
        // Si es de otro chat y el remitente es el usuario de Telegram, incrementar no leídos
        if (newMsg.sender === 'user') {
          unreadCounts[newMsg.chat_id] = (unreadCounts[newMsg.chat_id] || 0) + 1;
        }
      }
      
      // Recargar lista de chats del sidebar silenciosamente para actualizar previsualizaciones y badges
      await loadChats();
    })
    .subscribe();
}

// 9. Enviar Mensaje desde el CMS a Telegram
function setupSendForm() {
  const form = document.getElementById('send-message-form');
  const input = document.getElementById('input-message');
  const btnSend = document.getElementById('btn-send');
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const text = input.value.trim();
    if (!text || !currentChatId) return;
    
    // Bloquear controles durante el envío
    input.disabled = true;
    btnSend.disabled = true;
    
    try {
      // Obtener el token de sesión del admin de forma segura
      const { data: { session } } = await supabase.auth.getSession();
      const token = session ? session.access_token : '';

      // Llamar a nuestra Netlify Function para enviar la respuesta vía Bot API de Telegram
      const response = await fetch('/.netlify/functions/send-reply', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          chatId: currentChatId,
          text: text
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al enviar respuesta al bot.');
      }
      
      // Limpiar input al tener éxito
      input.value = '';
      
    } catch (err) {
      console.error('Error al enviar mensaje:', err);
      alert(`No se pudo enviar el mensaje a Telegram: ${err.message}`);
    } finally {
      // Desbloquear controles
      input.disabled = false;
      btnSend.disabled = false;
      input.focus();
    }
  });
  
  // Soporte para envío rápido con respuestas prediseñadas
  window.insertQuickReply = (text) => {
    input.value = text;
    input.focus();
  };
}

// 10. Configuración del Formulario de Ajustes (Vincular Webhook)
function setupSettingsForm() {
  const form = document.getElementById('settings-telegram-form');
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const token = document.getElementById('set-bot-token').value.trim();
    const url = document.getElementById('set-netlify-url').value.trim();
    
    if (!token || !url) {
      showBanner('settings', 'Por favor completa todos los campos del formulario.', 'error');
      return;
    }
    
    showBanner('settings', 'Configurando Webhook en Telegram...', 'success');
    
    try {
      // Obtener el token de sesión activo de Supabase
      const { data: { session } } = await supabase.auth.getSession();
      const tokenJWT = session ? session.access_token : '';

      // Llamar a la Netlify Function para registrar el webhook
      const response = await fetch('/.netlify/functions/register-webhook', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenJWT}`
        },
        body: JSON.stringify({ token, url })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Fallo de registro.');
      }
      
      showBanner('settings', '¡Webhook registrado con éxito en los servidores de Telegram!', 'success');
      document.getElementById('stat-webhook').textContent = 'Conectado';
      document.getElementById('stat-webhook').style.color = 'var(--success)';
      
    } catch (err) {
      console.error('Error de configuración:', err);
      showBanner('settings', `Error al registrar Webhook: ${err.message}`, 'error');
    }
  });
}

// 11. Cargar Estadísticas en Ajustes
async function updateStats() {
  if (!supabase) return;
  
  try {
    // 1. Obtener chats totales
    const { count: chatsCount, error: errChats } = await supabase
      .from('chats')
      .select('*', { count: 'exact', head: true });
      
    if (errChats) throw errChats;
    document.getElementById('stat-chats').textContent = chatsCount || 0;
    
    // 2. Obtener mensajes totales
    const { count: msgsCount, error: errMsgs } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true });
      
    if (errMsgs) throw errMsgs;
    document.getElementById('stat-messages').textContent = msgsCount || 0;
    
  } catch (err) {
    console.error('Error al cargar estadísticas:', err);
  }
}

// 12. Verificar estado actual del Webhook (Consulta rápida)
async function checkWebhookStatus() {
  // Intentar traer los valores de Netlify si existen
  try {
    const response = await fetch('/.netlify/functions/webhook-status');
    if (response.ok) {
      const data = await response.json();
      const statusEl = document.getElementById('stat-webhook');
      if (data.active) {
        statusEl.textContent = 'Conectado';
        statusEl.style.color = 'var(--success)';
      } else {
        statusEl.textContent = 'Desconectado';
        statusEl.style.color = '#ff8a80';
      }
    }
  } catch (err) {
    // Silencioso
  }
}

// --- UTILERIAS ---

function scrollToBottom() {
  const container = document.getElementById('chat-history');
  container.scrollTop = container.scrollHeight;
}

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showBanner(pane, text, type) {
  const banner = document.getElementById(`${pane}-banner`);
  banner.textContent = text;
  banner.className = `banner ${type}`;
  banner.style.display = 'block';
  
  if (type === 'success') {
    setTimeout(() => {
      banner.style.display = 'none';
    }, 5000);
  }
}

function setupSearch() {
  const searchInput = document.getElementById('search-input');
  searchInput.addEventListener('input', (e) => {
    renderChatsList(e.target.value);
  });
}

document.addEventListener('DOMContentLoaded', init);
