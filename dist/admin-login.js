// ====================================================================
// LOGICA DE AUTENTICACION - BLUEBULL CMS
// ====================================================================

async function init() {
  const form = document.getElementById('login-form');
  const submitBtn = document.getElementById('btn-submit');
  const spinner = document.getElementById('spinner');
  const alertBox = document.getElementById('alert-box');

  try {
    // 1. Obtener claves públicas desde la Netlify Function para evitar hardcodear
    const response = await fetch('/.netlify/functions/config');
    if (!response.ok) {
      throw new Error('No se pudo cargar la configuración de Supabase desde el servidor.');
    }
    const config = await response.json();

    if (!config.supabaseUrl || !config.supabaseAnonKey) {
      throw new Error('Faltan configurar las variables de entorno de Supabase en Netlify.');
    }

    // 2. Inicializar cliente Supabase
    const supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);

    // 3. Verificar si ya hay una sesión activa, si es así redirigir directo
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      window.location.href = 'admin.html';
      return;
    }

    // 4. Manejar el evento de submit
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Resetear alertas y poner en carga
      alertBox.style.display = 'none';
      submitBtn.disabled = true;
      spinner.style.display = 'block';

      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;

      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (error) {
          throw error;
        }

        // Login exitoso: Guardar token y redirigir
        window.location.href = 'admin.html';

      } catch (authError) {
        console.error('Error de autenticación:', authError);
        
        let errorMsg = 'Error al intentar iniciar sesión. Por favor reintentá.';
        if (authError.message === 'Invalid login credentials') {
          errorMsg = 'Credenciales inválidas. Verificá tu email y contraseña.';
        } else if (authError.message) {
          errorMsg = authError.message;
        }

        alertBox.textContent = errorMsg;
        alertBox.style.display = 'block';
        submitBtn.disabled = false;
        spinner.style.display = 'none';
      }
    });

  } catch (err) {
    console.error('Error de inicialización en login:', err);
    alertBox.textContent = `Error de configuración: ${err.message}`;
    alertBox.style.display = 'block';
    submitBtn.disabled = true;
  }
}

document.addEventListener('DOMContentLoaded', init);
