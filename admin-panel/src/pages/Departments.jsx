import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { departmentsAPI, teamAPI, sitesAPI } from '../services/api';
import { 
  Folder, Plus, Edit, Trash2, Users, MessageSquare, 
  Settings, TrendingUp, Clock, Search, Globe 
} from 'lucide-react';

const Departments = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [departments, setDepartments] = useState([]);
  const [sites, setSites] = useState([]);
  const [selectedSite, setSelectedSite] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});

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
      const response = await teamAPI.getAll(selectedSite);
      setTeamMembers(response.data || []);
    } catch (error) {
      console.error('Error fetching team members:', error);
    }
  };

  const handleDeleteDepartment = async (departmentId) => {
    if (!confirm(t('departments.confirmDelete'))) return;
    
    try {
      const response = await departmentsAPI.delete(departmentId);
      console.log('✅ Department deleted:', response.data);
      // Remove from state and fetch fresh data
      await fetchDepartments();
    } catch (error) {
      console.error('❌ Error deleting department:', error);
      alert(error.response?.data?.error || error.response?.data?.message || 'Failed to delete department');
    }
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
            onClick={() => navigate('/dashboard/sites')}
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
                    onClick={() => handleDeleteDepartment(dept._id)}
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
    </div>
  );
};

// Add/Edit Department Modal Component
const AddEditDepartmentModal = ({ department, siteId, teamMembers, onClose, onSave }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    name: department?.name || '',
    description: department?.description || '',
    siteId: siteId,
    color: department?.color || '#3B82F6',
    icon: department?.icon || '💬',
    members: department?.members || [],
    autoAssignRules: department?.autoAssignRules || {
      enabled: false,
      strategy: 'round-robin'
    },
    businessHours: department?.businessHours || {
      enabled: false,
      timezone: 'Europe/Istanbul'
    }
  });

  const [selectedMember, setSelectedMember] = useState('');
  const [memberRole, setMemberRole] = useState('agent');
  const [saving, setSaving] = useState(false);

  const handleAddMember = () => {
    if (!selectedMember) return;
    
    const exists = formData.members.find(m => 
      (m.userId?._id || m.userId) === selectedMember
    );
    
    if (exists) {
      alert(t('departments.modal.memberExists'));
      return;
    }
    
    setFormData({
      ...formData,
      members: [
        ...formData.members,
        { userId: selectedMember, role: memberRole }
      ]
    });
    
    setSelectedMember('');
    setMemberRole('agent');
  };

  const handleRemoveMember = (userId) => {
    setFormData({
      ...formData,
      members: formData.members.filter(m => 
        (m.userId?._id || m.userId) !== userId
      )
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    console.log('📝 Submitting department data:', formData);
    setSaving(true);

    try {
      let response;
      if (department) {
        response = await departmentsAPI.update(department._id, formData);
        console.log('✅ Department updated:', response.data);
      } else {
        response = await departmentsAPI.create(formData);
        console.log('✅ Department created:', response.data);
      }
      
      console.log('💾 Calling onSave...');
      // Let parent handle data refresh and modal closing
      await onSave(department ? null : response.data);
      console.log('✅ onSave completed');
      setSaving(false);
    } catch (error) {
      console.error('❌ Error saving department:', error);
      console.error('Error details:', error.response?.data);
      alert(error.response?.data?.error || error.message || 'Failed to save department');
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
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
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
                      onClick={() => setFormData({ ...formData, icon: emoji })}
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
                      onClick={() => setFormData({ ...formData, color })}
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
                  onChange={(e) => setFormData({
                    ...formData,
                    autoAssignRules: { ...formData.autoAssignRules, enabled: e.target.checked }
                  })}
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
                    onChange={(e) => setFormData({
                      ...formData,
                      autoAssignRules: { ...formData.autoAssignRules, strategy: e.target.value }
                    })}
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
              
              <div className="flex gap-2 mb-3">
                <select
                  value={selectedMember}
                  onChange={(e) => setSelectedMember(e.target.value)}
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
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

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
