import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../contexts/LanguageContext';
import { MessageSquare, ArrowRight, ArrowLeft, CheckCircle } from 'lucide-react';
import api from '../services/api';
import logo from '../public/support.io.webp';
const Onboarding = () => {
    const { t } = useTranslation();
    const { language } = useLanguage();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [purpose, setPurpose] = useState('');
    const [websiteUrl, setWebsiteUrl] = useState('');
    const [phone, setPhone] = useState('');
    const [country, setCountry] = useState('Turkey');
    const [welcomeMessage, setWelcomeMessage] = useState(t('onboarding.triggers.help', 'Biraz yardım sunun 👋'));
    const [title, setTitle] = useState(user?.name || '');
    const [color, setColor] = useState('#4F46E5');
    const langPrefix = language === 'en' ? '/en' : '';
    const colors = [
        { value: '#1E293B', label: 'Dark' },
        { value: '#3B82F6', label: 'Blue' },
        { value: '#10B981', label: 'Green' },
        { value: '#8B5CF6', label: 'Purple' },
        { value: '#4F46E5', label: 'Indigo' }
    ];
    const handleNext = () => {
        if (step === 1 && !purpose) {
            toast.error(t('onboarding.selectPurposeError', 'Lütfen bir kullanım amacı seçin.'));
            return;
        }
        if (step === 2 && !websiteUrl) {
            toast.error(t('onboarding.enterUrlError', 'Lütfen sitenizin URL adresini girin.'));
            return;
        }
        setStep((prev) => prev + 1);
    };
    const handleBack = () => {
        setStep((prev) => prev - 1);
    };
    const handleSubmit = async () => {
        if (!title) {
            toast.error(t('onboarding.enterNameError', 'Lütfen adınızı girin.'));
            return;
        }
        setLoading(true);
        try {
            await api.post('/onboarding', {
                purpose,
                websiteUrl,
                phone,
                country,
                welcomeMessage,
                title,
                color
            });
            const localUser = JSON.parse(localStorage.getItem('user'));
            if (localUser) {
                localUser.isOnboarded = true;
                localStorage.setItem('user', JSON.stringify(localUser));
            }
            toast.success(t('onboarding.setupSuccess', 'Kurulum başarıyla tamamlandı!'));
            window.location.href = `${langPrefix}/dashboard`;
        } catch (error) {
            toast.error(error.response?.data?.error || t('onboarding.setupError', 'Bir hata oluştu.'));
        } finally {
            setLoading(false);
        }
    };
    const renderStepProgressBar = () => {
        return (
            <div className="flex justify-center gap-2 mt-8 mb-4">
                {[1, 2, 3, 4].map((i) => (
                    <div
                        key={i}
                        className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${step === i
                            ? 'bg-green-500 scale-125'
                            : step > i
                                ? 'bg-green-400'
                                : 'bg-gray-300 dark:bg-gray-600'
                            }`}
                    />
                ))}
            </div>
        );
    };
    const renderStepContent = () => {
        switch (step) {
            case 1:
                return (
                    <div className="animate-fade-in-up">
                        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-6">
                            {t('onboarding.step1Title', "Support.io'yu nasıl kullanmayı planlıyorsunuz?")}
                        </h2>
                        <div className="space-y-4">
                            {[
                                { val: 'Daha fazla potansiyel müşteri çekmek için', key: 'onboarding.purposes.leads' },
                                { val: 'Mevcut müşterilerden daha fazla satış elde etmek için', key: 'onboarding.purposes.sales' },
                                { val: 'Müşteri hizmetlerimizi iyileştirmek için', key: 'onboarding.purposes.support' }
                            ].map((optionObj) => (
                                <div
                                    key={optionObj.val}
                                    onClick={() => setPurpose(optionObj.val)}
                                    className={`p-5 rounded-xl border-2 cursor-pointer transition-all ${purpose === optionObj.val
                                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300'
                                        }`}
                                >
                                    <p className="font-semibold">{t(optionObj.key, optionObj.val)}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            case 2:
                return (
                    <div className="animate-fade-in-up flex flex-col md:flex-row gap-8">
                        <div className="flex-1">
                            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-6">
                                {t('onboarding.step2Title', 'Hesap Bilgisi')}
                            </h2>
                            <div className="space-y-5">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        {t('onboarding.urlLabel', 'Sitenizin URL adresi *')}
                                    </label>
                                    <input
                                        type="url"
                                        value={websiteUrl}
                                        onChange={(e) => setWebsiteUrl(e.target.value)}
                                        placeholder="https://mysite.com"
                                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        {t('onboarding.phoneLabel', 'Telefon numarası')}
                                    </label>
                                    <div className="flex gap-3">
                                        <select
                                            className="w-24 px-3 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500"
                                        >
                                            <option>🇹🇷 +90</option>
                                            <option>🇺🇸 +1</option>
                                        </select>
                                        <input
                                            type="tel"
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value)}
                                            className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        {t('onboarding.countryLabel', 'Firmanızın ülkesi')}
                                    </label>
                                    <select
                                        value={country}
                                        onChange={(e) => setCountry(e.target.value)}
                                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                                    >
                                        <option value="Turkey">Turkey</option>
                                        <option value="United States">United States</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        { }
                        <div className="hidden md:block w-72 bg-gray-100 dark:bg-gray-800 rounded-3xl overflow-hidden shadow-2xl border border-gray-200 dark:border-gray-700 h-[450px] relative">
                            <div className="h-20 bg-gradient-to-r from-blue-500 to-green-400 p-4 flex items-center justify-between text-white rounded-t-3xl">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                                        {title ? title.charAt(0).toUpperCase() : 'U'}
                                    </div>
                                    <div>
                                        <div className="font-semibold text-sm">{title || t('onboarding.previewName', "Destek Ekibi")}</div>
                                        <div className="text-xs text-blue-100">{t('onboarding.previewRole', 'Müşteri Temsilcisi')}</div>
                                    </div>
                                </div>
                            </div>
                            <div className="p-4 bg-white dark:bg-gray-800 h-full flex flex-col">
                                <div className="text-center text-xs text-gray-400 mb-4 whitespace-nowrap">{t('onboarding.previewAgency', 'Canlı Destek Sağlayıcısı Support.io')}</div>
                                <div className="flex gap-2 mb-4 mt-auto">
                                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex-shrink-0"></div>
                                    <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-2xl rounded-tl-none text-sm text-gray-700 dark:text-gray-200">
                                        {t('onboarding.previewGreeting', 'Merhaba, size nasıl yardımcı olabilirim? 👋')}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 3:
                return (
                    <div className="animate-fade-in-up flex flex-col md:flex-row gap-8">
                        <div className="flex-1">
                            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-6">
                                {t('onboarding.step3Title', 'Akıllı Tetikleyiciler')}
                            </h2>
                            <p className="text-gray-600 dark:text-gray-400 mb-6">
                                {t('onboarding.step3Desc', 'Akıllı tetikleyiciler, web sitenizdeki ziyaretçilerle sohbet başlatmanıza yardımcı olur. Hangi hoş geldiniz mesajını kullanmak istersiniz?')}
                            </p>
                            <div className="space-y-4">
                                {[
                                    { val: 'Biraz yardım sunun 👋', key: 'onboarding.triggers.help' },
                                    { val: 'Sıcak bir karşılama yapın 🤗', key: 'onboarding.triggers.welcome' },
                                    { val: 'İndirimlerinizden bahsedin 🎁', key: 'onboarding.triggers.discount' }
                                ].map((msgObj) => {
                                    const translatedMsg = t(msgObj.key, msgObj.val);
                                    return (
                                        <label key={msgObj.val} className="flex items-center gap-4 cursor-pointer group">
                                            <input
                                                type="radio"
                                                name="welcomeMsg"
                                                checked={welcomeMessage === translatedMsg || welcomeMessage === msgObj.val}
                                                onChange={() => setWelcomeMessage(translatedMsg)}
                                                className="w-5 h-5 text-green-500 border-gray-300 focus:ring-green-500"
                                            />
                                            <span className="text-gray-800 dark:text-gray-200 font-medium group-hover:text-green-600 transition-colors">
                                                {translatedMsg}
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                            <p className="text-sm text-gray-500 mt-8">
                                {t('onboarding.step3Note', 'Akıllı tetikleyicilerin metnini ve sohbet öncesi butonları daha sonra ayarlardan değiştirebileceksiniz.')}
                            </p>
                        </div>
                        { }
                        <div className="hidden md:block w-72 bg-gray-100 dark:bg-gray-800 rounded-3xl overflow-hidden shadow-2xl border border-gray-200 dark:border-gray-700 h-[450px] relative">
                            <div className="h-20 bg-gradient-to-r from-blue-500 to-green-400 p-4 flex items-center justify-between text-white rounded-t-3xl">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                                        {title ? title.charAt(0).toUpperCase() : 'U'}
                                    </div>
                                    <div>
                                        <div className="font-semibold text-sm">{title || t('onboarding.previewName', "Destek Ekibi")}</div>
                                        <div className="text-xs text-blue-100">{t('onboarding.previewRole', 'Müşteri Temsilcisi')}</div>
                                    </div>
                                </div>
                            </div>
                            <div className="p-4 bg-white dark:bg-gray-800 h-full flex flex-col">
                                <div className="flex gap-2 mb-4 mt-auto">
                                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex-shrink-0 flex items-center justify-center text-xs">{title?.charAt(0) || 'U'}</div>
                                    <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-2xl rounded-tl-none text-sm text-gray-700 dark:text-gray-200 shadow-sm">
                                        {welcomeMessage}
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    <span className="px-3 py-1.5 border border-blue-400 text-blue-500 rounded-full text-xs">{t('onboarding.chatBtn1', 'Merhaba!')}</span>
                                    <span className="px-3 py-1.5 border border-blue-400 text-blue-500 rounded-full text-xs">{t('onboarding.chatBtn2', 'Yardıma ihtiyacım var')}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 4:
                return (
                    <div className="animate-fade-in-up flex flex-col md:flex-row gap-8">
                        <div className="flex-1">
                            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-6">
                                {t('onboarding.step4Title', 'Sohbet pencerenizi özelleştirin')}
                            </h2>
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        {t('onboarding.nameLabel', 'Adınızı girin')}
                                    </label>
                                    <input
                                        type="text"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 outline-none transition"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">{t('onboarding.nameDesc', 'Müşterilerle sohbet ettiğinizde adınız ve ünvanınız görüntülenecek')}</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        {t('onboarding.themeLabel', 'Bir Renk Teması Seçin')}
                                    </label>
                                    <div className="flex gap-3">
                                        {colors.map((c) => (
                                            <button
                                                key={c.value}
                                                onClick={() => setColor(c.value)}
                                                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${color === c.value ? 'ring-4 ring-offset-2 ring-green-500 dark:ring-offset-gray-900' : ''
                                                    }`}
                                                style={{ backgroundColor: c.value }}
                                            >
                                                {color === c.value && <CheckCircle className="w-5 h-5 text-white" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                        { }
                        <div className="hidden md:block w-72 bg-gray-100 dark:bg-gray-800 rounded-3xl overflow-hidden shadow-2xl border border-gray-200 dark:border-gray-700 h-[450px] relative">
                            <div className="h-20 p-4 flex items-center justify-between text-white rounded-t-3xl transition-colors duration-300" style={{ backgroundColor: color }}>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                                        {title ? title.charAt(0).toUpperCase() : 'U'}
                                    </div>
                                    <div>
                                        <div className="font-semibold text-sm">{title || t('onboarding.previewName', "Destek Ekibi")}</div>
                                        <div className="text-xs text-white/80">{t('onboarding.previewRole', 'Müşteri Temsilcisi')}</div>
                                    </div>
                                </div>
                            </div>
                            <div className="p-4 bg-white dark:bg-gray-800 h-full flex flex-col">
                                <div className="text-center text-xs text-gray-400 mb-4 whitespace-nowrap">{t('onboarding.previewAgency', 'Canlı Destek Sağlayıcısı Support.io')}</div>
                                <div className="flex gap-2 mb-4 mt-auto">
                                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex-shrink-0 flex items-center justify-center text-xs">{title?.charAt(0) || 'U'}</div>
                                    <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-2xl rounded-tl-none text-sm text-gray-700 dark:text-gray-200">
                                        {t('onboarding.previewWidgetText', 'Sohbet pencereniz sitenizde böyle görünecek. Gerekli alanları doldurun ve ardından kuruluma devam edebiliriz 🙂')}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };
    return (
        <>
            <Helmet>
                <title>{t('onboarding.title', 'Kurulum - Support.io')}</title>
            </Helmet>
            <div className="min-h-screen bg-[#f8f9fa] dark:bg-brand-dark flex flex-col items-center py-10 px-4 transition-colors duration-200">
                <div className="w-full max-w-5xl bg-white dark:bg-brand-card rounded-[2rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col transition-colors min-h-[70vh]">
                    { }
                    <div className="p-8 md:p-12 flex-1">
                        <div className="mb-8">
                            <img src={logo} alt="Support.io" className="h-10 w-auto" />
                        </div>
                        {renderStepContent()}
                    </div>
                    { }
                    <div className="bg-gray-50 dark:bg-gray-800/50 p-6 md:px-12 border-t border-gray-100 dark:border-gray-700 flex flex-col items-center relative">
                        {renderStepProgressBar()}
                        <div className="w-full flex justify-between items-center absolute inset-y-0 px-6 md:px-12">
                            {step > 1 ? (
                                <button
                                    onClick={handleBack}
                                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 font-medium px-4 py-2 transition-colors"
                                >
                                    {t('onboarding.back', 'Geri')}
                                </button>
                            ) : (
                                <div />
                            )}
                            {step < 4 ? (
                                <button
                                    onClick={handleNext}
                                    className="bg-green-500 hover:bg-green-600 text-white px-8 py-3 rounded-xl font-semibold transition-colors shadow-lg shadow-green-500/30 flex items-center gap-2"
                                >
                                    {t('onboarding.next', 'İlerle')} <ArrowRight className="w-4 h-4" />
                                </button>
                            ) : (
                                <button
                                    onClick={handleSubmit}
                                    disabled={loading}
                                    className="bg-green-500 hover:bg-green-600 text-white px-8 py-3 rounded-xl font-semibold transition-colors shadow-lg shadow-green-500/30 flex items-center gap-2 disabled:opacity-50"
                                >
                                    {loading ? t('onboarding.completing', 'Tamamlanıyor...') : t('onboarding.complete', 'Tamamla')} <ArrowRight className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};
export default Onboarding;
