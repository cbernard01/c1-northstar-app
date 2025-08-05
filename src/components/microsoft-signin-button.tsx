"use client";

import { Loader2 } from "lucide-react";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { BsMicrosoft } from "react-icons/bs";

interface MicrosoftSignInButtonProps {
  callbackUrl?: string;
}

export function MicrosoftSignInButton({ callbackUrl = "/dashboard" }: MicrosoftSignInButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async () => {
    setIsLoading(true);
    try {
      await signIn("microsoft-entra-id", { callbackUrl });
    } catch (error) {
      setIsLoading(false);
      console.error("Sign in error:", error);
    }
  };

  return (
    <div className="group relative w-72">
      {isLoading ? (
        <button className="group relative w-full p-0.5" disabled>
          <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-[#ED31A0] to-[#0567CD] opacity-50" />
          <div className="relative flex items-center justify-center gap-4 rounded-lg bg-black px-8 py-2 text-white transition duration-200">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span className="font-bold">Signing in...</span>
          </div>
        </button>
      ) : (
        <button className="group relative w-full p-0.5" onClick={handleSignIn}>
          <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-[#ED31A0] to-[#0567CD]" />
          <div className="relative flex items-center justify-center gap-4 rounded-lg bg-black px-8 py-2 text-white transition duration-200 hover:bg-transparent">
            <BsMicrosoft className="h-3.5 w-3.5" />
            <span className="font-bold">Sign in with Microsoft</span>
          </div>
        </button>
      )}
    </div>
  );
}