import React, { useState, useEffect } from 'react';
import { sitesAPI } from '../services/api';
import { Plus, Globe, Copy, Check, Settings, Trash2 } from 'lucide-react';

const Sites = () => {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newSite, setNewSite] = useState({ name: '', domain: '' });
  const [copiedKey, setCopiedKey] = useState(null);

  useEffect(() => {
    fetchSites();
  }, []);

  const fetchSites = async () => {
    try {
      const response = await sitesAPI.getAll();
      setSites(response.data.sites);
    } catch (error) {
      console.error('Failed to fetch sites:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSite = async (e) => {
    e.preventDefault();
    try {
      await sitesAPI.create(newSite);
      setShowModal(false);
      setNewSite({ name: '', domain: '' });
      fetchSites();
    } catch (error) {
      console.error('Failed to create site:', error);
    }
  };

  const copyToClipboard = (text, siteId) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(siteId);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const getInstallCode = (siteKey) => {
    return `<script>
  window.SupportChatConfig = {
    siteKey: '${siteKey}'
  };
</script>
<script src="http://localhost:3000/widget.js"></script>`;
  };

  if (loading) {
    return <div className="text-center py-12">Loading sites...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Siteler</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Web sitelerinizi ve sohbet widget'larınızı yönetin</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center space-x-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition"
        >
          <Plus className="w-5 h-5" />
          <span>Site Ekle</span>
        </button>
      </div>

      {sites.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <Globe className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Henüz site yok</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">Başlamak için ilk web sitenizi ekleyin</p>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center space-x-2 bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition"
          >
            <Plus className="w-5 h-5" />
            <span>İlk Sitenizi Ekleyin</span>
          </button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {sites.map((site) => (
            <div key={site._id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center">
                    <Globe className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{site.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{site.domain}</p>
                  </div>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full ${site.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                  {site.isActive ? 'Aktif' : 'Pasif'}
                </span>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">Site Anahtarı</label>
                  <div className="flex items-center space-x-2">
                    <code className="flex-1 text-xs bg-gray-50 dark:bg-gray-700 dark:text-white px-3 py-2 rounded border border-gray-200 dark:border-gray-600 truncate">
                      {site.siteKey}
                    </code>
                    <button
                      onClick={() => copyToClipboard(site.siteKey, site._id)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition"
                    >
                      {copiedKey === site._id ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : (
                        <Copy className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">Kurulum Kodu</label>
                  <div className="relative">
                    <pre className="text-xs bg-gray-50 dark:bg-gray-700 dark:text-white px-3 py-2 rounded border border-gray-200 dark:border-gray-600 overflow-x-auto">
                      {getInstallCode(site.siteKey)}
                    </pre>
                    <button
                      onClick={() => copyToClipboard(getInstallCode(site.siteKey), `code-${site._id}`)}
                      className="absolute top-2 right-2 p-1.5 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition"
                    >
                      {copiedKey === `code-${site._id}` ? (
                        <Check className="w-3.5 h-3.5 text-green-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center space-x-2 pt-2">
                  <button className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-300 rounded-lg transition text-sm">
                    <Settings className="w-4 h-4" />
                    <span>Ayarlar</span>
                  </button>
                  <button className="px-3 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Site Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Yeni Site Ekle</h2>
            <form onSubmit={handleCreateSite} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Site Adı
                </label>
                <input
                  type="text"
                  value={newSite.name}
                  onChange={(e) => setNewSite({ ...newSite, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  placeholder="Web Sitem"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Alan Adı
                </label>
                <input
                  type="text"
                  value={newSite.domain}
                  onChange={(e) => setNewSite({ ...newSite, domain: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  placeholder="ornek.com"
                  required
                />
              </div>
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                >
                  Site Oluştur
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sites;
