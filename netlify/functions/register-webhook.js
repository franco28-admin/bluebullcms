// ====================================================================
// NETLIFY FUNCTION: register-webhook.js
// ====================================================================
// Registra dinámicamente el webhook del bot en los servidores de Telegram.

const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const { token, url } = JSON.parse(event.body);

    if (!token || !url) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Token y URL son requeridos.' })
      };
    }

    // Limpiar barras finales en la URL
    const cleanedUrl = url.endsWith('/') ? url.slice(0, -1) : url;
    const webhookUrl = `${cleanedUrl}/.netlify/functions/telegram-webhook`;

    // 1. Inicializar cliente Supabase para seguridad
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseAnonKey) {
      // Validar JWT del admin si está configurado
      const authHeader = event.headers.authorization || event.headers.Authorization;
      if (authHeader) {
        const jwtToken = authHeader.split(' ')[1];
        if (jwtToken) {
          const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            auth: { persistSession: false }
          });
          const { data: { user }, error: authError } = await supabase.auth.getUser(jwtToken);
          
          if (authError || !user) {
            return {
              statusCode: 401,
              body: JSON.stringify({ error: 'No autorizado. Iniciá sesión nuevamente.' })
            };
          }
        }
      }
    }

    // 2. Comunicarse con Telegram para configurar el webhook
    const telegramApiUrl = `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}`;
    console.log(`Registering Telegram Webhook with URL: ${webhookUrl}`);
    
    const response = await fetch(telegramApiUrl);
    const data = await response.json();

    if (!response.ok || !data.ok) {
      console.error('Telegram Webhook Registration Failed:', data);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: data.description || 'Fallo de registro en Telegram.' })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, description: data.description })
    };

  } catch (error) {
    console.error('Error in register-webhook handler:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
