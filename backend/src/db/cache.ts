'use strict';

// Kisa omurlu okuma onbellegi.
//
// Redis tanimliysa kullanilir, degilse her cagri dogrudan kaynaga gider ve
// hicbir sey bozulmaz. Onbellek bir hizlandirmadir, dogruluk kosulu degildir:
// Redis dustugunde istek yavaslar ama yanit yine dogrudur.
//
// Yalnizca "biraz eski olmasi sorun olmayan" toplamlar icindir. Konusmanin
// kendisi, mesajlar veya yetki kararlari asla buradan okunmaz.

// Ayni anda gelen ayni istekleri tek cagriya indirir. Onbellek bos oldugunda
// 30 temsilcinin ayni saniyede gelen kutusunu acmasi, ayni sorgunun 30 kez
// calismasi demekti; ilk cagri hesaplarken digerleri onu bekler.
import { getRedisClient, isEnabled } from '../config/redis';

const inFlight = new Map<string, Promise<unknown>>();

async function cached<T>(
  key: string,
  ttlSeconds: number,
  produce: () => Promise<T> | T
): Promise<T> {
  if (!isEnabled()) return produce();

  const client = await getRedisClient();
  if (!client) return produce();

  try {
    const hit = await client.get(key);
    if (hit !== null) return JSON.parse(hit);
  } catch {
    // Okunamayan onbellek, onbellek yokmus gibi ele alinir.
  }

  if (inFlight.has(key)) return inFlight.get(key) as Promise<T>;

  const pending = (async () => {
    const value = await produce();
    try {
      await client.set(key, JSON.stringify(value), { EX: ttlSeconds });
    } catch {
      // Yazilamamasi yalnizca bir sonraki cagrinin da hesaplamasi demektir.
    }
    return value;
  })().finally(() => inFlight.delete(key));

  inFlight.set(key, pending);
  return pending;
}

export { cached };
