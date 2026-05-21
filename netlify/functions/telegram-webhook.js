// ====================================================================
// NETLIFY FUNCTION: telegram-webhook.js
// ====================================================================
// Recibe eventos entrantes desde la API del Bot de Telegram (Webhooks).

const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
  // Telegram envía peticiones vía POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    // 1. Validar cuerpo de la petición
    if (!event.body) {
      return { statusCode: 400, body: 'Empty body' };
    }

    const payload = JSON.parse(event.body);
    console.log('Incoming Telegram Payload:', JSON.stringify(payload));

    // Validar que el payload contenga un mensaje
    const message = payload.message || payload.edited_message;
    if (!message || !message.chat) {
      // Retornar 200 OK a Telegram para evitar que siga reintentando eventos inválidos
      return { statusCode: 200, body: 'No message content to process' };
    }

    const chatId = message.chat.id;
    const text = message.text || message.caption || '[Mensaje no de texto o multimedia]';
    const from = message.from || {};

    const firstName = from.first_name || '';
    const lastName = from.last_name || '';
    const username = from.username || '';

    // 2. Inicializar cliente Supabase con Service Role Key (para saltar RLS de forma segura en backend)
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase Environment Variables');
      return { statusCode: 500, body: 'Server configuration error' };
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 3. Registrar o actualizar al usuario en la tabla 'chats' (Upsert)
    const { error: upsertError } = await supabase
      .from('chats')
      .upsert({
        id: chatId,
        username: username,
        first_name: firstName,
        last_name: lastName,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });

    if (upsertError) {
      console.error('Error upserting chat:', upsertError);
      throw upsertError;
    }

    // 4. Guardar el mensaje entrante en la tabla 'messages'
    const { error: insertError } = await supabase
      .from('messages')
      .insert({
        chat_id: chatId,
        sender: 'user', // Indica que proviene del cliente de Telegram
        text: text,
        created_at: new Date().toISOString()
      });

    if (insertError) {
      console.error('Error inserting message:', insertError);
      throw insertError;
    }

    // 5. Responder a Telegram con 200 OK para confirmar recepción exitosa
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'Message logged successfully' })
    };

  } catch (error) {
    console.error('Webhook processing error:', error);
    // Siempre retornar un código 200 a Telegram a menos que sea un error de red crítico
    // para evitar que bloquee el bot en bucles de reintentos fallidos.
    return {
      statusCode: 200,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};
