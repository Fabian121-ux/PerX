"use client";

import { testLoginAction } from "@/features/auth/test-login-action";
import { Button } from "@/components/ui/button";

export function TestAccountButton() {
  return (
    <div className="grid gap-2">
      <form action={testLoginAction}>
        <Button className="w-full bg-slate-800 hover:bg-slate-900" type="submit">
          Enter Test Account
        </Button>
      </form>
      <p className="text-center text-xs text-slate-500">
        Test Account: test the real local application interface
      </p>
    </div>
  );
}
