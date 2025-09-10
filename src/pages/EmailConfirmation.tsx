import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mail, ArrowLeft, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface EmailConfirmationProps {
  email: string;
  onBack: () => void;
}

export const EmailConfirmation = ({ email, onBack }: EmailConfirmationProps) => {
  const [isResending, setIsResending] = useState(false);
  const { toast } = useToast();

  const handleResendEmail = async () => {
    setIsResending(true);
    
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/`
        }
      });

      if (error) {
        toast({
          title: "Error al reenviar",
          description: "No se pudo reenviar el email. Intenta más tarde.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Email reenviado",
          description: "Hemos enviado un nuevo email de confirmación.",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Ocurrió un error inesperado.",
        variant: "destructive",
      });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/30 to-corporate/5 p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Main Confirmation Card */}
        <Card className="border-corporate/20">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-corporate/10 rounded-full flex items-center justify-center">
              <Mail className="h-8 w-8 text-corporate" />
            </div>
            <div>
              <CardTitle className="text-2xl">Confirma tu email</CardTitle>
              <CardDescription className="text-base mt-2">
                Para acceder al CV Evaluator, necesitas confirmar tu dirección de email
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">
                  Hemos enviado un email de confirmación a:
                </p>
                <p className="font-medium text-corporate">
                  {email}
                </p>
              </div>
              
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>📧 <strong>Revisa tu bandeja de entrada</strong> y busca un email de Supabase</p>
                <p>📂 <strong>Verifica tu carpeta de spam</strong> si no lo encuentras</p>
                <p>🔗 <strong>Haz clic en el enlace UNA SOLA VEZ</strong> del email para confirmar tu cuenta</p>
                <p>⚠️ <strong>Importante:</strong> El enlace es de un solo uso y expira en 24 horas</p>
                <p>🌐 <strong>Usa el mismo navegador</strong> donde abriste este registro</p>
                <p>↩️ <strong>Después de confirmar, regresa aquí</strong> para iniciar sesión manualmente</p>
              </div>
            </div>

            <div className="space-y-3">
              <Button 
                onClick={handleResendEmail}
                disabled={isResending}
                className="w-full"
                variant="outline"
              >
                {isResending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Reenviando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Reenviar email de confirmación
                  </>
                )}
              </Button>

              <Button 
                onClick={onBack}
                variant="ghost"
                className="w-full"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver al inicio de sesión
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Help Card */}
        <Card className="border-warning/20 bg-warning/5">
          <CardContent className="pt-6">
            <div className="text-center space-y-2">
              <h3 className="font-semibold text-warning">¿Problemas para recibir el email?</h3>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>• Los emails pueden tardar hasta 10 minutos en llegar</p>
                <p>• Verifica que tu email sea de @lapieza.io</p>
                <p>• <strong>Si ves "enlace inválido":</strong> El enlace ya fue usado o expiró</p>
                <p>• <strong>Solución:</strong> Usa el botón "Reenviar email" arriba</p>
                <p>• Contacta al administrador del sistema si persiste el problema</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};