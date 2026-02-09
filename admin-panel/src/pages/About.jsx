import React from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, Target, Users, Heart, ArrowRight } from 'lucide-react';
import Header from '../components/Header';

const About = () => {
  const values = [
    {
      icon: Target,
      title: 'Misyonumuz',
      description: 'Her büyüklükteki işletmenin profesyonel müşteri desteği sunabilmesini sağlamak. Kullanımı kolay, uygun fiyatlı ve güçlü araçlar sunarak müşteri memnuniyetini artırmak.'
    },
    {
      icon: Users,
      title: 'Vizyonumuz',
      description: 'Müşteri hizmetlerinde yeni standartlar belirlemek. İşletmeler ve müşterileri arasındaki iletişimi daha anlamlı, daha hızlı ve daha etkili hale getirmek.'
    },
    {
      icon: Heart,
      title: 'Değerlerimiz',
      description: 'Müşteri odaklılık, sürekli iyileştirme, şeffaflık ve güvenilirlik. Kullanıcılarımızın başarısı bizim başarımızdır.'
    }
  ];

  const stats = [
    { number: '10,000+', label: 'Aktif Kullanıcı' },
    { number: '1M+', label: 'Aylık Konuşma' },
    { number: '50+', label: 'Ülke' },
    { number: '%99.9', label: 'Uptime' }
  ];

  const team = [
    {
      name: 'Support.io Ekibi',
      role: 'Geliştiriciler & Destek',
      description: 'Deneyimli yazılım geliştiricileri ve müşteri destek uzmanlarından oluşan ekibimiz, sizin için çalışıyor.'
    }
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <Header />
      
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Müşteri İletişimini Yeniden Tanımlıyoruz
          </h1>
          <p className="text-xl text-indigo-100 max-w-3xl mx-auto">
            Support.io olarak, işletmelerin müşterileriyle daha iyi iletişim kurmasını sağlayan 
            modern ve kullanıcı dostu bir platform sunuyoruz.
          </p>
        </div>
      </section>

      {/* Story Section */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-6">
              Hikayemiz
            </h2>
            <div className="prose prose-lg mx-auto text-gray-600 dark:text-gray-300">
              <p className="mb-4">
                Support.io, müşteri hizmetlerindeki deneyimimizden doğdu. Birçok işletmenin 
                müşterileriyle etkili iletişim kurmakta zorlandığını gördük. Mevcut çözümler 
                ya çok karmaşık ya da çok pahalıydı.
              </p>
              <p className="mb-4">
                Bu sorunu çözmek için yola çıktık. Amacımız, her büyüklükteki işletmenin 
                profesyonel müşteri desteği sunabilmesini sağlayacak, kullanımı kolay ve 
                uygun fiyatlı bir platform oluşturmaktı.
              </p>
              <p>
                Bugün, binlerce işletme Support.io ile müşterileriyle daha iyi iletişim kuruyor 
                ve müşteri memnuniyetini artırıyor. Ve biz hala geliştirmeye devam ediyoruz.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="bg-gray-50 dark:bg-gray-800 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Değerlerimiz
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Bizi biz yapan değerler
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {values.map((value, index) => (
              <div 
                key={index}
                className="bg-white dark:bg-gray-700 rounded-xl p-8 shadow-sm hover:shadow-md transition"
              >
                <div className="bg-indigo-100 dark:bg-indigo-900 w-14 h-14 rounded-xl flex items-center justify-center mb-6">
                  <value.icon className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                  {value.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  {value.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Rakamlarla Support.io
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-4xl md:text-5xl font-bold text-indigo-600 dark:text-indigo-400 mb-2">
                  {stat.number}
                </div>
                <div className="text-gray-600 dark:text-gray-300 font-medium">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="bg-gray-50 dark:bg-gray-800 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Ekibimiz
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Tutkulu ve deneyimli profesyonellerden oluşan ekibimiz
            </p>
          </div>

          <div className="max-w-2xl mx-auto">
            {team.map((member, index) => (
              <div 
                key={index}
                className="bg-white dark:bg-gray-700 rounded-xl p-8 shadow-sm text-center"
              >
                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Users className="w-12 h-12 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  {member.name}
                </h3>
                <p className="text-indigo-600 dark:text-indigo-400 font-medium mb-4">
                  {member.role}
                </p>
                <p className="text-gray-600 dark:text-gray-300">
                  {member.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Technology Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Teknolojimiz
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Modern web teknolojileri ile geliştirilen Support.io, yüksek performans ve 
              güvenilirlik sunar. React, Node.js, Socket.IO ve MongoDB gibi güçlü 
              teknolojiler üzerine kurulu.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {['React', 'Node.js', 'Socket.IO', 'MongoDB', 'Express', 'JWT', 'SSL/TLS', 'WebSocket'].map((tech, index) => (
              <div 
                key={index}
                className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-6 text-center text-white font-semibold"
              >
                {tech}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-indigo-600 text-white py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-2xl p-12">
            <MessageSquare className="w-16 h-16 mx-auto mb-6 text-white" />
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Bize Katılın
            </h2>
            <p className="text-xl text-indigo-100 mb-8">
              Binlerce işletme Support.io ile müşteri memnuniyetini artırıyor. 
              Siz de aramıza katılın!
            </p>
            <Link
              to="/register"
              className="inline-flex items-center bg-white text-indigo-600 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-indigo-50 transition"
            >
              Ücretsiz Başlayın
              <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
          </div>
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

export default About;
