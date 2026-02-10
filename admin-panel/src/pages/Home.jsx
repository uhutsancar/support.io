import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  MessageSquare, 
  Zap, 
  Users, 
  BarChart, 
  Clock, 
  Shield,
  CheckCircle,
  ArrowRight
} from 'lucide-react';
import Header from '../components/Header';
import logo from '../public/support.io_logo.webp';

const Home = () => {
  const { t } = useTranslation();
  
  const features = [
    {
      icon: MessageSquare,
      title: t('home.features.realtime.title'),
      description: t('home.features.realtime.description')
    },
    {
      icon: Zap,
      title: t('home.features.ai.title'),
      description: t('home.features.ai.description')
    },
    {
      icon: Users,
      title: t('home.features.multisite.title'),
      description: t('home.features.multisite.description')
    },
    {
      icon: BarChart,
      title: t('home.features.analytics.title'),
      description: t('home.features.analytics.description')
    },
    {
      icon: Clock,
      title: t('home.features.secure.title'),
      description: t('home.features.secure.description')
    },
    {
      icon: Shield,
      title: t('home.features.customizable.title'),
      description: t('home.features.customizable.description')
    }
  ];

  const benefits = [
    t('home.why.benefits.0'),
    t('home.why.benefits.1'),
    t('home.why.benefits.2'),
    t('home.why.benefits.3'),
    t('home.why.benefits.4'),
    t('home.why.benefits.5')
  ];

  return (
    <>
      <Helmet>
        <title>Support.io - Modern Müşteri Destek ve Canlı Sohbet Sistemi</title>
        <meta name="description" content="Support.io ile müşterilerinizle gerçek zamanlı iletişim kurun. Modern canlı sohbet widget'ı, detaylı raporlama ve çoklu operatör desteği ile müşteri memnuniyetini artırın." />
        <meta name="keywords" content="canlı sohbet, müşteri desteği, live chat, chat widget, destek sistemi, müşteri hizmetleri, customer support" />
        <link rel="canonical" href="https://support.io/" />
        <meta property="og:title" content="Support.io - Modern Müşteri Destek Sistemi" />
        <meta property="og:description" content="Müşterilerinizle gerçek zamanlı iletişim kurun. Modern ve kullanıcı dostu canlı sohbet çözümü." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://support.io/" />
      </Helmet>
      <div className="min-h-screen bg-white dark:bg-gray-900">
        <Header />
      
      <main role="main">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 dark:from-indigo-600 dark:via-purple-700 dark:to-pink-600 text-white" aria-label="Hero section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              {t('home.hero.title')} {t('home.hero.titleHighlight')}
            </h1>
            <p className="text-xl md:text-2xl mb-8 text-indigo-100 dark:text-indigo-200">
              {t('home.hero.description')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/register"
                className="bg-white text-indigo-600 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-indigo-50 dark:bg-gray-900 dark:text-indigo-400 dark:hover:bg-gray-800 transition flex items-center justify-center"
                aria-label="Ücretsiz hesap oluşturmak için kayıt olun"
              >
                {t('home.hero.cta')}
                <ArrowRight className="ml-2 w-5 h-5" aria-hidden="true" />
              </Link>
              <Link
                to="/ozellikler"
                className="bg-indigo-600 bg-opacity-30 backdrop-blur-sm text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-opacity-40 dark:bg-purple-600 dark:bg-opacity-40 dark:hover:bg-opacity-50 transition border-2 border-white border-opacity-30 dark:border-opacity-40"
                aria-label="Ürün özelliklerini keşfedin"
              >
                {t('home.hero.demo')}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-50 dark:bg-gray-800" aria-label="Özellikler">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              {t('home.features.title')}
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              {t('home.features.subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div 
                key={index}
                className="bg-white dark:bg-gray-900 rounded-xl p-8 shadow-sm hover:shadow-md dark:shadow-gray-900/50 dark:hover:shadow-gray-900/70 transition border border-gray-200 dark:border-gray-700"
              >
                <div className="bg-indigo-100 dark:bg-indigo-900/50 w-14 h-14 rounded-lg flex items-center justify-center mb-4">
                  <feature.icon className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                  {feature.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 bg-white dark:bg-gray-900" aria-label="Faydalar">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-6">
                {t('home.why.title')}
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
                {t('home.why.description')}
              </p>
              <div className="space-y-4">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-start">
                    <CheckCircle className="w-6 h-6 text-green-500 dark:text-green-400 mr-3 flex-shrink-0 mt-1" />
                    <span className="text-gray-700 dark:text-gray-300 text-lg">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 dark:from-indigo-600 dark:to-purple-700 rounded-2xl p-8 text-white">
              <div className="bg-white bg-opacity-10 dark:bg-opacity-20 backdrop-blur-sm rounded-xl p-6 mb-6">
                <h3 className="text-2xl font-bold mb-2">{t('home.getStarted.title')}</h3>
                <p className="text-indigo-100 dark:text-indigo-200">
                  {t('home.getStarted.description')}
                </p>
              </div>
              <ul className="space-y-3 mb-6">
                <li className="flex items-center">
                  <div className="bg-white bg-opacity-20 rounded-full w-8 h-8 flex items-center justify-center mr-3 flex-shrink-0">
                    <span className="font-bold">1</span>
                  </div>
                  <span>{t('home.getStarted.step1')}</span>
                </li>
                <li className="flex items-center">
                  <div className="bg-white bg-opacity-20 rounded-full w-8 h-8 flex items-center justify-center mr-3 flex-shrink-0">
                    <span className="font-bold">2</span>
                  </div>
                  <span>{t('home.getStarted.step2')}</span>
                </li>
                <li className="flex items-center">
                  <div className="bg-white bg-opacity-20 rounded-full w-8 h-8 flex items-center justify-center mr-3 flex-shrink-0">
                    <span className="font-bold">3</span>
                  </div>
                  <span>{t('home.getStarted.step3')}</span>
                </li>
              </ul>
              <Link
                to="/register"
                className="block w-full bg-white text-indigo-600 py-3 rounded-lg font-semibold text-center hover:bg-indigo-50 dark:bg-gray-900 dark:text-indigo-400 dark:hover:bg-gray-800 transition"
                aria-label="Ücretsiz denemeye başlayın"
              >
                {t('home.getStarted.cta')}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gray-900 dark:bg-gray-950 text-white py-20" aria-label="Harekete geçirici mesaj">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            {t('home.cta.title')}
          </h2>
          <p className="text-xl text-gray-300 dark:text-gray-400 mb-8">
            {t('home.cta.description')}
          </p>
          <Link
            to="/register"
            className="inline-flex items-center bg-indigo-600 text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 transition"
            aria-label="Ücretsiz hesap oluşturun"
          >
            {t('home.cta.button')}
            <ArrowRight className="ml-2 w-5 h-5" aria-hidden="true" />
          </Link>
        </div>
      </section>
      </main>

      {/* Footer */}
      <footer className="bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 py-12" role="contentinfo">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center mb-4">
                <img src={logo} alt="Support.io Logo" style={{ height: '9rem', width: 'auto', maxWidth: '100%' }} />
              </div>
              <p className="text-gray-700 dark:text-gray-300 text-sm">
                {t('home.footer.description')}
              </p>
            </div>
            
            <nav aria-label="Ürün menüsü">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4 text-base">{t('home.footer.product')}</h3>
              <ul className="space-y-2 text-sm">
                <li><Link to="/ozellikler" className="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition">{t('header.features')}</Link></li>
                <li><Link to="/fiyatlandirma" className="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition">{t('header.pricing')}</Link></li>
              </ul>
            </nav>
            
            <nav aria-label="Şirket menüsü">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4 text-base">{t('home.footer.company')}</h3>
              <ul className="space-y-2 text-sm">
                <li><Link to="/hakkimizda" className="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition">{t('header.about')}</Link></li>
              </ul>
            </nav>
            
            <nav aria-label="Destek menüsü">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4 text-base">{t('home.footer.support')}</h3>
              <ul className="space-y-2 text-sm">
                <li><Link to="/login" className="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition">{t('header.login')}</Link></li>
                <li><Link to="/register" className="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition">{t('header.register')}</Link></li>
              </ul>
            </nav>
          </div>
          
          <div className="border-t border-gray-200 dark:border-gray-700 mt-12 pt-8 text-center text-sm text-gray-600 dark:text-gray-400">
            <p>{t('home.footer.copyright')}</p>
          </div>
        </div>
      </footer>
      </div>
    </>
  );
};

export default Home;
