"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { createMethodologyVersion } from "@/server/actions/methodology.actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function MethodologyForm({
  suggestedVersion,
  defaultContent,
}: {
  suggestedVersion: string;
  defaultContent: string;
}) {
  const [version, setVersion] = useState(suggestedVersion);
  const [effectiveDate, setEffectiveDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [content, setContent] = useState(defaultContent);
  const [pending, startTransition] = useTransition();

  function handleSubmit() {
    if (!version.trim()) return toast.error("Versiyon adı gerekli");
    if (!content.trim()) return toast.error("İçerik boş olamaz");

    startTransition(async () => {
      const res = await createMethodologyVersion({ version, effectiveDate, content });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`${version} güncel versiyon olarak yayımlandı`);
    });
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="version">Versiyon</Label>
          <Input
            id="version"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            placeholder="v1.7"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="effectiveDate">Geçerlilik Tarihi</Label>
          <Input
            id="effectiveDate"
            type="date"
            value={effectiveDate}
            onChange={(e) => setEffectiveDate(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="content">İçerik</Label>
        <Textarea
          id="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={14}
          className="font-mono text-xs"
        />
      </div>

      <Button onClick={handleSubmit} disabled={pending} size="sm">
        {pending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
        {pending ? "Yayımlanıyor…" : "Yeni Versiyon Yayımla"}
      </Button>
    </div>
  );
}
