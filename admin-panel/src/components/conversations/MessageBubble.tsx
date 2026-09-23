// One message in a conversation.
//
// Fifty-five lines of markup inside a `.map()`, in which the sender type was
// re-tested seven separate times to decide alignment, background, order and
// attachment styling. Deciding it once at the top makes the three cases —
// visitor, agent, bot — legible, and moves the `getFileIcon` helper that lived
// in the page body next to the only markup that uses it.

import { CheckCheck, File, FileText, Image as ImageIcon } from 'lucide-react';
import { formatFileSize, formatTime } from '../../lib/format';
import { apiAssetUrl } from '../../lib/runtime';
import type { Message } from '../../types/api';

export interface MessageBubbleProps {
  message: Message;
}

/**
 * The icon for an attachment, from its media type.
 *
 * Exported because the composer's "file selected" preview needs the same icon
 * for the same file; it had its own copy of this function.
 */
export function attachmentIcon(mimeType: string | null | undefined) {
  if (mimeType?.includes('image')) return <ImageIcon className="w-4 h-4" />;
  if (mimeType?.includes('pdf')) return <FileText className="w-4 h-4" />;
  return <File className="w-4 h-4" />;
}

/** Opens an attachment in a new tab, without handing it a reference back. */
function openAttachment(url: string | null | undefined): void {
  const href = apiAssetUrl(url);
  if (href) window.open(href, '_blank', 'noopener,noreferrer');
}

const BUBBLE_STYLES: Record<string, string> = {
  visitor:
    'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white',
  bot: 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200',
  agent: 'bg-indigo-600 text-white'
};

const MessageBubble = ({ message }: MessageBubbleProps) => {
  // The visitor's messages sit on the left; everything we send — an agent's
  // reply or the bot's — sits on the right.
  const fromVisitor = message.senderType === 'visitor';
  const bubbleStyle = BUBBLE_STYLES[message.senderType] ?? BUBBLE_STYLES.agent;

  const attachment =
    message.fileData && (message.messageType === 'file' || message.messageType === 'image')
      ? message.fileData
      : null;

  return (
    <div className={`flex ${fromVisitor ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`max-w-[90%] sm:max-w-[80%] md:max-w-md lg:max-w-lg ${fromVisitor ? '' : 'order-2'}`}
      >
        {!fromVisitor && (
          <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mb-0.5 sm:mb-1 text-right transition-colors duration-200 truncate">
            {message.senderName}
          </p>
        )}

        <div
          className={`px-2 sm:px-2.5 lg:px-3 py-1.5 sm:py-2 rounded-lg transition-colors duration-200 break-words overflow-wrap-anywhere ${bubbleStyle}`}
        >
          <p className="text-xs sm:text-sm">{message.content}</p>

          {attachment && (
            <div className="mt-2">
              {message.messageType === 'image' ? (
                <img
                  src={apiAssetUrl(attachment.url)}
                  alt={attachment.originalName}
                  className="max-w-full max-h-48 rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => openAttachment(attachment.url)}
                />
              ) : (
                <div
                  className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:opacity-90 transition-opacity ${
                    fromVisitor ? 'bg-gray-100 dark:bg-gray-700' : 'bg-white/20'
                  }`}
                  onClick={() => openAttachment(attachment.url)}
                >
                  <div
                    className={`p-2 rounded ${
                      fromVisitor
                        ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400'
                        : 'bg-white/30 text-white'
                    }`}
                  >
                    {attachmentIcon(attachment.mimeType)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{attachment.originalName}</p>
                    <p className="text-[10px] opacity-75">{formatFileSize(attachment.size)}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end space-x-1 mt-1">
          <p className="text-xs text-gray-400 dark:text-gray-500 transition-colors duration-200">
            {formatTime(message.createdAt)}
          </p>
          {message.senderType === 'agent' && message.isRead && (
            <CheckCheck className="w-3 h-3 text-indigo-600 dark:text-indigo-400 transition-colors duration-200" />
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
