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
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load widget configuration');
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
    
    // Auto-save with debounce
    clearTimeout(window.widgetConfigSaveTimeout);
    window.widgetConfigSaveTimeout = setTimeout(async () => {
      try {
        await widgetConfigAPI.updateConfig(siteId, updates);
      } catch (error) {
        console.error('Auto-save failed:', error);
        toast.error('Failed to save changes');
      }
    }, 500);
  }, [config, siteId]);

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Logo size must be less than 5MB');
      return;
    }
    
    try {
      setSaving(true);
      const response = await widgetConfigAPI.uploadLogo(siteId, file);
      setConfig(response.data.config);
      toast.success('Logo uploaded successfully');
    } catch (error) {
      console.error('Logo upload failed:', error);
      toast.error('Failed to upload logo');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLogo = async () => {
    try {
      setSaving(true);
      const response = await widgetConfigAPI.deleteLogo(siteId);
      setConfig(response.data.config);
      toast.success('Logo deleted');
    } catch (error) {
      console.error('Logo delete failed:', error);
      toast.error('Failed to delete logo');
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
    { id: 'colors', label: 'Colors', icon: Palette },
    { id: 'branding', label: 'Branding', icon: ImageIcon },
    { id: 'button', label: 'Button', icon: MessageSquare },
    { id: 'messages', label: 'Messages', icon: Type },
    { id: 'behavior', label: 'Behavior', icon: Zap },
    { id: 'advanced', label: 'Advanced', icon: Settings },
  ];

  return (
    <>
      <Helmet>
        <title>{`Widget Customization - ${site?.name || ''} - Support.io`}</title>
      </Helmet>

      <div className="max-w-7xl mx-auto">
        {/* Header */}
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
                Widget Customization
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {site?.name} - Customize your chat widget appearance
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPreviewOpen(!previewOpen)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition"
            >
              <Eye className="w-4 h-4" />
              {previewOpen ? 'Hide' : 'Show'} Preview
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Settings Panel */}
          <div className="lg:col-span-2 space-y-6">
            {/* Tabs */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-2 px-6 py-4 font-medium transition ${
                        activeTab === tab.id
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
                {/* Colors Tab */}
                {activeTab === 'colors' && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold mb-4">Color Palette</h3>
                    {[
                      { key: 'primary', label: 'Primary Color' },
                      { key: 'header', label: 'Header Background' },
                      { key: 'background', label: 'Window Background' },
                      { key: 'text', label: 'Text Color' },
                      { key: 'textSecondary', label: 'Secondary Text' },
                      { key: 'border', label: 'Border Color' },
                      { key: 'visitorMessageBg', label: 'Visitor Message' },
                      { key: 'agentMessageBg', label: 'Agent Message' },
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

                {/* Branding Tab */}
                {activeTab === 'branding' && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold mb-4">Branding</h3>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Logo
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
                              Change Logo
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
                              Delete Logo
                            </button>
                          </div>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                          <Upload className="w-8 h-8 text-gray-400 mb-2" />
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            Click to upload logo
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
                        Brand Name
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
                        Show Brand Name
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
                          Logo Width (px)
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
                          Logo Height (px)
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

                {/* Button Tab */}
                {activeTab === 'button' && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold mb-4">Button Style</h3>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Position
                      </label>
                      <select
                        value={config?.button?.position || 'bottom-right'}
                        onChange={(e) => updateConfig({
                          button: { position: e.target.value }
                        })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                      >
                        <option value="bottom-right">Bottom Right</option>
                        <option value="bottom-left">Bottom Left</option>
                        <option value="top-right">Top Right</option>
                        <option value="top-left">Top Left</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Size
                      </label>
                      <select
                        value={config?.button?.size || 'medium'}
                        onChange={(e) => updateConfig({
                          button: { size: e.target.value }
                        })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                      >
                        <option value="small">Small</option>
                        <option value="medium">Medium</option>
                        <option value="large">Large</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Show Shadow
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
                        Border Radius (%)
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

                {/* Messages Tab */}
                {activeTab === 'messages' && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold mb-4">Messages</h3>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Welcome Message
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
                        Placeholder Text
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
                        Show Timestamps
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
                        Show Avatars
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
                        Message Bubble Radius (px)
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

                {/* Behavior Tab */}
                {activeTab === 'behavior' && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold mb-4">Behavior</h3>
                    
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Auto Open
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
                          Auto Open Delay (ms)
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
                        Show Unread Badge
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
                        Enable Sound
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

                {/* Advanced Tab */}
                {activeTab === 'advanced' && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold mb-4">Advanced</h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Window Width (px)
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
                          Window Height (px)
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
                        Custom CSS
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

          {/* Preview Panel */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sticky top-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Live Preview
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
