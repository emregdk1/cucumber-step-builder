# Cucumber Step Builder

Tek dosyalık (inline) dağıtım için optimize edilmiş React + Vite uygulaması.

## Geliştirme
```
npm install
npm run dev
```

## Build Seçenekleri
- `npm run build:single` : `dist/index.html` içine CSS+JS inline edilir. `assets/` klasörü bırakılır (gerekirse debug için).
- `npm run build:single:clean` : Inline + `assets/` silinir.
- `npm run build:single:minimal` : Inline + yedek yok + `assets/` silinir.

## Netlify
`netlify.toml` dosyası build sürecini sabitler.

```
[build]
  command = "npm run build:single"
  publish = "dist"
```

Yayınlanan `dist/index.html` boyutunun ~280KB+ olması gerekir. Eğer yalnızca ~0.4KB ise inline aşaması çalışmamıştır.

## Sorun Giderme (Beyaz Ekran)
1. Konsolda `[boot-error]` var mı bak.
2. View Source ile dosya uzun mu kısa mı kontrol et.
3. Deploy log'unda `Inlined dist/index.html` satırı görünüyor olmalı.

## Lisans
Internal.
