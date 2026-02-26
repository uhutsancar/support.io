import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../contexts/LanguageContext';
import {
  MessageSquare,
  Settings,
  Globe,
  Shield,
  Zap,
  BarChart,
  Smartphone,
  CheckCircle,
  Play,
  ArrowRight
} from 'lucide-react';
import Header from '../components/Header';
import logo from '../public/support.io_logo.webp';

const Features = () => {
  const { t } = useTranslation();
  const { language } = useLanguage();

  const langPrefix = language === 'en' ? '/en' : '';
  const routes = {
    register: `${langPrefix}/register`,
    home: langPrefix || '/',
    docs: language === 'en' ? '/en/documentation' : '/dokumantasyon',
    about: language === 'en' ? '/en/about' : '/hakkimizda'
  };

  const featureCards = [
    {
      icon: <Zap className="w-6 h-6 text-indigo-400" />,
      title: t('landing.features.aiTitle'),
      description: t('landing.features.aiDesc'),
      size: 'large',
      content: (
        <div className="mt-8 space-y-3 relative">
          <div className="bg-brand-dark/50 p-3 text-sm rounded-xl rounded-tl-none border border-gray-800 text-gray-300 w-3/4">
            {t('landing.features.aiAsk')}
          </div>
          <div className="flex justify-end relative">
            <div className="bg-indigo-600 p-3 text-sm rounded-xl rounded-tr-none text-white w-3/4 shadow-lg flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-300" />
              {t('landing.features.aiAns')}
            </div>
          </div>
        </div>
      )
    },
    {
      icon: <BarChart className="w-6 h-6 text-purple-400" />,
      title: t('landing.features.analyticsTitle'),
      description: t('landing.features.analyticsDesc'),
      size: 'medium',
      content: (
        <div className="mt-8 flex items-end h-24 gap-3">
          <div className="w-1/5 bg-indigo-900/50 rounded-t-sm h-1/3"></div>
          <div className="w-1/5 bg-purple-900/50 rounded-t-sm h-2/3"></div>
          <div className="w-1/5 bg-indigo-600 rounded-t-sm h-full shadow-[0_0_15px_rgba(99,102,241,0.5)]"></div>
          <div className="w-1/5 bg-purple-500 rounded-t-sm h-4/5"></div>
          <div className="w-1/5 bg-indigo-400 rounded-t-sm h-1/2"></div>
        </div>
      )
    },
    {
      icon: <Globe className="w-6 h-6 text-blue-400" />,
      title: t('landing.features.langTitle'),
      description: t('landing.features.langDesc'),
      size: 'small',
      content: null
    },
    {
      icon: <Settings className="w-6 h-6 text-green-400" />,
      title: t('landing.features.integTitle'),
      description: t('landing.features.integDesc'),
      size: 'small',
      content: null
    },
    {
      icon: <Shield className="w-6 h-6 text-orange-400" />,
      title: t('landing.features.secTitle'),
      description: t('landing.features.secDesc'),
      size: 'small',
      content: null
    }
  ];

  return (
    <>
      <Helmet>
        <title>{`${t('features.title') || 'Özellikler'} - Support.io`}</title>
        <meta name="description" content="Support.io canlı sohbet özellikleri, yapay zeka botları ve detaylı analitik araçları." />
      </Helmet>

      <div className="min-h-screen bg-gray-50 dark:bg-brand-dark overflow-hidden font-sans text-gray-900 dark:text-gray-100 transition-colors duration-300">
        <Header />

        <main className="pt-32 pb-24">
          {/* Hero Section */}
          <section className="relative px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center mb-24 z-10">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] md:w-[800px] h-[500px] bg-indigo-600/20 blur-[120px] rounded-full pointer-events-none -z-10 animate-blob"></div>

            <div className="inline-block px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-medium text-xs md:text-sm mb-6 flex items-center mx-auto w-max max-w-full justify-center shadow-[0_0_15px_rgba(99,102,241,0.2)]">
              <span className="w-2 h-2 bg-indigo-500 rounded-full mr-2 animate-pulse"></span>
              {t('landing.features.badge')}
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold leading-[1.1] mb-6 tracking-tight text-gray-900 dark:text-white">
              {t('landing.features.title1')} <br className="hidden md:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 dark:from-indigo-400 dark:via-purple-400 dark:to-indigo-500">
                {t('landing.features.title2')}
              </span>
            </h1>

            <p className="text-lg md:text-xl text-gray-600 dark:text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
              {t('landing.features.desc')}
            </p>

            <div className="flex flex-col sm:flex-row justify-center gap-4 mb-20">
              <Link
                to={routes.register}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-4 rounded-xl font-bold text-lg transition-all shadow-[0_0_20px_rgba(99,102,241,0.4)] flex items-center justify-center w-full sm:w-auto"
              >
                {t('landing.features.btnStart')}
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
              <button
                className="bg-white dark:bg-brand-card border border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-800 dark:text-white px-8 py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center w-full sm:w-auto"
              >
                <Play className="w-5 h-5 mr-2" />
                {t('landing.features.btnDemo')}
              </button>
            </div>

            {/* Platform UI Mockup */}
            <div className="relative mx-auto max-w-5xl rounded-2xl bg-gradient-to-b from-gray-100 to-gray-300 dark:from-[#D9D9D9] dark:to-[#E5E5E5] p-[1px] shadow-[0_20px_60px_-15px_rgba(99,102,241,0.3)] animate-fade-in-up">
              <div className="bg-[#f0f0f0] rounded-[15px] overflow-hidden aspect-[16/9] md:aspect-[21/9] relative flex flex-col justify-center items-center">
                {/* Mockup Header */}
                <div className="absolute top-0 w-full h-8 bg-[#e0e0e0] border-b border-[#cccccc] flex items-center px-4 gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-400"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-green-400"></div>
                </div>

                <div className="w-full h-full pt-8 flex px-8 gap-8 items-center bg-[#f7f7f7]">
                  <div className="w-1/4 space-y-4">
                    <div className="h-4 bg-gray-300 rounded w-1/2"></div>
                    <div className="h-10 bg-white rounded border border-gray-200 shadow-sm w-full"></div>
                    <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-300 rounded w-1/2"></div>
                    <div className="h-32 bg-white rounded border border-gray-200 shadow-sm w-full"></div>
                  </div>

                  <div className="w-3/4 bg-white h-[80%] rounded-xl shadow-md border border-gray-200 p-6 flex flex-col gap-6">
                    <div className="flex gap-4 items-center">
                      <div className="w-12 h-12 bg-indigo-100 rounded-full flex-shrink-0"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                        <div className="h-3 bg-gray-100 rounded w-1/2"></div>
                      </div>
                      <div className="w-24 h-8 bg-green-100 rounded-full"></div>
                    </div>

                    <div className="h-px bg-gray-100 w-full"></div>

                    <div className="bg-green-50/50 flex-1 rounded-xl border border-green-100 p-4 space-y-3">
                      <div className="h-4 bg-green-200/50 rounded w-3/4"></div>
                      <div className="h-4 bg-green-200/50 rounded w-1/2"></div>
                    </div>
                    <div className="h-12 bg-gray-50 border border-gray-200 rounded-lg w-full flex items-center px-4">
                      <div className="w-4 h-4 rounded-full bg-gray-300"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Core Features */}
          <section className="py-20 bg-gray-50/50 dark:bg-brand-dark relative z-10 border-t border-gray-200 dark:border-gray-800/50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-16">
                <h2 className="text-3xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
                  {t('landing.features.platformTitle1')} <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-purple-600 dark:from-indigo-400 dark:to-purple-500">{t('landing.features.platformTitle2')}</span>
                </h2>
                <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto text-lg">
                  {t('landing.features.platformDesc')}
                </p>
              </div>

              {/* Feature Bento Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Large Card - AI */}
                <div className="md:col-span-2 bg-white dark:bg-brand-card rounded-2xl p-8 border border-gray-200 dark:border-gray-800 hover:border-indigo-400 dark:hover:border-indigo-500/30 transition-all flex flex-col relative overflow-hidden group shadow-sm dark:shadow-none">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl group-hover:bg-indigo-500/20 transition-all"></div>

                  <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-6 relative z-10">
                    {featureCards[0].icon}
                  </div>

                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3 relative z-10">{featureCards[0].title}</h3>
                  <p className="text-gray-600 dark:text-gray-400 max-w-md relative z-10">{featureCards[0].description}</p>

                  <div className="flex-1 min-h-[120px]">
                    {featureCards[0].content}
                  </div>
                </div>

                {/* Medium Card - Analytics */}
                <div className="bg-white dark:bg-brand-card rounded-2xl p-8 border border-gray-200 dark:border-gray-800 hover:border-purple-400 dark:hover:border-purple-500/30 transition-all flex flex-col relative overflow-hidden group shadow-sm dark:shadow-none">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-all"></div>

                  <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-6 relative z-10">
                    {featureCards[1].icon}
                  </div>

                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3 relative z-10">{featureCards[1].title}</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm relative z-10">{featureCards[1].description}</p>

                  <div className="mt-auto">
                    {featureCards[1].content}
                  </div>
                </div>

                {/* Small Cards */}
                {featureCards.slice(2).map((feature, index) => (
                  <div key={index} className="bg-white dark:bg-brand-card rounded-2xl p-6 border border-gray-200 dark:border-gray-800 flex items-center gap-4 hover:border-gray-400 dark:hover:border-gray-600 transition-colors shadow-sm dark:shadow-none">
                    <div className="w-12 h-12 rounded-xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                      {feature.icon}
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white">{feature.title}</h4>
                      <p className="text-sm text-gray-500">{feature.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Stats Section */}
          <section className="py-24 border-y border-gray-200 dark:border-gray-800/50 bg-white dark:bg-[#0A0B10]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center divide-x divide-gray-800/50">
                <div>
                  <div className="text-4xl md:text-5xl font-bold text-indigo-400 mb-2 tracking-tight">10,000+</div>
                  <div className="text-gray-500 font-medium text-sm md:text-base">{t('landing.features.statsUsers')}</div>
                </div>
                <div>
                  <div className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">1M+</div>
                  <div className="text-gray-500 font-medium text-sm md:text-base">{t('landing.features.statsChats')}</div>
                </div>
                <div>
                  <div className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">50+</div>
                  <div className="text-gray-500 font-medium text-sm md:text-base">{t('landing.features.statsCountries')}</div>
                </div>
                <div>
                  <div className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">%99.9</div>
                  <div className="text-gray-500 font-medium text-sm md:text-base">{t('landing.features.statsUptime')}</div>
                </div>
              </div>
            </div>
          </section>

          {/* Technology Stack */}
          <section className="py-24 bg-gray-50 dark:bg-transparent">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">{t('landing.features.techTitle')}</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-12 max-w-2xl mx-auto">
                {t('landing.features.techDesc')}
              </p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
                {['React', 'Node.js', 'Socket.IO', 'MongoDB', 'Express', 'JWT', 'SSL/TLS', 'WebSocket'].map((tech, i) => (
                  <div key={i} className="bg-white dark:bg-brand-card border border-gray-200 dark:border-gray-800 rounded-xl p-4 text-gray-600 dark:text-gray-300 font-medium hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:text-indigo-600 dark:hover:text-white transition-colors shadow-sm dark:shadow-none">
                    {tech}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* CTA Section */}
          <section className="py-24 px-4 text-center">
            <div className="max-w-5xl mx-auto bg-gradient-to-br from-indigo-600 to-indigo-500 rounded-3xl p-12 md:p-20 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl mix-blend-overlay"></div>

              <div className="relative z-10">
                <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-6 backdrop-blur-md border border-white/20">
                  <MessageSquare className="w-8 h-8 text-white" />
                </div>

                <h2
                  className="text-3xl md:text-5xl font-bold mb-6 text-white text-center leading-tight"
                  dangerouslySetInnerHTML={{ __html: t('landing.features.ctaTitle') }}
                />

                <p className="text-indigo-100 text-lg mb-10 max-w-2xl mx-auto text-center font-medium">
                  {t('landing.features.ctaDesc')}
                </p>

                <Link
                  to={routes.register}
                  className="inline-block bg-white text-indigo-600 px-8 py-4 rounded-xl font-bold text-lg hover:bg-gray-50 transition-all shadow-xl"
                >
                  {t('landing.features.ctaBtn')} <ArrowRight className="inline-block w-5 h-5 ml-2" />
                </Link>
              </div>
            </div>
          </section>
        </main>

        {/* Footer Minimal */}
        <footer className="bg-gray-100 dark:bg-[#0A0A0C] border-t border-gray-200 dark:border-gray-800/80 pt-16 pb-8 text-center text-sm text-gray-500">
          <div className="flex items-center justify-center mb-6">
            <img src={logo} alt="Support.io" className="h-8 w-auto dark:invert-0" />
          </div>

          <div className="flex justify-center gap-6 mb-8 font-medium">
            <Link to={routes.docs} className="text-gray-600 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white transition">{t('landing.features.footerSecurity')}</Link>
            <Link to={routes.about} className="text-gray-600 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white transition">{t('landing.features.footerTerms')}</Link>
            <Link to={routes.about} className="text-gray-600 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white transition">{t('landing.features.footerPrivacy')}</Link>
            <Link to={routes.about} className="text-gray-600 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white transition">{t('landing.features.footerContact')}</Link>
          </div>

          <p>{t('landing.features.footerCopyright')}</p>
        </footer>
      </div>
    </>
  );
};

export default Features;
