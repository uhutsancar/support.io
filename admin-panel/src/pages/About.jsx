import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../contexts/LanguageContext';
import {
  Target,
  Eye,
  Heart,
  Users,
  MessageSquare,
  ArrowRight
} from 'lucide-react';
import Header from '../components/Header';

const About = () => {
  const { t } = useTranslation();
  const { language } = useLanguage();

  const langPrefix = language === 'en' ? '/en' : '';
  const routes = {
    register: `${langPrefix}/register`,
    home: langPrefix || '/',
    features: `${langPrefix}/features`,
    pricing: `${langPrefix}/pricing`,
    docs: `${langPrefix}/documentation`
  };

  const values = [
    {
      icon: <Target className="w-8 h-8 text-indigo-500" />,
      title: t('aboutPage.values.mission.title') || 'Misyonumuz',
      description: t('aboutPage.values.mission.description') || 'Her ölçekteki işletmeye profesyonel müşteri desteği sunabilmesini sağlamak. Kullanımı kolay, uygun fiyatlı ve güçlü araçlar sunarak müşteri memnuniyetini artırmak.',
      iconBg: 'bg-indigo-50 dark:bg-indigo-900/30'
    },
    {
      icon: <Eye className="w-8 h-8 text-purple-500" />,
      title: t('aboutPage.values.vision.title') || 'Vizyonumuz',
      description: t('aboutPage.values.vision.description') || 'Müşteri hizmetlerinde yeni standartlar belirlemek. İşletmeler ve müşterileri arasındaki iletişimi daha anlamlı, daha hızlı ve daha etkili hale getirmek.',
      iconBg: 'bg-purple-50 dark:bg-purple-900/30'
    },
    {
      icon: <Heart className="w-8 h-8 text-pink-500" />,
      title: t('aboutPage.values.culture.title') || 'Değerlerimiz',
      description: t('aboutPage.values.culture.description') || 'Müşteri odaklılık, sürekli iyileştirme, şeffaflık ve güvenilirlik. Kullanıcılarımızın başarısı bizim başarımızdır. Beklentileri asmak için çalışırız.',
      iconBg: 'bg-pink-50 dark:bg-pink-900/30'
    }
  ];

  const stats = [
    { number: '10,000+', label: t('aboutPage.stats.users') || 'Aktif Kullanıcı' },
    { number: '1M+', label: t('aboutPage.stats.conversations') || 'Aylık Konuşma' },
    { number: '50+', label: t('aboutPage.stats.countries') || 'Ülke' },
    { number: '%99.9', label: t('aboutPage.stats.uptime') || 'Uptime' }
  ];

  return (
    <>
      <Helmet>
        <title>{`${t('about.title') || 'Hakkımızda'} - Support.io`}</title>
        <meta name="description" content="Support.io misyonu, vizyonu ve ekibi hakkında bilgiler." />
      </Helmet>

      <div className="min-h-screen bg-gray-50 dark:bg-brand-dark overflow-hidden font-sans text-gray-900 dark:text-gray-100 transition-colors duration-200">
        <Header />

        <main className="pt-32 pb-24">
          {/* Hero Section */}
          <section className="relative px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-center mb-24 z-10">
            <h1
              className="text-4xl sm:text-5xl md:text-6xl font-extrabold leading-[1.15] mb-6 tracking-tight text-gray-900 dark:text-white"
              dangerouslySetInnerHTML={{ __html: `${t('landing.about.heroTitle1')} <span class="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500">${t('landing.about.heroTitle2')}</span>` }}
            />

            <p className="text-lg md:text-xl text-gray-600 dark:text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
              {t('landing.about.heroDesc')}
            </p>
          </section>

          {/* Story Section */}
          <section className="py-20 bg-white dark:bg-brand-card border-y border-gray-100 dark:border-gray-800/50 relative">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
              <h4 className="text-indigo-600 dark:text-indigo-400 font-bold tracking-wider uppercase text-sm mb-4">
                {t('landing.about.whoAreWe')}
              </h4>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-8">
                {t('aboutPage.story.title') || 'Hikayemiz'}
              </h2>
              <div className="space-y-6 text-lg text-gray-600 dark:text-gray-300 leading-relaxed max-w-3xl mx-auto">
                <p>{t('landing.about.story1')}</p>
                <p>{t('landing.about.story2')}</p>
                <p>{t('landing.about.story3')}</p>
              </div>
            </div>
          </section>

          {/* Values Section */}
          <section className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
                {t('landing.about.valuesTitle')}
              </h2>
              <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                {t('landing.about.valuesDesc')}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {values.map((value, index) => (
                <div
                  key={index}
                  className="bg-white dark:bg-brand-card rounded-2xl p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-gray-100 dark:border-gray-800 hover:-translate-y-1 transition-transform duration-300 relative overflow-hidden text-center md:text-left"
                >
                  <div className={`${value.iconBg} w-16 h-16 rounded-2xl flex items-center justify-center mb-8 mx-auto md:mx-0`}>
                    {value.icon}
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                    {value.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                    {value.description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Stats Bar */}
          <section className="py-20 bg-indigo-600 dark:bg-indigo-700">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center divide-x divide-indigo-500">
                {stats.map((stat, index) => (
                  <div key={index}>
                    <div className="text-4xl md:text-5xl font-bold text-white mb-2 tracking-tight">{stat.number}</div>
                    <div className="text-indigo-200 font-medium text-sm md:text-base">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Team Section */}
          <section className="py-24 bg-white dark:bg-brand-dark">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-16">
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
                  {t('aboutPage.team.title') || 'Ekibimiz'}
                </h2>
                <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                  {t('aboutPage.team.subtitle') || 'Tutkulu ve deneyimli profesyonellerden oluşan ekibimiz'}
                </p>
              </div>

              <div className="max-w-sm mx-auto">
                <div className="bg-white dark:bg-brand-card rounded-2xl p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-gray-100 dark:border-gray-800 text-center relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 dark:bg-indigo-900/20 rounded-full blur-3xl"></div>

                  <div className="bg-gradient-to-br from-indigo-500 to-purple-600 w-28 h-28 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl border-4 border-white dark:border-gray-800 relative z-10 group-hover:scale-105 transition-transform">
                    <Users className="w-12 h-12 text-white" />
                  </div>

                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 relative z-10">
                    {t('aboutPage.team.name') || 'Support.io Ekibi'}
                  </h3>
                  <p className="text-indigo-600 dark:text-indigo-400 font-bold tracking-wider uppercase text-xs mb-6 relative z-10">
                    {t('aboutPage.team.role') || 'GELİŞTİRİCİLER & DESTEK'}
                  </p>

                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed relative z-10">
                    {t('aboutPage.team.description') || 'Deneyimli yazılım geliştiricileri ve müşteri destek uzmanlarından oluşan ekibimiz, sizin için çalışıyor. Her gün daha iyi bir deneyim sunmak için buradayız.'}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Tech Stack */}
          <section className="py-20 bg-gray-50 dark:bg-[#0B0D17]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
                {t('aboutPage.technology.title') || 'Teknolojimiz'}
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto mb-12">
                {t('aboutPage.technology.description') || 'Modern web teknolojileri ile geliştirilen Support.io, yüksek performans ve güvenilirlik sunar. En güncel standartlar üzerine kurulu bir altyapıya sahibiz.'}
              </p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 max-w-5xl mx-auto">
                {['React', 'Node.js', 'Socket.IO', 'MongoDB', 'Express', 'JWT', 'SSL/TLS', 'WebSocket'].map((tech, index) => (
                  <div
                    key={index}
                    className="bg-white dark:bg-brand-card rounded-xl p-4 md:p-6 text-center text-indigo-600 dark:text-indigo-400 font-semibold shadow-sm border border-gray-100 dark:border-gray-800 hover:-translate-y-1 transition-transform"
                  >
                    {tech}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* CTA */}
          <section className="py-24 px-4 text-center">
            <div className="max-w-5xl mx-auto bg-gradient-to-r from-indigo-500 to-purple-500 rounded-3xl p-12 md:p-20 shadow-xl relative overflow-hidden">
              {/* Decorative elements */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/20 rounded-full blur-3xl mix-blend-overlay"></div>
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-900/40 rounded-full blur-3xl mix-blend-overlay"></div>

              <div className="relative z-10">
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-6 backdrop-blur-md border border-white/20">
                  <MessageSquare className="w-8 h-8 text-white" />
                </div>

                <h2
                  className="text-3xl md:text-5xl font-bold mb-6 text-white text-center leading-tight"
                  dangerouslySetInnerHTML={{ __html: t('landing.about.ctaTitle') }}
                />

                <p className="text-indigo-50 text-lg mb-10 max-w-2xl mx-auto text-center font-medium">
                  {t('landing.about.ctaDesc')}
                </p>

                <Link
                  to={routes.register}
                  className="inline-flex items-center bg-white text-indigo-600 px-8 py-4 rounded-xl font-bold text-lg hover:bg-gray-50 transition-all shadow-lg hover:scale-105"
                >
                  {t('landing.about.ctaBtn')}
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Link>
              </div>
            </div>
          </section>
        </main>

        <footer className="bg-white dark:bg-[#0A0A0C] border-t border-gray-100 dark:border-gray-800/80 pt-10 pb-10 text-center" role="contentinfo">
          <Link to={routes.home} className="inline-flex items-center text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-semibold mb-6">
            <ArrowRight className="w-4 h-4 mr-2 rotate-180" />
            {t('landing.about.backHome')}
          </Link>
          <p className="text-gray-500 dark:text-gray-600 text-sm">{t('landing.about.footerCopyright')}</p>
        </footer>
      </div>
    </>
  );
};

export default About;
