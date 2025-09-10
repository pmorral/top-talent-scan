import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Users, FileText, TrendingUp, BarChart3, Eye, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface CVEvaluation {
  id: string;
  user_id: string;
  file_name: string;
  file_size: number;
  analysis_status: string;
  score: number | null;
  feedback: string | null;
  criteria: any;
  created_at: string;
  updated_at: string;
}

interface Profile {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  role: string;
}

interface EvaluationWithProfile extends CVEvaluation {
  profile: Profile;
}

export const SuperAdminDashboard = () => {
  const [evaluations, setEvaluations] = useState<EvaluationWithProfile[]>([]);
  const [stats, setStats] = useState({
    totalEvaluations: 0,
    totalUsers: 0,
    averageScore: 0,
    completedAnalyses: 0
  });
  const [loading, setLoading] = useState(true);
  const [selectedEvaluation, setSelectedEvaluation] = useState<EvaluationWithProfile | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch all evaluations
      const { data: evaluationsData, error: evaluationsError } = await supabase
        .from('cv_evaluations')
        .select('*')
        .order('created_at', { ascending: false });

      if (evaluationsError) {
        throw evaluationsError;
      }

      // Fetch all profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*');

      if (profilesError) {
        throw profilesError;
      }

      // Join the data manually
      const evaluationsWithProfiles: EvaluationWithProfile[] = evaluationsData?.map(evaluation => {
        const profile = profilesData?.find(p => p.user_id === evaluation.user_id);
        return {
          ...evaluation,
          profile: profile as Profile
        };
      }) || [];

      setEvaluations(evaluationsWithProfiles);

      // Calculate statistics
      const totalEvaluations = evaluationsWithProfiles.length;
      const uniqueUsers = new Set(evaluationsWithProfiles.map(e => e.user_id)).size;
      const completedEvals = evaluationsWithProfiles.filter(e => e.analysis_status === 'completed');
      const averageScore = completedEvals.length > 0 
        ? completedEvals.reduce((sum, e) => sum + (e.score || 0), 0) / completedEvals.length 
        : 0;

      setStats({
        totalEvaluations,
        totalUsers: uniqueUsers,
        averageScore: Math.round(averageScore * 10) / 10,
        completedAnalyses: completedEvals.length
      });

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos del dashboard",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default">Completado</Badge>;
      case 'analyzing':
        return <Badge variant="secondary">Analizando</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="outline">Pendiente</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="text-center py-12">
          <Progress value={50} className="w-48 mx-auto" />
          <p className="mt-4 text-muted-foreground">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard SuperAdmin</h1>
          <p className="text-muted-foreground">
            Evaluaciones de CV de todos los usuarios de La Pieza
          </p>
        </div>
        <Button onClick={fetchDashboardData} variant="outline">
          Actualizar datos
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Evaluaciones</p>
                <p className="text-2xl font-bold">{stats.totalEvaluations}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Usuarios Únicos</p>
                <p className="text-2xl font-bold">{stats.totalUsers}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Promedio Puntuación</p>
                <p className="text-2xl font-bold">{stats.averageScore}/10</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Análisis Completados</p>
                <p className="text-2xl font-bold">{stats.completedAnalyses}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Evaluations Table */}
      <Card>
        <CardHeader>
          <CardTitle>Todas las Evaluaciones</CardTitle>
          <CardDescription>
            Histórico completo de evaluaciones de CV realizadas por el equipo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {evaluations.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground" />
                <p className="mt-4 text-muted-foreground">No hay evaluaciones disponibles</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-4">Usuario</th>
                      <th className="text-left p-4">Archivo CV</th>
                      <th className="text-left p-4">Estado</th>
                      <th className="text-left p-4">Puntuación</th>
                      <th className="text-left p-4">Fecha</th>
                      <th className="text-left p-4">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evaluations.map((evaluation) => (
                      <tr key={evaluation.id} className="border-b hover:bg-muted/50">
                        <td className="p-4">
                          <div>
                            <p className="font-medium">{evaluation.profile?.full_name || 'Usuario desconocido'}</p>
                            <p className="text-sm text-muted-foreground">{evaluation.profile?.email}</p>
                          </div>
                        </td>
                        <td className="p-4">
                          <div>
                            <p className="font-medium">{evaluation.file_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {(evaluation.file_size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                        </td>
                        <td className="p-4">
                          {getStatusBadge(evaluation.analysis_status)}
                        </td>
                        <td className="p-4">
                          {evaluation.score !== null ? (
                            <div className={`font-bold ${getScoreColor(evaluation.score)}`}>
                              {evaluation.score}/10
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="text-sm">
                            <p>{format(new Date(evaluation.created_at), 'dd/MM/yyyy')}</p>
                            <p className="text-muted-foreground">
                              {format(new Date(evaluation.created_at), 'HH:mm')}
                            </p>
                          </div>
                        </td>
                        <td className="p-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedEvaluation(evaluation)}
                            disabled={evaluation.analysis_status !== 'completed'}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Ver detalles
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Evaluation Details Modal */}
      {selectedEvaluation && selectedEvaluation.analysis_status === 'completed' && (
        <Card className="fixed inset-4 z-50 overflow-auto bg-background border shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Detalles de Evaluación</CardTitle>
              <CardDescription>
                {selectedEvaluation.profile?.full_name} - {selectedEvaluation.file_name}
              </CardDescription>
            </div>
            <Button 
              variant="outline" 
              onClick={() => setSelectedEvaluation(null)}
            >
              Cerrar
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Score Display */}
            <div className={`text-center p-6 rounded-lg ${getScoreBgColor(selectedEvaluation.score || 0)}`}>
              <div className={`text-4xl font-bold ${getScoreColor(selectedEvaluation.score || 0)}`}>
                {selectedEvaluation.score}/10
              </div>
              <p className="mt-2 text-muted-foreground">{selectedEvaluation.feedback}</p>
            </div>

            {/* Criteria Details */}
            {selectedEvaluation.criteria && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Criterios de Evaluación</h3>
                {Object.entries(selectedEvaluation.criteria).map(([key, criterion]: [string, any]) => (
                  <div key={key} className="flex items-start gap-3 p-3 rounded-lg border">
                    <div className={`h-4 w-4 rounded-full mt-0.5 ${
                      criterion.passed ? 'bg-success' : 'bg-destructive'
                    }`} />
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
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};