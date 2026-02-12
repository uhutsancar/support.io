import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../contexts/LanguageContext';
import toast from 'react-hot-toast';
import { teamAPI, sitesAPI } from '../services/api';
import ConfirmDialog from '../components/ConfirmDialog';
import io from 'socket.io-client';
import { 
  Users, Plus, Edit, Trash2, UserCheck, UserX, 
  Shield, Activity, MessageSquare, Clock, Search, Filter, Globe 
} from 'lucide-react';

const Team = () => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const navigate = useNavigate();
  
  const langPrefix = language === 'en' ? '/en' : '';
  const routes = {
    sites: `${langPrefix}/dashboard/sites`
  };
  const [team, setTeam] = useState([]);
  const [sites, setSites] = useState([]);
  const [selectedSite, setSelectedSite] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, userId: null, userName: '' });
  const [socket, setSocket] = useState(null);

  // Socket.io bağlantısı
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const newSocket = io('http://localhost:3000/admin', {
      auth: { token }
    });

    newSocket.on('connect', () => {
      console.log('✅ Socket connected for Team page');
    });

    // Team üyesi durum değişikliklerini dinle
    newSocket.on('agent-status-changed', ({ userId, status }) => {
      console.log('🔄 Agent status changed:', userId, status);
      setTeam(prevTeam => 
        prevTeam.map(member => 
          member._id === userId ? { ...member, status } : member
        )
      );
    });

    // Team üyesi eklendi
    newSocket.on('team-member-added', (newMember) => {
      console.log('👤 New team member added:', newMember);
      setTeam(prevTeam => [...prevTeam, newMember]);
      toast.success('Yeni ekip üyesi eklendi');
    });

    // Team üyesi güncellendi
    newSocket.on('team-member-updated', (updatedMember) => {
      console.log('✏️ Team member updated:', updatedMember);
      setTeam(prevTeam => 
        prevTeam.map(member => 
          member._id === updatedMember._id ? updatedMember : member
        )
      );
    });

    // Team üyesi silindi
    newSocket.on('team-member-deleted', ({ userId }) => {
      console.log('🗑️ Team member deleted:', userId);
      setTeam(prevTeam => prevTeam.filter(member => member._id !== userId));
      toast.success('Ekip üyesi silindi');
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  useEffect(() => {
    fetchSites();
  }, []);

  useEffect(() => {
    if (selectedSite) {
      console.log('🔄 selectedSite changed, fetching team:', selectedSite);
      fetchTeam();
    }
  }, [selectedSite]);

  const fetchSites = async () => {
    try {
      setLoading(true);
      const response = await sitesAPI.getAll();
      setSites(response.data.sites || []);
      if (response.data.sites?.length > 0) {
        setSelectedSite(response.data.sites[0]._id);
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Error fetching sites:', error);
      setLoading(false);
    }
  };

  const fetchTeam = async () => {
    try {
      setLoading(true);
      console.log('🔄 fetchTeam called - Fetching team for site:', selectedSite);
      console.log('🔍 Current team state before fetch:', team.length, 'members');
      const response = await teamAPI.getAll(selectedSite);
      console.log('✅ Team data received:', response.data);
      console.log('👥 Number of members:', response.data?.length || 0);
      console.log('⚠️ Updating team state...');
      setTeam(response.data || []);
      console.log('✅ Team state updated');
    } catch (error) {
      console.error('❌ Error fetching team:', error);
      setTeam([]);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (userId, status) => {
    try {
      await teamAPI.updateStatus(userId, status);
      await fetchTeam();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleDeleteMember = async () => {
    const { userId } = confirmDialog;
    
    try {
      const response = await teamAPI.delete(userId);
      console.log('✅ Team member deleted:', response.data);
      // Fetch fresh data
      await fetchTeam();
      toast.success(t('team.deleteSuccess'));
    } catch (error) {
      console.error('❌ Error deleting member:', error);
      toast.error(error.response?.data?.error || t('team.deleteError'));
    }
  };

  const openDeleteConfirm = (userId, userName) => {
    setConfirmDialog({ isOpen: true, userId, userName });
  };

  const filteredTeam = team.filter(member => {
    const matchesSearch = member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         member.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || member.status === statusFilter;
    const matchesRole = roleFilter === 'all' || member.role === roleFilter;
    return matchesSearch && matchesStatus && matchesRole;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'offline': return 'bg-red-500';
      case 'busy': return 'bg-yellow-500';
      case 'away': return 'bg-gray-400';
      default: return 'bg-gray-400';
    }
  };

  const getRoleBadge = (role) => {
    const colors = {
      owner: 'bg-purple-100 text-purple-800',
      admin: 'bg-blue-100 text-blue-800',
      manager: 'bg-indigo-100 text-indigo-800',
      agent: 'bg-gray-100 text-gray-800',
    };
    return colors[role] || colors.agent;
  };

  return (
    <div className="p-6">
      <Helmet>
        <title>{t('team.title')} - DestekChat</title>
      </Helmet>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Users className="w-6 h-6" />
              {t('team.title')}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {t('team.subtitle')}
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            {t('team.addMember')}
          </button>
        </div>

        {/* Site Selector */}
        <div className="mt-4">
          <select
            value={selectedSite || ''}
            onChange={(e) => setSelectedSite(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="">{t('team.allSites')}</option>
            {sites.map(site => (
              <option key={site._id} value={site._id}>{site.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={t('team.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>
        </div>
        
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        >
          <option value="all">{t('team.filters.allStatus')}</option>
          <option value="online">{t('team.filters.online')}</option>
          <option value="offline">{t('team.filters.offline')}</option>
          <option value="busy">{t('team.filters.busy')}</option>
          <option value="away">{t('team.filters.away')}</option>
        </select>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        >
          <option value="all">{t('team.filters.allRoles')}</option>
          <option value="owner">{t('team.filters.owner')}</option>
          <option value="admin">{t('team.filters.admin')}</option>
          <option value="manager">{t('team.filters.manager')}</option>
          <option value="agent">{t('team.filters.agent')}</option>
        </select>
      </div>

      {/* Team Grid */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">{t('team.loading')}</p>
        </div>
      ) : sites.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg">
          <Globe className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 mb-4">{t('team.noSites')}</p>
          <button
            onClick={() => navigate(routes.sites)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {t('team.addSiteFirst')}
          </button>
        </div>
      ) : filteredTeam.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg">
          <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">{t('team.noMembers')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTeam.map(member => (
            <div key={member._id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${getStatusColor(member.status)}`}></div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{member.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{member.email}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">{t('team.modal.role')}</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getRoleBadge(member.role)}`}>
                    {t(`team.filters.${member.role}`)}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Status</span>
                  <select
                    value={member.status}
                    onChange={(e) => handleStatusChange(member._id, e.target.value)}
                    className="text-sm px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="online">{t('team.filters.online')}</option>
                    <option value="offline">{t('team.filters.offline')}</option>
                    <option value="busy">{t('team.filters.busy')}</option>
                    <option value="away">{t('team.filters.away')}</option>
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    <MessageSquare className="w-4 h-4 inline mr-1" />
                    {t('team.stats.active')}
                  </span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    {member.stats?.activeConversations || 0}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    <Activity className="w-4 h-4 inline mr-1" />
                    {t('team.stats.resolved')}
                  </span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    {member.stats?.resolvedConversations || 0}
                  </span>
                </div>

                {member.departments && member.departments.length > 0 && (
                  <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                    <span className="text-xs text-gray-500 dark:text-gray-400">{t('team.departments')}:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {member.departments.map((dept, idx) => (
                        <span key={idx} className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-xs">
                          {dept.departmentId?.name || 'Unknown'}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedMember(member)}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                >
                  <Edit className="w-4 h-4" />
                  {t('team.edit')}
                </button>
                <button
                  onClick={() => openDeleteConfirm(member._id, member.name)}
                  className="px-3 py-2 border border-red-300 dark:border-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900 text-red-600 dark:text-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Member Modal */}
      {(showAddModal || selectedMember) && (
        <AddEditMemberModal
          member={selectedMember}
          sites={sites}
          selectedSite={selectedSite}
          onClose={() => {
            setShowAddModal(false);
            setSelectedMember(null);
          }}
          onSave={async (newMember) => {
            console.log('💾 onSave called with:', newMember);
            // Wait for data refresh to complete
            await fetchTeam();
            console.log('✅ fetchTeam completed');
            // Then close modal
            setShowAddModal(false);
            setSelectedMember(null);
          }}
        />
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, userId: null, userName: '' })}
        onConfirm={handleDeleteMember}
        title="Ekip Üyesini Sil"
        message={`"${confirmDialog.userName}" adlı ekip üyesini silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`}
        confirmText="Evet, Sil"
        cancelText="İptal"
        type="danger"
      />
    </div>
  );
};

// Add/Edit Member Modal Component
const AddEditMemberModal = ({ member, sites, selectedSite, onClose, onSave }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    name: member?.name || '',
    email: member?.email || '',
    password: '',
    role: member?.role || 'agent',
    assignedSites: member?.assignedSites?.map(s => s._id || s) || (selectedSite ? [selectedSite] : []),
    permissions: member?.permissions || {
      canManageTeam: false,
      canManageDepartments: false,
      canViewAllConversations: true,
      canAssignConversations: true,
      canDeleteConversations: false
    }
  });

  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    console.log('📝 Submitting team member data:', formData);
    console.log('🎯 assignedSites:', formData.assignedSites);
    setSaving(true);

    try {
      let response;
      if (member) {
        response = await teamAPI.update(member._id, formData);
        console.log('✅ Team member updated:', response.data);
      } else {
        response = await teamAPI.create(formData);
        console.log('✅ Team member created:', response.data);
        console.log('🔍 Created user assignedSites:', response.data.assignedSites);
        console.log('📦 Full response.data:', JSON.stringify(response.data, null, 2));
      }
      
      console.log('💾 Calling onSave...');
      // CRITICAL: Wait for data refresh to complete
      // Let parent handle data refresh and modal closing
      await onSave(member ? null : response.data);
      console.log('✅ onSave completed');
      toast.success(member ? t('team.updateSuccess') : t('team.createSuccess'));
      setSaving(false);
    } catch (error) {
      console.error('❌ Error saving member:', error);
      console.error('Error details:', error.response?.data);
      toast.error(error.response?.data?.error || error.message || t('team.saveError'));
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
            {member ? t('team.modal.editTitle') : t('team.modal.addTitle')}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('team.modal.name')} *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('team.modal.email')} *
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            {!member && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('team.modal.password')} *
                </label>
                <input
                  type="password"
                  required={!member}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('team.modal.role')}
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="agent">{t('team.filters.agent')}</option>
                <option value="manager">{t('team.filters.manager')}</option>
                <option value="admin">{t('team.filters.admin')}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('team.modal.permissions')}
              </label>
              <div className="space-y-2">
                {Object.keys(formData.permissions).map(key => (
                  <label key={key} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={formData.permissions[key]}
                      onChange={(e) => setFormData({
                        ...formData,
                        permissions: { ...formData.permissions, [key]: e.target.checked }
                      })}
                      className="rounded border-gray-300 dark:border-gray-600"
                    />
                    {t(`team.modal.${key}`)}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                {t('team.modal.cancel')}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? t('team.modal.saving') : member ? t('team.modal.update') : t('team.modal.create')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Team;
