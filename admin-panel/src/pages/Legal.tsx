/**
 * Gizlilik Politikası ve Kullanım Şartları.
 *
 * İçerik çeviri dosyasındadır (`legal.privacy`, `legal.terms`) ve ürünün
 * gerçekten yaptığını anlatır: saklama süreleri retention sweep'iyle,
 * çerez adları kodla, yapay zekâya giden veri asistanın gizlilik kurallarıyla
 * aynıdır. Hukuki inceleme ayrıca yapılmalıdır; burası teknik doğruluğun
 * kaynağıdır.
 */

import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import Shell from '../components/marketing/Shell';
import { Section, asList } from '../components/marketing/kit';

type Kind = 'privacy' | 'terms';

const Legal = ({ kind }: { kind: Kind }) => {
  const { t } = useTranslation();
  const sections = asList<{ h: string; p: string[]; id?: string }>(
    t(`legal.${kind}.sections`, { returnObjects: true })
  );
  return (
    <Shell>
      <Helmet>
        <title>{t(`legal.${kind}.title`) + ' — Support.io'}</title>
        <meta name="description" content={t(`legal.${kind}.meta`)} />
      </Helmet>
      <section className="pt-36 pb-10 sm:pt-44 px-5 sm:px-8 bg-gradient-to-b from-[#f1f2ff] to-white dark:from-[#10122a] dark:to-surface-dark">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-[36px] sm:text-[48px] font-bold tracking-[-0.035em] text-gray-950 dark:text-white">
            {t(`legal.${kind}.title`)}
          </h1>
          <p className="mt-3 text-[14px] text-gray-500 dark:text-gray-400">{t('legal.updated')}</p>
          <p className="mt-6 text-[17px] leading-[1.7] text-gray-700 dark:text-gray-300">
            {t(`legal.${kind}.intro`)}
          </p>
        </div>
      </section>
      <Section tone="plain" size="sm">
        <div className="max-w-3xl mx-auto space-y-10">
          {sections.map((section, i) => (
            <section key={section.h} id={section.id} className="scroll-mt-28">
              <h2 className="text-[20px] font-semibold text-gray-950 dark:text-white">
                {i + 1}. {section.h}
              </h2>
              <div className="mt-3 space-y-3">
                {section.p.map((paragraph) => (
                  <p
                    key={paragraph}
                    className="text-[15.5px] leading-[1.75] text-gray-700 dark:text-gray-300"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
          <p className="pt-6 border-t border-gray-200 dark:border-white/10 text-[14.5px] text-gray-600 dark:text-gray-400">
            {t('legal.contact')}
          </p>
        </div>
      </Section>
    </Shell>
  );
};

export default Legal;
