-- ====================================================================
-- SCRIPT DE INICIALIZACIÓN DE BASE DE DATOS - BLUEBULL TELEGRAM CMS
-- ====================================================================
-- Ejecuta este script en el SQL Editor de tu proyecto de Supabase.

-- 1. Crear la tabla de chats (guarda los usuarios que escriben al bot)
CREATE TABLE IF NOT EXISTS chats (
  id BIGINT PRIMARY KEY, -- Telegram Chat ID (único)
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Crear la tabla de mensajes (historial de chats)
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id BIGINT REFERENCES chats(id) ON DELETE CASCADE NOT NULL,
  sender TEXT NOT NULL, -- 'user' (cliente Telegram) o 'admin' (panel CMS)
  text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Habilitar el tiempo real para la tabla de mensajes
-- Esto permite que el panel CMS reciba las inserciones al instante vía WebSockets.
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- 4. Opcional: Indices para mejorar la performance de las consultas
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
