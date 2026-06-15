import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { trpc } from './lib/trpc';
import './styles/global.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: '/trpc',
    }),
  ],
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfigProvider
      locale={zhCN}
      componentSize="small"
      theme={{
        token: {
          colorPrimary: '#2563eb',
          colorLink: '#2563eb',
          colorSuccess: '#059669',
          colorWarning: '#d97706',
          colorError: '#dc2626',
          fontSize: 13,
          fontSizeHeading1: 22,
          fontSizeHeading2: 18,
          fontSizeHeading3: 15,
          controlHeight: 28,
          controlHeightSM: 24,
          padding: 12,
          paddingSM: 8,
          paddingXS: 4,
          paddingContentHorizontal: 12,
          borderRadius: 6,
          borderRadiusSM: 4,
        },
        components: {
          Table: {
            cellPaddingBlock: 6,
            cellPaddingBlockSM: 4,
            cellPaddingInline: 10,
          },
          Descriptions: {
            itemPaddingBottom: 6,
            titleMarginBottom: 8,
          },
          Drawer: {
            padding: 12,
            paddingLG: 12,
          },
          Modal: {
            titleFontSize: 15,
          },
          List: {
            itemPadding: '8px 0',
          },
        },
      }}
    >
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </QueryClientProvider>
      </trpc.Provider>
    </ConfigProvider>
  </StrictMode>,
);
