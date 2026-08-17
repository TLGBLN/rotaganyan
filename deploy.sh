#!/usr/bin/env bash
# KALICI ARAÇ — 2026-08-17, SİLİNMİYOR.
# Vercel'in Git entegrasyonu production deploy'u otomatik tetikliyor AMA rotaganyan.com
# özel alan adını otomatik güncellemiyor (bu oturumda ampirik test edildi: temiz `git push`
# sonrası otomatik build tamamlandı, domain eski deployment'ta kaldı — kök neden netleşene
# kadar bu script köprü görevi görüyor). Bu yüzden CLI deploy'unu ve alias adımını TEK
# komutta birleştirir — elle unutma riski ortadan kalkar.
#
# Kullanım: ./deploy.sh  (proje kökünden)
set -euo pipefail

echo "→ Vercel'e production deploy ediliyor..."
OUTPUT=$(npx vercel --prod --yes 2>&1)
echo "$OUTPUT"

DEPLOY_URL=$(echo "$OUTPUT" | grep -oE '"url":\s*"[^"]+"' | head -1 | sed -E 's/"url":\s*"([^"]+)"/\1/')

if [ -z "$DEPLOY_URL" ]; then
  echo "✗ Deploy URL'si çıktıdan bulunamadı — alias adımı ATLANDI, elle kontrol edin."
  exit 1
fi

echo "→ rotaganyan.com alias'ı $DEPLOY_URL adresine güncelleniyor..."
npx vercel alias set "$DEPLOY_URL" rotaganyan.com

echo "→ Doğrulanıyor..."
sleep 3
REMOTE_BUILD=$(curl -s https://rotaganyan.com/api/build-info | grep -oE '"buildId":\s*"[^"]+"' | sed -E 's/.*"([a-f0-9]+)"/\1/')
LOCAL_HEAD=$(git rev-parse HEAD)

if [ "$REMOTE_BUILD" = "$LOCAL_HEAD" ]; then
  echo "✓ rotaganyan.com güncel (buildId=$REMOTE_BUILD)"
else
  echo "✗ UYUŞMUYOR — site: $REMOTE_BUILD, HEAD: $LOCAL_HEAD — manuel kontrol gerekli"
  exit 1
fi
