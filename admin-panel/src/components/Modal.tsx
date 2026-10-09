/**
 * A dialog the way a screen reader and a keyboard expect it (plan v10 UX-02):
 * named by its title, Tab stays inside, Esc closes, and focus goes back to
 * where it came from. ConfirmDialog and the inbox dialogs are built on it.
 */
import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** The close button's name, in the panel's language. */
  closeLabel: string;
  children?: ReactNode;
  footer?: ReactNode;
  /** Drawn before the title. */
  icon?: ReactNode;
  size?: 'sm' | 'md';
}

const Modal = ({
  open,
  onClose,
  title,
  closeLabel,
  children,
  footer,
  icon,
  size = 'md'
}: ModalProps) => {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  // The handlers below are attached once per opening; they read the newest
  // onClose through this ref.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement as HTMLElement | null;
    const node = panel.current;
    const first =
      node?.querySelector<HTMLElement>('[data-autofocus]') ??
      node?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? node)?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !node) return;
      const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null
      );
      if (!items.length) {
        event.preventDefault();
        return;
      }
      const head = items[0];
      const tail = items[items.length - 1];
      if (event.shiftKey && document.activeElement === head) {
        event.preventDefault();
        tail.focus();
      } else if (!event.shiftKey && document.activeElement === tail) {
        event.preventDefault();
        head.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      previous?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full outline-none ${size === 'sm' ? 'max-w-sm' : 'max-w-md'}`}
      >
        <div className="flex items-start justify-between gap-3 p-5 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 min-w-0">
            {icon}
            <h2 id={titleId} className="text-lg font-bold text-gray-900 dark:text-white">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="p-1 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
        {children && <div className="p-5">{children}</div>}
        {footer && (
          <div className="flex items-center justify-end gap-3 px-5 py-4 bg-gray-50 dark:bg-gray-900/50 rounded-b-2xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;
