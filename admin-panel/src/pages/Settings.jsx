import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

const Settings = () => {
  const { theme, setLightTheme, setDarkTheme, isDark } = useTheme();

  return (
    <>
      <Helmet>
        <title>Ayarlar - Support.io Admin</title>
        <meta name="description" content="Support.io uygulama ayarlarınızı yönetin. Tema, bildirim ve diğer tercihleri düzenleyin." />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Ayarlar</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Uygulama tercihlerinizi yönetin
          </p>
        </div>

        {/* Tema Ayarları */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 transition-colors duration-200">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Görünüm
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Uygulamanın tema ayarlarını özelleştirin
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div className="mb-4 sm:mb-0">
                <h3 className="text-base font-medium text-gray-900 dark:text-white">
                  Tema Modu
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Açık veya koyu tema seçin
                </p>
              </div>

              <div className="flex gap-3">
                {/* Light Mode */}
                <button
                  onClick={setLightTheme}
                  className={`flex items-center gap-2 px-4 py-3 rounded-lg border-2 transition-all duration-200 ${
                    theme === 'light'
                      ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <Sun className="w-5 h-5" />
                  <span className="font-medium">Açık</span>
                </button>

                {/* Dark Mode */}
                <button
                  onClick={setDarkTheme}
                  className={`flex items-center gap-2 px-4 py-3 rounded-lg border-2 transition-all duration-200 ${
                    theme === 'dark'
                      ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <Moon className="w-5 h-5" />
                  <span className="font-medium">Koyu</span>
                </button>
              </div>
            </div>

            {/* Önizleme */}
            <div className="mt-8 p-6 bg-gray-100 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 transition-colors duration-200">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
                Önizleme
              </h4>
              <div className="space-y-3">
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm transition-colors duration-200">
                  <h5 className="font-semibold text-gray-900 dark:text-white mb-2">
                    Örnek Başlık
                  </h5>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Bu bir örnek metin içeriğidir. Seçtiğiniz temaya göre renkler değişecektir.
                  </p>
                  <button className="mt-3 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors duration-200">
                    Örnek Buton
                  </button>
                </div>
              </div>
            </div>

            {/* Bilgilendirme */}
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg transition-colors duration-200">
              <div className="flex gap-3">
                <Monitor className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h5 className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-1">
                    Tema Tercihiniz Kaydedildi
                  </h5>
                  <p className="text-sm text-blue-700 dark:text-blue-400">
                    Seçtiğiniz tema otomatik olarak kaydedilir ve bir sonraki ziyaretinizde hatırlanır.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Diğer Ayarlar (Gelecek özellikler için) */}
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 transition-colors duration-200">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Bildirimler
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Bildirim tercihlerinizi yönetin
          </p>
          <div className="text-sm text-gray-500 dark:text-gray-500 italic">
            Yakında eklenecek...
          </div>
        </div>
      </div>
      </div>
    </>
  );
};

export default Settings;
