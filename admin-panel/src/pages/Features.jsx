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
  Bell,
  Sparkles,
  Smartphone,
  Globe,
  Settings,
  FileText,
  ArrowRight
} from 'lucide-react';
import Header from '../components/Header';

const Features = () => {
  const { t } = useTranslation();
  const mainFeatures = (t('featuresPage.features', { returnObjects: true }) || []).map((feature, index) => {
    const icons = [MessageSquare, Users, Globe, Sparkles, BarChart, Bell, Smartphone, Settings, FileText, Shield, Zap, Clock];
    return {
      ...feature,
      icon: icons[index] || MessageSquare
    };
  });

  return (
    <>
      <Helmet>
        <title>{t('features.title')} - Support.io | {t('features.subtitle')}</title>
        <meta name="description" content={t('features.chat.description')} />
        <meta name="keywords" content="canlı sohbet özellikleri, müşteri destek araçları, chat widget, operatör paneli, rapor ve analiz" />
        <link rel="canonical" href="https://support.io/ozellikler" />
        <meta property="og:title" content={`${t('features.title')} - Support.io`} />
        <meta property="og:description" content={t('features.chat.description')} />
        <meta property="og:url" content="https://support.io/ozellikler" />
      </Helmet>
      <div className="min-h-screen bg-white dark:bg-gray-900">
        <Header />
      
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 dark:from-indigo-600 dark:via-purple-600 dark:to-pink-600 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            {t('featuresPage.subtitle')}
          </h1>
          <p className="text-xl text-indigo-100 dark:text-indigo-200 max-w-3xl mx-auto">
            {t('featuresPage.description')}
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {mainFeatures.map((feature, index) => (
              <div 
                key={index}
                className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-sm hover:shadow-xl transition border border-gray-200 dark:border-gray-700"
              >
                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 dark:from-indigo-600 dark:to-purple-700 w-14 h-14 rounded-xl flex items-center justify-center mb-6">
                  <feature.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                  {feature.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  {feature.description}
                </p>
                <ul className="space-y-2">
                  {feature.benefits && feature.benefits.map((benefit, idx) => (
                    <li key={idx} className="flex items-start text-sm text-gray-700 dark:text-gray-300">
                      <div className="w-1.5 h-1.5 bg-indigo-600 dark:bg-indigo-400 rounded-full mr-2 mt-1.5 flex-shrink-0"></div>
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Integration Section */}
      <section className="bg-gray-50 dark:bg-gray-800 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              {t('featuresPage.integrationTitle')}
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              {t('featuresPage.integrationDescription')}
            </p>
          </div>

          <div className="bg-gray-900 dark:bg-gray-950 rounded-xl p-8 max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-400 dark:text-gray-500 text-sm font-mono">widget-integration.html</span>
              <span className="text-green-400 dark:text-green-500 text-xs">✓ Aktif</span>
            </div>
            <pre className="text-green-400 dark:text-green-500 font-mono text-sm overflow-x-auto">
{`<!-- Support.io Widget -->
<script>
  window.supportioConfig = {
    siteId: "your-site-id",
    position: "bottom-right"
  };
</script>
<script src="https://destekhat.com/widget.js"></script>`}
            </pre>
          </div>

          <div className="text-center mt-8">
            <p className="text-gray-600 dark:text-gray-300 mb-4">{t('featuresPage.integrationNote')}</p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-indigo-600 dark:bg-indigo-700 text-white py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Support.io'i Hemen Deneyin
          </h2>
          <p className="text-xl text-indigo-100 dark:text-indigo-200 mb-8">
            Ücretsiz hesap oluşturun ve tüm özellikleri keşfedin. Kredi kartı gerekmez.
          </p>
          <Link
            to="/register"
            className="inline-flex items-center bg-white dark:bg-gray-100 text-indigo-600 dark:text-indigo-700 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-indigo-50 dark:hover:bg-gray-200 transition"
          >
            {t('featuresPage.cta')}
            <ArrowRight className="ml-2 w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-gray-600 dark:text-gray-300">
            <Link to="/" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium">
              {t('featuresPage.backToHome')}
            </Link>
          </div>
        </div>
      </footer>
      </div>
    </>
  );
};

export default Features;
