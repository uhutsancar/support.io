import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Play, AlertCircle, Save, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { useTranslation } from 'react-i18next';
import ConfirmDialog from '../components/ConfirmDialog';

const ProactiveRules = () => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const [rules, setRules] = useState([]);
    const [sites, setSites] = useState([]);
    const [loading, setLoading] = useState(true);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRule, setEditingRule] = useState(null);
    const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, ruleId: null, ruleName: '' });

    const [formData, setFormData] = useState({
        siteId: '',
        name: '',
        isActive: true,
        triggerCondition: {
            eventType: 'time_on_page',
            urlMatch: 'any',
            urlValue: '',
            timeThresholdSeconds: 10,
            scrollPercentage: 0,
            customEventName: ''
        },
        audienceContext: {
            deviceType: 'all',
            country: ''
        },
        action: {
            type: 'open_popup',
            messageContent: ''
        },
        frequencyControl: {
            triggerOncePerVisitor: true,
            cooldownMinutes: 1440
        }
    });

    useEffect(() => {
        fetchSitesAndRules();
    }, []);

    const fetchSitesAndRules = async () => {
        try {
            setLoading(true);
            const sitesRes = await api.get('/sites');
            const userSites = sitesRes.data.sites || [];
            setSites(userSites);

            if (userSites.length > 0) {
                // Fetch rules for the first site by default, or could load all
                const rulesRes = await api.get(`/proactive-rules/${userSites[0]._id}`);
                setRules(Array.isArray(rulesRes.data) ? rulesRes.data : []);
                setFormData(prev => ({ ...prev, siteId: userSites[0]._id }));
            }
        } catch (error) {
            toast.error(t('proactive.fetchError', 'Kurallar yüklenemedi'));
        } finally {
            setLoading(false);
        }
    };

    const handleSiteChange = async (e) => {
        const siteId = e.target.value;
        setFormData(prev => ({ ...prev, siteId }));
        try {
            const rulesRes = await api.get(`/proactive-rules/${siteId}`);
            setRules(Array.isArray(rulesRes.data) ? rulesRes.data : []);
        } catch (error) {
            toast.error(t('proactive.fetchSiteError', 'Site kuralları yüklenemedi'));
        }
    };

    const resetForm = () => {
        setEditingRule(null);
        setFormData({
            siteId: sites.length > 0 ? sites[0]._id : '',
            name: '',
            isActive: true,
            triggerCondition: {
                eventType: 'time_on_page',
                urlMatch: 'any',
                urlValue: '',
                timeThresholdSeconds: 10,
                scrollPercentage: 0,
                customEventName: ''
            },
            audienceContext: {
                deviceType: 'all',
                country: ''
            },
            action: {
                type: 'open_popup',
                messageContent: ''
            },
            frequencyControl: {
                triggerOncePerVisitor: true,
                cooldownMinutes: 1440
            }
        });
    };

    const openModal = (rule = null) => {
        if (rule) {
            setEditingRule(rule._id);
            setFormData(rule);
        } else {
            resetForm();
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingRule) {
                const res = await api.put(`/proactive-rules/${editingRule}`, formData);
                setRules(rules.map(r => r._id === editingRule ? res.data : r));
                toast.success(t('proactive.updateSuccess', 'Başarıyla güncellendi!'));
            } else {
                const res = await api.post('/proactive-rules', formData);
                setRules([res.data, ...rules]);
                toast.success(t('proactive.createSuccess', 'Başarıyla oluşturuldu!'));
            }
            setIsModalOpen(false);
        } catch (error) {
            toast.error(t('proactive.saveError', 'Kaydedilirken hata oluştu'));
        }
    };

    const handleDelete = (id, ruleName) => {
        setConfirmDialog({ isOpen: true, ruleId: id, ruleName });
    };

    const confirmDelete = async () => {
        if (!confirmDialog.ruleId) return;
        try {
            await api.delete(`/proactive-rules/${confirmDialog.ruleId}`);
            setRules(rules.filter(r => r._id !== confirmDialog.ruleId));
            toast.success(t('proactive.deleteSuccess', 'Silindi'));
        } catch (error) {
            toast.error(t('proactive.deleteError', 'Silinemedi'));
        } finally {
            setConfirmDialog({ isOpen: false, ruleId: null, ruleName: '' });
        }
    };

    const toggleStatus = async (rule) => {
        try {
            const res = await api.put(`/proactive-rules/${rule._id}`, { ...rule, isActive: !rule.isActive });
            setRules(rules.map(r => r._id === rule._id ? res.data : r));
            toast.success(t('proactive.statusUpdateSuccess', 'Durum güncellendi'));
        } catch (error) {
            toast.error(t('proactive.statusUpdateError', 'Durum güncellenemedi'));
        }
    };

    if (loading) return <div>Loading...</div>;

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('proactive.title', 'Proactive Messaging Rules')}</h1>
                <button
                    onClick={() => openModal()}
                    className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                    <Plus className="w-5 h-5 mr-2" />
                    {t('proactive.createBtn', 'Create Rule')}
                </button>
            </div>

            <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('proactive.selectSite', 'Select Site')}</label>
                <select
                    value={formData.siteId}
                    onChange={handleSiteChange}
                    className="w-full md:w-1/3 px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                    {sites.map(site => (
                        <option key={site._id} value={site._id}>{site.name}</option>
                    ))}
                </select>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('proactive.tableRuleName', 'Rule Name')}</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('proactive.tableTrigger', 'Trigger')}</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('proactive.tableAction', 'Action')}</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('proactive.tableConversions', 'Conversions')}</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('proactive.tableStatus', 'Status')}</th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('proactive.tableActions', 'Actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {rules.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                                        {t('proactive.emptyText', 'No active rules for this site. Create one to get started!')}
                                    </td>
                                </tr>
                            ) : rules.map(rule => (
                                <tr key={rule._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                    <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                                        {rule.name}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                        {rule.triggerCondition.eventType}
                                        {rule.triggerCondition.eventType === 'time_on_page' && ` (${rule.triggerCondition.timeThresholdSeconds}s)`}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 uppercase">
                                        {rule.action.type.replace('_', ' ')}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                        {rule.metrics?.conversionsCount || 0} / {rule.metrics?.triggersCount || 0}
                                    </td>
                                    <td className="px-6 py-4 text-sm">
                                        <button
                                            onClick={() => toggleStatus(rule)}
                                            className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${rule.isActive ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                                }`}
                                        >
                                            {rule.isActive ? t('common.active', 'Active') : t('common.inactive', 'Inactive')}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 text-right text-sm font-medium">
                                        <button onClick={() => openModal(rule)} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 mr-4">
                                            <Edit2 className="w-5 h-5 inline" />
                                        </button>
                                        <button onClick={() => handleDelete(rule._id, rule.name)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300">
                                            <Trash2 className="w-5 h-5 inline" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 rounded-t-xl">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                {editingRule ? t('proactive.editRule', 'Edit Proactive Rule') : t('proactive.newRule', 'New Proactive Rule')}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-6">
                            <div>
                                <label className="block text-sm font-medium mb-1 dark:text-gray-300">{t('proactive.ruleNameLabel', 'Rule Name')}</label>
                                <input
                                    required
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                                    placeholder={t('proactive.ruleNamePlaceholder', 'e.g. Pricing Page Invite')}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1 dark:text-gray-300">{t('proactive.eventTriggerLabel', 'Event Trigger')}</label>
                                    <select
                                        value={formData.triggerCondition.eventType}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            triggerCondition: { ...formData.triggerCondition, eventType: e.target.value }
                                        })}
                                        className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                                    >
                                        <option value="time_on_page">{t('proactive.triggerTime', 'Time on Page')}</option>
                                        <option value="exit_intent">{t('proactive.triggerExit', 'Exit Intent')}</option>
                                        <option value="scroll_depth">{t('proactive.triggerScroll', 'Scroll Depth')}</option>
                                        <option value="inactivity">{t('proactive.triggerInactivity', 'Inactivity')}</option>
                                    </select>
                                </div>

                                {(formData.triggerCondition.eventType === 'time_on_page' || formData.triggerCondition.eventType === 'inactivity') && (
                                    <div>
                                        <label className="block text-sm font-medium mb-1 dark:text-gray-300">{t('proactive.secondsLabel', 'Seconds')}</label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={formData.triggerCondition.timeThresholdSeconds}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                triggerCondition: { ...formData.triggerCondition, timeThresholdSeconds: parseInt(e.target.value) }
                                            })}
                                            className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                                        />
                                    </div>
                                )}

                                {formData.triggerCondition.eventType === 'scroll_depth' && (
                                    <div>
                                        <label className="block text-sm font-medium mb-1 dark:text-gray-300">{t('proactive.scrollLabel', 'Scroll %')}</label>
                                        <input
                                            type="number"
                                            min="10" max="100" step="10"
                                            value={formData.triggerCondition.scrollPercentage}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                triggerCondition: { ...formData.triggerCondition, scrollPercentage: parseInt(e.target.value) }
                                            })}
                                            className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1 dark:text-gray-300">{t('proactive.urlMatchLabel', 'URL Match')}</label>
                                    <select
                                        value={formData.triggerCondition.urlMatch}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            triggerCondition: { ...formData.triggerCondition, urlMatch: e.target.value }
                                        })}
                                        className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                                    >
                                        <option value="any">{t('proactive.urlAny', 'Any Page')}</option>
                                        <option value="exact">{t('proactive.urlExact', 'Exact Match')}</option>
                                        <option value="contains">{t('proactive.urlContains', 'Contains')}</option>
                                    </select>
                                </div>

                                {formData.triggerCondition.urlMatch !== 'any' && (
                                    <div>
                                        <label className="block text-sm font-medium mb-1 dark:text-gray-300">{t('proactive.urlValueLabel', 'URL Value')}</label>
                                        <input
                                            type="text"
                                            value={formData.triggerCondition.urlValue}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                triggerCondition: { ...formData.triggerCondition, urlValue: e.target.value }
                                            })}
                                            className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                                            placeholder="/pricing"
                                        />
                                    </div>
                                )}
                            </div>

                            <hr className="dark:border-gray-700" />

                            <div>
                                <label className="block text-sm font-medium mb-1 dark:text-gray-300">{t('proactive.actionLabel', 'Action')}</label>
                                <select
                                    value={formData.action.type}
                                    onChange={(e) => setFormData({
                                        ...formData,
                                        action: { ...formData.action, type: e.target.value }
                                    })}
                                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white mb-3"
                                >
                                    <option value="open_popup">{t('proactive.actOpenPopup', 'Open Widget Window')}</option>
                                    <option value="send_message">{t('proactive.actSendMessage', 'Send Chat Message')}</option>
                                </select>

                                <textarea
                                    value={formData.action.messageContent}
                                    onChange={(e) => setFormData({
                                        ...formData,
                                        action: { ...formData.action, messageContent: e.target.value }
                                    })}
                                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                                    placeholder={t('proactive.actMsgPlaceholder', 'Hello! Can I help you with anything?')}
                                    rows="3"
                                ></textarea>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                >
                                    {t('common.cancel', 'Cancel')}
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center"
                                >
                                    <Save className="w-5 h-5 mr-2" />
                                    {t('proactive.saveRule', 'Save Rule')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ConfirmDialog
                isOpen={confirmDialog.isOpen}
                onClose={() => setConfirmDialog({ isOpen: false, ruleId: null, ruleName: '' })}
                onConfirm={confirmDelete}
                title={t('common.delete', 'Delete')}
                message={t('proactive.deleteMessage', 'Are you sure you want to delete the "{name}" rule? This action cannot be undone.', { name: confirmDialog.ruleName })}
            />
        </div>
    );
};

export default ProactiveRules;
