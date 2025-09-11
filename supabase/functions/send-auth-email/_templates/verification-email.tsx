import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
  Section,
  Button,
} from "npm:@react-email/components@0.0.22";
import * as React from "npm:react@18.3.1";

interface VerificationEmailProps {
  confirmationUrl: string;
  userEmail: string;
  actionType: "confirmation" | "recovery" | "generic";
}

export const VerificationEmail = ({
  confirmationUrl,
  userEmail,
  actionType,
}: VerificationEmailProps) => {
  const getContent = () => {
    switch (actionType) {
      case "confirmation":
        return {
          preview: "Confirma tu cuenta en LaPieza CV Evaluator",
          heading: "¡Bienvenido a LaPieza CV Evaluator!",
          text: "Gracias por registrarte. Para completar tu registro y acceder a nuestra plataforma de evaluación de CVs, confirma tu dirección de email haciendo clic en el botón de abajo.",
          buttonText: "Confirmar Email",
          footer: "Si no te registraste en LaPieza, puedes ignorar este email de forma segura.",
        };
      case "recovery":
        return {
          preview: "Restablece tu contraseña en LaPieza",
          heading: "Restablece tu contraseña",
          text: "Recibimos una solicitud para restablecer la contraseña de tu cuenta en LaPieza CV Evaluator. Haz clic en el botón de abajo para crear una nueva contraseña.",
          buttonText: "Restablecer Contraseña",
          footer: "Si no solicitaste restablecer tu contraseña, puedes ignorar este email de forma segura.",
        };
      default:
        return {
          preview: "Acción requerida en LaPieza",
          heading: "Acción requerida",
          text: "Se requiere una acción de tu parte para continuar con LaPieza CV Evaluator.",
          buttonText: "Continuar",
          footer: "Si no esperabas este email, puedes ignorarlo de forma segura.",
        };
    }
  };

  const content = getContent();

  return (
    <Html>
      <Head />
      <Preview>{content.preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header with LaPieza branding */}
          <Section style={header}>
            <Heading style={logoText}>LaPieza</Heading>
            <Text style={tagline}>CV Evaluator</Text>
          </Section>

          {/* Main content */}
          <Section style={content_section}>
            <Heading style={h1}>{content.heading}</Heading>
            
            <Text style={text}>
              Hola,
            </Text>
            
            <Text style={text}>
              {content.text}
            </Text>

            <Section style={buttonContainer}>
              <Button href={confirmationUrl} style={button}>
                {content.buttonText}
              </Button>
            </Section>

            <Text style={linkText}>
              O copia y pega este enlace en tu navegador:
            </Text>
            <Link href={confirmationUrl} style={link}>
              {confirmationUrl}
            </Link>

            <Text style={footerText}>
              {content.footer}
            </Text>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerCopyright}>
              © 2024 LaPieza. Todos los derechos reservados.
            </Text>
            <Text style={footerAddress}>
              LaPieza CV Evaluator - Herramienta interna de evaluación
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default VerificationEmail;

// Styles
const main = {
  backgroundColor: "#f6f9fc",
  fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Ubuntu,sans-serif",
};

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "20px 0 48px",
  marginBottom: "64px",
};

const header = {
  padding: "32px 24px 0",
  textAlign: "center" as const,
  borderBottom: "1px solid #e6ebf1",
  marginBottom: "32px",
};

const logoText = {
  color: "#1a202c",
  fontSize: "32px",
  fontWeight: "bold",
  margin: "0 0 8px",
};

const tagline = {
  color: "#718096",
  fontSize: "16px",
  margin: "0 0 24px",
  fontWeight: "500",
};

const content_section = {
  padding: "0 24px",
};

const h1 = {
  color: "#1a202c",
  fontSize: "24px",
  fontWeight: "bold",
  margin: "0 0 24px",
  textAlign: "center" as const,
};

const text = {
  color: "#4a5568",
  fontSize: "16px",
  lineHeight: "26px",
  margin: "16px 0",
};

const buttonContainer = {
  textAlign: "center" as const,
  margin: "32px 0",
};

const button = {
  backgroundColor: "#3182ce",
  borderRadius: "8px",
  color: "#ffffff",
  fontSize: "16px",
  fontWeight: "bold",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block",
  padding: "16px 32px",
  margin: "0 auto",
};

const linkText = {
  color: "#718096",
  fontSize: "14px",
  margin: "24px 0 8px",
};

const link = {
  color: "#3182ce",
  fontSize: "14px",
  textDecoration: "underline",
  wordBreak: "break-all" as const,
};

const footerText = {
  color: "#a0aec0",
  fontSize: "14px",
  lineHeight: "20px",
  margin: "32px 0 0",
  fontStyle: "italic",
};

const footer = {
  borderTop: "1px solid #e6ebf1",
  padding: "24px 24px 0",
  textAlign: "center" as const,
  marginTop: "48px",
};

const footerCopyright = {
  color: "#a0aec0",
  fontSize: "12px",
  margin: "0 0 8px",
};

const footerAddress = {
  color: "#a0aec0",
  fontSize: "12px",
  margin: "0",
};