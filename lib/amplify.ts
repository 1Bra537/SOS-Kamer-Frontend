import { Amplify } from "aws-amplify";

let configured = false;

export function configureAmplify() {
  if (configured || typeof window === "undefined") return;

  const userPoolId =
    process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;

  const userPoolClientId =
    process.env.NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID;

  const region =
    process.env.NEXT_PUBLIC_AWS_REGION || "us-east-1";

  if (!userPoolId || !userPoolClientId) {
    throw new Error(
      "Missing Cognito configuration. Check your .env.local file."
    );
  }

  Amplify.configure(
    {
      Auth: {
        Cognito: {
          userPoolId,
          userPoolClientId,

          loginWith: {
            email: true,

            oauth: {
              domain:
                "sos-kamer-auth.auth.us-east-1.amazoncognito.com",

              scopes: [
                "openid",
                "email",
                "profile",
              ],

                redirectSignIn: [
            `${window.location.origin}/login`,
          ],

            redirectSignOut: [
              `${window.location.origin}/login`,
            ],
              responseType: "code",
            },
          },

          signUpVerificationMethod: "code",
        },
      },

      API: {
        REST: {},
      },
    },
    {
      ssr: true,
    }
  );

  configured = true;
}