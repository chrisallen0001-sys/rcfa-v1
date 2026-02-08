"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDraftNavigation } from "./DraftNavigationContext";

interface GuardedBackLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
}

export default function GuardedBackLink({ href, children, className }: GuardedBackLinkProps) {
  const router = useRouter();
  const draftNav = useDraftNavigation();

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    // If not in draft context or no unsaved changes, allow normal navigation
    if (!draftNav?.isDirty) {
      return;
    }

    // Prevent default navigation
    e.preventDefault();

    // Show confirmation dialog
    const confirmed = window.confirm(
      "You have unsaved changes. Are you sure you want to leave this page?"
    );

    if (confirmed) {
      router.push(href);
    }
  }

  return (
    <Link href={href} className={className} onClick={handleClick}>
      {children}
    </Link>
  );
}
