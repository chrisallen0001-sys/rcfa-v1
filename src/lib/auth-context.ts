import { headers } from "next/headers";
import { AppUserRole } from "@/generated/prisma/client";

export interface AuthContext {
  userId: string;
  email: string;
  role: AppUserRole;
}

export async function getAuthContext(): Promise<AuthContext> {
  const h = await headers();
  const userId = h.get("x-user-id");
  const email = h.get("x-user-email");
  const role = h.get("x-user-role");

  if (!userId || !email || !role) {
    throw new Error("Auth context not available — middleware may not have run");
  }

  return { userId, email, role: role as AppUserRole };
}
