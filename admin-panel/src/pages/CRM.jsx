import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { dealsAPI } from '../services/api';
import { Plus, GripVertical, Building2, UserCircle, Briefcase, Mail, Phone, X, Edit2, Trash2, Tag, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import ConfirmDialog from '../components/ConfirmDialog';

const STAGES = [
    { id: 'new', labelKey: 'crm.stages.new', color: 'border-blue-500', bgInfo: 'bg-blue-50 dark:bg-blue-900/20' },
    { id: 'potential', labelKey: 'crm.stages.potential', color: 'border-purple-500', bgInfo: 'bg-purple-50 dark:bg-purple-900/20' },
    { id: 'quoted', labelKey: 'crm.stages.quoted', color: 'border-yellow-500', bgInfo: 'bg-yellow-50 dark:bg-yellow-900/20' },
    { id: 'negotiation', labelKey: 'crm.stages.negotiation', color: 'border-orange-500', bgInfo: 'bg-orange-50 dark:bg-orange-900/20' },
    { id: 'won', labelKey: 'crm.stages.won', color: 'border-green-500', bgInfo: 'bg-green-50 dark:bg-green-900/20' },
    { id: 'lost', labelKey: 'crm.stages.lost', color: 'border-red-500', bgInfo: 'bg-red-50 dark:bg-red-900/20' }
];
const CRM = () => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const [deals, setDeals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        title: '', value: 0, contactName: '', contactEmail: '', contactPhone: '', stage: 'new', notes: ''
    });
    const [draggedDeal, setDraggedDeal] = useState(null);
    const [dragOverColumn, setDragOverColumn] = useState(null);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [selectedDealId, setSelectedDealId] = useState(null);

    useEffect(() => {
        fetchDeals();
    }, []);
    const fetchDeals = async () => {
        try {
            setLoading(true);
            const response = await dealsAPI.getAll();
            setDeals(response.data || []);
        } catch (error) {
            toast.error(t('crm.fetchError', 'Fırsatlar yüklenemedi'));
        } finally {
            setLoading(false);
        }
    };
    const calculateFormatValue = (val) => {
        return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);
    };
    const getStageTotal = (stageId) => {
        return deals.filter(d => d.stage === stageId).reduce((sum, d) => sum + d.value, 0);
    };
    const getStageCount = (stageId) => {
        return deals.filter(d => d.stage === stageId).length;
    };
    const handleDragStart = (e, deal) => {
        setDraggedDeal(deal);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', deal._id);
        setTimeout(() => {
            if (e.target) e.target.classList.add('opacity-50');
        }, 0);
    };
    const handleDragEnd = (e) => {
        if (e.target) e.target.classList.remove('opacity-50');
        setDraggedDeal(null);
        setDragOverColumn(null);
    };
    const handleDragOver = (e, stageId) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (dragOverColumn !== stageId) {
            setDragOverColumn(stageId);
        }
    };
    const handleDragLeave = (e) => {
        e.preventDefault();
        setDragOverColumn(null);
    };
    const handleDrop = async (e, targetStageId) => {
        e.preventDefault();
        setDragOverColumn(null);
        const dealId = e.dataTransfer.getData('text/plain');
        if (!dealId || !draggedDeal) return;
        if (draggedDeal.stage === targetStageId) return;
        const prevDeals = [...deals];
        setDeals(deals.map(d => {
            if (d._id === dealId) {
                return { ...d, stage: targetStageId };
            }
            return d;
        }));
        try {
            await dealsAPI.updateStage(dealId, targetStageId, 0);
        } catch (error) {
            toast.error(t('crm.stageUpdateError', 'Durum güncellenemedi'));
            setDeals(prevDeals);
        }
    };
    const handleOpenModal = (stageId = 'new') => {
        setFormData({ title: '', value: '', contactName: '', contactEmail: '', contactPhone: '', stage: stageId, notes: '' });
        setIsModalOpen(true);
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const { data } = await dealsAPI.create(formData);
            setDeals((prev) => [data, ...prev]);
            toast.success(t('crm.createSuccess', 'Yeni fırsat oluşturuldu'));
            setIsModalOpen(false);
        } catch (error) {
            toast.error(t('crm.createError', 'Fırsat oluşturulamadı'));
        }
    };
    const handleDeleteClick = (dealId) => {
        setSelectedDealId(dealId);
        setDeleteConfirmOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!selectedDealId) return;
        try {
            await dealsAPI.delete(selectedDealId);
            setDeals(deals.filter(d => d._id !== selectedDealId));
            toast.success(t('crm.deleteSuccess', 'Silindi'));
        } catch (error) {
            toast.error(t('crm.deleteError', 'Silinemedi'));
        }
        setDeleteConfirmOpen(false);
        setSelectedDealId(null);
    };

    return (
        <>
            <Helmet>
                <title>{t('crm.title', 'CRM - Fırsatlar')} - Support.io</title>
            </Helmet>
            <div className="flex flex-col h-[calc(100vh-6rem)] relative overflow-hidden bg-gray-50 dark:bg-gray-900 rounded-xl">
                { }
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg text-indigo-600 dark:text-indigo-400">
                            <Briefcase className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('crm.title', 'CRM - Fırsatlar')}</h1>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{t('crm.subtitle', 'Satış aşamalarınızı sürükle bırak yönetin')}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => handleOpenModal('new')}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                    >
                        <Plus className="w-4 h-4" />
                        {t('crm.createDeal', 'Teklif Oluştur')}
                    </button>
                </div>
                { }
                <div className="flex-1 overflow-x-auto overflow-y-hidden p-6 custom-scrollbar">
                    <div className="flex gap-6 h-full items-start min-w-max pb-4">
                        {STAGES.map((stage) => (
                            <div
                                key={stage.id}
                                className={`flex flex-col w-[320px] rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 shadow-sm shrink-0 h-full max-h-full transition-colors ${dragOverColumn === stage.id ? 'ring-2 ring-indigo-500 ring-inset bg-indigo-50/10 dark:bg-indigo-900/10' : ''}`}
                                onDragOver={(e) => handleDragOver(e, stage.id)}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, stage.id)}
                            >
                                { }
                                <div className={`p-4 border-t-4 rounded-t-xl border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 ${stage.color} flex justify-between items-center sticky top-0`}>
                                    <div>
                                        <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                            {t(stage.labelKey)}
                                            <span className="text-xs font-normal bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full">
                                                {getStageCount(stage.id)}
                                            </span>
                                        </h3>
                                        <p className="text-xs text-gray-500 mt-1">{calculateFormatValue(getStageTotal(stage.id))}</p>
                                    </div>
                                    <button
                                        onClick={() => handleOpenModal(stage.id)}
                                        className="text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition"
                                        title="Buraya ekle"
                                    >
                                        <Plus className="w-4 h-4" />
                                    </button>
                                </div>
                                { }
                                <div className="p-3 flex-1 overflow-y-auto space-y-3 custom-scrollbar">
                                    {loading ? (
                                        <div className="flex items-center justify-center p-4">
                                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
                                        </div>
                                    ) : deals.filter(d => d.stage === stage.id).map(deal => (
                                        <div
                                            key={deal._id}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, deal)}
                                            onDragEnd={handleDragEnd}
                                            className="group relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow hover:border-indigo-300 dark:hover:border-indigo-700 overflow-hidden"
                                        >
                                            <div className="flex items-start justify-between mb-2">
                                                <h4 className="font-medium text-gray-900 dark:text-white leading-tight pr-6">{deal.title}</h4>
                                                <GripVertical className="w-4 h-4 text-gray-300 dark:text-gray-600 opacity-0 group-hover:opacity-100 transition absolute right-3 top-3 shrink-0" />
                                            </div>
                                            <div className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 mb-3">
                                                {calculateFormatValue(deal.value)}
                                            </div>
                                            <div className="space-y-1.5 text-xs text-gray-600 dark:text-gray-400">
                                                <div className="flex items-center gap-2">
                                                    <UserCircle className="w-3.5 h-3.5 text-gray-400" />
                                                    <span className="truncate">{deal.contactName}</span>
                                                </div>
                                                {deal.contactEmail && (
                                                    <div className="flex items-center gap-2">
                                                        <Mail className="w-3 h-3 text-gray-400" />
                                                        <span className="truncate">{deal.contactEmail}</span>
                                                    </div>
                                                )}
                                                {deal.notes && (
                                                    <div className="mt-2 text-xs italic text-gray-500 line-clamp-2">"{deal.notes}"</div>
                                                )}
                                            </div>
                                            { }
                                            <div className="absolute right-2 bottom-3 opacity-0 group-hover:opacity-100 transition bg-white dark:bg-gray-800 shadow-sm rounded border border-gray-100 dark:border-gray-700 flex">
                                                <button onClick={() => handleDeleteClick(deal._id)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {!loading && deals.filter(d => d.stage === stage.id).length === 0 && (
                                        <div className="flex flex-col items-center justify-center py-8 text-gray-400 dark:text-gray-600 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-lg">
                                            <Tag className="w-6 h-6 mb-2 opacity-30" />
                                            <span className="text-xs">{t('crm.empty', 'Boş')}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                { }
                {isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg border border-gray-200 dark:border-gray-700 animate-in fade-in zoom-in-95 duration-200">
                            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white/90">{t('crm.modalTitle', 'Yeni Fırsat Oluştur')}</h3>
                                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <form onSubmit={handleSubmit} className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        {t('crm.formTitle', 'Fırsat Başlığı')} <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        required
                                        type="text"
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        placeholder={t('crm.formTitlePlaceholder', 'Örn: Proje Yazılım Paketi #4')}
                                        className="w-full border border-gray-300 rounded-lg p-2.5 bg-gray-50 focus:ring-2 focus:ring-indigo-500 dark:bg-gray-900 dark:border-gray-700 dark:text-white focus:outline-none"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('crm.formValue', 'Tutar (TRY)')}</label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={formData.value}
                                            onChange={(e) => setFormData({ ...formData, value: Number(e.target.value) })}
                                            placeholder="0.00"
                                            className="w-full border border-gray-300 rounded-lg p-2.5 bg-gray-50 focus:ring-2 focus:ring-indigo-500 dark:bg-gray-900 dark:border-gray-700 dark:text-white focus:outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('crm.formStage', 'Aşama')}</label>
                                        <select
                                            value={formData.stage}
                                            onChange={(e) => setFormData({ ...formData, stage: e.target.value })}
                                            className="w-full border border-gray-300 rounded-lg p-2.5 bg-gray-50 focus:ring-2 focus:ring-indigo-500 dark:bg-gray-900 dark:border-gray-700 dark:text-white focus:outline-none">
                                            {STAGES.map(s => <option key={s.id} value={s.id}>{t(s.labelKey)}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="pt-2 border-t border-gray-100 dark:border-gray-700/50">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 mt-2">{t('crm.formCustomerDetails', 'Müşteri Detayları')} <span className="text-red-500">*</span></label>
                                    <input
                                        required
                                        type="text"
                                        value={formData.contactName}
                                        onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                                        placeholder={t('crm.formContactNamePlaceholder', 'Müşteri Ad Soyad')}
                                        className="mb-3 w-full border border-gray-300 rounded-lg p-2.5 bg-gray-50 focus:ring-2 focus:ring-indigo-500 dark:bg-gray-900 dark:border-gray-700 dark:text-white focus:outline-none"
                                    />
                                    <div className="grid grid-cols-2 gap-3">
                                        <input
                                            type="email"
                                            value={formData.contactEmail}
                                            onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                                            placeholder={t('crm.formContactEmailPlaceholder', 'E-posta (Opsiyonel)')}
                                            className="w-full border border-gray-300 rounded-lg p-2.5 text-sm bg-gray-50 focus:ring-2 focus:ring-indigo-500 dark:bg-gray-900 dark:border-gray-700 dark:text-white focus:outline-none"
                                        />
                                        <input
                                            type="tel"
                                            value={formData.contactPhone}
                                            onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                                            placeholder={t('crm.formContactPhonePlaceholder', 'Telefon (Opsiyonel)')}
                                            className="w-full border border-gray-300 rounded-lg p-2.5 text-sm bg-gray-50 focus:ring-2 focus:ring-indigo-500 dark:bg-gray-900 dark:border-gray-700 dark:text-white focus:outline-none"
                                        />
                                    </div>
                                </div>
                                <div className="pt-2">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('crm.formNotes', 'Notlar')}</label>
                                    <textarea
                                        value={formData.notes}
                                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                        rows="2"
                                        className="w-full border border-gray-300 rounded-lg p-2.5 bg-gray-50 text-sm focus:ring-2 focus:ring-indigo-500 dark:bg-gray-900 dark:border-gray-700 dark:text-white focus:outline-none resize-none"
                                    ></textarea>
                                </div>
                                <div className="flex justify-end gap-3 pt-4 font-medium">
                                    <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition">
                                        {t('common.cancel', 'İptal')}
                                    </button>
                                    <button type="submit" className="px-6 py-2 text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition shadow-md">
                                        {t('common.save', 'Kaydet')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>

            <ConfirmDialog
                isOpen={deleteConfirmOpen}
                onClose={() => {
                    setDeleteConfirmOpen(false);
                    setSelectedDealId(null);
                }}
                onConfirm={handleConfirmDelete}
                title={t('crm.deleteModalTitle', 'Teklifi Sil')}
                message={t('crm.deleteConfirm', 'Bu teklifi silmek istediğinize emin misiniz?')}
                confirmText={t('common.delete', 'Sil')}
                cancelText={t('common.cancel', 'İptal')}
                type="danger"
            />
        </>
    );
};
export default CRM;
