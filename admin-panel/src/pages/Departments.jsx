import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../contexts/LanguageContext';
import toast from 'react-hot-toast';
import { departmentsAPI, teamAPI, sitesAPI } from '../services/api';
import ConfirmDialog from '../components/ConfirmDialog';
import { 
  Folder, Plus, Edit, Trash2, Users, MessageSquare, 
  Settings, TrendingUp, Clock, Search, Globe 
} from 'lucide-react';

const Departments = () => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const navigate = useNavigate();
  
  const langPrefix = language === 'en' ? '/en' : '';
  const routes = {
    sites: `${langPrefix}/dashboard/sites`
  };
  const [departments, setDepartments] = useState([]);
  const [sites, setSites] = useState([]);
  const [selectedSite, setSelectedSite] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, departmentId: null, departmentName: '' });

  useEffect(() => {
    fetchSites();
  }, []);

  useEffect(() => {
    if (selectedSite) {
      console.log('🔄 selectedSite changed, fetching departments:', selectedSite);
      fetchDepartments();
      fetchTeamMembers();
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

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      console.log('🔄 Fetching departments for site:', selectedSite);
      const response = await departmentsAPI.getAll(selectedSite);
      console.log('✅ Departments data received:', response.data);
      console.log('📁 Number of departments:', response.data?.length || 0);
      console.log('🔄 Updating departments state...');
      setDepartments(response.data || []);
      console.log('✅ Departments state updated');
      
      // Fetch stats for each department
      const statsData = {};
      for (const dept of response.data || []) {
        try {
          const statsResponse = await departmentsAPI.getStats(dept._id);
          statsData[dept._id] = statsResponse.data;
        } catch (error) {
          console.error(`Error fetching stats for ${dept._id}:`, error);
        }
      }
      setStats(statsData);
    } catch (error) {
      console.error('❌ Error fetching departments:', error);
      setDepartments([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamMembers = async () => {
    try {
      console.log('🔄 Fetching team members for site:', selectedSite);
      const response = await teamAPI.getAll(selectedSite);
      console.log('✅ Team members fetched:', response.data);
      console.log('  📊 Count:', response.data?.length || 0);
      setTeamMembers(response.data || []);
    } catch (error) {
      console.error('❌ Error fetching team members:', error);
    }
  };

  const handleDeleteDepartment = async () => {
    const { departmentId } = confirmDialog;
    
    try {
      const response = await departmentsAPI.delete(departmentId);
      console.log('✅ Department deleted:', response.data);
      // Remove from state and fetch fresh data
      await fetchDepartments();
      toast.success(t('departments.deleteSuccess'));
    } catch (error) {
      console.error('❌ Error deleting department:', error);
      toast.error(error.response?.data?.error || error.response?.data?.message || t('departments.deleteError'));
    }
  };

  const openDeleteConfirm = (departmentId, departmentName) => {
    setConfirmDialog({ isOpen: true, departmentId, departmentName });
  };

  const filteredDepartments = departments.filter(dept =>
    dept.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dept.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6">
      <Helmet>
        <title>{t('departments.title')} - DestekChat</title>
      </Helmet>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Folder className="w-6 h-6" />
              {t('departments.title')}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {t('departments.subtitle')}
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            {t('departments.addDepartment')}
          </button>
        </div>

        {/* Site Selector */}
        <div className="mt-4 flex gap-4">
          <select
            value={selectedSite || ''}
            onChange={(e) => setSelectedSite(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            {sites.map(site => (
              <option key={site._id} value={site._id}>{site.name}</option>
            ))}
          </select>

          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={t('departments.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* Departments Grid */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">{t('departments.loading')}</p>
        </div>
      ) : sites.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg">
          <Globe className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 mb-4">{t('departments.noSites')}</p>
          <button
            onClick={() => navigate(routes.sites)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {t('departments.addSiteFirst')}
          </button>
        </div>
      ) : filteredDepartments.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg">
          <Folder className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">{t('departments.noDepartments')}</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {t('departments.createFirst')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDepartments.map(dept => {
            const deptStats = stats[dept._id] || {};
            
            return (
              <div key={dept._id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
                      style={{ backgroundColor: dept.color + '20' }}
                    >
                      {dept.icon}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{dept.name}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{dept.description}</p>
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="space-y-2 mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400 flex items-center gap-1">
                      <MessageSquare className="w-4 h-4" />
                      {t('departments.stats.conversations')}
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {deptStats.totalConversations || 0}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400 flex items-center gap-1">
                      <TrendingUp className="w-4 h-4" />
                      {t('departments.stats.unassigned')}
                    </span>
                    <span className="font-semibold text-orange-600 dark:text-orange-400">
                      {deptStats.unassigned || 0}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400 flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {t('departments.stats.teamMembers')}
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {dept.members?.length || 0}
                    </span>
                  </div>
                </div>

                {/* Members */}
                {dept.members && dept.members.length > 0 && (
                  <div className="mb-4">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">{t('departments.members')}:</div>
                    <div className="flex flex-wrap gap-2">
                      {dept.members.slice(0, 5).map((member, idx) => (
                        <div key={idx} className="flex items-center gap-1 text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                          <div className="w-5 h-5 rounded-full bg-gradient-to-r from-blue-400 to-purple-500 flex items-center justify-center text-white text-xs">
                            {member.userId?.name?.charAt(0).toUpperCase() || '?'}
                          </div>
                          <span className="text-gray-700 dark:text-gray-300">
                            {member.userId?.name || 'Unknown'}
                          </span>
                          {member.role === 'manager' && (
                            <span className="text-blue-600 dark:text-blue-400 text-xs">★</span>
                          )}
                        </div>
                      ))}
                      {dept.members.length > 5 && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                      {t('departments.moreMembers', { count: dept.members.length - 5 })}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Settings Info */}
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                  <div className="flex items-center gap-2">
                    <Settings className="w-3 h-3" />
                    <span>
                      {t('departments.autoAssign')}: {dept.autoAssignRules?.enabled ? 
                        <span className="text-green-600 dark:text-green-400">{t('departments.on')} ({dept.autoAssignRules.strategy})</span> : 
                        <span className="text-gray-400">{t('departments.off')}</span>
                      }
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Clock className="w-3 h-3" />
                    <span>
                      {t('departments.businessHours')}: {dept.businessHours?.enabled ? 
                        <span className="text-green-600 dark:text-green-400">{t('departments.on')}</span> : 
                        <span className="text-gray-400">{t('departments.off')}</span>
                      }
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedDepartment(dept)}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                  >
                    <Edit className="w-4 h-4" />
                    {t('departments.edit')}
                  </button>
                  <button
                    onClick={() => openDeleteConfirm(dept._id, dept.name)}
                    className="px-3 py-2 border border-red-300 dark:border-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900 text-red-600 dark:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Department Modal */}
      {(showAddModal || selectedDepartment) && (
        <AddEditDepartmentModal
          department={selectedDepartment}
          siteId={selectedSite}
          teamMembers={teamMembers}
          onClose={() => {
            setShowAddModal(false);
            setSelectedDepartment(null);
          }}
          onSave={async (newDepartment) => {
            console.log('💾 onSave called with:', newDepartment);
            // Wait for data refresh to complete
            await fetchDepartments();
            console.log('✅ fetchDepartments completed');
            // Then close modal
            setShowAddModal(false);
            setSelectedDepartment(null);
          }}
        />
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, departmentId: null, departmentName: '' })}
        onConfirm={handleDeleteDepartment}
        title={t('departments.deleteTitle')}
        message={t('departments.deleteMessage', { name: confirmDialog.departmentName })}
        confirmText={t('departments.deleteConfirm')}
        cancelText={t('departments.deleteCancel')}
        type="danger"
      />
    </div>
  );
};

// Add/Edit Department Modal Component
const AddEditDepartmentModal = ({ department, siteId, teamMembers, onClose, onSave }) => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  
  const langPrefix = language === 'en' ? '/en' : '';
  
  console.log('🎬 ===== MODAL MOUNT/RE-RENDER =====');
  console.log('  📁 department:', department);
  console.log('  👥 teamMembers count:', teamMembers?.length);
  console.log('  🌍 siteId:', siteId);
  
  const initialMembers = department?.members?.map(m => {
    const memberId = m.userId?._id || m.userId;
    const memberRole = m.role;
    console.log(`    Member: ${memberId}, role: ${memberRole}`);
    return {
      userId: memberId,
      role: memberRole
    };
  }) || [];
  
  console.log('  📋 initialMembers:', initialMembers);
  console.log('  📊 initialMembers count:', initialMembers.length);
  
  const [formData, setFormData] = useState({
    name: department?.name || '',
    description: department?.description || '',
    siteId: siteId,
    color: department?.color || '#3B82F6',
    icon: department?.icon || '💬',
    members: initialMembers,
    autoAssignRules: department?.autoAssignRules || {
      enabled: false,
      strategy: 'round-robin'
    },
    businessHours: department?.businessHours || {
      enabled: false,
      timezone: 'Europe/Istanbul'
    }
  });
  
  console.log('  📦 Initial formData:', formData);
  console.log('  👥 formData.members:', formData.members);

  const [selectedMember, setSelectedMember] = useState('');
  const [memberRole, setMemberRole] = useState('agent');
  const [saving, setSaving] = useState(false);

  // Track formData.members changes
  useEffect(() => {
    console.log('🔄 formData.members CHANGED:', formData.members);
    console.log('  📊 Count:', formData.members?.length);
  }, [formData.members]);

  const handleAddMember = () => {
    console.log('🔴🔴🔴 HANDLE ADD MEMBER ÇAĞRILDI! 🔴🔴🔴');
    console.log('  🔵 selectedMember value:', selectedMember);
    console.log('  🔵 memberRole value:', memberRole);
    
    if (!selectedMember) {
      console.log('⚠️ No member selected - RETURNING!');
      toast.error('Lütfen bir ekip üyesi seçin!');
      return;
    }
    
    console.log('➕ Adding member:', selectedMember, 'with role:', memberRole);
    
    const newMember = { userId: selectedMember, role: memberRole };
    console.log('  📝 New member object:', newMember);
    
    setFormData(prevFormData => {
      // Check if member already exists
      const exists = prevFormData.members.find(m => 
        (m.userId?._id || m.userId) === selectedMember
      );
      
      if (exists) {
        console.log('⚠️ Member already exists');
        toast.error(t('departments.modal.memberExists'));
        return prevFormData; // Return unchanged state
      }
      
      const updatedMembers = [
        ...prevFormData.members,
        newMember
      ];
      
      console.log('  📋 Updated members array:', updatedMembers);
      console.log('  📊 Total members:', updatedMembers.length);
      
      return {
        ...prevFormData,
        members: updatedMembers
      };
    });
    
    console.log('✅ Member add triggered');
    
    setSelectedMember('');
    setMemberRole('agent');
  };

  const handleRemoveMember = (userId) => {
    console.log('➖ Removing member:', userId);
    setFormData(prevFormData => ({
      ...prevFormData,
      members: prevFormData.members.filter(m => 
        (m.userId?._id || m.userId) !== userId
      )
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    console.log('🔴🔴🔴 ===== FORM SUBMIT BAŞLADI ===== 🔴🔴🔴');
    console.log('  📦 formData:', formData);
    console.log('  👥 formData.members:', formData.members);
    console.log('  📊 Members count:', formData.members?.length);
    
    // Clean members data - ensure we only send userId and role
    console.log('🔹 Step 1: Cleaning members data...');
    const cleanedData = {
      ...formData,
      members: (formData.members || []).map(m => ({
        userId: m.userId?._id || m.userId,
        role: m.role
      }))
    };
    
    console.log('🔹 Step 2: Cleaned data ready');
    console.log('  🧹 cleanedData.members:', cleanedData.members);
    console.log('  📊 Members count:', cleanedData.members.length);
    
    setSaving(true);

    try {
      console.log('🔹 Step 3: Entering try block');
      let response;
      if (department) {
        console.log('🔹 Step 4: UPDATE mode - calling API...');
        console.log('  🆔 Department ID:', department._id);
        response = await departmentsAPI.update(department._id, cleanedData);
        console.log('✅ UPDATE response:', response.data);
      } else {
        console.log('🔹 Step 4: CREATE mode - calling API...');
        response = await departmentsAPI.create(cleanedData);
        console.log('✅ CREATE response:', response.data);
      }
      
      console.log('🔹 Step 5: API call completed successfully');
      console.log('💾 Calling onSave...');
      // Let parent handle data refresh and modal closing
      await onSave(department ? null : response.data);
      console.log('✅ onSave completed');
      toast.success(department ? t('departments.modal.updateSuccess') : t('departments.modal.createSuccess'));
      setSaving(false);
    } catch (error) {
      console.error('🔴🔴🔴 ERROR IN CATCH BLOCK 🔴🔴🔴');
      console.error('🔴 Error object:', error);
      console.error('🔴 Error message:', error.message);
      console.error('🔴 Error stack:', error.stack);
      console.error('🔴 Error response:', error.response?.data);
      toast.error(error.response?.data?.error || error.message || t('departments.saveError'));
      setSaving(false);
    }
  };

  const emojiList = ['💬', '📧', '📞', '💡', '🎯', '⚡', '🚀', '🔧', '💼', '🎨', '📊', '🌟'];
  const colorList = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
            {department ? t('departments.modal.editTitle') : t('departments.modal.addTitle')}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('departments.modal.name')} *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder={t('departments.modal.namePlaceholder')}
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('departments.modal.description')}
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  rows="2"
                  placeholder={t('departments.modal.descriptionPlaceholder')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('departments.modal.icon')}
                </label>
                <div className="flex flex-wrap gap-2">
                  {emojiList.map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, icon: emoji }))}
                      className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${
                        formData.icon === emoji ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900' : 'bg-gray-100 dark:bg-gray-700'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('departments.modal.color')}
                </label>
                <div className="flex flex-wrap gap-2">
                  {colorList.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, color }))}
                      className={`w-10 h-10 rounded-lg ${
                        formData.color === color ? 'ring-2 ring-offset-2 ring-gray-400' : ''
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Auto-assign Settings */}
            <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">{t('departments.modal.autoAssignRules')}</h3>
              
              <label className="flex items-center gap-2 mb-3">
                <input
                  type="checkbox"
                  checked={formData.autoAssignRules.enabled}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    autoAssignRules: { ...prev.autoAssignRules, enabled: e.target.checked }
                  }))}
                  className="rounded border-gray-300 dark:border-gray-600"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">{t('departments.modal.enableAutoAssign')}</span>
              </label>

              {formData.autoAssignRules.enabled && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('departments.modal.strategy')}
                  </label>
                  <select
                    value={formData.autoAssignRules.strategy}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      autoAssignRules: { ...prev.autoAssignRules, strategy: e.target.value }
                    }))}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="round-robin">{t('departments.modal.roundRobin')}</option>
                    <option value="least-active">{t('departments.modal.leastActive')}</option>
                    <option value="manual">{t('departments.modal.manual')}</option>
                  </select>
                </div>
              )}
            </div>

            {/* Team Members */}
            <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">{t('departments.modal.teamMembers')}</h3>
              
              {teamMembers.length === 0 ? (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4 mb-3">
                  <div className="flex items-start gap-3">
                    <div className="text-yellow-600 dark:text-yellow-400 mt-0.5">⚠️</div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-yellow-800 dark:text-yellow-300 mb-1">
                        No Team Members Available
                      </h4>
                      <p className="text-sm text-yellow-700 dark:text-yellow-400 mb-2">
                        You need to add team members before you can assign them to departments.
                      </p>
                      <a
                        href={`${langPrefix}/dashboard/team`}
                        className="inline-flex items-center gap-1 text-sm font-medium text-yellow-800 dark:text-yellow-300 hover:underline"
                      >
                        <Users className="w-4 h-4" />
                        Go to Team Members Page →
                      </a>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 mb-3">
                  <select
                    value={selectedMember}
                    onChange={(e) => {
                      console.log('🔵 Dropdown changed:', e.target.value);
                      setSelectedMember(e.target.value);
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">{t('departments.modal.selectMember')}</option>
                    {teamMembers.map(member => (
                      <option key={member._id} value={member._id}>
                        {member.name} ({member.email})
                      </option>
                    ))}
                  </select>
                  
                  <select
                    value={memberRole}
                    onChange={(e) => setMemberRole(e.target.value)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="agent">{t('team.filters.agent')}</option>
                    <option value="manager">{t('team.filters.manager')}</option>
                  </select>
                  
                  <button
                    type="button"
                    onClick={handleAddMember}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 font-medium"
                  >
                    <Plus className="w-5 h-5" />
                    <span>{t('departments.modal.addMember') || 'Ekle'}</span>
                  </button>
                </div>
              )}

              <div className="space-y-2">
                {formData.members.map((member, idx) => {
                  const memberData = teamMembers.find(m => m._id === (member.userId?._id || member.userId));
                  return (
                    <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-400 to-purple-500 flex items-center justify-center text-white text-sm">
                          {memberData?.name?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {memberData?.name || 'Unknown'}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {member.role}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(member.userId?._id || member.userId)}
                        className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
                {formData.members.length === 0 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                    {t('departments.modal.noMembers')}
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                {t('departments.modal.cancel')}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? t('departments.modal.saving') : department ? t('departments.modal.update') : t('departments.modal.create')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Departments;
