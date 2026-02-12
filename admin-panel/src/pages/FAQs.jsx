import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { sitesAPI, faqsAPI, clearCache } from '../services/api';
import { Plus, Edit2, Trash2, HelpCircle } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';

const FAQs = () => {
  const { t } = useTranslation();
  const [sites, setSites] = useState([]);
  const [selectedSite, setSelectedSite] = useState(null);
  const [faqs, setFaqs] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingFaq, setEditingFaq] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, faqId: null, faqQuestion: '' });
  const [formData, setFormData] = useState({
    question: '',
    answer: '',
    category: 'General',
    keywords: '',
    pageSpecific: '*'
  });

  useEffect(() => {
    fetchSites();
  }, []);

  useEffect(() => {
    if (selectedSite) {
      fetchFAQs(selectedSite._id);
    }
  }, [selectedSite]);

  const fetchSites = async () => {
    try {
      const response = await sitesAPI.getAll();
      setSites(response.data.sites);
      if (response.data.sites.length > 0) {
        setSelectedSite(response.data.sites[0]);
      }
    } catch (error) {
      console.error('Failed to fetch sites:', error);
    }
  };

  const fetchFAQs = async (siteId) => {
    try {
      const response = await faqsAPI.getAll(siteId);
      setFaqs(response.data.faqs);
    } catch (error) {
      console.error('Failed to fetch FAQs:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        siteId: selectedSite._id,
        keywords: formData.keywords.split(',').map(k => k.trim()).filter(Boolean)
      };

      if (editingFaq) {
        const response = await faqsAPI.update(editingFaq._id, data);
        // Güncellenmiş FAQ'ı listede değiştir
        setFaqs(faqs.map(faq => faq._id === editingFaq._id ? response.data.faq : faq));
      } else {
        const response = await faqsAPI.create(data);
        // Yeni FAQ'ı direkt listeye ekle
        setFaqs([...faqs, response.data.faq]);
      }

      setShowModal(false);
      resetForm();
      // Cache'i temizle
      clearCache('/faqs');
      toast.success(editingFaq ? t('faqs.updateSuccess') : t('faqs.createSuccess'));
    } catch (error) {
      console.error('Failed to save FAQ:', error);
      toast.error('FAQ kaydedilemedi: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleEdit = (faq) => {
    setEditingFaq(faq);
    setFormData({
      question: faq.question,
      answer: faq.answer,
      category: faq.category,
      keywords: faq.keywords.join(', '),
      pageSpecific: faq.pageSpecific
    });
    setShowModal(true);
  };

  const handleDelete = async () => {
    const { faqId } = confirmDialog;

    try {
      await faqsAPI.delete(faqId);
      // FAQ'ı listeden direkt kaldır
      setFaqs(faqs.filter(faq => faq._id !== faqId));
      // Cache'i temizle
      clearCache('/faqs');
      toast.success(t('faqs.deleteSuccess'));
    } catch (error) {
      console.error('Failed to delete FAQ:', error);
      toast.error(t('faqs.deleteError') + ': ' + (error.response?.data?.error || error.message));
    }
  };

  const openDeleteConfirm = (faqId, faqQuestion) => {
    setConfirmDialog({ isOpen: true, faqId, faqQuestion });
  };

  const resetForm = () => {
    setFormData({
      question: '',
      answer: '',
      category: 'General',
      keywords: '',
      pageSpecific: '*'
    });
    setEditingFaq(null);
  };

  return (
    <>
      <Helmet>
        <title>{t('faqs.title')} - Support.io Admin</title>
        <meta name="description" content={t('faqs.subtitle')} />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">{t('faqs.title')}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">{t('faqs.subtitle')}</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          <select
            value={selectedSite?._id || ''}
            onChange={(e) => {
              const site = sites.find(s => s._id === e.target.value);
              setSelectedSite(site);
            }}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white w-full sm:w-auto"
          >
            {sites.map(site => (
              <option key={site._id} value={site._id}>{site.name}</option>
            ))}
          </select>
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="flex items-center justify-center space-x-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition w-full sm:w-auto"
          >
            <Plus className="w-5 h-5" />
            <span>{t('faqs.addFaq')}</span>
          </button>
        </div>
      </div>

      {faqs.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <HelpCircle className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{t('faqs.noFaqs')}</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{t('faqs.noFaqsDescription')}</p>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center space-x-2 bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition"
          >
            <Plus className="w-5 h-5" />
            <span>{t('faqs.createFirstFaq')}</span>
          </button>
        </div>
      ) : (
        <>
          {/* Desktop Table View - hidden on mobile */}
          <div className="hidden lg:block bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('faqs.question')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('faqs.category')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('faqs.page')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('faqs.status')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('faqs.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {faqs.map((faq) => (
                  <tr key={faq._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{faq.question}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{faq.answer}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-full">
                        {faq.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {faq.pageSpecific === '*' ? t('faqs.allPages') : faq.pageSpecific}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        faq.isActive ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}>
                        {faq.isActive ? t('faqs.active') : t('faqs.inactive')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleEdit(faq)}
                          className="p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openDeleteConfirm(faq._id, faq.question)}
                          className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View - visible only on mobile */}
          <div className="lg:hidden space-y-4">
            {faqs.map((faq) => (
              <div key={faq._id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 dark:text-white text-sm mb-2">{faq.question}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-3">{faq.answer}</p>
                  </div>
                  <div className="flex items-center space-x-2 ml-3">
                    <button
                      onClick={() => handleEdit(faq)}
                      className="p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(faq._id, faq.question)}
                      className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-full">
                    {faq.category}
                  </span>
                  <span className="text-gray-500 dark:text-gray-400">
                    {faq.pageSpecific === '*' ? t('faqs.allPages') : faq.pageSpecific}
                  </span>
                  <span className={`px-2 py-1 rounded-full ${
                    faq.isActive ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}>
                    {faq.isActive ? t('faqs.active') : t('faqs.inactive')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* FAQ Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full mx-4 p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              {editingFaq ? t('faqs.editFaq') : t('faqs.newFaq')}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('faqs.questionLabel')}
                </label>
                <input
                  type="text"
                  value={formData.question}
                  onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                  placeholder={t('faqs.questionPlaceholder')}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('faqs.answerLabel')}
                </label>
                <textarea
                  value={formData.answer}
                  onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                  rows={4}
                  placeholder={t('faqs.answerPlaceholder')}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('faqs.categoryLabel')}
                  </label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                    placeholder={t('faqs.categoryPlaceholder')}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('faqs.pageLabel')}
                  </label>
                  <input
                    type="text"
                    value={formData.pageSpecific}
                    onChange={(e) => setFormData({ ...formData, pageSpecific: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                    placeholder="*"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('faqs.keywordsLabel')}
                </label>
                <input
                  type="text"
                  value={formData.keywords}
                  onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                  placeholder={t('faqs.keywordsPlaceholder')}
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                >
                  {t('faqs.cancel')}
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition"
                >
                  {editingFaq ? t('faqs.update') : t('faqs.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, faqId: null, faqQuestion: '' })}
        onConfirm={handleDelete}
        title={t('faqs.confirmDelete')}
        message={`"${confirmDialog.faqQuestion}" ${t('faqs.confirmDelete')}`}
        confirmText={t('common.yes')}
        cancelText={t('common.cancel')}
        type="danger"
      />
      </div>
    </>
  );
};

export default FAQs;
