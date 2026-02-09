import React from 'react';
import { Link } from 'react-router-dom';
import { 
  MessageSquare, 
  Zap, 
  Users, 
  BarChart, 
  Clock, 
  Shield,
  Bell,
  Sparkles,
  Smartphone,
  Globe,
  Settings,
  FileText,
  ArrowRight
} from 'lucide-react';
import Header from '../components/Header';

const Features = () => {
  const mainFeatures = [
    {
      icon: MessageSquare,
      title: 'Gerçek Zamanlı Canlı Sohbet',
      description: 'Müşterilerinizle anlık olarak iletişime geçin. WebSocket teknolojisi sayesinde mesajlar anında iletilir.',
      benefits: [
        'Anlık mesajlaşma',
        'Yazıyor bildirimi',
        'Okundu işareti',
        'Dosya paylaşımı'
      ]
    },
    {
      icon: Users,
      title: 'Çoklu Operatör Desteği',
      description: 'Tüm ekibiniz aynı platform üzerinden çalışabilir. Konuşmaları paylaşın ve müşteri memnuniyetini artırın.',
      benefits: [
        'Sınırsız operatör',
        'Rol yönetimi',
        'Konuşma transferi',
        'Ekip performansı takibi'
      ]
    },
    {
      icon: Globe,
      title: 'Çoklu Site Yönetimi',
      description: 'Birden fazla web sitesini tek bir panelden yönetin. Her site için ayrı ayarlar ve özelleştirmeler.',
      benefits: [
        'Sınırsız site',
        'Site bazlı raporlama',
        'Özel widget tasarımı',
        'Alan adı kontrolü'
      ]
    },
    {
      icon: Sparkles,
      title: 'Otomatik Yanıtlar & Botlar',
      description: 'Sık sorulan soruları otomatik yanıtlayarak zamandan tasarruf edin. Akıllı bot sistemi.',
      benefits: [
        'Özelleştirilebilir bot',
        'Hoş geldin mesajları',
        'Çalışma saatleri',
        'Otomatik yönlendirme'
      ]
    },
    {
      icon: BarChart,
      title: 'Detaylı Analitik & Raporlar',
      description: 'Müşteri etkileşimlerinizi detaylı olarak analiz edin. Performansınızı ölçün ve iyileştirin.',
      benefits: [
        'Konuşma istatistikleri',
        'Yanıt süreleri',
        'Operatör performansı',
        'Ziyaretçi analitiği'
      ]
    },
    {
      icon: Bell,
      title: 'Akıllı Bildirimler',
      description: 'Yeni mesajları kaçırmayın. Masaüstü, e-posta ve mobil bildirimleri ile her zaman haberdar olun.',
      benefits: [
        'Masaüstü bildirimleri',
        'E-posta bildirimleri',
        'Sesli uyarılar',
        'Özelleştirilebilir bildirimler'
      ]
    },
    {
      icon: Smartphone,
      title: 'Mobil Uyumlu',
      description: 'Her cihazda mükemmel çalışır. Müşterileriniz mobil, tablet veya masaüstünden rahatlıkla ulaşabilir.',
      benefits: [
        'Responsive tasarım',
        'PWA desteği',
        'Her cihazda hızlı',
        'Dokunmatik optimize'
      ]
    },
    {
      icon: Settings,
      title: 'Kolay Entegrasyon',
      description: 'Web sitenize dakikalar içinde entegre edin. Tek satır kod ile canlı destek sistemini aktif edin.',
      benefits: [
        'Basit kurulum',
        'Her platforma uyumlu',
        'API desteği',
        'Detaylı dokümantasyon'
      ]
    },
    {
      icon: FileText,
      title: 'Sohbet Geçmişi',
      description: 'Tüm konuşmaları kaydedin ve arşivleyin. Müşteri geçmişine kolayca erişin.',
      benefits: [
        'Sınırsız arşiv',
        'Gelişmiş arama',
        'Dışa aktarma',
        'GDPR uyumlu'
      ]
    },
    {
      icon: Shield,
      title: 'Güvenlik & Gizlilik',
      description: 'Verileriniz SSL ile şifrelenir ve güvenle saklanır. GDPR ve veri koruma yasalarına tam uyum.',
      benefits: [
        'SSL şifreleme',
        'GDPR uyumlu',
        'Veri yedekleme',
        'İki faktörlü doğrulama'
      ]
    },
    {
      icon: Zap,
      title: 'Hızlı ve Performanslı',
      description: 'Optimize edilmiş altyapı sayesinde yüksek performans. Gecikme yok, hızlı yanıt süreleri.',
      benefits: [
        'CDN desteği',
        'Optimize kod',
        'Hızlı yükleme',
        'Yüksek erişilebilirlik'
      ]
    },
    {
      icon: Clock,
      title: '7/24 Erişilebilirlik',
      description: 'Sistem kesintisiz çalışır. Müşterileriniz her zaman size ulaşabilir.',
      benefits: [
        '%99.9 uptime',
        'Otomatik yedekleme',
        'Yük dengeleme',
        'Hızlı destek'
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <Header />
      
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 dark:from-indigo-600 dark:via-purple-600 dark:to-pink-600 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            İhtiyacınız Olan Her Özellik
          </h1>
          <p className="text-xl text-indigo-100 dark:text-indigo-200 max-w-3xl mx-auto">
            DestekChat, modern müşteri destek sistemi için gereken tüm özellikleri barındırır. 
            Profesyonel bir deneyim sunmak için tasarlandı.
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {mainFeatures.map((feature, index) => (
              <div 
                key={index}
                className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-sm hover:shadow-xl transition border border-gray-200 dark:border-gray-700"
              >
                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 dark:from-indigo-600 dark:to-purple-700 w-14 h-14 rounded-xl flex items-center justify-center mb-6">
                  <feature.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                  {feature.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  {feature.description}
                </p>
                <ul className="space-y-2">
                  {feature.benefits.map((benefit, idx) => (
                    <li key={idx} className="flex items-start text-sm text-gray-700 dark:text-gray-300">
                      <div className="w-1.5 h-1.5 bg-indigo-600 dark:bg-indigo-400 rounded-full mr-2 mt-1.5 flex-shrink-0"></div>
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Integration Section */}
      <section className="bg-gray-50 dark:bg-gray-800 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Kolay Entegrasyon
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Web sitenize dakikalar içinde entegre edin. Sadece birkaç satır kod yeterli.
            </p>
          </div>

          <div className="bg-gray-900 dark:bg-gray-950 rounded-xl p-8 max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-400 dark:text-gray-500 text-sm font-mono">widget-integration.html</span>
              <span className="text-green-400 dark:text-green-500 text-xs">✓ Aktif</span>
            </div>
            <pre className="text-green-400 dark:text-green-500 font-mono text-sm overflow-x-auto">
{`<!-- DestekChat Widget -->
<script>
  window.destekChatConfig = {
    siteId: "your-site-id",
    position: "bottom-right"
  };
</script>
<script src="https://destekhat.com/widget.js"></script>`}
            </pre>
          </div>

          <div className="text-center mt-8">
            <p className="text-gray-600 dark:text-gray-300 mb-4">Bu kadar basit! 5 dakikada kurulum tamamlanır.</p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-indigo-600 dark:bg-indigo-700 text-white py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            DestekChat'i Hemen Deneyin
          </h2>
          <p className="text-xl text-indigo-100 dark:text-indigo-200 mb-8">
            Ücretsiz hesap oluşturun ve tüm özellikleri keşfedin. Kredi kartı gerekmez.
          </p>
          <Link
            to="/register"
            className="inline-flex items-center bg-white dark:bg-gray-100 text-indigo-600 dark:text-indigo-700 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-indigo-50 dark:hover:bg-gray-200 transition"
          >
            Ücretsiz Başlayın
            <ArrowRight className="ml-2 w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-gray-600 dark:text-gray-300">
            <Link to="/" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium">
              Ana Sayfaya Dön
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Features;
