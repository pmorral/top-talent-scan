import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthProvider';
import axios from 'axios';

interface CVAnalysis {
  score: number;
  feedback: string;
  criteria: {
    jobStability: { passed: boolean; message: string };
    seniority: { passed: boolean; message: string };
    education: { passed: boolean; message: string };
    language: { passed: boolean; message: string };
    certifications: { passed: boolean; message: string };
    careerGrowth: { passed: boolean; message: string };
    companyExperience: { passed: boolean; message: string };
    spelling: { passed: boolean; message: string };
  };
}

export const CVUploader = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<CVAnalysis | null>(null);
  const [progress, setProgress] = useState(0);
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
    console.log('=== INICIANDO EXTRACCIÓN DE PDF CON API ===');
    console.log('Archivo:', fileName);
    
    try {
      // Get signed URL for the uploaded file
      const { data: signedUrlData, error: urlError } = await supabase.storage
        .from('cv-files')
        .createSignedUrl(fileName, 3600); // 1 hour expiry

      if (urlError || !signedUrlData?.signedUrl) {
        throw new Error(`Error getting signed URL: ${urlError?.message || 'No signed URL returned'}`);
      }

      console.log('✅ Signed URL obtenida:', signedUrlData.signedUrl);

      // Call tech team's API for PDF extraction
      const response = await axios.post(
        "https://interview-api-dev.lapieza.io/api/v1/analize/cv",
        {
          cv_url: signedUrlData.signedUrl,
          mode: "text",
          need_personal_data: true,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      console.log('✅ Respuesta de API recibida:', response.data);

      if (!response.data || !response.data.text) {
        throw new Error('La API no devolvió texto extraído del PDF');
      }

      const extractedText = response.data.text.trim();
      
      if (extractedText.length < 100) {
        throw new Error('El PDF no contiene suficiente texto legible para el análisis');
      }

      console.log('✅ Texto extraído exitosamente:', extractedText.length, 'caracteres');
      console.log('Muestra:', extractedText.substring(0, 200) + '...');
      
      return extractedText;
      
    } catch (error) {
      console.error('❌ Error extrayendo texto:', error);
      if (error instanceof Error) {
        throw new Error(`Error extrayendo texto del PDF: ${error.message}`);
      }
      throw new Error('Error desconocido al extraer texto del PDF');
    }
  };

  const analyzeCV = async () => {
    if (!file || !user) return;
    
    try {
      setIsAnalyzing(true);
      setProgress(10);
      
      // Upload file to Supabase Storage
      const fileName = `${user.id}/${Date.now()}-${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('cv-files')
        .upload(fileName, file);

      if (uploadError) {
        throw new Error(`Error uploading file: ${uploadError.message}`);
      }

      setProgress(30);

      // Extract text from PDF using tech team's API
      const cvText = await extractTextFromPDF(fileName);
      setProgress(50);

      if (!cvText || cvText.trim().length < 100) {
        throw new Error('Necesitamos más contenido de tu CV para hacer un análisis completo. Asegúrate de pegar todo el texto de tu CV.');
      }

      console.log('✅ Texto listo para análisis:', cvText.substring(0, 300) + '...');

      // Create evaluation record
      const { data: evaluation, error: createError } = await supabase
        .from('cv_evaluations')
        .insert({
          user_id: user.id,
          file_name: file.name,
          file_path: fileName,
          file_size: file.size,
          analysis_status: 'pending'
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
            cvText: cvText
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
          spelling: { passed: false, message: 'Sin análisis' }
        };

        const analysisResult: CVAnalysis = {
          score: finalEvaluation.score || 0,
          feedback: finalEvaluation.feedback || '',
          criteria: (finalEvaluation.criteria as CVAnalysis['criteria']) || defaultCriteria
        };
        setAnalysis(analysisResult);
        
        toast({
          title: "Análisis completado",
          description: `CV analizado exitosamente. Puntuación: ${finalEvaluation.score}/10`,
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

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-success';
    if (score >= 6) return 'text-warning';
    return 'text-destructive';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 8) return 'bg-success/10';
    if (score >= 6) return 'bg-warning/10';
    return 'bg-destructive/10';
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
        <CardContent>
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
                <Button onClick={analyzeCV} disabled={isAnalyzing} className="w-full">
                  {isAnalyzing ? 'Analizando...' : 'Analizar CV'}
                </Button>
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
                  <div className="text-lg text-muted-foreground">/ 10</div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold">
                    {analysis.score >= 8 ? 'Perfil Excelente' : 
                     analysis.score >= 6 ? 'Perfil Bueno' : 'Perfil Necesita Mejoras'}
                  </h3>
                  <p className="text-muted-foreground max-w-2xl mx-auto">
                    {analysis.feedback}
                  </p>
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
                        </h4>
                        <Badge variant={criterion.passed ? "default" : "destructive"}>
                          {criterion.passed ? 'Aprobado' : 'Red Flag'}
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
        </div>
      )}
    </div>
  );
};