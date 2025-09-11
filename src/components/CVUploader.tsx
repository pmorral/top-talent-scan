import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Upload, FileText, CheckCircle, XCircle, AlertTriangle, Trash2, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthProvider';
import axios from 'axios';

interface CVAnalysis {
  score: number;
  feedback: string;
  highlights?: string; // Puntos positivos
  alerts?: string; // Puntos negativos/alertas
  criteria: {
    jobStability: { passed: boolean; message: string };
    seniority: { passed: boolean; message: string };
    education: { passed: boolean; message: string };
    language: { passed: boolean; message: string };
    certifications: { passed: boolean; message: string };
    careerGrowth: { passed: boolean; message: string };
    companyExperience: { passed: boolean; message: string };
    spelling: { passed: boolean; message: string };
    roleFit: { passed: boolean; message: string };
    companyFit: { passed: boolean; message: string };
  };
}

export const CVUploader = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<CVAnalysis | null>(null);
  const [progress, setProgress] = useState(0);
  const [roleInfo, setRoleInfo] = useState('');
  const [companyInfo, setCompanyInfo] = useState('');
  
  const { toast } = useToast();
  const { user } = useAuth();

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    const pdfFile = files.find(file => file.type === 'application/pdf');
    
    if (pdfFile) {
      setFile(pdfFile);
    } else {
      toast({
        title: "Formato inválido",
        description: "Por favor, sube un archivo PDF.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
    } else {
      toast({
        title: "Formato inválido",
        description: "Por favor, sube un archivo PDF.",
        variant: "destructive",
      });
    }
  };


  const extractTextFromPDF = async (fileName: string): Promise<string> => {
    console.log('=== INICIANDO EXTRACCIÓN DE PDF CON API DE LAPIEZA ===');
    console.log('Archivo:', fileName);
    
    try {
      // Get signed URL for the uploaded file with shorter expiry for security
      const { data: signedUrlData, error: urlError } = await supabase.storage
        .from('cv-files')
        .createSignedUrl(fileName, 1800); // 30 minutes expiry

      if (urlError) {
        console.error('❌ Error creating signed URL:', urlError);
        throw new Error(`Error generando URL segura: ${urlError.message}`);
      }

      if (!signedUrlData?.signedUrl) {
        throw new Error('No se pudo generar la URL segura para el archivo');
      }

      console.log('✅ Signed URL obtenida:', signedUrlData.signedUrl);

      // Call API de LaPieza directamente para obtener texto COMPLETO
      console.log('🔄 Llamando API de LaPieza para texto completo...');
      const { data, error } = await supabase.functions.invoke('extract-pdf-proxy', {
        body: {
          cv_url: signedUrlData.signedUrl,
          mode: "text",
          need_personal_data: false, // Evitar procesamiento adicional
        },
      });

      if (error) {
        console.error('❌ Error en Edge Function:', error);
        throw new Error(`Error en el proxy de extracción: ${error.message}`);
      }

      console.log('✅ Respuesta de Edge Function recibida:', data);

      if (!data.success) {
        throw new Error(data.error || 'Error desconocido en la extracción');
      }

      if (!data.text) {
        throw new Error('La API no devolvió texto extraído del PDF');
      }

      const extractedText = data.text.trim();
      
      if (extractedText.length < 100) {
        throw new Error('No se pudo extraer texto suficiente del CV. El análisis no se puede realizar con este archivo. Por favor, sube un CV donde el texto sea seleccionable (no una imagen escaneada).');
      }

      console.log('✅ TEXTO CRUDO EXTRAÍDO:', extractedText.length, 'caracteres');
      console.log('📝 INICIO DEL TEXTO CRUDO:', extractedText.substring(0, 800));
      console.log('📝 FINAL DEL TEXTO CRUDO:', extractedText.substring(Math.max(0, extractedText.length - 400)));
      
      // ANÁLISIS DIRECTO SIN MODIFICACIONES - este texto va directamente a OpenAI
      return extractedText;
      
    } catch (error) {
      console.error('❌ Error general en extracción:', error);
      
      if (error instanceof Error) {
        throw new Error(`Error procesando el PDF: ${error.message}`);
      }
      
      throw new Error('Error desconocido al procesar el PDF. Inténtalo de nuevo.');
    }
  };

  const analyzeCV = async () => {
    if (!file || !user) return;
    
    if (!roleInfo.trim()) {
      toast({
        title: "Información faltante",
        description: "Por favor, completa los detalles del rol.",
        variant: "destructive",
      });
      return;
    }
    
    if (!companyInfo.trim()) {
      toast({
        title: "Información faltante", 
        description: "Por favor, describe la empresa/industria.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setIsAnalyzing(true);
      setProgress(10);
      
      // Sanitize filename for Supabase Storage (this doesn't affect content analysis)
      // The PDF content keeps all accents for proper spelling analysis
      const sanitizedName = file.name
        .normalize('NFD')                    // Decompose accented characters
        .replace(/[\u0300-\u036f]/g, '')     // Remove accent marks (diacritics)
        .replace(/[^a-zA-Z0-9.-]/g, '_')     // Replace any remaining invalid chars
        .replace(/_{2,}/g, '_')              // Replace multiple underscores with single
        .replace(/^_|_$/g, '')               // Remove leading/trailing underscores
        .replace(/\.+/g, '.')                // Replace multiple dots with single
        .replace(/^\./, '')                  // Remove leading dot
        .replace(/\.$/, '')                  // Remove trailing dot
        .toLowerCase();

      // Create unique filename with timestamp
      const fileName = `${user.id}/${Date.now()}-${sanitizedName}`;
      
      console.log('📁 Archivo original:', file.name);
      console.log('📁 Archivo sanitizado para storage:', fileName);
      console.log('🔤 NOTA: El contenido del PDF mantiene todos los acentos para análisis de ortografía');
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('cv-files')
        .upload(fileName, file);

      if (uploadError) {
        throw new Error(`Error uploading file: ${uploadError.message}`);
      }

      setProgress(30);

      // Extract text from PDF using tech team's API
      console.log('🔄 Iniciando extracción de texto...');
      toast({
        title: "Extrayendo texto del PDF...",
        description: "Procesando el contenido de tu CV",
      });
      
      const cvText = await extractTextFromPDF(fileName);
      setProgress(60);
      
      // Use role info as job description text
      let jobDescriptionText = roleInfo.trim() || null;
      
      console.log('✅ Extracción completada, iniciando análisis...');
      toast({
        title: "Texto extraído exitosamente",
        description: "Iniciando análisis inteligente del CV",
      });

      if (!cvText || cvText.trim().length < 100) {
        throw new Error('No se pudo extraer texto suficiente del CV. El análisis no se puede realizar con este archivo. Por favor, sube un CV donde el texto sea seleccionable (no una imagen escaneada).');
      }

      console.log('✅ TEXTO CRUDO ENVIADO A ANÁLISIS (primeros 500 chars):', cvText.substring(0, 500));

      // Create evaluation record
      const { data: evaluation, error: createError } = await supabase
        .from('cv_evaluations')
        .insert({
          user_id: user.id,
          file_name: file.name,
          file_path: fileName,
          file_size: file.size,
          analysis_status: 'pending',
          role_info: roleInfo.trim(),
          company_info: companyInfo.trim(),
          job_description_text: jobDescriptionText
        })
        .select()
        .single();

      if (createError) {
        throw new Error(`Error creating evaluation: ${createError.message}`);
      }

      setProgress(70);

      // Call Edge Function for AI analysis
      const { data: analysisData, error: analysisError } = await supabase.functions
        .invoke('analyze-cv', {
          body: {
            evaluationId: evaluation.id,
            cvText: cvText,
            roleInfo: roleInfo.trim(),
            companyInfo: companyInfo.trim(),
            jobDescriptionText: jobDescriptionText
          }
        });

      if (analysisError) {
        throw new Error(`Error analyzing CV: ${analysisError.message}`);
      }

      setProgress(90);

      // Get updated evaluation with results
      const { data: finalEvaluation, error: fetchError } = await supabase
        .from('cv_evaluations')
        .select()
        .eq('id', evaluation.id)
        .single();

      if (fetchError) {
        throw new Error(`Error fetching results: ${fetchError.message}`);
      }

      setProgress(100);

      if (finalEvaluation.analysis_status === 'completed') {
        const defaultCriteria: CVAnalysis['criteria'] = {
          jobStability: { passed: false, message: 'Sin análisis' },
          seniority: { passed: false, message: 'Sin análisis' },
          education: { passed: false, message: 'Sin análisis' },
          language: { passed: false, message: 'Sin análisis' },
          certifications: { passed: false, message: 'Sin análisis' },
          careerGrowth: { passed: false, message: 'Sin análisis' },
          companyExperience: { passed: false, message: 'Sin análisis' },
          spelling: { passed: false, message: 'Sin análisis' },
          roleFit: { passed: false, message: 'Sin análisis' },
          companyFit: { passed: false, message: 'Sin análisis' }
        };

        // Función para separar el feedback en positivos y negativos
        const separateFeedback = (feedback: string) => {
          const lines = feedback.split('\n').filter(line => line.trim());
          const highlights: string[] = [];
          const alerts: string[] = [];
          
          lines.forEach(line => {
            const lowerLine = line.toLowerCase();
            if (lowerLine.includes('destacar') || lowerLine.includes('positivo') || 
                lowerLine.includes('fortaleza') || lowerLine.includes('experiencia relevante') ||
                lowerLine.includes('buena') || lowerLine.includes('excelente') ||
                lowerLine.includes('sólida') || lowerLine.includes('apropiada')) {
              highlights.push(line);
            } else if (lowerLine.includes('alerta') || lowerLine.includes('preocupa') ||
                      lowerLine.includes('falta') || lowerLine.includes('debilidad') ||
                      lowerLine.includes('problema') || lowerLine.includes('riesgo') ||
                      lowerLine.includes('negativo') || lowerLine.includes('insuficiente')) {
              alerts.push(line);
            } else {
              // Si no es claramente positivo o negativo, va a highlights por defecto
              highlights.push(line);
            }
          });
          
          return {
            highlights: highlights.length > 0 ? highlights.join('\n') : 'Sin puntos destacados específicos.',
            alerts: alerts.length > 0 ? alerts.join('\n') : 'Sin alertas específicas.'
          };
        };

        const feedbackSeparated = separateFeedback(finalEvaluation.feedback || '');

        const analysisResult: CVAnalysis = {
          score: finalEvaluation.score || 0,
          feedback: finalEvaluation.feedback || '',
          highlights: feedbackSeparated.highlights,
          alerts: feedbackSeparated.alerts,
          criteria: (finalEvaluation.criteria as CVAnalysis['criteria']) || defaultCriteria
        };
        setAnalysis(analysisResult);
        
        toast({
          title: "Análisis completado",
          description: `CV analizado exitosamente. Puntuación: ${finalEvaluation.score}/12`,
        });
      } else {
        throw new Error('Analysis failed to complete');
      }

    } catch (error) {
      console.error('Error analyzing CV:', error);
      
      let errorMessage = 'Error desconocido';
      if (error instanceof Error) {
        if (error.message.includes('PDF')) {
          errorMessage = error.message;
        } else if (error.message.includes('analyze-cv')) {
          errorMessage = 'Error en el análisis de IA. Inténtalo de nuevo.';
        } else {
          errorMessage = `Error: ${error.message}`;
        }
      }
      
      toast({
        title: "Error en el análisis",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
      setProgress(0);
    }
  };

  const resetAnalysis = () => {
    setFile(null);
    setAnalysis(null);
    setProgress(0);
    setRoleInfo('');
    setCompanyInfo('');
    setIsAnalyzing(false);
  };

  const resetOnlyCV = () => {
    setFile(null);
    setAnalysis(null);
    setProgress(0);
    setIsAnalyzing(false);
    // Mantiene roleInfo y companyInfo
  };

  const removeFile = () => {
    setFile(null);
    setProgress(0);
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-success';
    if (score >= 6) return 'text-warning';
    return 'text-destructive';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 11) return 'bg-success/10';
    if (score >= 8) return 'bg-warning/10';
    return 'bg-destructive/10';
  };

  const getScoreDefinition = (score: number) => {
    if (score >= 11) return "HIRE";
    if (score >= 8) return "MAYBE";
    return "NO HIRE";
  };

  const CriteriaIcon = ({ passed }: { passed: boolean }) => {
    if (passed) return <CheckCircle className="h-4 w-4 text-success" />;
    return <XCircle className="h-4 w-4 text-destructive" />;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Subir CV para Evaluación
          </CardTitle>
          <CardDescription>
            Sube tu CV en formato PDF para obtener una evaluación automática basada en nuestros criterios de selección.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Role and Company Information */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="role-info">Detalles o job description del rol *</Label>
              <Textarea
                id="role-info"
                placeholder="Ej: Senior Marketing Manager, área de growth marketing, requiere 5+ años de experiencia en marketing digital. Responsabilidades: desarrollar estrategias de crecimiento, gestionar campañas digitales, analizar métricas..."
                value={roleInfo}
                onChange={(e) => setRoleInfo(e.target.value)}
                className="min-h-20"
                disabled={isAnalyzing}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-info">Empresa/Industria *</Label>
              <Textarea
                id="company-info"
                placeholder="Ej: Fintech startup B2B, empresa de tecnología financiera con 200 empleados, mercado latinoamericano..."
                value={companyInfo}
                onChange={(e) => setCompanyInfo(e.target.value)}
                className="min-h-20"
                disabled={isAnalyzing}
              />
            </div>
          </div>


          {/* Upload Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragOver
                ? 'border-corporate bg-corporate/5'
                : 'border-border hover:border-corporate/50'
            }`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            {file ? (
              <div className="space-y-4">
                <FileText className="h-12 w-12 mx-auto text-corporate" />
                <div>
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={analyzeCV} disabled={isAnalyzing || !roleInfo.trim() || !companyInfo.trim()} className="flex-1">
                    {isAnalyzing ? 'Analizando...' : 'Analizar CV'}
                  </Button>
                  <Button variant="outline" onClick={removeFile} disabled={isAnalyzing} className="px-3">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                <div>
                  <p className="text-lg font-medium">Arrastra tu CV aquí</p>
                  <p className="text-muted-foreground">o haz clic para seleccionar</p>
                </div>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="cv-upload"
                />
                <label htmlFor="cv-upload">
                  <Button variant="outline" className="cursor-pointer" asChild>
                    <span>Seleccionar archivo PDF</span>
                  </Button>
                </label>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Analysis Progress */}
      {isAnalyzing && (
        <Card>
          <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Analizando CV...</span>
                  <span className="text-sm text-muted-foreground">{progress}%</span>
                </div>
                <Progress value={progress} className="w-full" />
                <p className="text-sm text-muted-foreground">
                  {progress < 30 && "Subiendo archivo..."}
                  {progress >= 30 && progress < 50 && "Extrayendo texto del CV..."}
                  {progress >= 50 && progress < 70 && "Creando registro de evaluación..."}
                  {progress >= 70 && progress < 90 && "Analizando con IA..."}
                  {progress >= 90 && "Finalizando análisis..."}
                </p>
              </div>
          </CardContent>
        </Card>
      )}

      {/* Analysis Results */}
      {analysis && !isAnalyzing && (
        <div className="space-y-6">
          {/* Score Card */}
          <Card className={getScoreBgColor(analysis.score)}>
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <div>
                  <div className={`text-6xl font-bold ${getScoreColor(analysis.score)}`}>
                    {analysis.score}
                  </div>
                  <div className="text-lg text-muted-foreground">/ 12</div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold">
                    {getScoreDefinition(analysis.score)}
                  </h3>
                  
                  {/* Resumen dividido en dos columnas */}
                  <div className="grid gap-4 md:grid-cols-2 max-w-4xl mx-auto mt-6">
                    <div className="space-y-2">
                      <h4 className="font-semibold text-success flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        Puntos a destacar
                      </h4>
                      <p className="text-sm text-muted-foreground bg-success/5 p-3 rounded-lg border border-success/20">
                        {analysis.highlights || 'Sin puntos destacados específicos.'}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-semibold text-destructive flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Alertas
                      </h4>
                      <p className="text-sm text-muted-foreground bg-destructive/5 p-3 rounded-lg border border-destructive/20">
                        {analysis.alerts || 'Sin alertas específicas.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Criteria Details */}
          <Card>
            <CardHeader>
              <CardTitle>Evaluación Detallada</CardTitle>
              <CardDescription>
                Revisión de cada criterio de selección
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(analysis.criteria).map(([key, criterion]) => (
                  <div key={key} className="flex items-start gap-3 p-3 rounded-lg border">
                    <CriteriaIcon passed={criterion.passed} />
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">
                          {key === 'jobStability' && 'Estabilidad Laboral'}
                          {key === 'seniority' && 'Seniority del Rol'}
                          {key === 'education' && 'Formación Académica'}
                          {key === 'language' && 'Nivel de Inglés'}
                          {key === 'certifications' && 'Certificaciones'}
                          {key === 'careerGrowth' && 'Evolución Profesional'}
                          {key === 'companyExperience' && 'Experiencia Empresarial'}
                          {key === 'spelling' && 'Ortografía'}
                          {key === 'roleFit' && 'Fit con el Rol'}
                          {key === 'companyFit' && 'Fit con la Empresa'}
                          {key === 'technicalSkills' && 'Habilidades Técnicas Afines'}
                          {key === 'riskIndicators' && 'Indicadores de Riesgo'}
                        </h4>
                        <Badge variant={criterion.passed ? "success" : "destructive"}>
                          {criterion.passed ? 'Aprobado' : 'Alerta'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {criterion.message}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* New Analysis Call to Action */}
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">¿Necesitas evaluar otro CV?</h3>
                  <p className="text-muted-foreground">
                    Puedes evaluar otro CV para la misma vacante o comenzar desde cero
                  </p>
                </div>
                <div className="flex gap-3 justify-center flex-wrap">
                  <Button onClick={resetOnlyCV} variant="default" className="flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    Otro CV para esta vacante
                  </Button>
                  <Button onClick={resetAnalysis} variant="outline" className="flex items-center gap-2">
                    <RotateCcw className="h-4 w-4" />
                    Nueva vacante
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};