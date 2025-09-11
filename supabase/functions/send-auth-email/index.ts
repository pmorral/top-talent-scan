import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AuthEmailRequest {
  email: string;
  type: 'signup' | 'recovery' | 'email_change';
  redirect_to?: string;
}

const getEmailTemplate = (type: string, confirmationUrl: string, userEmail: string) => {
  const baseStyles = `
    <style>
      body { font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Ubuntu,sans-serif; margin: 0; padding: 0; background-color: #f6f9fc; }
      .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
      .header { padding: 32px 24px 0; text-align: center; border-bottom: 1px solid #e6ebf1; margin-bottom: 32px; }
      .logo { color: #1a202c; font-size: 32px; font-weight: bold; margin: 0 0 8px; }
      .tagline { color: #718096; font-size: 16px; margin: 0 0 24px; font-weight: 500; }
      .content { padding: 0 24px; }
      .heading { color: #1a202c; font-size: 24px; font-weight: bold; margin: 0 0 24px; text-align: center; }
      .text { color: #4a5568; font-size: 16px; line-height: 26px; margin: 16px 0; }
      .button-container { text-align: center; margin: 32px 0; }
      .button { background-color: #3182ce; border-radius: 8px; color: #ffffff; font-size: 16px; font-weight: bold; text-decoration: none; display: inline-block; padding: 16px 32px; }
      .link { color: #3182ce; font-size: 14px; text-decoration: underline; word-break: break-all; }
      .footer-text { color: #a0aec0; font-size: 14px; line-height: 20px; margin: 32px 0 0; font-style: italic; }
      .footer { border-top: 1px solid #e6ebf1; padding: 24px 24px 0; text-align: center; margin-top: 48px; }
      .footer-small { color: #a0aec0; font-size: 12px; margin: 0 0 8px; }
    </style>
  `;

  const getContent = () => {
    switch (type) {
      case 'signup':
        return {
          subject: "Confirma tu cuenta en LaPieza - CV Evaluator",
          heading: "¡Bienvenido a LaPieza CV Evaluator!",
          text: "Gracias por registrarte. Para completar tu registro y acceder a nuestra plataforma de evaluación de CVs, confirma tu dirección de email haciendo clic en el botón de abajo.",
          buttonText: "Confirmar Email",
          footer: "Si no te registraste en LaPieza, puedes ignorar este email de forma segura.",
        };
      case 'recovery':
        return {
          subject: "Restablece tu contraseña en LaPieza",
          heading: "Restablece tu contraseña",
          text: "Recibimos una solicitud para restablecer la contraseña de tu cuenta en LaPieza CV Evaluator. Haz clic en el botón de abajo para crear una nueva contraseña.",
          buttonText: "Restablecer Contraseña",
          footer: "Si no solicitaste restablecer tu contraseña, puedes ignorar este email de forma segura.",
        };
      default:
        return {
          subject: "Acción requerida en LaPieza",
          heading: "Acción requerida",
          text: "Se requiere una acción de tu parte para continuar con LaPieza CV Evaluator.",
          buttonText: "Continuar",
          footer: "Si no esperabas este email, puedes ignorarlo de forma segura.",
        };
    }
  };

  const content = getContent();

  return {
    subject: content.subject,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${content.subject}</title>
        ${baseStyles}
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 class="logo">LaPieza</h1>
            <p class="tagline">CV Evaluator</p>
          </div>
          
          <div class="content">
            <h2 class="heading">${content.heading}</h2>
            
            <p class="text">Hola,</p>
            
            <p class="text">${content.text}</p>

            <div class="button-container">
              <a href="${confirmationUrl}" class="button">${content.buttonText}</a>
            </div>

            <p class="text" style="color: #718096; font-size: 14px; margin: 24px 0 8px;">
              O copia y pega este enlace en tu navegador:
            </p>
            <a href="${confirmationUrl}" class="link">${confirmationUrl}</a>

            <p class="footer-text">${content.footer}</p>
          </div>

          <div class="footer">
            <p class="footer-small">© 2024 LaPieza. Todos los derechos reservados.</p>
            <p class="footer-small">LaPieza CV Evaluator - Herramienta interna de evaluación</p>
          </div>
        </div>
      </body>
      </html>
    `
  };
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { email, type, redirect_to }: AuthEmailRequest = await req.json();

    console.log(`Processing ${type} email for ${email}`);

    let result;
    const redirectUrl = redirect_to || `${supabaseUrl.replace('supabase.co', 'supabase.io')}/auth/v1/verify`;

    switch (type) {
      case 'signup':
        // Use Supabase's built-in auth system but with custom redirect
        result = await supabase.auth.admin.inviteUserByEmail(email, {
          redirectTo: redirect_to || window?.location?.origin || 'https://cv-test.lapieza.ai'
        });
        break;
      
      case 'recovery':
        result = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: redirect_to || window?.location?.origin || 'https://cv-test.lapieza.ai'
        });
        break;
      
      default:
        throw new Error(`Unsupported email type: ${type}`);
    }

    if (result.error) {
      console.error(`Error sending ${type} email:`, result.error);
      throw result.error;
    }

    console.log(`${type} email sent successfully to ${email}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `${type} email sent successfully`,
        data: result.data 
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in send-auth-email function:", error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  }
};

serve(handler);