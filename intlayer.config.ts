import { type IntlayerConfig, Locales } from 'intlayer';

const config: IntlayerConfig = {
  internationalization: {
    locales: [
      Locales.ENGLISH,
      Locales.FRENCH,
      Locales.JAPANESE,
      Locales.KOREAN,
      Locales.CHINESE_SIMPLIFIED,
      Locales.CHINESE_TRADITIONAL,
    ],
    defaultLocale: Locales.ENGLISH,
  },
  routing: {
    mode: 'no-prefix', // No locale prefix in URL
    storage: 'cookie', // Store locale in cookie
  },
};

export default config;
