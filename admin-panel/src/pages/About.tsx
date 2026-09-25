/**
 * Hakkımızda.
 *
 * Sayaçlar ("aktif kullanıcı", "ülke") ve isimsiz ekip bölümü bilerek yok;
 * arkalarında veri yoktu. Sayfa doğrulanabilir olanı anlatır: ürünün neden
 * var olduğu, hangi kararlarla kurulduğu, neyin üzerine inşa edildiği.
 *
 * İletişim bölümü sitenin kendi sohbet balonunu açar — "bize buradan
 * yazabilirsiniz" cümlesinin arkasında gerçekten çalışan ürün var.
 */

import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { Mail, BookOpen, Heart, Eye, Wallet, Accessibility, Layers, MessageCircle } from 'lucide-react';
import Shell, { PageHero, useMarketingRoutes } from '../components/marketing/Shell';
import { Button, Section, SectionHead, Card, Eyebrow, Photo, Reveal } from '../components/marketing/kit';
import { openSiteChat, siteChatAvailable } from '../components/marketing/siteChat';

const PRINCIPLES = [
  { key: 'own', icon: Wallet, tone: 'text-indigo-600 dark:text-indigo-400' },
  { key: 'plain', icon: Eye, tone: 'text-emerald-600 dark:text-emerald-400' },
  { key: 'honest', icon: Heart, tone: 'text-rose-600 dark:text-rose-400' },
  { key: 'accessible', icon: Accessibility, tone: 'text-violet-600 dark:text-violet-400' }
];

const STACK = [
  { name: 'React + Vite', role: 'aboutPage.stack.frontend' },
  { name: 'Node.js + Express', role: 'aboutPage.stack.backend' },
  { name: 'PostgreSQL', role: 'aboutPage.stack.db' },
  { name: 'Socket.IO + Redis', role: 'aboutPage.stack.realtime' },
  { name: 'Amazon S3', role: 'aboutPage.stack.storage' },
  { name: 'Shadow DOM', role: 'aboutPage.stack.widget' }
];

const About = () => {
  const { t } = useTranslation();
  const routes = useMarketingRoutes();

  return (
    <Shell>
      <Helmet>
        <title>{t('aboutPage.meta.title') + ' — Support.io'}</title>
        <meta name="description" content={t('aboutPage.meta.description')} />
      </Helmet>

      <PageHero eyebrow={t('aboutPage.eyebrow')} title={t('aboutPage.title')} description={t('aboutPage.description')} />

      <section className="px-5 sm:px-8 -mt-4">
        <Reveal className="max-w-6xl mx-auto">
          <Photo
            src="/photos/team.webp"
            alt={t('homePage.trustPhotoAlt')}
            eager
            className="aspect-[16/7] rounded-[32px] shadow-panel-lg"
          />
        </Reveal>
      </section>

      {/* ------------------------------------------------------------ hikâye */}
      <Section tone="plain">
        <div className="grid lg:grid-cols-[minmax(0,.7fr)_minmax(0,1.3fr)] gap-10 lg:gap-16">
          <Reveal>
            <Eyebrow index={1}>{t('aboutPage.storyEyebrow')}</Eyebrow>
          </Reveal>
          <div className="space-y-6 max-w-[64ch]">
            {['p1', 'p2', 'p3'].map((key, i) => (
              <Reveal key={key} delay={i * 0.06}>
                <p
                  className={
                    i === 0
                      ? 'text-[22px] sm:text-[26px] font-semibold tracking-[-0.02em] leading-[1.4] text-gray-950 dark:text-white'
                      : 'text-[16.5px] leading-[1.75] text-gray-700 dark:text-gray-300'
                  }
                >
                  {t('aboutPage.story.' + key)}
                </p>
              </Reveal>
            ))}
          </div>
        </div>
      </Section>

      {/* ---------------------------------------------------------- ilkeler */}
      <Section tone="mist">
        <SectionHead
          index={2}
          eyebrow={t('aboutPage.principlesEyebrow')}
          title={t('aboutPage.principlesTitle')}
          description={t('aboutPage.principlesDesc')}
        />
        <div className="mt-10 grid sm:grid-cols-2 gap-4">
          {PRINCIPLES.map((p, i) => (
            <Reveal key={p.key} delay={i * 0.06}>
              <Card className="h-full p-7">
                <p.icon className={['w-6 h-6', p.tone].join(' ')} strokeWidth={1.7} />
                <h3 className="mt-5 text-[18px] font-semibold text-gray-950 dark:text-white">
                  {t('aboutPage.principles.' + p.key + '.title')}
                </h3>
                <p className="mt-2.5 text-[14.5px] leading-[1.7] text-gray-600 dark:text-gray-400">
                  {t('aboutPage.principles.' + p.key + '.body')}
                </p>
              </Card>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ------------------------------------------------------------ teknik */}
      <Section tone="plain">
        <div className="grid lg:grid-cols-[minmax(0,.7fr)_minmax(0,1.3fr)] gap-10 lg:gap-16">
          <Reveal>
            <Eyebrow index={3}>{t('aboutPage.stackEyebrow')}</Eyebrow>
            <p className="mt-4 text-[14.5px] leading-relaxed text-gray-600 dark:text-gray-400 max-w-[36ch]">
              {t('aboutPage.stackNote')}
            </p>
          </Reveal>
          <ul className="grid sm:grid-cols-2 gap-3">
            {STACK.map((item, i) => (
              <Reveal as="li" key={item.name} delay={i * 0.04}>
                <Card className="p-5 h-full flex items-start gap-3">
                  <Layers className="w-[18px] h-[18px] mt-0.5 text-sky-600 dark:text-sky-400 shrink-0" strokeWidth={1.8} />
                  <span className="min-w-0">
                    <span className="block text-[14.5px] font-semibold text-gray-950 dark:text-white">{item.name}</span>
                    <span className="block mt-0.5 text-[13px] leading-relaxed text-gray-600 dark:text-gray-400">
                      {t(item.role)}
                    </span>
                  </span>
                </Card>
              </Reveal>
            ))}
          </ul>
        </div>
      </Section>

      {/* ---------------------------------------------------------- iletişim */}
      <Section tone="deep">
        <div className="grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)] gap-12 items-center">
          <Reveal>
            <Eyebrow index={4} className="!text-indigo-300">
              {t('aboutPage.contactEyebrow')}
            </Eyebrow>
            <p className="mt-5 text-[20px] sm:text-[24px] font-semibold leading-[1.45] tracking-[-0.015em] text-white max-w-[40ch]">
              {t('aboutPage.contactBody')}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {siteChatAvailable && (
                <Button as="button" type="button" onClick={() => openSiteChat()} arrow>
                  <MessageCircle className="w-4 h-4" /> {t('homePage.faq.chat')}
                </Button>
              )}
              <Button href="mailto:destek@support.io" className="bg-white/10 text-white border border-white/20 hover:bg-white/[0.16] shadow-none">
                <Mail className="w-4 h-4" /> destek@support.io
              </Button>
              <Button to={routes.docs} className="bg-white/10 text-white border border-white/20 hover:bg-white/[0.16] shadow-none">
                <BookOpen className="w-4 h-4" /> {t('landing.home.btnDocs')}
              </Button>
            </div>
          </Reveal>
          <Reveal y={30}>
            <Photo src="/photos/reception.webp" alt="" className="aspect-[4/3.2] rounded-[28px]" />
          </Reveal>
        </div>
      </Section>
    </Shell>
  );
};

export default About;
