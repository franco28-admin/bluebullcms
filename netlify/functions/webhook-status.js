// ====================================================================
// NETLIFY FUNCTION: webhook-status.js
// ====================================================================
// Consulta de forma dinámica si el webhook del bot está configurado en Telegram.

exports.handler = async (event, context) => {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;

    if (!token) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: false, reason: 'TELEGRAM_BOT_TOKEN no configurado en Netlify.' })
      };
    }

    // Consultar a Telegram el estado actual del webhook
    const telegramUrl = `https://api.telegram.org/bot${token}/getWebhookInfo`;
    const response = await fetch(telegramUrl);
    const data = await response.json();

    if (!response.ok || !data.ok) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: false, reason: 'Token inválido o error en API de Telegram.' })
      };
    }

    const info = data.result || {};
    const hasWebhook = !!info.url;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      },
      body: JSON.stringify({
        active: hasWebhook,
        url: info.url || '',
        pending_update_count: info.pending_update_count || 0,
        last_error_date: info.last_error_date || null,
        last_error_message: info.last_error_message || ''
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
