/**
 * Category Selector Component
 * Dropdown to set/change chat category
 */

import React from 'react';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select-advanced';
import { useSocket } from '../../hooks/useSocket';
import type { ChatCategory } from '../../types';
import { Tag, HelpCircle, CreditCard, Bug, MessageSquare, MoreHorizontal } from 'lucide-react';

interface CategorySelectorProps {
  sessionId: string;
  currentCategory?: ChatCategory;
  disabled?: boolean;
  compact?: boolean;
}

const CATEGORY_OPTIONS: { value: ChatCategory; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'support', label: 'Soporte', icon: <HelpCircle className="w-4 h-4" />, color: 'text-blue-500' },
  { value: 'billing', label: 'Facturación', icon: <CreditCard className="w-4 h-4" />, color: 'text-green-500' },
  { value: 'bug', label: 'Bug/Error', icon: <Bug className="w-4 h-4" />, color: 'text-red-500' },
  { value: 'feedback', label: 'Feedback', icon: <MessageSquare className="w-4 h-4" />, color: 'text-purple-500' },
  { value: 'other', label: 'Otro', icon: <MoreHorizontal className="w-4 h-4" />, color: 'text-gray-500' },
];

export const CategorySelector: React.FC<CategorySelectorProps> = ({
  sessionId,
  currentCategory,
  disabled = false,
  compact = false,
}) => {
  const { socket } = useSocket();

  const handleCategoryChange = (category: ChatCategory) => {
    socket?.emit('session:setCategory', { sessionId, category });
  };

  const selectedOption = CATEGORY_OPTIONS.find(opt => opt.value === currentCategory);

  return (
    <Select 
      value={currentCategory || ''} 
      onValueChange={handleCategoryChange}
      disabled={disabled}
    >
      <SelectTrigger className={compact ? 'w-[140px] h-8 text-xs' : 'w-[180px]'}>
        <SelectValue placeholder={
          <span className="flex items-center gap-2 text-muted-foreground">
            <Tag className="w-4 h-4" />
            {compact ? 'Categoría' : 'Sin categoría'}
          </span>
        }>
          {selectedOption && (
            <span className={`flex items-center gap-2 ${selectedOption.color}`}>
              {selectedOption.icon}
              {selectedOption.label}
            </span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {CATEGORY_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            <span className={`flex items-center gap-2 ${option.color}`}>
              {option.icon}
              {option.label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default CategorySelector;
