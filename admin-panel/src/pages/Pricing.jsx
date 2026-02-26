import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../contexts/LanguageContext';
import {
  CheckCircle,
  HelpCircle,
  ArrowRight,
  Zap
} from 'lucide-react';
import Header from '../components/Header';

const Pricing = () => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const [isAnnual, setIsAnnual] = useState(true);

  const langPrefix = language === 'en' ? '/en' : '';
  const routes = {
    register: `${langPrefix}/register`,
    home: langPrefix || '/'
  };

  const starterFeatures = t('landing.pricing.starterFeatures', { returnObjects: true });
  const proFeatures = t('landing.pricing.proFeatures', { returnObjects: true });
  const enterpriseFeatures = t('landing.pricing.enterpriseFeatures', { returnObjects: true });

  const plans = [
    {
      name: t('landing.pricing.plans.starter.name', 'Starter'),
      description: t('landing.pricing.plans.starter.description', 'Küçük ekipler için ideal başlangıç planı.'),
      price: isAnnual ? '4.990' : '499',
      period: isAnnual ? '/yıl' : '/ay',
      isPopular: false,
      features: Array.isArray(starterFeatures) ? starterFeatures : [
        '5 Operatör',
        'Sınırsız Canlı Sohbet',
        'Temel Analitik',
        '100 Temel Entegrasyon',
        'E-posta Desteği',
        '14 Gün Kayıt Geçmişi'
      ]
    },
    {
      name: t('landing.pricing.plans.pro.name', 'Pro'),
      description: t('landing.pricing.plans.pro.description', 'Hızla büyüyen profesyonel ekipler için.'),
      price: isAnnual ? '9.990' : '999',
      period: isAnnual ? '/yıl' : '/ay',
      isPopular: true,
      features: Array.isArray(proFeatures) ? proFeatures : [
        'Sınırsız Operatör',
        'Gelişmiş Yapay Zeka Botları',
        'Derinlemesine Analitik & Raporlama',
        'Sınırsız Entegrasyon + API Erişimi',
        'Öncelikli 7/24 Destek',
        'Sınırsız Kayıt Geçmişi',
        'Çoklu Dil Desteği'
      ]
    },
    {
      name: t('landing.pricing.plans.enterprise.name', 'Enterprise'),
      description: t('landing.pricing.plans.enterprise.description', 'Büyük ölçekli işletmeler için özel çözümler.'),
      price: t('landing.pricing.customTitle'),
      period: '',
      isPopular: false,
      features: Array.isArray(enterpriseFeatures) ? enterpriseFeatures : [
        'Özel Yapay Zeka Modelleri',
        'On-Premise Kurulum Seçeneği',
        'SLA Garantisi',
        'Özel Müşteri Başarı Yöneticisi',
        'Gelişmiş Güvenlik ve Uyumluluk',
        'White-label Özelleştirme'
      ]
    }
  ];

  const faqs = [
    {
      question: t('landing.pricing.faq.q1', 'Kredi kartı gerekli mi?'),
      answer: t('landing.pricing.faq.a1', 'Hayır, 14 günlük ücretsiz deneme sürümümüz için kredi kartı gerekmez. Sadece e-posta adresinizle kayıt olabilirsiniz.')
    },
    {
      question: t('landing.pricing.faq.q2', 'Planımı daha sonra değiştirebilir miyim?'),
      answer: t('landing.pricing.faq.a2', 'Evet, istediğiniz zaman planlar arasında geçiş yapabilirsiniz. Değişiklik yaptığınızda kullanım sürenize göre oranlanmış bir fiyatlandırma uygulanır.')
    },
    {
      question: t('landing.pricing.faq.q3', 'Sözleşme taahhüdü var mı?'),
      answer: t('landing.pricing.faq.a3', 'Yıllık planlar dışında herhangi bir taahhüt yoktur. Aylık planlarda istediğiniz zaman iptal edebilirsiniz.')
    },
    {
      question: t('landing.pricing.faq.q4', 'Özelleştirilmiş bir plana ihtiyacım var, ne yapmalıyım?'),
      answer: t('landing.pricing.faq.a4', 'Büyük ekipler veya özel ihtiyaçlar için Enterprise planımızı inecleyebilirsiniz. Detaylar için satış ekibimizle iletişime geçin.')
    }
  ];

  return (
    <>
      <Helmet>
        <title>{`${t('pricing.title') || 'Fiyatlandırma'} - Support.io`}</title>
        <meta name="description" content="Support.io için şeffaf fiyatlandırma planları. İhtiyacınıza uygun planı seçin." />
      </Helmet>

      <div className="min-h-screen bg-gray-50 dark:bg-brand-dark overflow-hidden font-sans text-gray-900 dark:text-gray-100 transition-colors duration-300">
        <Header />

        <main className="pt-32 pb-24">
          {/* Header */}
          <section className="relative px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center mb-16 z-10">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-purple-600/20 blur-[120px] rounded-full pointer-events-none -z-10 animate-blob"></div>

            <h1
              className="text-4xl sm:text-5xl md:text-6xl font-extrabold leading-[1.1] mb-6 tracking-tight text-gray-900 dark:text-white"
              dangerouslySetInnerHTML={{ __html: `${t('landing.pricing.title1')} <span class="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-purple-400 dark:to-indigo-500">${t('landing.pricing.title2')}</span>` }}
            />

            <p className="text-lg md:text-xl text-gray-600 dark:text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
              {t('landing.pricing.desc')}
            </p>

            {/* Billing Toggle */}
            <div className="flex items-center justify-center gap-4 mb-16">
              <span className={`text-sm font-medium ${!isAnnual ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                {t('landing.pricing.monthly')}
              </span>
              <button
                onClick={() => setIsAnnual(!isAnnual)}
                className="w-16 h-8 bg-gray-200 dark:bg-gray-800 rounded-full p-1 transition-colors duration-300 relative focus:outline-none border border-gray-300 dark:border-gray-700 hover:border-indigo-400 dark:hover:border-indigo-500"
              >
                <div
                  className={`w-6 h-6 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full shadow-md transition-transform duration-300 transform ${isAnnual ? 'translate-x-8' : 'translate-x-0'
                    }`}
                />
              </button>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-medium ${isAnnual ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                  {t('landing.pricing.yearly')}
                </span>
                <span className="bg-green-500/20 text-green-400 text-xs font-bold px-2 py-1 rounded-full border border-green-500/30">
                  {t('landing.pricing.discount')}
                </span>
              </div>
            </div>
          </section>

          {/* Pricing Cards */}
          <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto relative z-10 mb-32">
            <div className="grid lg:grid-cols-3 gap-8 items-start">
              {plans.map((plan, index) => (
                <div
                  key={index}
                  className={`relative bg-brand-card rounded-3xl p-8 transition-all duration-300 ${plan.isPopular
                    ? 'scale-105 border-indigo-500 shadow-[0_0_40px_rgba(99,102,241,0.2)] z-20 border-2'
                    : 'border border-gray-800 hover:border-gray-600 hover:-translate-y-1'
                    }`}
                >
                  {plan.isPopular && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                      <span className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg flex items-center gap-1">
                        <Zap className="w-3 h-3" />
                        {t('landing.pricing.popular')}
                      </span>
                    </div>
                  )}

                  <div className="mb-8">
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{plan.name}</h3>
                    <p className="text-gray-500 dark:text-gray-400 text-sm h-10">{plan.description}</p>
                  </div>

                  <div className="mb-8 pb-8 border-b border-gray-100 dark:border-gray-800">
                    <div className="flex items-end gap-1 mb-1">
                      {plan.price !== t('landing.pricing.customTitle') && <span className="text-2xl font-semibold text-gray-400 dark:text-gray-300">₺</span>}
                      <span className="text-5xl font-extrabold text-gray-900 dark:text-white tracking-tight">{plan.price}</span>
                    </div>
                    <div className="text-gray-500 text-sm mt-1">
                      {plan.price !== t('landing.pricing.customTitle') ? (isAnnual ? t('landing.pricing.billedYearly') : t('landing.pricing.billedMonthly')) : t('landing.pricing.customDesc')}
                    </div>
                  </div>

                  <ul className="space-y-4 mb-8">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-start text-sm text-gray-600 dark:text-gray-300">
                        <CheckCircle className="w-5 h-5 text-indigo-500 dark:text-indigo-400 mr-3 flex-shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Link
                    to={plan.price === t('landing.pricing.customTitle') ? routes.home : routes.register}
                    className={`w-full py-4 rounded-xl font-bold flex items-center justify-center transition-all ${plan.isPopular
                      ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.4)]'
                      : 'bg-white/5 hover:bg-white/10 text-white border border-gray-700'
                      }`}
                  >
                    {plan.price === t('landing.pricing.customTitle') ? t('landing.pricing.btnSales') : t('landing.pricing.btnStart')}
                  </Link>
                </div>
              ))}
            </div>
          </section>

          {/* Logo cloud */}
          <section className="py-12 border-y border-gray-200 dark:border-gray-800/50 bg-gray-50/50 dark:bg-[#0B0D17]/50 mb-32">
            <div className="max-w-7xl mx-auto px-4 text-center">
              <p className="text-sm text-gray-500 font-medium mb-8">{t('landing.pricing.trustedBy')}</p>
              <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 opacity-50 grayscale hover:grayscale-0 transition-opacity">
                <span className="text-2xl font-bold font-serif text-gray-900 dark:text-white">VOLTIFY</span>
                <span className="text-2xl font-bold font-serif text-gray-900 dark:text-white">ZENITH</span>
                <span className="text-2xl font-bold font-serif text-gray-900 dark:text-white">NEXUS</span>
              </div>
            </div>
          </section>

          {/* FAQ section */}
          <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">{t('landing.pricing.faqTitle')}</h2>
              <p className="text-gray-600 dark:text-gray-400 text-lg">{t('landing.pricing.faqDesc')}</p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
              {faqs.map((faq, index) => (
                <div key={index}>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-start gap-3 mb-3">
                    <HelpCircle className="w-5 h-5 text-indigo-500 dark:text-indigo-400 flex-shrink-0 mt-0.5" />
                    {faq.question}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-sm ml-8">
                    {faq.answer}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </main>

        <footer className="bg-gray-100 dark:bg-[#0A0A0C] border-t border-gray-200 dark:border-gray-800/80 pt-10 pb-10 text-center" role="contentinfo">
          <Link to={routes.home} className="inline-flex items-center text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-semibold mb-6">
            <ArrowRight className="w-4 h-4 mr-2 rotate-180" />
            {t('landing.pricing.backHome')}
          </Link>
          <p className="text-gray-500 text-sm">{t('landing.pricing.footerCopyright')}</p>
        </footer>
      </div>
    </>
  );
};

export default Pricing;