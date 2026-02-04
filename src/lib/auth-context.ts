import { headers } from "next/headers";
import { AppUserRole } from "@/generated/prisma/client";

export interface AuthContext {
  userId: string;
  email: string;
  role: AppUserRole;
  displayName: string;
}

export async function getAuthContext(): Promise<AuthContext> {
  const h = await headers();
  const userId = h.get("x-user-id");
  const email = h.get("x-user-email");
  const role = h.get("x-user-role");
  const displayName = h.get("x-user-display-name");

  if (!userId || !email || !role || !displayName) {
    throw new Error("Auth context not available — middleware may not have run");
  }

  return { userId, email, role: role as AppUserRole, displayName };
}
