import { AuthGate } from '@/components/AuthGate';
import { CVUploader } from '@/components/CVUploader';
import { SuperAdminDashboard } from '@/components/SuperAdminDashboard';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui/button';
import { LogOut, User, BarChart3 } from 'lucide-react';
import { useState, useEffect } from 'react';

const Index = () => {
  const { user, signOut } = useAuth();
  const [showDashboard, setShowDashboard] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    if (user?.email === 'pol@lapieza.io') {
      setIsSuperAdmin(true);
    }
  }, [user]);

  if (!user) {
    return <AuthGate />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-corporate rounded-lg flex items-center justify-center">
                <span className="text-corporate-foreground font-bold text-sm">LP</span>
              </div>
              <div>
                <h1 className="text-xl font-bold">CV Evaluator</h1>
                <p className="text-sm text-muted-foreground">La Pieza - Herramienta Interna</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                {user.email}
              </div>
              {isSuperAdmin && (
                <Button 
                  variant={showDashboard ? "default" : "outline"}
                  size="sm" 
                  onClick={() => setShowDashboard(!showDashboard)}
                  className="flex items-center gap-2"
                >
                  <BarChart3 className="h-4 w-4" />
                  {showDashboard ? 'Evaluador' : 'Dashboard'}
                </Button>
              )}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={signOut}
                className="flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                Salir
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {isSuperAdmin && showDashboard ? (
          <SuperAdminDashboard />
        ) : (
          <CVUploader />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t bg-muted/30 mt-16">
        <div className="container mx-auto px-4 py-6">
          <div className="text-center text-sm text-muted-foreground">
            <p>© 2024 La Pieza - Herramienta interna para evaluación de CVs</p>
            <p className="mt-1">Solo para uso interno de empleados autorizados</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
