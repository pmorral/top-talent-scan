import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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
  const { toast } = useToast();

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

  const analyzeCV = async () => {
    if (!file) return;
    
    setIsAnalyzing(true);
    
    // Simulate analysis - in real implementation, this would call Supabase Edge Function
    setTimeout(() => {
      const mockAnalysis: CVAnalysis = {
        score: 7,
        feedback: "Perfil sólido con experiencia relevante, pero hay áreas de mejora en estabilidad laboral y certificaciones.",
        criteria: {
          jobStability: { passed: false, message: "Ha tenido 2 trabajos de menos de 1 año en los últimos 4 empleos" },
          seniority: { passed: true, message: "Cuenta con más de 5 años de experiencia" },
          education: { passed: true, message: "Licenciatura en Ingeniería de Sistemas" },
          language: { passed: true, message: "CV redactado en inglés, demuestra nivel avanzado" },
          certifications: { passed: false, message: "No se encontraron certificaciones relevantes recientes" },
          careerGrowth: { passed: true, message: "2 ascensos en los últimos 6 años" },
          companyExperience: { passed: true, message: "Experiencia en startup tecnológica internacional" },
          spelling: { passed: true, message: "Sin errores ortográficos detectados" }
        }
      };
      
      setAnalysis(mockAnalysis);
      setIsAnalyzing(false);
    }, 3000);
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
                <span className="text-sm text-muted-foreground">75%</span>
              </div>
              <Progress value={75} className="w-full" />
              <p className="text-sm text-muted-foreground">
                Evaluando criterios de selección y generando retroalimentación...
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