import { useRef, useCallback } from 'react';

interface Options {
    threshold?: number;
    onLongPress: () => void;
    onClick?: () => void;
}

export function useLongPress({ onLongPress, onClick, threshold = 500 }: Options) {
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const isLongPress = useRef(false);

    const start = useCallback((event: React.MouseEvent | React.TouchEvent) => {
        isLongPress.current = false;
        timerRef.current = setTimeout(() => {
            isLongPress.current = true;
            onLongPress();
        }, threshold);
    }, [onLongPress, threshold]);

    const stop = useCallback((event: React.MouseEvent | React.TouchEvent) => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }

        // If it wasn't a long press, trigger click
        if (!isLongPress.current && onClick) {
            onClick();
        }
    }, [onClick]);

    return {
        onMouseDown: start,
        onMouseUp: stop,
        onMouseLeave: stop,
        onTouchStart: start,
        onTouchEnd: stop,
    };
}
