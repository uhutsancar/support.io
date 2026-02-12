import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { sitesAPI, clearCache } from '../services/api';
import { Plus, Globe, Copy, Check, Settings, Trash2 } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';

const Sites = () => {
  const { t } = useTranslation();
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newSite, setNewSite] = useState({ name: '', domain: '' });
  const [copiedKey, setCopiedKey] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, siteId: null, siteName: '' });

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
      const response = await sitesAPI.create(newSite);
      setShowModal(false);
      setNewSite({ name: '', domain: '' });
      // Yeni site'ı direkt listeye ekle
      setSites([...sites, response.data.site]);
      // Cache'i temizle
      clearCache('/sites');
      toast.success(t('sites.createSuccess'));
    } catch (error) {
      console.error('Failed to create site:', error);
      toast.error(t('sites.createError') + ': ' + (error.response?.data?.error || error.message));
    }
  };

  const handleDeleteSite = async () => {
    const { siteId } = confirmDialog;

    try {
      await sitesAPI.delete(siteId);
      // Site'ı listeden direkt kaldır
      setSites(sites.filter(site => site._id !== siteId));
      // Cache'i temizle
      clearCache('/sites');
      toast.success(t('sites.deleteSuccess'));
    } catch (error) {
      console.error('Failed to delete site:', error);
      toast.error(t('sites.deleteError') + ': ' + (error.response?.data?.error || error.message));
    }
  };

  const openDeleteConfirm = (siteId, siteName) => {
    setConfirmDialog({ isOpen: true, siteId, siteName });
  };

  const copyToClipboard = (text, siteId) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(siteId);
    toast.success(t('sites.copiedSuccess'));
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const getInstallCode = (siteKey) => {
    return `<script>
  window.SupportIOConfig = {
    siteKey: '${siteKey}'
  };
</script>
<script src="http://localhost:3000/widget.js"></script>`;
  };

  if (loading) {
    return <div className="text-center py-12">{t('common.loading')}</div>;
  }

  return (
    <>
      <Helmet>
        <title>{t('sites.title')} - Support.io Admin</title>
        <meta name="description" content={t('sites.subtitle')} />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">{t('sites.title')}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">{t('sites.subtitle')}</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center justify-center space-x-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition w-full sm:w-auto"
        >
          <Plus className="w-5 h-5" />
          <span>{t('sites.addSite')}</span>
        </button>
      </div>

      {sites.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <Globe className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{t('sites.noSites')}</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{t('sites.noSitesDescription')}</p>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center space-x-2 bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition"
          >
            <Plus className="w-5 h-5" />
            <span>{t('sites.addFirstSite')}</span>
          </button>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {sites.map((site) => (
            <div key={site._id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6 hover:shadow-md transition">
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
                  {site.isActive ? t('sites.active') : t('sites.inactive')}
                </span>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">{t('sites.siteKey')}</label>
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
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">{t('sites.installCode')}</label>
                  <div className="relative">
                    <pre className="text-xs bg-gray-50 dark:bg-gray-700 dark:text-white px-2 sm:px-3 py-2 rounded border border-gray-200 dark:border-gray-600 overflow-x-auto max-w-full whitespace-pre-wrap sm:whitespace-pre">
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

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2">
                  <button className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-300 rounded-lg transition text-xs sm:text-sm">
                    <Settings className="w-4 h-4" />
                    <span className="leading-tight text-center whitespace-normal">{t('sites.settings')}</span>
                  </button>
                  <button 
                    onClick={() => openDeleteConfirm(site._id, site.name)}
                    className="px-3 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition flex items-center justify-center"
                  >
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
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full mx-4 p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">{t('sites.newSiteModal.title')}</h2>
            <form onSubmit={handleCreateSite} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('sites.newSiteModal.siteNameLabel')}
                </label>
                <input
                  type="text"
                  value={newSite.name}
                  onChange={(e) => setNewSite({ ...newSite, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  placeholder={t('sites.newSiteModal.siteNamePlaceholder')}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('sites.newSiteModal.domainLabel')}
                </label>
                <input
                  type="text"
                  value={newSite.domain}
                  onChange={(e) => setNewSite({ ...newSite, domain: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  placeholder={t('sites.newSiteModal.domainPlaceholder')}
                  required
                />
              </div>
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition"
                >
                  {t('sites.newSiteModal.cancel')}
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                >
                  {t('sites.newSiteModal.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, siteId: null, siteName: '' })}
        onConfirm={handleDeleteSite}
        title={t('sites.deleteTitle')}
        message={t('sites.deleteMessage', { name: confirmDialog.siteName })}
        confirmText={t('sites.deleteConfirm')}
        cancelText={t('common.cancel')}
        type="danger"
      />
      </div>
    </>
  );
};

export default Sites;
