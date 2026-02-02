'use client';

import { useState } from 'react';
import { clsx } from 'clsx';
import {
  ChevronRight,
  ChevronDown,
  Building2,
  Users,
  User,
  Edit2,
  Trash2,
  GripVertical,
} from 'lucide-react';
import type { Department } from '@/types';

interface DepartmentTreeProps {
  departments: Department[];
  onEdit: (department: Department) => void;
  onDelete: (department: Department) => void;
  level?: number;
  onDragStart?: (department: Department) => void;
  onDragOver?: (department: Department) => void;
  onDrop?: (targetDepartment: Department) => void;
  draggedDepartment?: Department | null;
}

interface DepartmentNodeProps {
  department: Department;
  onEdit: (department: Department) => void;
  onDelete: (department: Department) => void;
  level: number;
  onDragStart?: (department: Department) => void;
  onDragOver?: (department: Department) => void;
  onDrop?: (targetDepartment: Department) => void;
  draggedDepartment?: Department | null;
}

function DepartmentNode({
  department,
  onEdit,
  onDelete,
  level,
  onDragStart,
  onDragOver,
  onDrop,
  draggedDepartment,
}: DepartmentNodeProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isDragOver, setIsDragOver] = useState(false);

  const hasChildren = department.children && department.children.length > 0;
  const indentPx = level * 24;

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move';
    onDragStart?.(department);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedDepartment && draggedDepartment.id !== department.id) {
      setIsDragOver(true);
      onDragOver?.(department);
    }
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (draggedDepartment && draggedDepartment.id !== department.id) {
      onDrop?.(department);
    }
  };

  return (
    <div className="select-none">
      <div
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={clsx(
          'group flex items-center gap-2 px-3 py-2.5 rounded-lg transition-all duration-200',
          'hover:bg-gray-50 dark:hover:bg-gray-700/50',
          isDragOver && 'bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500',
          !department.isActive && 'opacity-50'
        )}
        style={{ paddingLeft: `${indentPx + 12}px` }}
      >
        {/* Drag Handle */}
        <div className="cursor-grab opacity-0 group-hover:opacity-100 transition-opacity">
          <GripVertical className="w-4 h-4 text-gray-400" />
        </div>

        {/* Expand/Collapse Toggle */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={clsx(
            'p-0.5 rounded transition-colors',
            hasChildren
              ? 'hover:bg-gray-200 dark:hover:bg-gray-600'
              : 'invisible'
          )}
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          )}
        </button>

        {/* Department Icon */}
        <div className="flex-shrink-0">
          <Building2 className="w-5 h-5 text-blue-500" />
        </div>

        {/* Department Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900 dark:text-white truncate">
              {department.name}
            </span>
            {department.code && (
              <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                {department.code}
              </span>
            )}
            {!department.isActive && (
              <span className="text-xs text-red-500 bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 rounded">
                Inactive
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {department.managerName && (
              <span className="flex items-center gap-1">
                <User className="w-3.5 h-3.5" />
                {department.managerName}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {department.employeeCount ?? 0} employees
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(department);
            }}
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
            title="Edit department"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(department);
            }}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
            title="Delete department"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="mt-0.5">
          <DepartmentTree
            departments={department.children!}
            onEdit={onEdit}
            onDelete={onDelete}
            level={level + 1}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDrop={onDrop}
            draggedDepartment={draggedDepartment}
          />
        </div>
      )}
    </div>
  );
}

export function DepartmentTree({
  departments,
  onEdit,
  onDelete,
  level = 0,
  onDragStart,
  onDragOver,
  onDrop,
  draggedDepartment,
}: DepartmentTreeProps) {
  if (departments.length === 0) {
    return null;
  }

  return (
    <div className="space-y-0.5">
      {departments.map((department) => (
        <DepartmentNode
          key={department.id}
          department={department}
          onEdit={onEdit}
          onDelete={onDelete}
          level={level}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDrop={onDrop}
          draggedDepartment={draggedDepartment}
        />
      ))}
    </div>
  );
}

export default DepartmentTree;
