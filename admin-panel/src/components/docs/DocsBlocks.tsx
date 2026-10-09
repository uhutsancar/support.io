// The building blocks of the documentation pages: the install guide
// (pages/Docs.tsx) and the API reference (pages/ApiDocs.tsx).

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Check } from 'lucide-react';

export const CodeBlock = ({
  code,
  filename,
  prose = false
}: {
  code: string;
  filename?: string;
  /** Running text to copy (a paragraph), wrapped instead of scrolled. */
  prose?: boolean;
}) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Pano izni yoksa sessiz kal: kod zaten ekranda ve seçilebilir.
    }
  };

  return (
    <div className="rounded-2xl overflow-hidden border border-gray-200 dark:border-white/[0.08] bg-gray-950">
      <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-white/[0.07]">
        <span className="text-[11.5px] font-mono text-gray-400 truncate">{filename || ''}</span>
        <button
          type="button"
          onClick={copy}
          className="shrink-0 inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11.5px] font-medium
            text-gray-300 hover:text-white hover:bg-white/10 transition"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-green-400" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
          {copied ? t('common.copied') : t('common.copy')}
        </button>
      </div>
      <pre
        className={
          prose
            ? 'whitespace-pre-wrap break-words p-4 font-sans text-[13.5px] leading-[1.7] text-gray-200'
            : 'overflow-x-auto p-4 text-[12.5px] leading-[1.7] text-gray-200'
        }
      >
        <code className={prose ? 'font-sans' : undefined}>{code}</code>
      </pre>
    </div>
  );
};

export const H2 = ({ id, children }: { id: string; children: React.ReactNode }) => (
  <h2
    id={id}
    className="scroll-mt-28 text-[26px] sm:text-[30px] font-bold tracking-[-0.03em] text-gray-950 dark:text-white"
  >
    {children}
  </h2>
);

export const Lead = ({ children }: { children: React.ReactNode }) => (
  <p className="mt-3 text-[15.5px] leading-relaxed text-gray-600 dark:text-gray-400 max-w-[64ch]">
    {children}
  </p>
);

export const Mono = ({ children }: { children: React.ReactNode }) => (
  <code className="px-1.5 py-0.5 rounded-md text-[12.5px] font-mono bg-gray-100 dark:bg-white/[0.07] text-indigo-700 dark:text-indigo-300">
    {children}
  </code>
);
