// One row in the inbox list.
//
// Sixty-five lines of markup that sat inside a `.map()` inside a 1300-line
// page. As a component it can be read on its own, it only re-renders when the
// conversation it draws changes, and the SLA logic below — three mutually
// exclusive states that were written as a nested ternary chain — has a name.

import { AlarmClock, Clock, User, UserCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatDateTime, formatMinutes, formatTime } from '../../lib/format';
import { TagChip } from './TagEditor';
import { conversationStatusBadge, priorityBadge, slaUrgencyClass } from '../../lib/statusStyles';
import type { Conversation } from '../../types/api';

export interface ConversationListItemProps {
  conversation: Conversation;
  selected: boolean;
  onSelect: (conversation: Conversation) => void;
  /** The translated status name; the page owns that table. */
  statusLabel: (status: string) => string;
  /** Ticked for a bulk move (PRD-07); no box is drawn without onToggleChecked. */
  checked?: boolean;
  onToggleChecked?: () => void;
  /** A tag's colour from the workspace's list. */
  tagColor?: (name: string) => string | undefined;
}

/**
 * Which of the three first-response states a conversation is in.
 *
 * Written as a nested ternary in the markup, where the ordering mattered and
 * was not obvious: "breached" has to win over "time remaining", because a
 * breached conversation can still carry a negative remaining value.
 */
type SlaState = 'breached' | 'counting-down' | 'met' | null;

function slaState(sla: Conversation['sla'] | undefined): SlaState {
  if (!sla) return null;
  const remaining = sla.firstResponseTimeRemaining;
  if (sla.firstResponseStatus === 'breached' || (remaining !== null && remaining < 0)) {
    return 'breached';
  }
  if (remaining !== null && remaining !== undefined && remaining >= 0) return 'counting-down';
  if (sla.firstResponseStatus === 'met') return 'met';
  return null;
}

const ConversationListItem = ({
  conversation,
  selected,
  onSelect,
  statusLabel,
  checked = false,
  onToggleChecked,
  tagColor
}: ConversationListItemProps) => {
  const { t } = useTranslation();
  const sla = slaState(conversation.sla);

  const priorityLabel = t(
    `conversations.priorities.${conversation.priority}`,
    conversation.priority
  );

  return (
    <div
      onClick={() => onSelect(conversation)}
      className={`p-2 sm:p-3 lg:p-4 border-b border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 ${
        selected ? 'bg-indigo-50 dark:bg-indigo-900' : ''
      }`}
    >
      <div className="flex items-start justify-between mb-1.5 sm:mb-2 gap-2 min-w-0">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
          {onToggleChecked && (
            <input
              type="checkbox"
              checked={checked}
              onChange={onToggleChecked}
              onClick={(event) => event.stopPropagation()}
              aria-label={t('inboxTools.bulk.select', {
                ticket: conversation.ticketId || `#${conversation.ticketNumber}`
              })}
              className="w-4 h-4 flex-shrink-0 accent-indigo-600 cursor-pointer"
            />
          )}
          <div className="w-7 h-7 sm:w-8 sm:h-8 lg:w-10 lg:h-10 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center transition-colors duration-200 flex-shrink-0">
            <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5 text-indigo-600 dark:text-indigo-400 transition-colors duration-200" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
              <p className="font-medium text-xs sm:text-sm lg:text-base text-gray-900 dark:text-white transition-colors duration-200 truncate flex-1 min-w-0">
                {conversation.ticketId || `#${conversation.ticketNumber}`}
              </p>
              <span
                className={`px-1.5 py-0.5 text-[9px] sm:text-[10px] rounded ${priorityBadge(conversation.priority)} flex-shrink-0`}
              >
                {priorityLabel}
              </span>
            </div>
            <p className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-300 truncate">
              {conversation.visitorName}
            </p>
            <p className="text-[9px] sm:text-[10px] text-gray-600 dark:text-gray-400 transition-colors duration-200 truncate">
              {conversation.currentPage}
            </p>
          </div>
        </div>
        <span
          className={`px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs rounded-full flex-shrink-0 whitespace-nowrap ${conversationStatusBadge(conversation.status)}`}
        >
          {statusLabel(conversation.status)}
        </span>
      </div>

      {conversation.assignedAgent && (
        <div className="mb-1.5 flex items-center gap-1.5">
          <UserCheck className="w-3 h-3 text-blue-700 dark:text-blue-400" />
          <span className="text-[9px] sm:text-[10px] text-blue-700 dark:text-blue-400 font-medium truncate">
            {conversation.assignedAgent.name}
          </span>
        </div>
      )}

      {sla && (
        <div className="mb-1.5 flex items-center gap-2">
          {sla === 'breached' && (
            <span className="text-[9px] sm:text-[10px] text-red-700 dark:text-red-400 font-medium flex items-center gap-1 animate-pulse">
              <Clock className="w-3 h-3" />
              {t('conversations.slaBreach', 'SLA İhlali')}
            </span>
          )}
          {sla === 'counting-down' && (
            <span
              className={`text-[9px] sm:text-[10px] font-medium flex items-center gap-1 ${slaUrgencyClass(conversation.sla?.firstResponseTimeRemaining)}`}
            >
              <Clock className="w-3 h-3" />
              {formatMinutes(conversation.sla?.firstResponseTimeRemaining)}{' '}
              {t('conversations.remaining', 'kaldı')}
            </span>
          )}
          {sla === 'met' && (
            <span className="text-[9px] sm:text-[10px] text-green-800 dark:text-green-400 font-medium flex items-center gap-1">
              <Clock className="w-3 h-3" />✓ {t('conversations.responded', 'Yanıtlandı')}
            </span>
          )}
        </div>
      )}

      {(conversation.tags || []).length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1">
          {conversation.tags.slice(0, 3).map((tag) => (
            <TagChip key={tag} name={tag} color={tagColor?.(tag)} />
          ))}
          {conversation.tags.length > 3 && (
            <span className="text-[10px] text-gray-600 dark:text-gray-400">
              +{conversation.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {conversation.snoozedUntil && new Date(conversation.snoozedUntil) > new Date() && (
        <p className="mb-1.5 flex items-center gap-1 text-[10px] sm:text-xs text-amber-800 dark:text-amber-300">
          <AlarmClock className="w-3 h-3" aria-hidden="true" />
          {t('inboxTools.snooze.until', { time: formatDateTime(conversation.snoozedUntil) })}
        </p>
      )}

      {conversation.lastMessage && (
        <p className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-300 truncate transition-colors duration-200">
          {conversation.lastMessage.content}
        </p>
      )}

      <p className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400 mt-0.5 sm:mt-1 transition-colors duration-200">
        {formatTime(conversation.lastMessageAt || conversation.createdAt)}
      </p>
    </div>
  );
};

export default ConversationListItem;
