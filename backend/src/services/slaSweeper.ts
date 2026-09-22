'use strict';

// SLA arka plan süpürücüsü.
//
// SLA sayaçları zamana bağlıdır: her saniye "kalan süre" değişir. Daha önce bu
// hesap okuma yolunda yapılıyor ve sonucu her istekte veritabanına yazılıyordu —
// yani `GET /conversations/:siteId` tek çağrıda 50'ye kadar UPDATE üretiyordu.
// Bunun üç bedeli vardı:
//
//   * okuma isteği yazma yaptığı için okuma replikası kullanılamıyordu,
//   * aynı gelen kutusuna bakan iki temsilci aynı satırlarda kilit yarışına
//     giriyordu,
//   * `updated_at` "son değişiklik" değil "son görüntüleme" anlamına geliyordu.
//
// Artık okuma yolu SLA'yı yalnızca bellekte hesaplayıp gösterir; kalıcı hâle
// getirme ve ihlal bildirimi buraya taşındı. Süpürücü yalnızca vakti gelmiş
// konuşmalara dokunur (`next_sla_check_at`), dolayısıyla iş yükü açık ticket
// sayısıyla değil, gerçekten kontrol edilmesi gereken sayısıyla orantılıdır.

import Conversation from '../models/Conversation';
import type { Server } from 'socket.io';
import Site from '../models/Site';
import { sendSLAWarning, handleSLABreach } from './escalation';

const DEFAULT_INTERVAL_MS = 60 * 1000;

// Tek turda işlenecek üst sınır. Yığılma olursa sıradaki tur devam eder; tek
// seferde on binlerce satırı belleğe almak sunucuyu durdurur.
const DEFAULT_BATCH = 200;

let timer: NodeJS.Timeout | null = null;
let running = false;

// Bir tur: vakti gelmiş konuşmaları al, SLA'yı yeniden hesapla, durumu
// değiştiyse yaz, yeni ihlalleri bildir.
async function sweepOnce(io: Server, { batchSize = DEFAULT_BATCH }: { batchSize?: number } = {}) {
  // Kapanmış ticket'ların SLA saati işlemez.
  const due = await Conversation.find({
    status: { $in: ['open', 'unassigned', 'assigned', 'pending'] },
    nextSlaCheckAt: { $lte: new Date() }
  })
    .sort({ nextSlaCheckAt: 1 })
    .limit(batchSize);

  if (!due.length) return { checked: 0, written: 0, breached: 0 };

  let written = 0;
  let breached = 0;

  for (const conversation of due) {
    try {
      const before = {
        first: conversation.sla?.firstResponseStatus,
        resolution: conversation.sla?.resolutionStatus
      };

      conversation.calculateSLA();

      const after = {
        first: conversation.sla?.firstResponseStatus,
        resolution: conversation.sla?.resolutionStatus
      };

      // save() zaten değişmemiş alanları yazmaz; burada asıl kazanç, bu
      // döngünün istek başına değil dakikada bir çalışmasıdır.
      await conversation.save();
      written++;

      const newlyBreached =
        (before.first !== 'breached' && after.first === 'breached') ||
        (before.resolution !== 'breached' && after.resolution === 'breached');

      if (io) {
        if (newlyBreached) {
          breached++;
          // organizationId konuşmada tutulur; site aramasına gerek yok.
          let organizationId = conversation.organizationId;
          if (!organizationId) {
            const site = await Site.findById(conversation.siteId).select('organizationId');
            organizationId = site?.organizationId || null;
          }
          await handleSLABreach(conversation, organizationId, io);
        } else {
          // Eşiğe yaklaşanlar için uyarı; ihlal değilse sessizce geçer.
          await sendSLAWarning(conversation, io);
        }
      }
    } catch (error) {
      // Tek bir konuşmanın hatası turu durdurmamalı.
      console.error('SLA sweep hatası:', conversation._id, error.message);
    }
  }

  return { checked: due.length, written, breached };
}

function startSlaSweeper(
  io: Server,
  { intervalMs = Number(process.env.SLA_SWEEP_INTERVAL_MS) || DEFAULT_INTERVAL_MS }: { intervalMs?: number } = {}
): NodeJS.Timeout {
  if (timer) return timer;

  const tick = async () => {
    // Bir tur uzarsa üst üste binmesin.
    if (running) return;
    running = true;
    try {
      await sweepOnce(io);
    } catch (error) {
      console.error('SLA sweep turu başarısız:', error.message);
    } finally {
      running = false;
    }
  };

  tick();
  timer = setInterval(tick, intervalMs);
  if (timer.unref) timer.unref();
  return timer;
}

function stopSlaSweeper() {
  if (timer) clearInterval(timer);
  timer = null;
}

export { startSlaSweeper, stopSlaSweeper, sweepOnce };