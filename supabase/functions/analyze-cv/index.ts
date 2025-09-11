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

    const prompt = `Analiza este CV y evalúalo según estos 12 criterios específicos para LaPieza.

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
PASA si: La experiencia profesional total del candidato coincide con lo requerido en la descripción del trabajo. Si no se especifican años en el JD, usa estos estándares de mercado según el nivel del rol: Junior/Trainee: 0-2 años, Specialist/Analyst: 2-4 años, Senior: 4-7 años, Lead/Manager: 5-8 años, Head/Director: 8+ años, VP/C-level: 10+ años.
RED FLAG si: La experiencia total es significativamente menor a lo requerido para el nivel del rol (diferencia de 2+ años), o no se puede determinar la experiencia total con claridad

3. EDUCACIÓN
PASA si: Tiene carrera universitaria terminada (Licenciatura/Ingeniería/Bachelor's/Master's/PhD)
RED FLAG si: No tiene carrera universitaria terminada, solo tiene carrera técnica, o no se especifica educación

4. INGLÉS
PASA si: Menciona nivel B2+ o intermedio-avanzado, O el CV está escrito completamente en inglés (revisa si las secciones principales como experiencia laboral, educación, habilidades están en inglés - palabras como "Experience", "Education", "Skills", "Manager", "Developer", etc.), O trabajó en empresa internacional con evidencia de uso del inglés
RED FLAG si: El CV está escrito principalmente en español Y no menciona inglés, O indica nivel básico/A1/A2, O no hay evidencia de manejo del idioma
IMPORTANTE: Si detectas que el CV está escrito en inglés, automáticamente debe PASAR este criterio independientemente de si menciona o no el nivel de inglés explícitamente.

5. CERTIFICACIONES
PASA si: Tiene al menos 1 certificación o curso relevante para su área profesional (incluye certificaciones técnicas, cursos especializados, diplomados, cursos online de plataformas reconocidas como Coursera, Udemy, LinkedIn Learning, etc.)
RED FLAG si: No tiene certificaciones ni cursos relevantes, o no menciona ningún tipo de formación adicional

6. EVOLUCIÓN PROFESIONAL
PASA si: Muestra progreso profesional en los últimos 6 años (ascensos, aumento de responsabilidades, mejora de seniority), O ya es C-level/Director/VP desde hace más de 6 años
RED FLAG si: No muestra progreso, se ha mantenido en el mismo nivel, o hay retroceso profesional

7. EXPERIENCIA EMPRESARIAL
PASA si: Ha trabajado en empresa internacional, Fortune 500, Big Four, startup tech, o corporativo grande
RED FLAG si: Solo ha trabajado en PYMES tradicionales locales, o no se puede determinar el tipo de empresa

8. ORTOGRAFÍA Y GRAMÁTICA
PASA si: El CV tiene máximo 1 error ortográfico/gramatical menor
RED FLAG si: Tiene 2 o más errores ortográficos/gramaticales SUSTANCIALES (tildes faltantes, palabras mal escritas, mayúsculas mal usadas, concordancia incorrecta, etc.). NO consideres como errores: problemas de formato, comas mal ubicadas, saltos de línea, espaciado, o puntuación menor. En tu explicación, menciona EXACTAMENTE dónde están los errores encontrados (máximo 5 ejemplos específicos con el texto incorrecto)

9. FIT CON EL ROL
PASA si: Su experiencia es relevante para el rol y no hay downgrade jerárquico significativo
RED FLAG si: No tiene experiencia relevante, está sobrecalificado con downgrade jerárquico claro (Head→Manager, Manager→Analyst, etc.), o busca algo completamente diferente. JERARQUÍA: Head > Manager > Lead > Senior > Specialist > Analyst > Coordinator > Junior

10. FIT CON LA EMPRESA
PASA si: Su experiencia encaja con la industria/empresa, o la transición tiene sentido lógico
RED FLAG si: Su experiencia no encaja con la industria, no hay conexión lógica, o falta información sobre su background empresarial

11. HABILIDADES TÉCNICAS AFINES
PASA si: Tiene 2 o más hard skills técnicas específicas en el CV que NO aparecen mencionadas en la descripción del trabajo (mostrando valor agregado)
RED FLAG si: No tiene hard skills adicionales relevantes, solo menciona lo básico que ya aparece en el job description, o le faltan habilidades técnicas clave para el rol

12. INDICADORES DE RIESGO
PASA si: No presenta gaps laborales significativos (más de 6 meses), fechas consistentes, títulos coherentes, y responsabilidades alineadas con su seniority
RED FLAG si: Presenta gaps laborales sin explicación, inconsistencias en fechas, títulos que no coinciden con responsabilidades, o discrepancias en la progresión profesional

INFORMACIÓN DEL ROL: ${roleInfo}

INFORMACIÓN DE LA EMPRESA: ${companyInfo}

${jobDescriptionText ? `DESCRIPCIÓN COMPLETA DEL TRABAJO:
${jobDescriptionText}

IMPORTANTE: Utiliza la descripción completa del trabajo para evaluar con mayor precisión el FIT CON EL ROL. Compara las responsabilidades, requisitos, habilidades y experiencia mencionados en la descripción del trabajo con el perfil del candidato.

` : ''}CV A ANALIZAR:
${cvText}

Responde EXACTAMENTE en este formato JSON:
{
  "feedback": "[explicación general de la evaluación basada en los criterios que pasaron y fallaron]",
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
    "companyFit": {"passed": [true/false], "message": "[explicación específica considerando la empresa: ${companyInfo}]"},
    "technicalSkills": {"passed": [true/false], "message": "[explicación específica sobre habilidades técnicas adicionales y relevancia para el rol]"},
    "riskIndicators": {"passed": [true/false], "message": "[explicación específica sobre gaps laborales, consistencia de fechas, títulos y responsabilidades]"}
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

    // Calculate score based on criteria that passed (1 point per criterion)
    const criteriaKeys = [
      'jobStability', 'seniority', 'education', 'language', 'certifications',
      'careerGrowth', 'companyExperience', 'spelling', 'roleFit', 'companyFit',
      'technicalSkills', 'riskIndicators'
    ];
    
    let passedCount = 0;
    criteriaKeys.forEach(key => {
      if (analysis.criteria[key]?.passed === true) {
        passedCount++;
      }
    });
    
    // Override the score from OpenAI with our calculated score
    analysis.score = passedCount;
    
    console.log(`Calculated score: ${passedCount}/12 based on criteria that passed`);

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