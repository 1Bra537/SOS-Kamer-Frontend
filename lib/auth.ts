import {
fetchAuthSession,
getCurrentUser,
signOut,
} from "aws-amplify/auth";

import { configureAmplify } from "./amplify";

export type UserRole = "admin" | "citizen" | null;

export type AuthState = {
signedIn: boolean;
role: UserRole;
};

export async function getAuthState(): Promise<AuthState> {
configureAmplify();

try {
// Check whether a Cognito user is currently signed in.
await getCurrentUser();

const session = await fetchAuthSession();

const groups = session.tokens?.idToken?.payload?.[
  "cognito:groups"
];

let groupList: string[] = [];

if (Array.isArray(groups)) {
  groupList = groups.map(String);
} else if (typeof groups === "string") {
  groupList = groups
    .split(",")
    .map((group) => group.trim());
}

// Admin takes priority if the user belongs to both groups.
if (groupList.includes("admins")) {
  return {
    signedIn: true,
    role: "admin",
  };
}

if (groupList.includes("citizens")) {
  return {
    signedIn: true,
    role: "citizen",
  };
}

// User is authenticated but has no recognized SOS-Kamer group.
return {
  signedIn: true,
  role: null,
};

} catch {
// No authenticated Cognito session.
return {
signedIn: false,
role: null,
};
}
}

/**

* Convenience helper when only the user's role is needed.
  */
  export async function getUserRole(): Promise<UserRole> {
  const authState = await getAuthState();

return authState.role;
}

/**

* Sign the current Cognito user out completely.
  */
  export async function signOutUser() {
  configureAmplify();

await signOut();
}