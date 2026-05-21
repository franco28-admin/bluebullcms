// ====================================================================
// NETLIFY FUNCTION: send-reply.js
// ====================================================================
// Recibe las respuestas escritas por el administrador en el CMS, las
// envía al usuario vía Telegram Bot API y las guarda en Supabase.

const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
  // Solo permitir peticiones POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const { chatId, text } = JSON.parse(event.body);

    if (!chatId || !text) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'chatId y text son requeridos.' })
      };
    }

    // 1. Inicializar cliente Supabase público y privado
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!supabaseUrl || !supabaseServiceKey || !telegramBotToken) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Configuración del servidor incompleta (variables de entorno faltantes).' })
      };
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 2. SEGURIDAD EXTRACTOR: Verificar sesión del administrador
    // Opcional pero altamente recomendado: Validar la sesión antes de procesar el envío
    // Si la cabecera de autorización viene en el request, verificamos la autenticidad del JWT.
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (authHeader) {
      const token = authHeader.split(' ')[1];
      if (token) {
        // Inicializar cliente estándar con el token del usuario para validar
        const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
          auth: { persistSession: false }
        });
        const { data: { user }, error: authError } = await supabaseUser.auth.getUser(token);
        
        if (authError || !user) {
          return {
            statusCode: 401,
            body: JSON.stringify({ error: 'Sesión inválida o expirada. Volvé a ingresar.' })
          };
        }
      }
    }

    // 3. Enviar el mensaje a Telegram a través del Bot API
    const telegramUrl = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`;
    const telegramResponse = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text
      })
    });

    if (!telegramResponse.ok) {
      const errorMsg = await telegramResponse.text();
      console.error('Error de Telegram API:', errorMsg);
      throw new Error(`Telegram API Error: ${errorMsg}`);
    }

    // 4. Registrar la respuesta del admin en la tabla 'messages'
    const { error: insertError } = await supabaseAdmin
      .from('messages')
      .insert({
        chat_id: chatId,
        sender: 'admin', // Indica que proviene del administrador
        text: text,
        created_at: new Date().toISOString()
      });

    if (insertError) {
      console.error('Error al guardar mensaje del admin:', insertError);
      throw insertError;
    }

    // 5. Actualizar el timestamp 'updated_at' en 'chats' para mover este chat arriba
    await supabaseAdmin
      .from('chats')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', chatId);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };

  } catch (error) {
    console.error('Error en send-reply handler:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
