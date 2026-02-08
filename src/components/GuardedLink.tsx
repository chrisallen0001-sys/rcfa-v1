"use client";

import Link from "next/link";
import { checkUnsavedChanges } from "@/hooks/useNavigationGuard";
import type { ComponentProps } from "react";

type GuardedLinkProps = ComponentProps<typeof Link>;

/**
 * A Link component that checks for unsaved changes before navigating.
 * Uses the global navigation guard to prompt users if there are pending saves.
 */
export default function GuardedLink({
  href,
  children,
  onClick,
  ...props
}: GuardedLinkProps) {
  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    // Call any existing onClick handler first
    onClick?.(e);

    // If already prevented, don't do our check
    if (e.defaultPrevented) {
      return;
    }

    // Check for unsaved changes
    if (!checkUnsavedChanges()) {
      e.preventDefault();
    }
  }

  return (
    <Link href={href} onClick={handleClick} {...props}>
      {children}
    </Link>
  );
}
