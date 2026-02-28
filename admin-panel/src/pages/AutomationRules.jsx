import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Play, GitMerge, Save, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../services/api';
import { useTranslation } from 'react-i18next';
import ConfirmDialog from '../components/ConfirmDialog';

const AutomationRules = () => {
    const { t } = useTranslation();
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
        priority: 0,
        triggerType: 'message_received',
        conditionOperator: 'AND',
        conditions: [
            { field: 'message.content', operator: 'contains', value: '' }
        ],
        actions: [
            { type: 'send_message', payload: { text: '' } }
        ]
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
                const rulesRes = await api.get(`/automation-rules/${userSites[0]._id}`);
                setRules(Array.isArray(rulesRes.data) ? rulesRes.data : []);
                setFormData(prev => ({ ...prev, siteId: userSites[0]._id }));
            }
        } catch (error) {
            toast.error(t('automation.fetchError', 'Kurallar yüklenemedi'));
        } finally {
            setLoading(false);
        }
    };

    const handleSiteChange = async (e) => {
        const siteId = e.target.value;
        setFormData(prev => ({ ...prev, siteId }));
        try {
            const rulesRes = await api.get(`/automation-rules/${siteId}`);
            setRules(Array.isArray(rulesRes.data) ? rulesRes.data : []);
        } catch (error) {
            toast.error(t('automation.fetchSiteError', 'Site kuralları yüklenemedi'));
        }
    };

    const resetForm = () => {
        setEditingRule(null);
        setFormData({
            siteId: sites.length > 0 ? sites[0]._id : '',
            name: '',
            isActive: true,
            priority: 0,
            triggerType: 'message_received',
            conditionOperator: 'AND',
            conditions: [{ field: 'message.content', operator: 'contains', value: '' }],
            actions: [{ type: 'send_message', payload: { text: '' } }]
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
                const res = await api.put(`/automation-rules/${editingRule}`, formData);
                setRules(rules.map(r => r._id === editingRule ? res.data : r));
                toast.success(t('automation.updateSuccess', 'Başarıyla güncellendi!'));
            } else {
                const res = await api.post('/automation-rules', formData);
                setRules([res.data, ...rules]);
                toast.success(t('automation.createSuccess', 'Başarıyla oluşturuldu!'));
            }
            setIsModalOpen(false);
        } catch (error) {
            toast.error(t('automation.saveError', 'Kaydedilirken hata oluştu'));
        }
    };

    const handleDelete = (id, ruleName) => {
        setConfirmDialog({ isOpen: true, ruleId: id, ruleName });
    };

    const confirmDelete = async () => {
        if (!confirmDialog.ruleId) return;
        try {
            await api.delete(`/automation-rules/${confirmDialog.ruleId}`);
            setRules(rules.filter(r => r._id !== confirmDialog.ruleId));
            toast.success(t('automation.deleteSuccess', 'Silindi'));
        } catch (error) {
            toast.error(t('automation.deleteError', 'Silinemedi'));
        } finally {
            setConfirmDialog({ isOpen: false, ruleId: null, ruleName: '' });
        }
    };

    const toggleStatus = async (rule) => {
        try {
            const res = await api.put(`/automation-rules/${rule._id}`, { ...rule, isActive: !rule.isActive });
            setRules(rules.map(r => r._id === rule._id ? res.data : r));
            toast.success(t('automation.statusUpdateSuccess', 'Durum güncellendi'));
        } catch (error) {
            toast.error(t('automation.statusUpdateError', 'Durum güncellenemedi'));
        }
    };

    const addCondition = () => {
        setFormData({
            ...formData,
            conditions: [...formData.conditions, { field: 'message.content', operator: 'contains', value: '' }]
        });
    };

    const updateCondition = (index, key, value) => {
        const newConditions = [...formData.conditions];
        newConditions[index][key] = value;
        setFormData({ ...formData, conditions: newConditions });
    };

    const removeCondition = (index) => {
        const newConditions = formData.conditions.filter((_, i) => i !== index);
        setFormData({ ...formData, conditions: newConditions });
    };

    if (loading) return <div>Loading...</div>;

    return (
        <div className="p-6 border border-gray-100 dark:border-gray-800 rounded-lg shadow-sm bg-white dark:bg-gray-900">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <GitMerge className="w-6 h-6 text-indigo-500" /> {t('automation.title', 'Automation Workflows')}
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">{t('automation.subtitle', 'Automate routing, tagging, and replies')}</p>
                </div>
                <button
                    onClick={() => openModal()}
                    className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                    <Plus className="w-5 h-5 mr-2" />
                    {t('automation.createBtn', 'Create Workflow')}
                </button>
            </div>

            <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('automation.selectSite', 'Select Site')}</label>
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {rules.length === 0 ? (
                    <div className="col-span-full py-12 text-center text-gray-500 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
                        <GitMerge className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                        <p>{t('automation.emptyText', 'No automation workflows yet. Create one to streamline your support.')}</p>
                    </div>
                ) : rules.map(rule => (
                    <div key={rule._id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 flex flex-col transition-all hover:shadow-md">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white line-clamp-1">{rule.name}</h3>
                            <div className="flex gap-2">
                                <button onClick={() => toggleStatus(rule)} className={`p-1 rounded-full ${rule.isActive ? 'text-green-600' : 'text-gray-400'}`}>
                                    <Play className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-4 flex-1">
                            <div className="mb-2"><span className="font-medium">{t('automation.triggerLabel', 'On:')}</span> {rule.triggerType.replace('_', ' ')}</div>
                            <div><span className="font-medium">{t('automation.actionsLabel', 'Actions:')}</span> {rule.actions.length} {t('automation.actionsCount', 'action(s)')}</div>
                        </div>

                        <div className="flex justify-between items-center pt-4 border-t border-gray-100 dark:border-gray-700 text-sm">
                            <span className="text-gray-500">{rule.metrics?.executionsCount || 0} {t('automation.executions', 'executions')}</span>
                            <div className="flex gap-3">
                                <button onClick={() => openModal(rule)} className="text-indigo-600 hover:text-indigo-800">{t('common.edit', 'Edit')}</button>
                                <button onClick={() => handleDelete(rule._id, rule.name)} className="text-red-500 hover:text-red-700">{t('common.delete', 'Delete')}</button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 rounded-t-xl">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                {editingRule ? t('automation.editWorkflow', 'Edit Workflow') : t('automation.newWorkflow', 'New Workflow')}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1 dark:text-gray-300">{t('automation.nameLabel', 'Name')}</label>
                                    <input
                                        required
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 outline-none dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 dark:text-gray-300">{t('automation.triggerLabelInput', 'Trigger')}</label>
                                    <select
                                        value={formData.triggerType}
                                        onChange={(e) => setFormData({ ...formData, triggerType: e.target.value })}
                                        className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 outline-none dark:text-white"
                                    >
                                        <option value="message_received">{t('automation.triggerMsgReceived', 'Message Received')}</option>
                                        <option value="conversation_created">{t('automation.triggerConvCreated', 'Conversation Created')}</option>
                                    </select>
                                </div>
                            </div>

                            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="font-semibold text-gray-900 dark:text-white">{t('automation.ifConditions', 'IF Conditions')}</h4>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-gray-500">{t('automation.match', 'Match')}</span>
                                        <select
                                            value={formData.conditionOperator}
                                            onChange={(e) => setFormData({ ...formData, conditionOperator: e.target.value })}
                                            className="text-sm px-2 py-1 border rounded dark:bg-gray-700 dark:text-white"
                                        >
                                            <option value="AND">{t('automation.matchAll', 'ALL')}</option>
                                            <option value="OR">{t('automation.matchAny', 'ANY')}</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    {formData.conditions.map((cond, index) => (
                                        <div key={index} className="flex gap-2 items-center">
                                            <select
                                                value={cond.field}
                                                onChange={(e) => updateCondition(index, 'field', e.target.value)}
                                                className="w-1/3 px-3 py-2 border rounded bg-white dark:bg-gray-700 dark:text-white"
                                            >
                                                <option value="message.content">{t('automation.fieldMsgBody', 'Message Body')}</option>
                                                <option value="visitor.country">{t('automation.fieldVisitorCountry', 'Visitor Country')}</option>
                                            </select>
                                            <select
                                                value={cond.operator}
                                                onChange={(e) => updateCondition(index, 'operator', e.target.value)}
                                                className="w-1/4 px-3 py-2 border rounded bg-white dark:bg-gray-700 dark:text-white"
                                            >
                                                <option value="contains">{t('automation.opContains', 'Contains')}</option>
                                                <option value="equals">{t('automation.opEquals', 'Is')}</option>
                                            </select>
                                            <input
                                                type="text"
                                                value={cond.value}
                                                onChange={(e) => updateCondition(index, 'value', e.target.value)}
                                                className="flex-1 px-3 py-2 border rounded bg-white dark:bg-gray-700 dark:text-white"
                                                placeholder={t('automation.opPlaceholder', 'Keyword or value')}
                                            />
                                            <button type="button" onClick={() => removeCondition(index)} className="p-2 text-red-500 hover:bg-red-50 rounded">
                                                <X className="w-5 h-5" />
                                            </button>
                                        </div>
                                    ))}
                                    <button type="button" onClick={addCondition} className="text-sm text-indigo-600 font-medium">
                                        + {t('automation.addCondition', 'Add Condition')}
                                    </button>
                                </div>
                            </div>

                            <div className="p-4 bg-indigo-50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-800">
                                <h4 className="font-semibold text-gray-900 dark:text-white mb-4">{t('automation.thenActions', 'THEN Actions')}</h4>
                                <div className="flex gap-2 items-end">
                                    <div className="w-1/3">
                                        <label className="block text-xs text-gray-500 mb-1">{t('automation.actionType', 'Action Type')}</label>
                                        <select
                                            value={formData.actions[0].type}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                actions: [{ type: e.target.value, payload: { text: '' } }] // Simple version: handling 1 action for UI demo
                                            })}
                                            className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 dark:text-white"
                                        >
                                            <option value="send_message">{t('automation.actAutoReply', 'Auto Reply')}</option>
                                            <option value="add_tag">{t('automation.actAddTag', 'Add Tag')}</option>
                                        </select>
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-xs text-gray-500 mb-1">{t('automation.actionValue', 'Value')}</label>
                                        <input
                                            type="text"
                                            value={formData.actions[0].payload.text || formData.actions[0].payload.tag || ''}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                actions: [{ type: formData.actions[0].type, payload: formData.actions[0].type === 'add_tag' ? { tag: e.target.value } : { text: e.target.value } }]
                                            })}
                                            className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 dark:text-white"
                                            placeholder={formData.actions[0].type === 'add_tag' ? 'urgent' : t('automation.actAutoReplyHolder', 'Auto reply message')}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 rounded">{t('common.cancel', 'Cancel')}</button>
                                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded flex items-center">
                                    <Save className="w-4 h-4 mr-2" /> {t('automation.saveWorkflow', 'Save Workflow')}
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
                message={t('automation.deleteMessage', 'Are you sure you want to delete the "{name}" rule? This action cannot be undone.', { name: confirmDialog.ruleName })}
            />
        </div>
    );
};

export default AutomationRules;
