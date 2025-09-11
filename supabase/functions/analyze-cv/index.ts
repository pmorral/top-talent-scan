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

    const prompt = `Analiza este CV y evalúalo según estos 13 criterios específicos para LaPieza.

REGLAS GLOBALES:
- Solo existen 2 resultados para cada criterio: "PASA" o "RED FLAG"
- Debes responder con "PASA:" o "RED FLAG:" al inicio de cada mensaje explicativo
- Si no hay evidencia suficiente en el CV para un criterio, considera RED FLAG
- Sé estricto en la evaluación

CRITERIOS:

1. ESTABILIDAD LABORAL
PASA si: Ha estado 1 año o más en la mayoría de sus últimos 5 trabajos
RED FLAG si: Ha estado menos de 1 año en 2 o más de sus últimos 5 trabajos, o no hay suficiente información de fechas

2. SENIORITY
PASA si: Tiene 3 años o más de experiencia profesional total
RED FLAG si: Tiene menos de 3 años de experiencia total, o no se puede determinar la experiencia total

3. EDUCACIÓN
PASA si: Tiene carrera universitaria terminada (Licenciatura/Ingeniería/Bachelor's/Master's/PhD)
RED FLAG si: No tiene carrera universitaria terminada, solo tiene carrera técnica, o no se especifica educación

4. INGLÉS
PASA si: Menciona nivel B2+ o intermedio-avanzado, o el CV está escrito en inglés, o trabajó en empresa internacional
RED FLAG si: No menciona inglés, indica nivel básico/A1/A2, o no hay evidencia de manejo del idioma

5. CERTIFICACIONES
PASA si: Tiene al menos 1 certificación o curso relevante para su área profesional
RED FLAG si: No tiene certificaciones relevantes, o no menciona ninguna certificación

6. EVOLUCIÓN PROFESIONAL
PASA si: Muestra progreso profesional en los últimos 6 años (ascensos, aumento de responsabilidades, mejora de seniority), O ya es C-level/Director/VP desde hace más de 6 años
RED FLAG si: No muestra progreso, se ha mantenido en el mismo nivel, o hay retroceso profesional

7. EXPERIENCIA EMPRESARIAL
PASA si: Ha trabajado en empresa internacional, Fortune 500, Big Four, startup tech, corporativo grande, con metodologías modernas (Agile, DevOps, etc.)
RED FLAG si: Solo ha trabajado en PYMES tradicionales locales sin evidencia de procesos modernos, o no se puede determinar el tipo/tamaño de empresa

8. ORTOGRAFÍA Y GRAMÁTICA
PASA si: El CV tiene máximo 1 error ortográfico/gramatical menor
RED FLAG si: Tiene 2 o más errores ortográficos/gramaticales (incluyendo tildes faltantes, puntuación incorrecta, mayúsculas mal usadas, concordancia incorrecta)

9. HABILIDADES TÉCNICAS (NUEVO)
PASA si: Demuestra experiencia sólida en las tecnologías/herramientas core mencionadas en el Job Description, con años de experiencia específicos cuando es posible determinar
RED FLAG si: Le faltan habilidades técnicas fundamentales para el rol, no especifica años de experiencia en tecnologías clave, o solo menciona conocimientos superficiales

10. PORTAFOLIO Y PROYECTOS (NUEVO)
PASA si: Menciona proyectos específicos con resultados cuantificables (mejoras de rendimiento, reducción de costos, métricas de impacto), contribuciones open source, o casos de estudio relevantes
RED FLAG si: No presenta proyectos específicos, carece de métricas o resultados cuantificables, o los proyectos mencionados son muy básicos/académicos

11. INDICADORES DE RIESGO (NUEVO)
PASA si: No presenta gaps laborales sin explicación (>6 meses), cambios de trabajo coherentes (>1 año por posición), fechas y responsabilidades consistentes
RED FLAG si: Tiene gaps laborales sin explicación >6 meses, cambios muy frecuentes (<1 año), inconsistencias en fechas/títulos/responsabilidades, o progresión de carrera incoherente

12. FIT CON EL ROL (MEJORADO)
PASA si: Su experiencia técnica específica, industria, y responsabilidades previas son altamente relevantes para el rol sin downgrade jerárquico significativo. Considera DETALLADAMENTE las tecnologías, metodologías y experiencia mencionadas en el JD
RED FLAG si: No tiene experiencia técnica relevante específica, está sobrecalificado con downgrade jerárquico claro (Head→Manager, Manager→Analyst, etc.), le faltan habilidades técnicas core, o busca algo completamente diferente. JERARQUÍA: Head > Manager > Lead > Senior > Specialist > Analyst > Coordinator > Junior

13. FIT CON LA EMPRESA
PASA si: Su experiencia encaja con la industria/empresa, o la transición tiene sentido lógico
RED FLAG si: Su experiencia no encaja con la industria, no hay conexión lógica, o falta información sobre su background empresarial

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
    "technicalSkills": {"passed": [true/false], "message": "[explicación específica sobre habilidades técnicas vs. requisitos del JD]"},
    "portfolioProjects": {"passed": [true/false], "message": "[explicación específica sobre proyectos y resultados cuantificables]"},
    "riskIndicators": {"passed": [true/false], "message": "[explicación específica sobre gaps, cambios frecuentes e inconsistencias]"},
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
        model: 'gpt-5-2025-08-07',
        messages: [
          { 
            role: 'system', 
            content: 'Eres un experto en recursos humanos de LaPieza analizando CVs. Responde solo en el formato JSON solicitado, sin texto adicional.' 
          },
          { role: 'user', content: prompt }
        ],
        max_completion_tokens: 2000
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