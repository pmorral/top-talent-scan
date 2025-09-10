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

    const { evaluationId, cvText, roleInfo, companyInfo, jobDescriptionText } = await req.json();
    
    if (!evaluationId || !cvText) {
      throw new Error('Missing evaluationId or cvText');
    }

    if (!roleInfo || !companyInfo) {
      throw new Error('Missing roleInfo or companyInfo');
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

    const prompt = `Analiza este CV y evalúalo según estos 10 criterios específicos para LaPieza:

1. ESTABILIDAD LABORAL: Si ha estado menos de 1 año en 2 de sus últimos 5 trabajos = RED FLAG
2. SENIORITY: Si tiene menos de 3 años de experiencia total = RED FLAG  
3. EDUCACIÓN: Si no tiene carrera universitaria terminada (Lic./Ing./Bachelor's) = RED FLAG
4. INGLÉS: Si no habla mínimo B2/intermedio-avanzado = RED FLAG (si el CV está en inglés, considerar OK)
5. CERTIFICACIONES: Debe tener al menos 1 certificación/curso relevante para su posición actual
6. EVOLUCIÓN PROFESIONAL: Debe haber mostrado progreso profesional en los últimos 6 años, como ascensos dentro de la misma empresa O mejora de posición/seniority entre empresas (ej: de "Senior Analyst" a "Lead" o "Manager", de "Coordinator" a "Specialist" o "Senior", etc.). Excepto si ya es C-level/Director/VP desde hace más de 6 años.
7. EXPERIENCIA EMPRESARIAL: Debe haber trabajado en empresa internacional/Fortune 500/Big Four/Startup tech (no solo PYMES tradicionales)
8. ORTOGRAFÍA Y GRAMÁTICA: CRITERIO MUY ESTRICTO. Evalúa minuciosamente: faltas de ortografía, acentos faltantes o incorrectos (ej: "administracion" sin tilde, "mas" en lugar de "más", "analisis" sin tilde, "coordinacion" sin tilde), errores de puntuación, mayúsculas incorrectas, concordancia gramatical, uso incorrecto de tiempo verbales, palabras mal escritas, anglicismos innecesarios. Si encuentras 2 o más errores ortográficos/gramaticales = RED FLAG automático. Presta especial atención a: tildes en palabras agudas terminadas en vocal/n/s (ej: administración, gestión, coordinación), palabras esdrújulas que SIEMPRE llevan tilde (ej: análisis, prácticas), diferencia entre "más/mas", "sí/si", "dé/de", "sé/se", etc.
9. FIT CON EL ROL: Evalúa si la experiencia del candidato encaja con el rol que está aplicando. RED FLAG si: a) No tiene experiencia relevante en el área, b) Está SOBRECALIFICADO con un claro downgrade jerárquico (ej: Head/Director → Manager, Manager/Lead → Analyst/Specialist, Senior → Junior, VP/C-Level → cualquier posición inferior), c) Su progresión profesional sugiere que busca algo diferente, d) Menciona explícitamente buscar roles que no coinciden. JERARQUÍA ESTRICTA: Head > Manager > Lead > Senior > Specialist > Analyst > Coordinator > Junior. Cualquier movimiento hacia abajo en esta jerarquía es RED FLAG automático.
10. FIT CON LA EMPRESA: Evalúa si la experiencia del candidato encaja con la empresa/industria. Considera si ha trabajado en industrias similares o si la transición tiene sentido.

INFORMACIÓN DEL ROL: ${roleInfo}

INFORMACIÓN DE LA EMPRESA: ${companyInfo}

${jobDescriptionText ? `DESCRIPCIÓN COMPLETA DEL TRABAJO:
${jobDescriptionText}

IMPORTANTE: Utiliza la descripción completa del trabajo para evaluar con mayor precisión el FIT CON EL ROL. Compara las responsabilidades, requisitos, habilidades y experiencia mencionados en la descripción del trabajo con el perfil del candidato.

` : ''}CV A ANALIZAR:
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
    "spelling": {"passed": [true/false], "message": "[explicación específica]"},
    "roleFit": {"passed": [true/false], "message": "[explicación específica${jobDescriptionText ? ' basada en la descripción completa del trabajo proporcionada' : ' considerando el rol: ' + roleInfo}]"},
    "companyFit": {"passed": [true/false], "message": "[explicación específica considerando la empresa: ${companyInfo}]"}
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
            content: 'Eres un experto en recursos humanos de LaPieza analizando CVs. Responde solo en el formato JSON solicitado, sin texto adicional.' 
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