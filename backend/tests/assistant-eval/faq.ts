// The FAQ of a made-up shop the evaluation asks about. Sent to the model in
// this order, so entry i is cited as `s${i + 1}`.

import type { FaqSource } from '../../src/services/assistant/knowledge';

export const SHOP = 'Örnek Mağaza';

const ENTRIES: Array<[string, string]> = [
  [
    'Kargo ne kadar sürede gelir?',
    'Siparişler 1-3 iş günü içinde kargoya verilir; teslimat genellikle 2-4 iş günü sürer.'
  ],
  [
    'Kargo ücreti ne kadar?',
    '500 TL ve üzeri siparişlerde kargo ücretsizdir; altındaki siparişlerde kargo ücreti 49,90 TL’dir.'
  ],
  [
    'İade nasıl yapılır?',
    'Ürünü teslim aldıktan sonra 14 gün içinde iade edebilirsiniz. İade kodunu https://ornekmagaza.example/iade sayfasından alırsınız.'
  ],
  [
    'Beden değişimi yapabilir miyim?',
    'Beden değişimi ücretsizdir; ürünü teslimattan itibaren 14 gün içinde değişim talebiyle geri gönderebilirsiniz.'
  ],
  [
    'Hangi ödeme yöntemlerini kabul ediyorsunuz?',
    'Kredi kartı, banka kartı, havale/EFT ve kapıda ödeme ile ödeme yapabilirsiniz.'
  ],
  [
    'Taksit yapıyor musunuz?',
    'Anlaşmalı bankaların kredi kartlarına 6 aya kadar taksit seçeneği sunuyoruz.'
  ],
  [
    'Siparişimi nasıl takip ederim?',
    'Kargo takip numaranız sipariş onay e-postasındadır; https://ornekmagaza.example/siparis-takip sayfasından da takip edebilirsiniz.'
  ],
  [
    'Siparişimi iptal edebilir miyim?',
    'Siparişiniz kargoya verilmeden önce Hesabım > Siparişlerim sayfasından iptal edebilirsiniz.'
  ],
  ['Ürünlerin garantisi var mı?', 'Elektronik ürünlerde 2 yıl üretici garantisi vardır.'],
  [
    'Müşteri hizmetleri hangi saatlerde çalışıyor?',
    'Müşteri hizmetlerimiz hafta içi 09:00-18:00 saatleri arasında hizmet verir.'
  ],
  ['Yurt dışına gönderim yapıyor musunuz?', 'Şu an yalnızca Türkiye içine gönderim yapıyoruz.'],
  ['Faturam nasıl gelir?', 'Faturanız e-arşiv fatura olarak e-posta adresinize gönderilir.']
];

export const FAQ: FaqSource[] = ENTRIES.map(([question, answer], i) => ({
  ref: `s${i + 1}`,
  faqId: `eval-${i + 1}`,
  question,
  answer
}));
