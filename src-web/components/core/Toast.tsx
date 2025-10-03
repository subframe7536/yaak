import type { ShowToastRequest } from '@yaakapp-internal/plugins';
import classNames from 'classnames';
import * as m from 'motion/react-m';
import type { ReactNode } from 'react';
import React from 'react';
import { useKey } from 'react-use';
import type { IconProps } from './Icon';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import { VStack } from './Stacks';

export interface ToastProps {
  children: ReactNode;
  open: boolean;
  onClose: () => void;
  className?: string;
  timeout: number | null;
  action?: (args: { hide: () => void }) => ReactNode;
  icon?: ShowToastRequest['icon'] | null;
  color?: ShowToastRequest['color'];
}

const ICONS: Record<NonNullable<ToastProps['color'] | 'custom'>, IconProps['icon'] | null> = {
  custom: null,
  danger: 'alert_triangle',
  info: 'info',
  notice: 'alert_triangle',
  primary: 'info',
  secondary: 'info',
  success: 'check_circle',
  warning: 'alert_triangle',
};

export function Toast({ children, open, onClose, timeout, action, icon, color }: ToastProps) {
  useKey(
    'Escape',
    () => {
      if (!open) return;
      onClose();
    },
    {},
    [open],
  );

  const toastIcon = icon === null ? null : icon ?? (color && color in ICONS && ICONS[color]);

  return (
    <m.div
      initial={{ opacity: 0, right: '-10%' }}
      animate={{ opacity: 100, right: 0 }}
      exit={{ opacity: 0, right: '-100%' }}
      transition={{ duration: 0.2 }}
      className={classNames('bg-surface m-2 rounded-lg')}
    >
      <div
        className={classNames(
          `x-theme-toast x-theme-toast--${color}`,
          'pointer-events-auto overflow-hidden',
          'relative pointer-events-auto bg-surface text-text rounded-lg',
          'border border-border shadow-lg w-[25rem]',
          'grid grid-cols-[1fr_auto]',
        )}
      >
        <div className="px-3 py-3 flex items-start gap-2 w-full">
          {toastIcon && <Icon icon={toastIcon} color={color} className="mt-1" />}
          <VStack space={2} className="w-full">
            <div>{children}</div>
            {action?.({ hide: onClose })}
          </VStack>
        </div>

        <IconButton
          color={color}
          variant="border"
          className="opacity-60 border-0"
          title="Dismiss"
          icon="x"
          onClick={onClose}
        />

        {timeout != null && (
          <div className="w-full absolute bottom-0 left-0 right-0">
            <m.div
              className="bg-surface-highlight h-[3px]"
              initial={{ width: '100%' }}
              animate={{ width: '0%', opacity: 0.2 }}
              transition={{ duration: timeout / 1000, ease: 'linear' }}
            />
          </div>
        )}
      </div>
    </m.div>
  );
}
