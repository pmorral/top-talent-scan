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
    console.log('Recibida solicitud de extracción de PDF');
    
    if (req.method !== 'POST') {
      throw new Error('Método no permitido');
    }

    // Obtener el archivo del FormData
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      throw new Error('No se recibió archivo');
    }

    console.log(`Procesando archivo: ${file.name}, tamaño: ${file.size} bytes`);

    // Convertir a ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Verificar que sea un PDF válido (comienza con %PDF)
    const pdfHeader = new TextDecoder().decode(uint8Array.slice(0, 4));
    if (pdfHeader !== '%PDF') {
      throw new Error('El archivo no es un PDF válido');
    }

    console.log('Archivo PDF válido detectado');

    // Extracción simple de texto usando expresiones regulares
    // Buscar objetos de texto en el PDF
    const pdfText = new TextDecoder('latin1').decode(uint8Array);
    
    // Buscar patrones de texto en PDF
    const textRegex = /BT\s+(.*?)\s+ET/gs;
    const streamRegex = /stream\s+(.*?)\s+endstream/gs;
    
    let extractedText = '';
    
    // Extraer texto de comandos BT...ET
    let match;
    while ((match = textRegex.exec(pdfText)) !== null) {
      const textCommands = match[1];
      // Buscar strings de texto entre paréntesis
      const stringRegex = /\((.*?)\)/g;
      let stringMatch;
      while ((stringMatch = stringRegex.exec(textCommands)) !== null) {
        extractedText += stringMatch[1] + ' ';
      }
    }
    
    // Extraer texto de streams (formato más común)
    while ((match = streamRegex.exec(pdfText)) !== null) {
      const streamContent = match[1];
      // Buscar texto legible en el stream
      const readableText = streamContent.replace(/[^\x20-\x7E\n\r]/g, ' ');
      extractedText += readableText + ' ';
    }
    
    // Limpiar el texto extraído
    let cleanText = extractedText
      .replace(/\s+/g, ' ')  // Normalizar espacios
      .replace(/[^\w\s@.\-()]/g, ' ')  // Mantener solo caracteres alfanuméricos y algunos especiales
      .trim();
    
    // Si no se extrajo texto suficiente, intentar método alternativo
    if (!cleanText || cleanText.length < 50) {
      console.log('Primer método falló, intentando extracción alternativa...');
      
      // Buscar texto plano en todo el PDF
      const allText = new TextDecoder('utf-8', { fatal: false }).decode(uint8Array);
      const textParts = allText.match(/[a-zA-Z0-9@.\-\s]{10,}/g) || [];
      cleanText = textParts.join(' ').replace(/\s+/g, ' ').trim();
    }

    if (!cleanText || cleanText.length < 30) {
      throw new Error('No se pudo extraer texto legible del PDF. El archivo puede ser una imagen escaneada.');
    }

    console.log(`Texto extraído exitosamente: ${cleanText.length} caracteres`);
    console.log('Muestra del texto:', cleanText.substring(0, 200));

    return new Response(JSON.stringify({ 
      success: true, 
      text: cleanText,
      length: cleanText.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error en extract-pdf-text:', error);
    
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});