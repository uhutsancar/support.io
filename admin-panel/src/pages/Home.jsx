import React from 'react';
import { Link } from 'react-router-dom';
import { 
  MessageSquare, 
  Zap, 
  Users, 
  BarChart, 
  Clock, 
  Shield,
  CheckCircle,
  ArrowRight
} from 'lucide-react';
import Header from '../components/Header';

const Home = () => {
  const features = [
    {
      icon: MessageSquare,
      title: 'Canlı Sohbet',
      description: 'Müşterilerinizle anlık olarak iletişime geçin. Hızlı ve etkili destek sağlayın.'
    },
    {
      icon: Zap,
      title: 'Hızlı Yanıt',
      description: 'Otomatik yanıtlar ve hazır şablonlarla müşteri sorularını anında cevaplayın.'
    },
    {
      icon: Users,
      title: 'Çoklu Operatör',
      description: 'Ekip arkadaşlarınızla birlikte çalışın. Konuşmaları paylaşın ve verimli olun.'
    },
    {
      icon: BarChart,
      title: 'Detaylı Raporlar',
      description: 'Müşteri etkileşimlerinizi analiz edin. Performansınızı sürekli iyileştirin.'
    },
    {
      icon: Clock,
      title: '7/24 Erişilebilir',
      description: 'Müşterileriniz her zaman size ulaşabilir. Kaçırılan fırsat yok.'
    },
    {
      icon: Shield,
      title: 'Güvenli',
      description: 'Verileriniz şifrelenir ve güvenle saklanır. GDPR uyumlu altyapı.'
    }
  ];

  const benefits = [
    'Kolay kurulum - 5 dakikada başlayın',
    'Mobil uyumlu arayüz',
    'Sınırsız konuşma',
    'Özelleştirilebilir widget',
    'E-posta bildirimleri',
    'Sohbet geçmişi'
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <Header />
      
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 dark:from-indigo-600 dark:via-purple-700 dark:to-pink-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Müşteri Hizmetlerinizi Bir Üst Seviyeye Taşıyın
            </h1>
            <p className="text-xl md:text-2xl mb-8 text-indigo-100 dark:text-indigo-200">
              DestekChat ile ziyaretçilerinizle anlık iletişim kurun. Modern, hızlı ve kullanımı kolay canlı destek sistemi.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/register"
                className="bg-white text-indigo-600 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-indigo-50 dark:bg-gray-900 dark:text-indigo-400 dark:hover:bg-gray-800 transition flex items-center justify-center"
              >
                Ücretsiz Başlayın
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
              <Link
                to="/ozellikler"
                className="bg-indigo-600 bg-opacity-30 backdrop-blur-sm text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-opacity-40 dark:bg-purple-600 dark:bg-opacity-40 dark:hover:bg-opacity-50 transition border-2 border-white border-opacity-30 dark:border-opacity-40"
              >
                Özellikleri Keşfedin
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-50 dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Güçlü Özellikler
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Müşteri desteğinizi kolaylaştırmak için ihtiyacınız olan her şey
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div 
                key={index}
                className="bg-white dark:bg-gray-900 rounded-xl p-8 shadow-sm hover:shadow-md dark:shadow-gray-900/50 dark:hover:shadow-gray-900/70 transition border border-gray-200 dark:border-gray-700"
              >
                <div className="bg-indigo-100 dark:bg-indigo-900/50 w-14 h-14 rounded-lg flex items-center justify-center mb-4">
                  <feature.icon className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                  {feature.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-6">
                Neden DestekChat?
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
                Web sitenize entegre edebileceğiniz en modern canlı destek sistemi. 
                Müşterilerinizle gerçek zamanlı iletişim kurmanın en kolay yolu.
              </p>
              <div className="space-y-4">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-start">
                    <CheckCircle className="w-6 h-6 text-green-500 dark:text-green-400 mr-3 flex-shrink-0 mt-1" />
                    <span className="text-gray-700 dark:text-gray-300 text-lg">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 dark:from-indigo-600 dark:to-purple-700 rounded-2xl p-8 text-white">
              <div className="bg-white bg-opacity-10 dark:bg-opacity-20 backdrop-blur-sm rounded-xl p-6 mb-6">
                <h3 className="text-2xl font-bold mb-2">Hemen Başlayın</h3>
                <p className="text-indigo-100 dark:text-indigo-200">
                  Birkaç dakika içinde kurulumu tamamlayın ve müşterilerinizle iletişime geçin.
                </p>
              </div>
              <ul className="space-y-3 mb-6">
                <li className="flex items-center">
                  <div className="bg-white bg-opacity-20 rounded-full w-8 h-8 flex items-center justify-center mr-3 flex-shrink-0">
                    <span className="font-bold">1</span>
                  </div>
                  <span>Ücretsiz hesap oluşturun</span>
                </li>
                <li className="flex items-center">
                  <div className="bg-white bg-opacity-20 rounded-full w-8 h-8 flex items-center justify-center mr-3 flex-shrink-0">
                    <span className="font-bold">2</span>
                  </div>
                  <span>Widget kodunu sitenize ekleyin</span>
                </li>
                <li className="flex items-center">
                  <div className="bg-white bg-opacity-20 rounded-full w-8 h-8 flex items-center justify-center mr-3 flex-shrink-0">
                    <span className="font-bold">3</span>
                  </div>
                  <span>Müşterilerinizle konuşmaya başlayın</span>
                </li>
              </ul>
              <Link
                to="/register"
                className="block w-full bg-white text-indigo-600 py-3 rounded-lg font-semibold text-center hover:bg-indigo-50 dark:bg-gray-900 dark:text-indigo-400 dark:hover:bg-gray-800 transition"
              >
                Şimdi Deneyin
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gray-900 dark:bg-gray-950 text-white py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Müşterilerinizle Daha İyi İletişim Kurmaya Hazır mısınız?
          </h2>
          <p className="text-xl text-gray-300 dark:text-gray-400 mb-8">
            Binlerce işletme DestekChat ile müşteri memnuniyetini artırıyor.
          </p>
          <Link
            to="/register"
            className="inline-flex items-center bg-indigo-600 text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 transition"
          >
            Ücretsiz Hesap Oluştur
            <ArrowRight className="ml-2 w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="bg-indigo-600 dark:bg-indigo-500 rounded-lg p-2">
                  <MessageSquare className="w-5 h-5 text-white" />
                </div>
                <span className="text-lg font-bold text-gray-900 dark:text-white">DestekChat</span>
              </div>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Modern müşteri destek sistemi
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Ürün</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/ozellikler" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">Özellikler</Link></li>
                <li><Link to="/fiyatlandirma" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">Fiyatlandırma</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Şirket</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/hakkimizda" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">Hakkımızda</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Destek</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/login" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">Giriş Yap</Link></li>
                <li><Link to="/register" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">Kayıt Ol</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-200 dark:border-gray-700 mt-12 pt-8 text-center text-sm text-gray-600 dark:text-gray-400">
            <p>&copy; 2026 DestekChat. Tüm hakları saklıdır.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
