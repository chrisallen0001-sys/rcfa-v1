"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import ChangePasswordModal from "./ChangePasswordModal";

interface UserMenuProps {
  displayName: string;
}

export default function UserMenu({ displayName }: UserMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  async function handleLogout() {
    setLoggingOut(true);
    setLogoutError(false);
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      // Treat 401 as success - session was already invalid
      if (res.ok || res.status === 401) {
        router.push("/login");
      } else {
        setLogoutError(true);
        setLoggingOut(false);
      }
    } catch {
      setLogoutError(true);
      setLoggingOut(false);
    }
  }

  function handleChangePassword() {
    setOpen(false);
    setPasswordModalOpen(true);
  }

  return (
    <>
      <div ref={menuRef} className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <span className="text-zinc-500 dark:text-zinc-400">Signed in as</span>
          <span className="font-semibold text-zinc-900 dark:text-zinc-50">{displayName}</span>
          <svg
            className={`h-4 w-4 text-zinc-500 transition-transform dark:text-zinc-400 ${open ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
            <button
              onClick={handleChangePassword}
              className="w-full px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Change Password
            </button>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className={`w-full px-4 py-2 text-left text-sm disabled:opacity-50 ${
                logoutError
                  ? "text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
                  : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              {loggingOut ? "Logging out..." : logoutError ? "Retry Logout" : "Logout"}
            </button>
          </div>
        )}
      </div>

      <ChangePasswordModal
        open={passwordModalOpen}
        onClose={() => setPasswordModalOpen(false)}
      />
    </>
  );
}
