"use client";

import { useRef, useEffect, type ReactNode } from "react";

/**
 * Thin client wrapper that observes its rendered `<header>` element and
 * publishes its height as the CSS custom property `--app-header-h`.
 *
 * Extracted from AppHeader so the parent component can remain a server
 * component, keeping the client JS footprint minimal.
 */
export default function HeaderHeightPublisher({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;

    const update = () => {
      document.documentElement.style.setProperty(
        "--app-header-h",
        `${el.offsetHeight}px`,
      );
    };

    update();

    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.documentElement.style.removeProperty("--app-header-h");
    };
  }, []);

  return (
    <header ref={headerRef} className={className}>
      {children}
    </header>
  );
}
