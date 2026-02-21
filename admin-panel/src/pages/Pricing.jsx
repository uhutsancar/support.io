import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../contexts/LanguageContext';
import { Check, ArrowRight, Zap, Sparkles, Crown, Rocket } from 'lucide-react';
import Header from '../components/Header';

const Pricing = () => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  
  const langPrefix = language === 'en' ? '/en' : '';
  const routes = {
    register: `${langPrefix}/register`,
    home: langPrefix || '/'
  };
  const plans = t('pricingPage.plans', { returnObjects: true }) || [];
  const faqs = t('pricingPage.faqs', { returnObjects: true }) || [];

  return (
    <>
      <Helmet>
        <title>{`${t('pricing.title') || ''} - Support.io | ${t('pricing.subtitle') || ''}`}</title>
        <meta name="description" content={t('pricing.starter.description')} />
        <meta name="keywords" content="support.io fiyat, canlı sohbet fiyatlandırma, ücretsiz müşteri desteği, destek sistemi fiyat" />
        <link rel="canonical" href="https://support.io/fiyatlandirma" />
        <meta property="og:title" content={`${t('pricing.title')} - Support.io`} />
        <meta property="og:description" content={t('pricing.subtitle')} />
        <meta property="og:url" content="https://support.io/fiyatlandirma" />
      </Helmet>
      <div className="min-h-screen bg-white dark:bg-gray-900">
        <Header />
      
      <section className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            {t('pricingPage.title')}
          </h1>
          <p className="text-xl text-indigo-100 dark:text-indigo-200 max-w-3xl mx-auto">
            {t('pricingPage.subtitle')}
          </p>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {plans.map((plan, index) => (
              <div key={index} className={`rounded-2xl border-2 relative transform transition-all hover:scale-105 ${
                plan.popular 
                  ? 'border-indigo-500 dark:border-indigo-400 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 shadow-2xl scale-105' 
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg'
              }`}>
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
                    <span className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-2 rounded-full text-sm font-bold shadow-lg">
                      {plan.badge}
                    </span>
                  </div>
                )}
                
                <div className="p-8">
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-2">
                      {plan.name === 'Free' && <Rocket className={`w-6 h-6 ${
                        plan.popular 
                          ? 'text-indigo-600 dark:text-indigo-400' 
                          : 'text-gray-500 dark:text-gray-400'
                      }`} />}
                      {plan.name === 'Pro' && <Sparkles className={`w-6 h-6 ${
                        plan.popular 
                          ? 'text-indigo-600 dark:text-indigo-400' 
                          : 'text-gray-500 dark:text-gray-400'
                      }`} />}
                      {plan.name === 'Enterprise' && <Crown className={`w-6 h-6 ${
                        plan.popular 
                          ? 'text-indigo-600 dark:text-indigo-400' 
                          : 'text-gray-500 dark:text-gray-400'
                      }`} />}
                      <h3 className={`text-3xl font-bold ${
                        plan.popular 
                          ? 'text-indigo-900 dark:text-indigo-100' 
                          : 'text-gray-900 dark:text-white'
                      }`}>
                        {plan.name}
                      </h3>
                    </div>
                    <p className={`text-sm ${
                      plan.popular 
                        ? 'text-indigo-700 dark:text-indigo-300' 
                        : 'text-gray-600 dark:text-gray-300'
                    }`}>
                      {plan.description}
                    </p>
                  </div>
                  
                  <div className="mb-8">
                    <div className="flex items-baseline">
                      <span className={`text-5xl font-extrabold ${
                        plan.popular 
                          ? 'text-indigo-900 dark:text-indigo-100' 
                          : 'text-gray-900 dark:text-white'
                      }`}>
                        {plan.price}
                      </span>
                      {plan.period && (
                        <span className={`ml-2 text-xl ${
                          plan.popular 
                            ? 'text-indigo-700 dark:text-indigo-300' 
                            : 'text-gray-600 dark:text-gray-400'
                        }`}>
                          {plan.period}
                        </span>
                      )}
                    </div>
                    {plan.price === '₺0' || plan.price === '$0' ? (
                      <p className={`text-sm mt-2 ${
                        plan.popular 
                          ? 'text-indigo-600 dark:text-indigo-400' 
                          : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {language === 'tr' ? 'Sonsuza kadar ücretsiz' : 'Forever free'}
                      </p>
                    ) : null}
                  </div>

                  <Link
                    to={plan.link}
                    className={`block w-full py-4 px-6 rounded-xl font-bold text-center mb-8 transition-all shadow-lg ${
                      plan.popular
                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 transform hover:scale-105'
                        : plan.price === '₺0' || plan.price === '$0'
                        ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                    }`}
                  >
                    {plan.cta}
                  </Link>

                  <div className="border-t pt-6">
                    <ul className="space-y-3">
                      {plan.features && plan.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start">
                          <Check className={`w-5 h-5 mr-3 flex-shrink-0 mt-0.5 ${
                            plan.popular 
                              ? 'text-indigo-500 dark:text-indigo-400' 
                              : 'text-green-500 dark:text-green-400'
                          }`} />
                          <span className={`text-sm leading-relaxed ${
                            plan.popular 
                              ? 'text-indigo-900 dark:text-indigo-100' 
                              : 'text-gray-700 dark:text-gray-300'
                          }`}>
                            {feature}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-gray-50 dark:bg-gray-800 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              {t('pricingPage.featuresTitle')}
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              {t('pricingPage.featuresDescription')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { icon: '💬', title: 'Canlı Sohbet', desc: 'Gerçek zamanlı mesajlaşma' },
              { icon: '📊', title: 'Analitik', desc: 'Detaylı raporlar ve istatistikler' },
              { icon: '🔒', title: 'Security', desc: 'SSL şifreleme ve güvenlik' },
              { icon: '📱', title: 'Mobil Uyumlu', desc: 'Her cihazda mükemmel çalışır' },
              { icon: '⚡', title: 'Hızlı Kurulum', desc: '5 dakikada kurulum' },
              { icon: '🌍', title: 'Multi-site', desc: 'Birden fazla site yönetimi' }
            ].map((feature, index) => (
              <div key={index} className="text-center p-6">
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{feature.title}</h3>
                <p className="text-gray-600 dark:text-gray-300">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              {t('pricingPage.faqTitle')}
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              {t('pricingPage.faqDescription')}
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

      <section className="bg-indigo-600 text-white py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            {t('pricingPage.ctaTitle')}
          </h2>
          <p className="text-xl text-indigo-100 dark:text-indigo-200 mb-8">
            {t('pricingPage.ctaDescription')}
          </p>
          <Link
            to={routes.register}
            className="inline-flex items-center bg-white text-indigo-600 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-indigo-50 transition"
          >
            {t('pricingPage.ctaButton')}
            <ArrowRight className="ml-2 w-5 h-5" />
          </Link>
        </div>
      </section>

      <footer className="bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-gray-600 dark:text-gray-300">
            <Link to={routes.home} className="text-indigo-600 hover:text-indigo-700 font-medium">
              {t('pricingPage.backToHome')}
            </Link>
          </div>
        </div>
      </footer>
      </div>
    </>
  );
};

export default Pricing;