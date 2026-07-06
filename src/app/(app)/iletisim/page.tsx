import type { Metadata } from "next";

export const metadata: Metadata = { title: "İletişim" };

export default function IletisimPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="mb-2 text-3xl font-bold">İletişim</h1>
      <p className="mb-10 text-muted-foreground">
        Sorularınız, geri bildirimleriniz veya iş birliği teklifleriniz için
        bize ulaşabilirsiniz.
      </p>

      <div className="space-y-6">
        <div className="rounded-lg border p-6">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">E-posta</p>
          <a
            href="mailto:destek@rotaganyan.com"
            className="text-lg font-medium text-brand hover:underline underline-offset-4"
          >
            destek@rotaganyan.com
          </a>
          <p className="mt-1 text-sm text-muted-foreground">
            Genel sorular, analiz talepleri ve geri bildirim için.
          </p>
        </div>

        <div className="rounded-lg border p-6">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Yanıt Süresi</p>
          <p className="text-lg font-medium">1–2 iş günü</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Tüm mesajlara mümkün olan en kısa sürede dönüş yapılmaktadır.
          </p>
        </div>

      </div>
    </main>
  );
}
