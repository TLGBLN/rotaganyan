# Kilo artığı denetimi — handikap puanı ile −0,73 korelasyonun nedeni
**Salt-okuma veri denetimi; sinyal/model yok.** 1398 handikap yarışı (≥6 atın hem kilosu hem hp'si var), 15715 at.

## 1. Yarış içi kilo–hp eğimi (kg / hp puanı)
TJK kuralı: en yüksek puanlı ata göre diğerlerinin kilosu her puan için **0,5 kg** azalır → beklenen eğim 0,5. **Gözlenen yarış-içi OLS eğimi:** medyan 0.372, p10 0.232, p90 0.500; ortalama 0.372. Eğimi 0,45–0,55 arasında olan yarış payı %19.6. Yarış içi r(kilo, hp) medyan 0.922. Yarışın en düşük kilosunu taşıyan at payı (taban kilosu yığılması) ortalama %15.2.

## 2. Çalışmadaki tanımın yeniden üretimi ve cebirsel neden
Havuzlanmış yarış-içi: **r(kilo artığı, hp) = -0.728**, r(W_göreli, hp) = 0.867; havuzlanmış eğim b = 0.310 kg/puan.
**Neden:** artık = W_göreli − 0,5·ΔHP = (b − 0,5)·ΔHP + e (e: eğimin açıklamadığı sapma). Gözlenen b = 0.310 < 0,5 olduğu için artık ile hp doğrudan **negatif** ilişkilidir. Yani −0,73, 'kilo artığı'nın tanımının kendisinden gelir: formüldeki 0,5 eğimini sabit kabul edince, gerçek eğim daha düşük olduğunda hp'nin ters işaretli bir kopyası kalır. Bu 'sinyal' değil hesap artefaktıdır; kontrollü modelde hp zaten bulunduğundan ek katkısı belirsiz çıkması beklenir (bulunan +0,28 sınırda).

## 3. Eğim neden 0,5'ten küçük? Ayrıştırma
**(a) Eğim, yarış gruplarına göre:**
| Grup | n yarış | Havuzlanmış eğim | r(kilo, hp) |
|---|---|---|---|
| Tümü | 1398 | 0.310 | 0.867 |
| H13–14 | 353 | 0.337 | 0.848 |
| H15–16 | 886 | 0.299 | 0.868 |
| H17+ | 159 | 0.355 | 0.904 |
| kısa (≤1300) | 286 | 0.306 | 0.865 |
| orta (1400–1900) | 755 | 0.315 | 0.869 |
| uzun (≥2000) | 357 | 0.304 | 0.862 |
| hp aralığı ≤8 | 28 | 0.534 | 0.753 |
| hp aralığı >8 | 1370 | 0.310 | 0.867 |

**(b) Taban kilosu (en düşük kilo) yığılması:** Düşük puanlı atların hepsi aynı alt sınır kilosunu taşıyorsa (kilo hp ile daha fazla azalamaz) eğim yapay olarak düşer. Taban kilosunda olan atlar dışarıda bırakılınca eğim:
taban kilosundakiler hariç havuzlanmış eğim = **0.341** (n at 13341); r(kilo, hp) = 0.863.

## 4. Resmi formüle göre sapma (en yüksek puanlı atı referans alınca)
Sapma = W − [W_üst − 0,5·(HP_üst − HP)]. Tam 0 olan at payı %36.3; medyan 0.00; p05 -2.5, p95 6.0 kg.
| Grup | n at | Ort. sapma (kg) | Pozitif (>0) payı | Negatif (<0) payı |
|---|---|---|---|---|
| 3 yaşlı | 3997 | 0.88 | %37.6 | %17.3 |
| 4 yaşlı | 7165 | 1.27 | %48.6 | %18.7 |
| 5+ yaşlı | 4110 | 1.42 | %54.5 | %12.7 |
| yaş bilinmiyor | 301 | 1.54 | %53.5 | %16.9 |
| üstten 0 puan geride (üst grup) | 1724 | -0.24 | %0.0 | %11.9 |
| üstten 1–3 puan geride | 1892 | 0.03 | %31.6 | %30.3 |
| üstten 4–8 puan geride | 3451 | 0.45 | %40.2 | %23.0 |
| üstten >8 puan geride | 8648 | 2.05 | %62.7 | %12.0 |

## Sonuç ve öneri
1. **−0,73'ün nedeni cebirsel:** kilo artığı tanımı eğimi 0,5 kg/puan sabitler; gözlenen eğim daha düşük olduğundan artık, hp'nin ters işaretli bir kopyasına dönüşür. Eğimin düşüklüğü (bölüm 1–3): taban kilosu yığılması farkın yalnızca küçük bir kısmını açıklıyor (taban kilosundakiler çıkarılınca eğim 0,31 → 0,34; 0,5'e hâlâ uzak); eğim hp farkı küçük yarışlarda (≤8 puan) 0,53'e çıkıyor ve sapma, üstten uzak atlarda belirgin biçimde pozitif (düşük puanlı atlar formülün öngördüğünden fazla kilo taşıyor, +2,05 kg). Yani asıl kaynak başka (hp ölçeğinin/resmi hesabın farklı uygulanması, indirimler, alt sınır kuralları olabilir); **hangisi olduğu bu veriyle ayrıştırılamadı**, bu bir tahmin değil gözlemdir.
2. **Bu tanımla 'kilo artığı' sinyal olarak değerlendirilmemelidir.** Temiz bir artık için eğim sabit 0,5 yerine yarış içinde veriden (hp'ye göre) tahmin edilmeli veya formüle tam uyan bir referans (üst puanlı atın kilosu) kullanılmalı; bu bir sonraki adımdır ve henüz yapılmadı (yeni formül seçmeden önce kullanıcı onayı).
3. Apranti indirimi, yaş/cinsiyet ve mesafe indirimleri kilo sapmasında karışıktır; apranti bayrağı verisi olmadan ayrıştırılamaz.