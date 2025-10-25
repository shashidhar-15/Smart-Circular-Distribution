import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const users = [
      { email: 'user1@sdmit.in', password: 'USER1@sdmit.in' },
      { email: 'user2@sdmit.in', password: 'USER2@sdmit.in' },
      { email: 'user3@sdmit.in', password: 'USER3@sdmit.in' },
      { email: 'user4@sdmit.in', password: 'USER4@sdmit.in' },
      { email: 'user5@sdmit.in', password: 'USER5@sdmit.in' },
    ];

    const results = [];
    
    for (const user of users) {
      console.log(`Creating user: ${user.email}`);
      
      // Check if user already exists
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const userExists = existingUsers?.users.some(u => u.email === user.email);
      
      if (userExists) {
        console.log(`User ${user.email} already exists, skipping...`);
        results.push({ email: user.email, status: 'already_exists' });
        continue;
      }

      // Create the user
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
      });

      if (error) {
        console.error(`Error creating user ${user.email}:`, error);
        results.push({ email: user.email, status: 'error', error: error.message });
      } else {
        console.log(`Successfully created user: ${user.email}`);
        results.push({ email: user.email, status: 'created', id: data.user?.id });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'User initialization complete',
        results 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in initialize-users function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        success: false 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
