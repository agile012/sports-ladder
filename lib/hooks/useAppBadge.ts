'use client';

import { useEffect } from 'react';

export function useAppBadge(count: number) {
    useEffect(() => {
        if ('setAppBadge' in navigator) {
            if (count > 0) {
                navigator.setAppBadge(count).catch((e) => console.error('Failed to set app badge', e));
            } else {
                navigator.clearAppBadge().catch((e) => console.error('Failed to clear app badge', e));
            }
        }
    }, [count]);
}
