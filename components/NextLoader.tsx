'use client'

import NextTopLoader from 'nextjs-toploader';

export default function NextLoader() {
    return (
        <NextTopLoader
            color="#f59e0b"
            initialPosition={0.08}
            crawlSpeed={200}
            height={5}
            crawl={true}
            showSpinner={false}
            easing="ease"
            speed={200}
            shadow="0 0 10px #f59e0b,0 0 5px #f59e0b"
            zIndex={99999}
            showAtBottom={false}
        />
    );
}
