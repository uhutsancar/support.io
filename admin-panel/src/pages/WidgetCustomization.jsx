import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { sitesAPI, widgetConfigAPI } from '../services/api';
import WidgetPreview from '../components/WidgetPreview';
import {
  Palette, Upload, Save, ArrowLeft, Image as ImageIcon,
  MessageSquare, Settings, Type, Zap, Eye
} from 'lucide-react';
const WidgetCustomization = () => {
  const { t } = useTranslation();
  const { siteId } = useParams();
  const navigate = useNavigate();
  const [site, setSite] = useState(null);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('colors');
  useEffect(() => {
    fetchData();
  }, [siteId]);
  const fetchData = async () => {
    try {
      setLoading(true);
      const [siteRes, configRes] = await Promise.all([
        sitesAPI.getOne(siteId),
        widgetConfigAPI.getConfig(siteId)
      ]);
      setSite(siteRes.data.site);
      setConfig(configRes.data.config);
    } catch (error) {
      toast.error(t('widget.configLoadError', 'Failed to load widget configuration'));
    } finally {
      setLoading(false);
    }
  };
  const updateConfig = useCallback(async (updates) => {
    if (!config) return;
    const newConfig = {
      ...config,
      colors: { ...config.colors, ...(updates.colors || {}) },
      branding: { ...config.branding, ...(updates.branding || {}) },
      button: { ...config.button, ...(updates.button || {}) },
      window: { ...config.window, ...(updates.window || {}) },
      messages: { ...config.messages, ...(updates.messages || {}) },
      behavior: { ...config.behavior, ...(updates.behavior || {}) },
      typography: { ...config.typography, ...(updates.typography || {}) },
      advanced: { ...config.advanced, ...(updates.advanced || {}) },
      ...(updates.isActive !== undefined ? { isActive: updates.isActive } : {}),
    };
    setConfig(newConfig);
    clearTimeout(window.widgetConfigSaveTimeout);
    window.widgetConfigSaveTimeout = setTimeout(async () => {
      try {
        await widgetConfigAPI.updateConfig(siteId, updates);
      } catch (error) {
        toast.error(t('widget.configSaveError', 'Failed to save changes'));
      }
    }, 500);
  }, [config, siteId]);
  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('widget.logoSizeError', 'Logo size must be less than 5MB'));
      return;
    }
    try {
      setSaving(true);
      const response = await widgetConfigAPI.uploadLogo(siteId, file);
      setConfig(response.data.config);
      toast.success(t('widget.logoUploadSuccess', 'Logo uploaded successfully'));
    } catch (error) {
      toast.error(t('widget.logoUploadError', 'Failed to upload logo'));
    } finally {
      setSaving(false);
    }
  };
  const handleDeleteLogo = async () => {
    try {
      setSaving(true);
      const response = await widgetConfigAPI.deleteLogo(siteId);
      setConfig(response.data.config);
      toast.success(t('widget.logoDeleteSuccess', 'Logo deleted'));
    } catch (error) {
      toast.error(t('widget.logoDeleteError', 'Failed to delete logo'));
    } finally {
      setSaving(false);
    }
  };
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }
  const tabs = [
    { id: 'colors', label: t('widget.tabs.colors', 'Colors'), icon: Palette },
    { id: 'branding', label: t('widget.tabs.branding', 'Branding'), icon: ImageIcon },
    { id: 'button', label: t('widget.tabs.button', 'Button'), icon: MessageSquare },
    { id: 'messages', label: t('widget.tabs.messages', 'Messages'), icon: Type },
    { id: 'behavior', label: t('widget.tabs.behavior', 'Behavior'), icon: Zap },
    { id: 'advanced', label: t('widget.tabs.advanced', 'Advanced'), icon: Settings },
  ];
  return (
    <>
      <Helmet>
        <title>{`Widget Customization - ${site?.name || ''} - Support.io`}</title>
      </Helmet>
      <div className="max-w-7xl mx-auto">
        { }
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard/sites')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {t('widget.title', 'Widget Customization')}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {site?.name} - {t('widget.subtitle', 'Customize your chat widget appearance')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPreviewOpen(!previewOpen)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition"
            >
              <Eye className="w-4 h-4" />
              {previewOpen ? t('widget.hidePreview', 'Hide Preview') : t('widget.showPreview', 'Show Preview')}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          { }
          <div className="lg:col-span-2 space-y-6">
            { }
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-2 px-6 py-4 font-medium transition ${activeTab === tab.id
                        ? 'border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                        }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
              <div className="p-6">
                { }
                {activeTab === 'colors' && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold mb-4">{t('widget.colorPalette', 'Color Palette')}</h3>
                    {[
                      { key: 'primary', label: t('widget.colors.primary', 'Primary Color') },
                      { key: 'header', label: t('widget.colors.header', 'Header Background') },
                      { key: 'background', label: t('widget.colors.background', 'Window Background') },
                      { key: 'text', label: t('widget.colors.text', 'Text Color') },
                      { key: 'textSecondary', label: t('widget.colors.textSecondary', 'Secondary Text') },
                      { key: 'border', label: t('widget.colors.border', 'Border Color') },
                      { key: 'visitorMessageBg', label: t('widget.colors.visitorMsg', 'Visitor Message') },
                      { key: 'agentMessageBg', label: t('widget.colors.agentMsg', 'Agent Message') },
                    ].map((color) => (
                      <div key={color.key} className="flex items-center justify-between">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {color.label}
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={config?.colors?.[color.key] || '#4F46E5'}
                            onChange={(e) => updateConfig({
                              colors: { [color.key]: e.target.value }
                            })}
                            className="w-12 h-8 rounded border border-gray-300 cursor-pointer"
                          />
                          <input
                            type="text"
                            value={config?.colors?.[color.key] || '#4F46E5'}
                            onChange={(e) => updateConfig({
                              colors: { [color.key]: e.target.value }
                            })}
                            className="w-24 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                { }
                {activeTab === 'branding' && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold mb-4">{t('widget.branding', 'Branding')}</h3>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('widget.logo', 'Logo')}
                      </label>
                      {config?.branding?.logo ? (
                        <div className="flex items-center gap-4">
                          <img
                            src={config.branding.logo.startsWith('http')
                              ? config.branding.logo
                              : `${import.meta.env.VITE_API_URL}${config.branding.logo}`}
                            alt="Logo"
                            className="w-20 h-20 object-contain border border-gray-300 rounded"
                          />
                          <div className="flex flex-col gap-2">
                            <label className="px-4 py-2 bg-indigo-600 text-white rounded-lg cursor-pointer hover:bg-indigo-700 transition text-sm text-center">
                              {t('widget.changeLogo', 'Change Logo')}
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleLogoUpload}
                                className="hidden"
                              />
                            </label>
                            <button
                              onClick={handleDeleteLogo}
                              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm"
                            >
                              {t('widget.deleteLogo', 'Delete Logo')}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                          <Upload className="w-8 h-8 text-gray-400 mb-2" />
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {t('widget.uploadLogo', 'Click to upload logo')}
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleLogoUpload}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('widget.brandName', 'Brand Name')}
                      </label>
                      <input
                        type="text"
                        value={config?.branding?.brandName || ''}
                        onChange={(e) => updateConfig({
                          branding: { brandName: e.target.value }
                        })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {t('widget.showBrandName', 'Show Brand Name')}
                      </label>
                      <input
                        type="checkbox"
                        checked={config?.branding?.showBrandName !== false}
                        onChange={(e) => updateConfig({
                          branding: { showBrandName: e.target.checked }
                        })}
                        className="w-5 h-5 text-indigo-600 rounded"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          {t('widget.logoWidth', 'Logo Width (px)')}
                        </label>
                        <input
                          type="number"
                          value={config?.branding?.logoWidth || 40}
                          onChange={(e) => updateConfig({
                            branding: { logoWidth: parseInt(e.target.value) }
                          })}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          {t('widget.logoHeight', 'Logo Height (px)')}
                        </label>
                        <input
                          type="number"
                          value={config?.branding?.logoHeight || 40}
                          onChange={(e) => updateConfig({
                            branding: { logoHeight: parseInt(e.target.value) }
                          })}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                    </div>
                  </div>
                )}
                { }
                {activeTab === 'button' && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold mb-4">{t('widget.buttonStyle', 'Button Style')}</h3>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('widget.position', 'Position')}
                      </label>
                      <select
                        value={config?.button?.position || 'bottom-right'}
                        onChange={(e) => updateConfig({
                          button: { position: e.target.value }
                        })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                      >
                        <option value="bottom-right">{t('widget.positions.br', 'Bottom Right')}</option>
                        <option value="bottom-left">{t('widget.positions.bl', 'Bottom Left')}</option>
                        <option value="top-right">{t('widget.positions.tr', 'Top Right')}</option>
                        <option value="top-left">{t('widget.positions.tl', 'Top Left')}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('widget.size', 'Size')}
                      </label>
                      <select
                        value={config?.button?.size || 'medium'}
                        onChange={(e) => updateConfig({
                          button: { size: e.target.value }
                        })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                      >
                        <option value="small">{t('widget.sizes.small', 'Small')}</option>
                        <option value="medium">{t('widget.sizes.medium', 'Medium')}</option>
                        <option value="large">{t('widget.sizes.large', 'Large')}</option>
                      </select>
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {t('widget.showShadow', 'Show Shadow')}
                      </label>
                      <input
                        type="checkbox"
                        checked={config?.button?.shadow !== false}
                        onChange={(e) => updateConfig({
                          button: { shadow: e.target.checked }
                        })}
                        className="w-5 h-5 text-indigo-600 rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('widget.borderRadiusBtn', 'Border Radius (%)')}
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="50"
                        value={config?.button?.borderRadius || 50}
                        onChange={(e) => updateConfig({
                          button: { borderRadius: parseInt(e.target.value) }
                        })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                  </div>
                )}
                { }
                {activeTab === 'messages' && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold mb-4">{t('widget.messagesTitle', 'Messages')}</h3>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('widget.welcomeMessage', 'Welcome Message')}
                      </label>
                      <textarea
                        value={config?.messages?.welcomeMessage || ''}
                        onChange={(e) => updateConfig({
                          messages: { welcomeMessage: e.target.value }
                        })}
                        rows={3}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('widget.placeholderText', 'Placeholder Text')}
                      </label>
                      <input
                        type="text"
                        value={config?.messages?.placeholderText || ''}
                        onChange={(e) => updateConfig({
                          messages: { placeholderText: e.target.value }
                        })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {t('widget.showTimestamps', 'Show Timestamps')}
                      </label>
                      <input
                        type="checkbox"
                        checked={config?.messages?.showTimestamps !== false}
                        onChange={(e) => updateConfig({
                          messages: { showTimestamps: e.target.checked }
                        })}
                        className="w-5 h-5 text-indigo-600 rounded"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {t('widget.showAvatars', 'Show Avatars')}
                      </label>
                      <input
                        type="checkbox"
                        checked={config?.messages?.showAvatars !== false}
                        onChange={(e) => updateConfig({
                          messages: { showAvatars: e.target.checked }
                        })}
                        className="w-5 h-5 text-indigo-600 rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('widget.msgBubbleRadius', 'Message Bubble Radius (px)')}
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="20"
                        value={config?.messages?.messageBubbleRadius || 12}
                        onChange={(e) => updateConfig({
                          messages: { messageBubbleRadius: parseInt(e.target.value) }
                        })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                  </div>
                )}
                { }
                {activeTab === 'behavior' && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold mb-4">{t('widget.behaviorTitle', 'Behavior')}</h3>
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {t('widget.autoOpen', 'Auto Open')}
                      </label>
                      <input
                        type="checkbox"
                        checked={config?.behavior?.autoOpen || false}
                        onChange={(e) => updateConfig({
                          behavior: { autoOpen: e.target.checked }
                        })}
                        className="w-5 h-5 text-indigo-600 rounded"
                      />
                    </div>
                    {config?.behavior?.autoOpen && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          {t('widget.autoOpenDelay', 'Auto Open Delay (ms)')}
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={config?.behavior?.autoOpenDelay || 5000}
                          onChange={(e) => updateConfig({
                            behavior: { autoOpenDelay: parseInt(e.target.value) }
                          })}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {t('widget.showUnreadBadge', 'Show Unread Badge')}
                      </label>
                      <input
                        type="checkbox"
                        checked={config?.behavior?.showUnreadBadge !== false}
                        onChange={(e) => updateConfig({
                          behavior: { showUnreadBadge: e.target.checked }
                        })}
                        className="w-5 h-5 text-indigo-600 rounded"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {t('widget.enableSound', 'Enable Sound')}
                      </label>
                      <input
                        type="checkbox"
                        checked={config?.behavior?.enableSound !== false}
                        onChange={(e) => updateConfig({
                          behavior: { enableSound: e.target.checked }
                        })}
                        className="w-5 h-5 text-indigo-600 rounded"
                      />
                    </div>
                  </div>
                )}
                { }
                {activeTab === 'advanced' && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold mb-4">{t('widget.advancedTitle', 'Advanced')}</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          {t('widget.windowWidth', 'Window Width (px)')}
                        </label>
                        <input
                          type="number"
                          min="300"
                          max="600"
                          value={config?.window?.width || 400}
                          onChange={(e) => updateConfig({
                            window: { width: parseInt(e.target.value) }
                          })}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          {t('widget.windowHeight', 'Window Height (px)')}
                        </label>
                        <input
                          type="number"
                          min="400"
                          max="800"
                          value={config?.window?.height || 650}
                          onChange={(e) => updateConfig({
                            window: { height: parseInt(e.target.value) }
                          })}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('widget.customCSS', 'Custom CSS')}
                      </label>
                      <textarea
                        value={config?.advanced?.customCSS || ''}
                        onChange={(e) => updateConfig({
                          advanced: { customCSS: e.target.value }
                        })}
                        rows={6}
                        placeholder=".sc-widget-container { ... }"
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white font-mono text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          { }
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sticky top-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Eye className="w-5 h-5" />
                {t('widget.livePreview', 'Live Preview')}
              </h3>
              <div className="relative" style={{ height: '700px', overflow: 'hidden' }}>
                {config && (
                  <WidgetPreview
                    config={config}
                    isOpen={previewOpen}
                    onToggle={() => setPreviewOpen(!previewOpen)}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
export default WidgetCustomization;
