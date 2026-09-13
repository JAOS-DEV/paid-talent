import NextAuth from "next-auth";
import { authConfig } from "./config";

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth(authConfig);

export { authConfig } from "./config";
export { createUserWithRole, isOver20, isOver18, isDevBypassAllowed, isEmailProviderConfigured } from "./config";
