-- Create broadcast_messages table
CREATE TABLE IF NOT EXISTS public.broadcast_messages (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  CONSTRAINT valid_date_range CHECK (end_date > start_date)
);

-- Create broadcast_message_views table to track which users have seen which messages
CREATE TABLE IF NOT EXISTS public.broadcast_message_views (
  id SERIAL PRIMARY KEY,
  message_id INTEGER REFERENCES public.broadcast_messages(id) ON DELETE CASCADE NOT NULL,
  staff_id UUID REFERENCES public.staff(id) ON DELETE CASCADE NOT NULL,
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(message_id, staff_id)
);
