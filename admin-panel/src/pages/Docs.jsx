import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { Code, Copy, Check, BookOpen, Zap, Settings, MessageCircle } from 'lucide-react';
import Header from '../components/Header';

const Docs = () => {
  const { t } = useTranslation();
  const [copiedCode, setCopiedCode] = useState(null);

  const codeExample = `<!-- Support.io Widget -->
<script>
  window.supportioConfig = {
    siteId: "your-site-id",
    position: "bottom-right"
  };
</script>
<script src="https://destekhat.com/widget.js"></script>`;

  const copyToClipboard = (code, id) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <>
      <Helmet>
        <title>{t('docs.meta.title')} - Support.io</title>
        <meta name="description" content={t('docs.meta.description')} />
      </Helmet>

      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
        <Header />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Hero Section */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl mb-6">
              <BookOpen className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
              {t('docs.hero.title')}
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              {t('docs.hero.description')}
            </p>
          </div>

          {/* Main Content */}
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Sidebar Navigation */}
            <div className="lg:col-span-1">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 sticky top-24">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  {t('docs.nav.title')}
                </h3>
                <nav className="space-y-2">
                  <a href="#getting-started" className="block px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition">
                    {t('docs.nav.gettingStarted')}
                  </a>
                  <a href="#installation" className="block px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition">
                    {t('docs.nav.installation')}
                  </a>
                  <a href="#configuration" className="block px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition">
                    {t('docs.nav.configuration')}
                  </a>
                  <a href="#features" className="block px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition">
                    {t('docs.nav.features')}
                  </a>
                  <a href="#benefits" className="block px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition">
                    {t('docs.nav.benefits')}
                  </a>
                </nav>
              </div>
            </div>

            {/* Documentation Content */}
            <div className="lg:col-span-2 space-y-12">
              {/* Getting Started */}
              <section id="getting-started" className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
                  {t('docs.gettingStarted.title')}
                </h2>
                <div className="prose dark:prose-invert max-w-none">
                  <p className="text-gray-600 dark:text-gray-300 text-lg mb-6">
                    {t('docs.gettingStarted.description')}
                  </p>
                  <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-6 mb-6">
                    <h3 className="text-lg font-semibold text-indigo-900 dark:text-indigo-200 mb-3">
                      {t('docs.gettingStarted.whatIs.title')}
                    </h3>
                    <p className="text-indigo-800 dark:text-indigo-300">
                      {t('docs.gettingStarted.whatIs.description')}
                    </p>
                  </div>
                </div>
              </section>

              {/* Installation */}
              <section id="installation" className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
                <div className="flex items-center mb-6">
                  <Zap className="w-8 h-8 text-indigo-600 dark:text-indigo-400 mr-3" />
                  <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                    {t('docs.installation.title')}
                  </h2>
                </div>
                
                <p className="text-gray-600 dark:text-gray-300 text-lg mb-6">
                  {t('docs.installation.description')}
                </p>

                {/* Steps */}
                <div className="space-y-6 mb-8">
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center">
                      <span className="text-indigo-600 dark:text-indigo-400 font-bold">1</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        {t('docs.installation.step1.title')}
                      </h3>
                      <p className="text-gray-600 dark:text-gray-300">
                        {t('docs.installation.step1.description')}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center">
                      <span className="text-indigo-600 dark:text-indigo-400 font-bold">2</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        {t('docs.installation.step2.title')}
                      </h3>
                      <p className="text-gray-600 dark:text-gray-300">
                        {t('docs.installation.step2.description')}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center">
                      <span className="text-indigo-600 dark:text-indigo-400 font-bold">3</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        {t('docs.installation.step3.title')}
                      </h3>
                      <p className="text-gray-600 dark:text-gray-300 mb-4">
                        {t('docs.installation.step3.description')}
                      </p>
                      
                      {/* Code Block */}
                      <div className="relative">
                        <div className="bg-gray-900 dark:bg-gray-950 rounded-lg overflow-hidden">
                          <div className="flex items-center justify-between px-4 py-2 bg-gray-800 dark:bg-gray-900 border-b border-gray-700">
                            <div className="flex items-center gap-2">
                              <Code className="w-4 h-4 text-gray-400" />
                              <span className="text-sm text-gray-400">widget-integration.html</span>
                            </div>
                            <button
                              onClick={() => copyToClipboard(codeExample, 'main')}
                              className="flex items-center gap-2 px-3 py-1 text-sm text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 rounded transition"
                            >
                              {copiedCode === 'main' ? (
                                <>
                                  <Check className="w-4 h-4" />
                                  <span>{t('docs.installation.copied')}</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-4 h-4" />
                                  <span>{t('docs.installation.copy')}</span>
                                </>
                              )}
                            </button>
                          </div>
                          <pre className="p-4 overflow-x-auto">
                            <code className="text-sm text-gray-100 font-mono">
                              {codeExample}
                            </code>
                          </pre>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6">
                  <h4 className="text-lg font-semibold text-green-900 dark:text-green-200 mb-2">
                    ✅ {t('docs.installation.ready.title')}
                  </h4>
                  <p className="text-green-800 dark:text-green-300">
                    {t('docs.installation.ready.description')}
                  </p>
                </div>
              </section>

              {/* Configuration */}
              <section id="configuration" className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
                <div className="flex items-center mb-6">
                  <Settings className="w-8 h-8 text-indigo-600 dark:text-indigo-400 mr-3" />
                  <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                    {t('docs.configuration.title')}
                  </h2>
                </div>

                <p className="text-gray-600 dark:text-gray-300 text-lg mb-6">
                  {t('docs.configuration.description')}
                </p>

                <div className="space-y-4">
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <code className="text-indigo-600 dark:text-indigo-400 font-mono font-semibold">siteId</code>
                      <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 px-2 py-1 rounded">
                        {t('docs.configuration.required')}
                      </span>
                    </div>
                    <p className="text-gray-600 dark:text-gray-300 text-sm">
                      {t('docs.configuration.siteId')}
                    </p>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <code className="text-indigo-600 dark:text-indigo-400 font-mono font-semibold">position</code>
                      <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-2 py-1 rounded">
                        {t('docs.configuration.optional')}
                      </span>
                    </div>
                    <p className="text-gray-600 dark:text-gray-300 text-sm mb-2">
                      {t('docs.configuration.position')}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <code className="text-xs bg-white dark:bg-gray-800 px-2 py-1 rounded border border-gray-300 dark:border-gray-600">bottom-right</code>
                      <code className="text-xs bg-white dark:bg-gray-800 px-2 py-1 rounded border border-gray-300 dark:border-gray-600">bottom-left</code>
                      <code className="text-xs bg-white dark:bg-gray-800 px-2 py-1 rounded border border-gray-300 dark:border-gray-600">top-right</code>
                      <code className="text-xs bg-white dark:bg-gray-800 px-2 py-1 rounded border border-gray-300 dark:border-gray-600">top-left</code>
                    </div>
                  </div>
                </div>
              </section>

              {/* Features */}
              <section id="features" className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
                <div className="flex items-center mb-6">
                  <MessageCircle className="w-8 h-8 text-indigo-600 dark:text-indigo-400 mr-3" />
                  <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                    {t('docs.features.title')}
                  </h2>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-lg p-6 border border-indigo-200 dark:border-indigo-800">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      💬 {t('docs.features.realtime.title')}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300">
                      {t('docs.features.realtime.description')}
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-6 border border-green-200 dark:border-green-800">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      ⚡ {t('docs.features.easy.title')}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300">
                      {t('docs.features.easy.description')}
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-lg p-6 border border-orange-200 dark:border-orange-800">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      🎨 {t('docs.features.customizable.title')}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300">
                      {t('docs.features.customizable.description')}
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      📊 {t('docs.features.analytics.title')}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300">
                      {t('docs.features.analytics.description')}
                    </p>
                  </div>
                </div>
              </section>

              {/* Benefits */}
              <section id="benefits" className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl shadow-lg p-8 text-white">
                <h2 className="text-3xl font-bold mb-6">
                  {t('docs.benefits.title')}
                </h2>
                
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-white/20 rounded-full flex items-center justify-center mt-1">
                      <span className="text-sm">✓</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg mb-1">{t('docs.benefits.satisfaction.title')}</h3>
                      <p className="text-indigo-100">{t('docs.benefits.satisfaction.description')}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-white/20 rounded-full flex items-center justify-center mt-1">
                      <span className="text-sm">✓</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg mb-1">{t('docs.benefits.conversion.title')}</h3>
                      <p className="text-indigo-100">{t('docs.benefits.conversion.description')}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-white/20 rounded-full flex items-center justify-center mt-1">
                      <span className="text-sm">✓</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg mb-1">{t('docs.benefits.availability.title')}</h3>
                      <p className="text-indigo-100">{t('docs.benefits.availability.description')}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-white/20 rounded-full flex items-center justify-center mt-1">
                      <span className="text-sm">✓</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg mb-1">{t('docs.benefits.insights.title')}</h3>
                      <p className="text-indigo-100">{t('docs.benefits.insights.description')}</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* CTA Section */}
              <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 text-center">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                  {t('docs.cta.title')}
                </h2>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  {t('docs.cta.description')}
                </p>
                <a
                  href="/register"
                  className="inline-flex items-center px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition"
                >
                  {t('docs.cta.button')}
                </a>
              </section>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Docs;
