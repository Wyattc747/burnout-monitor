'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ZoneIndicator } from './ZoneIndicator';
import { Avatar } from './Avatar';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  department: string;
  jobTitle: string;
  zone: 'green' | 'yellow' | 'red';
  burnoutScore: number | null;
  readinessScore: number | null;
}

interface AvailableEmployee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  department: string;
  jobTitle: string;
}

async function fetchTeamMembers(): Promise<TeamMember[]> {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_URL}/teams/members`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch team members');
  return res.json();
}

async function fetchAvailableEmployees(): Promise<AvailableEmployee[]> {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_URL}/teams/available`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch available employees');
  return res.json();
}

async function addTeamMember(employeeId: string): Promise<void> {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_URL}/teams/members/${employeeId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to add team member');
}

async function removeTeamMember(employeeId: string): Promise<void> {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_URL}/teams/members/${employeeId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to remove team member');
}

export function TeamManagement() {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: members = [], isLoading: loadingMembers } = useQuery({
    queryKey: ['team-members'],
    queryFn: fetchTeamMembers,
  });

  const { data: available = [], isLoading: loadingAvailable } = useQuery({
    queryKey: ['available-employees'],
    queryFn: fetchAvailableEmployees,
    enabled: showAddModal,
  });

  const addMutation = useMutation({
    mutationFn: addTeamMember,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      queryClient.invalidateQueries({ queryKey: ['available-employees'] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: removeTeamMember,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      queryClient.invalidateQueries({ queryKey: ['available-employees'] });
    },
  });

  const filteredAvailable = available.filter((emp) => {
    const query = searchQuery.toLowerCase();
    const fullName = `${emp.firstName} ${emp.lastName}`.toLowerCase();
    return (
      fullName.includes(query) ||
      emp.email.toLowerCase().includes(query) ||
      emp.department?.toLowerCase().includes(query) ||
      emp.jobTitle?.toLowerCase().includes(query)
    );
  });

  if (loadingMembers) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
          <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Team Members</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {members.length} member{members.length !== 1 ? 's' : ''} in your team
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Add Member
        </button>
      </div>

      {members.length === 0 ? (
        <div className="text-center py-12">
          <svg className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No team members yet</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">Add employees to your team to start tracking their wellness.</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            Add Your First Member
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
            >
              <div className="flex items-center gap-4">
                <Avatar name={`${member.firstName} ${member.lastName}`} size="md" />
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    {member.firstName} {member.lastName}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {member.jobTitle} {member.department && `- ${member.department}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <ZoneIndicator zone={member.zone} size="sm" />
                <button
                  onClick={() => removeMutation.mutate(member.id)}
                  disabled={removeMutation.isPending}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  title="Remove from team"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Member Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full max-h-[80vh] overflow-hidden shadow-xl">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Add Team Member</h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="mt-4 relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search by name, email, department, or title..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  autoFocus
                />
              </div>
            </div>
            <div className="p-6 overflow-y-auto max-h-96">
              {loadingAvailable ? (
                <div className="animate-pulse space-y-3">
                  <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>
              ) : filteredAvailable.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  {searchQuery ? 'No employees match your search' : 'No available employees to add'}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredAvailable.map((emp) => (
                    <div
                      key={emp.id}
                      className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar name={`${emp.firstName} ${emp.lastName}`} size="sm" />
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {emp.firstName} {emp.lastName}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {emp.jobTitle}{emp.department && ` · ${emp.department}`}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          addMutation.mutate(emp.id);
                        }}
                        disabled={addMutation.isPending}
                        className="px-3 py-1.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-lg hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors text-sm font-medium"
                      >
                        Add
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TeamManagement;
