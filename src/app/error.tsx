"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center px-4">
      <p className="text-5xl font-bold text-muted-foreground/30">!</p>
      <h1 className="text-xl font-semibold">Bir Sorun Oluştu</h1>
      <p className="text-sm text-muted-foreground max-w-sm">
        Beklenmedik bir hata meydana geldi. Tekrar denemek için aşağıdaki butona tıklayın.
      </p>
      <div className="flex gap-2">
        <Button onClick={reset}>Tekrar Dene</Button>
        <Button variant="outline" asChild>
          <Link href="/">Ana Sayfa</Link>
        </Button>
      </div>
      {process.env.NODE_ENV === "development" && (
        <p className="mt-2 max-w-lg rounded bg-muted px-3 py-2 text-left font-mono text-xs text-miss">
          {error.message}
        </p>
      )}
    </div>
  );
}
