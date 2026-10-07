/**
 * What the visitor left in the pre-chat form, when they consented to the
 * privacy notice, and how they rated the conversation (plan v10 PRD-04,
 * PRD-05). Shown in the conversation's side panel; renders nothing when
 * there is nothing to show.
 */
import { useTranslation } from 'react-i18next';
import { Phone, ShieldCheck, Star, ThumbsDown, ThumbsUp } from 'lucide-react';
import { formatDateTime } from '../../lib/format';
import type { Conversation } from '../../types/api';

const VisitorFormDetails = ({ conversation }: { conversation: Conversation }) => {
  const { t } = useTranslation();
  const answers = Object.entries(conversation.prechat || {});
  const score = conversation.rating?.score ?? null;
  const low = score !== null && score <= 2;

  return (
    <>
      {conversation.visitorPhone && (
        <div className="flex items-start gap-2 text-gray-600 dark:text-gray-300">
          <Phone className="w-4 h-4 mt-0.5 text-gray-400 flex-shrink-0" />
          <span className="break-all">{conversation.visitorPhone}</span>
        </div>
      )}
      {answers.map(([label, value]) => (
        <div key={label} className="text-gray-600 dark:text-gray-300">
          <span className="block text-[11px] text-gray-400">{label}</span>
          <span className="break-words">{value}</span>
        </div>
      ))}
      {conversation.visitorConsentAt && (
        <div className="flex items-start gap-2 text-gray-600 dark:text-gray-300">
          <ShieldCheck className="w-4 h-4 mt-0.5 text-emerald-500 flex-shrink-0" />
          <span>
            {t('account.chatSettings.consentTitle')} ·{' '}
            {formatDateTime(conversation.visitorConsentAt)}
          </span>
        </div>
      )}
      {score !== null && (
        <div
          className={`flex items-start gap-2 ${low ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-300'}`}
        >
          {score >= 4 ? (
            <ThumbsUp className="w-4 h-4 mt-0.5 flex-shrink-0" />
          ) : low ? (
            <ThumbsDown className="w-4 h-4 mt-0.5 flex-shrink-0" />
          ) : (
            <Star className="w-4 h-4 mt-0.5 flex-shrink-0" />
          )}
          <span>
            {t('account.rating.label')}: {score}/5
            {low ? ` · ${t('account.rating.low')}` : ''}
            {conversation.rating?.feedback ? (
              <span className="block mt-1 italic">“{conversation.rating.feedback}”</span>
            ) : null}
          </span>
        </div>
      )}
    </>
  );
};

export default VisitorFormDetails;
