import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Users, FileText, TrendingUp, BarChart3, Eye, CalendarIcon, Download, Building, Briefcase, Filter, X, CheckCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface CVEvaluation {
  id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  analysis_status: string;
  score: number | null;
  feedback: string | null;
  criteria: any;
  highlights: string[] | null;
  alerts: string[] | null;
  role_info: string | null;
  company_info: string | null;
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
  const [filteredEvaluations, setFilteredEvaluations] = useState<EvaluationWithProfile[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [stats, setStats] = useState({
    totalEvaluations: 0,
    totalUsers: 0,
    averageScore: 0,
    completedAnalyses: 0
  });
  const [loading, setLoading] = useState(true);
  const [selectedEvaluation, setSelectedEvaluation] = useState<EvaluationWithProfile | null>(null);
  
  // Filter states
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  
  const { toast } = useToast();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [evaluations, dateFrom, dateTo, selectedUserId]);

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
      setProfiles(profilesData || []);

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

  const applyFilters = () => {
    let filtered = [...evaluations];

    // Filter by date range
    if (dateFrom) {
      filtered = filtered.filter(evaluation => 
        new Date(evaluation.created_at) >= dateFrom
      );
    }
    
    if (dateTo) {
      const endOfDay = new Date(dateTo);
      endOfDay.setHours(23, 59, 59, 999);
      filtered = filtered.filter(evaluation => 
        new Date(evaluation.created_at) <= endOfDay
      );
    }

    // Filter by user
    if (selectedUserId !== 'all') {
      filtered = filtered.filter(evaluation => 
        evaluation.user_id === selectedUserId
      );
    }

    setFilteredEvaluations(filtered);

    // Update stats based on filtered data
    const totalEvaluations = filtered.length;
    const uniqueUsers = new Set(filtered.map(e => e.user_id)).size;
    const completedEvals = filtered.filter(e => e.analysis_status === 'completed');
    const averageScore = completedEvals.length > 0 
      ? completedEvals.reduce((sum, e) => sum + (e.score || 0), 0) / completedEvals.length 
      : 0;

    setStats({
      totalEvaluations,
      totalUsers: uniqueUsers,
      averageScore: Math.round(averageScore * 10) / 10,
      completedAnalyses: completedEvals.length
    });
  };

  const clearFilters = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
    setSelectedUserId('all');
  };

  const hasActiveFilters = dateFrom || dateTo || selectedUserId !== 'all';

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

  const downloadCV = async (evaluation: EvaluationWithProfile) => {
    try {
      // Create a signed URL for download instead of using storage.download()
      const { data: signedUrlData, error: urlError } = await supabase.storage
        .from('cv-files')
        .createSignedUrl(evaluation.file_path, 60); // 1 minute expiry

      if (urlError) {
        throw urlError;
      }

      if (!signedUrlData?.signedUrl) {
        throw new Error('No se pudo generar la URL de descarga');
      }

      // Use the signed URL to download the file
      const response = await fetch(signedUrlData.signedUrl);
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const blob = await response.blob();
      
      // Create blob URL and trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = evaluation.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Descarga iniciada",
        description: `Descargando ${evaluation.file_name}`,
      });
    } catch (error) {
      console.error('Error downloading CV:', error);
      toast({
        title: "Error en descarga",
        description: "No se pudo descargar el archivo. Verifique los permisos de acceso.",
        variant: "destructive",
      });
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
            Evaluaciones de CV de todos los usuarios de LaPieza
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
                <p className="text-2xl font-bold">{stats.averageScore}/12</p>
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

      {/* Filters Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
          <CardDescription>
            Filtra las evaluaciones por fecha y usuario
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            {/* Date From Filter */}
            <div className="space-y-2">
              <Label>Fecha Desde</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start text-left font-normal",
                      !dateFrom && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFrom ? format(dateFrom, "dd/MM/yyyy") : <span>Seleccionar fecha</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={setDateFrom}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Date To Filter */}
            <div className="space-y-2">
              <Label>Fecha Hasta</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start text-left font-normal",
                      !dateTo && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateTo ? format(dateTo, "dd/MM/yyyy") : <span>Seleccionar fecha</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={setDateTo}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* User Filter */}
            <div className="space-y-2">
              <Label>Usuario</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los usuarios" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los usuarios</SelectItem>
                  {profiles.map((profile) => (
                    <SelectItem key={profile.user_id} value={profile.user_id}>
                      {profile.full_name} ({profile.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Clear Filters */}
            <div className="space-y-2">
              <Label className="invisible">Acciones</Label>
              <Button 
                variant="outline" 
                onClick={clearFilters}
                disabled={!hasActiveFilters}
                className="w-full"
              >
                <X className="mr-2 h-4 w-4" />
                Limpiar filtros
              </Button>
            </div>
          </div>
          
          {hasActiveFilters && (
            <div className="mt-4 p-3 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                Mostrando {filteredEvaluations.length} de {evaluations.length} evaluaciones
                {dateFrom && ` • Desde: ${format(dateFrom, "dd/MM/yyyy")}`}
                {dateTo && ` • Hasta: ${format(dateTo, "dd/MM/yyyy")}`}
                {selectedUserId !== 'all' && ` • Usuario: ${profiles.find(p => p.user_id === selectedUserId)?.full_name}`}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Evaluations Table */}
      <Card>
        <CardHeader>
          <CardTitle>Evaluaciones</CardTitle>
          <CardDescription>
            {hasActiveFilters ? 'Evaluaciones filtradas' : 'Histórico completo de evaluaciones de CV realizadas por el equipo'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredEvaluations.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground" />
                <p className="mt-4 text-muted-foreground">
                  {hasActiveFilters ? 'No hay evaluaciones que coincidan con los filtros' : 'No hay evaluaciones disponibles'}
                </p>
                {hasActiveFilters && (
                  <Button variant="outline" onClick={clearFilters} className="mt-2">
                    Limpiar filtros
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-4">Usuario</th>
                      <th className="text-left p-4">Archivo CV</th>
                      <th className="text-left p-4">Rol/Empresa</th>
                      <th className="text-left p-4">Estado</th>
                      <th className="text-left p-4">Puntuación</th>
                      <th className="text-left p-4">Fecha</th>
                      <th className="text-left p-4">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEvaluations.map((evaluation) => (
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
                          <div className="space-y-1">
                            {evaluation.role_info && (
                              <div className="flex items-start gap-1">
                                <Briefcase className="h-3 w-3 mt-0.5 text-muted-foreground flex-shrink-0" />
                                <p className="text-sm font-medium line-clamp-2">{evaluation.role_info}</p>
                              </div>
                            )}
                            {evaluation.company_info && (
                              <div className="flex items-start gap-1">
                                <Building className="h-3 w-3 mt-0.5 text-muted-foreground flex-shrink-0" />
                                <p className="text-sm text-muted-foreground line-clamp-2">{evaluation.company_info}</p>
                              </div>
                            )}
                            {!evaluation.role_info && !evaluation.company_info && (
                              <span className="text-sm text-muted-foreground">Sin información</span>
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          {getStatusBadge(evaluation.analysis_status)}
                        </td>
                        <td className="p-4">
                          {evaluation.score !== null ? (
                            <div className={`font-bold ${getScoreColor(evaluation.score)}`}>
                              {evaluation.score}/12
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
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedEvaluation(evaluation)}
                              disabled={evaluation.analysis_status !== 'completed'}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Ver detalles
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => downloadCV(evaluation)}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Descargar
                            </Button>
                          </div>
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
            {/* Role and Company Information */}
            {(selectedEvaluation.role_info || selectedEvaluation.company_info) && (
              <div className="grid gap-4 md:grid-cols-2">
                {selectedEvaluation.role_info && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-muted-foreground" />
                      <h3 className="font-medium">Rol Aplicado</h3>
                    </div>
                    <p className="text-sm text-muted-foreground pl-6">{selectedEvaluation.role_info}</p>
                  </div>
                )}
                {selectedEvaluation.company_info && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-muted-foreground" />
                      <h3 className="font-medium">Empresa/Industria</h3>
                    </div>
                    <p className="text-sm text-muted-foreground pl-6">{selectedEvaluation.company_info}</p>
                  </div>
                )}
              </div>
            )}

            {/* Score Display */}
            <div className={`text-center p-6 rounded-lg ${getScoreBgColor(selectedEvaluation.score || 0)}`}>
              <div className={`text-4xl font-bold ${getScoreColor(selectedEvaluation.score || 0)}`}>
                {selectedEvaluation.score}/12
              </div>
              <p className="mt-2 text-muted-foreground">{selectedEvaluation.feedback}</p>
            </div>

            {/* Highlights and Alerts */}
            {(selectedEvaluation.highlights || selectedEvaluation.alerts) && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <h4 className="font-semibold text-success flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    Puntos a destacar
                  </h4>
                  <div className="text-sm text-muted-foreground bg-success/5 p-3 rounded-lg border border-success/20">
                    {selectedEvaluation.highlights && selectedEvaluation.highlights.length > 0 ? (
                      <ul className="space-y-1">
                        {selectedEvaluation.highlights.map((highlight: string, index: number) => (
                          <li key={index} className="flex items-start gap-2">
                            <span className="text-success mt-1">•</span>
                            <span>{highlight}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span>Sin puntos destacados específicos.</span>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold text-destructive flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Alertas
                  </h4>
                  <div className="text-sm text-muted-foreground bg-destructive/5 p-3 rounded-lg border border-destructive/20">
                    {selectedEvaluation.alerts && selectedEvaluation.alerts.length > 0 ? (
                      <ul className="space-y-1">
                        {selectedEvaluation.alerts.map((alert: string, index: number) => (
                          <li key={index} className="flex items-start gap-2">
                            <span className="text-destructive mt-1">•</span>
                            <span>{alert}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span>Sin alertas específicas.</span>
                    )}
                  </div>
                </div>
              </div>
            )}

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
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};