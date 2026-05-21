// ====================================================================
// NETLIFY FUNCTION: config.js
// ====================================================================
// Retorna las credenciales públicas de Supabase guardadas en las variables de entorno de Netlify.

exports.handler = async (event, context) => {
  try {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        // Prevenir cacheo para asegurar configuraciones frescas
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
      body: JSON.stringify({
        supabaseUrl: process.env.SUPABASE_URL || "",
        supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "",
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
