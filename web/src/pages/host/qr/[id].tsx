import { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import { useState } from 'react';
import Header from '../../../components/Header';

interface EventQRData {
  id: string;
  name: string;
  token: string;
  qrUrl: string;
}

interface HostQRPageProps {
  event: EventQRData;
  error?: string;
}

const HostQRPage: React.FC<HostQRPageProps> = ({ event, error }) => {
  const router = useRouter();
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [currentToken, setCurrentToken] = useState(event?.token || '');
  const [currentQrUrl, setCurrentQrUrl] = useState(event?.qrUrl || '');

  const handleGoToFeed = () => {
    router.push(`/event/${event.id}`);
  };

  const handleRegenerateToken = async () => {
    setIsRegenerating(true);
    try {
      const response = await fetch(`/api/events/${event.id}/qr/regenerate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentToken(data.token);
        setCurrentQrUrl(data.qrUrl);
      } else {
        console.error('Failed to regenerate token');
      }
    } catch (err) {
      console.error('Error regenerating token:', err);
    } finally {
      setIsRegenerating(false);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
            <p className="text-gray-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-center mb-2">{event.name}</h1>
          <p className="text-gray-600 text-center mb-6">Event QR Code</p>
          
          <div className="mb-6">
            <div className="bg-white p-4 rounded-lg border-2 border-gray-200">
              <div className="flex flex-col items-center">
                <div className="bg-gray-100 p-4 rounded-lg mb-4">
                  <img 
                    src={currentQrUrl} 
                    alt="Event QR Code"
                    className="w-48 h-48"
                  />
                </div>
                <div className="w-full">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Event Token
                  </label>
                  <div className="flex">
                    <input
                      type="text"
                      value={currentToken}
                      readOnly
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md bg-gray-50 text-sm"
                    />
                    <button
                      onClick={() => navigator.clipboard.writeText(currentToken)}
                      className="px-3 py-2 bg-blue-600 text-white rounded-r-md hover:bg-blue-700 text-sm"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <button
              onClick={handleGoToFeed}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition duration-200"
            >
              Go to Event Feed
            </button>

            <button
              onClick={handleRegenerateToken}
              disabled={isRegenerating}
              className="w-full bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition duration-200"
            >
              {isRegenerating ? 'Regenerating...' : 'Regenerate QR Code'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { id } = context.params!;

  try {
    // Import the Supabase client and QRCode on the server side
    const { createClient } = await import('@supabase/supabase-js');
    const QRCode = await import('qrcode');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    // Try api schema first, then public schema
    let event = null;
    let eventError = null;

    // Try api schema
    const supabaseApi = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      db: {
        schema: 'api'
      }
    });

    const { data: apiEvent, error: apiError } = await supabaseApi
      .from('events')
      .select('id, title, token')
      .eq('id', id)
      .single();

    if (apiEvent) {
      event = apiEvent;
    } else {
      // Try public schema
      const supabasePublic = createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });

      const { data: publicEvent, error: publicError } = await supabasePublic
        .from('events')
        .select('id, title, token')
        .eq('id', id)
        .single();

      if (publicEvent) {
        event = publicEvent;
      } else {
        eventError = publicError || apiError;
      }
    }

    if (!event) {
      console.error('Error fetching event from both schemas:', eventError);
      return {
        props: {
          event: null,
          error: 'Event not found'
        }
      };
    }

    // Generate QR code URL for the event
    const protocol = context.req.headers.host?.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${context.req.headers.host}`;
    const eventUrl = `${baseUrl}/join/${event.id}?token=${event.token}`;

    // Generate QR code as data URL
    const qrDataUrl = await QRCode.default.toDataURL(eventUrl, {
      width: 400,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    return {
      props: {
        event: {
          id: event.id,
          name: event.title,
          token: event.token,
          qrUrl: qrDataUrl
        }
      }
    };
  } catch (error) {
    console.error('Error in getServerSideProps:', error);
    return {
      props: {
        event: null,
        error: 'Error fetching event data'
      }
    };
  }
};

export default HostQRPage;