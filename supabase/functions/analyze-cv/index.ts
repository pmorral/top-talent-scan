import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { evaluationId, cvText } = await req.json();
    
    if (!evaluationId || !cvText) {
      throw new Error('Missing evaluationId or cvText');
    }

    console.log('Starting CV analysis for evaluation:', evaluationId);

    // Update status to analyzing
    await supabase
      .from('cv_evaluations')
      .update({ analysis_status: 'analyzing' })
      .eq('id', evaluationId);

    // Analyze CV with OpenAI
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const prompt = `Analiza este CV y evalúalo según estos 7 criterios específicos para La Pieza:

1. ESTABILIDAD LABORAL: Si ha estado menos de 1 año en 2 de sus últimos 4 trabajos = RED FLAG
2. SENIORITY: Si tiene menos de 3 años de experiencia total = RED FLAG  
3. EDUCACIÓN: Si no tiene carrera universitaria terminada (Lic./Ing./Bachelor's) = RED FLAG
4. INGLÉS: Si no habla mínimo B2/intermedio-avanzado = RED FLAG (si el CV está en inglés, considerar OK)
5. CERTIFICACIONES: Debe tener al menos 1 certificación/curso relevante para su posición actual
6. EVOLUCIÓN PROFESIONAL: Debe haber tenido mínimo 1 ascenso en los últimos 6 años (excepto si ya es C-level/Director/VP)
7. EXPERIENCIA EMPRESARIAL: Debe haber trabajado en empresa internacional/Fortune 500/Big Four/Startup tech (no solo PYMES tradicionales)
8. ORTOGRAFÍA: Más de 3 errores ortográficos = RED FLAG

CV A ANALIZAR:
${cvText}

Responde EXACTAMENTE en este formato JSON:
{
  "score": [número del 1-10],
  "feedback": "[explicación general de la puntuación]",
  "criteria": {
    "jobStability": {"passed": [true/false], "message": "[explicación específica]"},
    "seniority": {"passed": [true/false], "message": "[explicación específica]"},
    "education": {"passed": [true/false], "message": "[explicación específica]"},
    "language": {"passed": [true/false], "message": "[explicación específica]"},
    "certifications": {"passed": [true/false], "message": "[explicación específica]"},
    "careerGrowth": {"passed": [true/false], "message": "[explicación específica]"},
    "companyExperience": {"passed": [true/false], "message": "[explicación específica]"},
    "spelling": {"passed": [true/false], "message": "[explicación específica]"}
  }
}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          { 
            role: 'system', 
            content: 'Eres un experto en recursos humanos de La Pieza analizando CVs. Responde solo en el formato JSON solicitado, sin texto adicional.' 
          },
          { role: 'user', content: prompt }
        ],
        max_tokens: 1500,
        temperature: 0.3
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', errorData);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const analysisText = data.choices[0].message.content;
    
    console.log('Raw OpenAI response:', analysisText);

    // Parse the JSON response from OpenAI
    let analysis;
    try {
      analysis = JSON.parse(analysisText);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response as JSON:', parseError);
      throw new Error('Invalid JSON response from AI analysis');
    }

    // Update the evaluation with results
    const { error: updateError } = await supabase
      .from('cv_evaluations')
      .update({
        analysis_status: 'completed',
        score: analysis.score,
        feedback: analysis.feedback,
        criteria: analysis.criteria
      })
      .eq('id', evaluationId);

    if (updateError) {
      console.error('Database update error:', updateError);
      throw updateError;
    }

    console.log('CV analysis completed successfully for evaluation:', evaluationId);

    return new Response(JSON.stringify({ 
      success: true, 
      analysis: analysis 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in analyze-cv function:', error);
    
    // Try to update status to error if we have an evaluationId
    const body = await req.clone().json().catch(() => ({}));
    if (body.evaluationId) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      
      await supabase
        .from('cv_evaluations')
        .update({ analysis_status: 'error' })
        .eq('id', body.evaluationId);
    }

    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});