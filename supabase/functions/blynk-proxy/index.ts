import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { authToken, method, endpoint, data } = await req.json();

    if (!authToken) {
      throw new Error('Auth token is required');
    }

    console.log(`Blynk API request: ${method} ${endpoint}`);

    const blynkUrl = `https://blynk.cloud/external/api${endpoint}`;
    
    const options: RequestInit = {
      method: method || 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    };

    if (data && (method === 'PUT' || method === 'POST')) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(blynkUrl, options);
    const responseData = await response.text();

    console.log(`Blynk response status: ${response.status}`);

    return new Response(
      JSON.stringify({
        success: response.ok,
        status: response.status,
        data: responseData ? JSON.parse(responseData) : null,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Blynk proxy error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
