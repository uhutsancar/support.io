import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../contexts/LanguageContext';
import { MessageSquare, Target, Users, Heart, ArrowRight } from 'lucide-react';
import Header from '../components/Header';

const About = () => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  
  const langPrefix = language === 'en' ? '/en' : '';
  const routes = {
    register: `${langPrefix}/register`,
    home: langPrefix || '/'
  };
  const values = [
    {
      icon: Target,
      title: t('aboutPage.values.mission.title'),
      description: t('aboutPage.values.mission.description')
    },
    {
      icon: Users,
      title: t('aboutPage.values.vision.title'),
      description: t('aboutPage.values.vision.description')
    },
    {
      icon: Heart,
      title: t('aboutPage.values.culture.title'),
      description: t('aboutPage.values.culture.description')
    }
  ];

  const stats = [
    { number: '10,000+', label: t('aboutPage.stats.users') },
    { number: '1M+', label: t('aboutPage.stats.conversations') },
    { number: '50+', label: t('aboutPage.stats.countries') },
    { number: '%99.9', label: t('aboutPage.stats.uptime') }
  ];

  const team = [
    {
      name: t('aboutPage.team.name'),
      role: t('aboutPage.team.role'),
      description: t('aboutPage.team.description')
    }
  ];

  return (
    <>
      <Helmet>
        <title>{t('about.title')} - Support.io | {t('about.subtitle')}</title>
        <meta name="description" content={t('about.mission.description')} />
        <meta name="keywords" content="support.io hakkında, şirket bilgileri, misyon, vizyon, müşteri odaklılık" />
        <link rel="canonical" href="https://support.io/hakkimizda" />
        <meta property="og:title" content={`${t('about.title')} - Support.io`} />
        <meta property="og:description" content="Müşteri hizmetlerinde yeni standartlar belirlemek için çalışıyoruz." />
        <meta property="og:url" content="https://support.io/hakkimizda" />
      </Helmet>
      <div className="min-h-screen bg-white dark:bg-gray-900">
        <Header />
      
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            {t('aboutPage.title')}
          </h1>
          <p className="text-xl text-indigo-100 max-w-3xl mx-auto">
            {t('aboutPage.subtitle')}
          </p>
        </div>
      </section>

      {/* Story Section */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-6">
              {t('aboutPage.story.title')}
            </h2>
            <div className="prose prose-lg mx-auto text-gray-600 dark:text-gray-300">
              <p className="mb-4">
                {t('aboutPage.story.paragraph1')}
              </p>
              <p className="mb-4">
                {t('aboutPage.story.paragraph2')}
              </p>
              <p>
                {t('aboutPage.story.paragraph3')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="bg-gray-50 dark:bg-gray-800 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              {t('aboutPage.values.title')}
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              {t('aboutPage.values.subtitle') || 'Bizi biz yapan değerler'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {values.map((value, index) => (
              <div 
                key={index}
                className="bg-white dark:bg-gray-700 rounded-xl p-8 shadow-sm hover:shadow-md transition"
              >
                <div className="bg-indigo-100 dark:bg-indigo-900 w-14 h-14 rounded-xl flex items-center justify-center mb-6">
                  <value.icon className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                  {value.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  {value.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              {t('aboutPage.stats.title')}
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-4xl md:text-5xl font-bold text-indigo-600 dark:text-indigo-400 mb-2">
                  {stat.number}
                </div>
                <div className="text-gray-600 dark:text-gray-300 font-medium">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="bg-gray-50 dark:bg-gray-800 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              {t('aboutPage.team.title')}
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              {t('aboutPage.team.subtitle')}
            </p>
          </div>

          <div className="max-w-2xl mx-auto">
            {team.map((member, index) => (
              <div 
                key={index}
                className="bg-white dark:bg-gray-700 rounded-xl p-8 shadow-sm text-center"
              >
                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Users className="w-12 h-12 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  {t('aboutPage.team.name')}
                </h3>
                <p className="text-indigo-600 dark:text-indigo-400 font-medium mb-4">
                  {t('aboutPage.team.role')}
                </p>
                <p className="text-gray-600 dark:text-gray-300">
                  {t('aboutPage.team.description')}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Technology Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              {t('aboutPage.technology.title')}
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              {t('aboutPage.technology.description')}
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {['React', 'Node.js', 'Socket.IO', 'MongoDB', 'Express', 'JWT', 'SSL/TLS', 'WebSocket'].map((tech, index) => (
              <div 
                key={index}
                className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-6 text-center text-white font-semibold"
              >
                {tech}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-indigo-600 text-white py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-2xl p-12">
            <MessageSquare className="w-16 h-16 mx-auto mb-6 text-white" />
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-6">
              {t('home.cta.title')}
            </h2>
            <p className="text-xl text-indigo-100 mb-8">
              {t('home.cta.description')}
            </p>
            <Link
              to={routes.register}
              className="inline-flex items-center bg-white text-indigo-600 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-indigo-50 transition"
            >
              {t('home.cta.button')}
              <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-gray-600 dark:text-gray-300">
            <Link to={routes.home} className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium">
              Ana Sayfaya Dön
            </Link>
          </div>
        </div>
      </footer>
      </div>
    </>
  );
};

export default About;
