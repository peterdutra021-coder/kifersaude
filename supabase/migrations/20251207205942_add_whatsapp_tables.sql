/*
  # WhatsApp Integration Tables

  1. Tables Created
    - `whatsapp_webhook_events`
      - Stores raw webhook payloads for debugging
      - `id` (uuid, primary key)
      - `event` (text) - Event type
      - `payload` (jsonb) - Raw payload
      - `headers` (jsonb) - Request headers
      - `created_at` (timestamptz)
    
    - `whatsapp_chats`
      - Stores WhatsApp chat metadata
      - `id` (text, primary key) - Chat ID from WhatsApp
      - `name` (text) - Contact/group name
      - `is_group` (boolean) - Whether it's a group chat
      - `last_message_at` (timestamptz)
      - `created_at`, `updated_at` (timestamptz)
    
    - `whatsapp_messages`
      - Stores WhatsApp messages
      - `id` (text, primary key) - Message ID from WhatsApp
      - `chat_id` (text) - References whatsapp_chats
      - `from_number`, `to_number` (text)
      - `type` (text) - Message type
      - `body` (text) - Message content
      - `has_media` (boolean)
      - `timestamp` (timestamptz)
      - `direction` (text) - 'inbound' or 'outbound'
      - `payload` (jsonb) - Full message payload
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Only admins can read WhatsApp data
*/

CREATE TABLE IF NOT EXISTS whatsapp_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event text DEFAULT 'unknown',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  headers jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_webhook_events_created_at
  ON whatsapp_webhook_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_webhook_events_event
  ON whatsapp_webhook_events(event);

ALTER TABLE whatsapp_webhook_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'whatsapp_webhook_events' 
    AND policyname = 'Admins can read WhatsApp webhook events'
  ) THEN
    CREATE POLICY "Admins can read WhatsApp webhook events"
      ON whatsapp_webhook_events
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_profiles.id = auth.uid()
          AND user_profiles.role = 'admin'
        )
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS whatsapp_chats (
  id text PRIMARY KEY,
  name text,
  is_group boolean DEFAULT false,
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id text PRIMARY KEY,
  chat_id text NOT NULL REFERENCES whatsapp_chats(id) ON DELETE CASCADE,
  from_number text,
  to_number text,
  type text,
  body text,
  has_media boolean DEFAULT false,
  timestamp timestamptz,
  direction text CHECK (direction IN ('inbound', 'outbound')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_chat_id ON whatsapp_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_timestamp ON whatsapp_messages(timestamp DESC);

ALTER TABLE whatsapp_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'whatsapp_chats' 
    AND policyname = 'Admins can read WhatsApp chats'
  ) THEN
    CREATE POLICY "Admins can read WhatsApp chats" 
      ON whatsapp_chats
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_profiles.id = auth.uid()
          AND user_profiles.role = 'admin'
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'whatsapp_messages' 
    AND policyname = 'Admins can read WhatsApp messages'
  ) THEN
    CREATE POLICY "Admins can read WhatsApp messages" 
      ON whatsapp_messages
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_profiles.id = auth.uid()
          AND user_profiles.role = 'admin'
        )
      );
  END IF;
END $$;