/*
  # Add WhatsApp Groups Tracking
  
  1. New Tables
    - `whatsapp_groups`
      - `id` (text, primary key) - Group ID from WhatsApp (e.g., "120363271212442249@g.us")
      - `name` (text) - Group name
      - `type` (text) - Always "group"
      - `chat_pic` (text, nullable) - Group profile picture URL
      - `chat_pic_full` (text, nullable) - Full resolution profile picture URL
      - `created_at` (timestamptz) - When the group was created
      - `created_by` (text) - Phone number of creator
      - `name_at` (timestamptz, nullable) - When the name was last changed
      - `admin_add_member_mode` (boolean) - Whether only admins can add members
      - `first_seen_at` (timestamptz) - When we first discovered this group
      - `last_updated_at` (timestamptz) - Last time we received an update
      
    - `whatsapp_group_participants`
      - `group_id` (text) - References whatsapp_groups.id
      - `phone` (text) - Participant phone number
      - `rank` (text) - Role: "creator", "admin", or "member"
      - `joined_at` (timestamptz) - When they joined
      - `updated_at` (timestamptz) - Last update
      - Primary key: (group_id, phone)
      
    - `whatsapp_group_events`
      - `id` (uuid, primary key)
      - `group_id` (text) - References whatsapp_groups.id
      - `event_type` (text) - Type of event: "created", "participant_added", "participant_removed", "participant_promoted", "participant_demoted", "name_changed", "picture_changed", "join_request"
      - `participants` (text[], nullable) - Phone numbers affected by this event
      - `old_value` (text, nullable) - Previous value (for name/picture changes)
      - `new_value` (text, nullable) - New value (for name/picture changes)
      - `triggered_by` (text, nullable) - Who triggered this event
      - `occurred_at` (timestamptz) - When the event occurred
      - `created_at` (timestamptz) - When we recorded this event
      
  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to read group data
    
  3. Indexes
    - Index on group_id for faster lookups
    - Index on event timestamps for history queries
*/

-- Create whatsapp_groups table
CREATE TABLE IF NOT EXISTS whatsapp_groups (
  id text PRIMARY KEY,
  name text NOT NULL,
  type text DEFAULT 'group',
  chat_pic text,
  chat_pic_full text,
  created_at timestamptz NOT NULL,
  created_by text NOT NULL,
  name_at timestamptz,
  admin_add_member_mode boolean DEFAULT true,
  first_seen_at timestamptz DEFAULT now(),
  last_updated_at timestamptz DEFAULT now()
);

-- Create whatsapp_group_participants table
CREATE TABLE IF NOT EXISTS whatsapp_group_participants (
  group_id text NOT NULL REFERENCES whatsapp_groups(id) ON DELETE CASCADE,
  phone text NOT NULL,
  rank text NOT NULL CHECK (rank IN ('creator', 'admin', 'member')),
  joined_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (group_id, phone)
);

-- Create whatsapp_group_events table
CREATE TABLE IF NOT EXISTS whatsapp_group_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id text NOT NULL REFERENCES whatsapp_groups(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN (
    'created', 
    'participant_added', 
    'participant_removed', 
    'participant_promoted', 
    'participant_demoted',
    'join_request',
    'name_changed', 
    'picture_changed'
  )),
  participants text[],
  old_value text,
  new_value text,
  triggered_by text,
  occurred_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_whatsapp_groups_last_updated ON whatsapp_groups(last_updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_group_participants_group ON whatsapp_group_participants(group_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_group_participants_phone ON whatsapp_group_participants(phone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_group_events_group ON whatsapp_group_events(group_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_group_events_type ON whatsapp_group_events(event_type, occurred_at DESC);

-- Enable RLS
ALTER TABLE whatsapp_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_group_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_group_events ENABLE ROW LEVEL SECURITY;

-- Policies for whatsapp_groups
CREATE POLICY "Authenticated users can view groups"
  ON whatsapp_groups FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert groups"
  ON whatsapp_groups FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update groups"
  ON whatsapp_groups FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policies for whatsapp_group_participants
CREATE POLICY "Authenticated users can view group participants"
  ON whatsapp_group_participants FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert group participants"
  ON whatsapp_group_participants FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update group participants"
  ON whatsapp_group_participants FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete group participants"
  ON whatsapp_group_participants FOR DELETE
  TO authenticated
  USING (true);

-- Policies for whatsapp_group_events
CREATE POLICY "Authenticated users can view group events"
  ON whatsapp_group_events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert group events"
  ON whatsapp_group_events FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Function to automatically update last_updated_at
CREATE OR REPLACE FUNCTION update_whatsapp_groups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update last_updated_at
DROP TRIGGER IF EXISTS whatsapp_groups_updated_at_trigger ON whatsapp_groups;
CREATE TRIGGER whatsapp_groups_updated_at_trigger
  BEFORE UPDATE ON whatsapp_groups
  FOR EACH ROW
  EXECUTE FUNCTION update_whatsapp_groups_updated_at();

-- Function to automatically update participants updated_at
CREATE OR REPLACE FUNCTION update_whatsapp_group_participants_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update participants updated_at
DROP TRIGGER IF EXISTS whatsapp_group_participants_updated_at_trigger ON whatsapp_group_participants;
CREATE TRIGGER whatsapp_group_participants_updated_at_trigger
  BEFORE UPDATE ON whatsapp_group_participants
  FOR EACH ROW
  EXECUTE FUNCTION update_whatsapp_group_participants_updated_at();