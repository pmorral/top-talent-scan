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
    
    // DETAILED LOGGING - Log CV text content and analysis
    console.log('=== DETAILED CV ANALYSIS LOGGING ===');
    console.log('CV Text Length:', cvText.length);
    console.log('=== TEXTO COMPLETO DEL CV ENVIADO A OPENAI ===');
    console.log(cvText);
    console.log('=== FIN DEL TEXTO COMPLETO ===');
    console.log('CV Text (first 500 chars):', cvText.substring(0, 500));
    console.log('CV Text (last 500 chars):', cvText.substring(Math.max(0, cvText.length - 500)));
    
    // Detect dates/numbers in CV text
    const datePatterns = [
      /\d{4}\s*[-–]\s*\d{4}/g, // 2020-2022, 2020 - 2022
      /\d{4}\s*[-–]\s*presente/gi, // 2020-presente
      /\d{4}/g, // Single years
      /(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{4}/gi, // Month Year
      /\d{1,2}\/\d{4}/g, // MM/YYYY
      /\d{1,2}\/\d{1,2}\/\d{4}/g // DD/MM/YYYY
    ];
    
    const foundDates = [];
    datePatterns.forEach((pattern, index) => {
      const matches = cvText.match(pattern);
      if (matches) {
        foundDates.push({ pattern: index + 1, matches: matches.slice(0, 5) }); // First 5 matches only
      }
    });
    
    console.log('Date Detection Results:');
    console.log('Found date patterns:', foundDates.length > 0 ? foundDates : 'NO DATES FOUND');
    console.log('Contains years (2000-2030):', /20[0-2]\d/.test(cvText));
    console.log('Contains dashes/hyphens:', /[-–]/.test(cvText));
    console.log('Contains "presente":', /presente/i.test(cvText));
    console.log('=======================================');

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

    const prompt = `Analiza DETALLADAMENTE TODO EL TEXTO BRUTO del CV y evalúalo según estos 12 criterios específicos para LaPieza.

INSTRUCCIONES CRÍTICAS DE ANÁLISIS DE FECHAS:
- ANTES de evaluar cualquier criterio, IDENTIFICA Y CITA todas las fechas que encuentres en el CV
- Los formatos de fecha válidos incluyen: "2020-2022", "2020", "Enero 2020", "Mar 2020 - Dic 2021", "2019-presente", "2018 a 2020", "2021-actualidad"
- NUNCA digas que "no hay fechas" si encuentras CUALQUIER indicación temporal (años, meses, períodos)
- Si ves años como "2020", "2021", etc., estos SON fechas válidas para calcular experiencia
- CITA ESPECÍFICAMENTE las fechas encontradas en tus explicaciones

EJEMPLOS DE INTERPRETACIÓN CORRECTA:
- "Trabajó en empresa X desde 2020 hasta 2022" = 2 años de experiencia
- "2019-presente" = desde 2019 hasta ahora (calcular años)
- "Enero 2020 - Marzo 2022" = más de 2 años
- "2018, 2020, 2022" = fechas válidas, calcular duración por contexto

EJEMPLOS DE ERRORES A EVITAR:
- ❌ "No se presentan fechas" cuando hay años como 2020, 2021
- ❌ "No hay información temporal" cuando menciona "desde 2019"
- ❌ Ignorar años sueltos que indican períodos de trabajo

INSTRUCCIONES CRÍTICAS DE ANÁLISIS:
- DEBES analizar todo el texto completo del CV sin resumir ni omitir información
- Lee cuidadosamente TODAS las fechas, períodos laborales, y detalles antes de evaluar
- No hagas suposiciones - basa tu evaluación únicamente en lo que aparece en el CV
- SIEMPRE cita las fechas específicas que encontraste al evaluar estabilidad laboral y indicadores de riesgo

REGLAS GLOBALES:
- Solo existen 2 resultados para cada criterio: "PASA" o "RED FLAG"
- Debes responder con "PASA:" o "RED FLAG:" al inicio de cada mensaje explicativo
- Si no hay evidencia suficiente en el CV para un criterio, considera RED FLAG
- Sé estricto en la evaluación

CRITERIOS:

1. ESTABILIDAD LABORAL
INSTRUCCIÓN CRÍTICA: ANTES de evaluar, LISTA todas las fechas que encuentres en el CV (ejemplo: "Encontré: 2020-2022, 2019, Enero 2018")
FORMATOS DE FECHA VÁLIDOS: "2020-2022", "Enero 2020 - Marzo 2022", "2020", "2019-presente", "Mar 2020 - Dic 2021", "2018 a 2020"
PASA si: Ha estado 1 año o más en la mayoría de sus últimos 5 trabajos (CITA las fechas específicas encontradas)
RED FLAG si: Ha estado menos de 1 año en 2 o más de sus últimos 5 trabajos, o GENUINAMENTE no existe NINGUNA indicación temporal en todo el CV
IMPORTANTE: Si hay CUALQUIER año (2020, 2021, etc.) o período (presente, actualidad), NO es "falta de fechas"

2. SENIORITY
PASA si: Tiene 3 años o más de experiencia profesional total
RED FLAG si: Tiene menos de 3 años de experiencia total, o no se puede determinar la experiencia total

3. EDUCACIÓN
PASA si: Tiene carrera universitaria terminada (Licenciatura/Ingeniería/Bachelor's/Master's/PhD)
RED FLAG si: No tiene carrera universitaria terminada, solo tiene carrera técnica, o no se especifica educación

4. INGLÉS
PASA si: Menciona nivel B2+ o intermedio-avanzado, o el CV está escrito en inglés, o trabajó en empresa internacional
RED FLAG si: No menciona inglés, indica nivel básico/A1/A2, o no hay evidencia de manejo del idioma

5. CERTIFICACIONES Y FORMACIÓN
PASA si: Tiene al menos 1 certificación, curso, o formación relevante para su área profesional o para el rol específico (incluye cursos online, bootcamps, especializaciones, workshops relevantes)
RED FLAG si: No tiene certificaciones, cursos, o formación relevante, o no menciona ningún tipo de capacitación profesional

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

10. INDICADORES DE RIESGO (MEJORADO)
INSTRUCCIÓN CRÍTICA: ANTES de evaluar, LISTA todas las fechas encontradas en el CV y calcula períodos específicos
FORMATOS DE FECHA VÁLIDOS: Cualquier formato que indique períodos (años, rangos, fechas específicas)
EJEMPLOS DE FECHAS VÁLIDAS: "2020-2022", "2019", "Ene 2020 - Mar 2022", "2018-presente", "desde 2020", "hasta 2022"
PASA si: No presenta gaps laborales genuinos sin explicación (>6 meses entre empleos), cambios de trabajo coherentes, fechas consistentes
RED FLAG si: Tiene gaps laborales reales sin explicación >6 meses, cambios extremadamente frecuentes (<6 meses), inconsistencias claras en fechas/títulos, o progresión de carrera completamente incoherente
REGLA ABSOLUTA: Si encuentras CUALQUIER indicación temporal (años, períodos, fechas), NUNCA digas "no hay fechas" - CITA las fechas específicas encontradas

11. FIT CON EL ROL (MEJORADO)
PASA si: Su experiencia técnica específica, industria, y responsabilidades previas son altamente relevantes para el rol sin downgrade jerárquico significativo. Considera DETALLADAMENTE las tecnologías, metodologías y experiencia mencionadas en el JD
RED FLAG si: No tiene experiencia técnica relevante específica, está sobrecalificado con downgrade jerárquico claro (Head→Manager, Manager→Analyst, etc.), le faltan habilidades técnicas core, o busca algo completamente diferente. JERARQUÍA: Head > Manager > Lead > Senior > Specialist > Analyst > Coordinator > Junior

12. FIT CON LA EMPRESA
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
    "riskIndicators": {"passed": [true/false], "message": "[explicación específica sobre gaps, cambios frecuentes e inconsistencias]"},
    "roleFit": {"passed": [true/false], "message": "[explicación específica${jobDescriptionText ? ' basada en la descripción completa del trabajo proporcionada' : ' considerando el rol: ' + roleInfo}]"},
    "companyFit": {"passed": [true/false], "message": "[explicación específica considerando la empresa: ${companyInfo}]"}
  }
}`;

    // Log the prompt being sent to OpenAI for debugging
    console.log('=== PROMPT BEING SENT TO OPENAI ===');
    console.log('Prompt length:', prompt.length);
    console.log('CV Text being analyzed (first 200 chars):', cvText.substring(0, 200));
    console.log('====================================');

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
            content: 'Eres un experto en recursos humanos de LaPieza analizando CVs. DEBES seguir exactamente las instrucciones sobre fechas. ANTES de evaluar cualquier criterio, identifica todas las fechas presentes en el CV. Responde solo en el formato JSON solicitado.' 
          },
          { role: 'user', content: prompt }
        ],
        max_tokens: 2000,
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