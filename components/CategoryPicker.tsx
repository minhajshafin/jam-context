'use client';

import { CATEGORY_META } from '@/lib/constants';
import type { IncidentCategory } from '@/types';

interface CategoryPickerProps {
  value: IncidentCategory | null;
  onChange: (category: IncidentCategory) => void;
}

const CATEGORIES = Object.entries(CATEGORY_META) as [
  IncidentCategory,
  { label: string; color: string; emoji: string }
][];

export default function CategoryPicker({ value, onChange }: CategoryPickerProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {CATEGORIES.map(([category, meta]) => {
        const isSelected = value === category;
        return (
          <button
            key={category}
            onClick={() => onChange(category)}
            className={`
              flex flex-col items-center justify-center gap-2 p-5 rounded-2xl border-2 transition-all min-h-[100px]
              ${isSelected
                ? 'border-white/80 scale-[1.03] shadow-lg'
                : 'border-gray-700 hover:border-gray-500'
              }
            `}
            style={{
              background: isSelected ? `${meta.color}22` : 'rgb(31 41 55)',
              borderColor: isSelected ? meta.color : undefined,
            }}
            aria-pressed={isSelected}
            aria-label={meta.label}
          >
            <span className="text-4xl">{meta.emoji}</span>
            <span
              className="text-sm font-semibold"
              style={{ color: isSelected ? meta.color : '#9ca3af' }}
            >
              {meta.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
