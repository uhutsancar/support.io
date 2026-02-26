import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../contexts/LanguageContext';
import {
  MessageSquare,
  Zap,
  Users,
  BarChart,
  Clock,
  Shield,
  CheckCircle,
  Play,
  ArrowRight,
  MoreHorizontal
} from 'lucide-react';
import Header from '../components/Header';
import logo from '../public/support.io_logo.webp';

const Home = () => {
  const { t } = useTranslation();
  const { language } = useLanguage();

  const langPrefix = language === 'en' ? '/en' : '';
  const routes = {
    home: langPrefix || '/',
    features: language === 'en' ? '/en/features' : '/ozellikler',
    pricing: language === 'en' ? '/en/pricing' : '/fiyatlandirma',
    docs: language === 'en' ? '/en/documentation' : '/dokumantasyon',
    about: language === 'en' ? '/en/about' : '/hakkimizda',
    login: `${langPrefix}/login`,
    register: `${langPrefix}/register`,
    dashboard: `${langPrefix}/dashboard`
  };

  const features = [
    {
      icon: MessageSquare,
      title: t('home.features.realtime.title') || 'Canlı Sohbet',
      description: t('home.features.realtime.description') || 'Müşterilerinizle anlık olarak iletişime geçin. Hızlı ve etkili destek sağlayarak cevap verme sürenizi %38 artırın.',
      points: [t('home.features.realtime.point1', 'Gerçek zamanlı yazıyor göstergesi'), t('home.features.realtime.point2', 'Dosya ve fotoğraf paylaşımı')]
    },
    {
      icon: Zap,
      title: t('home.features.ai.title') || 'Hızlı Yanıtlar & Botlar',
      description: t('home.features.ai.description') || 'Sık sorulan soruları otomatik yanıtlayarak zamandan tasarruf edin. Akıllı bot sistemi ile 7/24 hizmet verin.',
      points: [t('home.features.ai.point1', 'Hazır şablon kütüphanesi'), t('home.features.ai.point2', 'Mesai dışı otomatik mesajlar')]
    },
    {
      icon: BarChart,
      title: t('home.features.analytics.title') || 'Detaylı Analitik',
      description: t('home.features.analytics.description') || 'Müşteri etkileşimlerinizi detaylı olarak analiz edin. Performansınızı ölçün ve ekibinizi optimize edin.',
      points: [t('home.features.analytics.point1', 'Operatör performans takibi'), t('home.features.analytics.point2', 'Müşteri memnuniyet anketleri')]
    }
  ];

  return (
    <>
      <Helmet>
        <title>{t('landing.home.metaTitle', 'Support.io - Modern Müşteri Destek ve Canlı Sohbet Sistemi')}</title>
        <meta name="description" content={t('landing.home.heroDesc')} />
      </Helmet>

      <div className="min-h-screen bg-gray-50 dark:bg-brand-dark overflow-hidden font-sans text-gray-900 dark:text-gray-100 transition-colors duration-300">
        <Header />

        <main role="main" className="pt-24 md:pt-32">
          {/* Hero Section */}
          <section className="relative px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto z-10 pt-10">
            {/* Background Blob */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] md:w-[800px] h-[600px] bg-purple-700/20 blur-[120px] rounded-full pointer-events-none -z-10 animate-blob"></div>

            <div className="grid lg:grid-cols-2 gap-12 items-center min-h-[60vh]">
              <div className="flex flex-col items-start text-left">
                <div className="inline-block px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-medium text-xs md:text-sm mb-6 flex items-center shadow-[0_0_15px_rgba(99,102,241,0.2)]">
                  <span className="w-2 h-2 bg-indigo-500 rounded-full mr-2 animate-pulse"></span>
                  {t('landing.home.badge')}
                </div>

                <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold leading-[1.1] mb-6 tracking-tight text-gray-900 dark:text-white">
                  {t('landing.home.heroTitle1')} <br className="hidden md:block" /> {t('landing.home.heroTitle2')} <br className="hidden md:block" />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 dark:from-indigo-400 dark:via-purple-400 dark:to-indigo-500">
                    {t('landing.home.heroTitle3')}
                  </span> <br className="hidden md:block" /> {t('landing.home.heroTitle4')}
                </h1>

                <p className="text-lg md:text-xl text-gray-600 dark:text-gray-400 mb-8 max-w-xl leading-relaxed">
                  {t('landing.home.heroDesc')}
                </p>

                <div className="flex flex-col sm:flex-row gap-4 mb-10 w-full md:w-auto">
                  <Link
                    to={routes.register}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all shadow-[0_0_20px_rgba(99,102,241,0.4)] hover:shadow-[0_0_30px_rgba(99,102,241,0.6)] flex items-center justify-center w-full sm:w-auto"
                  >
                    {t('landing.home.btnStart')}
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Link>
                  <button
                    className="bg-white border border-gray-300 hover:border-gray-400 hover:bg-gray-50 text-gray-800 dark:bg-transparent dark:border-gray-600 dark:hover:border-gray-400 dark:hover:bg-gray-800 dark:text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all flex items-center justify-center w-full sm:w-auto"
                  >
                    <Play className="w-5 h-5 mr-2 text-indigo-500 dark:text-white" />
                    {t('landing.home.btnDemo')}
                  </button>
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-400">
                  <div className="flex -space-x-2">
                    <div className="w-8 h-8 rounded-full border-2 border-brand-dark bg-indigo-400 flex items-center justify-center overflow-hidden"><img src="https://i.pravatar.cc/100?img=1" alt="avatar" /></div>
                    <div className="w-8 h-8 rounded-full border-2 border-brand-dark bg-purple-400 flex items-center justify-center overflow-hidden"><img src="https://i.pravatar.cc/100?img=2" alt="avatar" /></div>
                    <div className="w-8 h-8 rounded-full border-2 border-brand-dark bg-green-400 flex items-center justify-center overflow-hidden"><img src="https://i.pravatar.cc/100?img=3" alt="avatar" /></div>
                  </div>
                  <span className="text-gray-600 dark:text-gray-400 font-medium">{t('landing.home.trustedBy')}</span>
                </div>
              </div>

              {/* Chat Interface Mockup */}
              <div className="relative animate-float mt-12 lg:mt-0 lg:ml-10 hidden md:block">
                <div className="rounded-2xl border border-gray-200 dark:border-gray-700/50 bg-white/90 dark:bg-brand-card/80 backdrop-blur-xl shadow-2xl overflow-hidden p-6 max-w-lg ml-auto relative">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 blur-3xl rounded-full"></div>

                  <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100 dark:border-gray-700/50 relative z-10">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-[0_0_15px_rgba(99,102,241,0.5)] border-2 border-indigo-400/30">
                        S
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white text-lg">{t('landing.home.team')}</h4>
                        <p className="text-xs text-green-400 flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                          {t('landing.home.replyTime')}
                        </p>
                      </div>
                    </div>
                    <div className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full cursor-pointer transition">
                      <MoreHorizontal className="text-gray-500 dark:text-gray-400 w-5 h-5" />
                    </div>
                  </div>

                  <div className="space-y-5 mb-4 relative z-10">
                    <div className="flex gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-[0_0_15px_rgba(99,102,241,0.3)] flex-shrink-0">
                        S
                      </div>
                      <div className="bg-gray-100 dark:bg-gray-800/80 rounded-2xl rounded-tl-none p-4 text-sm text-gray-800 dark:text-gray-200 shadow-sm border border-gray-200 dark:border-gray-700/50">
                        {t('landing.home.msg1')}
                      </div>
                    </div>

                    <div className="flex gap-3 justify-end">
                      <div className="bg-indigo-600 rounded-2xl rounded-tr-none p-4 text-sm text-white shadow-md">
                        {t('landing.home.msg2')}
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-[0_0_15px_rgba(99,102,241,0.3)] flex-shrink-0">
                        S
                      </div>
                      <div className="bg-gray-100 dark:bg-gray-800/80 rounded-2xl rounded-tl-none p-4 text-sm text-gray-800 dark:text-gray-200 shadow-sm border border-gray-200 dark:border-gray-700/50">
                        {t('landing.home.msg3')}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="py-12 border-y border-gray-200 dark:border-gray-800/50 mt-12 bg-gray-50/50 dark:bg-white/5 relative z-10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
              <p className="text-xs font-bold tracking-[0.2em] text-gray-500 mb-8 uppercase">
                {t('landing.home.brands')}
              </p>
              <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
                {['VOLTIFY', 'ZENITH', 'NEXUS', 'cloudbase', 'FLOW'].map((logoText, i) => (
                  <div key={i} className="text-2xl font-bold tracking-wider font-serif text-gray-900 dark:text-white">{logoText}</div>
                ))}
              </div>
            </div>
          </section>

          {/* Features Grid */}
          <section className="py-24 relative z-10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-16">
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
                  {t('landing.home.featuresTitle')}
                </h2>
                <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto text-lg leading-relaxed">
                  {t('landing.home.featuresDesc')}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {features.map((feature, index) => (
                  <div
                    key={index}
                    className="bg-white/80 dark:bg-brand-card/50 backdrop-blur-md rounded-2xl p-8 border border-gray-200 dark:border-gray-800 hover:border-indigo-400 dark:hover:border-indigo-500/50 transition-all duration-300 group hover:-translate-y-1 hover:shadow-[0_10px_40px_-15px_rgba(99,102,241,0.5)] relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl group-hover:bg-indigo-500/10 transition-colors"></div>

                    <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 w-12 h-12 rounded-xl flex items-center justify-center mb-6 group-hover:from-indigo-500/20 group-hover:to-purple-500/20 transition-colors">
                      <feature.icon className="w-6 h-6 text-indigo-400 group-hover:text-indigo-300" />
                    </div>

                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3 tracking-tight">
                      {feature.title}
                    </h3>

                    <p className="text-gray-600 dark:text-gray-400 mb-8 text-sm leading-relaxed min-h-[60px]">
                      {feature.description}
                    </p>

                    <ul className="space-y-3 mt-auto border-t border-gray-800/50 pt-6">
                      {feature.points.map((pt, idx) => (
                        <li key={idx} className="flex items-center text-sm text-gray-700 dark:text-gray-300">
                          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mr-3 shadow-[0_0_5px_rgba(99,102,241,0.8)]"></div>
                          {pt}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Integration Stats / Code preview */}
          <section className="py-24 relative z-10 border-t border-gray-200 dark:border-gray-800/50 bg-gray-50/50 dark:bg-[#0B0D17]/50">
            <div className="absolute inset-0 bg-gradient-to-b from-white dark:from-brand-dark to-transparent -z-10"></div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid lg:grid-cols-2 gap-16 items-center">
                <div className="order-2 lg:order-1">
                  <h2
                    className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-6 leading-[1.2]"
                    dangerouslySetInnerHTML={{ __html: t('landing.home.integrateTitle') }}
                  />
                  <p className="text-lg text-gray-600 dark:text-gray-400 mb-10 leading-relaxed max-w-lg">
                    {t('landing.home.integrateDesc')}
                  </p>

                  <div className="space-y-8 max-w-lg">
                    <div className="flex gap-4 items-start">
                      <div className="mt-1 flex-shrink-0 w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center border border-green-500/20 shadow-[0_0_15px_rgba(34,197,94,0.15)]">
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-2 text-lg">{t('landing.home.fastSetup')}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{t('landing.home.fastSetupDesc')}</p>
                      </div>
                    </div>

                    <div className="flex gap-4 items-start">
                      <div className="mt-1 flex-shrink-0 w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center border border-green-500/20 shadow-[0_0_15px_rgba(34,197,94,0.15)]">
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-2 text-lg">{t('landing.home.zeroLag')}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{t('landing.home.zeroLagDesc')}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="order-1 lg:order-2">
                  <div className="bg-white dark:bg-[#151724] rounded-2xl border border-gray-200 dark:border-gray-700/50 shadow-2xl relative overflow-hidden group hover:border-indigo-400 dark:hover:border-indigo-500/30 transition-colors">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>

                    {/* Window Controls */}
                    <div className="h-12 bg-gray-50 dark:bg-[#0B0D17] border-b border-gray-200 dark:border-gray-800/80 flex items-center px-4 relative z-10">
                      <div className="flex gap-2">
                        <div className="w-3 h-3 rounded-full bg-[#FF5F56] border border-[#E0443E]"></div>
                        <div className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123]"></div>
                        <div className="w-3 h-3 rounded-full bg-[#27C93F] border border-[#1AAB29]"></div>
                      </div>
                      <div className="absolute left-1/2 -translate-x-1/2 text-xs text-gray-500 font-mono">index.html</div>
                    </div>

                    {/* Code Editor Content */}
                    <div className="p-6 md:p-8 overflow-x-auto text-sm md:text-base font-mono leading-relaxed relative z-10">
                      <div className="text-gray-500 mb-4">{'<!-- Support.io Widget Integration -->'}</div>
                      <div className="text-pink-400 mb-1">{'<script>'}</div>
                      <div className="text-gray-300 ml-4 mb-1">{'window.'}<span className="text-blue-400">supportioConfig</span>{' = {'}</div>
                      <div className="ml-8 mb-1"><span className="text-purple-300">siteId:</span> <span className="text-green-300">"your-unique-site-id"</span><span className="text-gray-300">,</span></div>
                      <div className="ml-8 mb-1"><span className="text-purple-300">theme:</span> <span className="text-green-300">"modern-dark"</span><span className="text-gray-300">,</span></div>
                      <div className="ml-8 mb-1"><span className="text-purple-300">position:</span> <span className="text-green-300">"bottom-right"</span></div>
                      <div className="text-gray-300 ml-4 mb-1">{'};'}</div>
                      <div className="text-pink-400 mb-4">{'</script>'}</div>

                      <div>
                        <span className="text-pink-400">{'<script '}</span>
                        <span className="text-purple-300">{'src='}</span>
                        <span className="text-green-300">{'"https://cdn.support.io/widget.js"'}</span>
                        <span className="text-pink-400">{'></script>'}</span>
                      </div>
                    </div>

                    {/* Editor Footer */}
                    <div className="border-t border-gray-200 dark:border-gray-800/80 bg-gray-50 dark:bg-[#1A1C28] p-4 flex justify-between items-center relative z-10">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)]"></div>
                        <span className="text-gray-400 text-xs">{t('landing.home.active')}</span>
                      </div>
                      <button className="bg-indigo-600/20 hover:bg-indigo-600 border border-indigo-500/50 text-indigo-300 hover:text-white text-xs px-4 py-2 rounded-lg font-medium transition-all">
                        {t('landing.home.copyCode')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* CTA Section */}
          <section className="py-24 relative px-4 text-center">
            <div className="max-w-6xl mx-auto bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 rounded-[2.5rem] p-12 md:p-24 shadow-2xl relative overflow-hidden bg-[length:200%_auto] animate-[gradient_8s_linear_infinite]">
              {/* Abstract shapes */}
              <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-[80px] mix-blend-overlay pointer-events-none"></div>
              <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-900/40 rounded-full blur-[80px] mix-blend-overlay pointer-events-none"></div>

              <div className="relative z-10">
                <h2
                  className="text-4xl md:text-5xl lg:text-6xl font-extrabold mb-6 text-white text-center leading-[1.1] tracking-tight"
                  dangerouslySetInnerHTML={{ __html: t('landing.home.ctaTitle') }}
                />

                <p className="text-indigo-100 text-lg md:text-xl mb-10 max-w-2xl mx-auto text-center font-medium">
                  {t('landing.home.ctaDesc')}
                </p>

                <div className="flex flex-col sm:flex-row justify-center gap-4">
                  <Link
                    to={routes.register}
                    className="bg-white text-indigo-600 px-8 py-4.5 rounded-xl font-bold text-lg hover:bg-indigo-50 hover:scale-105 transition-all shadow-[0_10px_30px_-10px_rgba(0,0,0,0.3)] w-full sm:w-auto text-center"
                  >
                    {t('landing.home.ctaBtn1')}
                  </Link>
                  <Link
                    to={routes.pricing}
                    className="bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white px-8 py-4.5 rounded-xl font-bold text-lg hover:scale-105 transition-all shadow-lg w-full sm:w-auto text-center"
                  >
                    {t('landing.home.ctaBtn2')}
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </main>

        <footer className="bg-white dark:bg-[#0A0A0C] border-t border-gray-200 dark:border-gray-800/80 pt-20 pb-10" role="contentinfo">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-12 mb-16">
              <div className="md:col-span-4">
                <div className="flex items-center mb-6">
                  <img src={logo} alt="Support.io" className="h-8 w-auto dark:invert-0" />
                </div>
                <p className="text-gray-400 text-sm leading-relaxed mb-6">
                  {t('landing.home.footerDesc')}
                </p>
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full border border-gray-800 bg-gray-900/50 hover:bg-gray-800 flex items-center justify-center text-gray-400 hover:text-white cursor-pointer transition">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z" /></svg>
                  </div>
                  <div className="w-10 h-10 rounded-full border border-gray-800 bg-gray-900/50 hover:bg-gray-800 flex items-center justify-center text-gray-400 hover:text-white cursor-pointer transition">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.373 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.6.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" /></svg>
                  </div>
                </div>
              </div>

              <div className="md:col-span-2"></div>

              <div className="md:col-span-2">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-6">{t('landing.home.footerProduct')}</h3>
                <ul className="space-y-4 text-sm">
                  <li><Link to={routes.features} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition">{t('landing.home.footerFeatures')}</Link></li>
                  <li><Link to={routes.pricing} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition">{t('landing.home.footerPricing')}</Link></li>
                  <li><Link to={routes.docs} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition">{t('landing.home.footerIntegrations')}</Link></li>
                  <li><Link to={routes.features} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition">{t('landing.home.footerUpdates')}</Link></li>
                </ul>
              </div>

              <div className="md:col-span-2">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-6">{t('landing.home.footerCompany')}</h3>
                <ul className="space-y-4 text-sm">
                  <li><Link to={routes.about} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition">{t('landing.home.footerAbout')}</Link></li>
                  <li><Link to={routes.about} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition">{t('landing.home.footerCareers')}</Link></li>
                  <li><Link to={routes.about} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition">{t('landing.home.footerBlog')}</Link></li>
                  <li><Link to={routes.about} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition">{t('landing.home.footerContact')}</Link></li>
                </ul>
              </div>

              <div className="md:col-span-2">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-6">{t('landing.home.footerSupport')}</h3>
                <ul className="space-y-4 text-sm">
                  <li><Link to={routes.docs} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition">{t('landing.home.footerDocs')}</Link></li>
                  <li><Link to={routes.docs} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition">{t('landing.home.footerAPI')}</Link></li>
                  <li><Link to={routes.login} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition">{t('landing.home.footerLogin')}</Link></li>
                  <li><Link to={routes.register} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition">{t('landing.home.footerRegister')}</Link></li>
                </ul>
              </div>
            </div>

            <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center text-sm text-gray-500">
              <p>{t('landing.home.footerCopyright')}</p>
              <div className="flex gap-6 mt-4 md:mt-0 font-medium">
                <span className="hover:text-white cursor-pointer transition">{t('landing.home.footerPrivacy')}</span>
                <span className="hover:text-white cursor-pointer transition">{t('landing.home.footerTerms')}</span>
                <span className="hover:text-white cursor-pointer transition">{t('landing.home.footerCookies')}</span>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export default Home;
