import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../contexts/LanguageContext';
import Header from '../components/Header';
import featImg from '../public/images/features-1.jpg';
import { ArrowRight } from 'lucide-react';
const slugify = (s) => s.toString().toLowerCase().replace(/[^a-z0-9ğüşıöçàáâãäåæèéêëìíîïòóôõöùúûüýÿß -]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');
const FeatureDetail = () => {
  const { slug } = useParams();
  const { t } = useTranslation();
  const { language } = useLanguage();
  const features = t('featuresPage.features', { returnObjects: true }) || [];
  const feature = features.find(f => slugify(f.title) === slug);
  if (!feature) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900">
        <Header />
        <main className="max-w-4xl mx-auto p-8">
          <h2 className="text-2xl font-bold">Özellik bulunamadı</h2>
          <p className="mt-4">Geçerli bir özellik sayfası değil veya içerik henüz eklenmedi.</p>
        </main>
      </div>
    );
  }
  const routesBase = language === 'en' ? '/en/features' : '/ozellikler';
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <Header />
      <main className="max-w-7xl mx-auto p-6 lg:p-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          <div className="lg:col-span-2">
            <h1 className="text-3xl md:text-4xl font-bold mb-4">{feature.title}</h1>
            <p className="text-lg text-gray-700 dark:text-gray-300 mb-6">{feature.description}</p>
            <div className="rounded-2xl overflow-hidden shadow-lg mb-6">
              <img src={featImg} alt={feature.title} className="w-full h-auto object-cover block" />
            </div>
            {feature.details ? (
              <div className="prose prose-lg dark:prose-invert text-gray-700 dark:text-gray-300">
                <div dangerouslySetInnerHTML={{ __html: feature.details }} />
              </div>
            ) : (
              <div>
                <h3 className="text-xl font-semibold mb-3">Öne çıkan avantajlar</h3>
                <ul className="list-disc pl-6 space-y-2 text-gray-700 dark:text-gray-300">
                  {feature.benefits && feature.benefits.map((b, i) => <li key={i}>{b}</li>)}
                </ul>
              </div>
            )}
          </div>
          <aside className="p-6 rounded-xl bg-gray-50 dark:bg-gray-800">
            <h4 className="font-semibold mb-4">Hızlı Bilgiler</h4>
            <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300 mb-6">
              <li><strong>Kategori:</strong> {t('features.title') || 'Özellik'}</li>
              <li><strong>Uygunluk:</strong> Tüm planlar / bazı planlar</li>
            </ul>
            <Link to={routesBase} className="inline-flex items-center bg-indigo-600 text-white px-4 py-2 rounded-lg">
              {language === 'en' ? 'Back to features' : 'Özelliklere Dön'}
              <ArrowRight className="ml-2 w-4 h-4" />
            </Link>
          </aside>
        </div>
      </main>
    </div>
  );
}
export default FeatureDetail;
