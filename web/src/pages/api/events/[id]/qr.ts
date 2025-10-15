import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import QRCode from 'qrcode';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  db: {
    schema: 'api'
  }
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { method } = req;
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Event ID is required' });
  }

  try {
    switch (method) {
      case 'GET': {
        // Fetch event data
        const { data: event, error } = await supabase
          .from('events')
          .select('id, title, token')
          .eq('id', id)
          .single();

        if (error || !event) {
          return res.status(404).json({ error: 'Event not found' });
        }

        // Generate QR code URL for the event
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        const eventUrl = `${baseUrl}/event/${event.id}?token=${event.token}`;

        // Generate QR code as data URL
        const qrDataUrl = await QRCode.toDataURL(eventUrl, {
          width: 400,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });

        return res.status(200).json({
          id: event.id,
          name: event.title,
          token: event.token,
          qrUrl: qrDataUrl,
          eventUrl: eventUrl
        });
      }

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('QR API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
