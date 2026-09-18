"use client";

import { useState } from "react";
import { toast } from "sonner";

// 2026-09-18 kullanıcı talebi: makale paylaşım ikonları. TahminOnerileri.tsx'teki kupon
// paylaşımından FARKLI olarak (o bir görsel/PNG üretip paylaşıyor) burada gerçek bir
// sayfa var — standart URL tabanlı paylaşım (X/Facebook/WhatsApp intent linkleri +
// Web Share API) daha doğru, ayrıca OG meta etiketleri (bkz. [slug]/page.tsx
// generateMetadata) paylaşılan linkin önizlemesini otomatik doğru gösterir.
function XLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function FacebookLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M15 3h-2a5 5 0 0 0-5 5v3H6v4h2v6h4v-6h2.5l.5-4H12V8a1 1 0 0 1 1-1h2z" />
    </svg>
  );
}

function WhatsAppLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12.043 21.785h-.004a9.867 9.867 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.885 9.887-9.885 2.64 0 5.122 1.03 6.988 2.898a9.828 9.828 0 0 1 2.892 6.994c-.002 5.45-4.436 9.885-9.883 9.885zm8.413-18.297A11.815 11.815 0 0 0 12.043 0C5.501 0 .181 5.32.178 11.86a11.85 11.85 0 0 0 1.583 5.945L0 24l6.335-1.662a11.888 11.888 0 0 0 5.703 1.453h.005c6.541 0 11.862-5.32 11.865-11.859a11.79 11.79 0 0 0-3.452-8.444z" />
    </svg>
  );
}

function ShareLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22l-4-9-9-4z" />
    </svg>
  );
}

function LinkLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

export default function ArticleShareButtons({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);

  async function handleNativeShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        // kullanıcı paylaşım penceresini iptal etti — sessizce yut
      }
      return;
    }
    handleCopy();
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Bağlantı kopyalandı");
    setTimeout(() => setCopied(false), 2000);
  }

  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  const btnClass = "inline-flex items-center rounded-md border border-muted-foreground/25 p-2 hover:bg-muted transition-colors";

  return (
    <div className="flex items-center gap-1.5">
      <button type="button" onClick={handleNativeShare} title="Paylaş" aria-label="Paylaş" className="inline-flex items-center rounded-md border border-brand/40 bg-brand/10 p-2 text-brand hover:bg-brand/20 transition-colors">
        <ShareLogo className="h-4 w-4" />
      </button>
      <a href={`https://x.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`} target="_blank" rel="noopener noreferrer" title="X'te paylaş" aria-label="X'te paylaş" className={btnClass}>
        <XLogo className="h-4 w-4" />
      </a>
      <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`} target="_blank" rel="noopener noreferrer" title="Facebook'ta paylaş" aria-label="Facebook'ta paylaş" className={btnClass}>
        <FacebookLogo className="h-4 w-4" />
      </a>
      <a href={`https://wa.me/?text=${encodedTitle}%20${encodedUrl}`} target="_blank" rel="noopener noreferrer" title="WhatsApp'ta paylaş" aria-label="WhatsApp'ta paylaş" className={btnClass}>
        <WhatsAppLogo className="h-4 w-4" />
      </a>
      <button type="button" onClick={handleCopy} title="Bağlantıyı kopyala" aria-label="Bağlantıyı kopyala" className={btnClass}>
        <LinkLogo className={`h-4 w-4 ${copied ? "text-hit" : ""}`} />
      </button>
    </div>
  );
}
