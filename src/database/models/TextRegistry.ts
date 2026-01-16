/**
 * Text Registry Model
 * Internationalized text storage with multi-language support
 * Cache-first architecture with Redis + Memory cache
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

// ============= INTERFACES =============

export interface ITextTranslation {
  lang: string;
  text: string;
  source: 'manual' | 'google' | 'azure' | 'ai';
  translatedAt: Date;
  translatedBy?: string;
}

export interface ITextVersion {
  version: number;
  texts: Map<string, string>;
  createdAt: Date;
  createdBy: string;
  changeNote?: string;
}

export interface ITextUsage {
  flowId: string;
  flowName: string;
  nodeId: string;
  nodeType: string;
}

export interface ITextRegistry extends Document {
  // Identification
  key: string; // WELCOME_MESSAGE, CLOSED_CHAT, etc.
  
  // Content
  defaultLang: string;
  texts: Map<string, string>; // { es: "Hola", en: "Hello", pt: "Olá" }
  
  // Metadata
  description?: string;
  category: 'welcome' | 'farewell' | 'follow-up' | 'notification' | 'error' | 'menu' | 'button' | 'system' | 'custom';
  tags: string[];
  
  // Translation tracking
  translations: ITextTranslation[];
  
  // Versioning
  versions: ITextVersion[];
  currentVersion: number;
  
  // Usage tracking
  usedIn: ITextUsage[];
  usageCount: number;
  
  // A/B Testing
  abTest?: {
    enabled: boolean;
    variantA: string;
    variantB: string;
    distribution: number; // 0-100 percentage for variant A
    startDate?: Date;
    endDate?: Date;
  };
  
  // Scheduling
  scheduled?: {
    enabled: boolean;
    activateAt?: Date;
    deactivateAt?: Date;
    fallbackKey?: string;
  };
  
  // Context-aware variants
  variants: Map<string, Map<string, string>>; // { VIP: { es: "...", en: "..." }, NEW_USER: {...} }
  
  // Audit
  createdBy: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
  
  // Status
  isActive: boolean;
  isLocked: boolean; // Prevent deletion if used in active flows
}

// ============= SCHEMA =============

const TextTranslationSchema = new Schema<ITextTranslation>({
  lang: { type: String, required: true },
  text: { type: String, required: true },
  source: { type: String, enum: ['manual', 'google', 'azure', 'ai'], default: 'manual' },
  translatedAt: { type: Date, default: Date.now },
  translatedBy: String,
}, { _id: false });

const TextVersionSchema = new Schema<ITextVersion>({
  version: { type: Number, required: true },
  texts: { type: Map, of: String },
  createdAt: { type: Date, default: Date.now },
  createdBy: { type: String, required: true },
  changeNote: String,
}, { _id: false });

const TextUsageSchema = new Schema<ITextUsage>({
  flowId: { type: String, required: true },
  flowName: { type: String, required: true },
  nodeId: { type: String, required: true },
  nodeType: { type: String, required: true },
}, { _id: false });

const TextRegistrySchema = new Schema<ITextRegistry>({
  key: { 
    type: String, 
    required: true, 
    unique: true,
    uppercase: true,
    trim: true,
    match: /^[A-Z][A-Z0-9_]*$/,
  },
  
  defaultLang: { 
    type: String, 
    required: true, 
    default: 'es',
    enum: ['es', 'en', 'pt', 'fr', 'de', 'it', 'ru', 'zh', 'ja', 'ko', 'ar'],
  },
  
  texts: { 
    type: Map, 
    of: String, 
    required: true,
    default: new Map(),
  },
  
  description: String,
  
  category: { 
    type: String, 
    enum: ['welcome', 'farewell', 'follow-up', 'notification', 'error', 'menu', 'button', 'system', 'custom'],
    default: 'custom',
  },
  
  tags: [{ type: String, lowercase: true, trim: true }],
  
  translations: [TextTranslationSchema],
  
  versions: [TextVersionSchema],
  currentVersion: { type: Number, default: 1 },
  
  usedIn: [TextUsageSchema],
  usageCount: { type: Number, default: 0 },
  
  abTest: {
    enabled: { type: Boolean, default: false },
    variantA: String,
    variantB: String,
    distribution: { type: Number, min: 0, max: 100, default: 50 },
    startDate: Date,
    endDate: Date,
  },
  
  scheduled: {
    enabled: { type: Boolean, default: false },
    activateAt: Date,
    deactivateAt: Date,
    fallbackKey: String,
  },
  
  variants: { 
    type: Map, 
    of: { type: Map, of: String },
    default: new Map(),
  },
  
  createdBy: { type: String, required: true },
  updatedBy: String,
  
  isActive: { type: Boolean, default: true },
  isLocked: { type: Boolean, default: false },
}, {
  timestamps: true,
  collection: 'text_registry',
});

// ============= INDEXES =============

TextRegistrySchema.index({ key: 1 }, { unique: true });
TextRegistrySchema.index({ category: 1 });
TextRegistrySchema.index({ tags: 1 });
TextRegistrySchema.index({ isActive: 1 });
TextRegistrySchema.index({ 'usedIn.flowId': 1 });
TextRegistrySchema.index({ createdAt: -1 });
TextRegistrySchema.index({ updatedAt: -1 });

// Text search index
TextRegistrySchema.index({ 
  key: 'text', 
  description: 'text', 
  tags: 'text' 
}, { 
  weights: { key: 10, description: 5, tags: 3 },
  name: 'text_search_idx',
});

// ============= METHODS =============

TextRegistrySchema.methods.getText = function(lang: string, variant?: string): string | null {
  // Check variant first
  if (variant && this.variants.has(variant)) {
    const variantTexts = this.variants.get(variant);
    if (variantTexts?.has(lang)) {
      return variantTexts.get(lang)!;
    }
  }
  
  // Check main texts
  if (this.texts.has(lang)) {
    return this.texts.get(lang)!;
  }
  
  // Fallback to default language
  if (this.texts.has(this.defaultLang)) {
    return this.texts.get(this.defaultLang)!;
  }
  
  // Last resort: first available
  const firstKey = this.texts.keys().next().value;
  return firstKey ? this.texts.get(firstKey)! : null;
};

TextRegistrySchema.methods.addVersion = function(createdBy: string, changeNote?: string): void {
  const newVersion: ITextVersion = {
    version: this.currentVersion,
    texts: new Map(this.texts),
    createdAt: new Date(),
    createdBy,
    changeNote,
  };
  
  this.versions.push(newVersion);
  this.currentVersion += 1;
  
  // Keep only last 10 versions
  if (this.versions.length > 10) {
    this.versions = this.versions.slice(-10);
  }
};

// ============= STATICS =============

TextRegistrySchema.statics.findByKey = function(key: string) {
  return this.findOne({ key: key.toUpperCase(), isActive: true });
};

TextRegistrySchema.statics.findByCategory = function(category: string) {
  return this.find({ category, isActive: true }).sort({ key: 1 });
};

TextRegistrySchema.statics.findUsedInFlow = function(flowId: string) {
  return this.find({ 'usedIn.flowId': flowId, isActive: true });
};

TextRegistrySchema.statics.search = function(query: string, options?: { category?: string; lang?: string }) {
  const filter: Record<string, unknown> = { 
    isActive: true,
    $text: { $search: query },
  };
  
  if (options?.category) {
    filter.category = options.category;
  }
  
  return this.find(filter, { score: { $meta: 'textScore' } })
    .sort({ score: { $meta: 'textScore' } })
    .limit(50);
};

// ============= MODEL =============

export const TextRegistry: Model<ITextRegistry> = mongoose.model<ITextRegistry>('TextRegistry', TextRegistrySchema);

export default TextRegistry;
