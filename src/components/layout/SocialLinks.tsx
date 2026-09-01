// 2026-09-01 kullanıcı talebi — header'daki "Banko Önerileri" düğmesi (yalnız /tahmin-
// onerileri'ne giden ikinci bir bağlantıydı) kaldırılıp yerine gerçek sosyal medya
// hesaplarına giden ikonlar kondu. lucide-react'te marka ikonları (Instagram/Facebook/X)
// yok — bu yüzden resmi glif yollarıyla minimal inline SVG kullanılıyor, ek paket eklenmedi.
// 2026-09-01 (aynı gün, ikinci karar): önce markaların GERÇEK renkleriyle denendi, sonra
// kullanıcı kupon paylaşım satırındaki (TahminOnerileri.tsx) koyu/kenarlıklı/tek-renkli
// stile döndürülmesini istedi — o butonlarla AYNI görünüm burada da uygulanıyor.
const ICON_CLASS = "h-3.5 w-3.5 fill-current";

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" className={ICON_CLASS} aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" className={ICON_CLASS} aria-hidden="true">
      <path d="M12 2c2.717 0 3.056.01 4.122.06 1.065.05 1.79.217 2.428.465.66.256 1.216.6 1.772 1.153a4.9 4.9 0 0 1 1.153 1.772c.247.637.415 1.363.465 2.428.048 1.066.06 1.405.06 4.122s-.01 3.056-.06 4.122c-.05 1.065-.218 1.79-.465 2.428a4.9 4.9 0 0 1-1.153 1.772 4.9 4.9 0 0 1-1.772 1.153c-.637.247-1.363.415-2.428.465-1.066.048-1.405.06-4.122.06s-3.056-.01-4.122-.06c-1.065-.05-1.79-.218-2.428-.465a4.9 4.9 0 0 1-1.772-1.153 4.9 4.9 0 0 1-1.153-1.772c-.247-.637-.415-1.363-.465-2.428C2.01 15.056 2 14.717 2 12s.01-3.056.06-4.122c.05-1.065.217-1.79.465-2.428A4.9 4.9 0 0 1 3.678 3.678 4.9 4.9 0 0 1 5.45 2.525c.637-.247 1.363-.415 2.428-.465C8.944 2.01 9.283 2 12 2m0 1.802c-2.67 0-2.986.01-4.04.059-.976.045-1.505.207-1.858.344-.467.182-.8.399-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.048 1.055-.059 1.37-.059 4.04s.01 2.986.059 4.04c.045.976.207 1.505.344 1.858.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.059 4.041.059s2.987-.01 4.041-.059c.976-.045 1.505-.207 1.858-.344.466-.182.8-.399 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.059-1.37.059-4.041s-.01-2.986-.059-4.04c-.045-.976-.207-1.505-.344-1.858a3.1 3.1 0 0 0-.748-1.15 3.1 3.1 0 0 0-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.055-.048-1.37-.059-4.041-.059M12 6.865a5.135 5.135 0 1 1 0 10.27 5.135 5.135 0 0 1 0-10.27m0 1.802a3.333 3.333 0 1 0 0 6.666 3.333 3.333 0 0 0 0-6.666m6.538-2.006a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className={ICON_CLASS} aria-hidden="true">
      <path d="M22 12.06C22 6.505 17.523 2 12 2S2 6.505 2 12.06c0 5.02 3.657 9.184 8.438 9.94v-7.03H7.898v-2.91h2.54V9.845c0-2.507 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562v1.878h2.773l-.443 2.91h-2.33V22c4.78-.756 8.437-4.92 8.437-9.94" />
    </svg>
  );
}

const LINKS = [
  { href: "https://x.com/rotaganyantr", label: "X (Twitter)", Icon: XIcon },
  { href: "https://www.instagram.com/rotaganyan/", label: "Instagram", Icon: InstagramIcon },
  { href: "https://www.facebook.com/profile.php?id=61593665895810", label: "Facebook", Icon: FacebookIcon },
] as const;

export default function SocialLinks({ className }: { className?: string }) {
  return (
    <div className={className ?? "flex items-center gap-2"}>
      {LINKS.map(({ href, label, Icon }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-muted-foreground/25 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Icon />
        </a>
      ))}
    </div>
  );
}
