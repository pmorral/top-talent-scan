import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, Download, Eye, Calendar, CheckCircle, XCircle, Clock, BarChart3 } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface CVEvaluation {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  analysis_status: string;
  score: number | null;
  criteria: any;
  feedback: string | null;
  role_info: string | null;
  company_info: string | null;
  created_at: string;
  updated_at: string;
}

export const UserHistory = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [evaluations, setEvaluations] = useState<CVEvaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvaluation, setSelectedEvaluation] = useState<CVEvaluation | null>(null);

  const fetchUserEvaluations = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('cv_evaluations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setEvaluations(data || []);
    } catch (error) {
      console.error('Error fetching evaluations:', error);
      toast({
        title: "Error",
        description: "No se pudo cargar el historial de evaluaciones",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserEvaluations();
  }, [user]);

  const getStatusBadge = (status: string, score: number | null) => {
    switch (status) {
      case 'completed':
        return <Badge variant="outline" className="bg-success/10 text-success border-success/20">Completado</Badge>;
      case 'pending':
        return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">Procesando</Badge>;
      case 'failed':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="secondary">Desconocido</Badge>;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 11) return 'text-success';
    if (score >= 8) return 'text-warning';
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

  const downloadCV = async (evaluation: CVEvaluation) => {
    try {
      const { data, error } = await supabase.storage
        .from('cv-files')
        .createSignedUrl(evaluation.file_path, 60);

      if (error) {
        throw error;
      }

      if (data?.signedUrl) {
        const link = document.createElement('a');
        link.href = data.signedUrl;
        link.download = evaluation.file_name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        toast({
          title: "Descarga iniciada",
          description: `Descargando ${evaluation.file_name}`,
        });
      }
    } catch (error) {
      console.error('Error downloading CV:', error);
      toast({
        title: "Error de descarga",
        description: "No se pudo descargar el archivo",
        variant: "destructive",
      });
    }
  };

  const CriteriaIcon = ({ passed }: { passed: boolean }) => {
    if (passed) return <CheckCircle className="h-4 w-4 text-success" />;
    return <XCircle className="h-4 w-4 text-destructive" />;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <Progress value={50} className="w-48" />
          </div>
          <p className="text-center text-muted-foreground">Cargando historial...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Mi Historial de Evaluaciones
          </CardTitle>
          <CardDescription>
            Historial completo de tus evaluaciones de CV realizadas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {evaluations.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No hay evaluaciones aún</p>
              <p className="text-muted-foreground">Sube tu primer CV para comenzar</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Archivo</TableHead>
                    <TableHead>Rol/Empresa</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Puntuación</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {evaluations.map((evaluation) => (
                    <TableRow key={evaluation.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium text-sm">{evaluation.file_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {(evaluation.file_size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs">
                          <p className="text-sm font-medium truncate">
                            {evaluation.role_info || 'Sin información'}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {evaluation.company_info || 'Sin empresa'}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(evaluation.analysis_status, evaluation.score)}
                      </TableCell>
                      <TableCell>
                        {evaluation.score !== null ? (
                          <div className="flex items-center gap-2">
                            <div className={`px-2 py-1 rounded text-sm font-medium ${getScoreBgColor(evaluation.score)} ${getScoreColor(evaluation.score)}`}>
                              {evaluation.score}/12
                            </div>
                            <Badge 
                              variant={evaluation.score >= 11 ? "default" : evaluation.score >= 8 ? "secondary" : "destructive"}
                              className="text-xs"
                            >
                              {getScoreDefinition(evaluation.score)}
                            </Badge>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(evaluation.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {evaluation.analysis_status === 'completed' && evaluation.criteria && (
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => setSelectedEvaluation(evaluation)}
                                >
                                  <Eye className="h-3 w-3" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                                <DialogHeader>
                                  <DialogTitle>Detalles de la Evaluación</DialogTitle>
                                  <DialogDescription>
                                    Resultados completos del análisis de {evaluation.file_name}
                                  </DialogDescription>
                                </DialogHeader>
                                
                                {selectedEvaluation && (
                                  <div className="space-y-6">
                                    {/* Score Summary */}
                                    <div className="text-center">
                                      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-lg font-bold ${getScoreBgColor(selectedEvaluation.score!)} ${getScoreColor(selectedEvaluation.score!)}`}>
                                        <span>{selectedEvaluation.score}/12</span>
                                        <Badge variant={selectedEvaluation.score! >= 11 ? "default" : selectedEvaluation.score! >= 8 ? "secondary" : "destructive"}>
                                          {getScoreDefinition(selectedEvaluation.score!)}
                                        </Badge>
                                      </div>
                                    </div>

                                    {/* Criteria Details */}
                                    <div className="grid gap-4 md:grid-cols-2">
                                      {selectedEvaluation.criteria && Object.entries(selectedEvaluation.criteria).map(([key, criterion]: [string, any]) => (
                                        <Card key={key}>
                                          <CardContent className="pt-4">
                                            <div className="flex items-start gap-3">
                                              <CriteriaIcon passed={criterion.passed} />
                                              <div className="flex-1">
                                                <h4 className="font-medium text-sm mb-1">
                                                  {key === 'jobStability' && 'Estabilidad Laboral'}
                                                  {key === 'seniority' && 'Seniority/Experiencia'}
                                                  {key === 'education' && 'Educación'}
                                                  {key === 'language' && 'Idiomas'}
                                                  {key === 'certifications' && 'Certificaciones'}
                                                  {key === 'careerGrowth' && 'Crecimiento Profesional'}
                                                  {key === 'companyExperience' && 'Experiencia en Empresas'}
                                                  {key === 'spelling' && 'Ortografía y Gramática'}
                                                  {key === 'roleFit' && 'Fit con el Rol'}
                                                  {key === 'companyFit' && 'Fit con la Empresa'}
                                                </h4>
                                                <p className="text-xs text-muted-foreground">{criterion.message}</p>
                                              </div>
                                            </div>
                                          </CardContent>
                                        </Card>
                                      ))}
                                    </div>

                                    {/* Feedback */}
                                    {selectedEvaluation.feedback && (
                                      <Card>
                                        <CardHeader>
                                          <CardTitle className="text-base">Feedback General</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                          <p className="text-sm whitespace-pre-wrap">{selectedEvaluation.feedback}</p>
                                        </CardContent>
                                      </Card>
                                    )}
                                  </div>
                                )}
                              </DialogContent>
                            </Dialog>
                          )}
                          
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => downloadCV(evaluation)}
                          >
                            <Download className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};