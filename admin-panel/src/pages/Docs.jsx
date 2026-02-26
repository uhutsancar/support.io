import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import {
  Code, Copy, Check, BookOpen, Zap, Settings, MessageCircle, Menu, X,
  TerminalSquare, Shield, Globe, Layers, Activity, ChevronRight, Github
} from 'lucide-react';
import Header from '../components/Header';
import { Link } from 'react-router-dom';

const Docs = () => {
  const { t } = useTranslation();
  const [copiedCode, setCopiedCode] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const codeExample = `<!-- Support.io Integration -->
<script>
  window.supportioConfig = {
    siteId: "YOUR_24_CHAR_SITE_ID", // Required
    position: "bottom-right",        // Optional (bottom-right, bottom-left)
    theme: "system",                 // Optional (light, dark, system)
    primaryColor: "#4f46e5"          // Optional branding color
  };
</script>

<!-- Core Engine -->
<script src="https://cdn.support.io/widget/v1/core.js" async defer></script>`;

  const copyToClipboard = (code, id) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const navLinks = [
    { id: 'getting-started', icon: BookOpen, label: t('docs.nav.gettingStarted') },
    { id: 'installation', icon: Zap, label: t('docs.nav.installation') },
    { id: 'configuration', icon: Settings, label: t('docs.nav.configuration') },
    { id: 'features', icon: Layers, label: t('docs.nav.features') },
    { id: 'benefits', icon: Shield, label: t('docs.nav.benefits') },
  ];

  return (
    <>
      <Helmet>
        <title>{`${t('docs.meta.title') || ''} - Support.io`}</title>
        <meta name="description" content={t('docs.meta.description')} />
      </Helmet>

      <div className="min-h-screen bg-gray-50 dark:bg-[#0B0D17] transition-colors duration-300">
        <Header />

        {/* Hero Section */}
        <div className="relative pt-32 pb-16 overflow-hidden border-b border-gray-200 dark:border-gray-800">
          <div className="absolute inset-0 z-0">
            <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute top-40 -left-40 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-700"></div>
          </div>

          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="inline-flex items-center justify-center p-3 sm:p-4 bg-white dark:bg-gray-800/50 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700/50 mb-6 backdrop-blur-sm transform hover:scale-105 transition-transform duration-300">
              <TerminalSquare className="w-8 h-8 sm:w-12 sm:h-12 text-indigo-600 dark:text-indigo-400" />
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-medium text-xs sm:text-sm mb-6">
              <span className="flex w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400 animate-pulse"></span>
              {t('docs.hero.version')}
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 tracking-tight mb-6 px-2">
              {t('docs.hero.title')}
            </h1>

            <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed px-4">
              {t('docs.hero.description')}
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <a href="#getting-started" className="inline-flex items-center px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-all shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40">
                {t('docs.nav.gettingStarted')} <ChevronRight className="w-4 h-4 ml-1" />
              </a>
              <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-6 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-900 dark:text-white font-medium rounded-xl transition-all shadow-sm">
                <Github className="w-4 h-4 mr-2" />
                {t('docs.hero.viewGithub')}
              </a>
            </div>
          </div>
        </div>

        {/* Content Layout */}
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 z-10">

          {/* Mobile Menu Toggle */}
          <div className="lg:hidden mb-6 z-20 relative">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="w-full flex items-center justify-between px-5 py-4 bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white transition-colors"
            >
              <span className="font-semibold flex items-center gap-2">
                <Menu className="w-5 h-5 text-indigo-500" />
                {t('docs.nav.title')}
              </span>
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
            </button>

            {mobileMenuOpen && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-3 z-50">
                <nav className="space-y-1">
                  {navLinks.map((link) => (
                    <a
                      key={link.id}
                      href={`#${link.id}`}
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg transition-colors"
                    >
                      <link.icon className="w-4 h-4 opacity-70" />
                      {link.label}
                    </a>
                  ))}
                </nav>
              </div>
            )}
          </div>

          <div className="lg:grid lg:grid-cols-4 gap-8 xl:gap-12 relative items-start">

            {/* Sidebar Navigation (Desktop) */}
            <div className="hidden lg:block sticky top-28 z-10 transition-all duration-300">
              <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700/80 p-6 overflow-hidden relative">
                <div className="absolute -top-10 -right-10 w-24 h-24 bg-indigo-500/10 rounded-full blur-xl z-0"></div>
                <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4 px-2 relative z-10">
                  {t('docs.nav.title')}
                </h3>
                <nav className="space-y-1 relative z-10">
                  {navLinks.map((link) => (
                    <a
                      key={link.id}
                      href={`#${link.id}`}
                      className="group flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-xl transition-all duration-200"
                    >
                      <div className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-500/20 text-gray-500 dark:text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        <link.icon className="w-4 h-4" />
                      </div>
                      {link.label}
                    </a>
                  ))}
                </nav>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="lg:col-span-3 space-y-10 min-w-0">

              {/* Getting Started Section */}
              <section id="getting-started" className="bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700/50 p-6 sm:p-8 scroll-mt-32 transition-colors">
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-3 bg-indigo-100 dark:bg-indigo-500/20 rounded-xl text-indigo-600 dark:text-indigo-400">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                    {t('docs.gettingStarted.title')}
                  </h2>
                </div>

                <p className="text-gray-600 dark:text-gray-300 text-base lg:text-lg mb-8 leading-relaxed">
                  {t('docs.gettingStarted.description')}
                </p>

                <div className="bg-gradient-to-br from-indigo-50/50 to-purple-50/50 dark:from-indigo-900/10 dark:to-purple-900/10 border border-indigo-100 dark:border-indigo-500/20 rounded-2xl p-6 sm:p-8 relative overflow-hidden">
                  <div className="relative z-10">
                    <h3 className="text-lg sm:text-xl font-bold text-indigo-900 dark:text-indigo-300 mb-3 flex items-center gap-2">
                      <Globe className="w-5 h-5" />
                      {t('docs.gettingStarted.whatIs.title')}
                    </h3>
                    <p className="text-indigo-800/80 dark:text-indigo-200/80 leading-relaxed">
                      {t('docs.gettingStarted.whatIs.description')}
                    </p>
                  </div>
                </div>
              </section>

              {/* Installation Section */}
              <section id="installation" className="bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700/50 p-6 sm:p-8 scroll-mt-32 transition-colors">
                <div className="flex items-center gap-4 mb-8">
                  <div className="p-3 bg-emerald-100 dark:bg-emerald-500/20 rounded-xl text-emerald-600 dark:text-emerald-400">
                    <Zap className="w-6 h-6" />
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                    {t('docs.installation.title')}
                  </h2>
                </div>

                <p className="text-gray-600 dark:text-gray-300 text-base lg:text-lg mb-8">
                  {t('docs.installation.description')}
                </p>

                <div className="space-y-8 mb-10">
                  {/* Step 1 */}
                  <div className="relative pl-12 sm:pl-16">
                    <div className="absolute left-0 top-0 w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-sm sm:text-base shadow-lg shadow-indigo-500/30">1</div>
                    <div className="absolute left-4 sm:left-5 top-10 bottom-[-2rem] w-[2px] bg-gray-200 dark:bg-gray-700"></div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 pt-1">{t('docs.installation.step1.title')}</h3>
                    <p className="text-gray-600 dark:text-gray-400">{t('docs.installation.step1.description')}</p>
                  </div>

                  {/* Step 2 */}
                  <div className="relative pl-12 sm:pl-16">
                    <div className="absolute left-0 top-0 w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-sm sm:text-base shadow-lg shadow-indigo-500/30">2</div>
                    <div className="absolute left-4 sm:left-5 top-10 bottom-[-2rem] w-[2px] bg-gray-200 dark:bg-gray-700"></div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 pt-1">{t('docs.installation.step2.title')}</h3>
                    <p className="text-gray-600 dark:text-gray-400">{t('docs.installation.step2.description')}</p>
                  </div>

                  {/* Step 3 */}
                  <div className="relative pl-12 sm:pl-16">
                    <div className="absolute left-0 top-0 w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-sm sm:text-base shadow-lg shadow-indigo-500/30">3</div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 pt-1">{t('docs.installation.step3.title')}</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">{t('docs.installation.step3.description')}</p>

                    <div className="bg-[#1e1e24] dark:bg-[#0d1117] rounded-xl overflow-hidden shadow-2xl border border-gray-700/50">
                      <div className="flex items-center justify-between px-4 py-3 bg-[#282c34] dark:bg-[#161b22] border-b border-gray-700/50">
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1.5">
                            <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                            <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                            <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                          </div>
                          <span className="ml-3 text-xs text-gray-400 font-mono tracking-wider truncate">{t('docs.installation.codeSnippetPrefix')}</span>
                        </div>
                        <button
                          onClick={() => copyToClipboard(codeExample, 'main')}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors border border-white/5 whitespace-nowrap"
                        >
                          {copiedCode === 'main' ? (
                            <><Check className="w-3.5 h-3.5 text-emerald-400" /> <span className="text-emerald-400 hidden sm:inline">{t('docs.installation.copied')}</span></>
                          ) : (
                            <><Copy className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{t('docs.installation.copy')}</span></>
                          )}
                        </button>
                      </div>
                      <pre className="p-4 sm:p-5 overflow-x-auto">
                        <code className="text-[13px] leading-relaxed font-mono text-gray-300">
                          <span className="text-gray-500">&lt;!-- Support.io Integration --&gt;</span>{'\n'}
                          <span className="text-pink-400">&lt;script&gt;</span>{'\n'}
                          {'  '}window.<span className="text-blue-400">supportioConfig</span> = {'{'}{'\n'}
                          {'    '}siteId: <span className="text-green-400">"YOUR_24_CHAR_SITE_ID"</span>, <span className="text-gray-500">// {t('docs.configuration.required')}</span>{'\n'}
                          {'    '}position: <span className="text-green-400">"bottom-right"</span>,        <span className="text-gray-500">// {t('docs.configuration.optional')}</span>{'\n'}
                          {'    '}theme: <span className="text-green-400">"system"</span>,                 <span className="text-gray-500">// {t('docs.configuration.optional')}</span>{'\n'}
                          {'    '}primaryColor: <span className="text-green-400">"#4f46e5"</span>          <span className="text-gray-500">// {t('docs.configuration.optional')}</span>{'\n'}
                          {'  }'};{'\n'}
                          <span className="text-pink-400">&lt;/script&gt;</span>{'\n\n'}
                          <span className="text-gray-500">&lt;!-- Core Engine --&gt;</span>{'\n'}
                          <span className="text-pink-400">&lt;script</span> <span className="text-purple-400">src=</span><span className="text-green-400">"https://cdn.support.io/widget/v1/core.js"</span> <span className="text-purple-400">async defer</span><span className="text-pink-400">&gt;&lt;/script&gt;</span>
                        </code>
                      </pre>
                    </div>
                  </div>
                </div>

                <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/60 dark:border-emerald-500/20 rounded-xl p-5 sm:p-6 flex gap-4 items-start">
                  <div className="p-2 bg-emerald-100 dark:bg-emerald-500/20 rounded-full text-emerald-600 dark:text-emerald-400 shrink-0 mt-1">
                    <Check className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-emerald-900 dark:text-emerald-300 mb-1">
                      {t('docs.installation.ready.title')}
                    </h4>
                    <p className="text-emerald-800/80 dark:text-emerald-200/80 text-sm sm:text-base">
                      {t('docs.installation.ready.description')}
                    </p>
                  </div>
                </div>
              </section>

              {/* Configuration Section */}
              <section id="configuration" className="bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700/50 p-6 sm:p-8 scroll-mt-32 transition-colors">
                <div className="flex items-center gap-4 mb-8">
                  <div className="p-3 bg-purple-100 dark:bg-purple-500/20 rounded-xl text-purple-600 dark:text-purple-400">
                    <Settings className="w-6 h-6" />
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                    {t('docs.configuration.title')}
                  </h2>
                </div>

                <p className="text-gray-600 dark:text-gray-300 text-base lg:text-lg mb-8">
                  {t('docs.configuration.description')}
                </p>

                <div className="grid gap-4">
                  <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-5 border border-gray-100 dark:border-gray-700/50 hover:border-indigo-300 dark:hover:border-indigo-500/30 transition-colors">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <code className="px-3 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-indigo-600 dark:text-indigo-400 font-mono font-bold text-sm shadow-sm">siteId</code>
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 px-2.5 py-1 rounded w-fit">
                          {t('docs.configuration.required')}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400 font-mono">string</span>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                      {t('docs.configuration.siteId')}
                    </p>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-5 border border-gray-100 dark:border-gray-700/50 hover:border-indigo-300 dark:hover:border-indigo-500/30 transition-colors">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <code className="px-3 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-indigo-600 dark:text-indigo-400 font-mono font-bold text-sm shadow-sm">position</code>
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2.5 py-1 rounded w-fit">
                          {t('docs.configuration.optional')}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400 font-mono">enum</span>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-4">
                      {t('docs.configuration.position')}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {['bottom-right', 'bottom-left', 'top-right', 'top-left'].map(pos => (
                        <span key={pos} className="text-xs font-mono bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2.5 py-1 rounded border border-gray-200 dark:border-gray-700 shadow-sm">{pos}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              {/* Advanced Features Matrix */}
              <section id="features" className="scroll-mt-32">
                <div className="flex items-center gap-4 mb-8">
                  <div className="p-3 bg-rose-100 dark:bg-rose-500/20 rounded-xl text-rose-600 dark:text-rose-400">
                    <Layers className="w-6 h-6" />
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                    {t('docs.features.title')}
                  </h2>
                </div>

                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="bg-white dark:bg-gray-800/50 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700/50 hover:shadow-md transition-shadow group">
                    <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-500/10 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-5 border border-indigo-100 dark:border-indigo-500/20 transition-colors">
                      <Activity className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t('docs.features.realtime.title')}</h3>
                    <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">{t('docs.features.realtime.description')}</p>
                  </div>

                  <div className="bg-white dark:bg-gray-800/50 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700/50 hover:shadow-md transition-shadow group">
                    <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-500/10 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-5 border border-emerald-100 dark:border-emerald-500/20 transition-colors">
                      <Code className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t('docs.features.easy.title')}</h3>
                    <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">{t('docs.features.easy.description')}</p>
                  </div>

                  <div className="bg-white dark:bg-gray-800/50 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700/50 hover:shadow-md transition-shadow group">
                    <div className="w-12 h-12 bg-amber-50 dark:bg-amber-500/10 group-hover:bg-amber-100 dark:group-hover:bg-amber-500/20 rounded-xl flex items-center justify-center text-amber-600 dark:text-amber-400 mb-5 border border-amber-100 dark:border-amber-500/20 transition-colors">
                      <Settings className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t('docs.features.customizable.title')}</h3>
                    <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">{t('docs.features.customizable.description')}</p>
                  </div>

                  <div className="bg-white dark:bg-gray-800/50 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700/50 hover:shadow-md transition-shadow group">
                    <div className="w-12 h-12 bg-cyan-50 dark:bg-cyan-500/10 group-hover:bg-cyan-100 dark:group-hover:bg-cyan-500/20 rounded-xl flex items-center justify-center text-cyan-600 dark:text-cyan-400 mb-5 border border-cyan-100 dark:border-cyan-500/20 transition-colors">
                      <Globe className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t('docs.features.analytics.title')}</h3>
                    <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">{t('docs.features.analytics.description')}</p>
                  </div>
                </div>
              </section>

              {/* Benefits Section & CTA */}
              <section id="benefits" className="scroll-mt-32 pt-6">
                <div className="bg-gradient-to-br from-[#0B0D17] to-indigo-950 dark:from-indigo-950 dark:to-purple-900 rounded-3xl p-8 sm:p-10 lg:p-12 text-white shadow-2xl relative overflow-hidden border border-indigo-500/20">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl"></div>
                  <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl"></div>

                  <div className="relative z-10">
                    <h2 className="text-3xl md:text-4xl font-extrabold mb-10 w-full flex items-center gap-3 border-b border-indigo-500/20 pb-6">
                      <Shield className="w-8 h-8 text-indigo-400" />
                      {t('docs.benefits.title')}
                    </h2>

                    <div className="grid md:grid-cols-2 gap-8 mb-12">
                      <div className="flex gap-4">
                        <div className="w-10 h-10 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center shrink-0 border border-white/20">
                          <Check className="w-5 h-5 text-indigo-300" />
                        </div>
                        <div>
                          <h3 className="font-bold text-lg mb-2 text-indigo-100">{t('docs.benefits.satisfaction.title')}</h3>
                          <p className="text-indigo-200/70 text-sm leading-relaxed">{t('docs.benefits.satisfaction.description')}</p>
                        </div>
                      </div>

                      <div className="flex gap-4">
                        <div className="w-10 h-10 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center shrink-0 border border-white/20">
                          <Check className="w-5 h-5 text-indigo-300" />
                        </div>
                        <div>
                          <h3 className="font-bold text-lg mb-2 text-indigo-100">{t('docs.benefits.conversion.title')}</h3>
                          <p className="text-indigo-200/70 text-sm leading-relaxed">{t('docs.benefits.conversion.description')}</p>
                        </div>
                      </div>

                      <div className="flex gap-4">
                        <div className="w-10 h-10 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center shrink-0 border border-white/20">
                          <Check className="w-5 h-5 text-indigo-300" />
                        </div>
                        <div>
                          <h3 className="font-bold text-lg mb-2 text-indigo-100">{t('docs.benefits.availability.title')}</h3>
                          <p className="text-indigo-200/70 text-sm leading-relaxed">{t('docs.benefits.availability.description')}</p>
                        </div>
                      </div>

                      <div className="flex gap-4">
                        <div className="w-10 h-10 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center shrink-0 border border-white/20">
                          <Check className="w-5 h-5 text-indigo-300" />
                        </div>
                        <div>
                          <h3 className="font-bold text-lg mb-2 text-indigo-100">{t('docs.benefits.insights.title')}</h3>
                          <p className="text-indigo-200/70 text-sm leading-relaxed">{t('docs.benefits.insights.description')}</p>
                        </div>
                      </div>
                    </div>

                    <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-6">
                      <div>
                        <h4 className="text-xl font-bold mb-2">{t('docs.cta.title')}</h4>
                        <p className="text-indigo-200/80 text-sm max-w-sm">{t('docs.cta.description')}</p>
                      </div>
                      <div className="flex gap-3">
                        <Link to="/register" className="px-6 py-3 bg-white text-indigo-900 hover:bg-indigo-50 font-bold rounded-xl transition-colors shadow-lg shadow-white/10 whitespace-nowrap">
                          {t('docs.cta.button')}
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

            </div>
          </div>
        </div>

        {/* Render the standard footer instead of duplicating it */}
      </div>
    </>
  );
};

export default Docs;
