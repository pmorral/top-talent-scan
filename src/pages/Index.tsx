import { useState } from 'react';
import { AuthGate } from '@/components/AuthGate';
import { CVUploader } from '@/components/CVUploader';

const Index = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  if (!isAuthenticated) {
    return <AuthGate onAuthenticated={() => setIsAuthenticated(true)} />;
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
            <div className="text-sm text-muted-foreground">
              Evaluación automática de perfiles
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <CVUploader />
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
