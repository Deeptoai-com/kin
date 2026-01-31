import { useCallback } from 'react';
import { useTheme } from '~/components/theme-provider';
import { useIntlayer } from 'react-intlayer';
import { logger } from '~/lib/logger';
import { toLocalizedString } from '~/lib/utils';
import { SettingsCard } from '../shared/SettingsCard';
import { LocaleSwitcher } from '~/components/locale-switcher';
import { Globe, Palette, Sun, Moon, Monitor } from 'lucide-react';

interface PreferencesSettingsProps {
  readonly projectId?: string | null;
}

export function PreferencesSettings({ projectId }: PreferencesSettingsProps) {
  const content = useIntlayer('settings');
  const { theme, setTheme } = useTheme();

  const handleThemeChange = useCallback(
    (newTheme: 'light' | 'dark' | 'system') => {
      logger.debug('PreferencesSettings.themeChange', { theme: newTheme });
      setTheme(newTheme);
    },
    [setTheme]
  );

  const getThemeIcon = (themeOption: 'light' | 'dark' | 'system') => {
    switch (themeOption) {
      case 'light':
        return <Sun className="h-4 w-4" />;
      case 'dark':
        return <Moon className="h-4 w-4" />;
      case 'system':
        return <Monitor className="h-4 w-4" />;
    }
  };

  const getThemeDescription = (themeOption: 'light' | 'dark' | 'system') => {
    switch (themeOption) {
      case 'light':
        return content.ui.lightDescription;
      case 'dark':
        return content.ui.darkDescription;
      case 'system':
        return content.ui.systemDescription;
    }
  };

  const getThemeLabel = (themeOption: 'light' | 'dark' | 'system') => {
    switch (themeOption) {
      case 'light':
        return content.ui.light;
      case 'dark':
        return content.ui.dark;
      case 'system':
        return content.ui.system;
    }
  };

  return (
    <div className="space-y-6">
      <SettingsCard
        icon={<Palette className="h-5 w-5" />}
        title={toLocalizedString(content.ui.interfaceTheme)}
        description={toLocalizedString(content.ui.customizeAppearance)}
      >
        <div className="space-y-4">
          <div className="space-y-3">
            <div className="text-sm font-medium">{content.ui.theme}</div>
            <div className="grid gap-2">
              {(['light', 'dark', 'system'] as const).map((themeOption) => (
                <label
                  key={themeOption}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-background hover:bg-accent/50 cursor-pointer transition-colors"
                >
                  <input
                    type="radio"
                    name="theme"
                    className="sr-only"
                    checked={theme === themeOption}
                    onChange={() => handleThemeChange(themeOption)}
                  />
                  <div className={`flex items-center justify-center w-8 h-8 rounded-md border ${theme === themeOption ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted text-muted-foreground'}`}>
                    {getThemeIcon(themeOption)}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium capitalize">{getThemeLabel(themeOption)}</div>
                    <div className="text-sm text-muted-foreground">
                      {getThemeDescription(themeOption)}
                    </div>
                  </div>
                  {theme === themeOption && (
                    <div className="w-2 h-2 rounded-full bg-primary" />
                  )}
                </label>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <div className={`flex items-center justify-center w-10 h-10 rounded-md bg-background border`}>
                {getThemeIcon(theme)}
              </div>
              <div>
                <div className="font-medium">{content.ui.currentTheme}</div>
                <div className="text-sm text-muted-foreground">
                  {toLocalizedString(content.ui.mode).replace('{theme}', theme === 'system' ? toLocalizedString(content.ui.system) : theme === 'light' ? toLocalizedString(content.ui.light) : toLocalizedString(content.ui.dark))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard
        icon={<Globe className="h-5 w-5" />}
        title={toLocalizedString(content.ui.languageTitle)}
        description={toLocalizedString(content.ui.languageDescription)}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground">{content.ui.currentLanguage}</div>
          <LocaleSwitcher />
        </div>
      </SettingsCard>
    </div>
  );
}
