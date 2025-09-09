import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, Building, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from './AuthProvider';

export const AuthGate = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { signIn, signUp, loading } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.endsWith('@lapieza.io')) {
      toast({
        title: "Acceso denegado",
        description: "Credenciales no válidas. Contacta al administrador del sistema.",
        variant: "destructive",
      });
      return;
    }

    const { error } = isSignUp 
      ? await signUp(email, password)
      : await signIn(email, password);

    if (error) {
      toast({
        title: "Error de autenticación",
        description: error.message === 'Invalid login credentials' 
          ? 'Credenciales inválidas. Verifica tu email y contraseña.'
          : error.message,
        variant: "destructive",
      });
    } else if (isSignUp) {
      toast({
        title: "Registro exitoso",
        description: "Revisa tu email para confirmar tu cuenta.",
      });
    } else {
      toast({
        title: "Acceso autorizado",
        description: `Bienvenido ${email}`,
      });
    }
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
            <form onSubmit={handleSubmit} className="space-y-4">
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
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Tu contraseña"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <Button 
                type="submit" 
                className="w-full" 
                disabled={loading}
              >
                {loading ? 'Procesando...' : (isSignUp ? 'Crear cuenta' : 'Iniciar sesión')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setIsSignUp(!isSignUp)}
              >
                {isSignUp ? '¿Ya tienes cuenta? Inicia sesión' : '¿Necesitas una cuenta? Regístrate'}
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