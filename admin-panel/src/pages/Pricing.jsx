import React from 'react';
import { Link } from 'react-router-dom';
import { Check, ArrowRight, Zap } from 'lucide-react';
import Header from '../components/Header';

const Pricing = () => {
  const plans = [
    {
      name: 'Başlangıç',
      price: 'Ücretsiz',
      description: 'Küçük işletmeler ve girişimciler için',
      features: [
        '1 site',
        '50 konuşma/ay',
        '1 operatör',
        'Temel widget',
        'E-posta desteği',
        'Sohbet geçmişi (30 gün)'
      ],
      cta: 'Hemen Başla',
      popular: false,
      link: '/register'
    },
    {
      name: 'Profesyonel',
      price: '₺299',
      period: '/ay',
      description: 'Büyüyen işletmeler için ideal',
      features: [
        '5 site',
        'Sınırsız konuşma',
        '5 operatör',
        'Özelleştirilebilir widget',
        'Öncelikli destek',
        'Sınırsız sohbet geçmişi',
        'Detaylı raporlar',
        'Otomatik yanıtlar',
        'API erişimi'
      ],
      cta: 'Şimdi Başla',
      popular: true,
      link: '/register'
    },
    {
      name: 'Kurumsal',
      price: '₺999',
      period: '/ay',
      description: 'Büyük organizasyonlar için',
      features: [
        'Sınırsız site',
        'Sınırsız konuşma',
        'Sınırsız operatör',
        'Özel widget tasarımı',
        '7/24 öncelikli destek',
        'Sınırsız sohbet geçmişi',
        'Gelişmiş analitik',
        'Özel entegrasyonlar',
        'Tam API erişimi',
        'SLA garantisi',
        'Özel sunucu seçeneği',
        'Eğitim ve danışmanlık'
      ],
      cta: 'İletişime Geç',
      popular: false,
      link: '/register'
    }
  ];

  const faqs = [
    {
      question: 'Kredi kartı bilgisi gerekli mi?',
      answer: 'Hayır, ücretsiz planı kullanmak için kredi kartı bilgisi gerekmez. İstediğiniz zaman ücretli planlara geçebilirsiniz.'
    },
    {
      question: 'Planımı değiştirebilir miyim?',
      answer: 'Evet, istediğiniz zaman planınızı yükseltebilir veya düşürebilirsiniz. Değişiklikler anında geçerli olur.'
    },
    {
      question: 'İptal politikanız nedir?',
      answer: 'İstediğiniz zaman iptal edebilirsiniz. Kalan süre için ücret iadesi yapılır.'
    },
    {
      question: 'Özel ihtiyaçlarım var, ne yapmalıyım?',
      answer: 'Kurumsal plan özelleştirilebilir. Özel ihtiyaçlarınız için bizimle iletişime geçin.'
    },
    {
      question: 'Ödeme yöntemleri nelerdir?',
      answer: 'Kredi kartı, banka kartı ve havale ile ödeme yapabilirsiniz.'
    },
    {
      question: 'Ücretsiz deneme süresi var mı?',
      answer: 'Ücretli planlar için 14 günlük ücretsiz deneme sunuyoruz. Kredi kartı ile başlayabilir, istediğiniz zaman iptal edebilirsiniz.'
    }
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <Header />
      
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Basit ve Şeffaf Fiyatlandırma
          </h1>
          <p className="text-xl text-indigo-100 dark:text-indigo-200 max-w-3xl mx-auto">
            İşletmenizin büyüklüğüne uygun planı seçin. Gizli ücret yok, dilediğiniz zaman iptal edebilirsiniz.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {plans.map((plan, index) => (
              <div 
                key={index}
                className={`rounded-2xl p-8 ${
                  plan.popular 
                    ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-2xl scale-105' 
                    : 'bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700'
                }`}
              >
                {plan.popular && (
                  <div className="flex items-center justify-center mb-4">
                    <span className="bg-yellow-400 text-indigo-900 px-4 py-1 rounded-full text-sm font-bold flex items-center">
                      <Zap className="w-4 h-4 mr-1" />
                      En Popüler
                    </span>
                  </div>
                )}

                <h3 className={`text-2xl font-bold mb-2 ${plan.popular ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                  {plan.name}
                </h3>
                <p className={`mb-6 ${plan.popular ? 'text-indigo-100' : 'text-gray-600 dark:text-gray-300'}`}>
                  {plan.description}
                </p>

                <div className="mb-6">
                  <span className={`text-5xl font-bold ${plan.popular ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span className={`text-lg ${plan.popular ? 'text-indigo-100' : 'text-gray-600 dark:text-gray-300'}`}>
                      {plan.period}
                    </span>
                  )}
                </div>

                <Link
                  to={plan.link}
                  className={`block w-full py-3 px-6 rounded-lg font-semibold text-center mb-8 transition ${
                    plan.popular
                      ? 'bg-white text-indigo-600 hover:bg-indigo-50'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  }`}
                >
                  {plan.cta}
                </Link>

                <ul className="space-y-4">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start">
                      <Check className={`w-5 h-5 mr-3 flex-shrink-0 ${
                        plan.popular ? 'text-green-300' : 'text-green-500 dark:text-green-400'
                      }`} />
                      <span className={plan.popular ? 'text-indigo-100' : 'text-gray-700 dark:text-gray-300'}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Comparison */}
      <section className="bg-gray-50 dark:bg-gray-800 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Tüm Planlar Şunları İçerir
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Temel özellikler tüm planlarda mevcuttur
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              'SSL güvenliği',
              'Mobil uyumlu',
              'Widget özelleştirme',
              'Anlık bildirimler',
              'Sohbet geçmişi',
              'Ziyaretçi bilgileri',
              'Çalışma saatleri',
              'Otomatik mesajlar'
            ].map((feature, index) => (
              <div key={index} className="flex items-center bg-white dark:bg-gray-700 p-4 rounded-lg shadow-sm">
                <Check className="w-5 h-5 text-green-500 dark:text-green-400 mr-3 flex-shrink-0" />
                <span className="text-gray-700 dark:text-gray-200">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Sıkça Sorulan Sorular
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Merak ettiğiniz her şey burada
            </p>
          </div>

          <div className="space-y-6">
            {faqs.map((faq, index) => (
              <div key={index} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {faq.question}
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  {faq.answer}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-indigo-600 text-white py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Hemen Başlamaya Hazır mısınız?
          </h2>
          <p className="text-xl text-indigo-100 dark:text-indigo-200 mb-8">
            14 gün boyunca tüm özellikleri ücretsiz deneyin. Kredi kartı gerekmez.
          </p>
          <Link
            to="/register"
            className="inline-flex items-center bg-white text-indigo-600 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-indigo-50 transition"
          >
            Ücretsiz Deneyin
            <ArrowRight className="ml-2 w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-gray-600 dark:text-gray-300">
            <Link to="/" className="text-indigo-600 hover:text-indigo-700 font-medium">
              Ana Sayfaya Dön
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Pricing;
