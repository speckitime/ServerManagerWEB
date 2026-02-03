import { useCallback } from 'react';
import { toast } from 'sonner';

export const useToast = () => {
  const showSuccess = useCallback((message) => {
    toast.success(message, {
      style: {
        background: '#18181B',
        color: '#22C55E',
        border: '1px solid #27272A',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '0.875rem'
      }
    });
  }, []);

  const showError = useCallback((message) => {
    toast.error(message, {
      style: {
        background: '#18181B',
        color: '#EF4444',
        border: '1px solid #27272A',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '0.875rem'
      }
    });
  }, []);

  const showInfo = useCallback((message) => {
    toast.info(message, {
      style: {
        background: '#18181B',
        color: '#E4E4E7',
        border: '1px solid #27272A',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '0.875rem'
      }
    });
  }, []);

  return { showSuccess, showError, showInfo };
};
