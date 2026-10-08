/**
 * Kendi kendine oynayan sohbet — ziyaretçinin gördüğü balonun içi.
 *
 * Statik bir ekran görüntüsü "mesaj anında düşer" ve "temsilci konuşmaya
 * katılır" cümlelerini anlatamıyordu; bunlar zamanla olan şeyler. Bileşen
 * ekrana girince senaryoyu baştan oynatır: ziyaretçi mesajı hemen, cevaplar
 * kısa bir "yazıyor…" göstergesinden sonra gelir. Senaryo bitince bir süre
 * bekler ve başa sarar. Ekrandan çıkınca durur; görünmeyen bir döngü pil
 * harcamaz.
 *
 * "Hareketi azalt" seçiliyse döngü oynamaz, bütün konuşma bir kerede görünür.
 *
 * Senaryo i18n'den gelir (`demoChat.<name>`); her satır bir tür taşır:
 * visitor, assistant (yapay zekâ asistanının yanıtı), agent, note (ortalanmış
 * sistem satırı) veya article (balonun yardım bölümünden gelen SSS cevabı).
 * İçerik temsilîdir.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'motion/react';
import { BookOpen, Send, Sparkles, UserRound } from 'lucide-react';
import { asList } from './kit';
import { LogoMark } from '../Logo';

export interface ChatLine {
  from: 'visitor' | 'assistant' | 'agent' | 'note' | 'article';
  /** Shown under an assistant answer: the FAQ entry it came from. */
  source?: string;
  text?: string;
  name?: string;
}

const TYPING_MS = 1100;
const READ_MS = 1500;
const RESTART_MS = 4200;

const Typing = () => (
  <div className="inline-flex items-center gap-1 px-3 py-2.5 rounded-2xl rounded-bl-md bg-white dark:bg-white/[0.07] border border-gray-200/80 dark:border-transparent">
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-typing"
        style={{ animationDelay: i * 0.18 + 's' }}
      />
    ))}
  </div>
);

const Bubble = ({
  line,
  articleName,
  assistantName
}: {
  line: ChatLine;
  articleName: string;
  assistantName: string;
}) => {
  if (line.from === 'note') {
    return (
      <div className="flex justify-center py-0.5">
        <span className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-gray-200/70 dark:bg-white/[0.07] text-gray-600 dark:text-gray-300">
          {line.text}
        </span>
      </div>
    );
  }
  if (line.from === 'visitor') {
    return (
      <div className="ml-auto max-w-[84%] px-3 py-2 rounded-2xl rounded-br-md bg-indigo-600 text-white text-[12px] leading-relaxed">
        {line.text}
      </div>
    );
  }
  const isArticle = line.from === 'article';
  const isAssistant = line.from === 'assistant';
  return (
    <div className="max-w-[86%]">
      <span className="mb-1 flex items-center gap-1 text-[9.5px] font-medium text-gray-500 dark:text-gray-400">
        {isAssistant ? (
          <Sparkles className="w-3 h-3 text-violet-500" />
        ) : isArticle ? (
          <BookOpen className="w-3 h-3 text-sky-500" />
        ) : (
          <UserRound className="w-3 h-3 text-emerald-500" />
        )}
        {isAssistant ? assistantName : isArticle ? articleName : line.name}
      </span>
      <div className="px-3 py-2 rounded-2xl rounded-bl-md bg-white dark:bg-white/[0.07] border border-gray-200/80 dark:border-transparent text-[12px] leading-relaxed text-gray-800 dark:text-gray-100">
        {line.text}
      </div>
      {line.source && (
        <span className="mt-1 flex items-center gap-1 text-[9.5px] text-gray-500 dark:text-gray-400">
          <BookOpen className="w-3 h-3" /> {line.source}
        </span>
      )}
    </div>
  );
};

export const ChatPlayer = ({
  script,
  className = '',
  height = 360
}: {
  /** Key under `demoChat` holding the lines. */
  script: string;
  className?: string;
  height?: number;
}) => {
  const { t } = useTranslation();
  const ref = React.useRef<HTMLDivElement | null>(null);
  const scroller = React.useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { amount: 0.4 });
  const reduced = useReducedMotion();
  const lines = asList<ChatLine>(t('demoChat.' + script + '.lines', { returnObjects: true }));
  const [shown, setShown] = React.useState(0);
  const [typing, setTyping] = React.useState(false);

  React.useEffect(() => {
    if (reduced || !inView) return undefined;
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const wait = (ms: number) =>
      new Promise<void>((resolve) => timers.push(setTimeout(resolve, ms)));

    (async () => {
      while (!cancelled) {
        setShown(0);
        await wait(500);
        for (let i = 0; i < lines.length && !cancelled; i++) {
          if (lines[i].from !== 'visitor' && lines[i].from !== 'note') {
            setTyping(true);
            await wait(TYPING_MS);
            setTyping(false);
          }
          if (cancelled) return;
          setShown(i + 1);
          await wait(READ_MS);
        }
        await wait(RESTART_MS);
      }
    })();

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      setTyping(false);
    };
    // `lines` is rebuilt every render from i18n; its length is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, reduced, lines.length]);

  // "Hareketi azalt" seçiliyse döngü hiç başlamaz; konuşmanın tamamı görünür.
  const visible = reduced ? lines.length : shown;

  React.useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: reduced ? 'auto' : 'smooth' });
  }, [visible, typing, reduced]);

  return (
    <div
      ref={ref}
      className={[
        'w-full rounded-[22px] overflow-hidden bg-white dark:bg-[#171a29]',
        'border border-gray-200/90 dark:border-white/[0.09] shadow-panel-lg',
        className
      ].join(' ')}
    >
      <div className="px-4 py-3 bg-indigo-600 text-white flex items-center gap-2.5">
        {/* Bizim balonumuz bizim logomuzla açılır; başka bir marka baş harfiyle. */}
        <span className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-[12px] font-semibold">
          {t('demoChat.' + script + '.brand') === 'Support.io' ? (
            <LogoMark size={22} rounded={false} color="#4F46E5" />
          ) : (
            t('demoChat.' + script + '.brand').charAt(0)
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold leading-tight truncate">
            {t('demoChat.' + script + '.brand')}
          </span>
          <span className="flex items-center gap-1 text-[10.5px] text-white/80">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
            {t('demoChat.status')}
          </span>
        </span>
      </div>

      <div
        ref={scroller}
        className="px-3.5 py-3.5 space-y-2.5 overflow-hidden bg-gray-50 dark:bg-transparent"
        style={{ height }}
        aria-live="off"
      >
        <AnimatePresence initial={false}>
          {lines.slice(0, visible).map((line, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
              className="flex flex-col"
            >
              <Bubble
                line={line}
                articleName={t('demoChat.articleName')}
                assistantName={t('demoChat.assistantName')}
              />
            </motion.div>
          ))}
          {typing && (
            <motion.div
              key="typing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Typing />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="px-3.5 py-3 border-t border-gray-200 dark:border-white/[0.07] flex items-center gap-2">
        <span className="flex-1 text-[11.5px] text-gray-500 dark:text-gray-400">
          {t('viz.widget.composer')}
        </span>
        <span className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center">
          <Send className="w-3.5 h-3.5 text-white" />
        </span>
      </div>
    </div>
  );
};

export default ChatPlayer;
