import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, Building } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AuthGateProps {
  onAuthenticated: () => void;
}

export const AuthGate = ({ onAuthenticated }: AuthGateProps) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.endsWith('@lapieza.io')) {
      toast({
        title: "Acceso denegado",
        description: "Solo usuarios con email @lapieza.io pueden acceder a esta herramienta.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    // Simulate authentication - in real implementation, this would use Supabase auth
    setTimeout(() => {
      setIsLoading(false);
      onAuthenticated();
      toast({
        title: "Acceso autorizado",
        description: `Bienvenido ${email}`,
      });
    }, 1500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/30 to-corporate/5 p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo/Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 bg-corporate rounded-full flex items-center justify-center">
            <Building className="h-8 w-8 text-corporate-foreground" />
          </div>
          <h1 className="text-2xl font-bold">CV Evaluator</h1>
          <p className="text-muted-foreground">Herramienta interna de La Pieza</p>
        </div>

        {/* Auth Form */}
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Acceso Restringido
            </CardTitle>
            <CardDescription>
              Solo usuarios autorizados de @lapieza.io pueden acceder
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email corporativo</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="tu.email@lapieza.io"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading}
              >
                {isLoading ? 'Verificando...' : 'Acceder'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="border-corporate/20">
          <CardContent className="pt-6">
            <div className="text-center space-y-2">
              <h3 className="font-semibold text-corporate">¿Qué es CV Evaluator?</h3>
              <p className="text-sm text-muted-foreground">
                Herramienta interna que analiza CVs automáticamente y proporciona 
                una puntuación del 1-10 basada en nuestros criterios de selección, 
                ayudando a identificar perfiles top de manera eficiente.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};