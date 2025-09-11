import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";
import { Resend } from "npm:resend@4.0.0";
import { renderAsync } from "npm:@react-email/components@0.0.22";
import React from "npm:react@18.3.1";
import { VerificationEmail } from "./_templates/verification-email.tsx";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const hookSecret = Deno.env.get("AUTH_EMAIL_HOOK_SECRET") || "your-webhook-secret";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const payload = await req.text();
    const headers = Object.fromEntries(req.headers);
    
    // Verify webhook signature
    const wh = new Webhook(hookSecret);
    const {
      user,
      email_data: { token, token_hash, redirect_to, email_action_type, site_url },
    } = wh.verify(payload, headers) as {
      user: {
        email: string;
        id: string;
      };
      email_data: {
        token: string;
        token_hash: string;
        redirect_to: string;
        email_action_type: string;
        site_url: string;
      };
    };

    console.log(`Sending ${email_action_type} email to ${user.email}`);

    // Generate email content based on action type
    let subject: string;
    let emailComponent: React.ReactElement;

    switch (email_action_type) {
      case "signup":
      case "email_change_confirmation":
        subject = "Confirma tu cuenta en LaPieza - CV Evaluator";
        emailComponent = React.createElement(VerificationEmail, {
          confirmationUrl: `${site_url}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to}`,
          userEmail: user.email,
          actionType: "confirmation",
        });
        break;
      
      case "recovery":
        subject = "Restablece tu contraseña en LaPieza";
        emailComponent = React.createElement(VerificationEmail, {
          confirmationUrl: `${site_url}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to}`,
          userEmail: user.email,
          actionType: "recovery",
        });
        break;
      
      default:
        subject = "Acción requerida en LaPieza";
        emailComponent = React.createElement(VerificationEmail, {
          confirmationUrl: `${site_url}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to}`,
          userEmail: user.email,
          actionType: "generic",
        });
    }

    // Render email HTML
    const html = await renderAsync(emailComponent);

    // Send email via Resend
    const { data, error } = await resend.emails.send({
      from: "LaPieza CV Evaluator <noreply@lapieza.io>",
      to: [user.email],
      subject,
      html,
    });

    if (error) {
      console.error("Error sending email:", error);
      throw error;
    }

    console.log("Email sent successfully:", data);

    return new Response(
      JSON.stringify({ success: true, messageId: data?.id }),
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