import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    console.log('🔄 Iniciando proxy para extracción de PDF...');
    
    const { cv_url, mode, need_personal_data } = await req.json();
    
    if (!cv_url) {
      throw new Error('cv_url es requerido');
    }

    console.log('📄 URL del PDF:', cv_url);
    console.log('⚙️ Configuración:', { mode, need_personal_data });

    // Call the tech team's API
    const response = await fetch(
      "https://interview-api-dev.lapieza.io/api/v1/analize/cv",
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cv_url,
          mode: mode || "text",
          need_personal_data: need_personal_data || true,
        }),
      }
    );

    console.log('✅ Respuesta de API externa:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error de API externa:', response.status, errorText);
      throw new Error(`API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    console.log('📝 Datos recibidos:', Object.keys(data || {}));

    // Validate response structure
    if (!data) {
      throw new Error('La API devolvió una respuesta vacía');
    }

    // Handle different possible response formats
    let extractedText = '';
    if (data.text) {
      extractedText = data.text;
    } else if (data.content) {
      extractedText = data.content;
    } else if (data.data && data.data.text) {
      extractedText = data.data.text;
    } else if (typeof data === 'string') {
      extractedText = data;
    } else {
      console.error('❌ Formato de respuesta inesperado:', data);
      throw new Error('Formato de respuesta inesperado de la API');
    }

    if (!extractedText || typeof extractedText !== 'string') {
      throw new Error('No se pudo extraer texto del PDF');
    }

    const cleanText = extractedText.trim();
    
    if (cleanText.length < 50) {
      throw new Error('El PDF contiene muy poco texto');
    }

    console.log('✅ Extracción exitosa:', cleanText.length, 'caracteres');

    return new Response(
      JSON.stringify({ 
        success: true, 
        text: cleanText,
        length: cleanText.length 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('❌ Error en proxy de extracción:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});