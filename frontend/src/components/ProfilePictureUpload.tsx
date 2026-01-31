'use client';

import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { profileApi } from '@/lib/api';
import { Avatar } from './Avatar';
import { clsx } from 'clsx';

interface ProfilePictureUploadProps {
  currentUrl?: string | null;
  name: string;
  onSuccess?: (url: string) => void;
}

export function ProfilePictureUpload({ currentUrl, name, onSuccess }: ProfilePictureUploadProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: profileApi.uploadAvatar,
    onSuccess: (data) => {
      setPreviewUrl(null);
      queryClient.invalidateQueries({ queryKey: ['user'] });
      onSuccess?.(data.profilePictureUrl);
    },
  });

  const removeMutation = useMutation({
    mutationFn: profileApi.removeAvatar,
    onSuccess: () => {
      setPreviewUrl(null);
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
      alert('Please select a valid image file (JPEG, PNG, GIF, or WebP)');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload file
    uploadMutation.mutate(file);
  };

  const handleRemove = () => {
    if (confirm('Remove your profile picture?')) {
      removeMutation.mutate();
    }
  };

  const isLoading = uploadMutation.isPending || removeMutation.isPending;
  const displayUrl = previewUrl || currentUrl;

  return (
    <div className="flex items-center gap-4">
      <div
        className="relative"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <Avatar
          src={displayUrl}
          name={name}
          size="xl"
          className={clsx(isLoading && 'opacity-50')}
        />

        {/* Overlay on hover */}
        {(isHovered || isLoading) && (
          <div
            className={clsx(
              'absolute inset-0 rounded-full flex items-center justify-center',
              'bg-black/40 cursor-pointer transition-opacity'
            )}
            onClick={() => fileInputRef.current?.click()}
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent" />
            ) : (
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            )}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
        >
          {currentUrl ? 'Change photo' : 'Upload photo'}
        </button>
        {currentUrl && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={isLoading}
            className="text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
          >
            Remove
          </button>
        )}
      </div>

      {uploadMutation.isError && (
        <p className="text-sm text-red-600">
          {(uploadMutation.error as any)?.response?.data?.message || 'Upload failed'}
        </p>
      )}
    </div>
  );
}
